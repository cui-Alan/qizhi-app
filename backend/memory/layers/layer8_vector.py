"""
企智 · 第8层：向量搜索
Layer 8: Vector Search (BM25 + Simple Embedding)

功能：
- BM25 全文搜索（基于关键词权重）
- 简单的向量相似度搜索（无 pgvector 依赖时使用）
- 记忆检索与相关性排序
"""

import os
import json
import re
import math
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from collections import Counter

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from db.supabase import table


@dataclass
class SearchResult:
    """搜索结果"""
    key: str
    value: str
    score: float
    category: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class VectorSearchStore:
    """
    第8层：向量搜索存储
    
    实现方式：
    1. BM25: 基于词频-逆文档频率的关键词搜索
    2. Simple Embedding: 使用词向量平均的轻量方案
    
    数据结构：
    - memory_vectors 表 (Supabase): key, content, vector(1536), category
    - 本地 fallback: memory/vectors/*.json
    """
    
    # BM25 参数
    K1 = 1.5
    B = 0.75
    
    def __init__(self, base_path: str = "~/.qizhi/memory/vectors"):
        self.base_path = os.path.expanduser(base_path)
        self._ensure_dir()
    
    def _ensure_dir(self):
        Path(self.base_path).mkdir(parents=True, exist_ok=True)
    
    def _vector_path(self, key: str) -> str:
        safe_key = re.sub(r'[^\w\-_.]', '_', key)
        return os.path.join(self.base_path, f"{safe_key}.json")
    
    # ===== 基础文本处理 =====
    
    def _tokenize(self, text: str) -> List[str]:
        """简单分词"""
        text = text.lower()
        # 简单中文分词（按字符）+ 英文分词
        tokens = re.findall(r'[\w]+', text)
        # 过滤停用词和短词
        stopwords = {'的', '了', '是', '在', '和', '与', '为', '对', '等', '上', '下', '中', '这', '那', '有', '我', '你', '他', '她', '它', '们', 'a', 'an', 'the', 'is', 'are', 'was', 'were'}
        return [t for t in tokens if len(t) > 1 and t not in stopwords]
    
    def _compute_term_freq(self, token: str, tokens: List[str]) -> float:
        """计算词频"""
        return tokens.count(token) / len(tokens) if tokens else 0
    
    def _compute_inverse_doc_freq(self, token: str, all_doc_tokens: List[List[str]]) -> float:
        """计算逆文档频率"""
        n_docs = len(all_doc_tokens)
        doc_count = sum(1 for doc in all_doc_tokens if token in doc)
        return math.log((n_docs - doc_count + 0.5) / (doc_count + 0.5) + 1)
    
    # ===== BM25 搜索 =====
    
    def _bm25_score(self, query_tokens: List[str], doc_tokens: List[str], 
                    avg_doc_len: float, all_doc_tokens: List[List[str]]) -> float:
        """计算 BM25 分数"""
        score = 0.0
        doc_len = len(doc_tokens)
        
        for token in query_tokens:
            if token not in doc_tokens:
                continue
            
            tf = self._compute_term_freq(token, doc_tokens)
            idf = self._compute_inverse_doc_freq(token, all_doc_tokens)
            
            # BM25 公式
            numerator = tf * (self.K1 + 1)
            denominator = tf + self.K1 * (1 - self.B + self.B * doc_len / avg_doc_len)
            score += idf * numerator / denominator
        
        return score
    
    def _build_inverted_index(self, documents: List[Tuple[str, List[str]]]) -> Dict[str, List[Tuple[str, float]]]:
        """构建倒排索引"""
        index = {}
        for key, tokens in documents:
            for token in set(tokens):
                if token not in index:
                    index[token] = []
                index[token].append((key, tokens.count(token) / len(tokens)))
        return index
    
    # ===== 简单向量搜索（基于词向量平均）=====
    
    def _text_to_simple_vector(self, text: str, vocab: Dict[str, int], dim: int = 128) -> List[float]:
        """将文本转为简单向量（词频向量）"""
        tokens = self._tokenize(text)
        vector = [0.0] * dim
        
        # 简单哈希到固定维度
        for i, token in enumerate(set(tokens)):
            hash_val = hash(token) % dim
            vector[hash_val] += 1
        
        # L2 归一化
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]
        
        return vector
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """计算余弦相似度"""
        dot = sum(a * b for a, b in zip(vec1, vec2))
        return max(0, dot)  # 非负
    
    # ===== 公共接口 =====
    
    def index_document(self, key: str, content: str, category: str = "general",
                       metadata: Dict = None) -> bool:
        """索引文档（添加到搜索索引）"""
        tokens = self._tokenize(content)
        
        # 保存到 Supabase
        try:
            data = {
                "key": key,
                "content": content,
                "tokens": json.dumps(tokens),
                "category": category,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {}
            }
            resp = table("memory_vectors").upsert(data, on_conflict="key").execute()
            if resp.data:
                return True
        except Exception as e:
            print(f"[VectorSearch] Supabase index failed: {e}")
        
        # 本地 fallback
        doc_data = {
            "key": key,
            "content": content,
            "tokens": tokens,
            "category": category,
            "metadata": metadata or {}
        }
        with open(self._vector_path(key), 'w', encoding='utf-8') as f:
            json.dump(doc_data, f, ensure_ascii=False)
        
        return True
    
    def search(self, query: str, limit: int = 10, category: str = None) -> List[SearchResult]:
        """
        搜索文档（BM25 + 向量混合）
        
        Args:
            query: 搜索查询
            limit: 返回结果数量
            category: 可选，限定分类
        
        Returns:
            List[SearchResult]: 按相关性排序的搜索结果
        """
        query_tokens = self._tokenize(query)
        
        # 尝试从 Supabase 获取所有文档
        documents = []
        try:
            query_builder = table("memory_vectors").select("key, content, category, metadata")
            if category:
                query_builder = query_builder.eq("category", category)
            resp = query_builder.execute()
            
            for row in (resp.data or []):
                tokens = json.loads(row["tokens"]) if isinstance(row.get("tokens"), str) else row.get("tokens", [])
                documents.append((row["key"], tokens, row["content"], row.get("category", ""), row.get("metadata", {})))
        except Exception as e:
            print(f"[VectorSearch] Supabase search failed: {e}")
        
        # 如果 Supabase 失败，使用本地文件
        if not documents:
            for filename in os.listdir(self.base_path):
                if filename.endswith(".json"):
                    path = os.path.join(self.base_path, filename)
                    with open(path, 'r', encoding='utf-8') as f:
                        doc = json.load(f)
                        tokens = doc.get("tokens", [])
                        if not isinstance(tokens, list):
                            tokens = self._tokenize(doc.get("content", ""))
                        documents.append((
                            doc["key"],
                            tokens,
                            doc.get("content", ""),
                            doc.get("category", ""),
                            doc.get("metadata", {})
                        ))
        
        if not documents:
            return []
        
        # BM25 搜索
        all_doc_tokens = [doc[1] for doc in documents]
        avg_doc_len = sum(len(doc[1]) for doc in documents) / len(documents) if documents else 1
        
        scores = []
        for key, tokens, content, cat, meta in documents:
            if not query_tokens:
                score = 0.0
            else:
                score = self._bm25_score(query_tokens, tokens, avg_doc_len, all_doc_tokens)
            scores.append((key, content, score, cat, meta))
        
        # 简单向量相似度增强
        try:
            vocab = {}
            for doc in documents:
                for token in doc[1]:
                    if token not in vocab:
                        vocab[token] = len(vocab)
            
            query_vec = self._text_to_simple_vector(query, vocab)
            
            for i, (key, tokens, content, cat, meta) in enumerate(documents):
                doc_vec = self._text_to_simple_vector(content, vocab)
                vec_sim = self._cosine_similarity(query_vec, doc_vec)
                # 混合分数：BM25 * 0.7 + 向量相似度 * 0.3
                scores[i] = (key, content, scores[i][2] * 0.7 + vec_sim * 0.3, cat, meta)
        except Exception as e:
            print(f"[VectorSearch] Vector similarity failed: {e}")
        
        # 排序并返回
        scores.sort(key=lambda x: x[2], reverse=True)
        
        return [
            SearchResult(key=key, value=content, score=score, category=cat, metadata=meta)
            for key, content, score, cat, meta in scores[:limit]
            if score > 0
        ]
    
    def delete_document(self, key: str) -> bool:
        """从索引中删除文档"""
        # Supabase
        try:
            table("memory_vectors").delete().eq("key", key).execute()
        except:
            pass
        
        # 本地
        try:
            os.remove(self._vector_path(key))
            return True
        except:
            return False
    
    def get_similar(self, key: str, limit: int = 5) -> List[SearchResult]:
        """获取与指定文档相似的其他文档"""
        # 获取原文档
        try:
            resp = table("memory_vectors").select("content").eq("key", key).execute()
            if not resp.data:
                return []
            content = resp.data[0]["content"]
        except:
            path = self._vector_path(key)
            if not os.path.exists(path):
                return []
            with open(path, 'r', encoding='utf-8') as f:
                doc = json.load(f)
                content = doc.get("content", "")
        
        # 搜索相似内容
        return self.search(content, limit=limit + 1)[1:]  # 排除自身


# 全局单例
_vector_search_store: Optional[VectorSearchStore] = None

def get_vector_search_store() -> VectorSearchStore:
    """获取全局向量搜索实例"""
    global _vector_search_store
    if _vector_search_store is None:
        _vector_search_store = VectorSearchStore()
    return _vector_search_store


# ===== 便捷函数 =====

def index_memory(key: str, value: str, category: str = "general", 
                metadata: Dict = None) -> bool:
    """索引记忆（便捷函数）"""
    store = get_vector_search_store()
    content = f"{key}: {value}"
    return store.index_document(key, content, category, metadata)


def search_memories(query: str, limit: int = 10, category: str = None) -> List[SearchResult]:
    """搜索记忆（便捷函数）"""
    store = get_vector_search_store()
    return store.search(query, limit, category)

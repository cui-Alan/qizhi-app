"""
企智 · 第6层：会话上下文注入
Layer 6: Session Context Injection (Final LLM Prompt Assembly)

功能：
- 汇总所有层的记忆
- 组装最终注入 LLM 的上下文
- SYSTEM PROMPT + 记忆 + 技能 + 会话历史
"""

import os
from typing import List, Dict, Any, Optional
from pathlib import Path

# 导入各层
from .layer1_persistent import get_memory, PersistentMemory
from .layer2_session import get_session_memory, SessionMemory

# Layer3 可能不存在，使用 try/except
try:
    from .layer3_skills import get_skills_registry, SkillsRegistry
    _has_skills = True
except ImportError:
    _has_skills = False
    SkillsRegistry = None


class ContextBuilder:
    """
    第6层：会话上下文注入器
    
    将所有层的记忆汇聚成最终的 LLM 上下文
    
    注入顺序：
    1. SYSTEM PROMPT (soul.md)
    2. 第1层: 持久记忆 (relevant memories)
    3. 第3层: 技能说明 (loaded skills)
    4. 第4层: MCP Bridge 共享上下文
    5. 第2层: 会话历史 (recent messages)
    """
    
    def __init__(self, 
                 memory: PersistentMemory = None,
                 session_memory: SessionMemory = None,
                 skills_registry = None):
        self.memory = memory or get_memory()
        self.session_memory = session_memory or get_session_memory()
        self.skills_registry = skills_registry
        if self.skills_registry is None and _has_skills:
            try:
                self.skills_registry = get_skills_registry()
            except:
                pass
    
    def build_system_prompt(self) -> str:
        """构建 SYSTEM PROMPT"""
        soul = self.memory.get_soul()
        if soul:
            return soul
        
        # 默认 SYSTEM PROMPT
        return """你是一个专业的 AI 助手，名为企智。
你有以下能力：
- 工作流自动化编排
- 知识库问答
- 多渠道消息处理
- 文件处理和数据分析

请根据用户需求，提供专业、高效的帮助。"""
    
    def build_context(self, session_id: str, user_message: str = "") -> Dict[str, Any]:
        """
        构建完整上下文
        
        Returns:
            {
                "system_prompt": str,
                "relevant_memories": List[Dict],
                "loaded_skills": List[Dict],
                "mcp_context": Dict[str, str],
                "conversation_history": List[Dict]
            }
        """
        # 1. SYSTEM PROMPT
        system_prompt = self.build_system_prompt()
        
        # 2. 相关记忆（搜索相关）
        relevant_memories = self._get_relevant_memories(user_message)
        
        # 3. 已加载技能
        loaded_skills = self._get_loaded_skills()
        
        # 4. MCP Bridge 共享上下文
        mcp_context = self._get_mcp_context()
        
        # 5. 会话历史（优先从 Supabase 获取，fallback 到本地）
        conversation_history = self._get_conversation_history(session_id)
        
        return {
            "system_prompt": system_prompt,
            "relevant_memories": relevant_memories,
            "loaded_skills": loaded_skills,
            "mcp_context": mcp_context,
            "conversation_history": conversation_history
        }
    
    def build_llm_messages(self, session_id: str, user_message: str = "") -> List[Dict[str, str]]:
        """
        构建 LLM 消息列表（用于 API 调用）
        
        Returns:
            [
                {"role": "system", "content": "..."},
                {"role": "user", "content": "..."},
                {"role": "assistant", "content": "..."},
                ...
            ]
        """
        ctx = self.build_context(session_id, user_message)
        messages = []
        
        # 1. SYSTEM PROMPT
        system_content = ctx["system_prompt"]
        
        # 添加相关记忆到 SYSTEM PROMPT
        if ctx["relevant_memories"]:
            memories_text = "\n\n## 相关记忆：\n"
            for m in ctx["relevant_memories"]:
                memories_text += f"- {m['key']}: {m['value']}\n"
            system_content += memories_text
        
        # 添加 MCP 上下文到 SYSTEM PROMPT
        if ctx["mcp_context"]:
            mcp_text = "\n\n## 共享上下文：\n"
            for k, v in ctx["mcp_context"].items():
                mcp_text += f"- {k}: {v}\n"
            system_content += mcp_text
        
        # 添加技能说明到 SYSTEM PROMPT
        if ctx["loaded_skills"]:
            skills_text = "\n\n## 可用技能：\n"
            for s in ctx["loaded_skills"]:
                skills_text += f"- {s['name']}: {s['description']}\n"
            system_content += skills_text
        
        messages.append({"role": "system", "content": system_content})
        
        # 2. 会话历史
        messages.extend(ctx["conversation_history"])
        
        # 3. 当前用户消息
        if user_message:
            messages.append({"role": "user", "content": user_message})
        
        return messages
    
    def _get_relevant_memories(self, query: str, limit: int = 5) -> List[Dict[str, str]]:
        """获取相关记忆"""
        try:
            results = self.memory.search(query, limit=limit)
            return [{"key": r.key, "value": r.value, "category": r.category} for r in results]
        except:
            return []
    
    def _get_loaded_skills(self) -> List[Dict[str, str]]:
        """获取已加载技能"""
        if not self.skills_registry:
            return []
        try:
            skills = self.skills_registry.list_skills()
            return [{"name": s.name, "description": s.description} for s in skills]
        except:
            return []
    
    def _get_mcp_context(self) -> Dict[str, str]:
        """获取 MCP Bridge 共享上下文"""
        try:
            from .layer4_mcp_bridge import get_mcp_bridge
            bridge = get_mcp_bridge()
            return bridge.get_all(prefix="ctx/")
        except:
            return {}
    
    def _get_conversation_history(self, session_id: str, limit: int = 20) -> List[Dict[str, str]]:
        """获取会话历史（优先 Supabase，fallback 本地）"""
        # 尝试从 Supabase 获取
        try:
            from db.supabase import table
            resp = (
                table("workflow_messages")
                .select("role, content")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            if resp.data:
                return [{"role": m["role"], "content": m["content"]} for m in resp.data]
        except Exception as e:
            print(f"[ContextBuilder] Supabase history failed: {e}")
        
        # Fallback 到本地
        try:
            return self.session_memory.get_context(session_id, limit=limit)
        except:
            return []


# 全局单例
_context_builder: Optional[ContextBuilder] = None

def get_context_builder() -> ContextBuilder:
    """获取全局上下文构建器"""
    global _context_builder
    if _context_builder is None:
        _context_builder = ContextBuilder()
    return _context_builder

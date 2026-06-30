"""
企智 · 第7层：每日摘要
Layer 7: Daily Summary

功能：
- 每日会话摘要生成与存储
- 用户每日活动回顾
- 记忆压缩（将多日对话压缩为摘要）
"""

import os
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from db.supabase import table


@dataclass
class DailySummary:
    """每日摘要"""
    id: str
    user_id: str
    date: str  # YYYY-MM-DD 格式
    summary: str  # LLM 生成的摘要
    session_count: int
    message_count: int
    topics: List[str]  # 主题关键词
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class DailySummaryStore:
    """
    第7层：每日摘要存储
    
    数据结构：
    - daily_summaries 表 (Supabase)
    - date: 日期 (YYYY-MM-DD)
    - summary: LLM 生成的摘要文本
    - topics: 主题标签
    - session_count: 当日会话数
    - message_count: 当日消息数
    """
    
    def __init__(self, base_path: str = "~/.qizhi/memory/daily"):
        self.base_path = os.path.expanduser(base_path)
        self._ensure_dir()
    
    def _ensure_dir(self):
        """确保目录存在"""
        Path(self.base_path).mkdir(parents=True, exist_ok=True)
    
    def _summary_path(self, user_id: str, date: str) -> str:
        return os.path.join(self.base_path, f"{user_id}_{date}.json")
    
    # ===== CRUD =====
    
    def save_summary(self, user_id: str, date: str, summary: str,
                     topics: List[str], session_count: int, 
                     message_count: int, metadata: Dict = None) -> DailySummary:
        """保存每日摘要"""
        now = datetime.now(timezone.utc).isoformat()
        
        # 尝试 Supabase 存储
        try:
            data = {
                "user_id": user_id,
                "date": date,
                "summary": summary,
                "topics": topics,
                "session_count": session_count,
                "message_count": message_count,
                "created_at": now,
                "metadata": metadata or {}
            }
            resp = table("daily_summaries").upsert(data, on_conflict="user_id,date").execute()
            if resp.data:
                return DailySummary(
                    id=resp.data[0]["id"],
                    user_id=user_id,
                    date=date,
                    summary=summary,
                    topics=topics,
                    session_count=session_count,
                    message_count=message_count,
                    created_at=now,
                    metadata=metadata or {}
                )
        except Exception as e:
            print(f"[DailySummary] Supabase save failed: {e}")
        
        # 降级到本地文件
        summary_obj = DailySummary(
            id=f"{user_id}_{date}",
            user_id=user_id,
            date=date,
            summary=summary,
            topics=topics,
            session_count=session_count,
            message_count=message_count,
            created_at=now,
            metadata=metadata or {}
        )
        
        with open(self._summary_path(user_id, date), 'w', encoding='utf-8') as f:
            json.dump({
                "id": summary_obj.id,
                "user_id": summary_obj.user_id,
                "date": summary_obj.date,
                "summary": summary_obj.summary,
                "topics": summary_obj.topics,
                "session_count": summary_obj.session_count,
                "message_count": summary_obj.message_count,
                "created_at": summary_obj.created_at,
                "metadata": summary_obj.metadata
            }, f, ensure_ascii=False, indent=2)
        
        return summary_obj
    
    def get_summary(self, user_id: str, date: str) -> Optional[DailySummary]:
        """获取指定日期的摘要"""
        # 先查 Supabase
        try:
            resp = (
                table("daily_summaries")
                .select("*")
                .eq("user_id", user_id)
                .eq("date", date)
                .execute()
            )
            if resp.data:
                d = resp.data[0]
                return DailySummary(
                    id=d["id"],
                    user_id=d["user_id"],
                    date=d["date"],
                    summary=d["summary"],
                    topics=d.get("topics", []),
                    session_count=d.get("session_count", 0),
                    message_count=d.get("message_count", 0),
                    created_at=d["created_at"],
                    metadata=d.get("metadata", {})
                )
        except Exception as e:
            print(f"[DailySummary] Supabase get failed: {e}")
        
        # 降级到本地文件
        path = self._summary_path(user_id, date)
        if not os.path.exists(path):
            return None
        
        with open(path, 'r', encoding='utf-8') as f:
            d = json.load(f)
            return DailySummary(**d)
    
    def list_summaries(self, user_id: str, limit: int = 30) -> List[DailySummary]:
        """列出用户的最近 N 天摘要"""
        # 先查 Supabase
        try:
            resp = (
                table("daily_summaries")
                .select("*")
                .eq("user_id", user_id)
                .order("date", desc=True)
                .limit(limit)
                .execute()
            )
            if resp.data:
                return [
                    DailySummary(
                        id=d["id"],
                        user_id=d["user_id"],
                        date=d["date"],
                        summary=d["summary"],
                        topics=d.get("topics", []),
                        session_count=d.get("session_count", 0),
                        message_count=d.get("message_count", 0),
                        created_at=d["created_at"],
                        metadata=d.get("metadata", {})
                    )
                    for d in resp.data
                ]
        except Exception as e:
            print(f"[DailySummary] Supabase list failed: {e}")
        
        # 降级到本地文件
        summaries = []
        for filename in os.listdir(self.base_path):
            if filename.startswith(f"{user_id}_") and filename.endswith(".json"):
                date_str = filename[len(user_id)+1:-5]
                path = os.path.join(self.base_path, filename)
                with open(path, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                    summaries.append(DailySummary(**d))
        
        summaries.sort(key=lambda s: s.date, reverse=True)
        return summaries[:limit]
    
    def delete_summary(self, user_id: str, date: str) -> bool:
        """删除指定日期的摘要"""
        # 先删 Supabase
        try:
            table("daily_summaries").delete().eq("user_id", user_id).eq("date", date).execute()
        except:
            pass
        
        # 再删本地
        try:
            os.remove(self._summary_path(user_id, date))
            return True
        except:
            return False
    
    def generate_summary_text(self, session_count: int, message_count: int,
                             recent_topics: List[str], 
                             recent_conversation: str = "") -> str:
        """
        生成摘要文本（调用 LLM 时使用）
        这里返回提示模板，实际 LLM 调用在 service 层
        """
        return f"""请为用户生成今日摘要，包含：
- 今日会话数：{session_count}
- 今日消息数：{message_count}
- 涉及主题：{', '.join(recent_topics) if recent_topics else '无'}
- 最近对话摘要：
{recent_conversation[:500] if recent_conversation else '无'}
"""


# 全局单例
_daily_summary_store: Optional[DailySummaryStore] = None

def get_daily_summary_store() -> DailySummaryStore:
    """获取全局每日摘要存储实例"""
    global _daily_summary_store
    if _daily_summary_store is None:
        _daily_summary_store = DailySummaryStore()
    return _daily_summary_store

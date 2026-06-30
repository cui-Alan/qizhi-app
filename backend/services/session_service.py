"""
企智 · T24 Session 服务
基于 Supabase workflow_sessions + workflow_messages 表

功能：
- create_session(user_id, title)        → 创建会话
- get_session(session_id)               → 获取会话
- delete_session(session_id)            → 删除会话
- add_message(session_id, role, content) → 添加消息
- build_context(session_id)             → 构建 LLM 消息列表
"""

import sys
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.supabase import table
from memory.layers.layer6_context import get_context_builder


# ===== Session CRUD =====

def create_session(user_id: str, title: str = "新会话") -> Dict[str, Any]:
    """创建新会话"""
    now = datetime.now(timezone.utc).isoformat()
    
    data = {
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
        "metadata": {}
    }
    
    resp = table("workflow_sessions").insert(data).execute()
    
    if resp.data:
        return resp.data[0]
    raise Exception("创建会话失败")


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """获取会话"""
    resp = table("workflow_sessions").select("*").eq("id", session_id).execute()
    
    if resp.data:
        return resp.data[0]
    return None


def list_sessions(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """列出用户所有会话"""
    resp = (
        table("workflow_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def update_session(session_id: str, **kwargs) -> bool:
    """更新会话"""
    kwargs["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    resp = (
        table("workflow_sessions")
        .update(kwargs)
        .eq("id", session_id)
        .execute()
    )
    return len(resp.data) > 0 if resp.data else False


def delete_session(session_id: str) -> bool:
    """删除会话（同时删除所有消息）"""
    # 先删消息
    table("workflow_messages").delete().eq("session_id", session_id).execute()
    # 再删会话
    resp = table("workflow_sessions").delete().eq("id", session_id).execute()
    return len(resp.data) > 0 if resp.data else True


# ===== Message CRUD =====

def add_message(session_id: str, role: str, content: str, metadata: Dict = None) -> Dict[str, Any]:
    """添加消息到会话"""
    now = datetime.now(timezone.utc).isoformat()
    
    data = {
        "session_id": session_id,
        "role": role,  # user | assistant | system | tool
        "content": content,
        "created_at": now,
        "metadata": metadata or {}
    }
    
    resp = table("workflow_messages").insert(data).execute()
    
    if not resp.data:
        raise Exception("添加消息失败")
    
    # 更新会话计数
    _update_message_count(session_id)
    
    return resp.data[0]


def get_messages(session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """获取会话所有消息"""
    resp = (
        table("workflow_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def _update_message_count(session_id: str):
    """更新会话消息计数"""
    resp = (
        table("workflow_messages")
        .select("id", count="exact")
        .eq("session_id", session_id)
        .execute()
    )
    count = resp.count if hasattr(resp, 'count') else len(resp.data or [])
    update_session(session_id, message_count=count)


# ===== Context Building =====

def build_context(session_id: str, user_message: str = "") -> Dict[str, Any]:
    """
    构建 LLM 完整上下文（使用 ContextBuilder）
    
    Returns:
        {
            "system_prompt": str,
            "relevant_memories": List[Dict],
            "loaded_skills": List[Dict],
            "conversation_history": List[Dict]  # [{"role": "user", "content": "..."}]
        }
    """
    builder = get_context_builder()
    return builder.build_context(session_id, user_message)


def build_llm_messages(session_id: str, user_message: str = "") -> List[Dict[str, str]]:
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
    builder = get_context_builder()
    return builder.build_llm_messages(session_id, user_message)


# ===== 简单兼容接口（适配 layer2_session.py 的接口）=====

class SupabaseSessionStorage:
    """
    Supabase 后端的 Session 存储适配器
    提供与 layer2_session.py SessionMemory 类似接口
    """
    
    def create_session(self, title: str = "新会话", metadata: Dict = None, user_id: str = None) -> Any:
        """创建会话（兼容 layer2_session.py 接口）"""
        if not user_id:
            raise ValueError("user_id required")
        return create_session(user_id, title)
    
    def get_session(self, session_id: str) -> Optional[Any]:
        """获取会话"""
        return get_session(session_id)
    
    def add_message(self, session_id: str, role: str, content: str, metadata: Dict = None) -> Any:
        """添加消息"""
        return add_message(session_id, role, content, metadata)
    
    def get_messages(self, session_id: str) -> List[Any]:
        """获取消息"""
        return get_messages(session_id)
    
    def get_context(self, session_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """获取最近 N 条消息"""
        messages = get_messages(session_id, limit=limit)
        return [{"role": m["role"], "content": m["content"]} for m in messages]
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        return delete_session(session_id)
    
    def list_sessions(self, user_id: str = None, limit: int = 50) -> List[Any]:
        """列出会话"""
        if not user_id:
            return []
        return list_sessions(user_id, limit)


# 全局适配器实例
_supabase_session_storage: Optional[SupabaseSessionStorage] = None

def get_supabase_session_storage() -> SupabaseSessionStorage:
    """获取全局 Supabase Session 存储实例"""
    global _supabase_session_storage
    if _supabase_session_storage is None:
        _supabase_session_storage = SupabaseSessionStorage()
    return _supabase_session_storage

"""
企智 · T24 Session 服务
封装 SessionMemory 层，提供更高级的会话管理接口

Supabase 表：
- workflow_sessions: 会话主表
- workflow_messages: 消息表

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

from memory.layers.layer2_session import SessionMemory, Session, Message, get_session_memory


# ===== Supabase 辅助 =====

def _get_supabase_table(table_name):
    """获取 Supabase 表（延迟导入避免循环依赖）"""
    try:
        from db.supabase import table
        return table(table_name)
    except Exception as e:
        print(f"[SessionService] Supabase not available: {e}")
        return None


# ===== Supabase Session CRUD =====

def create_session(user_id: str, title: str = "新会话") -> Dict[str, Any]:
    """创建新会话（Supabase）"""
    now = datetime.now(timezone.utc).isoformat()
    
    supabase = _get_supabase_table("workflow_sessions")
    if supabase:
        data = {
            "user_id": user_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "message_count": 0,
            "metadata": {}
        }
        try:
            resp = supabase.insert(data).execute()
            if resp.data:
                return resp.data[0]
        except Exception as e:
            print(f"[SessionService] Supabase insert failed, using local: {e}")
    
    # Fallback: 使用本地存储
    memory = get_session_memory()
    session = memory.create_session(title=title, metadata={"user_id": user_id})
    return {
        "id": session.id,
        "user_id": user_id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "message_count": session.message_count,
        "metadata": session.metadata
    }


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """获取会话"""
    supabase = _get_supabase_table("workflow_sessions")
    if supabase:
        try:
            resp = supabase.select("*").eq("id", session_id).execute()
            if resp.data:
                return resp.data[0]
        except Exception as e:
            print(f"[SessionService] Supabase get_session failed, using local: {e}")
    
    # Fallback: 本地存储
    memory = get_session_memory()
    session = memory.get_session(session_id)
    if session:
        return {
            "id": session.id,
            "user_id": session.metadata.get("user_id", ""),
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "message_count": session.message_count,
            "metadata": session.metadata
        }
    return None


def list_sessions(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """列出用户所有会话"""
    supabase = _get_supabase_table("workflow_sessions")
    if supabase:
        try:
            resp = (
                supabase
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(limit)
                .execute()
            )
            if resp.data is not None:
                return resp.data
        except Exception as e:
            print(f"[SessionService] Supabase list failed, using local: {e}")
    
    # Fallback: 本地存储
    memory = get_session_memory()
    sessions = memory.list_sessions(limit=limit)
    return [
        {
            "id": s.id,
            "user_id": s.metadata.get("user_id", ""),
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "message_count": s.message_count,
            "metadata": s.metadata
        }
        for s in sessions if s.metadata.get("user_id") == user_id
    ]


def update_session(session_id: str, **kwargs) -> bool:
    """更新会话"""
    kwargs["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    supabase = _get_supabase_table("workflow_sessions")
    if supabase:
        try:
            resp = supabase.update(kwargs).eq("id", session_id).execute()
            if resp.data:
                return True
        except Exception as e:
            print(f"[SessionService] Supabase update failed, using local: {e}")
    
    # Fallback: 本地
    memory = get_session_memory()
    return memory.update_session(session_id, **kwargs)


def delete_session(session_id: str) -> bool:
    """删除会话（同时删除所有消息）"""
    # 先删 Supabase 消息
    supabase_msgs = _get_supabase_table("workflow_messages")
    if supabase_msgs:
        try:
            supabase_msgs.delete().eq("session_id", session_id).execute()
        except Exception as e:
            print(f"[SessionService] Supabase delete messages failed: {e}")
    
    # 再删 Supabase 会话
    supabase_sess = _get_supabase_table("workflow_sessions")
    if supabase_sess:
        try:
            resp = supabase_sess.delete().eq("id", session_id).execute()
        except Exception as e:
            print(f"[SessionService] Supabase delete session failed: {e}")
    
    # 本地 fallback
    memory = get_session_memory()
    return memory.delete_session(session_id)


# ===== Message CRUD =====

def add_message(session_id: str, role: str, content: str, metadata: Dict = None) -> Dict[str, Any]:
    """添加消息到会话"""
    now = datetime.now(timezone.utc).isoformat()
    
    supabase = _get_supabase_table("workflow_messages")
    if supabase:
        data = {
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": now,
            "metadata": metadata or {}
        }
        try:
            resp = supabase.insert(data).execute()
            if resp.data:
                # 更新会话计数
                _update_message_count(session_id)
                return resp.data[0]
        except Exception as e:
            print(f"[SessionService] Supabase add_message failed, using local: {e}")
    
    # Fallback: 本地存储
    memory = get_session_memory()
    message = memory.add_message(session_id, role, content, metadata)
    return {
        "id": message.id,
        "session_id": session_id,
        "role": message.role,
        "content": message.content,
        "created_at": message.timestamp,
        "metadata": message.metadata
    }


def get_messages(session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """获取会话所有消息"""
    supabase = _get_supabase_table("workflow_messages")
    if supabase:
        try:
            resp = (
                supabase
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            if resp.data is not None:
                return resp.data
        except Exception as e:
            print(f"[SessionService] Supabase get_messages failed, using local: {e}")
    
    # Fallback: 本地
    memory = get_session_memory()
    messages = memory.get_messages(session_id)
    return [
        {
            "id": m.id,
            "session_id": session_id,
            "role": m.role,
            "content": m.content,
            "created_at": m.timestamp,
            "metadata": m.metadata
        }
        for m in messages
    ]


def _update_message_count(session_id: str):
    """更新会话消息计数"""
    supabase = _get_supabase_table("workflow_messages")
    if supabase:
        try:
            resp = supabase.select("id", count="exact").eq("session_id", session_id).execute()
            count = resp.count if hasattr(resp, 'count') else len(resp.data or [])
            update_session(session_id, message_count=count)
        except:
            pass


# ===== Context Building =====

def build_context(session_id: str, user_message: str = "") -> Dict[str, Any]:
    """
    构建 LLM 完整上下文
    
    Returns:
        {
            "system_prompt": str,
            "relevant_memories": List[Dict],
            "loaded_skills": List[Dict],
            "conversation_history": List[Dict]
        }
    """
    try:
        from memory.layers.layer6_context import get_context_builder
        builder = get_context_builder()
        return builder.build_context(session_id, user_message)
    except Exception as e:
        print(f"[SessionService] build_context failed: {e}")
        # Fallback
        return {
            "system_prompt": "You are a helpful AI assistant.",
            "relevant_memories": [],
            "loaded_skills": [],
            "conversation_history": get_context_fallback(session_id)
        }


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
    try:
        from memory.layers.layer6_context import get_context_builder
        builder = get_context_builder()
        return builder.build_llm_messages(session_id, user_message)
    except Exception as e:
        print(f"[SessionService] build_llm_messages failed: {e}")
        # Fallback
        messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
        messages.extend(get_context_fallback(session_id))
        if user_message:
            messages.append({"role": "user", "content": user_message})
        return messages


def get_context_fallback(session_id: str, limit: int = 20) -> List[Dict[str, str]]:
    """获取会话上下文的 Fallback 实现"""
    messages = get_messages(session_id, limit=limit)
    return [{"role": m["role"], "content": m["content"]} for m in messages]


# ===== 兼容类接口（适配原有 SessionMemory 接口）=====

class SessionService:
    """会话服务（兼容类接口）"""

    def __init__(self):
        self.memory: SessionMemory = get_session_memory()

    def create_session(self, title: str = "新会话", channel: str = None, user_id: str = None, metadata: Dict = None) -> Session:
        """创建新会话"""
        meta = metadata or {}
        if channel:
            meta["channel"] = channel
        if user_id:
            meta["user_id"] = user_id
        return self.memory.create_session(title=title, metadata=meta)

    def get_or_create_session(self, channel: str, user_id: str, title: str = "新会话") -> Session:
        """根据渠道和用户ID获取或创建会话"""
        sessions = self.memory.list_sessions(limit=100)
        for session in sessions:
            if session.metadata.get("channel") == channel and session.metadata.get("user_id") == user_id:
                return session
        return self.create_session(title=title, channel=channel, user_id=user_id)

    def add_message(self, session_id: str, role: str, content: str, metadata: Dict = None) -> Message:
        """添加消息到会话"""
        return self.memory.add_message(session_id=session_id, role=role, content=content, metadata=metadata)

    def get_context(self, session_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """获取会话上下文"""
        return self.memory.get_context(session_id=session_id, limit=limit)

    def get_messages(self, session_id: str) -> List[Message]:
        """获取会话所有消息"""
        return self.memory.get_messages(session_id=session_id)


# 全局单例
_session_service: Optional[SessionService] = None

def get_session_service() -> SessionService:
    """获取全局会话服务实例"""
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service

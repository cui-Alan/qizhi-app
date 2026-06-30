"""
企智 · 第2层：会话记忆
Layer 2: Session Memory (Messages)

存储内容：
- SESSIONS/: 会话列表
- MESSAGES/: 每条消息的详细内容
- 会话上下文管理
"""

import json
import os
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field


@dataclass
class Message:
    """消息"""
    id: str
    role: str  # user | assistant | system | tool
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Session:
    """会话"""
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class SessionMemory:
    """
    第2层：会话记忆存储（本地文件备份）
    
    数据结构：
    - sessions/: 会话元数据 (JSON)
    - sessions/{id}/messages.json: 消息历史
    
    注意：主存储已迁移到 Supabase (workflow_sessions + workflow_messages)
    本地存储作为离线缓存和 fallback
    """
    
    def __init__(self, base_path: str = "~/.qizhi/memory/sessions"):
        self.base_path = os.path.expanduser(base_path)
        self._ensure_dir()
    
    def _ensure_dir(self):
        """确保目录存在"""
        Path(self.base_path).mkdir(parents=True, exist_ok=True)
    
    def _session_path(self, session_id: str) -> str:
        return os.path.join(self.base_path, f"{session_id}.json")
    
    def _messages_path(self, session_id: str) -> str:
        return os.path.join(self.base_path, f"{session_id}_messages.json")
    
    # ========== Session CRUD ==========
    
    def create_session(self, title: str = "新会话", metadata: Dict = None, user_id: str = None) -> Session:
        """创建新会话（本地备份）"""
        now = datetime.now().isoformat()
        session = Session(
            id=str(uuid.uuid4()),
            title=title,
            created_at=now,
            updated_at=now,
            message_count=0,
            metadata=metadata or {}
        )
        
        with open(self._session_path(session.id), 'w', encoding='utf-8') as f:
            json.dump({
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "message_count": 0,
                "metadata": session.metadata
            }, f, ensure_ascii=False, indent=2)
        
        # 初始化空消息文件
        with open(self._messages_path(session.id), 'w', encoding='utf-8') as f:
            json.dump([], f)
        
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        path = self._session_path(session_id)
        if not os.path.exists(path):
            return None
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return Session(**data)
    
    def list_sessions(self, user_id: str = None, limit: int = 50) -> List[Session]:
        """列出所有会话（不区分 user_id，本地不分用户）"""
        sessions = []
        for filename in os.listdir(self.base_path):
            if filename.endswith('.json') and not filename.endswith('_messages.json'):
                with open(os.path.join(self.base_path, filename), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    sessions.append(Session(**data))
        
        # 按更新时间排序
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions[:limit]
    
    def update_session(self, session_id: str, **kwargs) -> bool:
        """更新会话"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        for key, value in kwargs.items():
            if hasattr(session, key):
                setattr(session, key, value)
        
        session.updated_at = datetime.now().isoformat()
        
        with open(self._session_path(session_id), 'w', encoding='utf-8') as f:
            json.dump({
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "message_count": session.message_count,
                "metadata": session.metadata
            }, f, ensure_ascii=False, indent=2)
        
        return True
    
    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        try:
            if os.path.exists(self._session_path(session_id)):
                os.remove(self._session_path(session_id))
            if os.path.exists(self._messages_path(session_id)):
                os.remove(self._messages_path(session_id))
            return True
        except:
            return False
    
    # ========== Message CRUD ==========
    
    def add_message(self, session_id: str, role: str, content: str, 
                    metadata: Dict = None) -> Message:
        """添加消息"""
        message = Message(
            id=str(uuid.uuid4()),
            role=role,
            content=content,
            metadata=metadata or {}
        )
        
        # 读取现有消息
        messages = self.get_messages(session_id)
        messages.append(message)
        
        # 保存消息
        with open(self._messages_path(session_id), 'w', encoding='utf-8') as f:
            json.dump([{
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp,
                "metadata": m.metadata
            } for m in messages], f, ensure_ascii=False, indent=2)
        
        # 更新会话计数
        self.update_session(session_id, message_count=len(messages))
        
        return message
    
    def get_messages(self, session_id: str) -> List[Message]:
        """获取会话所有消息"""
        path = self._messages_path(session_id)
        if not os.path.exists(path):
            return []
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return [Message(**m) for m in data]
    
    def get_context(self, session_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        获取最近 N 条消息（用于注入 LLM 上下文）
        返回格式: [{"role": "user", "content": "..."}]
        """
        messages = self.get_messages(session_id)
        recent = messages[-limit:] if len(messages) > limit else messages
        return [{"role": m.role, "content": m.content} for m in recent]
    
    def clear_messages(self, session_id: str) -> bool:
        """清空会话消息（但保留会话）"""
        with open(self._messages_path(session_id), 'w', encoding='utf-8') as f:
            json.dump([], f)
        self.update_session(session_id, message_count=0)
        return True


# 全局单例
_session_memory: Optional[SessionMemory] = None

def get_session_memory() -> SessionMemory:
    """获取全局会话记忆实例"""
    global _session_memory
    if _session_memory is None:
        _session_memory = SessionMemory()
    return _session_memory

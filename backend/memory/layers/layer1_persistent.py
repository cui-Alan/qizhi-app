"""
企智 · 第1层：持久记忆
Layer 1: Persistent Memory (SQLite + FTS5)

存储内容：
- SOUL.MD: Agent核心人格、价值观、行为规范
- CONFIG.YAML: 系统配置（模型、通道、插件）
- STATE.DB: 键值对状态（memory tool数据）
- REFERENCES/: 外部参考资料索引
"""

import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Any, Dict, List
from dataclasses import dataclass, field


@dataclass
class MemoryEntry:
    """记忆条目"""
    key: str
    value: str
    category: str  # soul | config | state | reference
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class PersistentMemory:
    """
    第1层：持久记忆存储
    
    数据结构：
    - memory_entries: 主记忆表（FTS5全文搜索）
    - soul_md: Agent人格配置
    - config_yaml: 系统配置
    - state_db: 键值对状态
    """
    
    def __init__(self, db_path: str = "~/.qizhi/memory/state.db"):
        self.db_path = os.path.expanduser(db_path)
        self._ensure_dir()
        self.conn = self._init_db()
    
    def _ensure_dir(self):
        """确保目录存在"""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
    
    def _init_db(self) -> sqlite3.Connection:
        """初始化数据库"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        
        # 主记忆表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memory_entries (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}'
            )
        """)
        
        # FTS5 全文搜索表
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
                key, value, tags,
                content='memory_entries',
                content_rowid='rowid'
            )
        """)
        
        # SOUL.MD 专用表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soul_md (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # CONFIG.YAML 专用表
        conn.execute("""
            CREATE TABLE IF NOT EXISTS config_yaml (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        conn.commit()
        return conn
    
    # ========== 基础 CRUD ==========
    
    def set(self, key: str, value: str, category: str = "state", 
            tags: List[str] = None, metadata: Dict = None) -> bool:
        """设置记忆"""
        now = datetime.now().isoformat()
        tags_json = json.dumps(tags or [])
        metadata_json = json.dumps(metadata or {})
        
        try:
            self.conn.execute("""
                INSERT OR REPLACE INTO memory_entries 
                (key, value, category, created_at, updated_at, tags, metadata)
                VALUES (?, ?, ?, 
                    COALESCE((SELECT created_at FROM memory_entries WHERE key = ?), ?),
                    ?, ?, ?)
            """, (key, value, category, key, now, now, tags_json, metadata_json))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"[Layer1] Set error: {e}")
            return False
    
    def get(self, key: str) -> Optional[str]:
        """获取记忆"""
        cursor = self.conn.execute(
            "SELECT value FROM memory_entries WHERE key = ?", (key,)
        )
        row = cursor.fetchone()
        return row[0] if row else None
    
    def delete(self, key: str) -> bool:
        """删除记忆"""
        self.conn.execute("DELETE FROM memory_entries WHERE key = ?", (key,))
        self.conn.commit()
        return True
    
    def search(self, query: str, limit: int = 10) -> List[MemoryEntry]:
        """FTS5 全文搜索"""
        cursor = self.conn.execute("""
            SELECT m.key, m.value, m.category, m.created_at, m.updated_at, m.tags, m.metadata
            FROM memory_entries m
            JOIN memory_fts f ON m.rowid = f.rowid
            WHERE memory_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit))
        
        results = []
        for row in cursor.fetchall():
            results.append(MemoryEntry(
                key=row[0], value=row[1], category=row[2],
                created_at=row[3], updated_at=row[4],
                tags=json.loads(row[5]), metadata=json.loads(row[6])
            ))
        return results
    
    # ========== SOUL.MD ==========
    
    def get_soul(self) -> Optional[str]:
        """获取 SOUL.MD"""
        cursor = self.conn.execute("SELECT content FROM soul_md WHERE id = 1")
        row = cursor.fetchone()
        return row[0] if row else None
    
    def set_soul(self, content: str) -> bool:
        """设置 SOUL.MD"""
        now = datetime.now().isoformat()
        self.conn.execute("""
            INSERT OR REPLACE INTO soul_md (id, content, updated_at)
            VALUES (1, ?, ?)
        """, (content, now))
        self.conn.commit()
        return True
    
    # ========== CONFIG.YAML ==========
    
    def get_config(self) -> Optional[str]:
        """获取 CONFIG.YAML"""
        cursor = self.conn.execute("SELECT content FROM config_yaml WHERE id = 1")
        row = cursor.fetchone()
        return row[0] if row else None
    
    def set_config(self, content: str) -> bool:
        """设置 CONFIG.YAML"""
        now = datetime.now().isoformat()
        self.conn.execute("""
            INSERT OR REPLACE INTO config_yaml (id, content, updated_at)
            VALUES (1, ?, ?)
        """, (content, now))
        self.conn.commit()
        return True
    
    # ========== 批量操作 ==========
    
    def get_by_category(self, category: str, limit: int = 100) -> List[MemoryEntry]:
        """按分类获取记忆"""
        cursor = self.conn.execute("""
            SELECT key, value, category, created_at, updated_at, tags, metadata
            FROM memory_entries
            WHERE category = ?
            ORDER BY updated_at DESC
            LIMIT ?
        """, (category, limit))
        
        results = []
        for row in cursor.fetchall():
            results.append(MemoryEntry(
                key=row[0], value=row[1], category=row[2],
                created_at=row[3], updated_at=row[4],
                tags=json.loads(row[5]), metadata=json.loads(row[6])
            ))
        return results
    
    def get_all_keys(self, category: str = None) -> List[str]:
        """获取所有 key"""
        if category:
            cursor = self.conn.execute(
                "SELECT key FROM memory_entries WHERE category = ?", (category,)
            )
        else:
            cursor = self.conn.execute("SELECT key FROM memory_entries")
        return [row[0] for row in cursor.fetchall()]
    
    def export_all(self) -> Dict[str, Any]:
        """导出所有数据（备份用）"""
        cursor = self.conn.execute("""
            SELECT key, value, category, created_at, updated_at, tags, metadata
            FROM memory_entries
        """)
        
        entries = {}
        for row in cursor.fetchall():
            entries[row[0]] = {
                "value": row[1], "category": row[2],
                "created_at": row[3], "updated_at": row[4],
                "tags": json.loads(row[5]), "metadata": json.loads(row[6])
            }
        
        return {
            "entries": entries,
            "soul_md": self.get_soul(),
            "config_yaml": self.get_config(),
            "exported_at": datetime.now().isoformat()
        }
    
    def close(self):
        """关闭连接"""
        self.conn.close()


# 全局单例
_memory: Optional[PersistentMemory] = None

def get_memory() -> PersistentMemory:
    """获取全局记忆实例"""
    global _memory
    if _memory is None:
        _memory = PersistentMemory()
    return _memory

"""
企智 · T17 用户服务
users 表 CRUD 操作
支持两种存储模式：
  1. Supabase（生产）：SUPABASE_SERVICE_KEY 已设置时使用
  2. SQLite（本地开发/测试）：SUPABASE_SERVICE_KEY 未设置时自动降级
"""

import hashlib
import secrets
import sqlite3
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pathlib import Path

# 添加 backend 根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lbbnxfcijckkxuxfbctl.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ===== 本地 SQLite Fallback =====

LOCAL_DB_PATH = os.path.expanduser("~/.qizhi/db/local_users.db")

def _ensure_local_db():
    os.makedirs(os.path.dirname(LOCAL_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            must_change_password INTEGER DEFAULT 1,
            temp_password TEXT,
            temp_password_expires_at TEXT,
            last_login_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            expires_at TEXT,
            last_used_at TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def _local_now():
    return datetime.now(timezone.utc).isoformat()

def _local_uuid():
    import uuid
    return str(uuid.uuid4())

# ===== 密码工具 =====

def hash_password(password: str) -> str:
    import bcrypt
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

def generate_temp_password(length: int = 16) -> str:
    return secrets.token_urlsafe(length)

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def make_api_key(prefix: str = "sk-qz") -> str:
    random_part = secrets.token_urlsafe(24)
    return f"{prefix}-{random_part}"

# ===== 存储抽象层 =====

def _use_supabase() -> bool:
    return bool(SUPABASE_SERVICE_KEY.strip())

def _get_supabase_client() -> Client:
    if not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_SERVICE_KEY 环境变量未设置")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ===== 用户 CRUD =====

def create_user(
    email: str,
    username: str,
    password: str,
    role: str = "user",
    temp_password: Optional[str] = None,
) -> dict:
    """创建用户（自动选择 Supabase 或 SQLite）"""
    password_hash = hash_password(password)
    now = _local_now()

    if _use_supabase():
        client = _get_supabase_client()
        data = {
            "email": email, "username": username,
            "password_hash": password_hash, "role": role,
            "status": "active", "must_change_password": True,
        }
        if temp_password:
            data["temp_password"] = hash_password(temp_password)
            data["temp_password_expires_at"] = (
                datetime.now(timezone.utc) + timedelta(hours=24)
            ).isoformat()
        result = client.table("users").insert(data).execute()
        return result.data[0] if result.data else {}
    else:
        # SQLite fallback
        _ensure_local_db()
        user_id = _local_uuid()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute("""
            INSERT INTO users (id, email, username, password_hash, role, status,
                must_change_password, temp_password, temp_password_expires_at,
                created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)
        """, (
            user_id, email, username, password_hash, role,
            hash_password(temp_password) if temp_password else None,
            (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat() if temp_password else None,
            now, now,
        ))
        conn.commit()
        conn.close()
        return {
            "id": user_id, "email": email, "username": username,
            "role": role, "status": "active",
            "must_change_password": True, "created_at": now,
        }

def get_user_by_email(email: str) -> Optional[dict]:
    if _use_supabase():
        client = _get_supabase_client()
        result = client.table("users").select("*").eq("email", email).execute()
        return result.data[0] if result.data else None
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        # PRAGMA returns (cid, name, type, notnull, dflt_value, pk) → d[1] = column name
        cols = [d[1] for d in conn.execute("PRAGMA table_info(users)").fetchall()]
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        conn.close()
        if not row:
            return None
        return dict(zip(cols, row))
def get_user_by_id(user_id: str) -> Optional[dict]:
    if _use_supabase():
        client = _get_supabase_client()
        result = client.table("users").select("*").eq("id", user_id).execute()
        return result.data[0] if result.data else None
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cols = [d[1] for d in conn.execute("PRAGMA table_info(users)").fetchall()]
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return dict(zip(cols, row)) if row else None

def list_users(role: Optional[str] = None, status: Optional[str] = None) -> List[dict]:
    if _use_supabase():
        client = _get_supabase_client()
        query = client.table("users").select(
            "id, email, username, role, status, must_change_password, last_login_at, created_at"
        )
        if role:
            query = query.eq("role", role)
        if status:
            query = query.eq("status", status)
        result = query.order("created_at", desc=True).execute()
        return result.data
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        sql = "SELECT id, email, username, role, status, must_change_password, last_login_at, created_at FROM users WHERE 1=1"
        params = []
        if role:
            sql += " AND role = ?"
            params.append(role)
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC"
        rows = conn.execute(sql, params).fetchall()
        conn.close()
        cols = ["id", "email", "username", "role", "status", "must_change_password", "last_login_at", "created_at"]
        return [dict(zip(cols, r)) for r in rows]

def update_user(user_id: str, updates: dict) -> dict:
    forbidden = {"id", "password_hash"}
    for key in forbidden:
        updates.pop(key, None)
    updates["updated_at"] = _local_now()

    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("users")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )
        return result.data[0] if result.data else {}
    else:
        _ensure_local_db()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute(
            f"UPDATE users SET {set_clause} WHERE id = ?",
            list(updates.values()) + [user_id]
        )
        conn.commit()
        conn.close()
        return get_user_by_id(user_id) or {}

def update_password(user_id: str, new_password: str) -> bool:
    password_hash = hash_password(new_password)
    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("users")
            .update({
                "password_hash": password_hash,
                "must_change_password": False,
                "temp_password": None,
                "temp_password_expires_at": None,
            })
            .eq("id", user_id)
            .execute()
        )
        return bool(result.data)
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute(
            "UPDATE users SET password_hash=?, must_change_password=0, temp_password=NULL, temp_password_expires_at=NULL, updated_at=? WHERE id=?",
            (password_hash, _local_now(), user_id)
        )
        conn.commit()
        rows = conn.execute("SELECT changes()").fetchone()
        conn.close()
        return bool(rows[0])

def set_user_status(user_id: str, status: str) -> bool:
    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("users")
            .update({"status": status})
            .eq("id", user_id)
            .execute()
        )
        return bool(result.data)
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute("UPDATE users SET status=?, updated_at=? WHERE id=?", (status, _local_now(), user_id))
        conn.commit()
        rows = conn.execute("SELECT changes()").fetchone()
        conn.close()
        return bool(rows[0])

def delete_user(user_id: str) -> bool:
    return bool(set_user_status(user_id, "inactive"))

def update_last_login(user_id: str) -> None:
    if _use_supabase():
        client = _get_supabase_client()
        client.table("users").update(
            {"last_login_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute(
            "UPDATE users SET last_login_at=? WHERE id=?",
            (_local_now(), user_id)
        )
        conn.commit()
        conn.close()

# ===== 订阅管理（仅 Supabase） =====

def get_user_subscription(user_id: str) -> Optional[dict]:
    if not _use_supabase():
        return None  # SQLite 模式不支持订阅
    client = _get_supabase_client()
    result = (
        client.table("subscriptions")
        .select("*, plans(*)")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    return result.data[0] if result.data else None

def create_subscription(user_id: str, plan_id: str, billing_cycle: str = "monthly") -> dict:
    if not _use_supabase():
        return {}
    client = _get_supabase_client()
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30 if billing_cycle == "monthly" else 365)
    data = {
        "user_id": user_id, "plan_id": plan_id,
        "status": "active", "billing_cycle": billing_cycle,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
    }
    result = client.table("subscriptions").insert(data).execute()
    return result.data[0] if result.data else {}

# ===== API Keys =====

def create_api_key(user_id: str, name: str, expires_at: Optional[str] = None) -> dict:
    raw_key = make_api_key()
    key_hash = hash_api_key(raw_key)
    prefix = raw_key[:8]
    now = _local_now()

    if _use_supabase():
        client = _get_supabase_client()
        data = {
            "user_id": user_id, "name": name,
            "key_hash": key_hash, "key_prefix": prefix,
            "expires_at": expires_at,
        }
        result = client.table("api_keys").insert(data).execute()
        return {"raw_key": raw_key, "key_record": result.data[0] if result.data else {}}
    else:
        _ensure_local_db()
        key_id = _local_uuid()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute("""
            INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, is_active, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """, (key_id, user_id, name, key_hash, prefix, expires_at, now))
        conn.commit()
        conn.close()
        return {"raw_key": raw_key, "key_record": {
            "id": key_id, "user_id": user_id, "name": name,
            "key_prefix": prefix, "is_active": True,
            "expires_at": expires_at, "created_at": now,
        }}

def verify_api_key(raw_key: str) -> Optional[str]:
    key_hash = hash_api_key(raw_key)
    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("api_keys")
            .select("user_id, expires_at, is_active")
            .eq("key_hash", key_hash)
            .execute()
        )
        if not result.data:
            return None
        record = result.data[0]
        if not record.get("is_active"):
            return None
        if record.get("expires_at"):
            expires = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                return None
        client.table("api_keys").update(
            {"last_used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("key_hash", key_hash).execute()
        return record["user_id"]
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        row = conn.execute(
            "SELECT user_id, expires_at, is_active FROM api_keys WHERE key_hash = ?",
            (key_hash,)
        ).fetchone()
        conn.close()
        if not row or not row[2]:  # is_active = 0
            return None
        if row[1]:  # expires_at
            expires = datetime.fromisoformat(row[1].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                return None
        return row[0]

def list_api_keys(user_id: str) -> List[dict]:
    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("api_keys")
            .select("id, name, key_prefix, last_used_at, expires_at, is_active, created_at")
            .eq("user_id", user_id)
            .execute()
        )
        return result.data
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        rows = conn.execute(
            "SELECT id, name, key_prefix, last_used_at, expires_at, is_active, created_at FROM api_keys WHERE user_id=?",
            (user_id,)
        ).fetchall()
        conn.close()
        cols = ["id", "name", "key_prefix", "last_used_at", "expires_at", "is_active", "created_at"]
        return [dict(zip(cols, r)) for r in rows]

def revoke_api_key(key_id: str) -> bool:
    if _use_supabase():
        client = _get_supabase_client()
        result = (
            client.table("api_keys")
            .update({"is_active": False})
            .eq("id", key_id)
            .execute()
        )
        return bool(result.data)
    else:
        _ensure_local_db()
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.execute("UPDATE api_keys SET is_active=0 WHERE id=?", (key_id,))
        conn.commit()
        rows = conn.execute("SELECT changes()").fetchone()
        conn.close()
        return bool(rows[0])

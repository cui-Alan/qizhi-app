"""
企智 · T17 用户服务
users 表 CRUD 操作
"""

import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import sys
import os

# 添加 backend 根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lbbnxfcijckkxuxfbctl.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


def get_service_client() -> Client:
    if not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_SERVICE_KEY 环境变量未设置")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ===== 密码工具 =====

def hash_password(password: str) -> str:
    """bcrypt hash"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码"""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def generate_temp_password(length: int = 16) -> str:
    """生成临时密码"""
    return secrets.token_urlsafe(length)


def hash_api_key(key: str) -> str:
    """SHA256 hash API key（存库）"""
    return hashlib.sha256(key.encode()).hexdigest()


def make_api_key(prefix: str = "sk-qz") -> str:
    """生成可显示的 API key"""
    random_part = secrets.token_urlsafe(24)
    return f"{prefix}-{random_part}"


# ===== 用户 CRUD =====

def create_user(
    email: str,
    username: str,
    password: str,
    role: str = "user",
    temp_password: Optional[str] = None,
) -> dict:
    """
    创建用户（Service Role）
    """
    client = get_service_client()
    password_hash = hash_password(password)

    data = {
        "email": email,
        "username": username,
        "password_hash": password_hash,
        "role": role,
        "status": "active",
        "must_change_password": True,
    }

    if temp_password:
        data["temp_password"] = hash_password(temp_password)
        data["temp_password_expires_at"] = (
            datetime.now(timezone.utc) + timedelta(hours=24)
        ).isoformat()

    result = client.table("users").insert(data).execute()
    return result.data[0] if result.data else {}


def get_user_by_email(email: str) -> Optional[dict]:
    """根据邮箱查询用户"""
    client = get_service_client()
    result = client.table("users").select("*").eq("email", email).execute()
    return result.data[0] if result.data else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """根据 ID 查询用户"""
    client = get_service_client()
    result = client.table("users").select("*").eq("id", user_id).execute()
    return result.data[0] if result.data else None


def list_users(role: Optional[str] = None, status: Optional[str] = None) -> List[dict]:
    """查询用户列表（Admin 用）"""
    client = get_service_client()
    query = client.table("users").select(
        "id, email, username, role, status, must_change_password, last_login_at, created_at"
    )
    if role:
        query = query.eq("role", role)
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).execute()
    return result.data


def update_user(user_id: str, updates: dict) -> dict:
    """更新用户信息"""
    client = get_service_client()
    # 防止更新敏感字段
    forbidden = {"id", "password_hash"}
    for key in forbidden:
        updates.pop(key, None)
    result = (
        client.table("users")
        .update(updates)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else {}


def update_password(user_id: str, new_password: str) -> bool:
    """修改密码"""
    client = get_service_client()
    password_hash = hash_password(new_password)
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


def set_user_status(user_id: str, status: str) -> bool:
    """设置用户状态（启用/停用）"""
    client = get_service_client()
    result = (
        client.table("users")
        .update({"status": status})
        .eq("id", user_id)
        .execute()
    )
    return bool(result.data)


def delete_user(user_id: str) -> bool:
    """删除用户（软删除，改为 inactive）"""
    return bool(set_user_status(user_id, "inactive"))


def update_last_login(user_id: str) -> None:
    """更新最后登录时间"""
    client = get_service_client()
    client.table("users").update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user_id).execute()


# ===== 订阅管理 =====

def get_user_subscription(user_id: str) -> Optional[dict]:
    """获取用户当前订阅"""
    client = get_service_client()
    result = (
        client.table("subscriptions")
        .select("*, plans(*)")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    return result.data[0] if result.data else None


def create_subscription(user_id: str, plan_id: str, billing_cycle: str = "monthly") -> dict:
    """创建订阅"""
    client = get_service_client()
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=30 if billing_cycle == "monthly" else 365)

    data = {
        "user_id": user_id,
        "plan_id": plan_id,
        "status": "active",
        "billing_cycle": billing_cycle,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
    }
    result = client.table("subscriptions").insert(data).execute()
    return result.data[0] if result.data else {}


# ===== API Keys =====

def create_api_key(user_id: str, name: str, expires_at: Optional[str] = None) -> dict:
    """
    创建 API Key
    返回 dict: {raw_key: "...", key_record: {...}}
    """
    client = get_service_client()
    raw_key = make_api_key()
    key_hash = hash_api_key(raw_key)
    prefix = raw_key[:8]  # sk-qz-xxxx

    data = {
        "user_id": user_id,
        "name": name,
        "key_hash": key_hash,
        "key_prefix": prefix,
        "expires_at": expires_at,
    }
    result = client.table("api_keys").insert(data).execute()
    return {"raw_key": raw_key, "key_record": result.data[0] if result.data else {}}


def verify_api_key(raw_key: str) -> Optional[str]:
    """
    验证 API Key
    返回 user_id 或 None
    """
    client = get_service_client()
    key_hash = hash_api_key(raw_key)
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
    # 更新最后使用时间
    client.table("api_keys").update(
        {"last_used_at": datetime.now(timezone.utc).isoformat()}
    ).eq("key_hash", key_hash).execute()
    return record["user_id"]


def list_api_keys(user_id: str) -> List[dict]:
    """列出用户的 API Keys（不返回 hash）"""
    client = get_service_client()
    result = (
        client.table("api_keys")
        .select("id, name, key_prefix, last_used_at, expires_at, is_active, created_at")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data


def revoke_api_key(key_id: str) -> bool:
    """撤销 API Key"""
    client = get_service_client()
    result = (
        client.table("api_keys")
        .update({"is_active": False})
        .eq("id", key_id)
        .execute()
    )
    return bool(result.data)
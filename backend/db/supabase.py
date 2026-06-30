"""
企智 · T17 Supabase 客户端
连接 Supabase PostgreSQL
"""

import os
from supabase import create_client, Client
from typing import Optional

# 环境变量
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://lbbnxfcijckkxuxfbctl.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYm54ZmNpamNra3h1eGZiY3RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTc1MDB9.fake_anon_key_replace_me")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# 全局客户端
_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """获取 Supabase 客户端（单例）"""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _supabase_client


def get_service_client() -> Client:
    """获取 Service Role 客户端（绕过 RLS，用于管理操作）"""
    if not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_SERVICE_KEY 环境变量未设置")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ===== 便捷表操作 =====

def table(table_name: str):
    """获取指定表的操作接口"""
    return get_supabase().table(table_name)


def service_table(table_name: str):
    """获取 Service Role 表操作接口"""
    return get_service_client().table(table_name)
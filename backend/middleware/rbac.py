"""
企智 · T20 RBAC 权限中间件
Super Admin / Admin / User / Viewer 四级权限
"""

from enum import Enum
from functools import wraps
from fastapi import HTTPException, Depends
from typing import List, Callable


# ===== 角色层级 =====

class Role(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"


# 权限层级（数字越大权限越高）
ROLE_LEVEL = {
    Role.VIEWER: 10,
    Role.USER: 20,
    Role.ADMIN: 30,
    Role.SUPER_ADMIN: 40,
}


def role_geq(required: Role):
    """
    装饰器：要求角色 >= required
    用法：@require_role(Role.ADMIN)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, current_user: dict = None, **kwargs):
            user_role = current_user.get("role", "")
            user_level = ROLE_LEVEL.get(Role(user_role), 0)
            required_level = ROLE_LEVEL.get(required, 0)
            if user_level < required_level:
                raise HTTPException(
                    status_code=403,
                    detail=f"需要 {required.value} 权限，当前为 {user_role}"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


# ===== 权限矩阵 =====

# 每个角色能操作哪些资源
PERMISSIONS = {
    # (resource, action): [allowed roles]
    # user management
    ("user", "read"):        [Role.SUPER_ADMIN, Role.ADMIN],
    ("user", "create"):      [Role.SUPER_ADMIN, Role.ADMIN],
    ("user", "update"):      [Role.SUPER_ADMIN, Role.ADMIN],
    ("user", "delete"):      [Role.SUPER_ADMIN],
    # workflow
    ("workflow", "read"):    [Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.VIEWER],
    ("workflow", "create"):  [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    ("workflow", "update"):  [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    ("workflow", "delete"):  [Role.SUPER_ADMIN, Role.ADMIN],
    ("workflow", "execute"): [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    # api_key
    ("api_key", "read"):     [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    ("api_key", "create"):   [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    ("api_key", "revoke"):   [Role.SUPER_ADMIN, Role.ADMIN, Role.USER],
    # plan / subscription
    ("plan", "read"):        [Role.SUPER_ADMIN, Role.ADMIN],
    ("subscription", "manage"): [Role.SUPER_ADMIN],
    # admin panel
    ("admin", "access"):     [Role.SUPER_ADMIN, Role.ADMIN],
    ("settings", "read"):    [Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.VIEWER],
    ("settings", "write"):   [Role.SUPER_ADMIN, Role.ADMIN],
}


def check_permission(role: str, resource: str, action: str) -> bool:
    """检查角色是否有某资源+动作的权限"""
    role_enum = Role(role) if role in [r.value for r in Role] else None
    if not role_enum:
        return False
    key = (resource, action)
    allowed_roles = PERMISSIONS.get(key, [])
    return role_enum in allowed_roles


class RBACMiddleware:
    """
    RBAC 中间件，可注入到 FastAPI 路由
    用法：
        @router.post("/workflows")
        async def create_workflow(
            current_user: dict = Depends(RBACMiddleware.require("workflow", "create"))
        ):
            ...
    """

    @staticmethod
    def require(resource: str, action: str):
        """返回依赖函数"""
        async def dependency(current_user: dict) -> dict:
            role = current_user.get("role", "")
            if not check_permission(role, resource, action):
                raise HTTPException(
                    status_code=403,
                    detail=f"权限不足：{role} 角色无法执行 {resource}:{action}"
                )
            return current_user
        return dependency

    @staticmethod
    def require_any(*permissions: tuple):
        """要求满足任意一条权限（OR）"""
        async def dependency(current_user: dict) -> dict:
            role = current_user.get("role", "")
            for res, act in permissions:
                if check_permission(role, res, act):
                    return current_user
            raise HTTPException(status_code=403, detail="权限不足")
        return dependency

    @staticmethod
    def require_all(*permissions: tuple):
        """要求满足所有权限（AND）"""
        async def dependency(current_user: dict) -> dict:
            role = current_user.get("role", "")
            for res, act in permissions:
                if not check_permission(role, res, act):
                    raise HTTPException(status_code=403, detail=f"权限不足：需要 {res}:{act}")
            return current_user
        return dependency
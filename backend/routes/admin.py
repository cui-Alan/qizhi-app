"""
企智 · T19 管理员开通账号
POST /api/v1/admin/users          - 开通账号
GET  /api/v1/admin/users          - 用户列表
PATCH /api/v1/admin/users/:id     - 更新用户状态
DELETE /api/v1/admin/users/:id    - 删除/停用用户
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import secrets
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.auth_service import hash_password, make_token_response
from db.user_service import (
    create_user, list_users, update_user,
    set_user_status, generate_temp_password,
)
from middleware.rbac import require_admin, require_super_admin

router = APIRouter(prefix="/v1/admin", tags=["管理员"])

# ===== 请求/响应模型 =====

class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str
    role: str = "user"  # admin / user / viewer


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str
    must_change_password: bool
    last_login_at: Optional[str] = None
    created_at: str


class TempPasswordResponse(BaseModel):
    email: str
    temp_password: str  # 临时密码（仅在此响应中返回一次）


# ===== 路由 =====

@router.post("/users", response_model=TempPasswordResponse)
async def admin_create_user(
    req: CreateUserRequest,
    current_user: dict = Depends(require_admin),
):
    """管理员开通账号（发送临时密码到邮箱）"""
    from db.user_service import get_user_by_email

    # 权限检查：只有 Super Admin 能开 Admin 账号
    if req.role in ("admin", "super_admin") and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="只有超级管理员能开设管理员账号")

    # 检查邮箱是否已存在
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已被注册")

    # 生成临时密码
    temp_password = generate_temp_password(12)

    # 创建用户
    user = create_user(
        email=req.email,
        username=req.username,
        password=temp_password,  # 用临时密码作为初始密码
        role=req.role,
        temp_password=temp_password,
    )
    if not user:
        raise HTTPException(status_code=500, detail="创建用户失败")

    # TODO: 发邮件（目前返回给管理员，由管理员转发）
    # 实际生产环境应接入邮件服务（SendGrid / 阿里云邮件）
    print(f"[邮件模拟] 发送到 {req.email}，临时密码：{temp_password}")

    return TempPasswordResponse(email=req.email, temp_password=temp_password)


@router.get("/users", response_model=List[AdminUserResponse])
async def admin_list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin),
):
    """管理员查看用户列表"""
    users = list_users(role=role, status=status)
    return [
        AdminUserResponse(
            id=u["id"],
            email=u["email"],
            username=u["username"],
            role=u["role"],
            status=u["status"],
            must_change_password=u.get("must_change_password", False),
            last_login_at=u.get("last_login_at"),
            created_at=u["created_at"],
        )
        for u in users
    ]


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    req: UpdateUserRequest,
    current_user: dict = Depends(require_admin),
):
    """管理员更新用户（角色/状态）"""
    # 不能修改 Super Admin
    target = None
    for u in list_users():
        if u["id"] == user_id:
            target = u
            break
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    if target["role"] == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="不能修改超级管理员")

    if req.role in ("admin", "super_admin") and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="只有超级管理员能设置管理员角色")

    updates = {}
    if req.role:
        updates["role"] = req.role
    if req.status:
        updates["status"] = req.status

    if updates:
        update_user(user_id, updates)

    return {"message": "更新成功"}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: dict = Depends(require_super_admin),
):
    """超级管理员删除用户（软删除 - 改为 inactive）"""
    target = None
    for u in list_users():
        if u["id"] == user_id:
            target = u
            break
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    if target["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="不能删除超级管理员")

    success = set_user_status(user_id, "inactive")
    if not success:
        raise HTTPException(status_code=500, detail="操作失败")

    return {"message": "用户已停用"}
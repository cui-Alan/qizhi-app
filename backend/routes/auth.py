"""
企智 · T18 认证路由
POST /api/v1/auth/register     - 注册
POST /api/v1/auth/login        - 登录
POST /api/v1/auth/refresh      - 刷新 Token
POST /api/v1/auth/change-password - 改密
GET  /api/v1/auth/me           - 当前用户信息
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.auth_service import (
    hash_password, verify_password,
    make_token_response, verify_access_token,
    verify_refresh_token, create_access_token,
)
from db.user_service import (
    get_user_by_email, create_user,
    update_password, update_last_login, get_user_by_id,
    generate_temp_password,
)

router = APIRouter(prefix="/v1/auth", tags=["认证"])


# ===== 请求/响应模型 =====

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str  # 最小8位


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: Optional[str] = None  # 首次登录改密时可不传
    new_password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    status: str
    must_change_password: bool
    last_login_at: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


# ===== 依赖：获取当前用户 =====

async def get_current_user(authorization: str = Header(...)) -> dict:
    """从 Header Authorization: Bearer <token> 获取当前用户"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="无效的 Authorization 头")

    token = authorization[7:]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")

    user_id = payload.get("sub")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="账号已被停用")

    return user


# ===== 路由 =====

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """用户注册"""
    # 校验密码强度
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="密码至少8位")

    # 检查邮箱是否已存在
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已被注册")

    # 创建用户
    user = create_user(
        email=req.email,
        username=req.username,
        password=req.password,
        role="user",
    )
    if not user:
        raise HTTPException(status_code=500, detail="创建用户失败")

    # 记录登录
    update_last_login(user["id"])

    return make_token_response(user["id"], user["role"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """用户登录"""
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="账号已被停用，请联系管理员")

    # 记录登录时间
    update_last_login(user["id"])

    # 首次登录强制改密
    if user.get("must_change_password"):
        # 返回特殊标记，触发前端跳转改密页
        response = make_token_response(user["id"], user["role"])
        response["must_change_password"] = True
        return response

    return make_token_response(user["id"], user["role"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest):
    """刷新 Access Token"""
    user_id = verify_refresh_token(req.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh Token 无效或已过期")

    user = get_user_by_id(user_id)
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="用户状态异常")

    return make_token_response(user["id"], user["role"])


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """修改密码（登录后或首次登录）"""
    user_id = current_user["id"]

    # 非首次登录需要验证旧密码
    if not current_user.get("must_change_password"):
        if not req.old_password:
            raise HTTPException(status_code=400, detail="请输入旧密码")
        if not verify_password(req.old_password, current_user["password_hash"]):
            raise HTTPException(status_code=401, detail="旧密码错误")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="新密码至少8位")

    success = update_password(user_id, req.new_password)
    if not success:
        raise HTTPException(status_code=500, detail="修改密码失败")

    return {"message": "密码修改成功"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        role=current_user["role"],
        status=current_user["status"],
        must_change_password=current_user.get("must_change_password", False),
        last_login_at=current_user.get("last_login_at"),
    )
"""
企智 · T24 Session 路由
POST /api/v1/sessions              - 创建会话
GET  /api/v1/sessions               - 列出用户会话
GET  /api/v1/sessions/{session_id}  - 获取会话详情
DELETE /api/v1/sessions/{session_id} - 删除会话

POST /api/v1/sessions/{session_id}/messages - 添加消息
GET  /api/v1/sessions/{session_id}/messages  - 获取消息历史
GET  /api/v1/sessions/{session_id}/context   - 构建 LLM 上下文
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.session_service import (
    create_session, get_session, delete_session, list_sessions,
    add_message, get_messages, build_context, build_llm_messages,
)
from routes.auth import get_current_user

router = APIRouter(prefix="/v1/sessions", tags=["会话"])


# ===== 请求/响应模型 =====

class CreateSessionRequest(BaseModel):
    title: str = "新会话"


class AddMessageRequest(BaseModel):
    role: str  # user | assistant | system | tool
    content: str
    metadata: Optional[Dict[str, Any]] = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    metadata: Dict[str, Any]


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: str
    metadata: Dict[str, Any]


class BuildContextResponse(BaseModel):
    system_prompt: str
    relevant_memories: List[Dict[str, Any]]
    loaded_skills: List[Dict[str, Any]]
    conversation_history: List[Dict[str, str]]


# ===== 路由 =====

@router.post("", response_model=SessionResponse)
async def api_create_session(
    req: CreateSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """创建新会话"""
    session = create_session(user_id=current_user["id"], title=req.title)
    return SessionResponse(**session)


@router.get("", response_model=List[SessionResponse])
async def api_list_sessions(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """列出当前用户所有会话"""
    sessions = list_sessions(user_id=current_user["id"], limit=limit)
    return [SessionResponse(**s) for s in sessions]


@router.get("/{session_id}", response_model=SessionResponse)
async def api_get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """获取会话详情"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    # 校验用户权限
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限访问此会话")
    return SessionResponse(**session)


@router.delete("/{session_id}")
async def api_delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """删除会话"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限删除此会话")
    
    success = delete_session(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="删除会话失败")
    return {"message": "会话已删除"}


# ===== 消息路由 =====

@router.post("/{session_id}/messages", response_model=MessageResponse)
async def api_add_message(
    session_id: str,
    req: AddMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """添加消息到会话"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限访问此会话")
    
    message = add_message(
        session_id=session_id,
        role=req.role,
        content=req.content,
        metadata=req.metadata,
    )
    return MessageResponse(**message)


@router.get("/{session_id}/messages", response_model=List[MessageResponse])
async def api_get_messages(
    session_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    """获取会话消息历史"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限访问此会话")
    
    messages = get_messages(session_id, limit=limit)
    return [MessageResponse(**m) for m in messages]


@router.get("/{session_id}/context", response_model=BuildContextResponse)
async def api_build_context(
    session_id: str,
    user_message: str = "",
    current_user: dict = Depends(get_current_user),
):
    """构建 LLM 上下文"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限访问此会话")
    
    ctx = build_context(session_id, user_message)
    return BuildContextResponse(**ctx)


@router.get("/{session_id}/llm-messages")
async def api_build_llm_messages(
    session_id: str,
    user_message: str = "",
    current_user: dict = Depends(get_current_user),
):
    """构建 LLM 消息列表（直接返回 OpenAI/GPT 格式）"""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="无权限访问此会话")
    
    messages = build_llm_messages(session_id, user_message)
    return {"messages": messages}

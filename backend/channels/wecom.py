"""
企智 · T26 企微消息通道
POST /api/v1/channels/wecom/webhook - 接收企微 webhook 事件
"""

import hmac
import hashlib
import time
import json
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.session_service import get_session_service

router = APIRouter(prefix="/v1/channels/wecom", tags=["企微消息通道"])


# ===== 配置 =====
# 企微 webhook 验证 token（从环境变量或配置获取）
WECOM_WEBHOOK_TOKEN=os.getenv("WECOM_WEBHOOK_TOKEN", "")
WECOM_WEBHOOK_SECRET=os.getenv("WECOM_WEBHOOK_SECRET", "")


# ===== 签名验证 =====

def verify_wecom_msg_signature(msg_signature: str, timestamp: str, nonce: str, encrypt_type: str, body: str) -> bool:
    """
    验证企微消息签名
    用于事件回调验证
    """
    if encrypt_type and encrypt_type != "aes":
        return True  # 未加密时跳过验证
    
    if not WECOM_WEBHOOK_SECRET:
        return True  # 未配置时跳过验证
    
    # 构造签名内容
    sort_str = f"{WECOM_WEBHOOK_TOKEN}{timestamp}{nonce}{body}"
    hmac_obj = hmac.new(
        b"",
        sort_str.encode("utf-8"),
        hashlib.sha1
    )
    computed_signature = hmac_obj.hexdigest()
    
    return hmac.compare_digest(msg_signature, computed_signature)


# ===== 请求/响应模型 =====

class WeComResponse(BaseModel):
    """企微响应"""
    errcode: int = 0
    errmsg: str = "ok"


# ===== 消息解析 =====

def parse_wecom_json_event(body: dict) -> Optional[Dict[str, Any]]:
    """
    解析企微 JSON 格式事件（新版 API）
    返回: {"msg_type": "text", "content": "...", "user_id": "...", "session_id": "..."}
    """
    msg_type = body.get("msgType", body.get("event", ""))
    user_id = body.get("fromUser", body.get("userId", ""))
    session_id = body.get("msgId", body.get("messageId", ""))
    
    if msg_type == "text":
        content = body.get("content", {}).get("text", "") if isinstance(body.get("content"), dict) else body.get("content", "")
        return {
            "msg_type": msg_type,
            "content": content,
            "user_id": user_id,
            "session_id": session_id,
            "raw": body
        }
    elif msg_type == "event":
        event_type = body.get("eventType", "")
        return {
            "msg_type": "event",
            "event": event_type,
            "user_id": user_id,
            "session_id": session_id,
            "raw": body
        }
    else:
        return {
            "msg_type": msg_type,
            "content": "",
            "user_id": user_id,
            "session_id": session_id,
            "raw": body
        }


# ===== AI 对话处理 =====

async def generate_ai_response(user_message: str, session_id: str, channel: str = "wecom") -> str:
    """
    调用 AI 生成回复（TODO: 接入实际 AI 服务）
    当前为占位实现
    """
    # TODO: 接入实际 AI 服务
    # 1. 获取会话上下文
    # 2. 调用 LLM
    # 3. 返回回复
    
    # 占位回复
    responses = [
        f"收到您的消息: {user_message}",
        f"感谢您的提问，关于「{user_message}」，正在思考中...",
        f"我已收到: {user_message}，这是自动回复。"
    ]
    
    # 简单模拟：根据消息长度选择回复
    idx = min(len(user_message) % len(responses), len(responses) - 1)
    return responses[idx]


# ===== Webhook 路由 =====

@router.post("/webhook", response_model=WeComResponse)
async def wecom_webhook(
    request: Request,
    msg_signature: Optional[str] = Header(None),
    timestamp: Optional[str] = Header(None),
    nonce: Optional[str] = Header(None),
    encrypt_type: Optional[str] = Header(None, alias="encrypt_type"),
):
    """
    企微 webhook 回调
    验证签名、解析消息、创建会话、生成回复
    """
    # 读取请求体
    body = await request.body()
    body_str = body.decode("utf-8")
    
    # 验证签名
    if msg_signature and timestamp and nonce:
        if not verify_wecom_msg_signature(msg_signature, timestamp, nonce, encrypt_type or "", body_str):
            raise HTTPException(status_code=401, detail="签名验证失败")
    
    # 解析为 JSON
    try:
        body_json = json.loads(body_str)
        parsed = parse_wecom_json_event(body_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无法解析消息格式")
    
    if not parsed:
        raise HTTPException(status_code=400, detail="无法解析消息格式")
    
    # 处理事件消息
    if parsed["msg_type"] == "event":
        # 企微事件（如点击菜单、关注等），直接返回成功
        return WeComResponse(errcode=0, errmsg="ok")
    
    # 提取文本内容
    text = parsed.get("content", "")
    if not text:
        return WeComResponse(errcode=0, errmsg="暂不支持的消息类型")
    
    # 获取或创建会话
    session_service = get_session_service()
    user_id = parsed["user_id"]
    
    session = session_service.get_or_create_session(
        channel="wecom",
        user_id=user_id,
        title=f"企微会话_{user_id[:8]}"
    )
    
    # 添加用户消息
    session_service.add_message(
        session_id=session.id,
        role="user",
        content=text,
        metadata={
            "channel": "wecom",
            "message_id": parsed["session_id"],
            "user_id": user_id
        }
    )
    
    # 生成 AI 回复
    ai_response = await generate_ai_response(text, session.id, channel="wecom")
    
    # 添加 AI 回复
    session_service.add_message(
        session_id=session.id,
        role="assistant",
        content=ai_response,
        metadata={"channel": "wecom"}
    )
    
    return WeComResponse(errcode=0, errmsg="ok")


@router.get("/test")
async def wecom_test():
    """测试端点"""
    return {"status": "ok", "channel": "wecom"}

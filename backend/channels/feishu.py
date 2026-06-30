"""
企智 · T25 飞书消息通道
POST /api/v1/channels/feishu/webhook - 接收飞书 webhook 事件
"""

import hmac
import hashlib
import time
import json
import base64
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.session_service import get_session_service

router = APIRouter(prefix="/v1/channels/feishu", tags=["飞书消息通道"])


# ===== 配置 =====
# 飞书 webhook 验证 token（从环境变量或配置获取）
FEISHU_VERIFICATION_TOKEN = os.getenv("FEISHU_VERIFICATION_TOKEN", "")
FEISHU_WEBHOOK_SECRET = os.getenv("FEISHU_WEBHOOK_SECRET", "")


# ===== 签名验证 =====

def verify_lark_signature(signature: str, timestamp: str, body: str) -> bool:
    """
    验证飞书 X-Lark-Signature header
    飞书签名算法: HMAC-SHA256 + Base64
    """
    if not FEISHU_WEBHOOK_SECRET:
        # 未配置 secret 时跳过验证（开发环境）
        return True
    
    # 构造签名内容
    string_to_sign = f"{timestamp}{body}"
    
    # 计算签名
    hmac_obj = hmac.new(
        FEISHU_WEBHOOK_SECRET.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha256
    )
    computed_signature = base64.b64encode(hmac_obj.digest()).decode("utf-8")
    
    return hmac.compare_digest(signature, computed_signature)


# ===== 请求/响应模型 =====

class FeishuResponse(BaseModel):
    """飞书响应"""
    code: int = 0
    msg: str = "success"


# ===== 消息解析 =====

def parse_feishu_event(body: dict) -> Optional[Dict[str, Any]]:
    """
    解析飞书事件
    返回: {"message_type": "text", "content": "...", "user_id": "...", "session_id": "..."}
    """
    header = body.get("header", {})
    event_type = header.get("event_type", "")
    
    # 验证事件类型
    if event_type != "im.message.receive_v1":
        return None
    
    event = body.get("event", {})
    message = event.get("message", {})
    
    # 获取消息内容
    message_type = message.get("message_type", "")
    content_str = message.get("content", "{}")
    
    try:
        content = json.loads(content_str)
    except:
        content = {"text": content_str}
    
    # 获取用户和会话标识
    sender = event.get("sender", {})
    user_id = sender.get("sender_id", {}).get("open_id", "")
    session_id = message.get("message_id", "")
    
    return {
        "message_type": message_type,
        "content": content,
        "user_id": user_id,
        "session_id": session_id,
        "raw": body
    }


def extract_text_content(parsed: Dict[str, Any]) -> str:
    """从解析后的事件中提取文本内容"""
    if parsed["message_type"] == "text":
        return parsed["content"].get("text", "")
    elif parsed["message_type"] == "post":
        # 富文本消息，取所有文本片段
        content = parsed["content"]
        texts = []
        def extract_text(obj):
            if isinstance(obj, dict):
                if "text" in obj:
                    texts.append(obj["text"])
                for v in obj.values():
                    extract_text(v)
            elif isinstance(obj, list):
                for item in obj:
                    extract_text(item)
        extract_text(content)
        return "\n".join(texts)
    return ""


# ===== AI 对话处理 =====

async def generate_ai_response(user_message: str, session_id: str, channel: str = "feishu") -> str:
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

@router.post("/webhook", response_model=FeishuResponse)
async def feishu_webhook(
    request: Request,
    x_lark_signature: Optional[str] = Header(None, alias="X-Lark-Signature"),
    timestamp: Optional[str] = Header(None),
):
    """
    飞书 webhook 回调
    验证签名、解析消息、创建会话、生成回复
    """
    # 读取请求体
    body = await request.body()
    body_str = body.decode("utf-8")
    
    # 验证签名
    if x_lark_signature:
        if not verify_lark_signature(x_lark_signature, timestamp or "", body_str):
            raise HTTPException(status_code=401, detail="签名验证失败")
    
    # 解析请求体
    try:
        body_json = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的 JSON")
    
    # 解析飞书事件
    parsed = parse_feishu_event(body_json)
    if not parsed:
        # 非处理范围内的事件，直接返回成功
        return FeishuResponse(code=0, msg="success")
    
    # 提取文本内容
    text = extract_text_content(parsed)
    if not text:
        return FeishuResponse(code=0, msg="暂不支持的消息类型")
    
    # 获取或创建会话
    session_service = get_session_service()
    user_id = parsed["user_id"]
    
    session = session_service.get_or_create_session(
        channel="feishu",
        user_id=user_id,
        title=f"飞书会话_{user_id[:8]}"
    )
    
    # 添加用户消息
    session_service.add_message(
        session_id=session.id,
        role="user",
        content=text,
        metadata={
            "channel": "feishu",
            "message_id": parsed["session_id"],
            "user_id": user_id
        }
    )
    
    # 生成 AI 回复
    ai_response = await generate_ai_response(text, session.id, channel="feishu")
    
    # 添加 AI 回复
    session_service.add_message(
        session_id=session.id,
        role="assistant",
        content=ai_response,
        metadata={"channel": "feishu"}
    )
    
    return FeishuResponse(code=0, msg="success")


@router.get("/test")
async def feishu_test():
    """测试端点"""
    return {"status": "ok", "channel": "feishu"}

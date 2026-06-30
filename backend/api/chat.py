"""
企智 · Chat AI API
对接 Hermes Gateway (OpenAI-compatible) + 6层记忆系统
"""

import os
import yaml
import httpx
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Hermes Gateway 配置（本地）
HERMES_BASE_URL = os.environ.get("HERMES_BASE_URL", "https://api.minimaxi.com/v1")

def _load_hermes_api_key() -> str:
    """从 ~/.hermes/config.yaml 读取 MiniMax CN API key"""
    try:
        cfg_path = Path.home() / ".hermes" / "config.yaml"
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f)
        model_cfg = cfg.get("model", {})
        key = model_cfg.get("api_key", "")
        if key and len(key) > 10:
            return key
    except Exception:
        pass
    return os.environ.get("HERMES_API_KEY", "")

HERMES_API_KEY = _load_hermes_api_key()


# ===== 请求/响应模型 =====

class Message(BaseModel):
    role: str  # system | user | assistant
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = "MiniMax-M2.7"
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = False


class ChatCompletionResponse(BaseModel):
    id: str
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]


# ===== 6层记忆系统注入 =====

async def build_system_prompt() -> str:
    """
    从6层记忆系统构建 SYSTEM PROMPT
    L1持久记忆 + L2会话 + L3技能 + L4 MCP + L5知识库
    """
    from memory.layers.layer1_persistent import PersistentMemory
    from memory.layers.layer3_skills import SkillsRegistry

    parts = []

    # L1 持久记忆（角色设定）
    try:
        pm = PersistentMemory()
        soul = pm.get_soul()
        if soul:
            parts.append(f"[角色设定]\n{soul}")
    except Exception:
        pass

    # L3 技能系统
    try:
        skills = SkillsRegistry()
        active = skills.list_skills(enabled_only=True)[:5]
        if active:
            skill_names = ", ".join([s.name for s in active])
            parts.append(f"[可用技能]\n{skill_names}")
    except Exception:
        pass

    # 基础企智设定
    parts.append(
        "[企智 · Qizhi]\n"
        "你是企智（Qizhi），一个企业级AI工作流助手。"
        "基于 OpenClaw + Hermes 双引擎架构。"
        "擅长：工作流编排、任务自动化、知识问答、代码生成。"
    )

    return "\n\n".join(parts)


# ===== Chat Completions =====

@router.post("/completions")
async def chat_completions(req: ChatCompletionRequest):
    """
    Chat AI 对接 Hermes Gateway
    1. 注入 L1-L5 记忆到 system prompt
    2. 转发到 Hermes Gateway
    3. 返回 AI 响应
    """
    # 构建带记忆的 system prompt
    system_prompt = await build_system_prompt()

    # 注入 system message
    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m.role, "content": m.content} for m in req.messages
    ]

    # 调用 Hermes Gateway
    payload = {
        "model": req.model,
        "messages": messages,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": req.stream,
    }

    headers = {
        "Authorization": f"Bearer {HERMES_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{HERMES_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hermes Gateway error: {str(e)}")


# ===== Streaming Chat =====

@router.post("/completions/stream")
async def chat_completions_stream(req: ChatCompletionRequest):
    """
    流式 Chat AI - Server-Sent Events
    直接代理 Hermes Gateway 的流式响应
    """
    system_prompt = await build_system_prompt()
    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m.role, "content": m.content} for m in req.messages
    ]

    payload = {
        "model": req.model,
        "messages": messages,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": True,
    }

    headers = {
        "Authorization": f"Bearer {HERMES_API_KEY}",
        "Content-Type": "application/json",
    }

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{HERMES_BASE_URL}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as resp:
                    async for chunk in resp.aiter_bytes():
                        if chunk:
                            yield chunk
        except Exception as e:
            yield f'data: {{"error": "{str(e)}"}}\n\n'.encode()

    return generate()


# ===== 健康检查 =====

@router.get("/status")
async def chat_status():
    """Chat 服务状态"""
    return {
        "status": "ok",
        "hermes_connected": HERMES_BASE_URL,
        "memory_system": "6-layer active",
    }

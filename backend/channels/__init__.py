"""
企智 · 消息通道
"""

from .feishu import router as feishu_router
from .wecom import router as wecom_router

__all__ = ["feishu_router", "wecom_router"]

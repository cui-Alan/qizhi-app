"""
qizhi-backend · FastAPI 主入口
云端 API 服务（认证/工作流/订阅）
"""

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# 添加 backend 根目录到 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.parser import WorkflowParser
from engine.executor import WorkflowExecutor


# ===== 生命周期 =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化执行器
    global executor
    from engine.executor import WorkflowExecutor as WFE
    executor = WFE()
    print("[企智] 后端启动完成")
    yield
    print("[企智] 后端关闭")


app = FastAPI(
    title="企智 QiZhi API",
    description="企业级 AI 工作流平台",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS（开发环境允许所有，生产环境应限制）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局执行器
executor: Optional[WorkflowExecutor] = None


# ===== Pydantic 模型 =====

class WorkflowRunRequest(BaseModel):
    workflow_yaml: str
    config: dict = {}
    sync: bool = True


class WorkflowRunResponse(BaseModel):
    run_id: str
    status: str


class TemplateListResponse(BaseModel):
    templates: List[dict]


# ===== 健康检查 =====

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "service": "qizhi-backend"}


# ===== 挂载路由 =====

# Auth 路由（登录/注册/Token刷新/改密）
from routes.auth import router as auth_router
app.include_router(auth_router)

# Admin 路由（用户管理）
from routes.admin import router as admin_router
app.include_router(admin_router)

# 消息通道路由（飞书/企微）
from channels.feishu import router as feishu_router
app.include_router(feishu_router)

from channels.wecom import router as wecom_router
app.include_router(wecom_router)

# Session 路由（会话管理）
from routes.session import router as session_router
app.include_router(session_router)


# ===== 工作流执行 =====

@app.post("/api/v1/workflows/run", response_model=WorkflowRunResponse)
async def run_workflow(req: WorkflowRunRequest):
    """执行工作流"""
    try:
        parser = WorkflowParser()
        workflow = parser.parse(req.workflow_yaml)

        if req.sync and executor:
            ctx = await executor.execute(workflow, req.config)
            return WorkflowRunResponse(run_id=ctx.workflow_id, status="completed")
        else:
            import uuid
            run_id = f"run_{uuid.uuid4().hex[:8]}"
            return WorkflowRunResponse(run_id=run_id, status="started")

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== 模板市场 =====

@app.get("/api/v1/templates", response_model=TemplateListResponse)
async def list_templates(category: Optional[str] = None):
    templates = [
        {"id": "1", "name": "选品自动化", "category": "电商", "downloads": 1200},
        {"id": "2", "name": "内容生成", "category": "运营", "downloads": 980},
        {"id": "3", "name": "客服机器人", "category": "客服", "downloads": 850},
    ]
    if category:
        templates = [t for t in templates if t["category"] == category]
    return TemplateListResponse(templates=templates)


@app.get("/api/v1/templates/{template_id}")
async def get_template(template_id: str):
    return {
        "id": template_id,
        "name": "选品自动化",
        "yaml": "workflow:\n  name: '选品自动化'\n  nodes: []",
    }


# ===== 同步 =====

from pydantic import BaseModel as BM

class SyncWorkflowsRequest(BM):
    workflows: List[dict]

@app.post("/api/v1/sync/workflows")
async def sync_workflows(req: SyncWorkflowsRequest):
    return {"synced": len(req.workflows)}


@app.get("/api/v1/sync/status")
async def sync_status():
    return {"last_sync": None, "pending": 0}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
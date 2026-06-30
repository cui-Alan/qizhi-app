"""
qizhi-backend · FastAPI 主入口
云端 API 服务（认证/同步/模板市场）
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncio

from engine.parser import WorkflowParser
from engine.executor import WorkflowExecutor, ExecutionContext
from engine.nodes import get_handlers
from api.chat import router as chat_router

app = FastAPI(
    title="qizhi API",
    description="企智后端API - 工作流引擎+记忆系统",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载 Chat AI 路由（接入 Hermes Gateway + 6层记忆）
app.include_router(chat_router)

# 全局执行器（初始化节点处理器）
executor: Optional[WorkflowExecutor] = None

def _get_executor() -> WorkflowExecutor:
    global executor
    if executor is None:
        executor = WorkflowExecutor(node_handlers=get_handlers())
    return executor


# ===== Pydantic 模型 =====

class WorkflowRunRequest(BaseModel):
    workflow_yaml: str
    config: dict = {}
    sync: bool = True  # 是否同步执行


class WorkflowRunResponse(BaseModel):
    run_id: str
    status: str


class TemplateListResponse(BaseModel):
    templates: List[dict]


# ===== 健康检查 =====

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ===== 工作流执行 =====

@app.post("/api/v1/workflows/run", response_model=WorkflowRunResponse)
async def run_workflow(req: WorkflowRunRequest):
    """执行工作流"""
    try:
        parser = WorkflowParser()
        workflow = parser.parse(req.workflow_yaml)
        
        if req.sync:
            # 同步执行
            exec_instance = _get_executor()
            ctx = await exec_instance.execute(workflow, req.config)
            return WorkflowRunResponse(
                run_id=ctx.workflow_id,
                status="completed",
            )
        else:
            # 异步执行（后台运行）
            run_id = f"run_{id(req)}"
            asyncio.create_task(_run_background(workflow, req.config, run_id))
            return WorkflowRunResponse(run_id=run_id, status="started")
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def _run_background(workflow, config, run_id):
    """后台执行工作流"""
    try:
        exec_instance = _get_executor()
        ctx = await exec_instance.execute(workflow, config)
        # TODO: 保存执行结果到数据库
    except Exception as e:
        pass


# ===== 模板市场 =====

@app.get("/api/v1/templates", response_model=TemplateListResponse)
async def list_templates(category: Optional[str] = None):
    """列出工作流模板"""
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
    """获取模板详情"""
    return {
        "id": template_id,
        "name": "选品自动化",
        "yaml": "workflow:\n  name: '选品自动化'\n  nodes: []",
    }


# ===== 认证（占位） =====

@app.post("/api/v1/auth/login")
async def login(email: str, password: str):
    """用户登录"""
    # TODO: 实现 JWT 认证
    return {"access_token": "placeholder", "token_type": "bearer"}


@app.post("/api/v1/auth/register")
async def register(email: str, password: str):
    """用户注册"""
    return {"message": "User registered successfully"}


# ===== 同步 =====

@app.post("/api/v1/sync/workflows")
async def sync_workflows(workflows: List[dict]):
    """同步工作流到云端"""
    # TODO: 实现加密同步
    return {"synced": len(workflows)}


@app.get("/api/v1/sync/status")
async def sync_status():
    """获取同步状态"""
    return {"last_sync": "2026-06-29T12:00:00Z", "pending": 0}


if __name__ == "__main__":
    import uvicorn
    # 注意：Hermes Gateway 占用 8000，qizhi 后端用 8001
    uvicorn.run(app, host="0.0.0.0", port=8001)

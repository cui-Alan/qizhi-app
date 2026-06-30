"""
企智 · WorkflowExecutor
执行工作流节点图
"""

import asyncio
import uuid
from typing import Any, Dict, Optional
from dataclasses import dataclass, field

from engine.parser import Workflow, WorkflowNode


@dataclass
class ExecutionContext:
    workflow_id: str
    workflow_name: str
    status: str = "running"
    results: Dict[str, Any] = field(default_factory=dict)
    errors: Dict[str, str] = field(default_factory=dict)


class WorkflowExecutor:
    """执行工作流"""

    def __init__(self):
        self._registry: Dict[str, type] = {}

    def register_node(self, node_type: str, handler_class: type):
        """注册节点类型处理器"""
        self._registry[node_type] = handler_class

    async def execute(self, workflow: Workflow, config: Dict[str, Any]) -> ExecutionContext:
        """执行工作流"""
        ctx = ExecutionContext(
            workflow_id=f"run_{uuid.uuid4().hex[:8]}",
            workflow_name=workflow.name,
        )

        # 按拓扑顺序执行节点
        for node in workflow.nodes:
            try:
                result = await self._execute_node(node, ctx, config)
                ctx.results[node.id] = result
            except Exception as e:
                ctx.errors[node.id] = str(e)
                ctx.status = "failed"
                break

        if ctx.status == "running":
            ctx.status = "completed"

        return ctx

    async def _execute_node(self, node: WorkflowNode, ctx: ExecutionContext, config: Dict[str, Any]) -> Any:
        """执行单个节点"""
        handler = self._registry.get(node.type)

        if handler:
            instance = handler()
            if asyncio.iscoroutinefunction(instance.run):
                return await instance.run(node.config, ctx, config)
            else:
                return instance.run(node.config, ctx, config)
        else:
            # 默认：直接返回配置
            return {"node": node.id, "type": node.type, "config": node.config}

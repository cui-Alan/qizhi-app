"""
企智 · 工作流节点处理器（类注册模式）
每个节点类型对应一个 handler class，暴露 run() 方法
与 WorkflowExecutor.register_node() 配套使用
"""

import re
import httpx
import asyncio
from typing import Any, Dict, Optional


# ===== 基础节点 Handler =====

class BaseHandler:
    """Handler 基类"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": "ok"}


class TriggerHandler(BaseHandler):
    """触发器节点 — 工作流入口"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        import time
        event = config.get("event", "manual")
        return {"event": event, "triggered_at": time.time()}


class OutputHandler(BaseHandler):
    """输出节点 — 返回结果"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        output_var = config.get("variable", "last_result")
        value = ctx.results.get(output_var, ctx.results) if output_var != "last_result" else ctx.results
        return {"result": value}


class ConditionHandler(BaseHandler):
    """条件节点 — 评估条件表达式"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        expression = config.get("expression", "true")
        result = _eval_condition(expression, ctx)
        return {"branch": "true" if result else "false", "condition_met": result}


def _resolve_path(path: str, ctx: Any) -> Any:
    """解析 {{a.b.c}} 路径"""
    parts = path.strip().split(".")
    if parts[0] in ctx.results:
        val = ctx.results.get(parts[0], {})
        for p in parts[1:]:
            val = val.get(p, "") if isinstance(val, dict) else ""
        return val
    if parts[0] in getattr(ctx, "variables", {}):
        val = ctx.variables.get(parts[0], {})
        for p in parts[1:]:
            val = val.get(p, "") if isinstance(val, dict) else ""
        return val
    return ""


def _eval_condition(expr: str, ctx: Any) -> bool:
    """评估布尔表达式"""
    expr = expr.strip()
    if expr.lower() in ("true", "false"):
        return expr.lower() == "true"
    # 变量引用
    var_match = re.match(r"^\{\{([^}]+)\}\}$", expr.strip())
    if var_match:
        return bool(_resolve_path(var_match.group(1), ctx))
    # contains
    if " contains " in expr:
        parts = expr.split(" contains ", 1)
        val = _resolve_path(parts[0].strip(), ctx)
        return str(parts[1].strip().strip("'\"")) in str(val) if val else False
    return False


class AIHandler(BaseHandler):
    """AI 节点 — 调用 MiniMax"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        model = config.get("model", "MiniMax-M2.7")
        prompt_template = config.get("prompt", "")
        prompt = _resolve_template(prompt_template, ctx)

        try:
            from ...api.chat import _load_hermes_api_key, HERMES_BASE_URL
            api_key = _load_hermes_api_key()

            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": config.get("max_tokens", 1024),
                "temperature": config.get("temperature", 0.7),
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{HERMES_BASE_URL}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return {"reply": content}
        except Exception as e:
            return {"error": f"AI调用失败: {str(e)}"}


def _resolve_template(template: str, ctx: Any) -> str:
    """解析模板字符串 {{a.b.c}}"""
    if not isinstance(template, str):
        return str(template)
    pattern = r"\{\{([^}]+)\}\}"
    def replacer(m):
        val = _resolve_path(m.group(1), ctx)
        return str(val) if val else ""
    return re.sub(pattern, replacer, template)


class HTTPHandler(BaseHandler):
    """HTTP 节点 — 发送 HTTP 请求"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        method = config.get("method", "GET").upper()
        url = _resolve_template(config.get("url", ""), ctx)
        headers = {k: _resolve_template(str(v), ctx) for k, v in config.get("headers", {}).items()}
        body = config.get("body")
        if body:
            body = _resolve_template(str(body), ctx)

        try:
            async with httpx.AsyncClient(timeout=config.get("timeout", 30)) as client:
                httpx_method = getattr(client, method.lower())
                resp = await httpx_method(url, headers=headers, content=body)
                return {
                    "status": resp.status_code,
                    "body": resp.text[:5000],
                    "headers": dict(resp.headers),
                }
        except Exception as e:
            return {"error": f"HTTP请求失败: {str(e)}"}


class CodeHandler(BaseHandler):
    """代码节点 — 执行 Python 代码片段"""
    async def run(self, config: Dict[str, Any], ctx: Any, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        code = config.get("source", "")
        try:
            local_vars: Dict[str, Any] = {"result": None}
            exec(code, {"ctx": ctx, "input": config}, local_vars)
            return {"result": local_vars.get("result")}
        except Exception as e:
            return {"error": f"代码执行失败: {str(e)}"}


# ===== 节点注册 =====

NODE_HANDLERS: Dict[str, type] = {
    "trigger": TriggerHandler,
    "output": OutputHandler,
    "condition": ConditionHandler,
    "ai": AIHandler,
    "http": HTTPHandler,
    "code": CodeHandler,
}


def get_handlers() -> Dict[str, type]:
    """返回节点类型 → Handler 类映射"""
    return NODE_HANDLERS


def register_all(executor: "WorkflowExecutor") -> None:
    """将所有 handler 注册到 executor"""
    for node_type, handler_cls in NODE_HANDLERS.items():
        executor.register_node(node_type, handler_cls)

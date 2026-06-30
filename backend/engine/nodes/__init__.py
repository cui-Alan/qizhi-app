"""
工作流节点处理器
每个节点类型对应一个异步处理函数
"""

import re
import httpx
import asyncio
from typing import Any, Dict, Optional
from ..executor import ExecutionContext, ExecutionResult, NodeStatus


# ===== 基础处理器 =====

async def handle_trigger(node, resolved_input, ctx) -> ExecutionResult:
    """触发器节点 — 工作流入口，等待事件"""
    import time
    config = node.config or {}
    event = config.get("event", "manual")
    return ExecutionResult(
        status=NodeStatus.SUCCESS,
        output={"event": event, "triggered_at": time.time()},
    )


async def handle_output(node, resolved_input, ctx) -> ExecutionResult:
    """输出节点 — 将结果返回给调用方"""
    config = node.config or {}
    output_var = config.get("variable", "last_result")
    value = ctx.get(output_var) if output_var != "last_result" else ctx.results
    return ExecutionResult(
        status=NodeStatus.SUCCESS,
        output={"result": value},
    )


async def handle_condition(node, resolved_input, ctx) -> ExecutionResult:
    """条件节点 — 评估条件表达式"""
    config = node.config or {}
    condition = config.get("expression", "true")
    # 简单的表达式解析
    try:
        result = _eval_simple(condition, ctx)
        return ExecutionResult(
            status=NodeStatus.SUCCESS,
            output={"branch": "true" if result else "false", "condition_met": result},
        )
    except Exception as e:
        return ExecutionResult(status=NodeStatus.FAILED, error=str(e))


def _eval_simple(expr: str, ctx: ExecutionContext) -> bool:
    """评估简单布尔表达式"""
    expr = expr.strip()
    # 支持: ==, !=, >, <, and, or, not, in, contains
    if expr.lower() in ("true", "false"):
        return expr.lower() == "true"
    # 变量引用: {{node_id.output.key}}
    var_match = re.match(r"^\{\{([^}]+)\}\}$", expr.strip())
    if var_match:
        val = _resolve_path(var_match.group(1), ctx)
        return bool(val)
    # contains
    if " contains " in expr:
        parts = expr.split(" contains ", 1)
        val = _resolve_path(parts[0].strip(), ctx)
        return str(parts[1].strip().strip("'\"")) in str(val) if val else False
    # 比较: var == value
    for op in ("==", "!=", ">=", "<=", ">", "<"):
        if op in expr:
            parts = expr.split(op, 1)
            left = _resolve_path(parts[0].strip(), ctx)
            right = parts[1].strip().strip("'\"")
            try:
                left = float(left) if left else 0
                right = float(right)
                return {"==": left == right, "!=": left != right,
                        ">": left > right, "<": left < right,
                        ">=": left >= right, "<=": left <= left}[op]
            except (ValueError, TypeError):
                return str(left) == right
    return False


def _resolve_path(path: str, ctx: ExecutionContext) -> Any:
    """解析 {{a.b.c}} 路径"""
    parts = path.strip().split(".")
    # 从结果中查找
    if parts[0] in ctx.results:
        val = ctx.results.get(parts[0], {})
        for p in parts[1:]:
            val = val.get(p, "") if isinstance(val, dict) else ""
        return val
    # 从变量中查找
    if parts[0] in ctx.variables:
        val = ctx.variables.get(parts[0], {})
        for p in parts[1:]:
            val = val.get(p, "") if isinstance(val, dict) else ""
        return val
    return ""


# ===== AI 节点 =====

async def handle_ai(node, resolved_input, ctx) -> ExecutionResult:
    """AI 节点 — 调用 Chat AI"""
    config = node.config or {}
    model = config.get("model", "MiniMax-M2.7")
    prompt_template = config.get("prompt", "")
    
    # 解析 prompt 模板
    prompt = _resolve_template(prompt_template, ctx)
    
    # 调用 chat API
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
            return ExecutionResult(status=NodeStatus.SUCCESS, output={"reply": content})
    except Exception as e:
        return ExecutionResult(status=NodeStatus.FAILED, error=f"AI调用失败: {str(e)}")


def _resolve_template(template: str, ctx: ExecutionContext) -> str:
    """解析模板字符串"""
    if not isinstance(template, str):
        return str(template)
    pattern = r"\{\{([^}]+)\}\}"
    def replacer(m):
        val = _resolve_path(m.group(1), ctx)
        return str(val) if val else ""
    return re.sub(pattern, replacer, template)


# ===== HTTP 节点 =====

async def handle_http(node, resolved_input, ctx) -> ExecutionResult:
    """HTTP 节点 — 发送 HTTP 请求"""
    config = node.config or {}
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
            return ExecutionResult(
                status=NodeStatus.SUCCESS,
                output={
                    "status": resp.status_code,
                    "body": resp.text[:5000],
                    "headers": dict(resp.headers),
                },
            )
    except Exception as e:
        return ExecutionResult(status=NodeStatus.FAILED, error=f"HTTP请求失败: {str(e)}")


# ===== 代码节点 =====

async def handle_code(node, resolved_input, ctx) -> ExecutionResult:
    """代码节点 — 执行 Python 代码片段"""
    config = node.config or {}
    code = config.get("source", "")
    # 简单代码执行（受控）
    try:
        local_vars = {"ctx": ctx, "input": node.input, "result": None}
        exec(code, {"ctx": ctx, "input": node.input}, local_vars)
        return ExecutionResult(status=NodeStatus.SUCCESS, output={"result": local_vars.get("result")})
    except Exception as e:
        return ExecutionResult(status=NodeStatus.FAILED, error=f"代码执行失败: {str(e)}")


# ===== 节点注册表 =====

NODE_HANDLERS: Dict[str, Any] = {
    "trigger": handle_trigger,
    "output": handle_output,
    "condition": handle_condition,
    "ai": handle_ai,
    "http": handle_http,
    "code": handle_code,
}


def get_handlers() -> Dict[str, Any]:
    """获取所有节点处理器"""
    return NODE_HANDLERS

/**
 * 自动化触发器
 * POST /api/automations/trigger  — Webhook 触发自动化
 *   Body: { "automation_id": "uuid", "payload": {...} }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { automation_id, payload } = body;

    if (!automation_id) {
      return NextResponse.json({ error: "automation_id 必填" }, { status: 400 });
    }

    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();

    // 查询自动化规则
    const { data: automation, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automation_id)
      .eq("status", "active")
      .single();

    if (error || !automation) {
      return NextResponse.json({ error: "自动化规则不存在或未启用" }, { status: 404 });
    }

    // 触发工作流执行（如果有 workflow_id）
    let executionResult: Record<string, unknown> = { triggered: true };
    if (automation.workflow_id) {
      const execResp = await fetch(new URL(request.url).origin + "/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: automation.workflow_id,
          workflow_name: automation.name,
          yaml_content: automation.config?.yaml_content,
          trigger_payload: payload,
        }),
      });
      executionResult = await execResp.json();
    }

    // 更新 last_run_at
    await supabase
      .from("automations")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", automation_id);

    return NextResponse.json({
      success: true,
      automation_id,
      automation_name: automation.name,
      trigger: automation.trigger,
      execution: executionResult,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

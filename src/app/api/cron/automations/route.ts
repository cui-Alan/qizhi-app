/**
 * Vercel Cron — 定时执行自动化
 * GET /api/cron/automations
 *
 * Vercel.json 中配置触发频率
 * 安全验证：Authorization: Bearer {CRON_SECRET}
 */
import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServer();
    const origin = new URL(request.url).origin;

    const { data: automations, error } = await supabase
      .from("automations")
      .select("*")
      .eq("trigger", "schedule")
      .eq("status", "active");

    if (error) throw new Error(error.message);

    const results = [];
    for (const automation of automations ?? []) {
      try {
        if (automation.workflow_id) {
          await fetch(`${origin}/api/workflows/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workflow_id: automation.workflow_id,
              workflow_name: automation.name,
              yaml_content: automation.config?.yaml_content,
            }),
          });
        }
        await supabase
          .from("automations")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", automation.id);
        results.push({ id: automation.id, name: automation.name, status: "ok" });
      } catch (err) {
        results.push({ id: automation.id, name: automation.name, status: "error", error: String(err) });
      }
    }

    return NextResponse.json({ executed: results.length, results, timestamp: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
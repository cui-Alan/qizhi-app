/**
 * 工作流执行历史
 * GET /api/workflows/history?limit=20&offset=0
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const supabase = await createServer();

    const { data, error, count } = await supabase
      .from("workflow_executions")
      .select("*, workflow_id", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const executions = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      checkpointData: row.checkpoint_data,
    }));

    return NextResponse.json({ executions, total: count ?? 0, limit, offset });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
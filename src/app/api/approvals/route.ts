/**
 * 审批 API
 * GET  /api/approvals                    - 待审批列表
 * POST /api/approvals                    - 创建审批（引擎调用）
 * GET  /api/approvals/pending            - 当前用户的待审批
 * POST /api/approvals/[id]/approve       - 审批通过
 * POST /api/approvals/[id]/reject        - 审批拒绝
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { listPendingApprovals } from "@/lib/approval/service";

// GET /api/approvals/pending — 当前用户的待审批列表
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const approvals = await listPendingApprovals(user.id);
    return NextResponse.json({ approvals });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/approvals — 创建审批（由工作流引擎调用）
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServer();
    const body = await req.json();

    const { executionId, nodeId, assignedTo, context } = body;
    if (!executionId || !nodeId || !assignedTo) {
      return NextResponse.json({ error: "executionId, nodeId, assignedTo 必填" }, { status: 400 });
    }

    // 获取当前用户作为请求者
    const { data: { user } } = await supabase.auth.getUser();
    const requestedBy = user?.id || "system";

    const { createApproval } = await import("@/lib/approval/service");
    const approval = await createApproval(executionId, nodeId, requestedBy, assignedTo, context);

    return NextResponse.json({ approval }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
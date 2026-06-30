/**
 * 审批单操作
 * POST /api/approvals/[id]/approve
 * POST /api/approvals/[id]/reject
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { approve, reject } from "@/lib/approval/service";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/approvals/[id]/approve
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const comment = body.comment as string | undefined;
    const action = body.action as string; // "approve" | "reject"

    let approval;
    if (action === "reject") {
      approval = await reject(id, user.id, comment);
    } else {
      approval = await approve(id, user.id, comment);
    }

    return NextResponse.json({ approval });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
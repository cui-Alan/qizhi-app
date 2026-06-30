/**
 * 自动化 API
 * GET    /api/automations          - 列出自动化规则
 * POST   /api/automations          - 创建自动化规则
 * PATCH  /api/automations/[id]     - 更新规则（启停等）
 * DELETE /api/automations/[id]     - 删除规则
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ automations: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, trigger, workflow_id, config } = body;

    if (!name || !trigger) {
      return NextResponse.json({ error: "name 和 trigger 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("automations")
      .insert({
        user_id: user.id,
        name,
        trigger,
        workflow_id,
        config: config ?? {},
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
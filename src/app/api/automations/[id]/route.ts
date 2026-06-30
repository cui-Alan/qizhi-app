/**
 * 自动化单条操作
 * PATCH /api/automations/[id]   - 更新（启/停/编辑）
 * DELETE /api/automations/[id]  - 删除
 */
import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const { data, error } = await supabase
      .from("automations")
      .update({
        name: body.name,
        trigger: body.trigger,
        workflow_id: body.workflow_id,
        config: body.config,
        status: body.status,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ automation: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
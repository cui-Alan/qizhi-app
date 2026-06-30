/**
 * 记忆 CRUD — 单条操作
 * PUT    /api/memory/[id]
 * DELETE /api/memory/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { updateMemory, deleteMemory } from "@/lib/memory/service";
import type { UpdateMemoryInput } from "@/lib/memory/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const input: UpdateMemoryInput = {
      content: body.content,
      summary: body.summary,
      importance: body.importance,
      tags: body.tags,
      metadata: body.metadata,
    };

    const memory = await updateMemory(id, user.id, input);
    return NextResponse.json({ memory });
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
    await deleteMemory(id, user.id);
    return NextResponse.json({ status: "deleted" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

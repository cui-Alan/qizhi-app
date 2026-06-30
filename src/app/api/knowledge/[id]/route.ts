/**
 * 知识库文档操作
 * DELETE /api/knowledge/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createServer();

    // 先删 chunks，再删文档（按外键顺序）
    await supabase.from("kb_chunks").delete().eq("doc_id", id);
    const { error } = await supabase.from("kb_documents").delete().eq("id", id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
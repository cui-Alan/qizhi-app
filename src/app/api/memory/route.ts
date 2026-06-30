/**
 * 记忆 API
 * GET  /api/memory           - 获取记忆列表
 * POST /api/memory           - 创建记忆
 * PUT  /api/memory/[id]     - 更新记忆
 * DELETE /api/memory/[id]   - 删除记忆
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { createMemory, getMemories, updateMemory, deleteMemory } from "@/lib/memory/service";
import type { CreateMemoryInput, MemoryTier } from "@/lib/memory/types";

// GET /api/memory?tier=short_term&limit=20
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier") as MemoryTier | null;
    const limit = parseInt(searchParams.get("limit") ?? "50");

    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const memories = await getMemories(user.id, tier ?? undefined, limit);
    return NextResponse.json({ memories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/memory — 创建记忆
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const input: CreateMemoryInput = {
      tier: body.tier,
      content: body.content,
      summary: body.summary,
      importance: body.importance,
      tags: body.tags,
      source: body.source,
      expiresAt: body.expiresAt,
      metadata: body.metadata,
    };

    const memory = await createMemory(user.id, input);
    return NextResponse.json({ memory }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * MCP Bridge API
 * GET  /api/mcp?key=xxx&scope=user        - 读取
 * POST /api/mcp/set                       - 写入
 * DELETE /api/mcp?key=xxx&scope=user      - 删除
 * GET  /api/mcp/poll?scope=user&since=xxx - 轮询变更
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { getKV, listKV, setKV, deleteKV, broadcast, pollChanges } from "@/lib/mcp/service";
import type { SetKVInput, BroadcastInput, Scope } from "@/lib/mcp/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const scope = (searchParams.get("scope") ?? "user") as Scope;
    const since = searchParams.get("since");
    const prefix = searchParams.get("prefix");

    // 轮询变更模式
    if (searchParams.get("poll") === "1") {
      const changes = await pollChanges(scope, user.id, since ?? undefined);
      return NextResponse.json({ changes, timestamp: new Date().toISOString() });
    }

    // 列出所有键
    if (!key) {
      const entries = await listKV(scope, user.id, prefix ?? undefined);
      return NextResponse.json({ entries });
    }

    // 读取单个键
    const entry = await getKV({ key, scope }, user.id);
    return NextResponse.json({ entry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: setKV 或 broadcast
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const action = body.action;

    if (action === "broadcast") {
      const input: BroadcastInput = {
        event: body.event,
        key: body.key,
        payload: body.payload,
        scope: body.scope ?? "global",
        tags: body.tags,
      };
      await broadcast(user.id, input);
      return NextResponse.json({ status: "broadcasted" });
    }

    if (action === "set") {
      const input: SetKVInput = {
        key: body.key,
        value: body.value,
        scope: body.scope ?? "user",
        ownerName: body.ownerName ?? "user",
        tags: body.tags,
        ttl: body.ttl,
      };
      const entry = await setKV(user.id, input);
      return NextResponse.json({ entry }, { status: 201 });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: 删除一个键
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const scope = (searchParams.get("scope") ?? "user") as Scope;

    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    await deleteKV(key, scope, user.id);
    return NextResponse.json({ status: "deleted" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

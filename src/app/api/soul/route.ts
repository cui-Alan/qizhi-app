/**
 * SOUL API
 * GET  /api/soul         - 获取当前 system prompt
 * PUT  /api/soul/md      - 更新 SOUL.MD
 * PUT  /api/soul/config  - 更新 CONFIG.YAML
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { getSystemPrompt, getSoulConfig, updateSoulMd, updateSoulConfig } from "@/lib/soul/loader";

export async function GET(_req: NextRequest) {
  try {
    const systemPrompt = await getSystemPrompt();
    const config = await getSoulConfig();
    return NextResponse.json({ systemPrompt, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const action = body.action;

    if (action === "md") {
      await updateSoulMd(body.content);
      return NextResponse.json({ status: "updated" });
    }

    if (action === "config") {
      await updateSoulConfig(body.config);
      return NextResponse.json({ status: "updated" });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
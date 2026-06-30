import { NextRequest, NextResponse } from "next/server";
import { inference, injectMemoryContext } from "@/lib/ai/connector";
import { createServer } from "@/lib/supabase/server";
import { buildMemoryContext } from "@/lib/memory/service";
import { getSystemPrompt } from "@/lib/soul/loader";

// GET /api/messages?session_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }
    return NextResponse.json({
      messages: [{
        id: "welcome",
        session_id: sessionId,
        role: "assistant",
        content: "你好！我是企智 AI 助手，由 OpenClaw + Hermes 驱动。有什么可以帮你的？",
        created_at: new Date().toISOString(),
      }],
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/messages — AI 对话（L1 SOUL + L2-L4 记忆注入）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, messages: history, model } = body;

    if (!session_id || !content) {
      return NextResponse.json({ error: "session_id and content are required" }, { status: 400 });
    }

    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // L1: 加载 SOUL 系统提示词（Agent 人格）
    const systemPrompt = await getSystemPrompt().catch(
      () => "你是企智 QiZhi AI 助手，基于 OpenClaw + Hermes 架构。用中文回答，专业而简洁。"
    );

    // L2-L4: 构建记忆上下文
    let memoryContext = "";
    if (userId) {
      try {
        memoryContext = await buildMemoryContext(userId, content);
      } catch (e) {
        console.warn("buildMemoryContext failed:", e);
      }
    }

    // 组装消息列表：SOUL → 记忆 → 历史 → 当前
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (memoryContext) {
      chatMessages.push({ role: "system", content: memoryContext });
    }

    if (history?.length) {
      chatMessages.push(
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }

    chatMessages.push({ role: "user", content });

    const defaultModel = process.env.DEFAULT_MODEL || "DeepSeek-R1-Distill-Qwen-32B-AWQ";

    let aiContent: string;
    try {
      const result = await inference({
        model: model || defaultModel,
        messages: chatMessages,
      });
      aiContent = result.content;
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      aiContent = `[AI 服务暂不可用] ${msg}`;
    }

    return NextResponse.json({
      messages: [{
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        session_id,
        role: "assistant",
        content: aiContent,
        created_at: new Date().toISOString(),
      }],
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
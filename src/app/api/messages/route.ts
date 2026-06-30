import { NextRequest, NextResponse } from "next/server";
import { inference, injectMemoryContext } from "@/lib/ai/connector";
import { createServer } from "@/lib/supabase/server";
import { buildMemoryContext } from "@/lib/memory/service";

// GET /api/messages?session_id=xxx - List messages for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    return NextResponse.json({
      messages: [
        {
          id: "welcome",
          session_id: sessionId,
          role: "assistant",
          content: "你好！我是企智 AI 助手，由 OpenClaw + Hermes 驱动。有什么可以帮你的？",
          created_at: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/messages - Send message → AI inference (with Hermes memory)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, messages: history, model } = body;

    if (!session_id || !content) {
      return NextResponse.json({ error: "session_id and content are required" }, { status: 400 });
    }

    // 获取当前用户
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // 构建聊天消息
    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: "你是企智 QiZhi AI 助手，基于 OpenClaw + Hermes 架构。用中文回答，专业而简洁。",
      },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content },
    ];

    // 注入 Hermes 记忆上下文
    if (userId) {
      try {
        const memoryContext = await buildMemoryContext(userId, content);
        if (memoryContext) {
          // 将记忆追加到 system 消息之后、用户消息之前
          chatMessages.splice(1, 0, {
            role: "system",
            content: memoryContext,
          });
        }
      } catch (memErr) {
        // 记忆服务异常不影响主流程
        console.warn("buildMemoryContext failed:", memErr);
      }
    }

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
      console.warn("AI inference failed:", msg);
      aiContent = `[AI 服务暂不可用] ${msg}`;
    }

    const assistantMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      session_id,
      role: "assistant",
      content: aiContent,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ messages: [{ id: "pending", role: "assistant", content: aiContent, created_at: new Date().toISOString() }] }, { status: 201 });
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { inference } from "@/lib/ai/connector";

// GET /api/messages?session_id=xxx - List messages for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/messages - Send message → AI inference
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, messages: history, model } = body;

    if (!session_id || !content) {
      return NextResponse.json(
        { error: "session_id and content are required" },
        { status: 400 },
      );
    }

    const userMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      session_id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    // Build chat messages with history
    const chatMessages = [
      {
        role: "system" as const,
        content:
          "你是企智 QiZhi AI 助手，基于 OpenClaw + Hermes 架构。用中文回答，专业而简洁。",
      },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    const defaultModel =
      process.env.DEFAULT_MODEL || "DeepSeek-R1-Distill-Qwen-32B-AWQ";

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

    return NextResponse.json(
      { messages: [userMessage, assistantMessage] },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callAI, getProviderConfig } from "@/lib/ai/providers";

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

    // Return welcome message (real history from DB later)
    return NextResponse.json({
      messages: [
        {
          id: "welcome",
          session_id: sessionId,
          role: "assistant",
          content: "你好！我是企智 AI 助手，有什么可以帮你的？",
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

// POST /api/messages - Send a new message & get AI response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, messages: history } = body;

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

    // Get AI response from configured provider
    const provider = getProviderConfig();
    const chatMessages = [
      {
        role: "system",
        content:
          "你是企智 QiZhi AI 助手，由 OpenClaw + Hermes 驱动。你用中文回答，专业而简洁。",
      },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content },
    ];

    let aiContent: string;
    try {
      const response = await callAI(provider, {
        model: provider.defaultModel,
        messages: chatMessages,
      });
      aiContent = response.content;
    } catch (aiErr) {
      console.warn("AI call failed, using fallback:", aiErr);
      aiContent = `[AI 服务暂时不可用] 收到你的消息："${content}"。接入配置: AI_PROVIDER=${process.env.AI_PROVIDER || "mock"}，请检查 AI 服务是否运行。`;
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

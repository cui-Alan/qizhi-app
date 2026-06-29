import { NextRequest, NextResponse } from "next/server";

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

    // For MVP, return mock data (Supabase table may not be initialized yet)
    // TODO: Replace with Supabase query when DB is ready
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

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, role, content } = body;

    if (!session_id || !content) {
      return NextResponse.json(
        { error: "session_id and content are required" },
        { status: 400 },
      );
    }

    // For MVP, return a mock assistant response
    // TODO: Connect to Hermes/OpenClaw Agent backend
    const userMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      session_id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };

    // Mock AI response
    const responses: Record<string, string> = {
      数据分析: "好的，我来帮你分析数据。请提供数据源或具体需求。",
      文档撰写: "没问题，请告诉我文档的主题、格式和具体要求。",
      代码助手: "我可以帮你写代码、debug、或者解释代码逻辑。请描述你的需求。",
      工作流编排: "工作流可视化编辑器已就绪，你可以拖拽节点来编排任务流程。",
    };

    const aiContent =
      responses[content] ||
      `收到你的消息："${content}"。我是企智 AI 助手，正在全力为你服务。`;

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

import { NextRequest } from "next/server";
import { streamInference } from "@/lib/ai/connector";

// POST /api/messages/stream — 流式 AI 推理 (SSE)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, messages: history, model } = body;

    if (!session_id || !content) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", error: "session_id and content are required" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const defaultModel = process.env.DEFAULT_MODEL || "DeepSeek-R1-Distill-Qwen-32B-AWQ";

    const chatMessages = [
      {
        role: "system" as const,
        content: "你是企智 QiZhi AI 助手，基于 OpenClaw + Hermes 架构。用中文回答，专业而简洁。",
      },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "start", session_id })}\n\n`)
        );

        try {
          const gen = streamInference(
            { model: model || defaultModel, messages: chatMessages },
            { providerType: (process.env.AI_PROVIDER as "ollama" | "openai" | "anthropic") || "ollama" }
          );

          for await (const chunk of gen) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`)
            );
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}

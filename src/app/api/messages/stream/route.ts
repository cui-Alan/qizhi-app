import { NextRequest } from "next/server";
import { streamInference } from "@/lib/ai/connector";

// ── 知识库检索 ──
async function searchKnowledge(query: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Simple keyword search on kb_documents
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/kb_documents?select=title,content_preview&or=(title.ilike.*${encodeURIComponent(query)}*,content_preview.ilike.*${encodeURIComponent(query)}*)&limit=3`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    if (!resp.ok) return "";
    const docs = await resp.json() as { title: string; content_preview: string }[];
    if (!docs.length) return "";

    return docs.map((d, i) => `[知识${i + 1}] ${d.title}\n${d.content_preview?.slice(0, 300)}`).join("\n\n");
  } catch { return ""; }
}

// POST /api/messages/stream — 流式 AI 推理 + RAG (SSE)
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

    // RAG: 搜索知识库
    const kbContext = await searchKnowledge(content);
    const systemPrompt = "你是企智 QiZhi AI 助手，用中文回答，专业而简洁。" +
      (kbContext ? `\n\n📚 相关知识库内容:\n${kbContext}\n\n请基于以上知识库内容回答问题，并标注来源。` : "");

    const chatMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
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

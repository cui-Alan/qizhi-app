/**
 * 企智 QiZhi — AI 推理连接器
 * 整合自小虾的 agent/connector + 多 provider 支持
 * 支持：oMLX / OpenAI / Anthropic / MiniMax / OpenClaw
 */

export type ModelProvider = "ollama" | "openai" | "anthropic" | "minimax" | "openclaw";

export interface InferenceRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface InferenceResponse {
  content: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// ── 记忆上下文注入 ────────────────────────────────────────
/**
 * 将记忆上下文注入到 messages 的 system 消息之前。
 * 如果已有 system 消息，追加到其内容末尾；
 * 如果没有 system 消息，在最前面插入一条 system 消息。
 */
export function injectMemoryContext(
  messages: InferenceRequest["messages"],
  memoryContext: string,
): InferenceRequest["messages"] {
  if (!memoryContext) return messages;

  const memoryBlock = `\n\n${memoryContext}\n`;

  const systemIdx = messages.findIndex((m) => m.role === "system");
  if (systemIdx >= 0) {
    const msgs = [...messages];
    msgs[systemIdx] = {
      ...msgs[systemIdx],
      content: msgs[systemIdx].content + memoryBlock,
    };
    return msgs;
  }

  return [
    { role: "system", content: `你是企智（QiZhi）AI 助手。${memoryBlock}` },
    ...messages,
  ];
}

// ── 本地 oMLX（Ollama）推理 ───────────────────────────────
async function ollamaInference(req: InferenceRequest): Promise<InferenceResponse> {
  const baseUrl = process.env.OMLX_BASE_URL || "http://127.0.0.1:8000/v1";

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: false,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens) body.max_tokens = req.maxTokens;

  const apiKey = process.env.OMLX_API_KEY || "local";
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`oMLX inference failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || req.model,
    usage: data.usage,
  };
}

// ── OpenAI 兼容 API ──────────────────────────────────────
async function openaiInference(
  req: InferenceRequest,
  apiKey: string,
  baseUrl?: string,
): Promise<InferenceResponse> {
  const url = `${baseUrl || "https://api.openai.com/v1"}/chat/completions`;

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: false,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens) body.max_tokens = req.maxTokens;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI inference failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || req.model,
    usage: data.usage,
  };
}

// ── Anthropic API ────────────────────────────────────────
async function anthropicInference(
  req: InferenceRequest,
  apiKey: string,
): Promise<InferenceResponse> {
  const systemMsg = req.messages.find((m) => m.role === "system")?.content || "";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens || 4096,
      system: systemMsg,
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic inference failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return {
    content: data.content?.[0]?.text || "",
    model: data.model || req.model,
    usage: data.usage,
  };
}

// ── OpenClaw Agent ───────────────────────────────────────
async function openclawInference(req: InferenceRequest): Promise<InferenceResponse> {
  const openclawUrl = process.env.OPENCLAW_URL || "http://127.0.0.1:18789";

  const resp = await fetch(`${openclawUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      stream: false,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok) {
    throw new Error(`OpenClaw inference failed: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    content: data.reply || data.content || "",
    model: data.model || req.model,
  };
}

// ── 统一推理入口 ──────────────────────────────────────────
export async function inference(
  req: InferenceRequest,
  options?: {
    providerType?: ModelProvider;
    apiKey?: string;
    baseUrl?: string;
  },
): Promise<InferenceResponse> {
  const { providerType = process.env.AI_PROVIDER as ModelProvider || "ollama", apiKey, baseUrl } =
    options || {};

  switch (providerType) {
    case "ollama":
      return ollamaInference(req);
    case "openai":
    case "minimax":
      return openaiInference(req, apiKey || "", baseUrl);
    case "anthropic":
      return anthropicInference(req, apiKey || "");
    case "openclaw":
      return openclawInference(req);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

// ── 流式推理 ──────────────────────────────────────────────
export async function* streamInference(
  req: InferenceRequest,
  options?: { providerType?: ModelProvider; apiKey?: string; baseUrl?: string },
): AsyncGenerator<string, void, unknown> {
  const { providerType = process.env.AI_PROVIDER as ModelProvider || "ollama", apiKey, baseUrl } =
    options || {};

  const baseUrl2 =
    providerType === "ollama"
      ? process.env.OMLX_BASE_URL || "http://127.0.0.1:8000/v1"
      : baseUrl || "https://api.openai.com/v1";

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: true,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens) body.max_tokens = req.maxTokens;

  const ollamaKey = process.env.OMLX_API_KEY || "local";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (providerType === "ollama") {
    headers["Authorization"] = `Bearer ${ollamaKey}`;
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const resp = await fetch(`${baseUrl2}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!resp.ok || !resp.body) throw new Error(`Stream inference failed: ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            /* skip */
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

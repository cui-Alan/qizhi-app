// AI Inference Providers — supports multiple backends

export type AIProviderType = "openai" | "anthropic" | "local" | "mock";

export interface AIRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface ProviderConfig {
  type: AIProviderType;
  baseUrl?: string;
  apiKey?: string;
  defaultModel: string;
}

// ── OpenAI-compatible provider ──
async function callOpenAI(
  config: ProviderConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const url = `${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey || "dummy"}`,
    },
    body: JSON.stringify({
      model: request.model || config.defaultModel,
      messages: request.messages,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI provider error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || request.model,
    usage: data.usage,
  };
}

// ── Anthropic provider ──
async function callAnthropic(
  config: ProviderConfig,
  request: AIRequest,
): Promise<AIResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model || config.defaultModel,
      max_tokens: request.max_tokens || 4096,
      system: request.messages.find((m) => m.role === "system")?.content || "",
      messages: request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text || "",
    model: data.model || request.model,
    usage: data.usage,
  };
}

// ── Mock (for development) ──
async function callMock(request: AIRequest): Promise<AIResponse> {
  const lastMsg = request.messages[request.messages.length - 1]?.content || "";
  const responses: Record<string, string> = {
    数据分析: "让我来分析数据。首先需要明确数据来源和指标定义，然后进行多维度拆解。请提供数据或描述你的分析需求。",
    文档撰写: "好的，我来帮你写文档。请告诉我文档类型（报告/方案/邮件/PRD等）、受众和篇幅要求。",
    代码助手: "我可以帮你写代码、debug、或解释技术问题。请描述你的具体需求和技术栈。",
    工作流编排: "工作流可视化编辑器已就绪，你可以在画布上拖拽节点来编排任务。",
  };

  const matched = responses[lastMsg] || null;
  const content = matched || `收到你的消息。我是企智 AI 助手，基于 OpenClaw + Hermes 架构。请描述你的具体需求，我会尽力帮你。`;

  // Simulate slight delay
  await new Promise((r) => setTimeout(r, 300));

  return {
    content,
    model: "mock/qizhi-alpha",
  };
}

// ── Router ──
export async function callAI(
  config: ProviderConfig,
  request: AIRequest,
): Promise<AIResponse> {
  switch (config.type) {
    case "openai":
    case "local":
      return callOpenAI(config, request);
    case "anthropic":
      return callAnthropic(config, request);
    case "mock":
    default:
      return callMock(request);
  }
}

// ── Get provider config from env ──
export function getProviderConfig(): ProviderConfig {
  const type = (process.env.AI_PROVIDER || "mock") as AIProviderType;

  const configs: Record<AIProviderType, ProviderConfig> = {
    local: {
      type: "local",
      baseUrl: process.env.LOCAL_LLM_URL || "http://127.0.0.1:8000/v1",
      apiKey: process.env.LOCAL_LLM_KEY || "dummy",
      defaultModel: process.env.LOCAL_LLM_MODEL || "qwen3.6-27b-instruct-q4_km",
    },
    openai: {
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
      defaultModel: "gpt-4o",
    },
    anthropic: {
      type: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      defaultModel: "claude-sonnet-4-6",
    },
    mock: {
      type: "mock",
      defaultModel: "mock/qizhi-alpha",
    },
  };

  return configs[type] || configs.mock;
}

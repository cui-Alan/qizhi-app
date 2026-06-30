/**
 * 企智 · Chat API Service
 * 前端 → qizhi Backend (8001) → Hermes Gateway (8000)
 */

const API_BASE = 'http://localhost:8001'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    message: ChatMessage
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// 发送消息（非流式）
export async function sendMessage(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number; model?: string }
): Promise<ChatCompletionResponse> {
  const res = await fetch(`${API_BASE}/api/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options?.model || 'qwen3.6-27b-instruct-q4_km',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
      stream: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

// 发送消息（流式 SSE）
export async function sendMessageStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  options?: { temperature?: number; max_tokens?: number; model?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/completions/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options?.model || 'qwen3.6-27b-instruct-q4_km',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
      stream: true,
    }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.choices?.[0]?.delta?.content) {
            onChunk(parsed.choices[0].delta.content)
          }
        } catch {
          // ignore parse errors for partial JSON
        }
      }
    }
  }
}

// 健康检查
export async function checkChatStatus(): Promise<{ status: string; hermes_connected: string }> {
  const res = await fetch(`${API_BASE}/api/chat/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

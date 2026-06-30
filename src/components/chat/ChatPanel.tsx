"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatMessageBubble } from "./MessageBubble";
import { api } from "@/lib/api";
import { Send, Plus } from "lucide-react";
import type { ChatMessage } from "@/types";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const {
    currentSessionId,
    sessions,
    messages,
    appendMessage,
    updateLastMessage,
    setMessages,
    setSessions,
    streaming,
    setStreaming,
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentMessages = currentSessionId
    ? messages[currentSessionId] || []
    : [];

  useEffect(() => {
    api.getSessions().then((data) => {
      if (data.length > 0) setSessions(data);
    });
  }, [setSessions]);

  useEffect(() => {
    if (currentSessionId) {
      api.getMessages(currentSessionId).then((msgs) => {
        setMessages(currentSessionId, msgs);
      });
    }
  }, [currentSessionId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming || !currentSessionId) return;

    const content = input;
    setInput("");
    setStreaming(true);

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      session_id: currentSessionId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    appendMessage(currentSessionId, userMsg);

    // 添加占位 assistant 消息
    const assistantId = `msg-${crypto.randomUUID().slice(0, 8)}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      session_id: currentSessionId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    appendMessage(currentSessionId, assistantMsg);

    // 收集历史消息
    const history = currentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          content,
          messages: history,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            if (event.type === "delta" && event.content) {
              fullContent += event.content;
              updateLastMessage(currentSessionId, fullContent);
            } else if (event.type === "done") {
              // 流式完成
            } else if (event.type === "error") {
              updateLastMessage(currentSessionId, `[错误] ${event.error}`);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      updateLastMessage(currentSessionId, "[AI 服务暂不可用]");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, currentSessionId, currentMessages, appendMessage, updateLastMessage, setStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {sessions.find((s) => s.id === currentSessionId)?.title || "助理"}
        </span>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <div className="text-4xl mb-4">企智</div>
            <p className="text-lg">输入你的问题开始对话</p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
              {["数据分析", "文档撰写", "代码助手", "工作流编排"].map(
                (hint) => (
                  <button
                    key={hint}
                    onClick={() => setInput(hint)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {hint}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          currentMessages.map((msg) =>
            <ChatMessageBubble key={msg.id} message={msg} />
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 p-4">
        <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-2">
          <button className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <Plus size={20} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="输入消息..."
            className="flex-1 bg-transparent resize-none outline-none py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="p-1.5 text-blue-600 hover:text-blue-700 disabled:text-zinc-300 dark:disabled:text-zinc-600 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

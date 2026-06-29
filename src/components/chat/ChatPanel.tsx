"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatMessageBubble } from "./MessageBubble";
import { Send, Plus } from "lucide-react";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const { currentSessionId, messages, appendMessage, streaming } =
    useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentMessages = currentSessionId
    ? messages[currentSessionId] || []
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const userMsg = {
      id: crypto.randomUUID(),
      session_id: currentSessionId || "new",
      role: "user" as const,
      content: input,
      created_at: new Date().toISOString(),
    };

    appendMessage(userMsg.session_id, userMsg);
    setInput("");

    // TODO: connect to real API
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
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
          currentMessages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))
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

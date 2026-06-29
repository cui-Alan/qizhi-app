"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/types";

function MessageContent({ content }: { content: string }) {
  // Simple markdown-style rendering
  const html = useMemo(() => {
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-zinc-800 p-3 rounded text-sm overflow-x-auto"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-sm">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }, [content]);

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md"
        }`}
      >
        <MessageContent content={message.content} />
        {message.tool_calls?.map((tc) => (
          <div
            key={tc.id}
            className="mt-2 p-2 bg-white/10 rounded text-xs font-mono"
          >
            🔧 {tc.name}
            {tc.result && <div className="mt-1 opacity-75">{tc.result}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

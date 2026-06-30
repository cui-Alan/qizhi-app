"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";

// ChatPanel 已改用 Supabase 直接调用，API routes 问题不影响
export default function ChatPage() {
  return <ChatPanel />;
}

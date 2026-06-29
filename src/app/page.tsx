"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function Home() {
  const { sessions, createSession, setCurrentSession } = useChatStore();

  useEffect(() => {
    if (sessions.length === 0) {
      const id = createSession("日常办公");
      setCurrentSession(id);
    }
  }, [sessions.length, createSession, setCurrentSession]);

  return <ChatPanel />;
}

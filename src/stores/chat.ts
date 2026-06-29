import { create } from "zustand";
import type { ChatSession, ChatMessage } from "@/types";

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  messages: Record<string, ChatMessage[]>;
  streaming: boolean;

  setSessions: (sessions: ChatSession[]) => void;
  setCurrentSession: (id: string | null) => void;
  createSession: (title?: string) => string;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  streaming: false,

  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (id) => set({ currentSessionId: id }),

  createSession: (title = "新对话") => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id,
      title,
      model_id: "gpt-4o",
      created_at: now,
      updated_at: now,
    };
    set((s) => ({
      sessions: [session, ...s.sessions],
      currentSessionId: id,
    }));
    return id;
  },

  renameSession: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === id ? { ...ses, title, updated_at: new Date().toISOString() } : ses,
      ),
    })),

  deleteSession: (id) =>
    set((s) => {
      const next = s.sessions.filter((ses) => ses.id !== id);
      const nextId = s.currentSessionId === id
        ? (next[0]?.id ?? null)
        : s.currentSessionId;
      const { [id]: _, ...rest } = s.messages;
      return { sessions: next, currentSessionId: nextId, messages: rest };
    }),

  setMessages: (sessionId, messages) =>
    set((s) => ({ messages: { ...s.messages, [sessionId]: messages } })),
  appendMessage: (sessionId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), message],
      },
    })),
  setStreaming: (v) => set({ streaming: v }),
}));

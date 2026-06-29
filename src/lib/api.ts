// QiZhi API client

import type { ChatSession, ChatMessage } from "@/types";

const BASE = "";

export const api = {
  // ── Sessions ──
  async getSessions(): Promise<ChatSession[]> {
    const res = await fetch(`${BASE}/api/sessions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  },

  async createSession(title?: string, modelId?: string): Promise<ChatSession | null> {
    const res = await fetch(`${BASE}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, model_id: modelId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.session;
  },

  async updateSession(
    id: string,
    updates: { title?: string; model_id?: string },
  ): Promise<void> {
    await fetch(`${BASE}/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  },

  async deleteSession(id: string): Promise<void> {
    await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE" });
  },

  // ── Messages ──
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(
      `${BASE}/api/messages?session_id=${sessionId}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  },

  async sendMessage(
    sessionId: string,
    content: string,
    role: string = "user",
  ): Promise<ChatMessage[]> {
    const res = await fetch(`${BASE}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, role, content }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  },
};

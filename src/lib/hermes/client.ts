/**
 * Hermes Gateway 客户端
 * 替代 MCP Bridge，直接调 Hermes REST API
 *
 * 已知端点：localhost:39099
 * 用途：
 * - 读取 Hermes 记忆/状态
 * - 写入共享上下文（写入后 Hermes 可读到）
 * - 与 Hermes 双向同步
 */

const HERMES_BASE = process.env.HERMES_GATEWAY_URL || "http://localhost:39099";

export interface HermesState {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface HermesMemory {
  id: string;
  content: string;
  tier: string;
  importance: string;
  tags: string[];
  createdAt: string;
}

/**
 * 读取 Hermes 状态
 */
export async function getHermesState(key: string): Promise<HermesState | null> {
  try {
    const resp = await fetch(`${HERMES_BASE}/state/${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

/**
 * 写入 Hermes 状态
 */
export async function setHermesState(
  key: string,
  value: unknown
): Promise<boolean> {
  try {
    const resp = await fetch(`${HERMES_BASE}/state/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 列出 Hermes 所有状态键
 */
export async function listHermesState(
  prefix?: string
): Promise<HermesState[]> {
  try {
    const url = prefix
      ? `${HERMES_BASE}/state?prefix=${encodeURIComponent(prefix)}`
      : `${HERMES_BASE}/state`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 删除 Hermes 状态
 */
export async function deleteHermesState(key: string): Promise<boolean> {
  try {
    const resp = await fetch(`${HERMES_BASE}/state/${encodeURIComponent(key)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 读取 Hermes 记忆（如果有对应端点）
 */
export async function getHermesMemories(
  tier?: string
): Promise<HermesMemory[]> {
  try {
    const url = tier
      ? `${HERMES_BASE}/memory?tier=${encodeURIComponent(tier)}`
      : `${HERMES_BASE}/memory`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 健康检查
 */
export async function hermesPing(): Promise<boolean> {
  try {
    const resp = await fetch(`${HERMES_BASE}/ping`, {
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
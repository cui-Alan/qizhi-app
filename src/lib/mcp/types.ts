/**
 * MCP Hub — 类型定义
 * 企智通用 MCP Client，可外接任何 MCP Server
 */

export type Scope = "global" | "user" | "agent" | "session";

export interface SharedEntry {
  id: string;
  key: string;             // 键路径，如 "project/status" 或 "agent/summary"
  value: unknown;           // 值（JSON 可序列化）
  scope: Scope;
  ownerId: string;         // 创建者 ID（user_id / agent_id）
  ownerName?: string;      // 创建者名称
  tags: string[];          // 标签，用于过滤
  version: number;         // 版本号，每次更新 +1
  ttl?: number;            // 生存时间（秒），可选
  expiresAt?: string;      // 过期时间（计算得出）
  createdAt: string;
  updatedAt: string;
}

export interface SetKVInput {
  key: string;
  value: unknown;
  scope?: Scope;
  ownerName?: string;
  tags?: string[];
  ttl?: number;
}

export interface GetKVInput {
  key: string;
  scope?: Scope;
}

export interface BroadcastInput {
  event: string;           // 事件类型，如 "memory.update" | "task.complete"
  key?: string;            // 可选，关联的 key
  payload: unknown;        // 事件数据
  scope?: Scope;
  tags?: string[];
}

export interface KVWatchEvent {
  event: "set" | "delete" | "expire" | "broadcast";
  key: string;
  value?: unknown;
  scope: Scope;
  ownerName?: string;
  version: number;
  timestamp: string;
}

/**
 * MCP Bridge — 核心服务
 *
 * 功能：
 * 1. KV 读写（set / get / delete）
 * 2. 广播事件（broadcast）
 * 3. 变更轮询（pollChanges — 用于跨 Agent 同步）
 */

import { createServer } from "@/lib/supabase/server";
import type { SharedEntry, SetKVInput, GetKVInput, BroadcastInput, Scope } from "./types";

/**
 * 写入/更新一个共享键值
 */
export async function setKV(
  userId: string,
  input: SetKVInput
): Promise<SharedEntry> {
  const supabase = await createServer();
  const key = input.key;
  const scope = input.scope ?? "user";

  // 尝试 upsert
  const { data, error } = await supabase
    .from("mcp_kv")
    .upsert(
      {
        key,
        value: JSON.stringify(input.value),
        scope,
        owner_id: userId,
        owner_name: input.ownerName ?? "unknown",
        tags: input.tags ?? [],
        ttl: input.ttl,
        expires_at: input.ttl
          ? new Date(Date.now() + input.ttl * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
        // version 由 DB trigger 或手动 +1
      },
      { onConflict: "key,scope" }
    )
    .select()
    .single();

  if (error) throw new Error(`setKV: ${error.message}`);
  return mapRow(data);
}

/**
 * 读取一个键值
 */
export async function getKV(
  input: GetKVInput,
  requestingUserId?: string
): Promise<SharedEntry | null> {
  const supabase = await createServer();

  let q = supabase
    .from("mcp_kv")
    .select("*")
    .eq("key", input.key)
    .eq("scope", input.scope ?? "user")
    .is("expires_at", null) // 未过期的
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`getKV: ${error.message}`);
  if (!data) return null;

  // 权限检查：global 公开；user 需 owner_id 或 requestingUserId 匹配；agent/session 需 owner_id 匹配
  if (data.scope === "user" && data.owner_id !== requestingUserId) {
    return null;
  }

  return mapRow(data);
}

/**
 * 获取某个 scope 下的所有键（或前缀搜索）
 */
export async function listKV(
  scope: Scope,
  userId?: string,
  prefix?: string,
  limit = 100
): Promise<SharedEntry[]> {
  const supabase = await createServer();

  let q = supabase
    .from("mcp_kv")
    .select("*")
    .eq("scope", scope)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (scope === "user" && userId) {
    q = q.eq("owner_id", userId);
  }

  if (prefix) {
    q = q.like("key", `${prefix}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listKV: ${error.message}`);
  return (data ?? []).map(mapRow);
}

/**
 * 删除一个键值
 */
export async function deleteKV(
  key: string,
  scope: Scope,
  userId: string
): Promise<void> {
  const supabase = await createServer();

  const { error } = await supabase
    .from("mcp_kv")
    .delete()
    .eq("key", key)
    .eq("scope", scope)
    .eq("owner_id", userId);

  if (error) throw new Error(`deleteKV: ${error.message}`);
}

/**
 * 广播一个事件（写入一条特殊记录，供 pollChanges 捕获）
 */
export async function broadcast(
  userId: string,
  input: BroadcastInput
): Promise<void> {
  const supabase = await createServer();
  const eventKey = `_broadcast/${input.scope}/${input.event}/${Date.now()}`;

  await supabase.from("mcp_kv").insert({
    key: eventKey,
    value: JSON.stringify({
      event: input.event,
      key: input.key,
      payload: input.payload,
      scope: input.scope,
      tags: input.tags,
      broadcast: true,
    }),
    scope: input.scope ?? "global",
    owner_id: userId,
    owner_name: "system",
    tags: input.tags ?? [input.event],
    ttl: 300, // 广播保留 5 分钟
    expires_at: new Date(Date.now() + 300_000).toISOString(),
  });
}

/**
 * 轮询变更（跨 Agent 同步用）
 * 返回自 lastTimestamp 之后的所有变更记录
 */
export async function pollChanges(
  scope: Scope,
  userId?: string,
  lastTimestamp?: string,
  limit = 50
): Promise<SharedEntry[]> {
  const supabase = await createServer();

  let q = supabase
    .from("mcp_kv")
    .select("*")
    .eq("scope", scope)
    .gt("updated_at", lastTimestamp ?? new Date(0).toISOString())
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (scope === "user" && userId) {
    q = q.eq("owner_id", userId);
  }

  const { data, error } = await q;
  if (error) throw new Error(`pollChanges: ${error.message}`);
  return (data ?? []).map(mapRow);
}

// DB row → SharedEntry
function mapRow(row: Record<string, unknown>): SharedEntry {
  return {
    id: row.id as string,
    key: row.key as string,
    value: JSON.parse((row.value as string) ?? "null"),
    scope: row.scope as Scope,
    ownerId: row.owner_id as string,
    ownerName: row.owner_name as string | undefined,
    tags: (row.tags as string[]) ?? [],
    version: (row.version as number) ?? 1,
    ttl: row.ttl as number | undefined,
    expiresAt: row.expires_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * 记忆服务 — 核心逻辑
 *
 * 功能：
 * 1. 记忆读写（CRUD + 检索）
 * 2. 对话上下文自动注入（buildMemoryContext）
 * 3. 遗忘机制（expires_at）
 */

import { createServer } from "@/lib/supabase/server";
import type {
  Memory,
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchMemoriesInput,
  MemoryWithScore,
  MemoryTier,
} from "./types";

// importance → 0-1 score
function importanceScore(m: { importance: string }): number {
  return { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 }[m.importance] ?? 0.5;
}

/**
 * 创建一条记忆
 */
export async function createMemory(
  userId: string,
  input: CreateMemoryInput
): Promise<Memory> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: userId,
      tier: input.tier,
      content: input.content,
      summary: input.summary,
      importance: input.importance ?? "medium",
      tags: input.tags ?? [],
      source: input.source ?? "agent",
      recall_count: 0,
      expires_at: input.expiresAt,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`createMemory: ${error.message}`);
  return mapRow(data);
}

/**
 * 获取某用户的记忆（按 tier）
 */
export async function getMemories(
  userId: string,
  tier?: MemoryTier,
  limit = 50
): Promise<Memory[]> {
  const supabase = await createServer();

  let q = supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tier) q = q.eq("tier", tier);

  const { data, error } = await q;
  if (error) throw new Error(`getMemories: ${error.message}`);
  return (data ?? []).map(mapRow);
}

/**
 * 更新一条记忆
 */
export async function updateMemory(
  memoryId: string,
  userId: string,
  input: UpdateMemoryInput
): Promise<Memory> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("memories")
    .update({
      content: input.content,
      summary: input.summary,
      importance: input.importance,
      tags: input.tags,
      metadata: input.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`updateMemory: ${error.message}`);
  return mapRow(data);
}

/**
 * 删除一条记忆
 */
export async function deleteMemory(memoryId: string, userId: string): Promise<void> {
  const supabase = await createServer();
  const { error } = await supabase
    .from("memories")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteMemory: ${error.message}`);
}

/**
 * 记忆检索
 * 当前：ILIKE 全文 + importance 排序
 * 后续：pg_vector 向量检索
 */
export async function searchMemories(
  userId: string,
  input: SearchMemoriesInput
): Promise<MemoryWithScore[]> {
  const supabase = await createServer();

  let q = supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .limit(input.limit ?? 10);

  if (input.tier) q = q.eq("tier", input.tier);
  if (input.importance) q = q.eq("importance", input.importance);
  if (input.excludeIds?.length)
    q = q.not("id", "in", `(${input.excludeIds.join(",")})`);

  const { data, error } = await q;
  if (error) throw new Error(`searchMemories: ${error.message}`);

  let memories: MemoryWithScore[] = (data ?? []).map(mapRow);

  // 标签过滤
  if (input.tags?.length) {
    memories = memories.filter((m) =>
      input.tags!.some((t) => m.tags.includes(t))
    );
  }

  // 关键词检索
  if (input.query) {
    const qLower = input.query.toLowerCase();
    memories = memories
      .map((m) => {
        const contentMatch = m.content.toLowerCase().includes(qLower);
        const summaryMatch = m.summary?.toLowerCase().includes(qLower) ?? false;
        const score =
          (contentMatch ? 1 : 0) +
          (summaryMatch ? 0.5 : 0) +
          importanceScore(m);
        return {
          ...m,
          relevanceScore: score,
          recallReason: contentMatch ? "keyword_match" : summaryMatch ? "summary_match" : undefined,
        } as MemoryWithScore;
      })
      .filter((m) => m.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  } else {
    memories = memories.map((m) => ({
      ...m,
      relevanceScore: importanceScore(m),
    }));
  }

  return memories;
}

/**
 * 为 AI 对话构建记忆上下文
 * 从 short_term + long_term + semantic 中检索最相关的记忆，
 * 拼装成 system prompt 可注入的文本。
 *
 * @param userId  用户 ID
 * @param query   当前用户 query（用于语义检索）
 * @param maxChars 最大注入字符数
 */
export async function buildMemoryContext(
  userId: string,
  query?: string,
  maxChars = 4_000
): Promise<string> {
  const [shortTerm, longTerm, semantic] = await Promise.all([
    getMemories(userId, "short_term", 20),
    getMemories(userId, "long_term", 10),
    query
      ? searchMemories(userId, { query, limit: 5 })
      : getMemories(userId, "semantic", 5),
  ]);

  const lines: string[] = [];
  let totalChars = 0;

  const addLine = (line: string) => {
    if (totalChars + line.length > maxChars) return false;
    lines.push(line);
    totalChars += line.length;
    return true;
  };

  // 优先级：long_term > semantic > short_term
  for (const m of longTerm) {
    if (!addLine(formatMemoryLine(m, "长期"))) break;
  }

  for (const m of semantic) {
    if (!addLine(formatMemoryLine(m, "知识"))) break;
  }

  for (const m of shortTerm.slice(0, 5)) {
    if (!addLine(formatMemoryLine(m, "短期"))) break;
  }

  if (lines.length === 0) return "";

  return `【用户记忆上下文】\n${lines.join("\n")}\n【/记忆上下文】`;
}

function formatMemoryLine(m: Memory, tierLabel: string): string {
  return `${tierLabel} | ${m.summary ?? m.content}`;
}

// DB row → Memory
function mapRow(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tier: row.tier as MemoryTier,
    content: row.content as string,
    summary: row.summary as string | undefined,
    importance: row.importance as Memory["importance"],
    tags: (row.tags as string[]) ?? [],
    source: row.source as string | undefined,
    recallCount: (row.recall_count as number) ?? 0,
    lastRecalledAt: row.last_recalled_at as string | undefined,
    expiresAt: row.expires_at as string | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

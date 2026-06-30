/**
 * 企智 QiZhi — 记忆系统类型定义
 *
 * 记忆分层模型：
 * - working   : 工作记忆（当前对话窗口，超长自动截断）
 * - short_term: 短期记忆（最近对话，自动摘要后存入）
 * - long_term : 长期记忆（用户主动或自动沉淀的重要信息）
 * - semantic  : 语义记忆（从对话中抽取的事实/知识，可被 RAG 检索）
 */

export type MemoryTier = "working" | "short_term" | "long_term" | "semantic";

export type MemoryImportance = "low" | "medium" | "high" | "critical";

export interface Memory {
  id: string;
  userId: string;
  tier: MemoryTier;
  content: string;          // 记忆文本内容
  summary?: string;         // 摘要（自动生成或用户撰写）
  importance: MemoryImportance;
  tags: string[];           // 标签，方便检索
  source?: string;          // 来源：'user' | 'agent' | 'auto_extract'
  recallCount: number;      // 被召回次数
  lastRecalledAt?: string;  // 上次召回时间
  expiresAt?: string;       // 过期时间（仅 short_term）
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryWithScore extends Memory {
  relevanceScore: number;   // RAG 检索相关性得分
  recallReason?: string;     // 被召回的原因
}

/**
 * 创建记忆的输入
 */
export interface CreateMemoryInput {
  tier: MemoryTier;
  content: string;
  summary?: string;
  importance?: MemoryImportance;
  tags?: string[];
  source?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新记忆的输入
 */
export interface UpdateMemoryInput {
  content?: string;
  summary?: string;
  importance?: MemoryImportance;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 记忆检索参数
 */
export interface SearchMemoriesInput {
  query?: string;           // 语义检索 query（启用 pg_vector 后）
  tags?: string[];
  tier?: MemoryTier;
  importance?: MemoryImportance;
  limit?: number;
  excludeIds?: string[];
}

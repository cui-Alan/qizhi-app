/**
 * 企智 Harness — 工作流执行引擎类型定义
 */

import type { WorkflowStepType, WorkflowNodeStatus } from "@/types";

// ── 步骤定义 ──
export interface StepDefinition {
  id: string;
  type: WorkflowStepType;
  label: string;
  depends_on?: string[];
  config?: Record<string, unknown>;
  /** 工具名称 (tool 类型) */
  tool?: string;
  /** 模型 ID (llm_task 类型) */
  model?: string;
  /** 提示词 (llm_task 类型) */
  prompt?: string;
  /** 条件表达式 (if 类型) */
  condition?: string;
  /** 子步骤 (parallel / for_each 类型) */
  steps?: StepDefinition[];
  /** 最大重试次数 */
  max_retries?: number;
  /** 降级步骤 ID */
  fallback_step?: string;
  /** 降级模型 */
  fallback_model?: string;
  /** 回退到哪个检查点 */
  rollback_to?: string;
}

// ── 检查点 ──
export interface Checkpoint {
  executionId: string;
  stepId: string;
  seq: number;
  input: unknown;
  output: unknown;
  contentHash: string;
  timestamp: number;
}

// ── 执行上下文 ──
export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  workflowName: string;
  steps: StepDefinition[];
  checkpoints: Map<string, Checkpoint>;
  retryCounts: Map<string, number>;
  fallbackLevels: Map<string, number>;
  qualityRetries: Map<string, number>;
  results: Map<string, StepResult>;
  variables: Record<string, unknown>;
  currentStepIndex: number;
  startedAt: number;
}

// ── 步骤结果 ──
export interface StepResult {
  stepId: string;
  status: WorkflowNodeStatus;
  output?: unknown;
  error?: string;
  durationMs: number;
  retryCount: number;
  fallbackLevel: number;
  timestamp: number;
}

// ── 执行事件 (SSE 推送) ──
export type ExecutionEvent =
  | { type: "workflow.started"; executionId: string }
  | { type: "step.started"; stepId: string; label: string }
  | { type: "step.progress"; stepId: string; progress: number }
  | { type: "step.completed"; stepId: string; result: StepResult }
  | { type: "step.failed"; stepId: string; error: string; retryCount: number }
  | { type: "step.fallback"; stepId: string; level: number; reason: string }
  | { type: "step.compensating"; stepId: string; rollbackTo: string }
  | { type: "workflow.paused"; executionId: string; atStep: string }
  | { type: "workflow.resumed"; executionId: string }
  | { type: "workflow.completed"; executionId: string; results: Map<string, StepResult> }
  | { type: "workflow.failed"; executionId: string; error: string }
  | { type: "workflow.cancelled"; executionId: string };

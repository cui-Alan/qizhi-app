/**
 * 企智 Harness — XState 5 工作流状态机
 *
 * 四级恢复: L0 重试 → L1 模型降级 → L2 工具降级 → L3 检查点回放
 */

import { createMachine, assign, fromPromise, fromCallback } from "xstate";
import type {
  StepDefinition,
  ExecutionContext,
  StepResult,
  Checkpoint,
  ExecutionEvent,
} from "./types";

// ── 构建执行计划步骤 ──
type TopoStep = StepDefinition & { _level: number };

function buildTopoOrder(steps: StepDefinition[]): TopoStep[] {
  const levels = new Map<string, number>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const step = steps.find((s) => s.id === id);
    if (!step || !step.depends_on?.length) {
      levels.set(id, 0);
      return 0;
    }
    const maxDep = Math.max(...step.depends_on.map(getLevel));
    const level = maxDep + 1;
    levels.set(id, level);
    return level;
  }

  steps.forEach((s) => getLevel(s.id));
  return steps.map((s) => ({ ...s, _level: levels.get(s.id) || 0 })).sort((a, b) => a._level - b._level);
}

// ── 检查点管理 ──
function makeCheckpoint(
  executionId: string,
  stepId: string,
  input: unknown,
  output: unknown,
  seq: number,
): Checkpoint {
  return {
    executionId,
    stepId,
    seq,
    input,
    output,
    contentHash: simpleHash(JSON.stringify(output)),
    timestamp: Date.now(),
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(16);
}

// ── 步骤执行模拟 ──
async function executeStep(step: StepDefinition, ctx: ExecutionContext): Promise<StepResult> {
  const start = Date.now();
  const retryCount = ctx.retryCounts.get(step.id) || 0;
  const fallbackLevel = ctx.fallbackLevels.get(step.id) || 0;

  try {
    // 根据步骤类型分发执行
    let output: unknown;

    switch (step.type) {
      case "start":
        output = { status: "ok", message: "工作流开始" };
        break;
      case "end":
        output = { status: "ok", message: "工作流结束" };
        break;
      case "llm_task":
        output = await executeLLMTask(step, ctx);
        break;
      case "tool":
        output = await executeToolStep(step, ctx);
        break;
      case "script":
        output = await executeScript(step, ctx);
        break;
      case "approval":
        output = await executeApproval(step, ctx);
        break;
      case "if":
      case "else":
        output = await executeConditional(step, ctx);
        break;
      case "parallel":
        output = await executeParallel(step, ctx);
        break;
      case "for_each":
        output = await executeForEach(step, ctx);
        break;
      default:
        output = await executeToolStep(step, ctx);
    }

    return {
      stepId: step.id,
      status: "completed",
      output,
      durationMs: Date.now() - start,
      retryCount,
      fallbackLevel,
      timestamp: Date.now(),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new StepExecutionError(step.id, msg, retryCount, fallbackLevel);
  }
}

class StepExecutionError extends Error {
  constructor(
    public stepId: string,
    message: string,
    public retryCount: number,
    public fallbackLevel: number,
  ) {
    super(message);
    this.name = "StepExecutionError";
  }
}

// ── 各类型步骤执行 ──
async function executeLLMTask(step: StepDefinition, ctx: ExecutionContext) {
  const model = step.model || process.env.DEFAULT_MODEL || "DeepSeek-R1-Distill-Qwen-32B-AWQ";
  const prompt = resolveVariables(step.prompt || "", ctx);

  // 调用 AI connector
  const { inference } = await import("@/lib/ai/connector");
  const result = await inference({
    model,
    messages: [
      { role: "system", content: "你是企智工作流执行引擎的 AI 步骤。" },
      { role: "user", content: prompt },
    ],
  });

  return { content: result.content, model: result.model, usage: result.usage };
}

async function executeToolStep(step: StepDefinition, ctx: ExecutionContext) {
  const toolName = step.tool || step.id;
  const config = step.config || {};

  // 模拟工具执行 — 后续可对接真实工具注册表
  return {
    tool: toolName,
    config,
    result: `工具 "${toolName}" 执行完成`,
    variables: ctx.variables,
  };
}

async function executeScript(step: StepDefinition, ctx: ExecutionContext) {
  const code = (step.config?.code as string) || "";
  // 安全限制：仅模拟执行
  return {
    script: code.slice(0, 100),
    result: "脚本模拟执行完成",
  };
}

async function executeApproval(step: StepDefinition, _ctx: ExecutionContext) {
  // 审批节点 — 发送审批事件后等待
  return {
    status: "waiting_approval",
    assigned_to: step.config?.assigned_to || "admin",
    message: "等待审批",
  };
}

async function executeConditional(step: StepDefinition, ctx: ExecutionContext) {
  const condition = resolveVariables(step.condition || "true", ctx);
  return {
    evaluated: condition,
    result: `条件 "${condition}" 求值完成`,
  };
}

async function executeParallel(step: StepDefinition, ctx: ExecutionContext) {
  const subSteps = step.steps || [];
  const results = await Promise.all(
    subSteps.map((s) => executeStep(s, ctx)),
  );
  return { parallel_results: results };
}

async function executeForEach(step: StepDefinition, ctx: ExecutionContext) {
  const items = (step.config?.items as unknown[]) || [];
  const results = [];
  for (const item of items) {
    const itemCtx = { ...ctx, variables: { ...ctx.variables, item } };
    const childType = (step.config?.child_type as string) || "tool";
    results.push(await executeStep({ ...step, type: childType as StepDefinition["type"] }, itemCtx));
  }
  return { foreach_results: results };
}

// ── 变量替换 ──
function resolveVariables(template: string, ctx: ExecutionContext): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const parts = path.split(".");
    let value: unknown = ctx.variables;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      }
    }
    return value !== undefined ? String(value) : `{{${path}}}`;
  });
}

// ── 事件发射器 ──
let eventEmitter: ((event: ExecutionEvent) => void) | null = null;

export function setEventEmitter(fn: (event: ExecutionEvent) => void) {
  eventEmitter = fn;
}

function emit(event: ExecutionEvent) {
  eventEmitter?.(event);
}

// ══════════════════════════════════════════════════
// XState 5 工作流状态机
// ══════════════════════════════════════════════════

interface MachineContext {
  execCtx: ExecutionContext | null;
  topoSteps: TopoStep[];
  currentIndex: number;
  error: string | null;
  eventQueue: ExecutionEvent[];
}

export const workflowMachine = createMachine({
  id: "qizhi-workflow",
  initial: "idle",
  context: {
    execCtx: null,
    topoSteps: [],
    currentIndex: 0,
    error: null,
    eventQueue: [],
  } as MachineContext,

  types: {} as {
    context: MachineContext;
    events:
      | { type: "START"; execCtx: ExecutionContext }
      | { type: "STEP_DONE"; result: StepResult }
      | { type: "STEP_ERROR"; error: StepExecutionError }
      | { type: "RETRY" }
      | { type: "FALLBACK" }
      | { type: "COMPENSATE" }
      | { type: "PAUSE" }
      | { type: "RESUME" }
      | { type: "CANCEL" }
      | { type: "SKIP_STEP" };
  },

  states: {
    idle: {
      on: {
        START: {
          target: "planning",
          actions: assign({
            execCtx: ({ event }) => event.execCtx,
          }),
        },
      },
    },

    planning: {
      entry: assign(({ context }) => {
        const steps = context.execCtx!.steps;
        const topoSteps = buildTopoOrder(steps);
        emit({ type: "workflow.started", executionId: context.execCtx!.executionId });
        return { topoSteps, currentIndex: 0 };
      }),
      always: "executing",
    },

    executing: {
      initial: "next_step",
      states: {
        next_step: {
          always: [
            { target: "run_step", guard: ({ context }) => context.currentIndex < context.topoSteps.length },
            { target: "#qizhi-workflow.completed" },
          ],
        },
        run_step: {
          invoke: {
            src: fromPromise(async ({ input }: { input: { step: StepDefinition; ctx: ExecutionContext } }) => {
              return executeStep(input.step, input.ctx);
            }),
            input: ({ context }) => ({
              step: context.topoSteps[context.currentIndex],
              ctx: context.execCtx!,
            }),
            onDone: {
              target: "step_success",
              actions: assign(({ event, context }) => {
                const result = event.output as StepResult;
                context.execCtx!.results.set(result.stepId, result);
                context.execCtx!.checkpoints.set(
                  result.stepId,
                  makeCheckpoint(
                    context.execCtx!.executionId,
                    result.stepId,
                    null,
                    result.output,
                    context.currentIndex,
                  ),
                );
                emit({ type: "step.completed", stepId: result.stepId, result });
                return { currentIndex: context.currentIndex + 1 } as Partial<MachineContext>;
              }),
            },
            onError: {
              target: "step_failed",
              actions: assign(({ event, context }) => {
                const err = (event.error as unknown) as StepExecutionError;
                const count = (context.execCtx!.retryCounts.get(err.stepId) || 0) + 1;
                context.execCtx!.retryCounts.set(err.stepId, count);
                emit({ type: "step.failed", stepId: err.stepId, error: err.message, retryCount: count });
                return { error: err.message } as Partial<MachineContext>;
              }),
            },
          },
        },
        step_success: {
          always: "next_step",
        },
        step_failed: {
          always: [
            { target: "retry", guard: ({ context }) => {
              const step = context.topoSteps[context.currentIndex];
              const count = context.execCtx!.retryCounts.get(step.id) || 0;
              return count < (step.max_retries || 3);
            }},
            { target: "fallback_model", guard: ({ context }) => {
              const step = context.topoSteps[context.currentIndex];
              const level = context.execCtx!.fallbackLevels.get(step.id) || 0;
              return level < 1 && !!step.fallback_model;
            }},
            { target: "fallback_tool", guard: ({ context }) => {
              const step = context.topoSteps[context.currentIndex];
              const level = context.execCtx!.fallbackLevels.get(step.id) || 0;
              return level < 2 && !!step.fallback_step;
            }},
            { target: "#qizhi-workflow.compensating" },
          ],
        },
        retry: {
          after: { 2000: "run_step" },
          entry: assign(({ context }) => {
            const step = context.topoSteps[context.currentIndex];
            const count = context.execCtx!.retryCounts.get(step.id) || 0;
            context.execCtx!.retryCounts.set(step.id, count + 1);
            return {} as Partial<MachineContext>;
          }),
        },
        fallback_model: {
          entry: assign(({ context }) => {
            const step = context.topoSteps[context.currentIndex];
            const level = (context.execCtx!.fallbackLevels.get(step.id) || 0) + 1;
            context.execCtx!.fallbackLevels.set(step.id, level);
            if (step.fallback_model) {
              step.model = step.fallback_model;
            }
            emit({ type: "step.fallback", stepId: step.id, level, reason: "模型降级" });
            return {} as Partial<MachineContext>;
          }),
          always: "run_step",
        },
        fallback_tool: {
          entry: assign(({ context }) => {
            const step = context.topoSteps[context.currentIndex];
            const level = (context.execCtx!.fallbackLevels.get(step.id) || 0) + 2;
            context.execCtx!.fallbackLevels.set(step.id, level);
            if (step.fallback_step) {
              step.tool = step.fallback_step;
            }
            emit({ type: "step.fallback", stepId: step.id, level, reason: "工具降级" });
            return {} as Partial<MachineContext>;
          }),
          always: "run_step",
        },
      },
    },

    compensating: {
      entry: assign(({ context }) => {
        const step = context.topoSteps[Math.max(0, context.currentIndex - 1)];
        const rollbackTo = step.rollback_to || context.topoSteps[0]?.id;
        const idx = context.topoSteps.findIndex((s) => s.id === rollbackTo);

        emit({ type: "step.compensating", stepId: step.id, rollbackTo });

        return { currentIndex: Math.max(0, idx) } as Partial<MachineContext>;
      }),
      always: "executing",
    },

    completed: {
      type: "final",
      entry: ({ context }) => {
        emit({
          type: "workflow.completed",
          executionId: context.execCtx!.executionId,
          results: context.execCtx!.results,
        });
      },
    },

    paused: {
      entry: ({ context }) => {
        emit({
          type: "workflow.paused",
          executionId: context.execCtx!.executionId,
          atStep: context.topoSteps[context.currentIndex]?.id || "unknown",
        });
      },
      on: { RESUME: "executing" },
    },

    cancelled: {
      type: "final",
      entry: ({ context }) => {
        emit({ type: "workflow.cancelled", executionId: context.execCtx!.executionId });
      },
    },
  },
});

// ── 工作流运行器 ──
import { createActor } from "xstate";

interface RunOptions {
  onEvent?: (event: ExecutionEvent) => void;
}

export async function runWorkflow(
  execCtx: ExecutionContext,
  options?: RunOptions,
): Promise<Map<string, StepResult>> {
  if (options?.onEvent) setEventEmitter(options.onEvent);

  return new Promise((resolve, reject) => {
    const actor = createActor(workflowMachine);

    const sub = actor.subscribe((snapshot) => {
      // 将事件队列中的事件推送出去
      const ctx = snapshot.context as MachineContext;
      if (ctx.eventQueue.length > 0 && options?.onEvent) {
        ctx.eventQueue.forEach(options.onEvent);
        ctx.eventQueue.length = 0;
      }

      if (snapshot.matches("completed")) {
        resolve(ctx.execCtx!.results);
      }
      if (snapshot.matches("cancelled")) {
        resolve(new Map());
      }
    });

    actor.start();
    actor.send({ type: "START", execCtx });
  });
}

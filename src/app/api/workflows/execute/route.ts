/**
 * 工作流执行
 * POST /api/workflows/execute — SSE 流式返回执行事件
 * 执行前写入 workflow_executions 表（status=running）
 * 执行后更新为 completed/failed
 */

import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";
import { load } from "js-yaml";
import { runWorkflow } from "@/lib/engine/workflow-machine";
import type {
  StepDefinition,
  ExecutionContext,
  ExecutionEvent,
} from "@/lib/engine/types";
import type { WorkflowNodeStatus, WorkflowStepType } from "@/types";

// POST /api/workflows/execute
export async function POST(request: NextRequest) {
  let executionId = "";
  let supabase: Awaited<ReturnType<typeof createServer>> | null = null;

  try {
    const body = await request.json();
    const { workflow_id, yaml_content, workflow_name, variables } = body;

    if (!workflow_id || !yaml_content) {
      return NextResponse.json(
        { error: "workflow_id and yaml_content are required" },
        { status: 400 }
      );
    }

    const doc = load(yaml_content) as { name?: string; steps?: StepDefinition[] };
    if (!doc?.steps?.length) {
      return NextResponse.json({ error: "工作流定义无效或没有步骤" }, { status: 400 });
    }

    executionId = crypto.randomUUID();
    supabase = await createServer();

    // 写入执行记录（pending → running）
    const { error: insertErr } = await supabase
      .from("workflow_executions")
      .insert({
        id: executionId,
        workflow_id,
        status: "running",
        started_at: new Date().toISOString(),
      });
    if (insertErr) console.warn("写入执行记录失败:", insertErr.message);

    const execCtx: ExecutionContext = {
      executionId,
      workflowId: workflow_id,
      workflowName: workflow_name || doc.name || "未命名工作流",
      steps: doc.steps.map((s) => ({
        ...s,
        type: (s.type || "tool") as WorkflowStepType,
        status: "pending" as WorkflowNodeStatus,
      })),
      checkpoints: new Map(),
      retryCounts: new Map(),
      fallbackLevels: new Map(),
      qualityRetries: new Map(),
      results: new Map(),
      variables: variables || {},
      currentStepIndex: 0,
      startedAt: Date.now(),
    };

    const encoder = new TextEncoder();
    let stepResults: Record<string, unknown> = {};

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ExecutionEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          stepResults = await runWorkflow(execCtx, { onEvent: send });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "workflow.completed", executionId, stepCount: stepResults.size })}\n\n`
            )
          );
          // 更新 DB：completed
          if (supabase) {
            await supabase
              .from("workflow_executions")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                checkpoint_data: { stepResults: Object.fromEntries(stepResults) },
              })
              .eq("id", executionId);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "workflow.failed", executionId, error: msg })}\n\n`)
          );
          // 更新 DB：failed
          if (supabase) {
            await supabase
              .from("workflow_executions")
              .update({
                status: "failed",
                completed_at: new Date().toISOString(),
                checkpoint_data: { error: msg },
              })
              .eq("id", executionId);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Execution-Id": executionId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // 清理：写入 failed 记录
    if (executionId && supabase) {
      await supabase
        .from("workflow_executions")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", executionId);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
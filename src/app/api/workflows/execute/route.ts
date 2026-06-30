import { NextRequest, NextResponse } from "next/server";
import { load } from "js-yaml";
import { runWorkflow } from "@/lib/engine/workflow-machine";
import type {
  StepDefinition,
  ExecutionContext,
  ExecutionEvent,
  StepResult,
} from "@/lib/engine/types";
import type { WorkflowNodeStatus, WorkflowStepType } from "@/types";

// POST /api/workflows/execute
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow_id, yaml_content, workflow_name, variables } = body;

    if (!workflow_id || !yaml_content) {
      return NextResponse.json(
        { error: "workflow_id and yaml_content are required" },
        { status: 400 }
      );
    }

    // 解析 YAML → 步骤列表
    const doc = load(yaml_content) as {
      name?: string;
      steps?: StepDefinition[];
    };
    if (!doc?.steps?.length) {
      return NextResponse.json(
        { error: "工作流定义无效或没有步骤" },
        { status: 400 }
      );
    }

    const executionId = `exec-${crypto.randomUUID().slice(0, 8)}`;

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

    // SSE 流式返回执行事件
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ExecutionEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          const results = await runWorkflow(execCtx, { onEvent: send });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "workflow.completed",
                executionId,
                stepCount: results.size,
              })}\n\n`
            )
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "workflow.failed",
                executionId,
                error: msg,
              })}\n\n`
            )
          );
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

"use client";

import { useState, useRef, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { NodePalette } from "@/components/workflow/NodePalette";
import { FlowCanvas } from "@/components/workflow/FlowCanvas";
import { YamlPanel } from "@/components/workflow/YamlPanel";
import { WorkflowToolbar, ExecutionLog } from "@/components/workflow/WorkflowToolbar";
import { useWorkflowStore } from "@/stores/workflow";
import type { ExecutionEvent } from "@/lib/engine/types";

export default function WorkflowPage() {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async (yaml: string) => {
    setRunning(true);
    setEvents([]);

    const workflowName = useWorkflowStore.getState().workflowName || "工作流";
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: `wf-${Date.now()}`,
          workflow_name: workflowName,
          yaml_content: yaml,
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setEvents([{ type: "workflow.failed", executionId: "", error: `HTTP ${resp.status}` }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ExecutionEvent;
            setEvents((prev) => [...prev, event]);
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setEvents((prev) => [...prev, { type: "workflow.cancelled", executionId: "" }]);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setEvents((prev) => [...prev, { type: "workflow.failed", executionId: "", error: msg }]);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <ReactFlowProvider>
        <WorkflowToolbar onRun={handleRun} onStop={handleStop} running={running} />
        <div className="flex-1 flex overflow-hidden">
          <NodePalette />
          <FlowCanvas />
          <YamlPanel />
        </div>
        <ExecutionLog events={events} />
      </ReactFlowProvider>
    </div>
  );
}

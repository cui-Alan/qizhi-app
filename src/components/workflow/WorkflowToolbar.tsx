"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/stores/workflow";
import { Play, Square, Loader2 } from "lucide-react";
import type { ExecutionEvent } from "@/lib/engine/types";

export function WorkflowToolbar({ onRun, onStop, running }: {
  onRun: (yaml: string) => void;
  onStop: () => void;
  running: boolean;
}) {
  const { yamlContent } = useWorkflowStore();

  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        工作流编辑器
      </span>
      <div className="flex items-center gap-2">
        {running ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Square size={12} />
            停止
          </button>
        ) : (
          <button
            onClick={() => onRun(yamlContent)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Play size={12} />
            运行
          </button>
        )}
      </div>
    </div>
  );
}

// ── 执行日志面板 ──
export function ExecutionLog({ events }: { events: ExecutionEvent[] }) {
  if (events.length === 0) return null;

  const statusIcon = (e: ExecutionEvent) => {
    switch (e.type) {
      case "step.completed": return "✅";
      case "step.failed": return "❌";
      case "step.fallback": return "🔄";
      case "step.compensating": return "↩️";
      case "workflow.completed": return "🎉";
      case "workflow.failed": return "💥";
      default: return "⏳";
    }
  };

  return (
    <div className="h-48 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
      <div className="p-3 font-mono text-xs space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="shrink-0">{statusIcon(e)}</span>
            <span>
              {e.type === "step.completed" && `${e.stepId}: ${(e.result.durationMs / 1000).toFixed(1)}s`}
              {e.type === "step.failed" && `${e.stepId}: ${e.error}`}
              {e.type === "step.fallback" && `${e.stepId}: 降级 L${e.level}`}
              {e.type === "step.compensating" && `回退到 ${e.rollbackTo}`}
              {e.type === "workflow.started" && `🚀 开始执行`}
              {e.type === "workflow.completed" && `完成`}
              {e.type === "workflow.failed" && e.error}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

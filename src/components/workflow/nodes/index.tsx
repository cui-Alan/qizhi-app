"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Wrench,
  Brain,
  GitBranch,
  Repeat,
  Split,
  UserCheck,
  Code,
  Play,
  Square,
} from "lucide-react";

const nodeConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  start: { icon: Play, color: "text-green-600", bg: "bg-green-50 border-green-300" },
  end: { icon: Square, color: "text-red-600", bg: "bg-red-50 border-red-300" },
  tool: { icon: Wrench, color: "text-sky-600", bg: "bg-sky-50 border-sky-300" },
  llm_task: { icon: Brain, color: "text-purple-600", bg: "bg-purple-50 border-purple-300" },
  if: { icon: GitBranch, color: "text-amber-600", bg: "bg-amber-50 border-amber-300" },
  else: { icon: GitBranch, color: "text-gray-600", bg: "bg-gray-50 border-gray-300" },
  for_each: { icon: Repeat, color: "text-blue-600", bg: "bg-blue-50 border-blue-300" },
  parallel: { icon: Split, color: "text-teal-600", bg: "bg-teal-50 border-teal-300" },
  approval: { icon: UserCheck, color: "text-orange-600", bg: "bg-orange-50 border-orange-300" },
  script: { icon: Code, color: "text-pink-600", bg: "bg-pink-50 border-pink-300" },
  sub_workflow: { icon: Split, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-300" },
};

type WorkflowNodeData = Record<string, unknown> & {
  label?: string;
  description?: string;
  status?: string;
};

export const WorkflowNode = memo(({ data, type }: NodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const config = nodeConfig[type || "tool"] || nodeConfig.tool;
  const Icon = config.icon;

  const statusColors: Record<string, string> = {
    running: "ring-2 ring-blue-400 animate-pulse",
    completed: "ring-2 ring-green-400",
    failed: "ring-2 ring-red-400",
    waiting: "ring-2 ring-amber-400",
  };

  const ring = statusColors[nodeData.status as string] || "";

  return (
    <div
      className={`relative min-w-[140px] rounded-xl border-2 ${config.bg} ${ring} px-4 py-3 shadow-sm transition-shadow hover:shadow-md`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <Icon size={16} className={config.color} />
        <span className="text-sm font-medium text-zinc-700 truncate max-w-[120px]">
          {nodeData.label as string}
        </span>
      </div>
      {nodeData.description && (
        <p className="text-xs text-zinc-400 mt-1 truncate max-w-[140px]">
          {nodeData.description as string}
        </p>
      )}
      {nodeData.status && nodeData.status !== "pending" && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              nodeData.status === "running"
                ? "bg-blue-500 animate-pulse"
                : nodeData.status === "completed"
                  ? "bg-green-500"
                  : nodeData.status === "failed"
                    ? "bg-red-500"
                    : "bg-amber-500"
            }`}
          />
          <span className="text-[10px] text-zinc-400">{nodeData.status as string}</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-zinc-400 !border-2 !border-white"
      />
    </div>
  );
});

WorkflowNode.displayName = "WorkflowNode";

export const nodeTypes = {
  start: WorkflowNode,
  end: WorkflowNode,
  tool: WorkflowNode,
  llm_task: WorkflowNode,
  if: WorkflowNode,
  else: WorkflowNode,
  for_each: WorkflowNode,
  parallel: WorkflowNode,
  approval: WorkflowNode,
  script: WorkflowNode,
  sub_workflow: WorkflowNode,
};

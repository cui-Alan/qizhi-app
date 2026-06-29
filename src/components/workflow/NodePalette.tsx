"use client";

import { type DragEvent } from "react";
import {
  Play,
  Square,
  Wrench,
  Brain,
  GitBranch,
  Repeat,
  Split,
  UserCheck,
  Code,
} from "lucide-react";

const paletteItems = [
  { type: "start", label: "开始", icon: Play, color: "text-green-600" },
  { type: "end", label: "结束", icon: Square, color: "text-red-600" },
  { type: "llm_task", label: "LLM 任务", icon: Brain, color: "text-purple-600" },
  { type: "tool", label: "工具调用", icon: Wrench, color: "text-sky-600" },
  { type: "for_each", label: "循环", icon: Repeat, color: "text-blue-600" },
  { type: "if", label: "条件判断", icon: GitBranch, color: "text-amber-600" },
  { type: "parallel", label: "并行执行", icon: Split, color: "text-teal-600" },
  { type: "approval", label: "人工审批", icon: UserCheck, color: "text-orange-600" },
  { type: "script", label: "脚本", icon: Code, color: "text-pink-600" },
];

export function NodePalette() {
  const onDragStart = (e: DragEvent<HTMLDivElement>, nodeType: string) => {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-48 shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        节点类型
      </h3>
      <div className="space-y-1">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
          >
            <item.icon size={15} className={item.color} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

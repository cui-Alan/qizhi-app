"use client";

import { useState } from "react";
import { Clock, Webhook, Zap, Plus, Play, Pause, Trash2 } from "lucide-react";

const automations = [
  { id: "1", name: "每日工作摘要", trigger: "schedule", schedule: "0 9 * * 1-5", workflow: "日报生成", status: "active", lastRun: "2026-06-30 09:00" },
  { id: "2", name: "GitHub Issue 同步", trigger: "webhook", workflow: "Issue跟踪", status: "active", lastRun: "2026-06-29 18:30" },
  { id: "3", name: "周报自动生成", trigger: "schedule", schedule: "0 17 * * 5", workflow: "周报模板", status: "paused", lastRun: "2026-06-27 17:00" },
];

const triggerIcon: Record<string, React.ElementType> = { schedule: Clock, webhook: Webhook, event: Zap };

export default function AutomationPage() {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">自动化</h1>
          <p className="text-sm text-zinc-500">定时任务 · Webhook 触发 · 事件驱动</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> 新建
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {automations.map(a => {
            const Icon = triggerIcon[a.trigger] || Clock;
            return (
              <div key={a.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.trigger === "schedule" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{a.name}</h3>
                      <p className="text-xs text-zinc-500">{a.workflow}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-zinc-100"><Play size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-zinc-100"><Pause size={14} /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                    {a.status === "active" ? "运行中" : "已暂停"}
                  </span>
                  {a.schedule && <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-xs">{a.schedule}</code>}
                  <span className="ml-auto">上次: {a.lastRun}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

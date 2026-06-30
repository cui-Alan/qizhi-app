"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Execution {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  checkpointData: Record<string, unknown> | null;
}

const PAGE_SIZE = 20;

export default function WorkflowHistoryPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const fetchHistory = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/workflows/history?limit=${PAGE_SIZE}&offset=${off}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setExecutions(data.executions || []);
      setTotal(data.total ?? 0);
      setOffset(off);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(0); }, [fetchHistory]);

  const statusBadge = (s: Execution["status"]) => {
    const map: Record<string, string> = {
      pending: "bg-zinc-100 text-zinc-500",
      running: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      pending: "等待中",
      running: "执行中",
      completed: "已完成",
      failed: "失败",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] ?? ""}`}>{labels[s] ?? s}</span>;
  };

  const formatTime = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">执行历史</h1>
        <Link
          href="/workflow"
          className="text-sm text-zinc-500 hover:text-zinc-800 underline"
        >
          返回编辑器
        </Link>
      </div>

      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}

      {!loading && !error && executions.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-4xl mb-2">📋</p>
          <p>暂无执行记录</p>
          <Link href="/workflow" className="text-blue-500 hover:underline text-sm mt-2 inline-block">
            去创建一个工作流
          </Link>
        </div>
      )}

      {!loading && !error && executions.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left">
                  <th className="pb-2 font-medium text-zinc-500">ID</th>
                  <th className="pb-2 font-medium text-zinc-500">工作流</th>
                  <th className="pb-2 font-medium text-zinc-500">状态</th>
                  <th className="pb-2 font-medium text-zinc-500">开始时间</th>
                  <th className="pb-2 font-medium text-zinc-500">耗时</th>
                  <th className="pb-2 font-medium text-zinc-500">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {executions.map((exec) => {
                  const start = new Date(exec.startedAt).getTime();
                  const end = exec.completedAt ? new Date(exec.completedAt).getTime() : Date.now();
                  const duration = exec.status === "running"
                    ? `${Math.round((Date.now() - start) / 1000)}s`
                    : exec.status === "completed"
                    ? `${Math.round((end - start) / 1000)}s`
                    : "—";

                  return (
                    <tr key={exec.id} className="hover:bg-zinc-50">
                      <td className="py-2.5 font-mono text-xs text-zinc-400">{exec.id.slice(0, 8)}</td>
                      <td className="py-2.5 text-zinc-700">{exec.workflowId || "—"}</td>
                      <td className="py-2.5">{statusBadge(exec.status)}</td>
                      <td className="py-2.5 text-zinc-500">{formatTime(exec.startedAt)}</td>
                      <td className="py-2.5 text-zinc-500 font-mono text-xs">{duration}</td>
                      <td className="py-2.5 text-zinc-500 text-xs">
                        {exec.status === "failed" && exec.checkpointData?.error
                          ? String(exec.checkpointData.error).slice(0, 40)
                          : exec.status === "completed"
                          ? `${Object.keys(exec.checkpointData || {}).length} 个步骤`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-zinc-400">
                共 {total} 条，第 {currentPage}/{totalPages} 页
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchHistory(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => fetchHistory(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
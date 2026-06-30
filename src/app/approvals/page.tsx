"use client";

import { useState, useEffect, useCallback } from "react";

interface Approval {
  id: string;
  execution_id: string;
  step_id: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  assigned_to: string;
  comment: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});

  const fetchApprovals = useCallback(async () => {
    try {
      const resp = await fetch("/api/approvals");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setApprovals(data.approvals || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    try {
      const resp = await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: commentMap[id] || undefined }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchApprovals();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setProcessing(null);
    }
  };

  const filtered = approvals.filter(a =>
    filter === "all" ? true : a.status === filter
  );

  const statusBadge = (s: Approval["status"]) => {
    const map = {
      pending: "bg-amber-100 text-amber-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const labels = { pending: "待审批", approved: "已通过", rejected: "已拒绝" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s]}`}>{labels[s]}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">审批管理</h1>
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f === "all" ? "全部" : f === "pending" ? "待审批" : f === "approved" ? "已通过" : "已拒绝"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-zinc-400 text-center py-8">暂无审批记录</p>
      )}

      <div className="space-y-3">
        {filtered.map(approval => (
          <div
            key={approval.id}
            className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-zinc-400">{approval.id.slice(0, 8)}</span>
                  {statusBadge(approval.status)}
                </div>
                <p className="text-sm text-zinc-700 font-medium">
                  {(approval.metadata as Record<string, unknown>)?.workflowName as string || "工作流"} / 节点 {(approval.metadata as Record<string, unknown>)?.nodeId as string || approval.step_id}
                </p>
                {approval.comment && (
                  <p className="text-xs text-zinc-500 mt-1 italic">"{approval.comment}"</p>
                )}
                <p className="text-xs text-zinc-400 mt-1">
                  {new Date(approval.created_at).toLocaleString("zh-CN")} · 申请人: {approval.requested_by}
                </p>
              </div>

              {approval.status === "pending" && (
                <div className="flex flex-col gap-2 w-48">
                  <textarea
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none"
                    rows={2}
                    placeholder="备注（可选）"
                    value={commentMap[approval.id] || ""}
                    onChange={e => setCommentMap(prev => ({ ...prev, [approval.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(approval.id, "approve")}
                      disabled={processing === approval.id}
                      className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === approval.id ? "处理中..." : "通过"}
                    </button>
                    <button
                      onClick={() => handleAction(approval.id, "reject")}
                      disabled={processing === approval.id}
                      className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              )}

              {approval.status !== "pending" && (
                <div className="text-right">
                  {approval.resolved_by && (
                    <p className="text-xs text-zinc-400">
                      {approval.status === "approved" ? "通过" : "拒绝"} by {approval.resolved_by}
                    </p>
                  )}
                  {approval.resolved_at && (
                    <p className="text-xs text-zinc-400">
                      {new Date(approval.resolved_at).toLocaleString("zh-CN")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
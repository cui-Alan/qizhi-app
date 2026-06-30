"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import {
  Users, Activity, Zap, CreditCard,
  UserPlus, Shield, Search, Loader2,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  last_active_at: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load real users
        const uResp = await fetch("/api/admin/users");
        if (uResp.ok) {
          const data = await uResp.json();
          setUsers(data.users || []);
        }
        // Load audit logs
        const aResp = await fetch("/api/admin/audit-logs?limit=20");
        if (aResp.ok) {
          const data = await aResp.json();
          setAuditLogs(data.logs || []);
        }
      } catch { /* use empty */ }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = users.filter(u =>
    !search || u.email.includes(search) || (u.full_name || "").includes(search)
  );

  const stats = {
    total: users.length,
    active: users.length,
    admins: users.filter(u => u.role === "owner" || u.role === "admin").length,
    users: users.filter(u => u.role === "user").length,
  };

  if (!user || (user.role !== "owner" && user.role !== "super_admin" && user.role !== "admin")) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        仅管理员可访问
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">管理后台</h1>
          <p className="text-sm text-zinc-500">用户管理 · 运营概览</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        {[
          { label: "总用户", value: stats.total, icon: Users, color: "text-blue-600" },
          { label: "活跃", value: stats.active, icon: Activity, color: "text-green-600" },
          { label: "管理员", value: stats.admins, icon: Shield, color: "text-purple-600" },
          { label: "普通用户", value: stats.users, icon: Zap, color: "text-orange-600" },
        ].map(s => (
          <div key={s.label} className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <s.icon size={20} className={s.color} />
              <div>
                <div className="text-2xl font-bold">{loading ? "-" : s.value}</div>
                <div className="text-xs text-zinc-400">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-3 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索用户..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left px-6 py-2 font-medium">用户</th>
                  <th className="text-left px-6 py-2 font-medium">角色</th>
                  <th className="text-left px-6 py-2 font-medium">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-6 py-2.5">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{u.full_name || u.email.split("@")[0]}</div>
                      <div className="text-xs text-zinc-400">{u.email}</div>
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        u.role === "owner" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-6 py-2.5 text-zinc-400 text-xs">
                      {u.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Audit sidebar */}
        <div className="w-72 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto shrink-0">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-500">
            操作日志
          </div>
          <div className="p-3 space-y-2">
            {auditLogs.slice(0, 15).map(log => (
              <div key={log.id} className="text-xs">
                <div className="text-zinc-600 dark:text-zinc-400">{log.action}</div>
                <div className="text-zinc-400 mt-0.5">{log.created_at?.slice(0, 19)}</div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="text-xs text-zinc-400 py-6 text-center">暂无日志</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

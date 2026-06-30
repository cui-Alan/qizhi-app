"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import {
  Users,
  Activity,
  Zap,
  CreditCard,
  UserPlus,
  Shield,
  Ban,
  MoreHorizontal,
  Search,
} from "lucide-react";

// Mock user data
const mockUsers = [
  { id: "1", name: "张三", email: "zhangsan@qizhi.chat", role: "admin", status: "active", created: "2026-06-15" },
  { id: "2", name: "李四", email: "lisi@qizhi.chat", role: "user", status: "active", created: "2026-06-20" },
  { id: "3", name: "王五", email: "wangwu@qizhi.chat", role: "user", status: "active", created: "2026-06-22" },
  { id: "4", name: "赵六", email: "zhaoliu@qizhi.chat", role: "viewer", status: "active", created: "2026-06-25" },
  { id: "5", name: "孙七", email: "sunqi@qizhi.chat", role: "user", status: "inactive", created: "2026-06-28" },
];

const auditLogs = [
  { id: "1", user: "张三", action: "创建用户 李四", time: "2026-06-20 14:30" },
  { id: "2", user: "张三", action: "修改模型配置", time: "2026-06-22 09:15" },
  { id: "3", user: "李四", action: "创建工作流「日报生成」", time: "2026-06-23 16:00" },
  { id: "4", user: "张三", action: "停用用户 孙七", time: "2026-06-28 10:00" },
  { id: "5", user: "李四", action: "上传文档到知识库", time: "2026-06-29 11:45" },
];

const stats = [
  { label: "用户数", value: "5", icon: Users, color: "text-blue-600" },
  { label: "今日执行", value: "128", icon: Activity, color: "text-green-600" },
  { label: "API 消耗", value: "¥3.47", icon: Zap, color: "text-amber-600" },
  { label: "活跃模型", value: "3", icon: CreditCard, color: "text-purple-600" },
];

export default function AdminPage() {
  const { user } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  const filtered = mockUsers.filter((u) =>
    u.name.includes(search) || u.email.includes(search),
  );

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            管理后台
          </h1>
          <p className="text-xs text-zinc-500">
            当前: {user?.name} · {user?.role === "super_admin" ? "超级管理员" : "管理员"}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={14} /> 开通账号
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">{s.label}</span>
                <s.icon size={16} className={s.color} />
              </div>
              <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          {(["users", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`text-sm pb-2 -mb-2 border-b-2 transition-colors ${
                activeTab === t
                  ? "border-blue-600 text-blue-600 font-medium"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {t === "users" ? "用户管理" : "操作日志"}
            </button>
          ))}
        </div>

        {/* Users table */}
        {activeTab === "users" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <Search size={14} className="text-zinc-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索用户..."
                className="text-sm bg-transparent outline-none flex-1"
              />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 px-4 font-medium">用户</th>
                  <th className="py-2 px-4 font-medium hidden md:table-cell">角色</th>
                  <th className="py-2 px-4 font-medium hidden md:table-cell">状态</th>
                  <th className="py-2 px-4 font-medium hidden md:table-cell">创建</th>
                  <th className="py-2 px-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                        {u.name}
                      </div>
                      <div className="text-xs text-zinc-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
                          u.role === "admin"
                            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        <Shield size={11} />
                        {u.role === "admin" ? "管理员" : u.role === "viewer" ? "观察者" : "用户"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 hidden md:table-cell">
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${
                          u.status === "active"
                            ? "text-green-600"
                            : "text-zinc-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === "active" ? "bg-green-500" : "bg-zinc-300"
                          }`}
                        />
                        {u.status === "active" ? "活跃" : "已停用"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500 hidden md:table-cell text-xs">
                      {u.created}
                    </td>
                    <td className="py-2.5 px-4">
                      <button className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700">
                        <MoreHorizontal size={14} className="text-zinc-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit log */}
        {activeTab === "audit" && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {auditLogs.map((log, i) => (
              <div
                key={log.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < auditLogs.length - 1
                    ? "border-b border-zinc-100 dark:border-zinc-800"
                    : ""
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 text-sm">
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {log.user}
                  </span>{" "}
                  <span className="text-zinc-500">{log.action}</span>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{log.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add user modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              开通账号
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">姓名</label>
                <input className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">邮箱</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">角色</label>
                <select className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 outline-none">
                  <option>user - 普通用户</option>
                  <option>admin - 管理员</option>
                  <option>viewer - 观察者</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                确认开通
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

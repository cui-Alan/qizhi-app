"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { Memory, MemoryTier, MemoryImportance } from "@/lib/memory/types";

const settingsMap: Record<string, { title: string; icon: string; desc: string }> = {
  account: { title: "账户管理", icon: "👤", desc: "账号信息 · 订阅管理 · 切换租户" },
  appearance: { title: "外观", icon: "🎨", desc: "主题 · 字体大小 · 浅色/深色模式" },
  system: { title: "系统设置", icon: "⚙️", desc: "语言 · 通知 · 启动项" },
  agent: { title: "智能体设置", icon: "🤖", desc: "Agent 人格 · 默认行为 · 对话风格" },
  memory: { title: "记忆", icon: "🧠", desc: "记忆层级配置 · 遗忘策略" },
  models: { title: "模型", icon: "🧩", desc: "模型接入管理 · OpenAI/Claude/oMLX" },
  personalization: { title: "个性化", icon: "✨", desc: "快捷指令 · 模板管理" },
  data: { title: "数据管理", icon: "📊", desc: "导出/导入 · 缓存清理 · 历史记录" },
  security: { title: "安全中心", icon: "🔒", desc: "密码修改 · 双因素 · 登录日志" },
  help: { title: "帮助与反馈", icon: "❓", desc: "使用文档 · 联系客服 · 问题反馈" },
};

// ── 记忆设置面板 ─────────────────────────────────────────
function MemorySettings() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterTier, setFilterTier] = useState<MemoryTier | "all">("all");

  // 创建表单状态
  const [form, setForm] = useState({
    content: "",
    tier: "short_term" as MemoryTier,
    importance: "medium" as MemoryImportance,
    tags: "",
    summary: "",
  });

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterTier === "all"
        ? "/api/memory"
        : `/api/memory?tier=${filterTier}`;
      const res = await fetch(url);
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [filterTier]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;

    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: form.content,
        tier: form.tier,
        importance: form.importance,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        summary: form.summary,
        source: "user",
      }),
    });

    if (res.ok) {
      setForm({ content: "", tier: "short_term", importance: "medium", tags: "", summary: "" });
      setShowCreate(false);
      fetchMemories();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条记忆？")) return;
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    fetchMemories();
  };

  const tierLabel: Record<MemoryTier, string> = {
    working: "工作",
    short_term: "短期",
    long_term: "长期",
    semantic: "知识",
  };

  const tierColor: Record<MemoryTier, string> = {
    working: "bg-blue-100 text-blue-700",
    short_term: "bg-green-100 text-green-700",
    long_term: "bg-purple-100 text-purple-700",
    semantic: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">🧠 记忆管理</h2>
          <p className="text-sm text-zinc-500 mt-1">管理你的短期、长期和知识记忆</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          + 添加记忆
        </button>
      </div>

      {/* 过滤器 */}
      <div className="flex gap-2 mb-4">
        {(["all", "short_term", "long_term", "semantic"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterTier(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filterTier === t
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t === "all" ? "全部" : tierLabel[t]}
          </button>
        ))}
      </div>

      {/* 新建表单 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 mb-4 space-y-3 border border-zinc-200 dark:border-zinc-800">
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="写下你想记住的内容…"
            rows={3}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 flex-wrap">
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as MemoryTier })}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
            >
              <option value="short_term">短期</option>
              <option value="long_term">长期</option>
              <option value="semantic">知识</option>
            </select>
            <select
              value={form.importance}
              onChange={(e) => setForm({ ...form, importance: e.target.value as MemoryImportance })}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
            >
              <option value="low">低重要</option>
              <option value="medium">中重要</option>
              <option value="high">高重要</option>
              <option value="critical">关键</option>
            </select>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="标签，逗号分隔"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
            />
          </div>
          <input
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="摘要（可选，帮助快速回忆）"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700">取消</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">保存</button>
          </div>
        </form>
      )}

      {/* 记忆列表 */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-sm">加载中…</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <div className="text-4xl mb-2">🧠</div>
          <p className="text-sm">还没有记忆，添加一条开始吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((m) => (
            <div key={m.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColor[m.tier]}`}>
                      {tierLabel[m.tier]}
                    </span>
                    <span className="text-xs text-zinc-400">重要度: {m.importance}</span>
                    {m.tags.length > 0 && (
                      m.tags.map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-500">#{tag}</span>
                      ))
                    )}
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{m.content}</p>
                  {m.summary && (
                    <p className="text-xs text-zinc-400 mt-1 italic">摘要: {m.summary}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded transition"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主设置页 ─────────────────────────────────────────────
export default function SettingsPage() {
  const params = useParams();
  const section = params.section as string;
  const info = settingsMap[section] || {
    title: "设置",
    icon: "⚙️",
    desc: "选择左侧设置项",
  };

  if (section === "memory") return <MemorySettings />;

  return (
    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
      <div className="text-6xl mb-4">{info.icon}</div>
      <h2 className="text-xl font-medium text-zinc-700 dark:text-zinc-300">{info.title}</h2>
      <p className="text-sm mt-2">{info.desc}</p>
    </div>
  );
}

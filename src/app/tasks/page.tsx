"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2, Circle, Clock, Plus, Trash2, AlertCircle,
  LayoutList, LayoutGrid, Search,
} from "lucide-react";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
}

const PRIORITY_LABEL: Record<Priority, string> = { low: "低", medium: "中", high: "高" };
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "text-zinc-400 bg-zinc-100",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  high: "text-red-600 bg-red-50 border-red-200",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" as Priority, due_date: "" });
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("tasks").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setTasks(data ?? []);
    } catch { setLoading(false); return; }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("tasks").insert({
        user_id: user.id, title: form.title,
        description: form.description || null,
        priority: form.priority, due_date: form.due_date || null,
        status: "todo",
      });
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
      setShowForm(false);
      await fetchTasks();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally { setSaving(false); }
  };

  const updateStatus = async (task: Task, newStatus: Status) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const deleteTask = async (id: string) => {
    if (!confirm("删除这条任务？")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filtered = tasks.filter(t => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countBy = (s: Status) => tasks.filter(t => t.status === s).length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
          <LayoutList size={24} /> 任务 <span className="text-sm font-normal text-zinc-400">({tasks.length})</span>
        </h1>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700">
          <Plus size={16} /> 新建任务
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="任务标题" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="描述（可选）" rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none" />
          <div className="flex gap-3 items-center">
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm">
              <option value="low">低优先级</option><option value="medium">中优先级</option><option value="high">高优先级</option>
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={createTask} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-200 text-zinc-600 rounded-lg text-sm hover:bg-zinc-300">取消</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索任务..." className="w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-lg text-sm" />
        </div>
        <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
          {(["all", "todo", "in_progress", "done"] as const).map(k => (
            <button key={k} onClick={() => setFilter(k as typeof filter)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === k ? "bg-white shadow text-zinc-800" : "text-zinc-500 hover:text-zinc-700"}`}>
              {k === "all" ? "全部" : k === "todo" ? "待办" : k === "in_progress" ? "进行中" : "已完成"}
              {k !== "all" && <span className="ml-1 text-zinc-400">({countBy(k as Status)})</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setView(v => v === "list" ? "grid" : "list")}
          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500">
          {view === "list" ? <LayoutGrid size={18} /> : <LayoutList size={18} />}
        </button>
      </div>

      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" /><p>暂无任务</p>
        </div>
      )}

      <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
        {filtered.map(task => (
          <div key={task.id}
            className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow ${task.status === "done" ? "border-zinc-100 opacity-60" : "border-zinc-200"}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => updateStatus(task, task.status === "done" ? "todo" : "done")} className="mt-0.5 shrink-0">
                {task.status === "done"
                  ? <CheckCircle2 size={20} className="text-green-500" />
                  : <Circle size={20} className="text-zinc-300 hover:text-zinc-500" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-800"}`}>{task.title}</p>
                {task.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{task.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[task.priority]}`}>{PRIORITY_LABEL[task.priority]}</span>
                  {task.due_date && <span className="flex items-center gap-1 text-xs text-zinc-400"><Clock size={12} />{task.due_date}</span>}
                </div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="text-zinc-300 hover:text-red-500 shrink-0"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

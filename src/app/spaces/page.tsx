"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Users, Shield, Layers, Trash2, Check } from "lucide-react";

interface Space {
  id: string;
  name: string;
  description: string | null;
  role: string;
  member_count: number;
  created_at: string;
}

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("spaces").select(`
          id, name, description, role, created_at,
          space_members(count)
        `).eq("owner_id", user.id).order("created_at", { ascending: false });
      setSpaces(data?.map(s => ({
        ...s,
        role: s.role ?? "admin",
        member_count: (s as any).space_members?.[0]?.count ?? 1,
      })) ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSpaces(); }, []);

  const createSpace = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("spaces").insert({
        name: form.name,
        description: form.description || null,
        owner_id: user.id,
        role: "admin",
      });
      setForm({ name: "", description: "" });
      setShowCreate(false);
      await fetchSpaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally { setSaving(false); }
  };

  const deleteSpace = async (id: string) => {
    if (!confirm("删除该空间？")) return;
    const supabase = createClient();
    await supabase.from("spaces").delete().eq("id", id);
    setSpaces(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
            <Layers size={24} /> 空间
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">多租户 · 团队协作 · 数据隔离</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700">
          <Plus size={16} /> 创建空间
        </button>
      </div>

      {showCreate && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="空间名称" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="空间描述（可选）" rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={createSpace} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "创建中..." : "创建"}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-zinc-200 text-zinc-600 rounded-lg text-sm hover:bg-zinc-300">取消</button>
          </div>
        </div>
      )}

      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {!loading && spaces.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <Layers size={32} className="mx-auto mb-2 opacity-50" />
          <p>暂无空间，点击上方创建第一个空间</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {spaces.map(s => (
          <div key={s.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Layers size={20} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-zinc-800 text-sm truncate">{s.name}</h3>
                  <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                    <Shield size={10} />{s.role}
                  </span>
                </div>
                {s.description && <p className="text-xs text-zinc-500 truncate">{s.description}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Users size={12} /> {s.member_count} 成员
              </span>
              <button onClick={() => deleteSpace(s.id)}
                className="text-zinc-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

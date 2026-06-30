"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lightbulb, Plus, Trash2, Heart, Search, AlertCircle } from "lucide-react";

interface Inspiration {
  id: string;
  title: string;
  content: string;
  tags: string[];
  liked: boolean;
  created_at: string;
}

export default function InspirationPage() {
  const [items, setItems] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "" });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("inspirations").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems(data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const createItem = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      await supabase.from("inspirations").insert({
        user_id: user.id, title: form.title, content: form.content, tags, liked: false,
      });
      setForm({ title: "", content: "", tags: "" });
      setShowForm(false);
      await fetchItems();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally { setSaving(false); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("删除这条灵感？")) return;
    const supabase = createClient();
    await supabase.from("inspirations").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const toggleLike = async (item: Inspiration) => {
    const supabase = createClient();
    await supabase.from("inspirations").update({ liked: !item.liked }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, liked: !i.liked } : i));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
          <Lightbulb size={24} /> 灵感库 <span className="text-sm font-normal text-zinc-400">({items.length})</span>
        </h1>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700">
          <Plus size={16} /> 记录灵感
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="灵感标题" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="详细记录..." rows={4} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none" />
          <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="标签（逗号分隔，如：产品,创意,技术）" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={createItem} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-200 text-zinc-600 rounded-lg text-sm hover:bg-zinc-300">取消</button>
          </div>
        </div>
      )}

      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" /><p>暂无灵感记录</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.id} className="bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-zinc-800 text-sm">{item.title}</h3>
              <button onClick={() => deleteItem(item.id)} className="text-zinc-300 hover:text-red-500 shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-xs text-zinc-600 line-clamp-4 mb-3">{item.content}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag => (
                  <span key={tag} className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">{tag}</span>
                ))}
              </div>
              <button onClick={() => toggleLike(item)}
                className={`text-sm ${item.liked ? "text-red-500" : "text-zinc-300 hover:text-red-400"}`}>
                <Heart size={16} fill={item.liked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

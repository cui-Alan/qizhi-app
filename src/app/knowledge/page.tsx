"use client";

import { useState, useEffect, useCallback } from "react";

interface Document {
  id: string;
  title: string;
  source: "upload" | "obsidian" | "url" | "feishu";
  file_type: string | null;
  content_preview: string | null;
  chunk_count: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

type FilterSource = "all" | "upload" | "obsidian" | "url" | "feishu";

export default function KnowledgePage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterSource>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ doc_id: string; chunk_text: string; similarity: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all"
        ? "/api/knowledge"
        : `/api/knowledge?source=${filter}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setDocs(data.documents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (title: string, content: string) => {
    setUploading(true);
    try {
      const resp = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchDocs();
      setShowUpload(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, top_k: 10 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSearchResults(data.results || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这篇文档？")) return;
    try {
      const resp = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await fetchDocs();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const sourceIcon = (s: Document["source"]) => {
    const map: Record<string, string> = {
      upload: "📤", obsidian: "📁", url: "🔗", feishu: "💬",
    };
    return map[s] ?? "📄";
  };

  const sourceLabel: Record<string, string> = {
    upload: "上传", obsidian: "Obsidian", url: "链接", feishu: "飞书",
  };

  const filtered = docs.filter(d =>
    !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">知识库</h1>
        <button
          onClick={() => setShowUpload(s => !s)}
          className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700"
        >
          {showUpload ? "取消上传" : "＋ 上传文档"}
        </button>
      </div>

      {/* 上传表单 */}
      {showUpload && (
        <UploadForm onSubmit={handleUpload} uploading={uploading} />
      )}

      {/* 搜索栏 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="搜索知识库..."
          className="flex-1 border border-zinc-300 rounded-lg px-4 py-2 text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? "搜索中..." : "搜索"}
        </button>
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium text-zinc-700 text-sm">搜索结果 ({searchResults.length})</h2>
          {searchResults.map((r, i) => (
            <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="text-zinc-700">{r.chunk_text.slice(0, 200)}{r.chunk_text.length > 200 ? "..." : ""}</p>
              <p className="text-xs text-blue-500 mt-1">相似度 {Math.round(r.similarity * 100)}%</p>
            </div>
          ))}
        </div>
      )}

      {/* 筛选 */}
      <div className="flex gap-2">
        {(["all", "upload", "obsidian", "url", "feishu"] as FilterSource[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f === "all" ? "全部" : sourceLabel[f]}
          </button>
        ))}
      </div>

      {/* 文档列表 */}
      {loading && <p className="text-zinc-400 text-center py-8">加载中...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-zinc-400 text-center py-8">暂无文档</p>
      )}

      <div className="space-y-2">
        {filtered.map(doc => (
          <div key={doc.id} className="bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{sourceIcon(doc.source)}</span>
                  <span className="font-medium text-zinc-800 truncate">{doc.title}</span>
                  <span className="text-xs text-zinc-400 border border-zinc-200 px-1.5 py-0.5 rounded">
                    {sourceLabel[doc.source] ?? doc.source}
                  </span>
                </div>
                {doc.content_preview && (
                  <p className="text-sm text-zinc-500 line-clamp-2">{doc.content_preview}</p>
                )}
                <p className="text-xs text-zinc-400 mt-1">
                  {doc.chunk_count} 个片段 · {new Date(doc.created_at).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-zinc-400 hover:text-red-500 text-sm shrink-0"
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 上传表单组件
function UploadForm({ onSubmit, uploading }: { onSubmit: (title: string, content: string) => void; uploading: boolean }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"text" | "file">("text");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTitle(file.name.replace(/\.(md|txt|pdf|docx)$/i, ""));
      setContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("text")}
          className={`px-3 py-1 rounded-lg text-sm ${mode === "text" ? "bg-zinc-800 text-white" : "bg-zinc-200"}`}
        >
          文本输入
        </button>
        <button
          onClick={() => setMode("file")}
          className={`px-3 py-1 rounded-lg text-sm ${mode === "file" ? "bg-zinc-800 text-white" : "bg-zinc-200"}`}
        >
          文件上传
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="文档标题"
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm"
      />

      {mode === "text" ? (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="粘贴文档内容..."
          rows={6}
          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none"
        />
      ) : (
        <input
          type="file"
          accept=".md,.txt,.pdf,.docx"
          onChange={handleFile}
          className="text-sm text-zinc-600"
        />
      )}

      <button
        onClick={() => title && content && onSubmit(title, content)}
        disabled={uploading || !title || !content}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "上传中..." : "确认上传"}
      </button>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, FileText, FileSpreadsheet, File, Database, BookOpen,
  HardDrive, Trash2, ExternalLink, Plus, RefreshCw, X,
  Upload, Loader2, CheckCircle2, AlertCircle, FolderOpen,
} from "lucide-react";

const docTypes = ["全部", "obsidian", "upload", "feishu", "url"] as const;

interface KBDoc {
  id: string;
  title: string;
  source: string;
  file_type: string;
  content_preview: string;
  chunk_count: number;
  created_at: string;
  metadata?: { obsidianPath?: string; tags?: string[] };
}

const DEFAULT_VAULT_PATH = "/Users/alan/Desktop/知识库";

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("全部");
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ totalFiles: number; results: { file: string; status: string }[] } | null>(null);
  const [vaultPath, setVaultPath] = useState(DEFAULT_VAULT_PATH);
  const [loading, setLoading] = useState(true);

  // Load real docs from API
  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/knowledge");
      if (resp.ok) {
        const data = await resp.json();
        setDocs(data.documents || []);
      }
    } catch { /* fallback to empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Sync Obsidian
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const resp = await fetch("/api/knowledge/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath }),
      });
      const data = await resp.json();
      setSyncResult(data);
      if (resp.ok) loadDocs();
    } catch (e) {
      setSyncResult({ totalFiles: 0, results: [{ file: "请求失败", status: String(e) }] });
    }
    setSyncing(false);
  };

  const filtered = docs.filter((d) => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "全部" || d.source === typeFilter;
    return matchSearch && matchType;
  });

  const icons: Record<string, React.ElementType> = {
    pdf: FileText, docx: FileText, md: BookOpen, doc: FileText,
    url: ExternalLink, xlsx: FileSpreadsheet, txt: FileText,
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">知识库</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Obsidian 同步 · 文档上传 · RAG 检索
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {syncing ? "同步中..." : "同步 Obsidian"}
        </button>
      </div>

      {/* Vault path */}
      <div className="px-6 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <FolderOpen size={14} className="text-zinc-400 shrink-0" />
        <input
          value={vaultPath}
          onChange={(e) => setVaultPath(e.target.value)}
          className="flex-1 text-xs text-zinc-500 bg-transparent outline-none font-mono"
          placeholder="Obsidian Vault 路径"
        />
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`px-6 py-2 text-xs border-b ${
          syncResult.results?.some(r => r.status === "ok")
            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600"
        }`}>
          扫描 {syncResult.totalFiles} 个文件 ·
          新增 {syncResult.results?.filter(r => r.status === "ok").length || 0} 个文档 ·
          跳过 {syncResult.results?.filter(r => r.status.startsWith("skipped")).length || 0} 个
        </div>
      )}

      {/* Stats */}
      <div className="px-6 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-6 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <HardDrive size={14} />
          {docs.length} 个文档
        </span>
      </div>

      {/* Search + filter */}
      <div className="px-6 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {docTypes.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                typeFilter === t ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >{t === "全部" ? "全部" : t}</button>
          ))}
        </div>
      </div>

      {/* Docs list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Database size={40} className="mb-3 opacity-50" />
            <p className="text-sm">暂无文档</p>
            <p className="text-xs mt-1">点击「同步 Obsidian」导入知识库</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((doc) => {
              const Icon = icons[doc.file_type] || File;
              return (
                <div key={doc.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                >
                  <Icon size={18} className="text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-900 dark:text-zinc-100 truncate font-medium">{doc.title}</div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                      <span className={`px-1 py-0.5 rounded text-[10px] ${
                        doc.source === "obsidian"
                          ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>{doc.source}</span>
                      <span>{doc.chunk_count} chunks</span>
                      <span>·</span>
                      <span>{doc.created_at?.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  File,
  Database,
  BookOpen,
  HardDrive,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

const docTypes = ["全部", "上传", "Obsidian", "飞书", "URL"] as const;

const mockDocs = [
  { id: "1", title: "企智产品需求文档.pdf", source: "upload", type: "pdf", size: "2.3 MB", chunks: 45, created: "2026-06-25" },
  { id: "2", title: "AI 行业分析报告.docx", source: "upload", type: "docx", size: "5.1 MB", chunks: 78, created: "2026-06-22" },
  { id: "3", title: "MBA552 组织行为学笔记", source: "obsidian", type: "md", size: "12 KB", chunks: 13, created: "2026-06-20" },
  { id: "4", title: "竞品研究 WorkBuddy", source: "obsidian", type: "md", size: "8 KB", chunks: 9, created: "2026-06-18" },
  { id: "5", title: "飞书知识库同步 - 产品手册", source: "feishu", type: "doc", size: "1.8 MB", chunks: 32, created: "2026-06-15" },
  { id: "6", title: "OpenAI GPT-4o 技术白皮书", source: "url", type: "url", size: "—", chunks: 56, created: "2026-06-10" },
  { id: "7", title: "钉钉机器人开发文档", source: "url", type: "url", size: "—", chunks: 41, created: "2026-06-08" },
  { id: "8", title: "2026 上半年销售数据.xlsx", source: "upload", type: "xlsx", size: "3.1 MB", chunks: 63, created: "2026-06-05" },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("全部");
  const [showUpload, setShowUpload] = useState(false);

  const filtered = mockDocs.filter((d) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "全部" || d.source === typeFilter.toLowerCase();
    return matchSearch && matchType;
  });

  const icons: Record<string, React.ElementType> = {
    pdf: FileText,
    docx: FileText,
    md: BookOpen,
    doc: FileText,
    url: ExternalLink,
    xlsx: FileSpreadsheet,
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">知识库</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            文档上传 · Obsidian 同步 · RAG 检索
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> 上传文档
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-6 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <HardDrive size={14} />
          8 个文档 · 337 个索引块
        </span>
        <span className="flex items-center gap-1.5">
          <Database size={14} />
          向量维度 384 · all-MiniLM-L6-v2
        </span>
        <button className="flex items-center gap-1 text-blue-600 hover:text-blue-700 ml-auto">
          <RefreshCw size={13} /> 同步 Obsidian
        </button>
      </div>

      {/* Search + filters */}
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
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                typeFilter === t
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="space-y-1">
          {filtered.map((doc) => {
            const Icon = icons[doc.type] || File;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 group transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
              >
                <Icon size={18} className="text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-900 dark:text-zinc-100 truncate font-medium">
                    {doc.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] ${
                        doc.source === "obsidian"
                          ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                          : doc.source === "feishu"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : doc.source === "url"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {doc.source}
                    </span>
                    <span>{doc.size}</span>
                    <span>·</span>
                    <span>{doc.chunks} chunks</span>
                    <span>·</span>
                    <span>{doc.created}</span>
                  </div>
                </div>
                <button className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">上传文档</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <Upload size={32} className="mx-auto mb-3 text-zinc-400" />
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-1">
                拖拽文件到此处或点击上传
              </p>
              <p className="text-xs text-zinc-400">
                支持 PDF / Word / Excel / PPT / TXT / Markdown
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-zinc-500 mb-1.5">或输入 URL</label>
              <input
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                取消
              </button>
              <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                确认上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

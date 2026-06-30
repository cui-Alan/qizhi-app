"use client";

import { useState, useMemo } from "react";
import { useSkillsStore, type Skill } from "@/stores/skills";
import {
  Download,
  Check,
  Star,
  DownloadCloud,
  Search,
} from "lucide-react";

const categories = [
  "全部",
  "办公效率",
  "效率工具",
  "开发工具",
  "文档处理",
  "数据处理",
  "AI 工具",
  "通道集成",
];

export default function SkillsPage() {
  const { skills, installedIds, install, uninstall } = useSkillsStore();
  const [selectedCat, setSelectedCat] = useState("全部");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "installed">("all");

  const filtered = useMemo(() => {
    let list = skills;
    if (selectedCat !== "全部") {
      list = list.filter((s) => s.category === selectedCat);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (tab === "installed") {
      list = list.filter((s) => installedIds.has(s.id));
    }
    return list;
  }, [skills, selectedCat, search, tab, installedIds]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          技能市场
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          浏览和安装技能，扩展企智能力
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {(["all", "installed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                tab === t
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t === "all" ? "全部" : "已安装"}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`shrink-0 px-3 py-1 text-xs rounded-full transition-colors ${
              selectedCat === cat
                ? "bg-blue-600 text-white"
                : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skill cards */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={installedIds.has(skill.id)}
              onInstall={() => install(skill.id)}
              onUninstall={() => uninstall(skill.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <DownloadCloud size={48} className="mb-3 opacity-30" />
            <p>没有找到技能</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  installed,
  onInstall,
  onUninstall,
}: {
  skill: Skill;
  installed: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="group border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{skill.icon}</span>
        {installed ? (
          <span
            onClick={onUninstall}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Check size={12} /> 已安装
          </span>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Download size={12} /> 安装
          </button>
        )}
      </div>

      <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">
        {skill.name}
      </h3>
      <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
        {skill.description}
      </p>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          {skill.rating}
          <span className="mx-1">·</span>
          {skill.installs.toLocaleString()} 安装
        </div>
        <span className="text-zinc-300">{skill.version}</span>
      </div>

      <div className="flex gap-1 mt-2 flex-wrap">
        {skill.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

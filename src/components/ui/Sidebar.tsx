"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import {
  Workflow,
  Database,
  Settings,
  Bot,
  Zap,
  CheckSquare,
  Plus,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";

const navItems = [
  { href: "/workflow", label: "工作流", icon: Workflow },
  { href: "/knowledge", label: "知识库", icon: Database },
  { href: "/skills", label: "技能市场", icon: Zap },
  { href: "/tasks", label: "任务看板", icon: CheckSquare },
  { href: "/admin", label: "管理", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    sessions,
    currentSessionId,
    createSession,
    setCurrentSession,
    renameSession,
    deleteSession,
  } = useChatStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setEditTitle(current);
    setContextMenu(null);
  };

  const commitRename = (id: string) => {
    if (editTitle.trim()) {
      renameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-16 md:w-56 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 select-none">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Bot size={18} className="text-white" />
          </div>
          <span className="hidden md:block font-semibold text-zinc-900 dark:text-zinc-100">
            企智
          </span>
        </Link>
      </div>

      {/* Session area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* New Session button */}
        <div className="p-2">
          <button
            onClick={() => createSession()}
            className="w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-sm border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden md:block">新建会话</span>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {sessions.map((session) => {
            const isActive = currentSessionId === session.id;
            return (
              <div key={session.id} className="relative group">
                {editingId === session.id ? (
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => commitRename(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(session.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-zinc-800 border border-blue-400 outline-none text-zinc-900 dark:text-zinc-100"
                  />
                ) : (
                  <button
                    onClick={() => setCurrentSession(session.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      isActive
                        ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="hidden md:block truncate flex-1">
                      {session.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu(
                          contextMenu === session.id ? null : session.id,
                        );
                      }}
                      className="hidden md:block opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </button>
                )}

                {/* Context menu */}
                {contextMenu === session.id && (
                  <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[100px]">
                    <button
                      onClick={() => startRename(session.id, session.title)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Pencil size={13} /> 重命名
                    </button>
                    <button
                      onClick={() => {
                        deleteSession(session.id);
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Trash2 size={13} /> 删除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-3 my-1 border-t border-zinc-200 dark:border-zinc-700" />

        {/* Navigation area */}
        <nav className="px-2 pb-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-zinc-200 dark:bg-zinc-700 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                )}
              >
                <item.icon size={16} />
                <span className="hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User area */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
          <span className="hidden md:block truncate">用户</span>
        </button>
      </div>
    </aside>
  );
}

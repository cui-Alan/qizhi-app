"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Workflow,
  Database,
  Settings,
  Bot,
  Zap,
  BookOpen,
} from "lucide-react";

const navItems = [
  { href: "/chat", label: "对话", icon: MessageSquare },
  { href: "/workflow", label: "工作流", icon: Workflow },
  { href: "/knowledge", label: "知识库", icon: Database },
  { href: "/skills", label: "技能市场", icon: Zap },
  { href: "/dashboard", label: "仪表盘", icon: BookOpen },
  { href: "/admin", label: "管理", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-16 md:w-56 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <span className="hidden md:block font-semibold text-zinc-900 dark:text-zinc-100">
            企智
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
              "hover:bg-zinc-200 dark:hover:bg-zinc-800",
            )}
          >
            <item.icon size={18} />
            <span className="hidden md:block">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User area */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="hidden md:block">用户</span>
        </button>
      </div>
    </aside>
  );
}

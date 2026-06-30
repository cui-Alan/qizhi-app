"use client";

import Link from "next/link";
import {
  User, Palette, Monitor, Bot, Database, Zap,
  Puzzle, Shield, HelpCircle, Settings, ChevronRight,
} from "lucide-react";

const settingsGroups = [
  {
    title: "个人设置",
    items: [
      { href: "/settings/account", icon: User, label: "账户管理", desc: "个人信息、密码、头像" },
      { href: "/settings/appearance", icon: Palette, label: "外观", desc: "主题、字体大小、布局" },
      { href: "/settings/personalization", icon: Puzzle, label: "个性化", desc: "快捷键、默认设置" },
    ],
  },
  {
    title: "系统设置",
    items: [
      { href: "/settings/system", icon: Monitor, label: "系统设置", desc: "通知、启动项、代理" },
      { href: "/settings/agent", icon: Bot, label: "智能体设置", desc: "Agent 行为配置" },
      { href: "/settings/models", icon: Zap, label: "模型", desc: "AI 模型选择与参数" },
    ],
  },
  {
    title: "数据与安全",
    items: [
      { href: "/settings/memory", icon: Database, label: "记忆", desc: "记忆层级、历史记录" },
      { href: "/settings/data", icon: Database, label: "数据管理", desc: "导入导出、存储" },
      { href: "/settings/security", icon: Shield, label: "安全中心", desc: "API 密钥、权限" },
    ],
  },
  {
    title: "支持",
    items: [
      { href: "/settings/help", icon: HelpCircle, label: "帮助与反馈", desc: "使用文档、联系支持" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-zinc-600" />
        <h1 className="text-2xl font-bold text-zinc-800">设置</h1>
      </div>

      {settingsGroups.map((group) => (
        <div key={group.title}>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-2">{group.title}</h2>
          <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors"
              >
                <item.icon size={18} className="text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                  <p className="text-xs text-zinc-400">{item.desc}</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
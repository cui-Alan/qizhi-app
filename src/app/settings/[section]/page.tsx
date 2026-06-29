"use client";

import { useParams } from "next/navigation";

const settingsMap: Record<string, { title: string; icon: string; desc: string }> = {
  account: {
    title: "账户管理",
    icon: "👤",
    desc: "账号信息 · 订阅管理 · 切换租户",
  },
  appearance: {
    title: "外观",
    icon: "🎨",
    desc: "主题 · 字体大小 · 浅色/深色模式",
  },
  system: {
    title: "系统设置",
    icon: "⚙️",
    desc: "语言 · 通知 · 启动项",
  },
  agent: {
    title: "智能体设置",
    icon: "🤖",
    desc: "Agent 人格 · 默认行为 · 对话风格",
  },
  memory: {
    title: "记忆",
    icon: "🧠",
    desc: "记忆层级配置 · 遗忘策略",
  },
  models: {
    title: "模型",
    icon: "🧩",
    desc: "模型接入管理 · OpenAI/Claude/oMLX",
  },
  personalization: {
    title: "个性化",
    icon: "✨",
    desc: "快捷指令 · 模板管理",
  },
  data: {
    title: "数据管理",
    icon: "📊",
    desc: "导出/导入 · 缓存清理 · 历史记录",
  },
  security: {
    title: "安全中心",
    icon: "🔒",
    desc: "密码修改 · 双因素 · 登录日志",
  },
  help: {
    title: "帮助与反馈",
    icon: "❓",
    desc: "使用文档 · 联系客服 · 问题反馈",
  },
};

export default function SettingsPage() {
  const params = useParams();
  const section = params.section as string;
  const info = settingsMap[section] || {
    title: "设置",
    icon: "⚙️",
    desc: "选择左侧设置项",
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
      <div className="text-6xl mb-4">{info.icon}</div>
      <h2 className="text-xl font-medium text-zinc-700 dark:text-zinc-300">
        {info.title}
      </h2>
      <p className="text-sm mt-2">{info.desc}</p>
    </div>
  );
}

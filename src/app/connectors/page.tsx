"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle, Radio } from "lucide-react";

const CHANNELS = [
  { id: "feishu", name: "飞书", icon: "🪶", status: "active", sessions: 8, instructions: "飞书开放平台 → 事件订阅 → 填入 Webhook URL" },
  { id: "wecom", name: "企业微信", icon: "💼", status: "active", sessions: 2, instructions: "企业微信管理后台 → 应用管理 → 接收消息 → 设置回调 URL" },
  { id: "dingtalk", name: "钉钉", icon: "📌", status: "inactive", sessions: 0, instructions: "钉钉开放平台 → 机器人 → 消息接收 → 配置 Webhook" },
  { id: "wechat", name: "微信", icon: "💬", status: "inactive", sessions: 0, instructions: "微信公众号后台 → 开发 → 基本配置 → 服务器 URL" },
  { id: "slack", name: "Slack", icon: "💎", status: "inactive", sessions: 0, instructions: "Slack API → Event Subscriptions → Request URL" },
  { id: "telegram", name: "Telegram", icon: "✈️", status: "inactive", sessions: 0, instructions: "BotFather → /setwebhook → 填入 URL" },
];

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.qizhi.app";

export default function ConnectorsPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const copyUrl = () => { navigator.clipboard.writeText(`${BASE_URL}/api/channels`); setCopied("url"); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">消息通道</h1>
        <p className="text-sm text-zinc-500 mt-0.5">统一 Webhook 入口 · 自动识别 6 大平台</p>
      </div>

      <div className="px-6 py-3 border-b border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
        <div className="flex items-center gap-2 text-sm">
          <Radio size={14} className="text-blue-600 shrink-0" />
          <span className="text-blue-700 dark:text-blue-400 font-medium">Webhook URL:</span>
          <code className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded text-xs text-blue-700 dark:text-blue-300 font-mono">
            {BASE_URL}/api/channels
          </code>
          <button onClick={copyUrl} className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-500 shrink-0">
            {copied === "url" ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">所有平台共用一个 URL，后端自动识别渠道类型（飞书/企微/钉钉/微信/Slack/Telegram）</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4">
          {CHANNELS.map(ch => (
            <div key={ch.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ch.icon}</span>
                  <div>
                    <h3 className="font-medium">{ch.name}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`flex items-center gap-1 ${ch.status === "active" ? "text-green-600" : "text-zinc-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ch.status === "active" ? "bg-green-500" : "bg-zinc-300"}`} />
                        {ch.status === "active" ? "已激活" : "待配置"}
                      </span>
                      {ch.sessions > 0 && <span className="text-zinc-400">· {ch.sessions} 会话</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
                <div className="flex items-start gap-1.5"><AlertCircle size={12} className="shrink-0 mt-0.5" /><span>{ch.instructions}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { CreditCard, Check } from "lucide-react";

const PLANS = [
  { id: "free", name: "Free", price: "$0", features: ["每日 20 次推理", "1 个工作流", "本地模型"], current: true },
  { id: "pro", name: "Pro", price: "$15/月", features: ["每日 500 次推理", "10 个工作流", "云端模型接入", "邮件支持"], current: false },
  { id: "team", name: "Team", price: "$30/座/月", features: ["Pro 全部", "50 个工作流", "团队协作", "优先支持"], current: false },
];

export default function BillingPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-semibold mb-1">套餐管理</h1>
      <p className="text-sm text-zinc-500 mb-6">管理你的订阅套餐</p>
      <div className="grid grid-cols-3 gap-4">
        {PLANS.map(p => (
          <div key={p.id} className={`border rounded-xl p-5 ${p.current ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20" : "border-zinc-200 dark:border-zinc-800"}`}>
            <h3 className="font-medium">{p.name}</h3>
            <div className="text-2xl font-bold mt-2">{p.price}</div>
            <ul className="mt-4 space-y-2">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <Check size={14} className="text-green-500" />{f}
                </li>
              ))}
            </ul>
            <button className={`w-full mt-4 py-2 text-sm rounded-lg font-medium ${
              p.current ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" : "bg-blue-600 text-white hover:bg-blue-700"
            }`} disabled={p.current}>
              {p.current ? "当前套餐" : "升级"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

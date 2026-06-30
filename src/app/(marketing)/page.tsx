import Link from "next/link";
import { Bot, Workflow, Shield, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100">
      {/* Hero */}
      <header className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-sm mb-6">
          <Bot size={14} /> 基于 OpenClaw + Hermes
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          企智 <span className="text-blue-600">QiZhi</span>
        </h1>
        <p className="text-xl text-zinc-500 mb-8 max-w-2xl mx-auto">
          AI 原生工作流平台 — 多模型接入、状态机编排、消息通道聚合、知识库 RAG。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/chat" className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
            开始使用 <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
            登录
          </Link>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-3 gap-8">
        {[
          { icon: Bot, title: "多模型推理", desc: "oMLX DeepSeek-R1 · GPT-4o · Claude · 自定义 API" },
          { icon: Workflow, title: "状态机编排", desc: "XState 5 驱动 · 四级兜底恢复 · YAML DSL" },
          { icon: Shield, title: "管理员管控", desc: "仅管理员开通 · RBAC 权限 · 审计日志" },
        ].map(f => (
          <div key={f.title} className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <f.icon size={28} className="text-blue-600 mb-4" />
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-zinc-500">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 text-center text-sm text-zinc-400">
        © 2026 企智 QiZhi · OpenClaw + Hermes 驱动
      </footer>
    </div>
  );
}

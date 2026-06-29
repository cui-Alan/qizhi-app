# 企智 QiZhi

AI 工作流编排平台 — 基于 OpenClaw + Hermes 双底座架构

## 产品三件套

- **工作流可视化** — 拖拽式编辑器 + YAML 双向同步 + XState 5 状态机
- **审批门** — 人工审批节点 + 多渠道通知
- **RAG 知识库** — 文档上传 + Obsidian Vault 同步 + 向量检索

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Electron |
| Web 前端 | Next.js 14 + React 18 + Tailwind CSS |
| 状态管理 | Zustand + XState 5 |
| 可视化编辑器 | React Flow + Monaco Editor |
| 后端 | Vercel Serverless + Supabase |
| 数据库 | PostgreSQL (Supabase) |
| Agent 底座 | OpenClaw + Hermes |

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 数据库

在 Supabase SQL Editor 中运行 `supabase/schema.sql` 建立表结构。

## 目录结构

```
src/
├── app/            # Next.js 路由
├── components/     # 组件
│   ├── chat/       # 对话 UI
│   ├── workflow/   # 工作流编辑器
│   ├── admin/      # 管理后台
│   └── ui/         # 通用 UI
├── lib/            # 工具库
│   └── supabase/   # Supabase 客户端
├── stores/         # Zustand 状态管理
└── types/          # TypeScript 类型定义
```

## 团队

| 角色 | 负责人 | 职责 |
|------|--------|------|
| 总控/架构 | 小马 | OpenClaw+Hermes 集成、技术决策 |
| 前端 | 小C | Electron + Next.js + 可视化编辑器 |
| 后端 | 小虾 | XState 引擎 + RBAC + 审批门 + 通道 |

## License

MIT

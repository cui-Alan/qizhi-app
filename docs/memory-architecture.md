# 企智记忆系统 — 5 层架构（简化版）

> 来源：主管设计，2026-06-30  
> 决策：去掉 L4 MCP Bridge，Obsidian 文件系统直读 + Hermes Gateway API 直连

---

```
                      第5层：会话上下文（内存）
          SYSTEM PROMPT + 当前对话 + 注入的记忆/技能
                                 ↑
               ┌─────────────────┼─────────────────┐
               │                 │                  │
          第1层持久记忆    第2层会话记忆      第3层技能
               │                 │                  │
               ↓                 ↓                  ↓
        MEMORY_DATA/      SESSIONS/          SKILLS/
        STATE.DB(SQLite)  MESSAGES           SKILL.MD
        SOUL.MD            ↑                    ↑
        CONFIG.YAML         │                    │
               │            │                    │
               └────────────┼────────────────────┘
                            │
                 企智 ←──→ Hermes Gateway REST API
                 (Next.js)  /api/state · /api/memory
                            │
                     STATE.DB (SQLite)
                     SOUL.MD · CONFIG.YAML
                            ↑
                   第4层：外部知识库
          Obsidian Vault (直接读 .md 文件系统)
          → chunk → embed → ChromaDB 向量检索
```

## 各层职责

| 层 | 名称 | 存储 | 职责 |
|----|------|------|------|
| 1 | 持久记忆 | SQLite (STATE.DB) + SOUL.MD | 长期记忆、配置、参考文档 |
| 2 | 会话记忆 | SESSIONS + MESSAGES (Supabase) | 对话上下文 |
| 3 | 技能 | SKILL.MD | 技能定义与调用 |
| 4 | 外部知识库 | Obsidian Vault (.md 文件直读) | 企智直接读取文件系统，RAG 索引 |
| 5 | 会话上下文 | 内存 | L1-L4 汇总注入 AI prompt |

## 数据流

```
Obsidian Vault (.md) → 企智 fs.readdir → chunk → ChromaDB
                                                      ↓
Hermes Gateway ←── 企智调用 REST API ←── STATE.DB 查询
                                                      ↓
用户消息 → L2会话 → L3技能 → L1持久记忆 → L4知识库 → L5 注入 AI
```

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-30 | 初始 6 层架构（含 MCP Bridge） |
| 2026-06-30 | 简化为 5 层：去掉 MCP Bridge，Obsidian 直读，Hermes API 直连 |

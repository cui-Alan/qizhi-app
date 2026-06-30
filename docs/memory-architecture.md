# 企智记忆系统 — 6 层架构

> 来源：主管设计，2026-06-30  
> L4 = MCP 协议桥接 Obsidian 等知识库

---

```
                      第6层：会话上下文（内存）
          SYSTEM PROMPT + 当前对话 + 注入的记忆/技能
                                 ↑
               ┌─────────────────┼─────────────────┐
               │                 │                  │
          第1层持久记忆    第2层会话记忆      第3层技能
               │                 │                  │
               ↓                 ↓                  ↓
        MEMORY_DATA/      SESSIONS/          SKILLS/
        STATE.DB(SQLite)  MESSAGES           SKILL.MD
        SOUL.MD                                  ↑
        CONFIG.YAML                               │
               │                 ↑                │
               └─────────────────┼────────────────┘
                                 │
                      第5层：外部知识库
            Obsidian Vault + 其他知识库源
              → RAG 索引 → 向量检索
                                 ↑
                      第4层：MCP Bridge
             Obsidian MCP Server ↔ 企智 MCP Client
             标准 MCP 协议接入，结构化工具调用
             (list_docs / read_note / search_vault)
```

## 各层职责

| 层 | 名称 | 技术实现 | 职责 |
|----|------|----------|------|
| 1 | 持久记忆 | SQLite (STATE.DB) + SOUL.MD | 长期记忆、人格配置、参考文档 |
| 2 | 会话记忆 | SESSIONS + MESSAGES (Supabase) | 对话上下文 |
| 3 | 技能 | SKILL.MD + OpenClaw | 技能定义与工具调用 |
| 4 | **MCP Bridge** | **MCP Server/Client 协议** | **Obsidian 等知识库通过 MCP 标准接入** |
| 5 | 外部知识库 | Obsidian Vault → chunk → ChromaDB | RAG 知识检索 |
| 6 | 会话上下文 | 内存 | L1-L5 汇总注入 AI prompt |

## 为什么 L4 用 MCP？

| 优势 | 说明 |
|------|------|
| 标准化 | MCP 是 Anthropic 开源的 AI-工具协议，不绑特定产品 |
| 结构化 | `list_docs` / `read_note` / `search_vault` 标准工具定义 |
| 可扩展 | 任何 MCP Server（不仅是 Obsidian）都能接 |
| 安全 | MCP 权限模型，不暴露原始文件系统 |

## 数据流

```
Obsidian Vault → MCP Server → [L4 MCP Bridge] → [L5 RAG 索引]
                                                      ↓
Hermes Gateway → STATE.DB 查询 → [L1 持久记忆] ──────┤
                                                      ↓
用户消息 → L2会话 → L3技能 → L1持久 → L5知识库 → L6 注入 AI
```

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-30 | 初始 6 层架构 |
| 2026-06-30 | 澄清 L4：MCP 协议接入知识库，非通用 Bridge |

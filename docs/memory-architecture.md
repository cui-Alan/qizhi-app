# 企智记忆系统 — 6 层架构

> 来源：主管设计，2026-06-30

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
            CONFIG.YAML+FTS5                            │
            REFERENCES/                                 │
                   │                 ↑                  │
                   └─────────────────┼──────────────────┘
                                     │
                          第5层：外部知识库（Obsidian + IMA）
                  OBSIDIAN VAULT/06 - 共享记忆库
                  ↔ IMA 知识库（双向同步）
                                     ↑
                          第4层：共享上下文（MCP Bridge）
                      HERMES ↔ 企智 双向键值对共享
```

## 各层职责

| 层 | 名称 | 存储 | 职责 |
|----|------|------|------|
| 1 | 持久记忆 | SQLite (STATE.DB) + SOUL.MD | 长期记忆、配置、参考文档 |
| 2 | 会话记忆 | SESSIONS + MESSAGES | 对话上下文 |
| 3 | 技能 | SKILL.MD | 技能定义与调用 |
| 4 | 共享上下文 | MCP Bridge | Hermes ↔ 企智 键值对共享 |
| 5 | 外部知识库 | Obsidian Vault + IMA | 双向同步的知识库 |
| 6 | 会话上下文 | 内存 | 最终注入 AI 的完整上下文 |

## 数据流

```
Obsidian Vault → [层5] → [层4 MCP Bridge] → [层1 持久记忆]
                                                ↓
用户消息 → [层2 会话] → [层3 技能] → [层6 会话上下文] → AI 推理
```

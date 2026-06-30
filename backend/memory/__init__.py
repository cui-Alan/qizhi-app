"""
企智 · 6层记忆系统
Six-Layer Memory Architecture for Qizhi

层级结构：
┌─────────────────────────────────────────────────────────────────────┐
│  第6层：会话上下文（内存）— Session Context (In-Memory)               │
│  SYSTEM PROMPT + 当前对话 + 注入的记忆/技能                           │
│                           ↑                                          │
│         ┌─────────────────┼─────────────────┐                        │
│         │                 │                  │                        │
│    第1层持久记忆    第2层会话记忆      第3层技能                       │
│    (MEMORY)        (SESSION)          (SKILLS)                       │
│         │                 │                  │                        │
│         ↓                 ↓                  ↓                        │
│  MEMORY_DATA/      SESSIONS/          SKILLS/                        │
│  STATE.DB(SQLite)  MESSAGES           SKILL.MD                       │
│  SOUL.MD                                  ↑                          │
│  CONFIG.YAML+FTS5                            │                        │
│  REFERENCES/                                 │                        │
│         │                 ↑                  │                        │
│         └─────────────────┼──────────────────┘                        │
│                           │                                          │
│                    第5层：外部知识库（Obsidian + IMA）                 │
│                    OBSIDIAN VAULT/06 - 共享记忆库                     │
│                    ↔ IMA 知识库（双向同步）                            │
│                           ↑                                          │
│                    第4层：共享上下文（MCP Bridge）                     │
│                    HERMES ↔ 企智 双向键值对共享                        │
├─────────────────────────────────────────────────────────────────────┤
│  第7层：每日摘要 (Daily Summary)                                     │
│  用户每日会话压缩存储，主题回顾                                        │
│                           ↑                                          │
│  第8层：向量搜索 (Vector Search)                                     │
│  BM25 + 简单词向量混合搜索                                           │
└─────────────────────────────────────────────────────────────────────┘

模块：
- layers/layer1_persistent.py   : 第1层 - 持久记忆（SQLite + FTS5）
- layers/layer2_session.py    : 第2层 - 会话记忆（文件）
- layers/layer3_skills.py     : 第3层 - 技能系统
- layers/layer4_mcp_bridge.py : 第4层 - MCP Bridge（Hermes↔企智）
- layers/layer5_obsidian.py   : 第5层 - Obsidian + IMA 知识库
- layers/layer6_context.py    : 第6层 - 会话上下文注入
- layers/layer7_daily.py      : 第7层 - 每日摘要（Supabase + 本地）
- layers/layer8_vector.py     : 第8层 - 向量搜索（BM25 + 简单Embedding）
- storage/sqlite_store.py     : SQLite 存储引擎
"""

__version__ = "1.0.0"

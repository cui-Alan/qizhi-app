"""
企智 · 第5层：Obsidian 双向同步
Layer 5: Obsidian Vault Bidirectional Sync

功能：
- 读取 Obsidian vault 中的 .md 文件
- 解析 YAML frontmatter + markdown body
- 按标签/日期组织记忆
- 写入新记忆到 Obsidian 文件
- 搜索记忆内容
"""

import os
import re
import yaml
from pathlib import Path
from datetime import datetime
from typing import Optional, Any, Dict, List
from dataclasses import dataclass, field


VAULT_PATH = Path("/Users/alan/Desktop/知识库/💾-记忆库")
PERSONAL_MEMORY = VAULT_PATH / "个人记忆.md"
IDENTITY_FILE = VAULT_PATH / "小Q_身份.md"
DAILY_DIR = VAULT_PATH / "daily"


@dataclass
class ObsidianEntry:
    """Obsidian 记忆条目"""
    file_path: Path
    title: str
    tags: List[str] = field(default_factory=list)
    frontmatter: Dict[str, Any] = field(default_factory=dict)
    body: str = ""
    created: Optional[datetime] = None
    modified: Optional[datetime] = None


def parse_frontmatter(content: str) -> tuple[Dict[str, Any], str]:
    """解析 YAML frontmatter，返回 (frontmatter_dict, body)"""
    match = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
    if not match:
        return {}, content
    fm = yaml.safe_load(match.group(1)) or {}
    body = match.group(2).strip()
    return fm, body


def read_markdown(path: Path) -> ObsidianEntry:
    """读取单个 markdown 文件"""
    try:
        stat = path.stat()
        content = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(content)
        
        # 提取标题（第一个 # 开头）
        title_match = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
        title = title_match.group(1) if title_match else path.stem
        
        # 解析标签
        tags: List[str] = fm.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        if tags and not isinstance(tags, list):
            tags = []
        
        # 解析日期
        created = None
        modified = None
        if fm.get("created"):
            try:
                created = datetime.fromisoformat(str(fm["created"]).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        if fm.get("last_modified"):
            try:
                modified = datetime.fromisoformat(str(fm["last_modified"]).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass
        
        return ObsidianEntry(
            file_path=path,
            title=title,
            tags=tags,
            frontmatter=fm,
            body=body,
            created=created or datetime.fromtimestamp(stat.st_ctime),
            modified=datetime.fromtimestamp(stat.st_mtime),
        )
    except Exception as e:
        return ObsidianEntry(file_path=path, title=path.stem)


class ObsidianMemory:
    """
    第5层：Obsidian 知识库双向同步
    
    读取流程：
    1. 扫描 vault 中所有 .md 文件
    2. 解析 frontmatter + body
    3. 构建记忆上下文供 L6 注入
    
    写入流程：
    1. 追加记忆到指定文件
    2. 更新 frontmatter last_modified
    """
    
    def __init__(self, vault_path: str = None):
        self.vault_path = Path(vault_path) if vault_path else VAULT_PATH
        self._cache: Dict[str, ObsidianEntry] = {}
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = 30  # 30秒缓存
    
    def _is_cache_valid(self) -> bool:
        if not self._cache_time:
            return False
        return (datetime.now() - self._cache_time).total_seconds() < self._cache_ttl
    
    def get_entry(self, file_path: Path) -> ObsidianEntry:
        """读取单个文件"""
        return read_markdown(file_path)
    
    def scan_vault(self, force: bool = False) -> List[ObsidianEntry]:
        """扫描 vault 中所有 .md 文件"""
        if not force and self._is_cache_valid():
            return list(self._cache.values())
        
        entries = []
        if self.vault_path.exists():
            for md_file in self.vault_path.rglob("*.md"):
                if md_file.name.startswith("."):
                    continue
                entry = self.get_entry(md_file)
                self._cache[str(md_file)] = entry
                entries.append(entry)
        
        self._cache_time = datetime.now()
        return entries
    
    def get_personal_memory(self) -> ObsidianEntry:
        """读取个人记忆文件"""
        if PERSONAL_MEMORY.exists():
            return self.get_entry(PERSONAL_MEMORY)
        return ObsidianEntry(file_path=PERSONAL_MEMORY, title="个人记忆")
    
    def get_identity(self) -> ObsidianEntry:
        """读取 AI 身份文件"""
        if IDENTITY_FILE.exists():
            return self.get_entry(IDENTITY_FILE)
        return ObsidianEntry(file_path=IDENTITY_FILE, title="小Q身份")
    
    def get_daily_notes(self, days: int = 7) -> List[ObsidianEntry]:
        """读取最近 N 天的日记"""
        entries = []
        if DAILY_DIR.exists():
            for md_file in sorted(DAILY_DIR.glob("*.md"), reverse=True)[:days]:
                entries.append(self.get_entry(md_file))
        return entries
    
    def build_context(self, query: str = "") -> str:
        """
        构建 Obsidian 记忆上下文字符串
        用于注入到 L6 chat system prompt
        """
        lines = ["[Obsidian 知识库记忆]"]
        lines.append(f"扫描时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        # 个人记忆
        personal = self.get_personal_memory()
        if personal.body:
            lines.append(f"\n## 个人记忆 ({personal.file_path.name})")
            lines.append(personal.body[:2000])  # 限制长度
        
        # AI 身份
        identity = self.get_identity()
        if identity.body:
            lines.append(f"\n## AI 身份 ({identity.file_path.name})")
            lines.append(identity.body[:1000])
        
        # 最近的日记
        daily = self.get_daily_notes(days=3)
        if daily:
            lines.append(f"\n## 最近日记 (共{len(daily)}篇)")
            for note in daily[:3]:
                date_str = note.file_path.stem
                lines.append(f"\n### {date_str}")
                lines.append(note.body[:500])
        
        lines.append("\n[/Obsidian 知识库记忆]")
        return "\n".join(lines)
    
    def upsert_fact(self, category: str, key: str, value: str, tags: Optional[List[str]] = None) -> bool:
        """
        写入新事实到 Obsidian 文件
        追加到个人记忆.md
        
        Args:
            category: 分类 (user|project|preference|skill)
            key: 事实键
            value: 事实值
            tags: 标签列表
        Returns:
            True 成功，False 失败
        """
        if not PERSONAL_MEMORY.exists():
            return False
        
        try:
            content = PERSONAL_MEMORY.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(content)
            
            # 追加到 body
            today = datetime.now().strftime("%Y-%m-%d")
            new_lines = [
                f"\n## {category.capitalize()} | {today}",
                f"- **{key}**：{value}",
            ]
            if tags:
                new_lines.append(f"  - 标签: {', '.join(tags)}")
            
            body += "\n" + "\n".join(new_lines)
            
            # 更新时间戳
            fm["last_modified"] = datetime.now().isoformat()
            
            # 重建文件
            new_content = "---\n" + yaml.dump(fm, allow_unicode=True, default_flow_style=False) + "---\n\n" + body + "\n"
            PERSONAL_MEMORY.write_text(new_content, encoding="utf-8")
            
            # 清除缓存
            self._cache.clear()
            self._cache_time = None
            
            return True
        except Exception as e:
            return False
    
    def search(self, query: str, max_results: int = 5) -> List[ObsidianEntry]:
        """
        简单关键词搜索
        在 vault 中搜索包含 query 的文件
        """
        results = []
        for entry in self.scan_vault():
            if query.lower() in entry.body.lower() or query.lower() in entry.title.lower():
                results.append(entry)
                if len(results) >= max_results:
                    break
        return results
    
    def get_memory_summary(self) -> Dict[str, Any]:
        """获取记忆库总览"""
        entries = self.scan_vault()
        return {
            "vault_path": str(self.vault_path),
            "total_files": len(entries),
            "personal_memory_exists": PERSONAL_MEMORY.exists(),
            "identity_exists": IDENTITY_FILE.exists(),
            "daily_notes_count": len(list(DAILY_DIR.glob("*.md"))) if DAILY_DIR.exists() else 0,
            "last_scan": self._cache_time.isoformat() if self._cache_time else None,
        }

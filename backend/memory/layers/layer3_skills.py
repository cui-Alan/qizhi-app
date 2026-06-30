"""
企智 · 第3层：技能系统
Layer 3: Skills Registry

功能：
- 维护可用技能列表
- 技能元数据（名称/描述/触发词）
- 技能启用/停用状态
"""

import os
import json
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class Skill:
    """技能条目"""
    name: str
    description: str
    trigger_words: List[str]
    enabled: bool = True
    path: Optional[str] = None


class SkillsRegistry:
    """第3层：技能注册表"""
    
    def __init__(self):
        self._skills: List[Skill] = self._load_default_skills()
    
    def _load_default_skills(self) -> List[Skill]:
        """加载默认技能列表"""
        return [
            Skill(
                name="web_search",
                description="联网搜索，获取实时信息",
                trigger_words=["搜索", "查一下", "找一下", "search"],
            ),
            Skill(
                name="code_execute",
                description="执行代码（Python/Shell）",
                trigger_words=["执行代码", "运行", "run code"],
            ),
            Skill(
                name="image_gen",
                description="AI 图片生成（ComfyUI/Fal.ai）",
                trigger_words=["生成图片", "画图", "image gen"],
            ),
            Skill(
                name="video_gen",
                description="AI 视频生成（Wan2.2）",
                trigger_words=["生成视频", "视频生成", "video gen"],
            ),
            Skill(
                name="file_manager",
                description="文件管理（读写/转换/压缩）",
                trigger_words=["文件", "读取", "保存", "file"],
            ),
            Skill(
                name="workflow_builder",
                description="工作流构建（YAML DSL）",
                trigger_words=["工作流", "workflow", "自动化"],
            ),
            Skill(
                name="memory_recall",
                description="记忆检索（跨会话）",
                trigger_words=["记得", "记忆", "之前", "memory"],
            ),
            Skill(
                name="obsidian_sync",
                description="Obsidian 双向同步",
                trigger_words=["obsidian", "知识库", "笔记"],
            ),
        ]
    
    def list_skills(self, enabled_only: bool = False) -> List[Skill]:
        """列出技能"""
        skills = self._skills if not enabled_only else [s for s in self._skills if s.enabled]
        return skills
    
    def get_skill(self, name: str) -> Optional[Skill]:
        """获取单个技能"""
        for s in self._skills:
            if s.name == name:
                return s
        return None
    
    def activate(self, name: str) -> bool:
        """启用技能"""
        skill = self.get_skill(name)
        if skill:
            skill.enabled = True
            return True
        return False
    
    def deactivate(self, name: str) -> bool:
        """停用技能"""
        skill = self.get_skill(name)
        if skill:
            skill.enabled = False
            return True
        return False

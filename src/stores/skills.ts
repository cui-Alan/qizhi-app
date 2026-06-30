import { create } from "zustand";

export interface Skill {
  id: string;
  name: string;
  author: string;
  description: string;
  icon: string;
  category: string;
  version: string;
  installs: number;
  rating: number;
  tags: string[];
}

const presetSkills: Skill[] = [
  {
    id: "feishu-doc",
    name: "飞书文档助手",
    author: "企智官方",
    description: "读写飞书文档、多维表格、生成报告",
    icon: "📄",
    category: "办公效率",
    version: "1.2.0",
    installs: 3420,
    rating: 4.8,
    tags: ["飞书", "文档", "表格"],
  },
  {
    id: "browser-auto",
    name: "浏览器自动化",
    author: "企智官方",
    description: "网页操作自动化，数据采集与表单填写",
    icon: "🌐",
    category: "效率工具",
    version: "2.1.0",
    installs: 2891,
    rating: 4.6,
    tags: ["浏览器", "自动化", "爬虫"],
  },
  {
    id: "email-assistant",
    name: "邮件助手",
    author: "企智官方",
    description: "自动撰写、回复邮件，批量发送",
    icon: "📧",
    category: "办公效率",
    version: "1.0.5",
    installs: 5630,
    rating: 4.9,
    tags: ["邮件", "办公"],
  },
  {
    id: "github-tools",
    name: "GitHub 工具集",
    author: "社区",
    description: "Issue/PR 管理、代码审查、仓库操作",
    icon: "🐙",
    category: "开发工具",
    version: "3.0.1",
    installs: 1820,
    rating: 4.7,
    tags: ["GitHub", "开发", "CI/CD"],
  },
  {
    id: "pdf-expert",
    name: "PDF 专家",
    author: "企智官方",
    description: "PDF 解析、提取、转换、生成",
    icon: "📕",
    category: "文档处理",
    version: "1.3.2",
    installs: 4100,
    rating: 4.5,
    tags: ["PDF", "文档", "解析"],
  },
  {
    id: "excel-master",
    name: "Excel 大师",
    author: "企智官方",
    description: "Excel 智能处理、公式生成、数据透视",
    icon: "📊",
    category: "数据处理",
    version: "1.5.0",
    installs: 6700,
    rating: 4.8,
    tags: ["Excel", "表格", "数据"],
  },
  {
    id: "dingtalk-connector",
    name: "钉钉连接器",
    author: "企智官方",
    description: "钉钉消息推送、审批、机器人交互",
    icon: "🔔",
    category: "通道集成",
    version: "1.1.0",
    installs: 2150,
    rating: 4.4,
    tags: ["钉钉", "消息", "审批"],
  },
  {
    id: "ocr-reader",
    name: "OCR 识别",
    author: "社区",
    description: "图片文字识别、表格提取、多语言支持",
    icon: "👁",
    category: "AI 工具",
    version: "2.0.0",
    installs: 3450,
    rating: 4.6,
    tags: ["OCR", "图像", "识别"],
  },
];

interface SkillsState {
  skills: Skill[];
  installedIds: Set<string>;
  install: (id: string) => void;
  uninstall: (id: string) => void;
  isInstalled: (id: string) => boolean;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: presetSkills,
  installedIds: new Set(["feishu-doc", "email-assistant"]),

  install: (id) =>
    set((s) => {
      const next = new Set(s.installedIds);
      next.add(id);
      return { installedIds: next };
    }),

  uninstall: (id) =>
    set((s) => {
      const next = new Set(s.installedIds);
      next.delete(id);
      return { installedIds: next };
    }),

  isInstalled: (id) => get().installedIds.has(id),
}));

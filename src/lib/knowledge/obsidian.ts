/**
 * Obsidian 知识库读取器
 * 支持读取本地 Obsidian Vault 中的 Markdown 文件
 */

import { promises as fs } from "fs";
import path from "path";

export interface ObsidianFile {
  path: string;           // 相对于 vault 根目录的路径
  title: string;          // 文件标题（从文件名或 H1 提取）
  content: string;        // 原始文本内容
  stat: {
    mtime: Date;
    size: number;
  };
  tags: string[];         // 从文件中提取的 #标签
  links: string[];         // 内部 [[wiki链接]] 目标
}

/**
 * 扫描 Vault 根目录及子目录，返回所有 .md 文件
 */
async function scanVault(vaultPath: string, relative = ""): Promise<string[]> {
  const fullPath = path.join(vaultPath, relative);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const mdFiles: string[] = [];

  for (const entry of entries) {
    const rel = path.join(relative, entry.name);
    if (entry.name.startsWith(".")) continue; // 跳过隐藏文件/文件夹
    if (entry.name === "node_modules") continue;

    if (entry.isDirectory()) {
      const sub = await scanVault(vaultPath, rel);
      mdFiles.push(...sub);
    } else if (entry.name.endsWith(".md")) {
      mdFiles.push(rel);
    }
  }
  return mdFiles;
}

/**
 * 从文件内容中提取标题
 */
function extractTitle(content: string, fileName: string): string {
  // 优先从第一个 # H1 提取
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  // 其次从文件名去掉扩展名
  return fileName.replace(/\.md$/, "");
}

/**
 * 提取 #标签（不含 [[wiki链接]] 中的标签）
 */
function extractTags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z\u4e00-\u9fa5_0-9-]+/g) || [];
  return [...new Set(matches.map(t => t.slice(1)))];
}

/**
 * 提取 [[wiki链接]] 目标
 */
function extractLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) || [];
  return [...new Set(matches.map(l => l.replace(/\[\[|\]\]/g, "").split("|")[0]))];
}

/**
 * 读取单个 Markdown 文件
 */
async function readFile(vaultPath: string, filePath: string): Promise<ObsidianFile> {
  const fullPath = path.join(vaultPath, filePath);
  const stat = await fs.stat(fullPath);
  const content = await fs.readFile(fullPath, "utf-8");

  const title = extractTitle(content, path.basename(filePath, ".md"));
  const tags = extractTags(content);
  const links = extractLinks(content);

  return {
    path: filePath,
    title,
    content,
    stat: { mtime: stat.mtime, size: stat.size },
    tags,
    links,
  };
}

/**
 * 读取 Obsidian Vault
 * @param vaultPath 本地 Obsidian Vault 路径，例如 ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyVault
 */
export async function readObsidianVault(vaultPath: string): Promise<ObsidianFile[]> {
  const files = await scanVault(vaultPath);
  const results = await Promise.all(files.map(f => readFile(vaultPath, f)));
  return results;
}

/**
 * 读取单个 Vault 文件（按相对路径）
 */
export async function readObsidianFile(vaultPath: string, relativePath: string): Promise<ObsidianFile> {
  return readFile(vaultPath, relativePath);
}

/**
 * 查找最近修改的文件
 */
export async function getRecentFiles(vaultPath: string, limit = 10): Promise<ObsidianFile[]> {
  const files = await readObsidianVault(vaultPath);
  return files
    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())
    .slice(0, limit);
}

/**
 * 搜索文件名包含关键词的文件
 */
export async function searchByFileName(vaultPath: string, query: string): Promise<ObsidianFile[]> {
  const files = await scanVault(vaultPath);
  const matched = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));
  return Promise.all(matched.map(f => readFile(vaultPath, f)));
}

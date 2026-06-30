/**
 * Obsidian 写入器 — L5 双向同步
 * 将企智生成的记忆/知识写回 Obsidian Vault
 */

import { promises as fs } from "fs";
import path from "path";

export interface ObsidianWriteOptions {
  vaultPath: string;
  folder?: string;           // 写入到哪个子文件夹，默认 "Inbox"
  filename?: string;         // 文件名，默认自动生成
  tags?: string[];
  frontmatter?: Record<string, unknown>;
}

/**
 * 将内容写入 Obsidian Vault（创建或追加）
 */
export async function writeToObsidian(
  content: string,
  options: ObsidianWriteOptions
): Promise<{ path: string; filename: string }> {
  const {
    vaultPath,
    folder = "Inbox",
    filename,
    tags = [],
    frontmatter = {},
  } = options;

  const resolvedFilename = filename ?? `企智-${formatDate(new Date())}.md`;
  const folderPath = path.join(vaultPath, folder);
  const filePath = path.join(folderPath, resolvedFilename);

  // 确保文件夹存在
  await fs.mkdir(folderPath, { recursive: true });

  // 构建带 frontmatter 的 Markdown
  const fm = buildFrontmatter({
    created: new Date().toISOString(),
    source: "企智 QiZhi",
    tags: ["企智-generated", ...tags],
    ...frontmatter,
  });

  const fileContent = fm + "\n\n" + content;

  await fs.writeFile(filePath, fileContent, "utf-8");

  return { path: filePath, filename: resolvedFilename };
}

/**
 * 追加内容到已有文件（不重复追加完全相同的内容）
 */
export async function appendToObsidian(
  content: string,
  vaultPath: string,
  relativeFilePath: string
): Promise<void> {
  const filePath = path.join(vaultPath, relativeFilePath);
  const existing = await fs.readFile(filePath, "utf-8").catch(() => "");

  // 避免重复追加完全相同的内容块
  if (existing.includes(content.trim())) return;

  const divider = `\n\n---\n\n`;
  const updated = existing + divider + content;
  await fs.writeFile(filePath, updated, "utf-8");
}

/**
 * 同步知识条目到 Obsidian（将 KB 文档写入 Vault）
 */
export async function syncDocumentToObsidian(
  vaultPath: string,
  doc: {
    title: string;
    content: string;
    tags?: string[];
    source?: string;
  }
): Promise<{ path: string }> {
  const safeName = doc.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  const filename = `${safeName}.md`;

  return writeToObsidian(doc.content, {
    vaultPath,
    folder: "知识库",
    filename,
    tags: doc.tags,
    frontmatter: {
      title: doc.title,
      source: doc.source ?? "企智知识库",
    },
  });
}

/**
 * 生成 Obsidian frontmatter
 */
function buildFrontmatter(data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([k, v]) => {
    if (Array.isArray(v)) {
      return `${k}: [${v.map((i) => `"${i}"`).join(", ")}]`;
    }
    if (typeof v === "boolean" || typeof v === "number") {
      return `${k}: ${v}`;
    }
    return `${k}: "${v}"`;
  });

  return `---\n${lines.join("\n")}\n---`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
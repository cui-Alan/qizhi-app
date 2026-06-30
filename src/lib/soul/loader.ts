/**
 * SOUL 加载器
 *
 * 负责：
 * 1. 加载 SOUL.MD（纯 Markdown 灵魂文件）
 * 2. 加载 CONFIG.YAML（行为配置）
 * 3. 合成完整 system prompt（注入变量）
 * 4. 缓存 + 热重载（文件变更时重新加载）
 */

import { promises as fs } from "fs";
import path from "path";
import type { SoulConfig, SoulFile } from "./types";
import { DEFAULT_SOUL_MD, DEFAULT_SOUL_CONFIG } from "./types";

// 默认路径（可配置）
const DEFAULT_SOUL_ROOT = process.env.SOUL_ROOT || path.join(process.cwd(), ".soul");

// 内存缓存 + mtime 检查
let cachedSoul: SoulFile | null = null;
let cachedConfig: SoulConfig | null = null;
let cachedSystemPrompt: string | null = null;

function needsReload(cached: SoulFile | null, filePath: string): boolean {
  if (!cached) return true;
  try {
    const stat = await fs.stat(filePath);
    return stat.mtime.getTime() > cached.lastModified.getTime();
  } catch {
    return true;
  }
}

/**
 * 加载 SOUL.MD 文件
 */
async function loadSoulFile(soulRoot: string): Promise<SoulFile> {
  const filePath = path.join(soulRoot, "SOUL.MD");
  try {
    const stat = await fs.stat(filePath);
    const content = await fs.readFile(filePath, "utf-8");
    return { path: filePath, content, lastModified: stat.mtime };
  } catch {
    // 文件不存在，使用默认
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, DEFAULT_SOUL_MD, "utf-8");
    return {
      path: filePath,
      content: DEFAULT_SOUL_MD,
      lastModified: new Date(),
    };
  }
}

/**
 * 加载 CONFIG.YAML（使用 eval 解析简化版 YAML）
 */
async function loadConfig(soulRoot: string): Promise<SoulConfig> {
  const filePath = path.join(soulRoot, "CONFIG.YAML");
  try {
    const content = await fs.readFile(filePath, "utf-8");
    // 简单 YAML 解析（key: value 形式）
    const config: Record<string, unknown> = {};
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, val] = match;
        config[key] = val.replace(/^["']|["']$/g, "").trim();
      }
    }
    return { ...DEFAULT_SOUL_CONFIG, ...config } as SoulConfig;
  } catch {
    return DEFAULT_SOUL_CONFIG;
  }
}

/**
 * 变量插值：将 {{variable}} 替换为实际值
 */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * 生成完整 system prompt
 */
export function buildSystemPrompt(
  soulMd: string,
  config: SoulConfig,
  extraVars?: Record<string, string>
): string {
  const vars = {
    name: config.name,
    version: config.version,
    language: config.language,
    timezone: config.timezone,
    greeting: config.persona.greeting,
    tone: config.persona.tone,
    traits: config.persona.traits.join("、"),
    specialties: config.persona.specialties.join("、"),
    values: config.persona.values.join("、"),
    ...extraVars,
  };

  // 去掉 YAML front matter
  const body = soulMd.replace(/^---[\s\S]*?---\n/, "").trim();
  const interpolated = interpolate(body, vars);

  return (
    `【系统】你是 ${config.name}，${config.persona.greeting}\n\n` +
    `【人格】${config.persona.traits.join("、")} — ${config.persona.specialties.join("、")}\n\n` +
    `${interpolated}\n\n` +
    `【行为配置】回复风格: ${config.persona.tone} | 最大长度: ${config.behavior.maxResponseLength}字符`
  );
}

/**
 * 加载/重载 SOUL（带缓存）
 */
async function loadSoul(soulRoot: string): Promise<{ soul: SoulFile; config: SoulConfig; systemPrompt: string }> {
  const [soulFile, config, needsRefresh] = await Promise.all([
    loadSoulFile(soulRoot),
    loadConfig(soulRoot),
    needsReload(cachedSoul, path.join(soulRoot, "SOUL.MD")),
  ]);

  if (!needsRefresh && cachedSystemPrompt && cachedConfig) {
    return { soul: cachedSoul!, config: cachedConfig, systemPrompt: cachedSystemPrompt };
  }

  const systemPrompt = buildSystemPrompt(soulFile.content, config);

  cachedSoul = soulFile;
  cachedConfig = config;
  cachedSystemPrompt = systemPrompt;

  return { soul: soulFile, config, systemPrompt };
}

/**
 * 获取当前 system prompt（缓存优先）
 */
export async function getSystemPrompt(soulRoot = DEFAULT_SOUL_ROOT): Promise<string> {
  const { systemPrompt } = await loadSoul(soulRoot);
  return systemPrompt;
}

/**
 * 获取 soul 配置
 */
export async function getSoulConfig(soulRoot = DEFAULT_SOUL_ROOT): Promise<SoulConfig> {
  const { config } = await loadSoul(soulRoot);
  return config;
}

/**
 * 更新 SOUL.MD 内容
 */
export async function updateSoulMd(
  content: string,
  soulRoot = DEFAULT_SOUL_ROOT
): Promise<void> {
  const filePath = path.join(soulRoot, "SOUL.MD");
  await fs.writeFile(filePath, content, "utf-8");
  // invalidate cache
  cachedSoul = null;
  cachedSystemPrompt = null;
}

/**
 * 更新 CONFIG.YAML
 */
export async function updateSoulConfig(
  config: Partial<SoulConfig>,
  soulRoot = DEFAULT_SOUL_ROOT
): Promise<void> {
  const filePath = path.join(soulRoot, "CONFIG.YAML");
  const current = await loadConfig(soulRoot);
  const merged = { ...current, ...config };
  const lines = Object.entries({
    name: merged.name,
    version: merged.version,
    language: merged.language,
    timezone: merged.timezone,
    tone: merged.persona.tone,
    autoSaveMemory: merged.behavior.autoSaveMemory,
    summaryThreshold: merged.behavior.summaryThreshold,
  }).map(([k, v]) => `${k}: ${v}`);
  await fs.writeFile(filePath, lines.join("\n"), "utf-8");
  cachedConfig = null;
  cachedSystemPrompt = null;
}
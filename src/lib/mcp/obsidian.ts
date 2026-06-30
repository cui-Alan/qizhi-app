/**
 * Obsidian MCP 集成
 *
 * 企智作为 MCP Client，通过 MCP 协议读写 Obsidian Vault
 * 需要 Obsidian 安装 obsidian-mcp 插件并启用
 *
 * MCP 协议标准：JSON-RPC 2.0 over stdio
 */

import { MCPClient, type MCPTool, type MCPResource } from "./client";
import { promises as fs } from "fs";
import path from "path";

export interface ObsidianMCPConfig {
  /** obsidian-mcp 插件的 npx 启动命令 */
  command?: string;
  /** obsidian-mcp 的 stdio 连接字符串（格式: 'stdio' 或 'http+json://host:port'） */
  transport?: "stdio" | "http";
  /** obsidian-mcp 的工作目录（Obsidian Vault 路径） */
  vaultPath?: string;
}

/**
 * Obsidian MCP 客户端封装
 * 提供高层知识库操作：搜索、读取、写入 Obsidian 文档
 */
export class ObsidianMCP {
  private client: MCPClient | null = null;
  private connected = false;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private vaultPath: string;

  constructor(
    private config: ObsidianMCPConfig = {}
  ) {
    this.vaultPath = config.vaultPath ?? process.env.OBSIDIAN_VAULT_PATH ?? "";
  }

  /**
   * 连接 Obsidian MCP Server
   */
  async connect(): Promise<boolean> {
    if (this.connected) return true;

    try {
      // 优先使用配置的命令，否则用 npx 默认
      const command = this.config.command ?? "npx";
      const args = [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        this.vaultPath,
      ];

      this.client = new MCPClient({ command, args, timeout: 30000 });
      const serverInfo = await this.client.connect();

      this.tools = await this.client.listTools();
      this.resources = await this.client.listResources();
      this.connected = true;

      console.log(`[ObsidianMCP] 已连接: ${serverInfo.name} v${serverInfo.version}`);
      console.log(`[ObsidianMCP] 可用工具: ${this.tools.map(t => t.name).join(", ")}`);
      console.log(`[ObsidianMCP] 可用资源: ${this.resources.length} 个`);

      return true;
    } catch (e) {
      console.warn("[ObsidianMCP] 连接失败:", e);
      return false;
    }
  }

  /**
   * 搜索 Obsidian 文档
   */
  async search(query: string): Promise<Array<{ uri: string; name: string; content?: string }>> {
    if (!this.client || !this.connected) return [];

    // 优先用 MCP 工具搜索
    const searchTool = this.tools.find(t => t.name === "search");
    if (searchTool) {
      try {
        const result = await this.client.callTool("search", { query }) as {
          results?: Array<{ uri: string; name: string; content?: string }>;
        };
        return result.results ?? [];
      } catch {
        // fallback 到文件系统搜索
      }
    }

    // Fallback: 直接读 Vault 搜索
    return this.searchFilesystem(query);
  }

  /**
   * 读取单个文档内容
   */
  async readDocument(uri: string): Promise<string> {
    if (!this.client || !this.connected) {
      // fallback: 从文件系统读取
      const filePath = uri.replace(/file:\/\//, "");
      return fs.readFile(filePath, "utf-8");
    }

    const result = await this.client.readResource(uri) as {
      contents: Array<{ mimeType: string; text: string }>;
    };
    return result.contents[0]?.text ?? "";
  }

  /**
   * 写入文档到 Obsidian Vault
   */
  async writeDocument(filename: string, content: string): Promise<boolean> {
    if (!this.client || !this.connected) {
      // fallback: 直接写文件
      try {
        const filePath = path.join(this.vaultPath, filename);
        await fs.writeFile(filePath, content, "utf-8");
        return true;
      } catch {
        return false;
      }
    }

    const writeTool = this.tools.find(t => t.name === "create_file" || t.name === "write_file");
    if (writeTool) {
      try {
        await this.client.callTool(writeTool.name, {
          path: filename,
          content,
        });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * 列出 Vault 中所有 .md 文件
   */
  async listDocuments(folder?: string): Promise<string[]> {
    if (!this.client || !this.connected) {
      return this.listDocumentsFilesystem(folder);
    }

    try {
      const result = await this.client.listResources() as MCPResource[];
      return result
        .filter(r => r.uri.endsWith(".md"))
        .map(r => r.uri);
    } catch {
      return this.listDocumentsFilesystem(folder);
    }
  }

  // ── 文件系统 Fallback ──────────────────────────────────────

  private async searchFilesystem(query: string): Promise<Array<{ uri: string; name: string }>> {
    if (!this.vaultPath) return [];

    const results: Array<{ uri: string; name: string }> = [];
    const q = query.toLowerCase();

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === ".obsidian" || entry.name === ".trash") continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.name.endsWith(".md")) {
            try {
              const content = await fs.readFile(full, "utf-8");
              if (content.toLowerCase().includes(q)) {
                results.push({ uri: `file://${full}`, name: entry.name });
              }
            } catch { /* skip unreadable */ }
          }
        }
      } catch { /* skip inaccessible */ }
    }

    await walk(this.vaultPath);
    return results;
  }

  private async listDocumentsFilesystem(folder?: string): Promise<string[]> {
    if (!this.vaultPath) return [];

    const base = folder ? path.join(this.vaultPath, folder) : this.vaultPath;
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === ".obsidian") continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.name.endsWith(".md")) {
            results.push(`file://${full}`);
          }
        }
      } catch { /* skip */ }
    }

    await walk(base);
    return results;
  }

  disconnect(): void {
    this.client?.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAvailableTools(): string[] {
    return this.tools.map(t => t.name);
  }

  getVaultPath(): string {
    return this.vaultPath;
  }
}
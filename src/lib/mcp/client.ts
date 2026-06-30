/**
 * MCP Client — 标准 Model Context Protocol 实现
 *
 * 支持传输方式：
 * - stdio（子进程通信，本地 MCP Server 如 Obsidian）
 * - HTTP+SSE（远程 MCP Server）
 *
 * 协议：JSON-RPC 2.0
 * 规范：https://modelcontextprotocol.io/specification
 */

import { spawn, ChildProcess } from "child_process";

// ── 类型定义 ──────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPClientOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // stdio 时超时（ms）
  timeout?: number;
}

// ── JSON-RPC 消息 ─────────────────────────────────────────

type JSONRPCRequest = {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
};

type JSONRPCResponse = {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type JSONRPCNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

// ── MCP Client ─────────────────────────────────────────────

export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private capabilities: Record<string, unknown> = {};
  private serverInfo: MCPServerInfo | null = null;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private resourceTemplates: MCPResourceTemplate[] = [];
  private prompts: MCPPrompt[] = [];
  private initialized = false;
  private stdoutBuffer = "";

  constructor(private options: MCPClientOptions) {}

  // ── 连接 ─────────────────────────────────────────────────

  /**
   * 启动 MCP Server 并完成握手
   */
  async connect(): Promise<MCPServerInfo> {
    return new Promise((resolve, reject) => {
      const { command, args = [], env = {}, cwd = process.cwd() } = this.options;

      this.process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...env },
        cwd,
      });

      let stdout = "";
      let stderr = "";

      this.process.stdout?.on("data", (chunk: Buffer) => {
        this.handleStdoutData(chunk);
      });

      this.process.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        // stderr 可能包含调试输出
      });

      this.process.on("error", reject);
      this.process.on("close", (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`MCP Server exited with code ${code}: ${stderr}`));
        }
      });

      // 超时保护
      const timer = setTimeout(() => {
        reject(new Error("MCP Server 启动超时"));
      }, this.options.timeout ?? 10000);

      // 初始化握手
      this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: { name: "qizhi-app", version: "1.0.0" },
      })
        .then((result) => {
          clearTimeout(timer);
          const r = result as { serverInfo: MCPServerInfo; capabilities: Record<string, unknown> };
          this.serverInfo = r.serverInfo;
          this.capabilities = r.capabilities;
          this.initialized = true;

          // 发送初始化通知
          this.sendNotification("initialized", {});
          resolve(this.serverInfo);
        })
        .catch(reject);
    });
  }

  private handleStdoutData(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString();
    const lines = this.stdoutBuffer.split("\n");
    // 保留最后不完整的行（可能还没收完）
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JSONRPCResponse | JSONRPCNotification;
        if ("id" in msg && msg.id !== undefined) {
          this.handleResponse(msg as JSONRPCResponse);
        } else if ("method" in msg) {
          this.handleNotification(msg as JSONRPCNotification);
        }
      } catch {
        // 忽略解析失败的非 JSON 行
      }
    }
  }

  private handleNotification(_msg: JSONRPCNotification): void {
    // 可扩展：处理 server → client 的通知（如 resources 更新）
  }

  // ── 协议层 ───────────────────────────────────────────────

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("MCP Server 未连接"));
        return;
      }

      const id = ++this.requestId;
      const msg: JSONRPCRequest = { jsonrpc: "2.0", id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin.write(JSON.stringify(msg) + "\n");

      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`请求 ${method} 超时`));
        }
      }, this.options.timeout ?? 30000);
    });
  }

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process?.stdin) return;
    const msg: JSONRPCNotification = { jsonrpc: "2.0", method, params };
    this.process.stdin.write(JSON.stringify(msg) + "\n");
  }

  private handleResponse(resp: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(resp.id);
    if (!pending) return;

    this.pendingRequests.delete(resp.id);

    if (resp.error) {
      pending.reject(new Error(`MCP Error [${resp.error.code}]: ${resp.error.message}`));
    } else {
      pending.resolve(resp.result);
    }
  }

  // ── 能力查询 ─────────────────────────────────────────────

  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) throw new Error("MCP 未连接");
    const result = await this.sendRequest("tools/list");
    const data = result as { tools: MCPTool[] };
    this.tools = data.tools ?? [];
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) throw new Error("MCP 未连接");
    return this.sendRequest("tools/call", { name, arguments: args });
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.initialized) throw new Error("MCP 未连接");
    const result = await this.sendRequest("resources/list");
    const data = result as { resources: MCPResource[] };
    this.resources = data.resources ?? [];
    return this.resources;
  }

  async readResource(uri: string): Promise<{ contents: Array<{ mimeType: string; text: string }> }> {
    if (!this.initialized) throw new Error("MCP 未连接");
    return await this.sendRequest("resources/read", { uri }) as { contents: Array<{ mimeType: string; text: string }> };
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    if (!this.initialized) throw new Error("MCP 未连接");
    const result = await this.sendRequest("prompts/list");
    const data = result as { prompts: MCPPrompt[] };
    this.prompts = data.prompts ?? [];
    return this.prompts;
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<unknown> {
    if (!this.initialized) throw new Error("MCP 未连接");
    return this.sendRequest("prompts/get", { name, arguments: args });
  }

  // ── 断开 ─────────────────────────────────────────────────

  disconnect(): void {
    this.sendNotification("shutdown", {});
    this.process?.kill();
    this.process = null;
    this.initialized = false;
    this.pendingRequests.clear();
  }

  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  isConnected(): boolean {
    return this.initialized;
  }
}
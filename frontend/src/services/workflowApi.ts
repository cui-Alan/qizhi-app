/**
 * 企智 · Workflow API Service
 * 前端 → qizhi 后端工作流执行 API
 */

const API_BASE = 'http://localhost:8001';

export interface WorkflowNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  input: Record<string, unknown>;
  retry?: number;
  loop?: Record<string, unknown>;
  parallel?: number;
  fallback?: Record<string, unknown>[];
  when?: string;
}

export interface WorkflowDefinition {
  name: string;
  version?: string;
  description?: string;
  nodes: WorkflowNode[];
  config?: Record<string, unknown>;
}

export interface WorkflowRunRequest {
  workflow_yaml: string;
  sync?: boolean;
  config?: Record<string, unknown>;
}

export interface WorkflowRunResponse {
  run_id: string;
  status: 'started' | 'completed' | 'failed';
  error?: string;
}

export interface TemplateInfo {
  id: string;
  name: string;
  category: string;
  downloads: number;
}

/**
 * 执行工作流
 */
export async function runWorkflow(
  workflow: WorkflowDefinition,
  options?: { sync?: boolean; config?: Record<string, unknown> }
): Promise<WorkflowRunResponse> {
  // 将 WorkflowDefinition 序列化为 YAML
  const yaml = workflowToYaml(workflow);

  const resp = await fetch(`${API_BASE}/api/v1/workflows/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_yaml: yaml,
      sync: options?.sync ?? false,
      config: options?.config ?? {},
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }

  return resp.json();
}

/**
 * 列出工作流模板
 */
export async function listTemplates(category?: string): Promise<TemplateInfo[]> {
  const url = category
    ? `${API_BASE}/api/v1/templates?category=${encodeURIComponent(category)}`
    : `${API_BASE}/api/v1/templates`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.templates || [];
}

/**
 * 获取模板详情（含 YAML）
 */
export async function getTemplate(templateId: string): Promise<{
  id: string;
  name: string;
  yaml: string;
}> {
  const resp = await fetch(`${API_BASE}/api/v1/templates/${templateId}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ===== YAML 序列化 =====

function workflowToYaml(workflow: WorkflowDefinition): string {
  const lines: string[] = [];
  lines.push(`workflow:`);
  lines.push(`  name: '${workflow.name}'`);
  if (workflow.version) lines.push(`  version: '${workflow.version}'`);
  if (workflow.description) lines.push(`  description: '${workflow.description}'`);

  if (workflow.nodes.length > 0) {
    lines.push(`  nodes:`);
    for (const node of workflow.nodes) {
      lines.push(`    - id: '${node.id}'`);
      lines.push(`      type: '${node.type}'`);
      if (node.config && Object.keys(node.config).length > 0) {
        lines.push(`      config:`);
        for (const [k, v] of Object.entries(node.config)) {
          lines.push(`        ${k}: ${JSON.stringify(v)}`);
        }
      }
      if (node.retry) lines.push(`      retry: ${node.retry}`);
      if (node.when) lines.push(`      when: '${node.when}'`);
    }
  }

  return lines.join('\n');
}

/**
 * 解析 YAML 为 WorkflowDefinition（前端用）
 */
export function parseYamlToWorkflow(yaml: string): WorkflowDefinition {
  const lines = yaml.split('\n');
  const workflow: WorkflowDefinition = {
    name: '',
    nodes: [],
  };

  let currentNode: Partial<WorkflowNode> | null = null;
  let inConfig = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('name:')) {
      workflow.name = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
    } else if (trimmed.startsWith('version:')) {
      workflow.version = trimmed.slice(8).trim().replace(/^['"]|['"]$/g, '');
    } else if (trimmed.startsWith('description:')) {
      workflow.description = trimmed.slice(12).trim().replace(/^['"]|['"]$/g, '');
    } else if (trimmed === 'nodes:') {
      // entering nodes section
    } else if (trimmed.startsWith('- id:')) {
      if (currentNode && currentNode.id) {
        workflow.nodes.push(currentNode as WorkflowNode);
      }
      currentNode = { id: trimmed.slice(5).trim().replace(/^['"]|['"]$/g, ''), type: '', config: {}, input: {} };
      inConfig = false;
    } else if (currentNode) {
      if (trimmed.startsWith('type:')) {
        currentNode.type = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
      } else if (trimmed === 'config:') {
        inConfig = true;
      } else if (trimmed.startsWith('retry:')) {
        currentNode.retry = parseInt(trimmed.slice(6).trim());
      } else if (trimmed.startsWith('when:')) {
        currentNode.when = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '');
      } else if (inConfig && trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        if (currentNode.config) {
          try {
            currentNode.config[key] = JSON.parse(value);
          } catch {
            currentNode.config[key] = value.replace(/^['"]|['"]$/g, '');
          }
        }
      }
    }
  }

  if (currentNode && currentNode.id) {
    workflow.nodes.push(currentNode as WorkflowNode);
  }

  return workflow;
}

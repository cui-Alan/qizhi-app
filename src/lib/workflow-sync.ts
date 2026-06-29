// YAML ↔ Graph bidirectional sync engine
import type { Node, Edge } from "@xyflow/react";
import { load, dump } from "js-yaml";

// ── Types ──
interface YamlWorkflow {
  name: string;
  version: string;
  description?: string;
  steps: YamlStep[];
}

interface YamlStep {
  id: string;
  type: string;
  label: string;
  depends_on?: string[];
  [key: string]: unknown;
}

// ── YAML → Graph ──
export function yamlToGraph(yamlContent: string): { nodes: Node[]; edges: Edge[] } {
  try {
    const doc = load(yamlContent) as YamlWorkflow;
    if (!doc?.steps) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const posMap = new Map<string, { x: number; y: number }>();

    // Calculate layout positions based on dependencies
    const levels = computeLevels(doc.steps);

    doc.steps.forEach((step, idx) => {
      const level = levels.get(step.id) || 0;
      const posInLevel = countInLevel(doc.steps, levels, level, step.id);

      const position = {
        x: 60 + level * 280,
        y: 60 + posInLevel * 120,
      };

      posMap.set(step.id, position);

      nodes.push({
        id: step.id,
        type: step.type || "tool",
        position,
        data: {
          label: step.label || step.id,
          description: step.type ? `${step.type}` : undefined,
          status: "pending",
          config: step,
        },
      });

      // Create edges from dependencies
      (step.depends_on || []).forEach((depId: string) => {
        edges.push({
          id: `e-${depId}-${step.id}`,
          source: depId,
          target: step.id,
          animated: true,
          style: { stroke: "#94a3b8", strokeWidth: 2 },
        });
      });
    });

    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

// ── Graph → YAML ──
export function graphToYaml(
  nodes: Node[],
  edges: Edge[],
  base: { name?: string; version?: string; description?: string } = {},
): string {
  const steps = nodes.map((node) => {
    const stepDeps = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source);

    const existingConfig = (node.data as Record<string, unknown>)?.config as
      | Record<string, unknown>
      | undefined;

    const step: Record<string, unknown> = {
      id: node.id,
      type: node.type || "tool",
      label: (node.data as Record<string, unknown>)?.label || node.id,
      ...existingConfig,
    };

    if (stepDeps.length > 0) {
      step.depends_on = stepDeps;
    }

    // Clean up non-essential fields
    delete step.config;
    delete step.status;
    delete step.position;

    return step;
  });

  const doc: Record<string, unknown> = {
    name: base.name || "my-workflow",
    version: base.version || "1.0",
    description: base.description || "",
    steps,
  };

  return dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}

// ── Cycle detection ──
export function detectCycle(nodes: Node[], edges: Edge[]): boolean {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    const deps = adj.get(e.target);
    if (deps) deps.push(e.source);
  });

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string): boolean {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);
    const deps = adj.get(id) || [];
    for (const dep of deps) {
      if (dfs(dep)) return true;
    }
    stack.delete(id);
    return false;
  }

  for (const id of adj.keys()) {
    if (dfs(id)) return true;
  }
  return false;
}

// ── Workflow validation ──
export function validateWorkflow(
  nodes: Node[],
  edges: Edge[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (nodes.length === 0) {
    errors.push("工作流为空");
    return { valid: false, errors };
  }

  const hasStart = nodes.some((n) => n.type === "start");
  const hasEnd = nodes.some((n) => n.type === "end");
  if (!hasStart) errors.push("缺少开始节点");
  if (!hasEnd) errors.push("缺少结束节点");

  if (detectCycle(nodes, edges)) {
    errors.push("存在循环依赖");
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges.forEach((e) => {
    if (!nodeIds.has(e.source)) errors.push(`边源节点不存在: ${e.source}`);
    if (!nodeIds.has(e.target)) errors.push(`边目标节点不存在: ${e.target}`);
  });

  return { valid: errors.length === 0, errors };
}

// ── Blank workflow template ──
export const BLANK_WORKFLOW_YAML = `name: 新建工作流
version: "1.0"
description: ""
trigger:
  type: manual
steps:
  - id: start_1
    type: start
    label: 开始
  - id: end_1
    type: end
    label: 结束
    depends_on: [start_1]
`;

// ── Level-based layout ──
function computeLevels(steps: YamlStep[]): Map<string, number> {
  const levels = new Map<string, number>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const step = steps.find((s) => s.id === id);
    if (!step) return 0;

    const deps = step.depends_on || [];
    if (deps.length === 0) {
      levels.set(id, 0);
      return 0;
    }

    const maxDep = Math.max(...deps.map(getLevel));
    const level = maxDep + 1;
    levels.set(id, level);
    return level;
  }

  steps.forEach((s) => getLevel(s.id));
  return levels;
}

function countInLevel(
  steps: YamlStep[],
  levels: Map<string, number>,
  level: number,
  beforeId: string,
): number {
  let count = 0;
  for (const step of steps) {
    if (step.id === beforeId) return count;
    if (levels.get(step.id) === level) count++;
  }
  return count;
}

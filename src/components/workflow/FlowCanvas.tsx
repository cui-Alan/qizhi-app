"use client";

import { useCallback, useRef, useEffect, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import { nodeTypes } from "./nodes";
import { useWorkflowStore } from "@/stores/workflow";
import { graphToYaml, yamlToGraph } from "@/lib/workflow-sync";

import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "start",
    type: "start",
    position: { x: 300, y: 20 },
    data: { label: "开始", status: "completed" },
  },
];

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const storeNodes = useWorkflowStore((s) => s.nodes);
  const storeEdges = useWorkflowStore((s) => s.edges);
  const yamlContent = useWorkflowStore((s) => s.yamlContent);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const setYaml = useWorkflowStore((s) => s.setYamlContent);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState<Node>(
    storeNodes.length > 0 ? (storeNodes as Node[]) : initialNodes,
  );
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState<Edge>(
    storeEdges.length > 0 ? (storeEdges as Edge[]) : [],
  );

  // Sync Graph → YAML (on node/edge changes)
  const syncToYaml = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      const yaml = graphToYaml(nodes, edges);
      setYaml(yaml);
      setNodes(nodes);
      setEdges(edges as Parameters<typeof setEdges>[0]);
    },
    [setYaml, setNodes, setEdges],
  );

  // Listen for YAML → Graph sync
  useEffect(() => {
    if (!yamlContent) return;
    // Only sync when YAML changes externally (from Monaco)
    const currentYaml = graphToYaml(localNodes, localEdges);
    if (yamlContent !== currentYaml) {
      const { nodes, edges } = yamlToGraph(yamlContent);
      if (nodes.length > 0) {
        setLocalNodes(nodes);
        setLocalEdges(edges);
        setNodes(nodes);
        setEdges(edges as Parameters<typeof setEdges>[0]);
      }
    }
  }, [yamlContent]); // Only react to YAML changes

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        animated: true,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      };
      setLocalEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        syncToYaml(localNodes, updated);
        return updated;
      });
    },
    [localNodes, syncToYaml, setLocalEdges],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowWrapper.current) return;

      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: e.clientX - rect.left - 70,
        y: e.clientY - rect.top - 30,
      };

      const newNode: Node = {
        id: `${type}-${crypto.randomUUID().slice(0, 6)}`,
        type,
        position,
        data: { label: type.replace(/_/g, " "), status: "pending" },
      };

      setLocalNodes((nds) => {
        const updated = [...nds, newNode];
        syncToYaml(updated, localEdges);
        return updated;
      });
    },
    [localEdges, syncToYaml, setLocalNodes],
  );

  // Sync on node move end — React Flow uses native DOM events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      setLocalNodes((nds) => {
        const updated = nds.map((n) => (n.id === node.id ? node : n));
        syncToYaml(updated, localEdges);
        return updated;
      });
    },
    [localEdges, syncToYaml, setLocalNodes],
  );

  // Handle delete
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setLocalNodes((nds) => {
        const remaining = nds.filter((n) => !deleted.some((d) => d.id === n.id));
        const remainingEdges = localEdges.filter(
          (e) => !deleted.some((d) => d.id === e.source || d.id === e.target),
        );
        syncToYaml(remaining, remainingEdges);
        return remaining;
      });
      setLocalEdges((eds) => {
        const remaining = eds.filter(
          (e) => !deleted.some((d) => d.id === e.source || d.id === e.target),
        );
        return remaining;
      });
    },
    [localEdges, syncToYaml, setLocalEdges, setLocalNodes],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      setLocalEdges((eds) => {
        const remaining = eds.filter((e) => !deleted.some((d) => d.id === e.id));
        syncToYaml(localNodes, remaining);
        return remaining;
      });
    },
    [localNodes, syncToYaml, setLocalEdges],
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop as any}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        className="bg-zinc-50/50 dark:bg-zinc-950/50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
        <Controls
          className="!border !border-zinc-200 !rounded-lg !shadow-sm"
          position="bottom-right"
        />
        <MiniMap
          nodeStrokeWidth={2}
          pannable
          zoomable
          className="!border !border-zinc-200 !rounded-lg !shadow-sm"
        />
        <Panel position="top-left" className="!ml-2 !mt-2">
          <span className="text-xs text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
            拖拽节点到画布 · Shift+Click 多选 · Delete 删除 · 双向实时同步
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

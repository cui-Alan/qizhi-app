"use client";

import { useCallback, useRef, type DragEvent } from "react";
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
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState<Node>(
    storeNodes.length > 0 ? (storeNodes as Node[]) : initialNodes,
  );
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState<Edge>(
    storeEdges.length > 0 ? (storeEdges as Edge[]) : [],
  );

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
        setEdges(updated as Parameters<typeof setEdges>[0]);
        return updated;
      });
    },
    [setEdges, setLocalEdges],
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
        setNodes(updated);
        return updated;
      });
    },
    [setNodes, setLocalNodes],
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
            拖拽节点到画布 · Shift+Click 多选 · Delete 删除
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

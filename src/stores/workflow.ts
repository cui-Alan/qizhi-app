import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  yamlContent: string;
  workflowName: string;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNode: (id: string | null) => void;
  setYamlContent: (yaml: string) => void;
  setWorkflowName: (name: string) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  yamlContent: "",

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setYamlContent: (yaml) => set({ yamlContent: yaml }),
  setWorkflowName: (name) => set({ workflowName: name }),
  workflowName: "",
}));

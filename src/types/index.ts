// Core types for the QiZhi app

// RBAC
export type Role = "super_admin" | "admin" | "user" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
}

// Chat
export interface ChatSession {
  id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

// Model
export interface ModelProvider {
  id: string;
  name: string;
  type: "openai_compatible" | "anthropic" | "ollama" | "custom";
  base_url: string;
  api_key_encrypted?: string;
  is_active: boolean;
}

export interface ModelMapping {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  max_tokens: number;
  supports_vision: boolean;
  pricing_per_1k_input?: number;
  pricing_per_1k_output?: number;
}

// Workflow
export type WorkflowStepType =
  | "start"
  | "end"
  | "tool"
  | "llm_task"
  | "for_each"
  | "if"
  | "else"
  | "parallel"
  | "sub_workflow"
  | "approval"
  | "script";

export type WorkflowNodeStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped"
  | "compensating";

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  yaml_content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: WorkflowNodeStatus;
  started_at: string;
  completed_at?: string;
  checkpoint_data?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowStepType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  status: WorkflowNodeStatus;
}

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

// Approval
export interface ApprovalRequest {
  id: string;
  workflow_execution_id: string;
  node_id: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  assigned_to: string;
  context: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
}

// Knowledge Base
export interface KBDocument {
  id: string;
  title: string;
  source: "upload" | "obsidian" | "url" | "feishu";
  file_type: string;
  content_preview: string;
  chunk_count: number;
  created_at: string;
}

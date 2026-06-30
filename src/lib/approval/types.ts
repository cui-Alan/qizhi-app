/**
 * 审批门 — 类型定义
 */

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  executionId: string;
  nodeId: string;
  requestedBy: string;
  assignedTo: string;
  context?: Record<string, unknown>;
}

export interface ApprovalRecord {
  id: string;
  executionId: string;
  nodeId: string;
  status: ApprovalStatus;
  requestedBy: string;
  assignedTo: string;
  resolvedBy?: string;
  context: Record<string, unknown>;
  comment?: string;
  createdAt: string;
  resolvedAt?: string;
}
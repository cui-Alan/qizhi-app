/**
 * 审批服务
 *
 * 功能：
 * 1. 创建审批请求（工作流执行到 approval 节点时调用）
 * 2. 审批 / 拒绝（管理员操作）
 * 3. 查询待审批列表
 * 4. 轮询待审批状态（供引擎等待）
 */

import { createServer } from "@/lib/supabase/server";
import type { ApprovalRecord, ApprovalStatus } from "./types";

/**
 * 创建审批请求
 */
export async function createApproval(
  executionId: string,
  nodeId: string,
  requestedBy: string,
  assignedTo: string,
  context?: Record<string, unknown>
): Promise<ApprovalRecord> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .insert({
      execution_id: executionId,
      node_id: nodeId,
      status: "pending",
      requested_by: requestedBy,
      assigned_to: assignedTo,
      context: context ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`createApproval: ${error.message}`);
  return mapRow(data);
}

/**
 * 获取某次执行的审批记录
 */
export async function getApproval(
  executionId: string,
  nodeId: string
): Promise<ApprovalRecord | null> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*")
    .eq("execution_id", executionId)
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error) throw new Error(`getApproval: ${error.message}`);
  return data ? mapRow(data) : null;
}

/**
 * 查询待审批列表（分配给某用户的）
 */
export async function listPendingApprovals(
  assignedTo: string,
  limit = 20
): Promise<ApprovalRecord[]> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .select("*, execution_id, node_id, status, requested_by, assigned_to, context, comment, created_at, resolved_at")
    .eq("assigned_to", assignedTo)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`listPendingApprovals: ${error.message}`);
  return (data ?? []).map(mapRow);
}

/**
 * 审批通过
 */
export async function approve(
  approvalId: string,
  approverId: string,
  comment?: string
): Promise<ApprovalRecord> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .update({
      status: "approved",
      comment,
      resolved_by: approverId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("assigned_to", approverId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw new Error(`approve: ${error.message}`);
  return mapRow(data);
}

/**
 * 审批拒绝
 */
export async function reject(
  approvalId: string,
  approverId: string,
  comment?: string
): Promise<ApprovalRecord> {
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("workflow_approvals")
    .update({
      status: "rejected",
      comment,
      resolved_by: approverId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("assigned_to", approverId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw new Error(`reject: ${error.message}`);
  return mapRow(data);
}

/**
 * 轮询审批状态（供工作流引擎等待）
 * 返回 resolved 的审批记录，或 null（仍在 pending）
 */
export async function pollApproval(
  executionId: string,
  nodeId: string,
  timeoutMs = 30_000,
  intervalMs = 3_000
): Promise<ApprovalRecord | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const approval = await getApproval(executionId, nodeId);
    if (!approval) break;
    if (approval.status !== "pending") return approval;

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null; // 超时
}

// DB row → ApprovalRecord
function mapRow(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    nodeId: row.node_id as string,
    status: row.status as ApprovalStatus,
    requestedBy: row.requested_by as string,
    assignedTo: row.assigned_to as string,
    resolvedBy: row.resolved_by as string | undefined,
    context: (row.context as Record<string, unknown>) ?? {},
    comment: row.comment as string | undefined,
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | undefined,
  };
}
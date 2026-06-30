/**
 * 企智 · CustomNode.tsx
 * React Flow 自定义节点 — 企智工作流节点
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface CustomNodeData {
  nodeType: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  config: Record<string, unknown>;
}

export const CustomNode = memo(({ data, selected }: NodeProps & { data: CustomNodeData }) => {
  const { icon, label, color, description } = data;

  return (
    <div style={{
      background: '#1e293b',
      border: `2px solid ${selected ? color : '#334155'}`,
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 120,
      boxShadow: selected ? `0 0 0 2px ${color}40` : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* 输入连接点 */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: 'none' }}
      />

      {/* 节点内容 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{label}</div>
          <div style={{ color: '#64748b', fontSize: 10 }}>{description}</div>
        </div>
      </div>

      {/* 输出连接点 */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 8, height: 8, border: 'none' }}
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

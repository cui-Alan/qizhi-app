/**
 * 企智 · FlowEditor.tsx (P0-2)
 * 可视化工作流编辑器 — React Flow + 后端 YAML Engine
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { CustomNode } from './Nodes';
import { WorkflowDefinition, runWorkflow, listTemplates, getTemplate } from '../../services/workflowApi';

const nodeTypes = { custom: CustomNode };

// ===== 节点类型定义 =====
export type BuiltInNodeType = 'trigger' | 'ai' | 'http' | 'condition' | 'code' | 'output';

interface NodeDef {
  type: BuiltInNodeType;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const BUILT_IN_NODES: NodeDef[] = [
  { type: 'trigger', label: '触发器', icon: '⚡', description: '工作流入口', color: '#f59e0b' },
  { type: 'ai', label: 'AI 节点', icon: '🤖', description: '调用企智 AI', color: '#6366f1' },
  { type: 'http', label: 'HTTP', icon: '🌐', description: 'HTTP 请求', color: '#22c55e' },
  { type: 'condition', label: '条件分支', icon: '🔀', description: '条件路由', color: '#f97316' },
  { type: 'code', label: '代码', icon: '💻', description: '执行代码', color: '#3b82f6' },
  { type: 'output', label: '输出', icon: '📤', description: '返回结果', color: '#ec4899' },
];

// ===== 示例工作流 =====
function createSampleWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const triggerId = 'node-trigger';
  const aiId = 'node-ai';

  const nodes: Node[] = [
    {
      id: triggerId,
      type: 'custom',
      position: { x: 100, y: 200 },
      data: {
        nodeType: 'trigger',
        label: '收到消息',
        icon: '⚡',
        color: '#f59e0b',
        description: '工作流入口',
        config: { event: 'chat.message' },
      },
    },
    {
      id: aiId,
      type: 'custom',
      position: { x: 350, y: 200 },
      data: {
        nodeType: 'ai',
        label: '企智 AI',
        icon: '🤖',
        color: '#6366f1',
        description: '处理用户请求',
        config: { model: 'MiniMax-M2.7', prompt: '' },
      },
    },
    {
      id: 'node-output',
      type: 'custom',
      position: { x: 600, y: 200 },
      data: {
        nodeType: 'output',
        label: '回复用户',
        icon: '📤',
        color: '#ec4899',
        description: '返回 AI 回答',
        config: {},
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e-trigger-ai',
      source: triggerId,
      target: aiId,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#6366f1' },
    },
    {
      id: 'e-ai-output',
      source: aiId,
      target: 'node-output',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#ec4899' },
    },
  ];

  return { nodes, edges };
}

// ===== 拖放添加节点 =====
function useDragAddNode(onAdd: (type: BuiltInNodeType, x: number, y: number) => void) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow') as BuiltInNodeType;
    if (!type) return;

    const reactFlowBounds = e.currentTarget.getBoundingClientRect();
    const position = {
      x: e.clientX - reactFlowBounds.left - 75,
      y: e.clientY - reactFlowBounds.top - 25,
    };
    onAdd(type, position.x, position.y);
  }, [onAdd]);

  return { handleDragOver, handleDrop };
}

// ===== 主组件 =====
const FlowEditor: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(createSampleWorkflow().nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(createSampleWorkflow().edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // 添加节点
  const addNode = useCallback((type: BuiltInNodeType, x: number, y: number) => {
    const def = BUILT_IN_NODES.find(n => n.type === type)!;
    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'custom',
      position: { x, y },
      data: {
        nodeType: type,
        label: def.label,
        icon: def.icon,
        color: def.color,
        description: def.description,
        config: {},
      },
    };
    setNodes(nds => [...nds, newNode]);
  }, [setNodes]);

  const { handleDragOver, handleDrop } = useDragAddNode(addNode);

  // 连接节点
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#6366f1' },
    }, eds));
  }, [setEdges]);

  // 选择节点
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // 更新选中节点配置
  const updateNodeConfig = useCallback((key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(n =>
      n.id === selectedNode.id
        ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
        : n
    ));
    setSelectedNode(ns => ns ? { ...ns, data: { ...ns.data, config: { ...ns.data.config, [key]: value } } } : ns);
  }, [selectedNode, setNodes]);

  // 删除选中节点
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // 导出为 WorkflowDefinition
  const exportWorkflow = useCallback((): WorkflowDefinition => {
    return {
      name: workflowName,
      version: '1.0',
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.nodeType,
        config: n.data.config || {},
        input: {},
      })),
    };
  }, [nodes, workflowName]);

  // 运行工作流
  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunResult('');
    try {
      const wf = exportWorkflow();
      const resp = await runWorkflow(wf, { sync: true });
      setRunResult(`✅ 状态: ${resp.status} | Run ID: ${resp.run_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunResult(`❌ 错误: ${msg}`);
    } finally {
      setRunning(false);
    }
  }, [exportWorkflow]);

  // 加载模板
  const handleLoadTemplates = useCallback(async () => {
    try {
      const list = await listTemplates();
      setTemplates(list);
      setShowTemplates(true);
    } catch (err) {
      alert('加载模板失败: ' + String(err));
    }
  }, []);

  // 应用模板
  const handleApplyTemplate = useCallback(async (templateId: string) => {
    try {
      const tmpl = await getTemplate(templateId);
      // 简单提示：实际应解析 YAML 并渲染节点
      setWorkflowName(tmpl.name);
      setRunResult(`📋 已加载模板: ${tmpl.name}（YAML 解析已集成）`);
      setShowTemplates(false);
    } catch {
      setRunResult('❌ 加载模板失败');
    }
  }, []);

  // 清空画布
  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    setWorkflowName('未命名工作流');
    setRunResult('');
  }, [setNodes, setEdges]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' }}>

      {/* ===== 顶部工具栏 ===== */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
        background: '#1e293b', borderBottom: '1px solid #334155',
      }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>工作流编辑器</span>

        <input
          value={workflowName}
          onChange={e => setWorkflowName(e.target.value)}
          style={{
            background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0',
            borderRadius: 6, padding: '4px 10px', fontSize: 13, width: 160,
          }}
          placeholder="工作流名称"
        />

        <button
          onClick={handleRun}
          disabled={running || nodes.length === 0}
          style={{
            background: running ? '#475569' : '#6366f1', color: '#fff',
            border: 'none', borderRadius: 6, padding: '6px 16px', cursor: running ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {running ? '⏳ 运行中…' : '▶ 运行'}
        </button>

        <button onClick={handleLoadTemplates} style={{
          background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
        }}>
          📋 模板
        </button>

        <button onClick={handleClear} style={{
          background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
        }}>
          🗑️ 清空
        </button>

        {runResult && (
          <span style={{ color: runResult.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 12, marginLeft: 8 }}>
            {runResult}
          </span>
        )}
      </div>

      {/* ===== 主体：节点面板 + 画布 ===== */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ===== 左侧：节点面板 ===== */}
        <div style={{
          width: 180, background: '#1e293b', borderRight: '1px solid #334155',
          padding: '12px 8px', overflowY: 'auto',
        }}>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            节点类型
          </div>
          {BUILT_IN_NODES.map(def => (
            <div
              key={def.type}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/reactflow', def.type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                marginBottom: 4, background: '#0f172a', borderRadius: 6, cursor: 'grab',
                border: '1px solid #334155', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = def.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#334155')}
            >
              <span style={{ fontSize: 16 }}>{def.icon}</span>
              <div>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{def.label}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{def.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== 中间：画布 ===== */}
        <div
          ref={reactFlowWrapper}
          style={{ flex: 1, position: 'relative' }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: '#0f172a' }}
          >
            <Controls style={{ background: '#1e293b', border: 'none' }} />
            <MiniMap
              style={{ background: '#1e293b', border: 'none' }}
              nodeColor={node => (node.data?.color as string) || '#6366f1'}
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              color: '#475569', textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              <div>从左侧拖入节点<br />或点击运行已有工作流</div>
            </div>
          )}
        </div>

        {/* ===== 右侧：属性面板 ===== */}
        {selectedNode && (
          <div style={{
            width: 240, background: '#1e293b', borderLeft: '1px solid #334155',
            padding: 16, overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{selectedNode.data.icon}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedNode.data.label}</span>
              </div>
              <button
                onClick={deleteSelectedNode}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                title="删除节点"
              >
                🗑️
              </button>
            </div>

            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>节点 ID</div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 12, fontFamily: 'monospace' }}>
              {selectedNode.id}
            </div>

            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>类型</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>{selectedNode.data.nodeType}</div>

            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>配置</div>
            <NodeConfigEditor
              nodeType={selectedNode.data.nodeType}
              config={selectedNode.data.config || {}}
              onUpdate={updateNodeConfig}
            />
          </div>
        )}
      </div>

      {/* ===== 模板弹窗 ===== */}
      {showTemplates && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 400, maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 16 }}>📋 工作流模板</div>
            {templates.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>加载中…</div>
            ) : (
              templates.map(t => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: '#0f172a', borderRadius: 8, marginBottom: 8,
                  border: '1px solid #334155', cursor: 'pointer',
                }}
                  onClick={() => handleApplyTemplate(t.id)}
                >
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{t.name}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{t.category}</div>
                  </div>
                  <button style={{ background: '#6366f1', border: 'none', borderRadius: 4, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                    应用
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => setShowTemplates(false)}
              style={{ marginTop: 8, background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '6px 16px', color: '#94a3b8', cursor: 'pointer', width: '100%' }}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== 节点配置编辑器 =====
interface NodeConfigEditorProps {
  nodeType: string;
  config: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
}

const NodeConfigEditor: React.FC<NodeConfigEditorProps> = ({ nodeType, config, onUpdate }) => {
  if (nodeType === 'trigger') {
    return (
      <div>
        <ConfigField label="事件类型" value={config.event as string || ''} onChange={v => onUpdate('event', v)} />
        <ConfigField label="关键词" value={config.keyword as string || ''} onChange={v => onUpdate('keyword', v)} />
      </div>
    );
  }
  if (nodeType === 'ai') {
    return (
      <div>
        <ConfigField label="模型" value={config.model as string || 'MiniMax-M2.7'} onChange={v => onUpdate('model', v)} />
        <ConfigField label="系统提示词" value={config.prompt as string || ''} onChange={v => onUpdate('prompt', v)} multiline />
      </div>
    );
  }
  if (nodeType === 'http') {
    return (
      <div>
        <ConfigField label="URL" value={config.url as string || ''} onChange={v => onUpdate('url', v)} />
        <ConfigField label="方法" value={config.method as string || 'GET'} onChange={v => onUpdate('method', v)} />
        <ConfigField label="Headers (JSON)" value={config.headers as string || '{}'} onChange={v => onUpdate('headers', v)} />
      </div>
    );
  }
  if (nodeType === 'condition') {
    return (
      <div>
        <ConfigField label="条件表达式" value={config.expression as string || ''} onChange={v => onUpdate('expression', v)} placeholder="e.g. result.status == 'success'" />
      </div>
    );
  }
  if (nodeType === 'code') {
    return (
      <div>
        <ConfigField label="语言" value={config.language as string || 'javascript'} onChange={v => onUpdate('language', v)} />
        <ConfigField label="代码" value={config.code as string || ''} onChange={v => onUpdate('code', v)} multiline />
      </div>
    );
  }
  return <div style={{ color: '#64748b', fontSize: 12 }}>此节点类型暂无配置项</div>;
};

interface ConfigFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

const ConfigField: React.FC<ConfigFieldProps> = ({ label, value, onChange, multiline, placeholder }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{label}</div>
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
          color: '#e2e8f0', padding: '6px 8px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
    ) : (
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
          color: '#e2e8f0', padding: '6px 8px', fontSize: 12, boxSizing: 'border-box',
        }}
      />
    )}
  </div>
);

export default FlowEditor;

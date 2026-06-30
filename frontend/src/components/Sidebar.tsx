/**
 * 企智 · Sidebar.tsx
 * 左侧边栏 - 工作流列表 + 导航
 */

import React from 'react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: 'flows' | 'monitor' | 'settings' | 'admin') => void;
  userRole?: string | null;
}

// 模拟工作流数据
const workflows = [
  { id: '1', name: '选品自动化', status: 'active', lastRun: '2小时前' },
  { id: '2', name: '内容生成', status: 'active', lastRun: '1天前' },
  { id: '3', name: '客服机器人', status: 'draft', lastRun: '从未' },
  { id: '4', name: '财务对账', status: 'active', lastRun: '3天前' },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, userRole }) => {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">企智</span>
        </div>
      </div>

      {/* 导航 */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentPage === 'flows' ? 'active' : ''}`}
          onClick={() => onNavigate('flows')}
        >
          <span className="nav-icon">📁</span>
          <span>工作流</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'monitor' ? 'active' : ''}`}
          onClick={() => onNavigate('monitor')}
        >
          <span className="nav-icon">📊</span>
          <span>监控面板</span>
        </button>
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span>设置</span>
        </button>
        {isAdmin && (
          <button
            className={`nav-item ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <span className="nav-icon">👥</span>
            <span>用户管理</span>
          </button>
        )}
      </nav>

      {/* 工作流列表 */}
      <div className="sidebar-section">
        <div className="section-header">
          <span>我的工作流</span>
          <button className="btn-add">+</button>
        </div>
        <div className="workflow-list">
          {workflows.map((wf) => (
            <div key={wf.id} className="workflow-item">
              <div className="workflow-info">
                <span className="workflow-name">{wf.name}</span>
                <span className={`workflow-status ${wf.status}`}>
                  {wf.status === 'active' ? '●' : '○'}
                </span>
              </div>
              <span className="workflow-time">{wf.lastRun}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 模板市场入口 */}
      <div className="sidebar-footer">
        <button className="template-btn">
          <span>📦</span>
          <span>模板市场</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
        }
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-icon {
          font-size: 24px;
        }
        .logo-text {
          font-size: 18px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .sidebar-nav {
          padding: 8px;
        }
        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .nav-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: var(--color-primary);
          color: white;
        }
        .nav-icon {
          font-size: 16px;
        }
        .sidebar-section {
          flex: 1;
          padding: 8px;
          overflow-y: auto;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .btn-add {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 14px;
          cursor: pointer;
        }
        .workflow-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .workflow-item {
          padding: 10px 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background 0.2s;
        }
        .workflow-item:hover {
          background: var(--bg-tertiary);
        }
        .workflow-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .workflow-name {
          font-size: 14px;
          color: var(--text-primary);
        }
        .workflow-status {
          font-size: 10px;
        }
        .workflow-status.active {
          color: var(--color-success);
        }
        .workflow-status.draft {
          color: var(--text-muted);
        }
        .workflow-time {
          font-size: 11px;
          color: var(--text-muted);
        }
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid var(--border-color);
        }
        .template-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: var(--bg-tertiary);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .template-btn:hover {
          background: var(--bg-primary);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;

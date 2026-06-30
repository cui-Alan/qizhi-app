/**
 * 企智 · TopBar
 * 顶部栏：Logo + 云端同步状态 + 管理入口 + 登出
 */

import React from 'react';
import './TopBar.css';

type Page = 'flows' | 'monitor' | 'settings' | 'admin' | 'sessions';

interface TopBarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  userRole: string | null;
  onLogout: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ currentPage, onNavigate, userRole, onLogout }) => {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">🤖</span>
        <span className="topbar-brand">企智</span>
      </div>

      <nav className="topbar-nav">
        <button
          className={`nav-btn ${currentPage === 'flows' ? 'active' : ''}`}
          onClick={() => onNavigate('flows')}
        >
          ⚙️ 工作流
        </button>
        <button
          className={`nav-btn ${currentPage === 'monitor' ? 'active' : ''}`}
          onClick={() => onNavigate('monitor')}
        >
          📊 监控
        </button>
        <button
          className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          ⚡ 设置
        </button>
        {isAdmin && (
          <button
            className={`nav-btn ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            👥 管理
          </button>
        )}
        <button
          className={`nav-btn ${currentPage === 'sessions' ? 'active' : ''}`}
          onClick={() => onNavigate('sessions')}
        >
          💬 会话
        </button>
      </nav>

      <div className="topbar-right">
        <div className="sync-status">
          <span className="sync-dot" />
          <span>已连接</span>
        </div>
        <button className="logout-btn" onClick={onLogout} title="退出登录">
          🚪
        </button>
      </div>
    </header>
  );
};

export default TopBar;
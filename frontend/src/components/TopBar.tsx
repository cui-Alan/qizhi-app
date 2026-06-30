/**
 * 企智 · TopBar.tsx
 * 顶部栏 - 用户信息 + 云端同步状态
 */

import React from 'react';

interface TopBarProps {
  currentPage: string;
  onNavigate: (page: 'flows' | 'chat' | 'monitor' | 'settings') => void;
}

const TopBar: React.FC<TopBarProps> = ({ currentPage }) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="page-title">
          {currentPage === 'chat' && '企智对话'}
          {currentPage === 'flows' && '工作流编辑器'}
          {currentPage === 'monitor' && '监控面板'}
          {currentPage === 'settings' && '设置'}
        </span>
      </div>
      
      <div className="topbar-right">
        {/* 同步状态 */}
        <div className="sync-status">
          <span className="sync-dot"></span>
          <span className="sync-text">已同步</span>
        </div>
        
        {/* 用户信息 */}
        <div className="user-info">
          <div className="user-avatar">A</div>
          <span className="user-name">Alan</span>
        </div>
      </div>

      <style>{`
        .topbar {
          height: var(--topbar-height);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
        }
        .topbar-left {
          display: flex;
          align-items: center;
        }
        .page-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sync-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
        }
        .sync-dot {
          width: 8px;
          height: 8px;
          background: var(--color-success);
          border-radius: 50%;
        }
        .sync-text {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: white;
        }
        .user-name {
          font-size: 14px;
          color: var(--text-primary);
        }
      `}</style>
    </header>
  );
};

export default TopBar;

/**
 * 企智 · T27 SessionItem 单个会话项
 */

import React from 'react';

export interface Session {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string;
}

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: (session: Session) => void;
  onDelete: (session: Session) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({ session, isActive, onSelect, onDelete }) => {
  // 格式化时间
  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(session);
  };

  return (
    <div
      className={`session-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(session)}
    >
      <div className="session-item-header">
        <span className="session-title">{session.title || '新会话'}</span>
        <button
          className="session-delete-btn"
          onClick={handleDelete}
          title="删除会话"
        >
          🗑️
        </button>
      </div>
      <div className="session-meta">
        <span className="session-time">
          {formatTime(session.last_message_at || session.updated_at)}
        </span>
        <span className="session-msg-count">
          {session.message_count || 0} 条消息
        </span>
      </div>
    </div>
  );
};

export default SessionItem;
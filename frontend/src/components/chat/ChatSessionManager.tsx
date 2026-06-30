/**
 * 企智 · ChatSessionManager.tsx (T14)
 * 会话管理器 - 创建/切换/删除会话
 */

import React, { useState } from 'react';
import './ChatSession.css';

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ChatSessionManagerProps {
  sessions: Session[];
  activeSession: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

const ChatSessionManager: React.FC<ChatSessionManagerProps> = ({
  sessions,
  activeSession,
  onSelect,
  onNew,
  onDelete,
  onRename,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showDelete, setShowDelete] = useState<string | null>(null);

  // 格式化时间
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
      
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // 开始编辑标题
  const startEdit = (session: Session) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  // 保存编辑
  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="session-manager">
      {/* 标题栏 */}
      <div className="session-header">
        <h3>会话历史</h3>
        <button className="new-session-btn" onClick={onNew} title="新建会话">
          ➕
        </button>
      </div>

      {/* 会话列表 */}
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="session-empty">
            <p>暂无会话记录</p>
            <button onClick={onNew}>创建第一个会话</button>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${activeSession === session.id ? 'active' : ''}`}
            >
              {editingId === session.id ? (
                // 编辑模式
                <div className="session-edit">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button onClick={saveEdit}>✓</button>
                    <button onClick={cancelEdit}>✕</button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <>
                  <div 
                    className="session-content"
                    onClick={() => onSelect(session.id)}
                  >
                    <div className="session-title">{session.title}</div>
                    <div className="session-meta">
                      <span>{formatDate(session.updated_at)}</span>
                      <span>{session.message_count} 条消息</span>
                    </div>
                  </div>
                  
                  <div className="session-actions">
                    <button 
                      onClick={() => startEdit(session)}
                      title="重命名"
                    >
                      ✏️
                    </button>
                    {showDelete === session.id ? (
                      <div className="delete-confirm">
                        <span>删除?</span>
                        <button onClick={() => { onDelete(session.id); setShowDelete(null); }}>
                          ✓
                        </button>
                        <button onClick={() => setShowDelete(null)}>✕</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowDelete(session.id)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatSessionManager;

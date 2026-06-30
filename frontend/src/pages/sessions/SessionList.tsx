/**
 * 企智 · T27 SessionList 会话列表组件
 */

import React from 'react';
import SessionItem, { Session } from './SessionItem';

interface SessionListProps {
  sessions: Session[];
  loading: boolean;
  activeSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
}

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  loading,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}) => {
  if (loading) {
    return <div className="sessions-loading">加载中...</div>;
  }

  if (sessions.length === 0) {
    return <div className="sessions-empty">暂无会话</div>;
  }

  return (
    <div className="sessions-list">
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onSelect={onSelectSession}
          onDelete={onDeleteSession}
        />
      ))}
    </div>
  );
};

export default SessionList;
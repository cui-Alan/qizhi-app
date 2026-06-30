/**
 * 企智 · ChatMessageBubble.tsx (T13)
 * 消息气泡组件 - 支持用户/AI/系统三种角色
 */

import React from 'react';
import './ChatBubble.css';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    streaming?: boolean;
    workflow_id?: string;
    code_block?: boolean;
  };
}

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry?: (id: string) => void;
  onCopy?: (content: string) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onRetry, onCopy }) => {
  const { role, content, timestamp, metadata } = message;

  // 格式化时间
  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  // 渲染内容（支持代码块）
  const renderContent = (text: string) => {
    // 简单的代码块渲染
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        // 代码块
        const code = part.replace(/```\w*\n?/, '').replace(/```$/, '');
        return (
          <pre key={i} className="chat-code-block">
            <code>{code}</code>
            <button 
              className="copy-btn" 
              onClick={() => onCopy?.(code)}
              title="复制代码"
            >
              📋
            </button>
          </pre>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        // 行内代码
        return <code key={i} className="chat-inline-code">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={`chat-bubble chat-bubble-${role}`}>
      {/* 头像 */}
      <div className="chat-avatar">
        {role === 'user' && '👤'}
        {role === 'assistant' && '🤖'}
        {role === 'system' && '⚙️'}
      </div>

      {/* 消息内容 */}
      <div className="chat-bubble-content">
        {/* 角色标签 */}
        <div className="chat-role-label">
          {role === 'user' && '我'}
          {role === 'assistant' && (metadata?.model || '企智')}
          {role === 'system' && '系统'}
        </div>

        {/* 消息体 */}
        <div className="chat-bubble-body">
          {metadata?.streaming ? (
            <span className="streaming-text">
              {content}
              <span className="cursor-blink">▋</span>
            </span>
          ) : (
            renderContent(content)
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="chat-bubble-footer">
          <span className="chat-time">{formatTime(timestamp)}</span>
          
          {role === 'assistant' && (
            <div className="chat-actions">
              <button onClick={() => onRetry?.(message.id)} title="重新生成">
                🔄
              </button>
              <button onClick={() => onCopy?.(content)} title="复制">
                📋
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;

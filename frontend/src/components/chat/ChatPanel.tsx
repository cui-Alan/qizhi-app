/**
 * 企智 · ChatPanel.tsx (T11-T16 整合)
 * Chat 主面板 - 整合所有 Chat 组件
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import ChatSessionManager, { Session } from './ChatSessionManager';
import { useStreaming } from './ChatStreaming';
import { ChatMessage } from './ChatMessageBubble';
import { sendMessage } from '../../services/chatApi';
import './ChatPanel.css';

interface ChatPanelProps {
  className?: string;
}

// 生成 UUID
const genId = () => Math.random().toString(36).substr(2, 9);

const ChatPanel: React.FC<ChatPanelProps> = ({ className = '' }) => {
  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [showSessionPanel, setShowSessionPanel] = useState(false);

  // 流式输出
  const { content: streamingContent, streaming, startStream, stopStream, reset: resetStreaming } = useStreaming();

  // 当前流式消息 ID
  const streamingIdRef = useRef<string>('');

  // 发送消息
  const handleSend = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    // 如果没有活动会话，创建一个
    if (!activeSession) {
      const newSession: Session = {
        id: genId(),
        title: text.slice(0, 30) || '新会话',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 1,
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSession(newSession.id);
    } else {
      // 更新会话消息数
      setSessions(prev => prev.map(s => 
        s.id === activeSession 
          ? { ...s, message_count: s.message_count + 1, updated_at: new Date().toISOString() }
          : s
      ));
    }

    // 调用后端 AI API
    const aiMessageId = genId();
    streamingIdRef.current = aiMessageId;
    resetStreaming();

    try {
      // 构建历史消息上下文（最多最近10条）
      const historyMessages = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const resp = await sendMessage([
        ...historyMessages,
        { role: 'user', content: text },
      ]);

      const aiContent = resp.choices[0]?.message?.content || '（无回复）';
      startStream(aiContent);
    } catch (err) {
      // API 调用失败，显示错误
      const errMsg = err instanceof Error ? err.message : '后端连接失败';
      resetStreaming();
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'assistant',
        content: `❌ 连接错误: ${errMsg}\n\n请确保 qizhi 后端运行在 localhost:8001`,
        timestamp: new Date().toISOString(),
      }]);
      streamingIdRef.current = '';
    }

  }, [activeSession, messages, resetStreaming, startStream]);

  // 流式内容更新时，添加/更新消息
  useEffect(() => {
    if (streamingIdRef.current) {
      if (streaming) {
        // 流式中 - 更新或添加消息
        setMessages(prev => {
          const exists = prev.find(m => m.id === streamingIdRef.current);
          if (exists) {
            return prev.map(m => 
              m.id === streamingIdRef.current 
                ? { ...m, content: streamingContent, metadata: { ...m.metadata, streaming: true } }
                : m
            );
          } else {
            return [...prev, {
              id: streamingIdRef.current,
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date().toISOString(),
              metadata: { streaming: true },
            }];
          }
        });
      } else if (streamingContent) {
        // 流式结束 - 更新消息状态
        setMessages(prev => prev.map(m => 
          m.id === streamingIdRef.current 
            ? { ...m, content: streamingContent, metadata: { ...m.metadata, streaming: false } }
            : m
        ));
        streamingIdRef.current = '';
      }
    }
  }, [streamingContent, streaming]);

  // 停止生成
  const handleStop = useCallback(() => {
    stopStream();
  }, [stopStream]);

  // 会话管理
  const handleNewSession = useCallback(() => {
    setActiveSession(null);
    setMessages([]);
    setShowSessionPanel(false);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSession(id);
    setMessages([]);
    setShowSessionPanel(false);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession === id) {
      setActiveSession(null);
      setMessages([]);
    }
  }, [activeSession]);

  const handleRenameSession = useCallback((id: string, title: string) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, title } : s
    ));
  }, []);

  // 复制内容
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      // toast 提示
    });
  }, []);

  // 重试（删除失败的 AI 消息，重新发送最后一条用户消息）
  const handleRetry = useCallback(async (id: string) => {
    const idx = messages.findIndex(m => m.id === id);
    if (idx === -1) return;

    // 找到最后一条用户消息
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // 删除当前 AI 消息
    setMessages(prev => prev.filter(m => m.id !== id));

    // 重新调用 AI（复用 handleSend 逻辑，但去掉添加用户消息）
    const aiMessageId = genId();
    streamingIdRef.current = aiMessageId;
    resetStreaming();

    try {
      const historyMessages = messages.slice(0, idx - 1).filter(m => m.role !== 'assistant').slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const resp = await sendMessage([
        ...historyMessages,
        { role: 'user', content: lastUserMsg.content },
      ]);

      const aiContent = resp.choices[0]?.message?.content || '（无回复）';
      startStream(aiContent);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '后端连接失败';
      resetStreaming();
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'assistant',
        content: `❌ 重试失败: ${errMsg}`,
        timestamp: new Date().toISOString(),
      }]);
      streamingIdRef.current = '';
    }
  }, [messages, resetStreaming, startStream]);

  return (
    <div className={`chat-panel ${className}`}>
      {/* 顶部栏 */}
      <div className="chat-header">
        <button 
          className="toggle-session-btn"
          onClick={() => setShowSessionPanel(!showSessionPanel)}
          title="会话历史"
        >
          ☰
        </button>
        <div className="chat-title">
          <span>企智</span>
          {streaming && <span className="streaming-badge">生成中...</span>}
        </div>
        <div className="chat-actions">
          <button onClick={() => setMessages([])} title="清空会话">
            🗑️
          </button>
        </div>
      </div>

      {/* 主体区域 */}
      <div className="chat-body">
        {/* 侧边会话面板 */}
        {showSessionPanel && (
          <div className="chat-sidebar">
            <ChatSessionManager
              sessions={sessions}
              activeSession={activeSession}
              onSelect={handleSelectSession}
              onNew={handleNewSession}
              onDelete={handleDeleteSession}
              onRename={handleRenameSession}
            />
          </div>
        )}

        {/* 消息区域 */}
        <div className="chat-main">
          <ChatMessageList
            messages={messages}
            onRetry={handleRetry}
            onCopy={handleCopy}
            streaming={streaming}
          />
        </div>
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming}
        disabled={false}
      />
    </div>
  );
};

export default ChatPanel;

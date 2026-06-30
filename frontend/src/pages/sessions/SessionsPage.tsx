/**
 * 企智 · T27 会话管理页面
 * 会话列表 + 消息历史 + 发送消息
 */

import React, { useState, useEffect, useRef } from 'react';
import SessionList, { Session } from './SessionList';
import './SessionsPage.css';

// ===== 类型 =====

interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// ===== 主组件 =====

const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取当前用户ID（从localStorage）
  const getUserId = (): string | null => {
    // 假设user_id存储在localStorage中，或者从token解析
    // 这里简化处理，实际应从JWT token解析或专门存储
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    
    try {
      // 简单的base64解码获取user_id（如果是JWT）
      const payload = token.split('.')[1];
      if (payload) {
        const decoded = JSON.parse(atob(payload));
        return decoded.sub || decoded.user_id || null;
      }
    } catch (e) {
      console.error('Failed to parse token:', e);
    }
    return localStorage.getItem('user_id');
  };

  // 加载会话列表
  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const userId = getUserId();
      
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/v1/sessions${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取会话列表失败');
      const data = await res.json();
      
      // 按更新时间倒序
      const sorted = Array.isArray(data) 
        ? data.sort((a: Session, b: Session) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
        : [];
      setSessions(sorted);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载指定会话的消息
  const loadMessages = async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/sessions/${sessionId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取消息历史失败');
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  // 创建新会话
  const handleCreateSession = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userId = getUserId();
      
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title: `新会话 ${new Date().toLocaleString('zh-CN')}`,
        }),
      });
      if (!res.ok) throw new Error('创建会话失败');
      const newSession = await res.json();
      
      setSessions(prev => [newSession, ...prev]);
      setActiveSession(newSession);
      setMessages([]);
    } catch (e: any) {
      alert(`错误：${e.message}`);
    }
  };

  // 删除会话
  const handleDeleteSession = async (session: Session) => {
    if (!confirm(`确定删除会话"${session.title}"吗？`)) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/sessions/${session.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('删除会话失败');
      
      setSessions(prev => prev.filter(s => s.id !== session.id));
      if (activeSession?.id === session.id) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (e: any) {
      alert(`错误：${e.message}`);
    }
  };

  // 切换会话
  const handleSelectSession = (session: Session) => {
    setActiveSession(session);
    loadMessages(session.id);
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const token = localStorage.getItem('access_token');

      // 添加用户消息到本地UI
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        session_id: activeSession.id,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);

      // 发送到后端
      const res = await fetch(`/api/v1/sessions/${activeSession.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: 'user', content: text }),
      });

      if (!res.ok) throw new Error('发送消息失败');
      
      // 重新加载消息（包含AI回复）
      await loadMessages(activeSession.id);
      
      // 更新会话列表中的最后消息时间
      setSessions(prev => prev.map(s => 
        s.id === activeSession.id 
          ? { ...s, updated_at: new Date().toISOString(), message_count: (s.message_count || 0) + 1 }
          : s
      ));
    } catch (e: any) {
      alert(`错误：${e.message}`);
    } finally {
      setSending(false);
    }
  };

  // 格式化时间
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 初始加载
  useEffect(() => {
    loadSessions();
  }, []);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 搜索过滤
  const filteredSessions = searchQuery
    ? sessions.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  return (
    <div className="sessions-page">
      {/* 左侧会话列表 */}
      <aside className="sessions-sidebar">
        <div className="sessions-sidebar-header">
          <h3>💬 会话</h3>
          <button className="btn-new-session" onClick={handleCreateSession} title="新建会话">
            ➕
          </button>
        </div>

        <div className="sessions-search">
          <input
            type="text"
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {error && <div className="sessions-error">❌ {error}</div>}

        <SessionList
          sessions={filteredSessions}
          loading={loading}
          activeSessionId={activeSession?.id || null}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
      </aside>

      {/* 右侧消息区域 */}
      <main className="sessions-content">
        {activeSession ? (
          <>
            <div className="sessions-content-header">
              <h2>{activeSession.title}</h2>
            </div>

            <div className="messages-list">
              {messagesLoading ? (
                <div className="sessions-loading">加载消息历史...</div>
              ) : messages.length === 0 ? (
                <div className="sessions-placeholder">
                  <span className="sessions-placeholder-icon">💭</span>
                  <p>开始对话吧</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`message-item ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div>
                      <div className="message-bubble">{msg.content}</div>
                      <div className="message-time">{formatMessageTime(msg.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-area">
              <textarea
                placeholder="输入消息..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
              />
              <button 
                className="btn-send" 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? '发送中...' : '发送'}
              </button>
            </div>
          </>
        ) : (
          <div className="sessions-placeholder">
            <span className="sessions-placeholder-icon">💬</span>
            <p>选择一个会话或创建新会话</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsPage;
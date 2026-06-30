/**
 * 企智 · ChatInput.tsx (T12)
 * 消息输入组件 - 支持文本 + 快捷命令 + 发送
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import './ChatInput.css';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}

const QUICK_ACTIONS = [
  { label: '/search', desc: '搜索知识库' },
  { label: '/workflow', desc: '运行工作流' },
  { label: '/file', desc: '处理文件' },
  { label: '/help', desc: '获取帮助' },
];

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  disabled = false,
  streaming = false,
  placeholder = '输入消息... (Shift+Enter 换行，Enter 发送)',
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  // 发送消息
  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    
    onSend(text);
    setInput('');
    
    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // 键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 快捷命令
  const handleQuickAction = (action: string) => {
    setInput(action + ' ');
    textareaRef.current?.focus();
  };

  return (
    <div className="chat-input-container">
      {/* 快捷命令栏 */}
      <div className="quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="quick-action-btn"
            onClick={() => handleQuickAction(action.label)}
            disabled={disabled || streaming}
            title={action.desc}
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* 输入区域 */}
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        
        {/* 发送按钮 */}
        <button
          className={`send-btn ${streaming ? 'stop' : 'send'}`}
          onClick={streaming ? onStop : handleSend}
          disabled={!input.trim() && !streaming}
        >
          {streaming ? '⏹' : '➤'}
        </button>
      </div>

      {/* 提示文字 */}
      <div className="input-hint">
        按 Enter 发送，Shift+Enter 换行
      </div>
    </div>
  );
};

export default ChatInput;

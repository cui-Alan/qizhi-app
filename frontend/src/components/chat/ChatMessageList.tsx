/**
 * 企智 · ChatMessageList.tsx (T11)
 * 消息列表组件 - 滚动容器 + 自动定位
 */

import React, { useRef, useEffect } from 'react';
import ChatBubble, { ChatMessage } from './ChatMessageBubble';

interface ChatMessageListProps {
  messages: ChatMessage[];
  onRetry?: (id: string) => void;
  onCopy?: (content: string) => void;
  streaming?: boolean;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  onRetry,
  onCopy,
  streaming = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  // 欢迎消息
  const welcomeMessages: ChatMessage[] = [
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 你好！我是企智，一个企业级 AI 工作流平台。\n\n我可以帮你：\n• 自动化工作流程\n• 搜索知识库\n• 管理文件和任务\n\n有什么可以帮你的吗？',
      timestamp: new Date().toISOString(),
    },
  ];

  const displayMessages = messages.length > 0 ? messages : welcomeMessages;

  return (
    <div className="chat-message-list" ref={containerRef}>
      {displayMessages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          onRetry={onRetry}
          onCopy={onCopy}
        />
      ))}
      
      {/* 流式输出指示器 */}
      {streaming && (
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      
      {/* 底部锚点 */}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatMessageList;

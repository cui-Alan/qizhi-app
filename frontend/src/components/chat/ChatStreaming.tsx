/**
 * 企智 · ChatStreaming.tsx (T15)
 * 流式输出组件 - AI 回复打字效果
 */

import React, { useState, useCallback, useRef } from 'react';

interface UseStreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

interface UseStreamingReturn {
  content: string;
  streaming: boolean;
  error: string | null;
  startStream: (text: string) => void;
  stopStream: () => void;
  reset: () => void;
}

/**
 * 流式输出 Hook
 * 
 * 使用方式:
 * const { content, streaming, startStream, stopStream } = useStreaming({
 *   onComplete: (text) => console.log('完成:', text),
 * });
 * 
 * // 模拟流式响应
 * startStream('你好，我是企智...');
 */
export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef('');

  const startStream = useCallback((text: string) => {
    // 清理之前的
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setContent('');
    setStreaming(true);
    setError(null);
    contentRef.current = '';

    let index = 0;
    const chars = text.split('');

    const streamNext = () => {
      if (index < chars.length) {
        const char = chars[index];
        contentRef.current += char;
        setContent(contentRef.current);
        options.onChunk?.(char);
        index++;

        // 随机延迟，模拟真实打字效果
        const delay = char === '\n' ? 50 : Math.random() * 30 + 10;
        timeoutRef.current = setTimeout(streamNext, delay);
      } else {
        setStreaming(false);
        options.onComplete?.(contentRef.current);
      }
    };

    streamNext();
  }, [options]);

  const stopStream = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setStreaming(false);
    options.onComplete?.(contentRef.current);
  }, [options]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setContent('');
    setStreaming(false);
    setError(null);
    contentRef.current = '';
  }, []);

  return { content, streaming, error, startStream, stopStream, reset };
}

/**
 * ChatStreaming 组件 - 独立的流式输出展示
 */
interface ChatStreamingProps {
  text: string;
  streaming?: boolean;
  speed?: number;  // 打字速度，毫秒
}

export const ChatStreamingText: React.FC<ChatStreamingProps> = ({
  text,
  streaming = false,
  speed = 20,
}) => {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (streaming) {
      indexRef.current = 0;
      setDisplayed('');

      const typeNext = () => {
        if (indexRef.current < text.length) {
          const char = text[indexRef.current];
          setDisplayed(prev => prev + char);
          indexRef.current++;
          timeoutRef.current = setTimeout(typeNext, speed);
        }
      };

      typeNext();
    } else {
      setDisplayed(text);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, streaming, speed]);

  return (
    <span>
      {displayed}
      {streaming && <span className="cursor-blink">▋</span>}
    </span>
  );
};

export default useStreaming;

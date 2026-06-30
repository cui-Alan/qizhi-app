/**
 * 知识库 — 文本分块器
 * 将长文档拆分为适合 RAG 检索的语义块
 */

export interface Chunk {
  id: string;
  text: string;
  index: number;        // 块在原文档中的顺序
  metadata: ChunkMeta;
}

export interface ChunkMeta {
  docId: string;
  source: string;      // 'upload' | 'obsidian' | 'url' | 'feishu'
  fileName: string;
  startChar: number;    // 原文起始字符位置
  endChar: number;      // 原文结束字符位置
}

/**
 * 固定窗口分块（重叠滑动）
 */
export function chunkByWindow(
  text: string,
  docId: string,
  fileName: string,
  source: string,
  windowSize = 512,
  overlap = 64
): Chunk[] {
  const chars = text.length;
  if (chars === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < chars) {
    const end = Math.min(start + windowSize, chars);
    const chunkText = text.slice(start, end).trim();
    if (chunkText.length > 32) {
      chunks.push({
        id: `${docId}-chunk-${index}`,
        text: chunkText,
        index,
        metadata: {
          docId,
          source,
          fileName,
          startChar: start,
          endChar: end,
        },
      });
    }
    start += windowSize - overlap;
    index++;
  }
  return chunks;
}

/**
 * 按段落分块（保留语义结构）
 */
export function chunkByParagraphs(
  text: string,
  docId: string,
  fileName: string,
  source: string,
  maxChunkSize = 512
): Chunk[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 16);
  const chunks: Chunk[] = [];
  let current = "";
  let index = 0;

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= maxChunkSize) {
      current += (current ? "\n\n" : "") + para;
    } else {
      if (current.trim()) {
        chunks.push({
          id: `${docId}-chunk-${index}`,
          text: current.trim(),
          index,
          metadata: { docId, source, fileName, startChar: -1, endChar: -1 },
        });
        index++;
      }
      current = para;
    }
  }

  if (current.trim()) {
    chunks.push({
      id: `${docId}-chunk-${index}`,
      text: current.trim(),
      index,
      metadata: { docId, source, fileName, startChar: -1, endChar: -1 },
    });
  }

  return chunks;
}

/**
 * 简单按字符数切分（兜底）
 */
export function chunkByChars(
  text: string,
  docId: string,
  fileName: string,
  source: string,
  chunkSize = 512
): Chunk[] {
  const chunks: Chunk[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      id: `${docId}-chunk-${i / chunkSize}`,
      text: text.slice(i, i + chunkSize).trim(),
      index: i / chunkSize,
      metadata: { docId, source, fileName, startChar: i, endChar: Math.min(i + chunkSize, text.length) },
    });
  }
  return chunks;
}

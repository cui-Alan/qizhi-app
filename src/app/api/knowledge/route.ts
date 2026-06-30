/**
 * 知识库 API
 * GET  /api/knowledge          - 列出文档
 * POST /api/knowledge/upload  - 上传文档并分块
 * POST /api/knowledge/obsidian - 同步 Obsidian Vault
 * POST /api/knowledge/search  - RAG 检索
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { chunkByParagraphs, type Chunk } from "@/lib/knowledge/chunker";
import { readObsidianVault } from "@/lib/knowledge/obsidian";

const supabase = createClient();

// GET /api/knowledge — 列出文档
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source"); // filter by source

  let query = supabase
    .from("kb_documents")
    .select("id, title, source, file_type, content_preview, chunk_count, created_at, metadata")
    .order("created_at", { ascending: false });

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

// POST /api/knowledge — 上传文档（文本内容）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, source = "upload", fileType = "txt", metadata = {} } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "title 和 content 必填" }, { status: 400 });
    }

    // 1. 创建文档记录
    const { data: doc, error: docError } = await supabase
      .from("kb_documents")
      .insert({ title, source, file_type: fileType, content_preview: content.slice(0, 300), metadata })
      .select()
      .single();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // 2. 分块
    const chunks: Chunk[] = chunkByParagraphs(content, doc.id, title, source);
    const chunkCount = chunks.length;

    // 3. 更新 chunk_count
    await supabase
      .from("kb_documents")
      .update({ chunk_count: chunkCount })
      .eq("id", doc.id);

    // 4. 存储 chunks（如果有 kb_chunks 表）
    const { error: chunkError } = await supabase
      .from("kb_chunks")
      .insert(
        chunks.map((c) => ({
          doc_id: doc.id,
          chunk_index: c.index,
          text: c.text,
          metadata: c.metadata,
        }))
      );

    if (chunkError) {
      console.warn("kb_chunks 写入失败（表可能不存在）:", chunkError.message);
    }

    return NextResponse.json({ document: doc, chunkCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

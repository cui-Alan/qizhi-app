/**
 * 知识库 — RAG 检索
 * POST /api/knowledge/search
 * Body: { query: string, topK?: number, source?: string }
 *
 * 实现说明：
 * - 当前：全文关键词检索（ILIKE）
 * - 后续升级：pgvector 向量检索（需 Supabase 开启 pg_extension）
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 5, source } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "query 必填" }, { status: 400 });
    }

    // 构造检索条件：在 chunks 表中搜索 text 列
    let q = supabase
      .from("kb_chunks")
      .select(`
        id,
        text,
        chunk_index,
        metadata,
        kb_documents ( id, title, source, file_type )
      `)
      .ilike("text", `%${query}%`)
      .limit(topK);

    if (source) {
      q = q.eq("kb_documents.source", source);
    }

    const { data, error } = await q;

    if (error) {
      // kb_chunks 表不存在时，降级为 kb_documents 全文预览检索
      if (error.message.includes("does not exist")) {
        const fallback = await supabase
          .from("kb_documents")
          .select("id, title, source, content_preview")
          .ilike("content_preview", `%${query}%`)
          .limit(topK);

        if (fallback.error) {
          return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        }
        return NextResponse.json({
          results: fallback.data,
          mode: "fallback_preview",
          note: "kb_chunks 表不存在，使用 content_preview 降级检索。建议创建 kb_chunks 表并启用 pgvector。",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      results: data,
      mode: "fulltext",
      count: data?.length ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

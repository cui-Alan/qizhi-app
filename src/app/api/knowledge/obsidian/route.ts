/**
 * 知识库 — Obsidian Vault 同步
 * POST /api/knowledge/obsidian
 * Body: { vaultPath: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { readObsidianVault } from "@/lib/knowledge/obsidian";
import { chunkByParagraphs } from "@/lib/knowledge/chunker";

const supabase = createClient();

export async function POST(req: NextRequest) {
  try {
    const { vaultPath } = await req.json();

    if (!vaultPath) {
      return NextResponse.json({ error: "vaultPath 必填" }, { status: 400 });
    }

    // 读取 Vault
    const files = await readObsidianVault(vaultPath);

    const results: { file: string; status: string; docId?: string; chunkCount?: number }[] = [];

    for (const file of files) {
      // 跳过太大的文件（>1MB）
      if (file.stat.size > 1024 * 1024) {
        results.push({ file: file.path, status: "skipped_too_large" });
        continue;
      }

      // 检查是否已存在（按路径判断）
      const { data: existing } = await supabase
        .from("kb_documents")
        .select("id")
        .eq("metadata->>obsidianPath", file.path)
        .eq("source", "obsidian")
        .maybeSingle();

      if (existing) {
        results.push({ file: file.path, status: "skipped_already_exists", docId: existing.id });
        continue;
      }

      // 插入文档记录
      const { data: doc, error: docError } = await supabase
        .from("kb_documents")
        .insert({
          title: file.title,
          source: "obsidian",
          file_type: "md",
          content_preview: file.content.slice(0, 300),
          chunk_count: 0,
          metadata: {
            obsidianPath: file.path,
            tags: file.tags,
            links: file.links,
            mtime: file.stat.mtime.toISOString(),
          },
        })
        .select("id")
        .single();

      if (docError) {
        results.push({ file: file.path, status: `error: ${docError.message}` });
        continue;
      }

      // 分块并存储
      const chunks = chunkByParagraphs(file.content, doc.id, file.title, "obsidian");
      const { error: chunkError } = await supabase.from("kb_chunks").insert(
        chunks.map((c) => ({
          doc_id: doc.id,
          chunk_index: c.index,
          text: c.text,
          metadata: c.metadata,
        }))
      );

      // 更新 chunk_count
      await supabase
        .from("kb_documents")
        .update({ chunk_count: chunks.length })
        .eq("id", doc.id);

      results.push({
        file: file.path,
        status: chunkError ? "partial" : "ok",
        docId: doc.id,
        chunkCount: chunks.length,
      });
    }

    return NextResponse.json({
      vaultPath,
      totalFiles: files.length,
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

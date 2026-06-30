/**
 * 登出
 * POST /api/auth/logout
 */
import { NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServer();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
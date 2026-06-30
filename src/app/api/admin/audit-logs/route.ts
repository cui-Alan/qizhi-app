import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/audit-logs — 操作日志
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/audit_logs?select=*&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    );

    if (!resp.ok) {
      return NextResponse.json({ logs: [] });
    }

    const logs = await resp.json();
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}

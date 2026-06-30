import { NextResponse } from "next/server";

// GET /api/admin/users — 管理员查看用户列表
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      }
    );

    if (!resp.ok) {
      return NextResponse.json({ users: [] });
    }

    const users = await resp.json();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] });
  }
}

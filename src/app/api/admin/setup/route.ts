import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/setup — 创建管理员账号 (仅首次使用)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, setup_key } = body;

    // 安全：需要 setup key
    const validSetupKey = process.env.ADMIN_SETUP_KEY || "qizhi-setup-2026";
    if (setup_key !== validSetupKey) {
      return NextResponse.json(
        { error: "无效的 setup key" },
        { status: 403 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // 1. 通过 Supabase Auth Admin API 创建用户
    const authResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || email.split("@")[0], role: "admin" },
      }),
    });

    if (!authResp.ok) {
      const err = await authResp.json();
      return NextResponse.json(
        { error: `创建用户失败: ${JSON.stringify(err)}` },
        { status: authResp.status }
      );
    }

    const { user } = await authResp.json();

    // 2. 写入 users 表
    const dbResp = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          name: name || email.split("@")[0],
          role: "super_admin",
          is_active: true,
        }),
      }
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: "super_admin",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

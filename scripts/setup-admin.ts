/**
 * 企智 — 管理员账号创建脚本
 *
 * 用法:
 *   SUPABASE_SERVICE_KEY=eyJ... tsx scripts/setup-admin.ts
 *
 * 获取 Service Key: Supabase Dashboard → Project Settings → API → service_role key
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lbbnxfcijckkxuxfbctl.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ 请设置环境变量 SUPABASE_SERVICE_ROLE_KEY");
  console.error("   从 Supabase Dashboard → Settings → API 获取 service_role key");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@qizhi.chat";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "QizhiAdmin2026!";
const ADMIN_NAME = process.env.ADMIN_NAME || "管理员";

async function main() {
  console.log("🔧 创建企智管理员账号...\n");

  // 1. 创建 Supabase Auth 用户
  console.log(`📧 创建 Auth 用户: ${ADMIN_EMAIL}`);
  const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY as string,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: ADMIN_NAME, role: "super_admin" },
    }),
  });

  if (!authResp.ok) {
    const err = await authResp.json();
    if (err.code === 422) {
      console.log("⚠️  用户已存在，跳过创建");
    } else {
      console.error("❌ 创建 Auth 用户失败:", JSON.stringify(err, null, 2));
      process.exit(1);
    }
  } else {
    const { user } = await authResp.json();
    console.log(`✅ Auth 用户已创建: ${user.id}`);

    // 2. 写入 users 表
    console.log(`📝 写入 users 表 (role=super_admin)...`);
    const dbResp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY as string,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: ADMIN_NAME,
        role: "super_admin",
        is_active: true,
      }),
    });

    if (!dbResp.ok) {
      const dbErr = await dbResp.json();
      console.error("❌ 写入 users 表失败:", dbErr);
    } else {
      console.log("✅ users 表已写入");
    }
  }

  console.log("\n🎉 管理员账号配置完成！");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role: super_admin`);
  console.log("\n⚠️  请立即登录并修改密码！");
}

main();

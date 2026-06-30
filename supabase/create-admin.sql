-- 企智 — 创建管理员账号
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- https://lbbnxfcijckkxuxfbctl.supabase.com

-- Step 1: 创建 Auth 用户 (通过 Supabase Dashboard Authentication → Users → Add User)
-- Email: admin@qizhi.chat
-- Password: QizhiAdmin2026! (请自行修改)
-- 勾选 "Auto Confirm User"

-- Step 2: 在 users 表中写入 super_admin 角色
-- 将下面的 'USER_UUID' 替换为上面创建的用户 UUID

INSERT INTO public.users (id, email, name, role, is_active)
VALUES (
  'USER_UUID',           -- ← 替换为实际 UUID
  'admin@qizhi.chat',
  '管理员',
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin', name = '管理员', is_active = true;

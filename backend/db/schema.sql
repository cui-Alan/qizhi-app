-- ============================================================
-- 企智 QiZhi · T17 PostgreSQL 账号 Schema
-- Supabase PostgreSQL
-- 2026-06-30
-- ============================================================

-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. users 用户表
-- ============================================================
create table if not exists public.users (
    id            uuid        primary key default uuid_generate_v4(),
    email         varchar(255) unique not null,
    username      varchar(100) unique not null,
    -- 密码：bcrypt hash（Supabase Auth 也存一份）
    password_hash varchar(255) not null,
    -- 角色：super_admin / admin / user / viewer
    role          varchar(20)  not null default 'user'
                  check (role in ('super_admin', 'admin', 'user', 'viewer')),
    -- 状态：active / inactive / pending_password_change
    status        varchar(30)  not null default 'active'
                  check (status in ('active', 'inactive', 'pending_password_change')),
    -- 临时密码（管理员开通时生成，发邮件用）
    temp_password varchar(255),
    temp_password_expires_at timestamptz,
    -- 首次登录必须改密
    must_change_password boolean not null default true,
    last_login_at        timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_users_email   on public.users(email);
create index if not exists idx_users_role    on public.users(role);
create index if not exists idx_users_status  on public.users(status);


-- ============================================================
-- 2. plans 套餐表
-- ============================================================
create table if not exists public.plans (
    id          uuid        primary key default uuid_generate_v4(),
    name        varchar(100) unique not null,  -- free / pro / enterprise
    display_name varchar(100) not null,
    description text,
    price_monthly integer   not null default 0,  -- 分/月
    price_yearly  integer   not null default 0,  -- 分/年
    max_workflows   integer not null default 5,
    max_users       integer not null default 1,
    max_api_calls   integer not null default 1000,
    features    jsonb       not null default '{}',
    is_active   boolean     not null default true,
    created_at  timestamptz not null default now()
);


-- ============================================================
-- 3. subscriptions 订阅表
-- ============================================================
create table if not exists public.subscriptions (
    id                uuid        primary key default uuid_generate_v4(),
    user_id           uuid        not null references public.users(id) on delete cascade,
    plan_id           uuid        not null references public.plans(id),
    status            varchar(20)  not null default 'trialing'
                      check (status in ('trialing', 'active', 'canceled', 'past_due', 'expired')),
    billing_cycle     varchar(10)  not null default 'monthly'
                      check (billing_cycle in ('monthly', 'yearly')),
    current_period_start timestamptz not null default now(),
    current_period_end   timestamptz not null,
    canceled_at       timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_subs_user_id  on public.subscriptions(user_id);
create index if not exists idx_subs_status  on public.subscriptions(status);


-- ============================================================
-- 4. api_keys API密钥表
-- ============================================================
create table if not exists public.api_keys (
    id          uuid        primary key default uuid_generate_v4(),
    user_id     uuid        not null references public.users(id) on delete cascade,
    name        varchar(100) not null,
    key_hash    varchar(255) not null,  -- SHA256 hash of the actual key
    key_prefix  varchar(10)  not null,  -- 前6位可见（sk-qz-xxxx）
    last_used_at timestamptz,
    expires_at   timestamptz,
    is_active    boolean     not null default true,
    created_at   timestamptz not null default now()
);

create index if not exists idx_apikeys_user_id on public.api_keys(user_id);
create index if not exists idx_apikeys_key_hash on public.api_keys(key_hash);


-- ============================================================
-- 5. workflow_sessions 对话会话表
-- ============================================================
create table if not exists public.workflow_sessions (
    id          uuid        primary key default uuid_generate_v4(),
    user_id     uuid        not null references public.users(id) on delete cascade,
    title       varchar(255),
    context     jsonb       not null default '{}',  -- { current_task, variables, ... }
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_sessions_user_id on public.workflow_sessions(user_id);
create index if not exists idx_sessions_updated on public.workflow_sessions(updated_at desc);


-- ============================================================
-- 6. workflow_messages 消息记录表
-- ============================================================
create table if not exists public.workflow_messages (
    id          uuid        primary key default uuid_generate_v4(),
    session_id  uuid        not null references public.workflow_sessions(id) on delete cascade,
    role        varchar(20)  not null check (role in ('user', 'assistant', 'system')),
    content     text        not null,
    metadata    jsonb       not null default '{}',
    created_at  timestamptz not null default now()
);

create index if not exists idx_messages_session_id on public.workflow_messages(session_id);
create index if not exists idx_messages_created   on public.workflow_messages(created_at desc);


-- ============================================================
-- 触发器：自动更新 updated_at
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
    before update on public.users
    for each row execute function public.update_updated_at();

create trigger trg_subscriptions_updated_at
    before update on public.subscriptions
    for each row execute function public.update_updated_at();

create trigger trg_sessions_updated_at
    before update on public.workflow_sessions
    for each row execute function public.update_updated_at();


-- ============================================================
-- RLS 策略（行级安全）
-- ============================================================
alter table public.users         enable row level security;
alter table public.plans         enable row level security;
alter table public.subscriptions enable row level security;
alter table public.api_keys      enable row level security;
alter table public.workflow_sessions enable row level security;
alter table public.workflow_messages enable row level security;

-- users: 自己看自己，Admin 看所有人
create policy "users_select_own"   on public.users for select using (auth.uid() = id);
create policy "users_update_own"   on public.users for update using (auth.uid() = id);
create policy "admins_select_all"  on public.users for select using (
    exists (select 1 from public.users where id = auth.uid() and role in ('super_admin', 'admin'))
);

-- subscriptions: 自己看自己
create policy "subs_select_own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subs_insert_own" on public.subscriptions for insert with check (auth.uid() = user_id);

-- api_keys: 自己看自己
create policy "apikeys_select_own" on public.api_keys for select using (auth.uid() = user_id);
create policy "apikeys_insert_own" on public.api_keys for insert with check (auth.uid() = user_id);
create policy "apikeys_delete_own" on public.api_keys for delete using (auth.uid() = user_id);

-- workflow_sessions: 自己看自己
create policy "sessions_select_own" on public.workflow_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.workflow_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.workflow_sessions for update using (auth.uid() = user_id);
create policy "sessions_delete_own" on public.workflow_sessions for delete using (auth.uid() = user_id);

-- workflow_messages: 跟 session 走
create policy "messages_select_own" on public.workflow_messages for select using (
    exists (select 1 from public.workflow_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);
create policy "messages_insert_own" on public.workflow_messages for insert with check (
    exists (select 1 from public.workflow_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);


-- ============================================================
-- 初始化：默认 plans
-- ============================================================
insert into public.plans (name, display_name, description, price_monthly, price_yearly,
    max_workflows, max_users, max_api_calls, features) values
('free', '免费版', '适合个人试用', 0, 0, 3, 1, 100, '{"storage": "1GB", "support": "社区"}'),
('pro', '专业版', '适合团队协作', 9900, 99000, 50, 10, 10000, '{"storage": "50GB", "support": "邮件", "priority": true}'),
('enterprise', '企业版', '适合大规模部署', 39900, 399000, -1, -1, -1, '{"storage": "无限制", "support": "专属客服", "sla": true, "custom_branding": true}')
on conflict (name) do nothing;


-- ============================================================
-- 初始化：默认管理员（密码 admin123，BCRYPT盐值固定演示用）
-- 实际部署时替换为随机盐值
-- ============================================================
insert into public.users (email, username, password_hash, role, status, must_change_password)
values (
    'admin@qizhi.chat',
    'admin',
    -- bcrypt hash of 'Admin@123456' (预计算，实际部署时重新生成)
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.2VmqyGLqMqG8Wq',
    'super_admin',
    'active',
    true
) on conflict (email) do nothing;
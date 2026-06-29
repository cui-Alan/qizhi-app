-- ============================================================
-- 企智 QiZhi — Database Schema v0.1
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. RBAC Users
-- ============================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'user', 'viewer');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Chat Sessions & Messages
-- ============================================================
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '新对话',
  model_id TEXT DEFAULT 'gpt-4o',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Model Providers & Mappings
-- ============================================================
CREATE TABLE model_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('openai_compatible', 'anthropic', 'ollama', 'custom')),
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE model_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  max_tokens INTEGER DEFAULT 4096,
  supports_vision BOOLEAN DEFAULT false,
  pricing_per_1k_input NUMERIC(10,6) DEFAULT 0,
  pricing_per_1k_output NUMERIC(10,6) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Workflow Definitions & Executions
-- ============================================================
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  yaml_content TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE workflow_status AS ENUM (
  'pending', 'running', 'waiting', 'completed', 'failed', 'skipped', 'compensating'
);

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  status workflow_status NOT NULL DEFAULT 'pending',
  checkpoint_data JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 5. Workflow Checkpoints (4-level fallback)
-- ============================================================
CREATE TABLE workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  state_data JSONB NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. Approval Gate
-- ============================================================
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE workflow_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  context JSONB,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- 7. Knowledge Base
-- ============================================================
CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'obsidian', 'url', 'feishu')),
  file_type TEXT,
  content_preview TEXT,
  chunk_count INTEGER DEFAULT 0,
  embedding_model TEXT DEFAULT 'all-minilm-l6-v2',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. Audit Logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. Usage Tracking
-- ============================================================
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  model_id TEXT NOT NULL,
  provider_id UUID REFERENCES model_providers(id),
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id, status);
CREATE INDEX idx_workflow_checkpoints_execution ON workflow_checkpoints(execution_id, node_id);
CREATE INDEX idx_workflow_approvals_execution ON workflow_approvals(execution_id, status);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_usage_logs_user ON usage_logs(user_id, created_at);
CREATE INDEX idx_kb_documents_source ON kb_documents(source);

-- ============================================================
-- RLS Policies (basic)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users read self" ON users
  FOR SELECT USING (auth.uid() = id);

-- Chat sessions belong to user
CREATE POLICY "Users CRUD own sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Messages visible through session ownership
CREATE POLICY "Users read own messages" ON chat_messages
  FOR SELECT USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

-- Workflow definitions visible to all authenticated users (for now)
CREATE POLICY "Authenticated read workflows" ON workflow_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated read executions" ON workflow_executions
  FOR SELECT USING (auth.role() = 'authenticated');

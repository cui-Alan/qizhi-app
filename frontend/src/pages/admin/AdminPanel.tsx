/**
 * 企智 · T21 Admin 管理后台
 * 用户列表 / 开通账号 / 停用账号
 */

import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

// ===== 类型 =====

interface User {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'pending_password_change';
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface CreateUserForm {
  email: string;
  username: string;
  role: 'user' | 'admin';
}

// ===== 角色标签 =====

const roleLabels: Record<string, string> = {
  super_admin: '👑 超级管理员',
  admin: '🔧 管理员',
  user: '👤 普通用户',
  viewer: '👁️ 访客',
};

const statusColors: Record<string, string> = {
  active: '#22c55e',
  inactive: '#ef4444',
  pending_password_change: '#f59e0b',
};

// ===== 主组件 =====

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({ email: '', username: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 加载用户列表
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (filterRole !== 'all') params.set('role', filterRole);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const query = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/v1/admin/users${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('获取用户列表失败');
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [filterRole, filterStatus]);

  // 开通账号
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setTempPassword(null);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || '创建失败');
      }
      const data = await res.json();
      setTempPassword(data.temp_password);
      setCreateForm({ email: '', username: '', role: 'user' });
      loadUsers();
    } catch (e: any) {
      alert(`错误：${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  // 停用/启用用户
  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`确定要${newStatus === 'active' ? '启用' : '停用'}用户 ${user.username} 吗？`)) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('操作失败');
      loadUsers();
    } catch (e: any) {
      alert(`错误：${e.message}`);
    }
  };

  // 删除用户
  const handleDelete = async (user: User) => {
    if (!confirm(`确定删除用户 ${user.username} 吗？`)) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('删除失败');
      loadUsers();
    } catch (e: any) {
      alert(`错误：${e.message}`);
    }
  };

  // 格式化时间
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="admin-panel">
      {/* 头部 */}
      <div className="admin-header">
        <h2>👥 用户管理</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          ➕ 开通账号
        </button>
      </div>

      {/* 筛选 */}
      <div className="admin-filters">
        <label>
          角色：
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">全部</option>
            <option value="super_admin">超级管理员</option>
            <option value="admin">管理员</option>
            <option value="user">普通用户</option>
            <option value="viewer">访客</option>
          </select>
        </label>
        <label>
          状态：
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">全部</option>
            <option value="active">正常</option>
            <option value="inactive">已停用</option>
            <option value="pending_password_change">待改密</option>
          </select>
        </label>
        <button className="btn-secondary" onClick={loadUsers}>🔄 刷新</button>
      </div>

      {/* 错误提示 */}
      {error && <div className="admin-error">❌ {error}</div>}

      {/* 用户表格 */}
      {loading ? (
        <div className="admin-loading">加载中...</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>状态</th>
              <th>最后登录</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-info">
                    <span className="username">{user.username}</span>
                    <span className="email">{user.email}</span>
                  </div>
                </td>
                <td>
                  <span className="role-badge">{roleLabels[user.role] || user.role}</span>
                </td>
                <td>
                  <span
                    className="status-dot"
                    style={{ background: statusColors[user.status] || '#999' }}
                    title={user.status}
                  />
                  {user.status === 'active' ? '正常' :
                   user.status === 'inactive' ? '已停用' : '待改密'}
                </td>
                <td>{formatDate(user.last_login_at)}</td>
                <td>{formatDate(user.created_at)}</td>
                <td>
                  <div className="action-btns">
                    <button
                      className="btn-sm"
                      onClick={() => toggleStatus(user)}
                      disabled={user.role === 'super_admin'}
                    >
                      {user.status === 'active' ? '⏸️ 停用' : '▶️ 启用'}
                    </button>
                    <button
                      className="btn-sm btn-danger"
                      onClick={() => handleDelete(user)}
                      disabled={user.role === 'super_admin'}
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="empty-row">暂无用户</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* 开通账号弹窗 */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>开通新账号</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>邮箱 *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>用户名 *</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="输入用户名"
                  required
                />
              </div>
              <div className="form-group">
                <label>角色 *</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as any }))}
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? '开通中...' : '开通'}
                </button>
              </div>
            </form>

            {/* 临时密码展示 */}
            {tempPassword && (
              <div className="temp-password-box">
                <h4>✅ 账号开通成功！</h4>
                <p>临时密码（请复制保存，发给用户）：</p>
                <pre>{tempPassword}</pre>
                <p className="warning">⚠️ 此密码仅显示一次，请妥善保管</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
/**
 * 企智 · ChangePasswordPage
 * 首次登录强制改密
 */

import React, { useState } from 'react';
import './ChangePasswordPage.css';

interface ChangePasswordPageProps {
  onPasswordChanged: () => void;
}

const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({ onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('新密码至少8位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '修改失败');
      onPasswordChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <div className="cp-logo">🔑</div>
        <h1>首次登录</h1>
        <p className="cp-subtitle">请设置您的新密码（至少8位）</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="cp-error">❌ {error}</div>}

          <div className="form-group">
            <label>新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="输入新密码"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              required
            />
          </div>

          <button type="submit" className="cp-btn" disabled={loading}>
            {loading ? '设置中...' : '设置密码并进入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
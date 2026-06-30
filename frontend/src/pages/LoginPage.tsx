/**
 * 企智 · LoginPage
 * 用户登录
 */

import React, { useState } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (token: string, role: string, mustChangePassword: boolean) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '登录失败');
      // 解析 must_change_password
      const mcp = data.must_change_password === true;
      onLogin(data.access_token, 'user', mcp);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>企智 QiZhi</h1>
        <p className="login-subtitle">企业级 AI 工作流平台</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">❌ {error}</div>}

          <div className="form-group">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@qizhi.chat"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="login-hint">
          <span>测试账号：admin@qizhi.chat / Admin@123456</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
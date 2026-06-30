/**
 * 企智 · App.tsx
 * 主应用组件
 */

import React, { useState, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import FlowEditor from './flows/FlowEditor';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Monitor from './pages/Monitor';
import Settings from './pages/Settings';
import AdminPanel from './pages/admin/AdminPanel';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import SessionsPage from './pages/SessionsPage';
import './styles/global.css';

type Page = 'flows' | 'monitor' | 'settings' | 'admin' | 'sessions';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('flows');
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('user_role'));
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(
    localStorage.getItem('must_change_password') === 'true'
  );

  // 检查是否需要改密
  useEffect(() => {
    if (authToken && mustChangePassword) {
      setCurrentPage('change-password');
    }
  }, [authToken, mustChangePassword]);

  // 登录成功
  const handleLogin = (token: string, role: string, mcp: boolean) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user_role', role);
    localStorage.setItem('must_change_password', String(mcp));
    setAuthToken(token);
    setUserRole(role);
    setMustChangePassword(mcp);
    setCurrentPage(mcp ? 'change-password' : 'flows');
  };

  // 改密成功
  const handlePasswordChanged = () => {
    localStorage.setItem('must_change_password', 'false');
    setMustChangePassword(false);
    setCurrentPage('flows');
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('must_change_password');
    setAuthToken(null);
    setUserRole(null);
    setCurrentPage('flows');
  };

  // 未登录 → 登录页
  if (!authToken) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // 强制改密
  if (mustChangePassword) {
    return <ChangePasswordPage onPasswordChanged={handlePasswordChanged} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'flows':
        return (
          <ReactFlowProvider>
            <FlowEditor />
          </ReactFlowProvider>
        );
      case 'monitor':
        return <Monitor />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <AdminPanel />;
      case 'sessions':
        return <SessionsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <TopBar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        userRole={userRole}
        onLogout={handleLogout}
      />
      <div className="app-body">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          userRole={userRole}
        />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
/**
 * 企智 · App.tsx
 * 主应用组件
 */

import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import FlowEditor from './flows/FlowEditor';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Monitor from './pages/Monitor';
import Settings from './pages/Settings';
import { ChatPanel } from './components/chat';
import './styles/global.css';

type Page = 'flows' | 'chat' | 'monitor' | 'settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('chat');

  const renderPage = () => {
    switch (currentPage) {
      case 'flows':
        return (
          <ReactFlowProvider>
            <FlowEditor />
          </ReactFlowProvider>
        );
      case 'chat':
        return <ChatPanel />;
      case 'monitor':
        return <Monitor />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <TopBar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage}
      />
      <div className="app-body">
        <Sidebar 
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
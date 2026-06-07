import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import { useStore } from './hooks/useStore';

const App: React.FC = () => {
  const { user, isAuthenticated, setSocket, setOnline } = useStore();

  useEffect(() => {
    if (isAuthenticated && user?.token) {
      const socket = io('wss://ws.nexus-platform.com', {
        query: { token: user.token },
        transports: ['websocket'],
      });
      socket.on('connect', () => setOnline(true));
      socket.on('disconnect', () => setOnline(false));
      setSocket(socket);
      return () => { socket.disconnect(); };
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: '#e8e8ec' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex' }}>
          <div style={{ width: 360, borderRight: '1px solid #2e2e36', background: '#141419' }}>
            <ChatList />
          </div>
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/chat/:chatId" element={<ChatView />} />
              <Route path="/" element={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a0a0a8' }}>
                  <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '3rem', color: '#0066ff', marginBottom: '0.5rem' }}>Nexus</h1>
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              } />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
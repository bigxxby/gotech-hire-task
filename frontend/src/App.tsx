import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ChatPage from './components/ChatPage';

const API_URL = 'http://localhost:3000';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userId, setUserId] = useState<number | null>(
    localStorage.getItem('userId') ? parseInt(localStorage.getItem('userId')!) : null,
  );
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (token) {
      const newSocket = io(API_URL, { auth: { token } });
      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [token]);

  const handleLogin = (newToken: string, newUserId: number) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('userId', String(newUserId));
    setToken(newToken);
    setUserId(newUserId);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    socket?.disconnect();
    setToken(null);
    setUserId(null);
    setSocket(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/chat" /> : <LoginPage apiUrl={API_URL} onLogin={handleLogin} />}
        />
        <Route
          path="/register"
          element={token ? <Navigate to="/chat" /> : <RegisterPage apiUrl={API_URL} onLogin={handleLogin} />}
        />
        <Route
          path="/chat"
          element={
            !token ? (
              <Navigate to="/login" />
            ) : !socket ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Connecting...
              </div>
            ) : (
              <ChatPage token={token} userId={userId!} socket={socket} apiUrl={API_URL} onLogout={handleLogout} />
            )
          }
        />
        <Route path="*" element={<Navigate to={token ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}

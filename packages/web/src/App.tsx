import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import FeedPage from './pages/FeedPage';
import JobDetailPage from './pages/JobDetailPage';
import SavedPage from './pages/SavedPage';
import AppliedPage from './pages/AppliedPage';
import ProfilePage from './pages/ProfilePage';
import DigestPage from './pages/DigestPage';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <BrowserRouter>
      <div className="app">
        <Nav theme={theme} onToggleTheme={toggle} />
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/applied" element={<AppliedPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/digest" element={<DigestPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

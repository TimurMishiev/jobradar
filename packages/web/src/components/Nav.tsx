import React from 'react';
import { NavLink } from 'react-router-dom';
import type { Theme } from '../hooks/useTheme';

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Nav({ theme, onToggleTheme }: Props) {
  return (
    <nav className="nav">
      <NavLink to="/feed" className="nav-brand">
        <span className="nav-brand-dot" />
        JobRadar
      </NavLink>

      <div className="nav-links">
        <NavLink to="/feed" className={({ isActive }) => isActive ? 'active' : ''}>
          Feed
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => isActive ? 'active' : ''}>
          Tracker
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          Profile
        </NavLink>
      </div>

      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </nav>
  );
}

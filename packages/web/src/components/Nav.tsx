import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Nav() {
  return (
    <nav className="nav">
      <NavLink to="/feed" className="nav-brand">
        SignalHire
      </NavLink>
      <div className="nav-links">
        <NavLink to="/feed" className={({ isActive }) => isActive ? 'active' : ''}>
          Feed
        </NavLink>
        <NavLink to="/saved" className={({ isActive }) => isActive ? 'active' : ''}>
          Saved
        </NavLink>
        <NavLink to="/applied" className={({ isActive }) => isActive ? 'active' : ''}>
          Applied
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          Profile
        </NavLink>
      </div>
    </nav>
  );
}

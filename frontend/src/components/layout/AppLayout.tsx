// src/components/layout/AppLayout.tsx
// Layout principal com menu lateral esquerdo

import { Outlet, NavLink } from 'react-router-dom';
import { clearAuthToken } from '../../config/auth';
import './AppLayout.css';

export default function AppLayout() {
  const handleLogout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const getNavLinkClassName = (isActive: boolean) => {
    return `nav-link ${isActive ? 'active' : ''}`;
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <h1>Unificard</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => getNavLinkClassName(isActive)}
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/perfil" 
            className={({ isActive }) => getNavLinkClassName(isActive)}
          >
            Meu Perfil
          </NavLink>
          <NavLink 
            to="/empresas" 
            className={({ isActive }) => getNavLinkClassName(isActive)}
          >
            Minhas Empresas
          </NavLink>
          <NavLink 
            to="/grupos" 
            className={({ isActive }) => getNavLinkClassName(isActive)}
          >
            Grupos
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}


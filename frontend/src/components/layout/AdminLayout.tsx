// src/components/layout/AdminLayout.tsx
// Layout Administrativo
// Rotas: /perfil, /empresas, /grupos/novo

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearAuthToken } from '../../config/auth';
import HeaderGlobal from './HeaderGlobal';
import './AdminLayout.css';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const getNavLinkClassName = ({ isActive }: { isActive: boolean }) => {
    return `admin-nav-link ${isActive ? 'active' : ''}`;
  };

  return (
    <div className="admin-layout">
      <HeaderGlobal />
      <div className="admin-layout-content">
        <aside className="admin-sidebar">
          <div className="sidebar-header">
            <h1>Unificard</h1>
          </div>
          <nav className="admin-sidebar-nav">
            {/* Seção CONTA */}
            <div className="nav-section">
              <div className="nav-section-title">👤 CONTA</div>
              <NavLink 
                to="/perfil" 
                className={getNavLinkClassName}
              >
                👤 Meu Perfil
              </NavLink>
              <NavLink 
                to="/empresas" 
                className={getNavLinkClassName}
              >
                🏢 Minhas Empresas
              </NavLink>
              <NavLink 
                to="/dashboard" 
                className={getNavLinkClassName}
              >
                ⚙️ Configurações
              </NavLink>
              <NavLink 
                to="/ledger" 
                className={getNavLinkClassName}
              >
                📜 Ledger Social
              </NavLink>
            </div>

            {/* Seção ADMINISTRATIVO */}
            <div className="nav-section">
              <div className="nav-section-title">🔧 ADMINISTRATIVO</div>
              <NavLink 
                to="/grupos/novo" 
                className={getNavLinkClassName}
              >
                ➕ Criar Grupo
              </NavLink>
            </div>

            {/* Seção SOCIAL */}
            <div className="nav-section">
              <div className="nav-section-title">📣 SOCIAL</div>
              <button
                onClick={() => navigate('/social')}
                className="admin-nav-link admin-nav-button"
              >
                📰 Feed
              </button>
              <button
                onClick={() => navigate('/grupos')}
                className="admin-nav-link admin-nav-button"
              >
                👥 Grupos
              </button>
              <button
                onClick={() => navigate('/votacoes')}
                className="admin-nav-link admin-nav-button"
              >
                🗳️ Votações
              </button>
              <button
                onClick={() => navigate('/impacto')}
                className="admin-nav-link admin-nav-button"
              >
                💚 Impacto
              </button>
            </div>

            {/* Seção FINANCEIRO */}
            <div className="nav-section">
              <div className="nav-section-title">💰 FINANCEIRO</div>
              <button
                onClick={() => navigate('/banco')}
                className="admin-nav-link admin-nav-button"
              >
                🏦 UnifyBank
              </button>
              <button
                onClick={() => navigate('/extrato')}
                className="admin-nav-link admin-nav-button"
              >
                📄 Extrato
              </button>
              <button
                onClick={() => navigate('/fundo-regional')}
                className="admin-nav-link admin-nav-button"
              >
                🌱 Fundo Regional
              </button>
            </div>
          </nav>
          <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-button">
              Sair
            </button>
          </div>
        </aside>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


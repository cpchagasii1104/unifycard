// src/components/layout/BankLayout.tsx
// Layout Financeiro (UnifyBank)
// Rotas: /banco, /extrato, /fundo-regional

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import HeaderGlobal from './HeaderGlobal';
import './BankLayout.css';

export default function BankLayout() {
  const navigate = useNavigate();

  const getNavLinkClassName = ({ isActive }: { isActive: boolean }) => {
    return `bank-nav-link ${isActive ? 'active' : ''}`;
  };

  return (
    <div className="bank-layout">
      <HeaderGlobal />
      <div className="bank-layout-content">
        <aside className="bank-sidebar">
          <nav className="bank-sidebar-nav">
            {/* Seção FINANCEIRO */}
            <div className="nav-section">
              <div className="nav-section-title">💰 FINANCEIRO</div>
              <NavLink 
                to="/banco" 
                className={getNavLinkClassName}
              >
                🏦 UnifyBank
              </NavLink>
              <NavLink 
                to="/extrato" 
                className={getNavLinkClassName}
              >
                📄 Extrato
              </NavLink>
              <NavLink 
                to="/fundo-regional" 
                className={getNavLinkClassName}
              >
                🌱 Fundo Regional
              </NavLink>
            </div>

            {/* Seção SOCIAL */}
            <div className="nav-section">
              <div className="nav-section-title">📣 SOCIAL</div>
              <button
                onClick={() => navigate('/social')}
                className="bank-nav-link bank-nav-button"
              >
                📰 Feed
              </button>
              <button
                onClick={() => navigate('/grupos')}
                className="bank-nav-link bank-nav-button"
              >
                👥 Grupos
              </button>
              <button
                onClick={() => navigate('/votacoes')}
                className="bank-nav-link bank-nav-button"
              >
                🗳️ Votações
              </button>
              <button
                onClick={() => navigate('/impacto')}
                className="bank-nav-link bank-nav-button"
              >
                💚 Impacto
              </button>
            </div>

            {/* Seção CONTA */}
            <div className="nav-section">
              <div className="nav-section-title">👤 CONTA</div>
              <button
                onClick={() => navigate('/perfil')}
                className="bank-nav-link bank-nav-button"
              >
                👤 Meu Perfil
              </button>
              <button
                onClick={() => navigate('/empresas')}
                className="bank-nav-link bank-nav-button"
              >
                🏢 Minhas Empresas
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bank-nav-link bank-nav-button"
              >
                ⚙️ Configurações
              </button>
              <button
                onClick={() => navigate('/ledger')}
                className="bank-nav-link bank-nav-button"
              >
                📜 Ledger Social
              </button>
            </div>
          </nav>
        </aside>
        <main className="bank-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


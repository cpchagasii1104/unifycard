// src/components/layout/SocialLayout.tsx
// Layout Social - DEFAULT DO SISTEMA
// Menu esquerdo completo: Social, Conta, Financeiro

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import HeaderGlobal from './HeaderGlobal';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getUnreadCounts, type UnreadCounts } from '../../api/unread';
import './SocialLayout.css';

export default function SocialLayout() {
  const navigate = useNavigate();
  const { activeActor, isLoading: actorsLoading } = useActiveActor();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    feed: 0,
    groups: 0,
    events: 0,
    services: 0,
  });

  const getNavLinkClassName = ({ isActive }: { isActive: boolean }) => {
    return `social-nav-link ${isActive ? 'active' : ''}`;
  };

  const handleBankNavigation = () => {
    navigate('/banco');
  };

  // Carregar contadores quando activeActor mudar
  useEffect(() => {
    if (activeActor && !actorsLoading) {
      loadUnreadCounts();
    }
  }, [activeActor?.actor_id, actorsLoading]);

  // Reagir à mudança de ator ativo
  useEffect(() => {
    const handleActorChange = () => {
      if (activeActor && !actorsLoading) {
        loadUnreadCounts();
      }
    };

    window.addEventListener('active-actor-changed', handleActorChange);
    return () => {
      window.removeEventListener('active-actor-changed', handleActorChange);
    };
  }, [activeActor, actorsLoading]);

  const loadUnreadCounts = async () => {
    try {
      const counts = await getUnreadCounts();
      setUnreadCounts(counts);
    } catch (error) {
      // Erro já tratado na função getUnreadCounts
      console.warn('Erro ao carregar contadores:', error);
    }
  };

  return (
    <div className="social-layout">
      <HeaderGlobal />
      <div className="social-layout-content">
        <aside className="social-sidebar">
          <nav className="social-sidebar-nav">
            {/* Seção SOCIAL */}
            <div className="nav-section">
              <div className="nav-section-title">📣 SOCIAL</div>
              <NavLink 
                to="/social" 
                className={getNavLinkClassName}
              >
                📰 Feed
                {unreadCounts.feed > 0 && (
                  <span className="nav-badge">{unreadCounts.feed}</span>
                )}
              </NavLink>
              <NavLink 
                to="/grupos" 
                className={getNavLinkClassName}
              >
                👥 Grupos
                {unreadCounts.groups > 0 && (
                  <span className="nav-badge">{unreadCounts.groups}</span>
                )}
              </NavLink>
              <NavLink 
                to="/votacoes" 
                className={getNavLinkClassName}
              >
                🗳️ Votações
              </NavLink>
              <NavLink 
                to="/impacto" 
                className={getNavLinkClassName}
              >
                💚 Impacto
              </NavLink>
            </div>

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

            {/* Seção FINANCEIRO */}
            <div className="nav-section">
              <div className="nav-section-title">💰 FINANCEIRO</div>
              <button
                onClick={handleBankNavigation}
                className="social-nav-link social-nav-button"
              >
                🏦 UnifyBank
              </button>
              <button
                onClick={() => navigate('/extrato')}
                className="social-nav-link social-nav-button"
              >
                📄 Extrato
              </button>
              <button
                onClick={() => navigate('/fundo-regional')}
                className="social-nav-link social-nav-button"
              >
                🌱 Fundo Regional
              </button>
            </div>
          </nav>
        </aside>
        <main className="social-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

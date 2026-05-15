// src/components/layout/AdminLayout.tsx
// Layout Administrativo - PADRONIZADO COM MENU LATERAL COMPLETO
// Rotas: /dashboard, /alerts, /payouts, etc.
// 🔴 PADRONIZAÇÃO: Usa o mesmo menu lateral do SocialLayout para consistência

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearSession } from '../../config/auth';
import HeaderGlobal from './HeaderGlobal';
import GlobalSidebar from './GlobalSidebar';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getUnreadCounts, type UnreadCounts } from '../../api/unread';
import { getMyInvites } from '../../api/groups';
import { validateActiveActor, safeApiCall, safeNumber } from '../../utils/guardrails';
import { getAppsForContext, mapActorTypeToContext } from '../../config/appsRegistry';
import './AdminLayout.css';
import './SocialLayout.css'; // 🔴 PADRONIZAÇÃO: Usa os mesmos estilos do SocialLayout

export default function AdminLayout() {
  const navigate = useNavigate();
  const { activeActor, isLoading: actorsLoading } = useActiveActor();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    feed: 0,
    groups: 0,
    events: 0,
    services: 0,
  });
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const getNavLinkClassName = ({ isActive }: { isActive: boolean }) => {
    return `social-nav-link ${isActive ? 'active' : ''}`;
  };

  const handleBankNavigation = () => {
    navigate('/banco');
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  // Obter apps disponíveis para o contexto atual
  const context = activeActor ? mapActorTypeToContext(activeActor.actor_type) : 'pf';
  const availableApps = getAppsForContext(context);
  
  // IDs de apps já renderizados manualmente no menu
  const manuallyRenderedAppIds = new Set([
    'social', // Feed
    'profile', // Meu Perfil
    'companies', // Minhas Empresas
    'bank', // UnifyBank
    'regional-fund', // Fundo Regional
    'events', // Eventos
    'services', // Serviços
    'votes', // Votações
    'config', // Configurações
  ]);

  // Filtrar apps que não estão no menu manual
  const additionalApps = availableApps.filter(app => !manuallyRenderedAppIds.has(app.id));

  // Agrupar apps por categoria
  const appsByCategory: Record<string, typeof availableApps> = {};
  additionalApps.forEach(app => {
    if (!appsByCategory[app.category]) {
      appsByCategory[app.category] = [];
    }
    appsByCategory[app.category].push(app);
  });

  const categoryLabels: Record<string, string> = {
    finance: '💰 FINANCEIRO',
    social: '📣 SOCIAL',
    core: '👤 CONTA',
    admin: '🔧 ADMINISTRATIVO',
  };

  // Carregar contadores não lidos
  useEffect(() => {
    if (!actorsLoading && activeActor) {
      loadUnreadCounts();
      loadPendingInvites();
    }
  }, [actorsLoading, activeActor]);

  const loadUnreadCounts = async () => {
    if (!activeActor) return;
    if (!validateActiveActor(activeActor)) return;

    const result = await safeApiCall(() => getUnreadCounts(), { feed: 0, groups: 0, events: 0, services: 0 });
    setUnreadCounts(result);
  };

  const loadPendingInvites = async () => {
    if (!activeActor) return;
    if (!validateActiveActor(activeActor)) return;

    const result = await safeApiCall(() => getMyInvites('pending'), { invites: [] });
    setPendingInvitesCount(safeNumber(result.invites?.length ?? 0, 0));
  };

  return (
    <div className="social-layout">
      <HeaderGlobal />
      <div className="social-layout-content">
        <GlobalSidebar />
        <main className="social-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


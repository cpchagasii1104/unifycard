// src/components/layout/SocialLayout.tsx
// Layout Social - DEFAULT DO SISTEMA
// Menu esquerdo completo: Social, Conta, Financeiro

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import UnifiedAuthLayout from './UnifiedAuthLayout';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getUnreadCounts, type UnreadCounts } from '../../api/unread';
import { getMyInvites } from '../../api/groups';
import { validateActiveActor, safeApiCall, safeNumber } from '../../utils/guardrails';
import { clearSession, isAuthenticated } from '../../config/auth';
import { getAppsForContext, mapActorTypeToContext } from '../../config/appsRegistry';
import './SocialLayout.css';

export default function SocialLayout() {
  const navigate = useNavigate();
  const {
    activeActor,
    isLoading: actorsLoading,
    actors,
    hasValidActor,
    authHydrated,
  } = useActiveActor();
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
  
  // Organizar apps por categoria
  const appsByCategory = additionalApps.reduce((acc, app) => {
    if (!acc[app.category]) {
      acc[app.category] = [];
    }
    acc[app.category].push(app);
    return acc;
  }, {} as Record<string, typeof additionalApps>);

  const categoryLabels: Record<string, string> = {
    core: '💼 CORE',
    finance: '💰 FINANCEIRO',
    commerce: '🛒 COMÉRCIO',
    mobility: '🚗 MOBILIDADE',
    hospitality: '🏨 HOSPEDAGEM',
    services: '🔧 SERVIÇOS',
    social: '👥 SOCIAL',
    governance: '🗳️ GOVERNANÇA',
    system: '⚙️ SISTEMA',
  };

  // Carregar contadores quando activeActor mudar
  useEffect(() => {
    if (validateActiveActor(activeActor) && !actorsLoading) {
      loadUnreadCounts();
      loadPendingInvites();
    }
  }, [activeActor?.actor_id, actorsLoading]);

  // Reagir à mudança de ator ativo
  useEffect(() => {
    const handleActorChange = () => {
      if (validateActiveActor(activeActor) && !actorsLoading) {
        loadUnreadCounts();
        loadPendingInvites();
      }
    };

    window.addEventListener('active-actor-changed', handleActorChange);
    return () => {
      window.removeEventListener('active-actor-changed', handleActorChange);
    };
  }, [activeActor?.actor_id, actorsLoading]);

  // Reagir a eventos de atualização de convites
  useEffect(() => {
    const handleInviteUpdate = () => {
      if (validateActiveActor(activeActor) && !actorsLoading) {
        loadPendingInvites();
      }
    };

    window.addEventListener('group-invite-updated', handleInviteUpdate);
    return () => {
      window.removeEventListener('group-invite-updated', handleInviteUpdate);
    };
  }, [activeActor?.actor_id, actorsLoading]);

  const loadUnreadCounts = async () => {
    // Guardrail: validar activeActor antes de carregar
    if (!validateActiveActor(activeActor)) {
      return;
    }

    // Usar safeApiCall com fallback de zeros
    const counts = await safeApiCall(
      async () => getUnreadCounts(),
      {
        feed: 0,
        groups: 0,
        events: 0,
        services: 0,
      },
      'Erro ao carregar contadores de novidade'
    );

    // Usar safeNumber para garantir valores numéricos válidos
    setUnreadCounts({
      feed: safeNumber(counts.feed, 0),
      groups: safeNumber(counts.groups, 0),
      events: safeNumber(counts.events, 0),
      services: safeNumber(counts.services, 0),
    });
  };

  const loadPendingInvites = async () => {
    // Guardrail: validar activeActor antes de carregar
    if (!validateActiveActor(activeActor)) {
      return;
    }

    const count = await safeApiCall(
      async () => {
        const invitesData = await getMyInvites('pending');
        return invitesData.invites?.length || 0;
      },
      0,
      'Erro ao carregar convites pendentes'
    );

    setPendingInvitesCount(safeNumber(count, 0));
  };

  if (isAuthenticated() && authHydrated && !hasValidActor) {
    if (actors.length > 0) {
      return (
        <div className="social-layout social-layout--blocked" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>A preparar contexto operacional…</p>
        </div>
      );
    }
    return (
      <div className="social-layout social-layout--blocked" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Não há actor disponível para esta conta.</p>
        <p>Crie ou associe um perfil ou empresa para continuar a usar a área social.</p>
      </div>
    );
  }

  return <UnifiedAuthLayout mainClassName="social-main" />;
}

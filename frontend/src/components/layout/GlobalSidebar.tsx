// frontend/src/components/layout/GlobalSidebar.tsx
// 2026-05-15: Sidebar unificada compartilhada por todas as páginas autenticadas.
// 2026-06-11 (DECISION-0117 F / CP5): o menu de módulos deixa de ser array
// hardcoded — é PROJEÇÃO do registry backend governado (GET /navigation/modules).
// O frontend não inventa módulo/categoria/rota/autoridade; rotas mortas (STUB/
// TOMBSTONE) não chegam aqui; o menu não concede poder (backend revalida tudo).
// PILOT_HIDDEN_ROUTES e NAV_GROUPS hardcoded foram absorvidos pelo registry.
//
// priorityRoutes (perfil contextual do actor) seguem como APRESENTAÇÃO:
// destacam, nunca escondem nem autorizam ("prioriza, não esconde").

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../../config/auth';
import { useActorMode } from '../../hooks/useActorMode';
import { useBusinessProfile } from '../../hooks/useBusinessProfile';
import { getNavigationModules, type NavModuleGroup, type NavModuleItem } from '../../api/navigation';
import './GlobalSidebar.css';

export default function GlobalSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useActorMode();
  const { profile: businessProfile } = useBusinessProfile();
  const [groups, setGroups] = useState<NavModuleGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    getNavigationModules()
      .then((projection) => {
        if (!cancelled) setGroups(projection.groups);
      })
      .catch(() => {
        // Falha honesta: sem projeção, sem menu inventado (fica Início + Sair).
        if (!cancelled) setGroups([{ title: 'Geral', items: [{ moduleKey: 'home', label: 'Início', icon: '🏠', route: '/home', exact: true }] }]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (item: NavModuleItem): boolean => {
    const path = item.route.split('?')[0];
    if (item.exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // priorityRoutes do perfil contextual: destaque visual, nunca remoção/autoridade.
  const priorityRoutes = new Set([
    ...profile.sidebarPriorities,
    ...(businessProfile?.sidebarPriorities ?? []),
  ]);
  const isPriority = (item: NavModuleItem): boolean => priorityRoutes.has(item.route);

  const handleLogout = () => {
    clearSession();
    window.dispatchEvent(new CustomEvent('auth-changed'));
    window.location.href = '/login';
  };

  return (
    <aside className="gs-sidebar" aria-label="Navegação principal">
      <div className="gs-brand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
        <span className="gs-brand-icon">💠</span>
        <span className="gs-brand-name">UnifiCard</span>
      </div>

      <nav className="gs-nav">
        {groups.map((group, gIdx) => (
          <div key={group.title + gIdx} className="gs-group">
            {group.title && group.title !== 'Geral' && <div className="gs-group-title">{group.title}</div>}
            {group.items.map((item) => {
              const active = isActive(item);
              const priority = isPriority(item);
              return (
                <button
                  key={item.moduleKey + item.route}
                  type="button"
                  className={`gs-item ${active ? 'active' : ''} ${priority ? 'priority' : ''}`}
                  onClick={() => navigate(item.route)}
                  title={priority ? 'Sugerido para seu perfil atual' : undefined}
                >
                  <span className="gs-item-icon">{item.icon}</span>
                  <span className="gs-item-label">{item.label}</span>
                  {priority && !active && <span className="gs-priority-dot" aria-hidden="true">●</span>}
                </button>
              );
            })}
          </div>
        ))}

        {/* Sair — sempre no final */}
        <div className="gs-group gs-group-logout">
          <button
            type="button"
            className="gs-item gs-item-logout"
            onClick={handleLogout}
            aria-label="Sair da conta"
          >
            <span className="gs-item-icon">🚪</span>
            <span className="gs-item-label">Sair</span>
          </button>
        </div>
      </nav>

      <div className="gs-footer">
        <div className="gs-secure">
          <span>🔒</span>
          <div>
            <div className="gs-secure-title">Sua conta está segura</div>
            <div className="gs-secure-hint">Auditável e responsável</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

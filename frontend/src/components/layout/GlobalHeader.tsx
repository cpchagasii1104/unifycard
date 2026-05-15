// frontend/src/components/layout/GlobalHeader.tsx
// 2026-05-15: Header unificado compartilhado por TODAS as páginas autenticadas.
// Pedido Clayton: a topbar deve ser igual em todas as páginas (assim como a
// sidebar). Conteúdo muda contextualmente conforme actor ativo, mas estrutura
// é universal.
//
// Substitui o HeaderGlobal antigo (saldo + Atuando como + Ir para Banco, deletado
// 2026-05-15) e o TopBar inline do DashboardHome.
//
// Estrutura:
//   - Saudação personalizada (Olá, [primeiro nome])
//   - Barra de busca
//   - Botão compacto "Completar meu perfil X%" (só se progresso < 100)
//   - Sino de notificações
//   - Avatar + nome + role com dropdown de actors completo (multi-modal +
//     opções de cadastro)

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getProfileProgress, type ProfileProgress } from '../../api/profile';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { showToast } from '../common/Toast';
import './GlobalHeader.css';

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const { actors, setActiveActor } = useActiveActor();
  const [profileProgress, setProfileProgress] = useState<ProfileProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) return;
    if (activeActor.actor_type !== 'user') {
      setProfileProgress(null);
      return;
    }
    getProfileProgress()
      .then(setProfileProgress)
      .catch(() => setProfileProgress(null));
  }, [sessionReady, activeActor?.actor_id, activeActor?.actor_type]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Escutar evento global (ex: HomeContextual dispara open-actor-dropdown)
  useEffect(() => {
    const handler = () => {
      setIsDropdownOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('open-actor-dropdown', handler);
    return () => window.removeEventListener('open-actor-dropdown', handler);
  }, []);

  if (!activeActor) return null;

  const firstName = (() => {
    if (!activeActor.display_name) return null;
    if (activeActor.actor_type === 'user') {
      return activeActor.display_name.trim().split(/\s+/)[0];
    }
    return activeActor.display_name;
  })();

  const progressPct = profileProgress?.progress ?? 0;
  const showProfileCompact = activeActor.actor_type === 'user' && progressPct < 100;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const actorRole = (() => {
    switch (activeActor.actor_type) {
      case 'user': return 'Pessoa Física';
      case 'page': return 'Empresa';
      case 'group': return 'Grupo';
      case 'channel': return 'Canal';
      default: return activeActor.actor_type;
    }
  })();

  const availableActors = Array.isArray(actors) ? actors : [];
  const personalActor = availableActors.find((a) => a.actor_type === 'user');
  const companyActors = availableActors.filter((a) => a.actor_type === 'page');

  const handleSelectActor = (actorId: string) => {
    setActiveActor(actorId);
    // Mantém dropdown aberto para navegação rápida; usuário fecha clicando fora.
  };

  const getActorIcon = (type: string) => {
    if (type === 'user') return '👤';
    if (type === 'page') return '🏢';
    if (type === 'group') return '👥';
    if (type === 'channel') return '📡';
    return '•';
  };

  const renderActorItem = (
    actor: typeof availableActors[number],
    subtitleOverride?: string
  ) => {
    const isActive = activeActor.actor_id === actor.actor_id;
    const isProvisional = actor.actor_type === 'page' && actor.company_status === 'PROVISIONAL';
    const subtitle = subtitleOverride
      ?? (actor.user_role === 'owner' ? '👑 Proprietário'
        : actor.user_role === 'director' ? '💼 Diretor'
        : actor.user_role === 'manager' ? '📋 Gerente'
        : actor.user_role === 'employee' ? '👔 Funcionário'
        : null);
    return (
      <button
        key={actor.actor_id}
        type="button"
        className={`gh-dd-item ${isActive ? 'active' : ''}`}
        onClick={() => handleSelectActor(actor.actor_id)}
      >
        <span className="gh-dd-item-icon" aria-hidden="true">{getActorIcon(actor.actor_type)}</span>
        <div className="gh-dd-item-info">
          <div className="gh-dd-item-name">
            {actor.display_name}
            {isProvisional && <span className="gh-dd-badge-provisional">provisional</span>}
          </div>
          {subtitle && <div className="gh-dd-item-subtitle">{subtitle}</div>}
        </div>
        {isActive && <span className="gh-dd-item-check">✓</span>}
      </button>
    );
  };

  return (
    <header className="gh-root">
      <div className="gh-left">
        <h1 className="gh-greeting-title">
          {firstName ? (
            <>Olá, <span>{firstName}</span>! 👋</>
          ) : (
            <>Bem-vindo ao UnifiCard 👋</>
          )}
        </h1>
        <p className="gh-greeting-subtitle">Bem-vindo de volta ao UnifiCard</p>
      </div>

      <form className="gh-search" onSubmit={handleSearch} role="search">
        <span className="gh-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          placeholder="Buscar no UnifiCard..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="gh-search-input"
          aria-label="Buscar"
        />
      </form>

      <div className="gh-actions">
        {showProfileCompact && (
          <button
            type="button"
            className="gh-profile-compact"
            onClick={() => navigate('/perfil')}
            aria-label={`Completar meu perfil — ${progressPct}% concluído`}
          >
            <span className="gh-profile-compact-text">Completar meu perfil</span>
            <span className="gh-profile-compact-pct">{progressPct}%</span>
            <div className="gh-profile-compact-bar">
              <div className="gh-profile-compact-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </button>
        )}

        <button
          type="button"
          className="gh-bell"
          onClick={() => navigate('/notifications')}
          aria-label="Notificações"
        >
          🔔
        </button>

        <div className="gh-avatar-container" ref={dropdownRef}>
          <button
            type="button"
            className="gh-avatar-button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="Trocar perfil ativo"
            aria-expanded={isDropdownOpen}
          >
            <div className="gh-avatar-circle" aria-hidden="true">
              {firstName ? firstName[0].toUpperCase() : '?'}
            </div>
            <div className="gh-avatar-text">
              <div className="gh-avatar-name">{activeActor.display_name}</div>
              <div className="gh-avatar-role">
                {actorRole} {isDropdownOpen ? '▲' : '▼'}
              </div>
            </div>
          </button>

          {isDropdownOpen && (
            <div className="gh-dd-menu">
              {personalActor && renderActorItem(personalActor, 'Pessoa Física')}
              {personalActor && companyActors.length > 0 && <div className="gh-dd-separator" />}
              {companyActors.map((actor) => renderActorItem(actor))}

              <div className="gh-dd-separator" />

              <button
                type="button"
                className="gh-dd-item gh-dd-item-action"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/empresas');
                }}
              >
                <span className="gh-dd-item-icon" aria-hidden="true">➕</span>
                <div className="gh-dd-item-info">
                  <div className="gh-dd-item-name">Cadastrar nova empresa</div>
                </div>
              </button>

              <button
                type="button"
                className="gh-dd-item gh-dd-item-action"
                onClick={() => showToast('Cadastro de página em desenvolvimento — em breve.', 'info')}
              >
                <span className="gh-dd-item-icon" aria-hidden="true">➕</span>
                <div className="gh-dd-item-info">
                  <div className="gh-dd-item-name">Cadastrar uma página</div>
                  <div className="gh-dd-item-subtitle">em breve</div>
                </div>
              </button>

              <button
                type="button"
                className="gh-dd-item gh-dd-item-action"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/grupos');
                }}
              >
                <span className="gh-dd-item-icon" aria-hidden="true">➕</span>
                <div className="gh-dd-item-info">
                  <div className="gh-dd-item-name">Cadastrar um grupo</div>
                </div>
              </button>

              <button
                type="button"
                className="gh-dd-item gh-dd-item-action"
                onClick={() => showToast('Cadastro de artista/banda em desenvolvimento — em breve.', 'info')}
              >
                <span className="gh-dd-item-icon" aria-hidden="true">➕</span>
                <div className="gh-dd-item-info">
                  <div className="gh-dd-item-name">Cadastrar um artista / banda</div>
                  <div className="gh-dd-item-subtitle">em breve</div>
                </div>
              </button>

              <button
                type="button"
                className="gh-dd-item gh-dd-item-action"
                onClick={() => showToast('Cadastro de canal em desenvolvimento — em breve.', 'info')}
              >
                <span className="gh-dd-item-icon" aria-hidden="true">➕</span>
                <div className="gh-dd-item-info">
                  <div className="gh-dd-item-name">Cadastrar um canal</div>
                  <div className="gh-dd-item-subtitle">em breve</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

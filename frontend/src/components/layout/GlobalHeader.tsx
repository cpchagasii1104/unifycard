// frontend/src/components/layout/GlobalHeader.tsx
// 2026-05-15: Header unificado compartilhado por TODAS as páginas autenticadas.
// Pedido Clayton: a topbar deve ser igual em todas as páginas (assim como a
// sidebar). Conteúdo muda contextualmente conforme actor ativo (useActorMode),
// mas estrutura é universal.
//
// Substitui:
//   - HeaderGlobal.tsx antigo (saldo + Atuando como + Ir para Banco)
//   - TopBar inline do DashboardHome
//
// Estrutura:
//   - Saudação personalizada (Olá, [primeiro nome])
//   - Barra de busca
//   - Botão compacto "Completar meu perfil X%" (só se progresso < 100)
//   - Sino de notificações
//   - Avatar + nome + role (clique abre dropdown via evento)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { getProfileProgress, type ProfileProgress } from '../../api/profile';
import { isAuthenticated, getTenantId } from '../../config/auth';
import './GlobalHeader.css';

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const [profileProgress, setProfileProgress] = useState<ProfileProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

        <button
          type="button"
          className="gh-avatar-button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-actor-dropdown'))}
          aria-label="Trocar perfil ativo"
        >
          <div className="gh-avatar-circle" aria-hidden="true">
            {firstName ? firstName[0].toUpperCase() : '?'}
          </div>
          <div className="gh-avatar-text">
            <div className="gh-avatar-name">{activeActor.display_name}</div>
            <div className="gh-avatar-role">{actorRole} ▼</div>
          </div>
        </button>
      </div>
    </header>
  );
}

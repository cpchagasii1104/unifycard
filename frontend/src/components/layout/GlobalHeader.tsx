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
import OperatingModeToggle from './OperatingModeToggle';
import OperatingModeBadge from './OperatingModeBadge';
import { useActorMode } from '../../hooks/useActorMode';
import { useBusinessProfile } from '../../hooks/useBusinessProfile';
import { getActorGreetingSubtitle, profileHasTwoOperatingModes } from '../../config/actorContextConfig';
import OmniSearchDropdown from './OmniSearchDropdown';
import { searchOmni, type OmniSearchResult } from '../../api/search';
import { getNavigationModules, type NavModuleItem } from '../../api/navigation';
import './GlobalHeader.css';

// normalização accent-insensitive p/ a pista IR PARA (filtro local sobre a projeção de navegação)
function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const { actors, setActiveActor } = useActiveActor();
  const { profile: actorProfile, mode } = useActorMode();
  const { profile: businessProfile } = useBusinessProfile();
  const [profileProgress, setProfileProgress] = useState<ProfileProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── F-GLOBAL-SEARCH-OMNI Slice B: estado do omnibox ──
  const [omniOpen, setOmniOpen] = useState(false);
  const [omniLoading, setOmniLoading] = useState(false);
  const [omniResult, setOmniResult] = useState<OmniSearchResult | null>(null);
  const [navItems, setNavItems] = useState<NavModuleItem[] | null>(null); // lazy: projeção /navigation/modules
  const searchRef = useRef<HTMLFormElement>(null);
  const omniSeq = useRef(0); // descarta respostas fora de ordem (race de debounce)

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

  // Escutar evento global open-actor-dropdown (disparado por botão em qualquer página)
  useEffect(() => {
    const handler = () => {
      setIsDropdownOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('open-actor-dropdown', handler);
    return () => window.removeEventListener('open-actor-dropdown', handler);
  }, []);

  // ── omnibox: debounce 300ms → GET /search?q= (seções resolvidas pelo backend) ──
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setOmniOpen(false);
      setOmniResult(null);
      return;
    }
    setOmniLoading(true);
    setOmniOpen(true);
    const seq = ++omniSeq.current;
    const t = setTimeout(() => {
      searchOmni(q)
        .then((r) => {
          if (omniSeq.current === seq) setOmniResult(r);
        })
        .catch(() => {
          if (omniSeq.current === seq) setOmniResult(null);
        })
        .finally(() => {
          if (omniSeq.current === seq) setOmniLoading(false);
        });
      // pista IR PARA: projeção de navegação carregada 1× (lazy) — módulos que o actor
      // não vê na sidebar também não aparecem na busca (mesma projeção governada).
      if (navItems === null) {
        getNavigationModules()
          .then((proj) => setNavItems(proj.groups.flatMap((g) => g.items)))
          .catch(() => setNavItems([]));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // omnibox: fechar com Escape e clique-fora
  useEffect(() => {
    if (!omniOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOmniOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOmniOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [omniOpen]);

  const omniNavHits = (() => {
    const q = normalizeSearch(searchQuery.trim());
    if (q.length < 2 || !navItems) return [];
    return navItems.filter((m) => normalizeSearch(m.label).includes(q)).slice(0, 5);
  })();

  const handleOmniNavigate = (route: string) => {
    setOmniOpen(false);
    setSearchQuery('');
    navigate(route);
  };

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
    const trimmed = searchQuery.trim();
    if (trimmed) {
      // 🔎 F-GLOBAL-SEARCH-OMNI Slice C: a busca universal AGORA EXISTE — Enter leva à página
      // federada /search?q= (histórico: o rewire interino de 2026-07-01 apontava para
      // /discover/services?term=, que segue viva como vertical de serviços linkada de lá).
      setOmniOpen(false);
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
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

  // F-ACTOR-MODE-SURFACE-CLARITY-SLICE (peça única "quem × modo"): badge de modo + switcher de
  // actor agrupados visualmente numa mesma pílula (identidade combinada, leitura de estado). O
  // toggle (controle de troca) permanece separado — pílula é declarativa, não interativa em si.
  // aria-label unifica a leitura para tecnologia assistiva mesmo com os 2 subcomponentes internos.
  const identityPillLabel = profileHasTwoOperatingModes(actorProfile)
    ? `Operando como ${activeActor.display_name} · ${mode === 'operar' ? 'Operando' : 'Consumindo'}`
    : `Operando como ${activeActor.display_name}`;

  const availableActors = Array.isArray(actors) ? actors : [];
  const personalActor = availableActors.find((a) => a.actor_type === 'user');
  const companyActors = availableActors.filter((a) => a.actor_type === 'page');
  // 2026-05-18 RC4: dropdown agora inclui grupos e canais.
  const groupActors = availableActors.filter((a) => a.actor_type === 'group');
  const channelActors = availableActors.filter((a) => a.actor_type === 'channel');

  // 2026-05-18 RC5: subtítulo contextual derivado do actor + mode (com
  // override de businessProfile quando empresa for banda/clínica/loja/etc).
  const greetingSubtitle = (() => {
    if (businessProfile) return businessProfile.tagline;
    return getActorGreetingSubtitle(actorProfile, mode);
  })();

  const handleSelectActor = (actorId: string) => {
    setActiveActor(actorId);
    setIsDropdownOpen(false);
    navigate('/home');
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
        <p className="gh-greeting-subtitle">{greetingSubtitle}</p>
      </div>

      <form className="gh-search" onSubmit={handleSearch} role="search" ref={searchRef}>
        <span className="gh-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          placeholder="Buscar no UnifiCard..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => { if (searchQuery.trim().length >= 2) setOmniOpen(true); }}
          className="gh-search-input"
          aria-label="Buscar"
          aria-expanded={omniOpen}
        />
        <span className="gh-search-shortcut" aria-hidden="true">Ctrl K</span>
        {/* F-GLOBAL-SEARCH-OMNI Slice B: seções federadas (backend decide o que aparece);
            Enter continua caindo no fallback de página cheia (discovery de serviços). */}
        {omniOpen && (
          <OmniSearchDropdown
            q={searchQuery.trim()}
            result={omniResult}
            navHits={omniNavHits}
            loading={omniLoading}
            mode={mode}
            onNavigate={handleOmniNavigate}
            onFullSearch={() => {
              setOmniOpen(false);
              navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            }}
          />
        )}
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

        <OperatingModeToggle />

        {/* F-ACTOR-MODE-SURFACE-CLARITY-SLICE: pílula única "quem × modo". Badge (leitura do modo)
            + switcher de actor (leitura do quem + controle de troca) agrupados visualmente com
            fundo/borda compartilhados. aria-label no wrapper declara o estado combinado inteiro
            para leitores de tela; os 2 subcomponentes internos preservam seus próprios rótulos. */}
        <div className="gh-identity-pill" role="group" aria-label={identityPillLabel}>
          {/* 2026-05-18 RC6: badge discreto persistente do modo operante.
              Sinaliza contexto operacional mesmo fora da home. */}
          <OperatingModeBadge />

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
              {/* Pessoal */}
              {personalActor && (
                <>
                  <div className="gh-dd-group-label">Pessoal</div>
                  {renderActorItem(personalActor, 'Pessoa Física')}
                </>
              )}
              {/* Empresas */}
              {companyActors.length > 0 && (
                <>
                  <div className="gh-dd-separator" />
                  <div className="gh-dd-group-label">Empresas</div>
                  {companyActors.map((actor) => renderActorItem(actor))}
                </>
              )}
              {/* Grupos (RC4 2026-05-18) */}
              {groupActors.length > 0 && (
                <>
                  <div className="gh-dd-separator" />
                  <div className="gh-dd-group-label">Grupos</div>
                  {groupActors.map((actor) => renderActorItem(actor, 'Coordenando'))}
                </>
              )}
              {/* Canais (RC4 2026-05-18) */}
              {channelActors.length > 0 && (
                <>
                  <div className="gh-dd-separator" />
                  <div className="gh-dd-group-label">Canais</div>
                  {channelActors.map((actor) => renderActorItem(actor, 'Publicando'))}
                </>
              )}

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
      </div>
    </header>
  );
}

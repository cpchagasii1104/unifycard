// frontend/src/components/home/DashboardHome.tsx
// Home dashboard reescrita inspirada nas mockups Clayton (ChatGPT, 2026-05-15):
// - Desktop (>= 1024px): sidebar à esquerda + main grid
// - Mobile (< 768px): sem sidebar + bottom nav 5 itens com FAB central
//
// Blocos viáveis com substrato vivo:
//   1. TopBar (saudação + busca + bell + avatar + progresso compacto)
//   2. 4 cards visão geral — Fundo Regional + Meu saldo OK; Em processamento + Limite disponível como "—" (sem substrato real)
//   3. Card destacado "Ganho com indicações" com mini-gráfico decorativo
//   4. Meus grupos (cards horizontais com avatar + papel + saldo + linha colorida)
//   5. Acessos rápidos (8 atalhos circulares)
//   6. Banner promo (estático)
//   7. Atividade recente (getBankStatement últimas 4)
//   8. Bottom nav (mobile) com FAB central

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance, getBankStatement, type BankStatementEntry } from '../../api/bank';
import { getMyGroups, getGroupBalance } from '../../api/groups';
import { getReferralEarnings } from '../../api/auth';
import { getUserRegionalFund } from '../../api/transparency';
import { getProfileProgress, type ProfileProgress } from '../../api/profile';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import GlobalSidebar from '../layout/GlobalSidebar';
import './DashboardHome.css';

interface GroupRow {
  groupId: string;
  name: string;
  balance: number;
  currency: string;
  category?: string;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centsToReais(cents));

const formatBRLFromReais = (reais: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(reais);

const groupColor = (groupId: string): string => {
  const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
};

const initialsFromName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Mini-gráfico decorativo (sem histórico temporal real — visual elegante).
function TrendChart({ color, large = false }: { color: string; large?: boolean }) {
  const id = `grad-${color.replace('#', '')}-${large ? 'lg' : 'sm'}`;
  return (
    <svg
      className={`dh-trend ${large ? 'dh-trend-lg' : ''}`}
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0 45 L 20 38 L 40 42 L 60 30 L 85 35 L 110 22 L 135 28 L 160 18 L 200 12 L 200 60 L 0 60 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M 0 45 L 20 38 L 40 42 L 60 30 L 85 35 L 110 22 L 135 28 L 160 18 L 200 12"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

const QUICK_ACTIONS: Array<{ label: string; icon: string; route: string; color: string }> = [
  { label: 'Rede Social', icon: '💬', route: '/social', color: '#10b981' },
  { label: 'Meus Grupos', icon: '👥', route: '/grupos', color: '#8b5cf6' },
  { label: 'Pedir um Carro', icon: '🚗', route: '/em-desenvolvimento?feature=mobility', color: '#f59e0b' },
  { label: 'Eventos', icon: '🎭', route: '/eventos', color: '#ec4899' },
  { label: 'Marketplace', icon: '🛒', route: '/marketplace', color: '#06b6d4' },
  { label: 'Transferir', icon: '↗️', route: '/banco', color: '#3b82f6' },
  { label: 'Depósito', icon: '⬇️', route: '/banco', color: '#84cc16' },
  { label: 'Sacar', icon: '⬆️', route: '/banco', color: '#ef4444' },
];

const BOTTOM_NAV_LEFT: Array<{ label: string; icon: string; route: string }> = [
  { label: 'Início', icon: '🏠', route: '/home' },
  { label: 'Carteira', icon: '💳', route: '/banco' },
];

const BOTTOM_NAV_RIGHT: Array<{ label: string; icon: string; route: string }> = [
  { label: 'Notificações', icon: '🔔', route: '/notifications' },
  { label: 'Perfil', icon: '👤', route: '/perfil' },
];

const contextLabels: Record<string, string> = {
  event_ticket: 'Compra de ingresso',
  service_booking: 'Agendamento de serviço',
  ride_payment: 'Mobilidade',
  donation: 'Doação',
  p2p_transfer: 'Transferência recebida',
  group_contribution: 'Contribuição de grupo',
};

export default function DashboardHome() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();

  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [regionalFundCents, setRegionalFundCents] = useState<number | null>(null);
  const [referralEarningsCents, setReferralEarningsCents] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [profileProgress, setProfileProgress] = useState<ProfileProgress | null>(null);
  const [recentEntries, setRecentEntries] = useState<BankStatementEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    if (!activeActor) return;
    const isUser = activeActor.actor_type === 'user';

    const [balanceR, groupsR, referralR, regionalR, progressR, statementR] = await Promise.allSettled([
      getBankBalance().catch(() => null),
      getMyGroups().catch(() => ({ groups: [] })),
      isUser ? getReferralEarnings().catch(() => null) : Promise.resolve(null),
      isUser ? getUserRegionalFund({ limit: 1 }).catch(() => null) : Promise.resolve(null),
      isUser ? getProfileProgress().catch(() => null) : Promise.resolve(null),
      getBankStatement({ limit: 4 }).catch(() => ({ entries: [], total: 0, hasMore: false })),
    ]);

    setBalanceCents(
      balanceR.status === 'fulfilled' && balanceR.value
        ? (balanceR.value.balanceCents ?? balanceR.value.balance ?? null)
        : null
    );
    setRegionalFundCents(
      regionalR.status === 'fulfilled' && regionalR.value
        ? regionalR.value.currentBalanceCents ?? 0
        : null
    );
    if (referralR.status === 'fulfilled' && referralR.value) {
      setReferralEarningsCents(referralR.value.totalCents);
      setReferralCount(referralR.value.count);
    }
    setProfileProgress(progressR.status === 'fulfilled' ? progressR.value : null);
    setRecentEntries(statementR.status === 'fulfilled' ? statementR.value.entries : []);

    const groupsList = groupsR.status === 'fulfilled' ? groupsR.value.groups || [] : [];
    const balanceFetches = await Promise.allSettled(
      groupsList.map((g) => getGroupBalance(g.groupId).then((b) => ({ group: g, balance: b })))
    );
    const rows: GroupRow[] = balanceFetches
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((x): x is { group: typeof groupsList[number]; balance: any } => !!x && !!x.balance)
      .map(({ group, balance }) => ({
        groupId: group.groupId,
        name: group.name,
        balance: balance.balance,
        currency: balance.currency,
      }));
    setGroups(rows);
  }, [activeActor]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) return;
    loadData();
  }, [sessionReady, activeActor?.actor_id, loadData]);

  useEffect(() => {
    const handler = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) loadData();
    };
    window.addEventListener('active-actor-changed', handler);
    window.addEventListener('invalidate-queries', handler);
    return () => {
      window.removeEventListener('active-actor-changed', handler);
      window.removeEventListener('invalidate-queries', handler);
    };
  }, [sessionReady, activeActor, loadData]);

  if (!activeActor) return null;

  const firstName = (() => {
    if (!activeActor.display_name) return null;
    if (activeActor.actor_type === 'user') {
      return activeActor.display_name.trim().split(/\s+/)[0];
    }
    return activeActor.display_name;
  })();

  const isUser = activeActor.actor_type === 'user';
  const balanceToShow = balanceCents ?? 0;
  const progressPct = profileProgress?.progress ?? 0;
  const showProfileCompact = isUser && progressPct < 100;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="dh-shell">
      {/* Sidebar global unificada (mesma em todas as páginas autenticadas) */}
      <GlobalSidebar />

      {/* ============ MAIN ============ */}
      <main className="dh-main">
        {/* TopBar */}
        <header className="dh-topbar">
          <div className="dh-topbar-left">
            <h1 className="dh-greeting-title">
              {firstName ? (
                <>Olá, <span>{firstName}</span>! 👋</>
              ) : (
                <>Bem-vindo ao UnifiCard 👋</>
              )}
            </h1>
            <p className="dh-greeting-subtitle">Bem-vindo de volta ao UnifiCard</p>
          </div>

          <form className="dh-search" onSubmit={handleSearch} role="search">
            <span className="dh-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              placeholder="Buscar no UnifiCard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dh-search-input"
              aria-label="Buscar"
            />
          </form>

          <div className="dh-topbar-actions">
            {showProfileCompact && (
              <button
                type="button"
                className="dh-profile-compact"
                onClick={() => navigate('/perfil')}
                aria-label={`Completar meu perfil — ${progressPct}% concluído`}
              >
                <span className="dh-profile-compact-text">Completar meu perfil</span>
                <span className="dh-profile-compact-pct">{progressPct}%</span>
                <div className="dh-profile-compact-bar">
                  <div className="dh-profile-compact-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </button>
            )}

            <button
              type="button"
              className="dh-topbar-bell"
              onClick={() => navigate('/notifications')}
              aria-label="Notificações"
            >
              🔔
            </button>

            <button
              type="button"
              className="dh-topbar-avatar"
              onClick={() => window.dispatchEvent(new CustomEvent('open-actor-dropdown'))}
              aria-label="Trocar perfil ativo"
            >
              <div className="dh-avatar-circle" aria-hidden="true">
                {firstName ? firstName[0].toUpperCase() : '?'}
              </div>
              <div className="dh-avatar-text">
                <div className="dh-avatar-name">{activeActor.display_name}</div>
                <div className="dh-avatar-role">
                  {activeActor.actor_type === 'user' ? 'Pessoa Física' : 'Empresa'} ▼
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* 4 cards de visão geral */}
        <section className="dh-overview-cards">
          {isUser && (
            <div className="dh-card dh-card-1">
              <div className="dh-card-head">
                <div className="dh-card-icon-circle">🌍</div>
                <div className="dh-card-label">Fundo Regional</div>
              </div>
              <div className="dh-card-value">{formatBRL(regionalFundCents ?? 0)}</div>
              <div className="dh-card-foot">
                <span className="dh-card-hint">onde você mora</span>
              </div>
            </div>
          )}

          <div className="dh-card dh-card-2">
            <div className="dh-card-head">
              <div className="dh-card-icon-circle">💰</div>
              <div className="dh-card-label">Meu saldo Unifibank</div>
            </div>
            <div className={`dh-card-value ${balanceToShow < 0 ? 'negative' : ''}`}>
              {formatBRL(balanceToShow)}
            </div>
            <div className="dh-card-foot">
              <span className="dh-card-hint">saldo disponível</span>
            </div>
          </div>

          <div className="dh-card dh-card-3">
            <div className="dh-card-head">
              <div className="dh-card-icon-circle">⏳</div>
              <div className="dh-card-label">Em processamento</div>
            </div>
            <div className="dh-card-value dh-card-placeholder">—</div>
            <div className="dh-card-foot">
              <span className="dh-card-hint">a confirmar</span>
            </div>
          </div>

          <div className="dh-card dh-card-4">
            <div className="dh-card-head">
              <div className="dh-card-icon-circle">💳</div>
              <div className="dh-card-label">Limite disponível</div>
            </div>
            <div className="dh-card-value dh-card-placeholder">—</div>
            <div className="dh-card-foot">
              <span className="dh-card-hint">UnifyCard</span>
            </div>
          </div>
        </section>

        {/* Meus grupos */}
        <section className="dh-section">
          <div className="dh-section-header">
            <h2 className="dh-section-title">Meus grupos</h2>
            {groups.length > 0 && (
              <button type="button" className="dh-section-link" onClick={() => navigate('/grupos')}>
                Ver todos
              </button>
            )}
          </div>
          {groups.length === 0 ? (
            <div className="dh-empty-card">
              <div className="dh-empty-icon">👥</div>
              <div className="dh-empty-body">
                <div className="dh-empty-title">Você ainda não participa de grupos</div>
                <div className="dh-empty-hint">Encontre comunidades compatíveis com seus interesses</div>
              </div>
              <button type="button" className="dh-btn dh-btn-primary" onClick={() => navigate('/grupos')}>
                Explorar grupos
              </button>
            </div>
          ) : (
            <div className="dh-groups-grid">
              {groups.map((g) => {
                const color = groupColor(g.groupId);
                return (
                  <button
                    key={g.groupId}
                    type="button"
                    className="dh-group-card"
                    onClick={() => navigate(`/grupos/${g.groupId}`)}
                  >
                    <div className="dh-group-card-top">
                      <div className="dh-group-avatar" style={{ backgroundColor: color }}>
                        {initialsFromName(g.name)}
                      </div>
                      <div className="dh-group-body">
                        <div className="dh-group-name">{g.name}</div>
                        <div className="dh-group-hint">Saldo do grupo</div>
                      </div>
                    </div>
                    <div className={`dh-group-balance ${g.balance < 0 ? 'negative' : ''}`}>
                      {formatBRLFromReais(g.balance, g.currency || 'BRL')}
                    </div>
                    <div className="dh-group-stripe" style={{ backgroundColor: color }} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Card destacado de Indicações */}
        {isUser && (
          <section className="dh-section">
            <div className="dh-section-header">
              <h2 className="dh-section-title">Ganho com indicações</h2>
            </div>
            <div className="dh-referral-card">
              <div className="dh-referral-info">
                <div className="dh-referral-value">{formatBRL(referralEarningsCents)}</div>
                <div className="dh-referral-meta">
                  <span className="dh-referral-count">
                    {referralCount > 0
                      ? `${referralCount} indicação${referralCount > 1 ? 'ões' : ''}`
                      : 'sem indicações ainda'}
                  </span>
                </div>
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-sm"
                  onClick={() => navigate('/perfil')}
                >
                  Convidar amigos
                </button>
              </div>
              <div className="dh-referral-chart">
                <TrendChart color="#8b5cf6" large />
              </div>
            </div>
          </section>
        )}

        {/* Acessos rápidos */}
        <section className="dh-section">
          <div className="dh-section-header">
            <h2 className="dh-section-title">Acessos rápidos</h2>
          </div>
          <div className="dh-quick-actions">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                className="dh-quick-action"
                onClick={() => navigate(a.route)}
              >
                <div className="dh-quick-icon" style={{ backgroundColor: a.color + '22', color: a.color }}>
                  <span>{a.icon}</span>
                </div>
                <span className="dh-quick-label">{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Banner promo */}
        <section className="dh-promo">
          <div className="dh-promo-text">
            <h3 className="dh-promo-title">UnifiCard é mais que sua carteira</h3>
            <p className="dh-promo-sub">
              Coordene tempo, dinheiro e relações em um só lugar. Cooperativismo, transparência e
              autogestão em cada transação.
            </p>
            <button
              type="button"
              className="dh-btn dh-btn-on-promo"
              onClick={() => navigate('/transparencia')}
            >
              Saiba mais
            </button>
          </div>
          <div className="dh-promo-art" aria-hidden="true">
            <span>🌐</span>
            <span>💸</span>
            <span>👥</span>
          </div>
        </section>

        {/* Atividade recente */}
        <section className="dh-section">
          <div className="dh-section-header">
            <h2 className="dh-section-title">Atividade recente</h2>
            {recentEntries.length > 0 && (
              <button type="button" className="dh-section-link" onClick={() => navigate('/banco')}>
                Ver todas
              </button>
            )}
          </div>
          {recentEntries.length === 0 ? (
            <div className="dh-empty-card">
              <div className="dh-empty-icon">📭</div>
              <div className="dh-empty-body">
                <div className="dh-empty-title">Nenhuma transação ainda</div>
                <div className="dh-empty-hint">Suas transações aparecerão aqui</div>
              </div>
            </div>
          ) : (
            <ul className="dh-activity-list">
              {recentEntries.map((e) => {
                const isIn = e.direction === 'in';
                return (
                  <li key={e.transactionId} className="dh-activity-item">
                    <div
                      className="dh-activity-icon"
                      style={{
                        backgroundColor: isIn ? '#d1fae5' : '#fee2e2',
                        color: isIn ? '#059669' : '#dc2626',
                      }}
                    >
                      {isIn ? '↓' : '↑'}
                    </div>
                    <div className="dh-activity-body">
                      <div className="dh-activity-title">
                        {contextLabels[e.context || ''] || 'Transação'}
                      </div>
                      <div className="dh-activity-date">
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(e.createdAt))}
                      </div>
                    </div>
                    <div className={`dh-activity-amount ${isIn ? 'positive' : 'negative'}`}>
                      {isIn ? '+' : '−'} {formatBRL(e.amountCents)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {/* ============ BOTTOM NAV (mobile) com FAB central ============ */}
      <nav className="dh-bottom-nav" aria-label="Navegação inferior">
        {BOTTOM_NAV_LEFT.map((b) => (
          <button
            key={b.label}
            type="button"
            className={`dh-bn-item ${b.route === '/home' ? 'active' : ''}`}
            onClick={() => navigate(b.route)}
          >
            <span className="dh-bn-icon">{b.icon}</span>
            <span className="dh-bn-label">{b.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="dh-bn-fab"
          onClick={() => window.dispatchEvent(new CustomEvent('open-actor-dropdown'))}
          aria-label="Ações rápidas"
        >
          +
        </button>
        {BOTTOM_NAV_RIGHT.map((b) => (
          <button
            key={b.label}
            type="button"
            className="dh-bn-item"
            onClick={() => navigate(b.route)}
          >
            <span className="dh-bn-icon">{b.icon}</span>
            <span className="dh-bn-label">{b.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

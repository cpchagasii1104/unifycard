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
//   5. Banner promo (estático)
//   6. Atividade recente (getBankStatement últimas 4)
//   7. Bottom nav (mobile) com FAB central

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance, getBankStatement, type BankStatementEntry } from '../../api/bank';
import { getMyGroups, getGroupBalance } from '../../api/groups';
import { getReferralEarnings } from '../../api/auth';
import { getUserRegionalFund } from '../../api/transparency';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import { useActorMode } from '../../hooks/useActorMode';
import { useProfessionalContext } from '../../hooks/useProfessionalContext';
import { useBusinessProfile } from '../../hooks/useBusinessProfile';
import { resolveIntentGroups, type ContextualOverlay } from '../../config/actorContextConfig';
import OperatingModeToggle from '../layout/OperatingModeToggle';
import InferredProfileCard from '../InferredProfileCard';
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

// 2026-05-18: intentGroups agora vêm de actorContextConfig + businessProfile +
// professionalContext (RC1+RC2+RC3+RC8 da auditoria contextual). Array literal
// universal antigo removido — gerava "Atender pacientes" para banda.

export default function DashboardHome() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const { profile: actorProfile, mode } = useActorMode();
  const { context: professionalContext } = useProfessionalContext();
  const { profile: businessProfile } = useBusinessProfile();

  // Intent groups contextuais. Substituem o array literal universal antigo.
  // - businessProfile (PJ): substitui groups genéricos da PJ pelo perfil resolvido
  // - professionalContext (PF + modo Operar): insere grupo "Sua profissão" no topo
  // - fallback: groups do profile base (PF / PJ genérico / Group / Channel)
  const intentGroups = (() => {
    const professionOverlay: ContextualOverlay | null = professionalContext
      ? {
          title: `Sua profissão hoje (${professionalContext.label.toLowerCase()})`,
          quickActionIds: professionalContext.suggestedQuickActions,
        }
      : null;
    const businessOverlay: ContextualOverlay | null = businessProfile
      ? { intentGroupsOverride: businessProfile.intentGroups }
      : null;
    return resolveIntentGroups(actorProfile, mode, professionOverlay, businessOverlay);
  })();

  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [regionalFundCents, setRegionalFundCents] = useState<number | null>(null);
  const [referralEarningsCents, setReferralEarningsCents] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  // CP7 HOME READ SEAL: null = INDISPONÍVEL (erro estrutural do backend), distinto de [] = vazio real.
  const [recentEntries, setRecentEntries] = useState<BankStatementEntry[] | null>([]);

  const loadData = useCallback(async () => {
    if (!activeActor) return;
    const isUser = activeActor.actor_type === 'user';

    // 2026-05-18 P1 — Bank actor-context. Passa actor_id quando actor não é
    // o user autenticado. Backend valida authority e resolve saldo/extrato do
    // actor correto (DT-PRESSURE-BANK-ACTOR-CONTEXT fechada).
    const bankActorId = isUser ? undefined : activeActor.actor_id;

    const [balanceR, groupsR, referralR, regionalR, statementR] = await Promise.allSettled([
      getBankBalance({ actorId: bankActorId }).catch(() => null),
      getMyGroups().catch(() => ({ groups: [] })),
      isUser ? getReferralEarnings().catch(() => null) : Promise.resolve(null),
      isUser ? getUserRegionalFund({ limit: 1 }).catch(() => null) : Promise.resolve(null),
      // CP7: erro de extrato NÃO vira lista vazia falsa — null = indisponível
      getBankStatement({ limit: 4, actorId: bankActorId }).catch(() => null),
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
    setRecentEntries(
      statementR.status === 'fulfilled' && statementR.value ? statementR.value.entries : null
    );

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

  const isUser = activeActor.actor_type === 'user';
  // CP7 HOME READ SEAL: null = indisponível (erro estrutural) → exibe "—", NUNCA R$ 0,00 falso.
  // Zero real (conta com saldo 0 / sem conta) chega como 0 num 200 de sucesso e exibe R$ 0,00 honesto.
  const balanceToShow = balanceCents;

  return (
    <div className="dh-content">
      {/* Sidebar + Header agora vêm do UnifiedAuthLayout (HomePage.tsx).
          DashboardHome renderiza somente os blocos centrais do dashboard. */}

      <div className="dh-primary-column">
      {/* Cards de visão geral — contextuais ao actor (actorProfile.dashboardCards).
          PF: Fundo Regional + Meu saldo + Em processamento + Limite UnifyCard.
          PJ: Caixa empresa + Movimentações + Em processamento + Limite UnifyCard.
          Grupo: Caixa grupo + Movimentações + Em processamento.
          Channel: Meu saldo + Movimentações + Em processamento.
          Cards sem substrato real exibem "—" (não fake data — diretriz §-3). */}
      <section className="dh-overview-cards">
        {actorProfile.dashboardCards.map((cardId) => {
          switch (cardId) {
            case 'fundo-regional':
              return (
                <div key={cardId} className="dh-card dh-card-1">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">🌍</div>
                    <div className="dh-card-label">Fundo Regional</div>
                  </div>
                  <div className="dh-card-value">{regionalFundCents === null ? '—' : formatBRL(regionalFundCents)}</div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">onde você mora</span>
                  </div>
                </div>
              );
            case 'meu-saldo':
              return (
                <div key={cardId} className="dh-card dh-card-2">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">💰</div>
                    <div className="dh-card-label">Meu saldo Unifibank</div>
                  </div>
                  <div className={`dh-card-value ${(balanceToShow ?? 0) < 0 ? 'negative' : ''}`}>
                    {balanceToShow === null ? '—' : formatBRL(balanceToShow)}
                  </div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">saldo disponível</span>
                  </div>
                </div>
              );
            case 'caixa-empresa':
              return (
                <div key={cardId} className="dh-card dh-card-2">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">🏢</div>
                    <div className="dh-card-label">Caixa da empresa</div>
                  </div>
                  <div className={`dh-card-value ${(balanceToShow ?? 0) < 0 ? 'negative' : ''}`}>
                    {balanceToShow === null ? '—' : formatBRL(balanceToShow)}
                  </div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">saldo operacional</span>
                  </div>
                </div>
              );
            case 'caixa-grupo':
              return (
                <div key={cardId} className="dh-card dh-card-2">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">👥</div>
                    <div className="dh-card-label">Caixa do grupo</div>
                  </div>
                  <div className={`dh-card-value ${(balanceToShow ?? 0) < 0 ? 'negative' : ''}`}>
                    {balanceToShow === null ? '—' : formatBRL(balanceToShow)}
                  </div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">contribuições</span>
                  </div>
                </div>
              );
            case 'movimentacoes-mes':
              return (
                <div key={cardId} className="dh-card dh-card-3">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">📊</div>
                    <div className="dh-card-label">Movimentações do mês</div>
                  </div>
                  <div className="dh-card-value dh-card-placeholder">—</div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">a consolidar</span>
                  </div>
                </div>
              );
            case 'em-processamento':
              return (
                <div key={cardId} className="dh-card dh-card-3">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">⏳</div>
                    <div className="dh-card-label">Em processamento</div>
                  </div>
                  <div className="dh-card-value dh-card-placeholder">—</div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">a confirmar</span>
                  </div>
                </div>
              );
            case 'limite-disponivel':
              return (
                <div key={cardId} className="dh-card dh-card-4">
                  <div className="dh-card-head">
                    <div className="dh-card-icon-circle">💳</div>
                    <div className="dh-card-label">Limite disponível</div>
                  </div>
                  <div className="dh-card-value dh-card-placeholder">—</div>
                  <div className="dh-card-foot">
                    <span className="dh-card-hint">UnifyCard</span>
                  </div>
                </div>
              );
            default:
              return null;
          }
        })}
      </section>

        <section className="dh-intent-panel">
          <div className="dh-intent-header">
            <h2 className="dh-intent-title">O que você busca agora?</h2>
            <p className="dh-intent-subtitle">Busque, participe, organize ou opere o que faz parte da sua vida.</p>
            <div className="dh-intent-mode-control">
              <OperatingModeToggle />
            </div>
            <span className={`dh-intent-badge ${mode === 'operar' ? 'operar' : 'consumir'}`}>
              {mode === 'operar' ? 'Operando' : 'Consumindo'}
            </span>
          </div>
          <div className="dh-intent-groups">
            {intentGroups.map((group) => (
              <section key={group.title} className="dh-intent-group" aria-label={group.title}>
                <h3 className="dh-intent-group-title">{group.title}</h3>
                <div className="dh-intent-actions">
                  {group.items.map((action) => {
                    const copy = mode === 'operar' ? action.operate : action.consume;
                    return (
                      <button
                        key={`${group.title}-${action.consume[0]}`}
                        type="button"
                        className={`dh-intent-action ${action.tone === 'discover' ? 'dh-intent-action--discover' : ''}`}
                        onClick={() => navigate(action.route)}
                      >
                        <span className="dh-intent-action-icon" aria-hidden="true">{action.icon}</span>
                        <span className="dh-intent-action-copy">
                          <span className="dh-intent-action-label">{copy[0]}</span>
                          <span className="dh-intent-action-hint">{copy[1]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
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

        {/* 2026-05-18 P2 item 4 — UI "isso é você?" (display honesto)
            Renderiza apenas se backend retorna inferências reais (degradação graciosa).
            Frontend NÃO infere — só projeta o que /actors/:id/inferred-profile retornou. */}
        <InferredProfileCard />

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

        {/* Banner promo — contextual ao actor ativo */}
        {(() => {
          const banner = actorProfile.contextualBanner ?? {
            title: 'UnifiCard é mais que sua carteira',
            subtitle: 'Coordene tempo, dinheiro e relações em um só lugar. Cooperativismo, transparência e autogestão em cada transação.',
            route: '/transparencia',
          };
          return (
            <section className="dh-promo">
              <div className="dh-promo-text">
                <h3 className="dh-promo-title">{banner.title}</h3>
                <p className="dh-promo-sub">{banner.subtitle}</p>
                <button
                  type="button"
                  className="dh-btn dh-btn-on-promo"
                  onClick={() => navigate(banner.route ?? '/transparencia')}
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
          );
        })()}

        {/* Atividade recente */}
        <section className="dh-section">
          <div className="dh-section-header">
            <h2 className="dh-section-title">Atividade recente</h2>
            {recentEntries !== null && recentEntries.length > 0 && (
              <button type="button" className="dh-section-link" onClick={() => navigate('/banco')}>
                Ver todas
              </button>
            )}
          </div>
          {recentEntries === null ? (
            <div className="dh-empty-card">
              <div className="dh-empty-icon">⚠️</div>
              <div className="dh-empty-body">
                <div className="dh-empty-title">Extrato indisponível</div>
                <div className="dh-empty-hint">Não foi possível carregar suas transações agora</div>
              </div>
            </div>
          ) : recentEntries.length === 0 ? (
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
      </div>

      <aside className="dh-right-rail" aria-label="Informações contextuais">
        <section className="dh-rail-section">
          <div className="dh-rail-heading">
            <h2 className="dh-rail-title">Patrocinado</h2>
            <span className="dh-rail-kicker">publicidade</span>
          </div>
          <div className="dh-rail-stack">
            <div className="dh-rail-card dh-rail-card-sponsored dh-rail-ad-card dh-rail-card-accent-purple">
              <div className="dh-rail-card-icon" aria-hidden="true">📣</div>
              <div className="dh-rail-card-body">
                <span className="dh-rail-card-label">Anuncie para quem está perto</span>
                <span className="dh-rail-card-text">Espaço para parceiros, lojas locais e campanhas segmentadas.</span>
                <span className="dh-rail-ad-price">Patrocínio local</span>
              </div>
            </div>
            <div className="dh-rail-card dh-rail-card-sponsored dh-rail-ad-card dh-rail-card-accent-green">
              <div className="dh-rail-card-icon" aria-hidden="true">💼</div>
              <div className="dh-rail-card-body">
                <span className="dh-rail-card-label">Destaque sua empresa</span>
                <span className="dh-rail-card-text">Vitrine contextual para ofertas, serviços e eventos patrocinados.</span>
                <span className="dh-rail-ad-price">Gerar receita</span>
              </div>
            </div>
          </div>
        </section>

        <section className="dh-rail-section">
          <div className="dh-rail-heading">
            <h2 className="dh-rail-title">Lembretes</h2>
            <span className="dh-rail-kicker">hoje</span>
          </div>
          <div className="dh-rail-card dh-rail-card-compact">
            <div className="dh-rail-card-icon dh-rail-card-icon-soft" aria-hidden="true">🔔</div>
            <div className="dh-rail-card-body">
              <span className="dh-rail-card-label">Nada urgente agora</span>
              <span className="dh-rail-card-text">Aniversários, contas e compromissos entram aqui.</span>
            </div>
          </div>
        </section>

        <section className="dh-rail-section">
          <div className="dh-rail-heading">
            <h2 className="dh-rail-title">Mensagens</h2>
            <span className="dh-rail-kicker">em aberto</span>
          </div>
          <div className="dh-rail-card dh-rail-card-compact">
            <div className="dh-rail-card-icon dh-rail-card-icon-soft" aria-hidden="true">💬</div>
            <div className="dh-rail-card-body">
              <span className="dh-rail-card-label">Caixa tranquila</span>
              <span className="dh-rail-card-text">Conversas e solicitações em andamento aparecerão aqui.</span>
            </div>
          </div>
        </section>

        <section className="dh-rail-section">
          <div className="dh-rail-heading">
            <h2 className="dh-rail-title">Status do sistema</h2>
          </div>
          <div className="dh-rail-card dh-rail-card-compact">
            <div className="dh-rail-card-icon dh-rail-status-ok" aria-hidden="true">✓</div>
            <div className="dh-rail-card-body">
              <span className="dh-rail-card-label">Tudo funcionando</span>
              <span className="dh-rail-card-text">Última verificação: agora</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

// frontend/src/components/home/HomeContextual.tsx
// CONTINUOUS PRODUCTION: Home Contextual - SPRINT 1
// Home state-driven com "Situação Atual" e cards dinâmicos baseados em dados reais

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance, getBankStatement } from '../../api/bank';
import { listCompanies } from '../../api/companies';
import { getMyGroups, getGroupBalance } from '../../api/groups';
import { getReferralEarnings } from '../../api/auth';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import MoneyDistribution from '../governance/MoneyDistribution';
import GroupAllocationCard from '../governance/GroupAllocationCard';
import RegionalFundCard from '../governance/RegionalFundCard';
import PendingActionsCenter from '../pending-actions/PendingActionsCenter';
import WorkflowAssistant from '../workflow/WorkflowAssistant';
import HealthSummaryCard from '../health/HealthSummaryCard';
import TrustTransparencyCard from '../trust/TrustTransparencyCard';
import HowItWorksSection from '../trust/HowItWorksSection';
import SystemLimitsSection from '../trust/SystemLimitsSection';
import GuardedButton from '../operational/GuardedButton';
import './HomeContextual.css';

interface HomeContextualData {
  /** Saldo em centavos (canônico §4.7). */
  balanceCents: number | null;
  lastTransaction: {
    /** Valor em centavos (canônico §4.7). */
    amountCents: number;
    direction: 'in' | 'out';
    context?: string;
    createdAt: string;
  } | null;
  companiesCount: number;
  groupsCount: number;
  eventsCount: number; // TODO: implementar quando API estiver disponível
  servicesCount: number; // TODO: implementar quando API estiver disponível
  /** A5: saldos dos grupos do usuário (nome + balance em BRL). */
  groupBalances: Array<{ groupId: string; name: string; balance: number; currency: string }>;
  /** A6: ganhos acumulados com código de indicação (cents). */
  referralEarningsCents: number;
  referralEarningsCount: number;
}

export default function HomeContextual() {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const [data, setData] = useState<HomeContextualData>({
    balanceCents: null,
    lastTransaction: null,
    companiesCount: 0,
    groupsCount: 0,
    eventsCount: 0,
    servicesCount: 0,
    groupBalances: [],
    referralEarningsCents: 0,
    referralEarningsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrustContent, setShowTrustContent] = useState(false);

  const loadContextualData = useCallback(async () => {
    if (!activeActor) return;

    setLoading(true);
    setError(null);

    try {
      // Carregar dados em paralelo
      // CONTINUOUS PRODUCTION: Usar Promise.allSettled para não quebrar se uma API falhar
      const [balanceResult, statementResult, companiesResult, groupsResult, referralResult] = await Promise.allSettled([
        getBankBalance().catch(() => null), // null se não conseguir carregar
        getBankStatement({ limit: 1 }).catch(() => ({ entries: [], total: 0, hasMore: false })),
        activeActor.actor_type === 'user' ? listCompanies().catch(() => []) : Promise.resolve([]),
        getMyGroups().catch(() => ({ groups: [] })),
        // A6: só carrega se actor for user; empresa não tem código de indicação próprio
        activeActor.actor_type === 'user' ? getReferralEarnings().catch(() => null) : Promise.resolve(null),
      ]);

      // Processar resultados — preferir `balanceCents` canônico (§4.7); cair para `balance` legado.
      const balanceCents = balanceResult.status === 'fulfilled' && balanceResult.value
        ? (balanceResult.value.balanceCents ?? balanceResult.value.balance ?? null)
        : null;
      const lastEntry = statementResult.status === 'fulfilled' && statementResult.value.entries.length > 0
        ? statementResult.value.entries[0]
        : null;
      const companies = companiesResult.status === 'fulfilled' ? companiesResult.value : [];
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value.groups || [] : [];

      // A5 (2026-05-15): fan-out de saldos por grupo. Endpoint GET /groups/:id/balance
      // já existe (groups.routes.ts:938 — lê via bankIntegrationService.getGroupBalance).
      // Falha individual em um grupo não derruba os outros.
      const balanceFetches = await Promise.allSettled(
        groups.map((g) => getGroupBalance(g.groupId).then((b) => ({ group: g, balance: b })))
      );
      const groupBalances = balanceFetches
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((x): x is { group: typeof groups[number]; balance: any } => !!x && !!x.balance)
        .map(({ group, balance }) => ({
          groupId: group.groupId,
          name: group.name,
          balance: balance.balance,
          currency: balance.currency,
        }));

      // Detectar se deve mostrar conteúdo de confiança (novo usuário ou sem atividade)
      const hasNoActivity = !lastEntry && balanceCents === null;
      const hasNoCompanies = activeActor.actor_type === 'user' && companies.length === 0;
      setShowTrustContent(hasNoActivity || hasNoCompanies);

      const referralEarnings = referralResult.status === 'fulfilled' ? referralResult.value : null;

      setData({
        balanceCents,
        lastTransaction: lastEntry ? {
          amountCents: lastEntry.amountCents,
          direction: lastEntry.direction,
          context: lastEntry.context,
          createdAt: lastEntry.createdAt,
        } : null,
        companiesCount: companies.length,
        groupsCount: groups.length,
        eventsCount: 0, // TODO: implementar quando API estiver disponível
        servicesCount: 0, // TODO: implementar quando API estiver disponível
        groupBalances,
        referralEarningsCents: referralEarnings?.totalCents ?? 0,
        referralEarningsCount: referralEarnings?.count ?? 0,
      });
    } catch (err: any) {
      console.error('Erro ao carregar dados contextuais:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [activeActor]);

  // Carregar dados quando actor mudar
  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadContextualData();
  }, [sessionReady, activeActor?.actor_id]);

  // Escutar evento de mudança de actor para recarregar dados
  useEffect(() => {
    const handleActorChanged = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) {
        loadContextualData();
      }
    };

    const handleInvalidateQueries = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) {
        loadContextualData();
      }
    };

    window.addEventListener('active-actor-changed', handleActorChanged);
    window.addEventListener('invalidate-queries', handleInvalidateQueries);
    return () => {
      window.removeEventListener('active-actor-changed', handleActorChanged);
      window.removeEventListener('invalidate-queries', handleInvalidateQueries);
    };
  }, [sessionReady, activeActor, loadContextualData]);

  /** Formata valor em CENTAVOS (§4.7) para string monetária BRL. */
  const formatCentsAsBRL = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(centsToReais(cents));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getContextLabel = (context?: string): string => {
    const labels: Record<string, string> = {
      event_ticket: 'Ingresso de evento',
      service_booking: 'Agendamento de serviço',
      ride_payment: 'Pagamento de corrida',
      donation: 'Doação',
      p2p_transfer: 'Transferência P2P',
      group_contribution: 'Contribuição para grupo',
    };
    return labels[context || ''] || 'Transação';
  };

  const getActorTypeLabel = (actorType: string): string => {
    const labels: Record<string, string> = {
      user: 'Pessoa Física',
      page: 'Empresa',
      group: 'Grupo',
      channel: 'Canal',
    };
    return labels[actorType] || actorType;
  };

  if (loading) {
    return (
      <div className="home-contextual">
        <div className="home-contextual-loading">
          <div className="skeleton skeleton-header" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-contextual">
        <div className="home-contextual-error">
          <p>Erro ao carregar dados: {error}</p>
          <button onClick={loadContextualData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  // A1 (2026-05-15): extrair primeiro nome do display_name do actor para saudação personalizada.
  // Para actor_type='user', display_name é o nome completo (ex: "Aparecida Pereira Chagas").
  // Para actor_type='page', display_name é a razão social da empresa — usamos o nome inteiro.
  const firstName = (() => {
    if (!activeActor?.display_name) return null;
    if (activeActor.actor_type === 'user') {
      return activeActor.display_name.trim().split(/\s+/)[0];
    }
    return activeActor.display_name;
  })();

  // A3 (2026-05-15): saldo sempre visível com R$0,00 explícito enquanto carrega ou sem dados.
  const balanceToShow = data.balanceCents ?? 0;

  return (
    <div className="home-contextual">
      {/* ============================================
          1) IDENTIDADE E ESTADO - TOPO
          ============================================ */}

      {/* A1: Saudação personalizada */}
      {firstName && (
        <div className="home-greeting">
          <h2 className="home-greeting-text">
            Olá <strong>{firstName}</strong>, o que deseja fazer hoje?
          </h2>
        </div>
      )}

      {/* Situação Atual */}
      <div className="home-situation">
        <h2>Situação Atual</h2>
        <div className="situation-content">
          {/* A2: actor clicável que abre o dropdown do Header global */}
          <button
            type="button"
            className="situation-actor situation-actor-button"
            onClick={() => {
              // HeaderGlobal escuta este evento para abrir o dropdown de actors
              window.dispatchEvent(new CustomEvent('open-actor-dropdown'));
            }}
            aria-label="Trocar usuário ou perfil ativo"
          >
            <span className="situation-label">Atuando como:</span>
            <span className="situation-value">
              {activeActor ? (
                <>
                  <strong>{activeActor.display_name}</strong>
                  <span className="situation-type">({getActorTypeLabel(activeActor.actor_type)})</span>
                </>
              ) : (
                'Não definido'
              )}
            </span>
            <span className="situation-actor-hint">▼ trocar</span>
          </button>

          {/* A3: Saldo sempre visível (R$0,00 quando vazio) */}
          <div className="situation-balance">
            <span className="situation-label">Saldo do usuário selecionado:</span>
            <span className={`situation-value ${balanceToShow >= 0 ? 'positive' : 'negative'}`}>
              {formatCentsAsBRL(balanceToShow)}
            </span>
          </div>

          {/* A6: Ganhos com código de indicação (só renderiza para actor_type='user') */}
          {activeActor?.actor_type === 'user' && (
            <div className="situation-balance">
              <span className="situation-label">Ganhos com o código de indicação:</span>
              <span className={`situation-value ${data.referralEarningsCents >= 0 ? 'positive' : 'negative'}`}>
                {formatCentsAsBRL(data.referralEarningsCents)}
              </span>
              {data.referralEarningsCount > 0 && (
                <span className="situation-type">({data.referralEarningsCount} indicação{data.referralEarningsCount > 1 ? 'ões' : ''})</span>
              )}
            </div>
          )}

          {/* A5: Saldo de cada grupo do usuário (nome + valor) */}
          {data.groupBalances.length > 0 && (
            <div className="situation-group-balances">
              <div className="situation-label">Saldos dos grupos:</div>
              <ul className="group-balance-list">
                {data.groupBalances.map((gb) => (
                  <li key={gb.groupId} className="group-balance-item">
                    <span className="group-balance-name">{gb.name}</span>
                    <span className={`group-balance-value ${gb.balance >= 0 ? 'positive' : 'negative'}`}>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: gb.currency || 'BRL',
                      }).format(gb.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Transparência & Confiança (frase curta no topo) */}
      {activeActor && (
        <div className="home-trust-transparency-short">
          <p className="trust-transparency-short-text">
            Este sistema é construído para ser auditável e responsável
          </p>
        </div>
      )}

      {/* ============================================
          2) AÇÃO IMEDIATA - será renderizado em HomePage.tsx
          (SearchBar e AppGrid)
          ============================================ */}

      {/* ============================================
          3) FEEDBACK DO SISTEMA
          ============================================ */}

      {/* Observações: Última transação */}
      {data.lastTransaction && (
        <div className="home-last-transaction">
          <div className="situation-last-action">
            <span className="situation-label">Última ação:</span>
            <span className="situation-value">
              {getContextLabel(data.lastTransaction.context)} - {formatDate(data.lastTransaction.createdAt)}
            </span>
          </div>
        </div>
      )}

      {/* Central de Pendências */}
      {activeActor && (
        <div className="home-pending-actions">
          <PendingActionsCenter maxItems={3} showEmptyState={false} />
        </div>
      )}

      {/* Resumo de Saúde */}
      {activeActor && (
        <div className="home-health-summary">
          <HealthSummaryCard maxSignals={3} showEmptyState={false} />
        </div>
      )}

      {/* ============================================
          4) DISTRIBUIÇÃO DE DINHEIRO / ALOCAÇÕES
          ============================================ */}
      <div className="home-cards-distribution">
        {/* Card: Como seu dinheiro é distribuído */}
        {activeActor && (activeActor.actor_type === 'user' || activeActor.actor_type === 'page') && (
          <div className="home-card">
            <MoneyDistribution context={data.lastTransaction?.context} />
          </div>
        )}

        {/* Card: Alocação para Grupos */}
        {activeActor && activeActor.actor_type === 'user' && (
          <div className="home-card">
            <GroupAllocationCard showEditLink={true} />
          </div>
        )}

        {/* Card: Fundo Regional */}
        {activeActor && activeActor.actor_type === 'user' && (
          <div className="home-card">
            <RegionalFundCard />
          </div>
        )}
      </div>

      {/* ============================================
          5) ESTRUTURA DO USUÁRIO
          ============================================ */}
      <div className="home-cards">
        {/* Card Empresas */}
        {activeActor?.actor_type === 'user' && (
          <div className="home-card">
            <div className="home-card-header">
              <h3>Empresas</h3>
            </div>
            <div className="home-card-content">
              {data.companiesCount === 0 ? (
                <div className="home-card-empty">
                  <p>Você ainda não tem empresas cadastradas</p>
                  <GuardedButton
                    actionType="create_company"
                    onClick={() => navigate('/empresas')}
                    className="home-card-cta"
                    showTooltip={false}
                  >
                    Criar empresa
                  </GuardedButton>
                </div>
              ) : (
                <div className="home-card-data">
                  <div className="home-card-count">{data.companiesCount}</div>
                  <div className="home-card-label">empresa{data.companiesCount !== 1 ? 's' : ''}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                    <button onClick={() => navigate('/empresas')} className="home-card-cta">
                      Ver todas
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card UnifyBank - Só mostra se actor puder hold assets */}
        {activeActor && (activeActor.actor_type === 'user' || activeActor.actor_type === 'page') && data.balanceCents !== null && (
          <div className="home-card">
            <div className="home-card-header">
              <h3>UnifyBank</h3>
            </div>
            <div className="home-card-content">
              <div className="home-card-data">
                <div className="home-card-balance">{formatCentsAsBRL(data.balanceCents)}</div>
                {data.lastTransaction && (
                  <div className="home-card-last-transaction">
                    Última: {getContextLabel(data.lastTransaction.context)}
                  </div>
                )}
                <button onClick={() => navigate('/banco')} className="home-card-cta">
                  Ver extrato
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card Grupos */}
        <div className="home-card">
          <div className="home-card-header">
            <h3>Grupos</h3>
          </div>
          <div className="home-card-content">
            {data.groupsCount === 0 ? (
              <div className="home-card-empty">
                <p>Você ainda não participa de grupos</p>
                <button onClick={() => navigate('/grupos')} className="home-card-cta">
                  Ver comunidades
                </button>
              </div>
            ) : (
              <div className="home-card-data">
                <div className="home-card-count">{data.groupsCount}</div>
                <div className="home-card-label">grupo{data.groupsCount !== 1 ? 's' : ''}</div>
                <button onClick={() => navigate('/grupos')} className="home-card-cta">
                  Ver comunidades
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card Eventos (quando API estiver disponível) */}
        {data.eventsCount > 0 && (
          <div className="home-card">
            <div className="home-card-header">
              <h3>Eventos</h3>
            </div>
            <div className="home-card-content">
              <div className="home-card-data">
                <div className="home-card-count">{data.eventsCount}</div>
                <div className="home-card-label">evento{data.eventsCount !== 1 ? 's' : ''} ativo{data.eventsCount !== 1 ? 's' : ''}</div>
                <button onClick={() => navigate('/eventos')} className="home-card-cta">
                  Gerenciar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================
          6) TRANSPARÊNCIA E GOVERNANÇA (UMA ÚNICA VEZ)
          ============================================ */}
      {activeActor && (
        <div className="home-trust-transparency">
          <TrustTransparencyCard showFullContent={true} />
          <HowItWorksSection />
          <SystemLimitsSection />
        </div>
      )}

      {/* ============================================
          7) CAMINHO SUGERIDO - FINAL
          ============================================ */}
      {activeActor && (
        <div className="home-workflow-assistant">
          <WorkflowAssistant maxSteps={3} />
        </div>
      )}
    </div>
  );
}









// frontend/src/components/company/tabs/CompanyOverviewTab.tsx
// CONTINUOUS PRODUCTION: Aba Visão Geral - SPRINT 2

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import { getBankBalance, getBankStatement } from '../../../api/bank';
import { listCompanyMembers } from '../../../api/companyMembers';
import { isAuthenticated, getTenantId } from '../../../config/auth';
import { centsToReais } from '../../../utils/money';
import type { Company } from '../../../api/companies';
import PendingActionsCenter from '../../pending-actions/PendingActionsCenter';
import HealthSummaryCard from '../../health/HealthSummaryCard';
import AccountabilitySection from '../AccountabilitySection';
import DisputePanel from '../../dispute/DisputePanel';
import { ContinuityText } from '../../../utils/closure-continuity';
import './CompanyTabs.css';

interface CompanyOverviewTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyOverviewTab({ company, companyId }: CompanyOverviewTabProps) {
  const { sessionReady, activeActor } = useSession();
  /** Saldo em centavos (canônico §4.7). */
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [lastActivities, setLastActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadOverviewData();
  }, [sessionReady, activeActor?.actor_id, companyId]);

  const loadOverviewData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Carregar dados em paralelo
      const [balanceResult, statementResult, membersResult] = await Promise.allSettled([
        getBankBalance().catch(() => null),
        getBankStatement({ limit: 3 }).catch(() => ({ entries: [], total: 0, hasMore: false })),
        listCompanyMembers(companyId).catch(() => []),
      ]);

      // Preferir `balanceCents` canônico (§4.7); cair para `balance` legado.
      const balanceValue = balanceResult.status === 'fulfilled' && balanceResult.value
        ? (balanceResult.value.balanceCents ?? balanceResult.value.balance ?? null)
        : null;
      const statement = statementResult.status === 'fulfilled' ? statementResult.value : null;
      const members = membersResult.status === 'fulfilled' ? membersResult.value : [];

      setBalanceCents(balanceValue);
      setMembersCount(members.length);
      setLastActivities(statement?.entries || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados da visão geral:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="company-tab-content">
        <div className="company-tab-loading">
          <div className="skeleton skeleton-item" />
          <div className="skeleton skeleton-item" />
          <div className="skeleton skeleton-item" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="company-tab-content">
        <div className="company-tab-error">
          <p>Erro: {error}</p>
          <button onClick={loadOverviewData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      {/* Pendências da Empresa */}
      <div className="overview-pending-actions">
        <PendingActionsCenter maxItems={3} showEmptyState={false} />
      </div>

      {/* Resumo de Saúde */}
      <div className="overview-health-summary">
        <HealthSummaryCard maxSignals={3} showEmptyState={false} />
      </div>

      {/* Responsabilidade & Autoridade */}
      <div className="overview-accountability">
        <AccountabilitySection companyId={companyId} maxItems={5} />
        {/* SPRINT 20: Continuidade declarada para delegações */}
        <ContinuityText type="delegation" />
      </div>

      {/* Solicitações de Revisão */}
      <div className="overview-disputes">
        <DisputePanel actorId={activeActor?.actor_id || ''} maxItems={5} />
      </div>

      <div className="overview-grid">
        {/* Informações Básicas */}
        <div className="overview-card">
          <h3>Informações</h3>
          <div className="overview-info">
            <div className="overview-info-item">
              <span className="overview-label">Nome:</span>
              <span className="overview-value">{company.companyName || company.tradeName || 'N/A'}</span>
            </div>
            {company.cnpj && (
              <div className="overview-info-item">
                <span className="overview-label">CNPJ:</span>
                <span className="overview-value">{company.cnpj}</span>
              </div>
            )}
            <div className="overview-info-item">
              <span className="overview-label">Colaboradores:</span>
              <span className="overview-value">{membersCount}</span>
            </div>
          </div>
        </div>

        {/* Saldo */}
        {balanceCents !== null && (
          <div className="overview-card">
            <h3>Saldo Atual</h3>
            <div className="overview-balance">
              <div className={`overview-balance-value ${balanceCents >= 0 ? 'positive' : 'negative'}`}>
                {formatCentsAsBRL(balanceCents)}
              </div>
            </div>
          </div>
        )}

        {/* Últimas Atividades */}
        <div className="overview-card overview-card-full">
          <h3>Últimas Atividades</h3>
          {lastActivities.length === 0 ? (
            <div className="overview-empty">
              <p>Nenhuma atividade recente</p>
            </div>
          ) : (
            <div className="overview-activities">
              {lastActivities.map((activity, index) => (
                <div key={index} className="overview-activity-item">
                  <div className="activity-content">
                    <span className="activity-label">
                      {getContextLabel(activity.context)}
                    </span>
                    <span className="activity-date">
                      {formatDate(activity.createdAt)}
                    </span>
                  </div>
                  <div className={`activity-amount ${activity.direction === 'in' ? 'in' : 'out'}`}>
                    {activity.direction === 'in' ? '+' : '-'}
                    {formatCentsAsBRL(Math.abs(activity.amountCents))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









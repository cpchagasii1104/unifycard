// frontend/src/components/company/tabs/CompanyOverviewTab.tsx
// CONTINUOUS PRODUCTION: Aba Visão Geral - SPRINT 2

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import { getBankBalance, getBankStatement } from '../../../api/bank';
import { listCompanyMembers } from '../../../api/companyMembers';
import {
  getCompanyKybStatus,
  submitCompanyKybRequest,
  listCompanyPublications,
  publishCompanyConcept,
  retireCompanyConcept,
  type CompanyKybStatus,
  type CompanyPublication,
} from '../../../api/companies';
import { showToast } from '../../common/Toast';
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
  // CP4 PJ-B5 (GO §3.4): reads financeiros usam o PAGE ACTOR da empresa (nunca o actor humano
  // da sessão como fallback silencioso) e erro NUNCA vira zero/vazio — null = "indisponível",
  // distinto de zero real/lista vazia real. Uma leitura falhando não derruba a aba inteira.
  /** Saldo em centavos (§4.7). undefined = indisponível (erro); null = ainda não carregado. */
  const [balanceCents, setBalanceCents] = useState<number | null | undefined>(null);
  /** null = indisponível (erro); número = contagem real. */
  const [membersCount, setMembersCount] = useState<number | null>(0);
  /** null = extrato indisponível (erro); [] = vazio REAL. */
  const [lastActivities, setLastActivities] = useState<any[] | null>([]);
  /** CP4 (GO 10.3): status MATERIAL do KYB. null = indisponível (erro de leitura). */
  const [kyb, setKyb] = useState<CompanyKybStatus | null | undefined>(undefined);
  const [kybSubmitting, setKybSubmitting] = useState(false);
  /** CP5: estado MATERIAL de publicação. null = indisponível (erro de leitura). */
  const [publications, setPublications] = useState<CompanyPublication[] | null | undefined>(undefined);
  const [pubActing, setPubActing] = useState(false);
  const [loading, setLoading] = useState(true);

  // O dashboard PJ exige contexto de page actor; sem ele, os reads empresariais são
  // "indisponíveis" — jamais respondidos com o saldo do usuário humano.
  const pageActorId = activeActor?.actor_type === 'page' ? activeActor.actor_id : null;

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadOverviewData();
  }, [sessionReady, activeActor?.actor_id, companyId]);

  const loadOverviewData = async () => {
    setLoading(true);

    const [balanceResult, statementResult, membersResult, kybResult, pubResult] = await Promise.allSettled([
      pageActorId
        ? getBankBalance({ actorId: pageActorId })
        : Promise.reject(new Error('Sem contexto de page actor da empresa')),
      pageActorId
        ? getBankStatement({ limit: 3, actorId: pageActorId, strictAuthErrors: true })
        : Promise.reject(new Error('Sem contexto de page actor da empresa')),
      listCompanyMembers(companyId),
      getCompanyKybStatus(companyId),
      listCompanyPublications(companyId),
    ]);

    // Saldo: sucesso → centavos (zero real é zero real); falha → undefined (indisponível).
    if (balanceResult.status === 'fulfilled' && balanceResult.value) {
      setBalanceCents(balanceResult.value.balanceCents ?? balanceResult.value.balance ?? 0);
    } else {
      setBalanceCents(undefined);
    }
    // Extrato: falha → null (indisponível, NÃO "nenhuma atividade").
    setLastActivities(statementResult.status === 'fulfilled' ? (statementResult.value?.entries ?? []) : null);
    // Membros: falha → null (indisponível, NÃO "0 colaboradores").
    setMembersCount(membersResult.status === 'fulfilled' ? membersResult.value.length : null);
    // KYB: falha → null (indisponível); sucesso → estado material da fonte fiscal.
    setKyb(kybResult.status === 'fulfilled' ? kybResult.value : null);
    // Publicações: falha → null (indisponível, nunca "não publicada" falsa).
    setPublications(pubResult.status === 'fulfilled' ? pubResult.value : null);

    setLoading(false);
  };

  // CP5: publicar/retirar o concept primário — o backend prova autoridade + KYB + par;
  // bloqueio de KYB (409 KYB_NOT_APPROVED) aparece como razão honesta, não como sucesso.
  const activePublication = Array.isArray(publications)
    ? publications.find((p) => p.status === 'active')
    : undefined;
  const handlePublishToggle = async (): Promise<void> => {
    setPubActing(true);
    try {
      if (activePublication) {
        await retireCompanyConcept(companyId, activePublication.conceptId);
        showToast('Publicação retirada.', 'success');
      } else {
        if (!company.primaryConceptId) {
          showToast('Empresa ainda não ativada operacionalmente (sem atividade principal).', 'error');
          return;
        }
        await publishCompanyConcept(companyId, company.primaryConceptId);
        showToast('Empresa publicada para descoberta.', 'success');
      }
      const refreshed = await listCompanyPublications(companyId).catch(() => null);
      setPublications(refreshed);
    } catch (err: any) {
      const msg = err?.code === 'KYB_NOT_APPROVED'
        ? 'Publicação bloqueada: a verificação (KYB) da empresa ainda não foi aprovada.'
        : err instanceof Error ? err.message : 'Falha na operação de publicação.';
      showToast(msg, 'error');
    } finally {
      setPubActing(false);
    }
  };

  // CP4/CP2 (GO 10.3): "Enviar para análise" do dashboard — o backend prova autoridade,
  // documentos mínimos e 1 pending por fiscal; aqui só dispara e reflete o estado material.
  const handleKybSubmit = async (): Promise<void> => {
    setKybSubmitting(true);
    try {
      await submitCompanyKybRequest(companyId);
      showToast('Empresa enviada para análise (KYB).', 'success');
      const refreshed = await getCompanyKybStatus(companyId).catch(() => null);
      setKyb(refreshed);
    } catch (err: any) {
      showToast(err instanceof Error ? err.message : 'Falha ao enviar para análise.', 'error');
    } finally {
      setKybSubmitting(false);
    }
  };

  const KYB_STATUS_LABEL: Record<string, string> = {
    pending: 'Pendente de análise',
    approved: 'Verificada',
    rejected: 'Rejeitada',
    suspended: 'Suspensa',
    closed: 'Encerrada',
  };
  const hasPendingKybRequest = !!kyb && kyb.requests.some((r) => r.status === 'pending');
  const lastKybDecision = kyb?.requests.find((r) => r.status !== 'pending');
  const canSubmitKyb = !!kyb && !hasPendingKybRequest && (kyb.kybStatus === 'pending' || kyb.kybStatus === 'rejected');

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
              {/* CP4: null = leitura falhou → "—" (nunca "0" falso) */}
              <span className="overview-value">{membersCount === null ? '—' : membersCount}</span>
            </div>
          </div>
        </div>

        {/* Verificação (KYB) — CP4 GO 10.3: status MATERIAL da fonte fiscal + ação de submit +
            reason da última decisão. null = leitura indisponível (erro), nunca status inventado. */}
        <div className="overview-card">
          <h3>Verificação (KYB)</h3>
          {kyb === undefined ? (
            <p>…</p>
          ) : kyb === null ? (
            <p title="Leitura do status KYB indisponível">— indisponível</p>
          ) : (
            <div className="overview-info">
              <div className="overview-info-item">
                <span className="overview-label">Status:</span>
                <span className="overview-value">{KYB_STATUS_LABEL[kyb.kybStatus] ?? kyb.kybStatus}</span>
              </div>
              {hasPendingKybRequest && (
                <div className="overview-info-item">
                  <span className="overview-value">📨 Em análise — aguardando o reviewer</span>
                </div>
              )}
              {lastKybDecision?.decisionReason && kyb.kybStatus !== 'approved' && (
                <div className="overview-info-item">
                  <span className="overview-label">Última decisão:</span>
                  <span className="overview-value">{lastKybDecision.decisionReason}</span>
                </div>
              )}
              {canSubmitKyb && (
                <button className="btn-primary" onClick={handleKybSubmit} disabled={kybSubmitting}>
                  {kybSubmitting ? '⏳ Enviando…' : 'Enviar para análise'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Publicação (CP5 — DECISION-0099/0100): estado MATERIAL; nunca afirma "público"
            antes da publicação real; bloqueio de KYB aparece como razão honesta. */}
        <div className="overview-card">
          <h3>Publicação</h3>
          {publications === undefined ? (
            <p>…</p>
          ) : publications === null ? (
            <p title="Leitura do estado de publicação indisponível">— indisponível</p>
          ) : (
            <div className="overview-info">
              <div className="overview-info-item">
                <span className="overview-label">Status:</span>
                <span className="overview-value">
                  {activePublication ? '🟢 Publicada (descobrível)' : 'Não publicada'}
                </span>
              </div>
              <button className="btn-primary" onClick={handlePublishToggle} disabled={pubActing}>
                {pubActing ? '⏳ …' : activePublication ? 'Retirar publicação' : 'Publicar empresa'}
              </button>
            </div>
          )}
        </div>

        {/* Saldo DA EMPRESA (page actor) — CP4: erro ≠ zero. undefined = indisponível honesto. */}
        <div className="overview-card">
          <h3>Saldo Atual</h3>
          <div className="overview-balance">
            {balanceCents === undefined ? (
              <div className="overview-balance-value" title="Leitura financeira indisponível — não é saldo zero">
                — <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>indisponível</span>
              </div>
            ) : balanceCents === null ? (
              <div className="overview-balance-value">…</div>
            ) : (
              <div className={`overview-balance-value ${balanceCents >= 0 ? 'positive' : 'negative'}`}>
                {formatCentsAsBRL(balanceCents)}
              </div>
            )}
          </div>
        </div>

        {/* Últimas Atividades — CP4: null = extrato indisponível (erro), [] = vazio REAL. */}
        <div className="overview-card overview-card-full">
          <h3>Últimas Atividades</h3>
          {lastActivities === null ? (
            <div className="overview-empty">
              <p>Extrato indisponível no momento — não foi possível ler as movimentações.</p>
              <button onClick={loadOverviewData}>Tentar novamente</button>
            </div>
          ) : lastActivities.length === 0 ? (
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









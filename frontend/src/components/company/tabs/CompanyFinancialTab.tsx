// frontend/src/components/company/tabs/CompanyFinancialTab.tsx
// CONTINUOUS PRODUCTION: Aba Financeiro - SPRINT 2

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import { getBankBalance, getBankStatement, type BankStatementEntry } from '../../../api/bank';
import { isAuthenticated, getTenantId } from '../../../config/auth';
import { centsToReais } from '../../../utils/money';
import type { Company } from '../../../api/companies';
import TransactionSplitDetail from '../../governance/TransactionSplitDetail';
import './CompanyTabs.css';

interface CompanyFinancialTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyFinancialTab({ company, companyId }: CompanyFinancialTabProps) {
  const { sessionReady, activeActor } = useSession();
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  // CP4 PJ-B5 (GO §3.4): reads financeiros da PJ usam o PAGE ACTOR da empresa e erro NUNCA
  // vira zero/vazio. undefined = saldo indisponível (erro); null = carregando; número = real.
  const [balanceCents, setBalanceCents] = useState<number | null | undefined>(null);
  /** null = extrato indisponível (erro); [] = vazio REAL. */
  const [entries, setEntries] = useState<BankStatementEntry[] | null>([]);
  const [loading, setLoading] = useState(true);

  const pageActorId = activeActor?.actor_type === 'page' ? activeActor.actor_id : null;

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadFinancialData();
  }, [sessionReady, activeActor?.actor_id, companyId]);

  const loadFinancialData = async () => {
    setLoading(true);

    const [balanceResult, statementResult] = await Promise.allSettled([
      pageActorId
        ? getBankBalance({ actorId: pageActorId })
        : Promise.reject(new Error('Sem contexto de page actor da empresa')),
      pageActorId
        ? getBankStatement({ limit: 10, actorId: pageActorId, strictAuthErrors: true })
        : Promise.reject(new Error('Sem contexto de page actor da empresa')),
    ]);

    if (balanceResult.status === 'fulfilled' && balanceResult.value) {
      setBalanceCents(balanceResult.value.balanceCents ?? balanceResult.value.balance ?? 0);
    } else {
      setBalanceCents(undefined);
    }
    setEntries(statementResult.status === 'fulfilled' ? (statementResult.value?.entries ?? []) : null);

    setLoading(false);
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
        </div>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      <div className="financial-header">
        <h3>Financeiro</h3>
        <div className="financial-balance">
          <span className="financial-balance-label">Saldo Atual:</span>
          {/* CP4: undefined = leitura falhou → "— indisponível" (NUNCA zero falso). */}
          {balanceCents === undefined ? (
            <span className="financial-balance-value" title="Leitura financeira indisponível — não é saldo zero">
              — indisponível
            </span>
          ) : balanceCents === null ? (
            <span className="financial-balance-value">…</span>
          ) : (
            <span className={`financial-balance-value ${balanceCents >= 0 ? 'positive' : 'negative'}`}>
              {formatCentsAsBRL(balanceCents)}
            </span>
          )}
        </div>
      </div>

      {/* Extrato — CP4: null = indisponível (erro observável), [] = vazio REAL. */}
      <div className="financial-statement">
        <h4>Extrato (Últimas 10 transações)</h4>
        {entries === null ? (
          <div className="financial-empty">
            <p>Extrato indisponível no momento — não foi possível ler as movimentações.</p>
            <button onClick={loadFinancialData}>Tentar novamente</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="financial-empty">
            <p>Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="financial-entries">
            {entries.map((entry) => (
              <div 
                key={entry.transactionId} 
                className={`financial-entry ${entry.direction} ${selectedTransactionId === entry.transactionId ? 'selected' : ''}`}
                onClick={() => setSelectedTransactionId(selectedTransactionId === entry.transactionId ? null : entry.transactionId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="entry-main">
                  <div className="entry-info">
                    <div className="entry-context">{getContextLabel(entry.context)}</div>
                    <div className="entry-date">{formatDate(entry.createdAt)}</div>
                    {entry.status && (
                      <div className={`entry-status status-${entry.status}`}>
                        {entry.status === 'completed' ? 'Concluída' : entry.status === 'reversed' ? 'Revertida' : entry.status}
                      </div>
                    )}
                  </div>
                  <div className={`entry-amount ${entry.direction}`}>
                    {entry.direction === 'in' ? '+' : '-'}
                    {formatCentsAsBRL(Math.abs(entry.amountCents))}
                  </div>
                </div>
                {entry.referenceId && (
                  <div className="entry-reference">
                    Referência: {entry.referenceType || 'N/A'} - {entry.referenceId.substring(0, 8)}...
                  </div>
                )}
                {selectedTransactionId === entry.transactionId && (
                  <div className="entry-split-detail">
                    <TransactionSplitDetail transactionId={entry.transactionId} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}








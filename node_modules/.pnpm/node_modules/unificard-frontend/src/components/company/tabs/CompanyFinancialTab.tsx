// frontend/src/components/company/tabs/CompanyFinancialTab.tsx
// CONTINUOUS PRODUCTION: Aba Financeiro - SPRINT 2

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import { getBankBalance, getBankStatement, type BankStatementEntry } from '../../../api/bank';
import { isAuthenticated, getTenantId } from '../../../config/auth';
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
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<BankStatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadFinancialData();
  }, [sessionReady, activeActor?.actor_id, companyId]);

  const loadFinancialData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [balanceResult, statementResult] = await Promise.allSettled([
        getBankBalance().catch(() => null),
        getBankStatement({ limit: 10 }).catch(() => ({ entries: [], total: 0, hasMore: false })),
      ]);

      const balanceValue = balanceResult.status === 'fulfilled' && balanceResult.value
        ? balanceResult.value.balance
        : null;
      const statement = statementResult.status === 'fulfilled' ? statementResult.value : null;

      setBalance(balanceValue);
      setEntries(statement?.entries || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados financeiros:', err);
      setError(err.message || 'Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  if (error) {
    return (
      <div className="company-tab-content">
        <div className="company-tab-error">
          <p>Erro: {error}</p>
          <button onClick={loadFinancialData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      <div className="financial-header">
        <h3>Financeiro</h3>
        {balance !== null && (
          <div className="financial-balance">
            <span className="financial-balance-label">Saldo Atual:</span>
            <span className={`financial-balance-value ${balance >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(balance)}
            </span>
          </div>
        )}
      </div>

      {/* Extrato */}
      <div className="financial-statement">
        <h4>Extrato (Últimas 10 transações)</h4>
        {entries.length === 0 ? (
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
                    {formatCurrency(Math.abs(entry.amount))}
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








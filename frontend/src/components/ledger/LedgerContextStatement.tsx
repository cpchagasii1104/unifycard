// frontend/src/components/ledger/LedgerContextStatement.tsx
// Extrato do Ledger por Contexto (ServiceOrder / Event)
// 🔴 BLINDAGEM: Apenas exibe, não calcula

import { useState, useEffect } from 'react';
import { getContextStatement, type ContextStatement, type LedgerEntry } from '../../api/ledger';
import './LedgerContextStatement.css';

interface LedgerContextStatementProps {
  contextType: 'service_order' | 'event' | 'agreement' | 'escrow';
  contextId: string;
}

export default function LedgerContextStatement({
  contextType,
  contextId,
}: LedgerContextStatementProps) {
  const [statement, setStatement] = useState<ContextStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatement();
  }, [contextType, contextId]);

  const loadStatement = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getContextStatement(contextType, contextId);
      setStatement(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar extrato');
      console.error('Erro ao carregar extrato:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEntryTypeLabel = (entryType: string) => {
    const labels: Record<string, string> = {
      ESCROW_HOLD: 'Retenção em Escrow',
      ESCROW_RELEASE: 'Liberação de Escrow',
      ESCROW_REFUND: 'Reembolso de Escrow',
      SPLIT_CREATED: 'Split Criado',
      COMMISSION_FEE: 'Taxa de Comissão',
      PAYOUT_REQUESTED: 'Payout Solicitado',
      PAYOUT_EXECUTED: 'Payout Executado',
    };
    return labels[entryType] || entryType;
  };

  if (isLoading) {
    return (
      <div className="ledger-context-statement">
        <div className="ledger-loading">Carregando extrato...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ledger-context-statement">
        <div className="ledger-error">{error}</div>
      </div>
    );
  }

  if (!statement || statement.entries.length === 0) {
    return (
      <div className="ledger-context-statement">
        <div className="ledger-empty">Nenhuma movimentação registrada.</div>
      </div>
    );
  }

  return (
    <div className="ledger-context-statement">
      <div className="ledger-header">
        <h3>Extrato Contábil</h3>
        <div className="ledger-summary">
          <div className="summary-item">
            <strong>Total Débitos:</strong> {formatPrice(statement.totalDebitsCents, statement.currency)}
          </div>
          <div className="summary-item">
            <strong>Total Créditos:</strong> {formatPrice(statement.totalCreditsCents, statement.currency)}
          </div>
          <div className="summary-item summary-net">
            <strong>Saldo Líquido:</strong> {formatPrice(statement.netAmountCents, statement.currency)}
          </div>
        </div>
      </div>

      <div className="ledger-entries">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Tipo</th>
              <th>Débito</th>
              <th>Crédito</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {statement.entries.map((entry) => (
              <tr key={entry.entryId} className={`ledger-entry ledger-entry-${entry.entryType.toLowerCase().replace('_', '-')}`}>
                <td>{formatDate(entry.timestamp)}</td>
                <td>{getEntryTypeLabel(entry.entryType)}</td>
                <td className="account-cell">{entry.debitAccountId}</td>
                <td className="account-cell">{entry.creditAccountId}</td>
                <td className="amount-cell">{formatPrice(entry.amountCents, entry.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}





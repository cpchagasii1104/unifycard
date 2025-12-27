// frontend/src/components/Wallet.tsx
// Extrato Financeiro - FASE 7

import { useState, useEffect } from 'react';
import { getUserStatement, type StatementEntry } from '../api/transparency';
import './Wallet.css';

interface WalletProps {
  onTransactionClick?: (transactionId: string) => void;
}

export default function Wallet({ onTransactionClick }: WalletProps) {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadStatement = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const result = await getUserStatement({
        limit: 50,
        offset: reset ? 0 : offset,
      });

      if (reset) {
        setEntries(result.entries);
      } else {
        setEntries((prev) => [...prev, ...result.entries]);
      }

      setHasMore(result.hasMore);
      setOffset((prev) => prev + result.entries.length);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar extrato');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadStatement(true);
  }, []);

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

  const getTypeLabel = (type: StatementEntry['type']) => {
    const labels: Record<StatementEntry['type'], string> = {
      p2p: 'Transferência P2P',
      donation: 'Doação',
      split: 'Divisão',
      compensation: 'Compensação',
      governance: 'Governança',
      other: 'Outro',
    };
    return labels[type] || 'Desconhecido';
  };

  if (loading) {
    return (
      <div className="wallet-container">
        <div className="wallet-loading">Carregando extrato...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-container">
        <div className="wallet-error">
          <p>Erro ao carregar extrato</p>
          <p className="error-details">{error}</p>
          <button onClick={() => loadStatement(true)}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <div className="wallet-header">
        <h2>Extrato Financeiro</h2>
        <button onClick={() => loadStatement(true)} className="refresh-button">
          Atualizar
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="wallet-empty">
          <p>Nenhuma transação encontrada</p>
        </div>
      ) : (
        <>
          <div className="wallet-list">
            {entries.map((entry) => (
              <div
                key={entry.transactionId}
                className={`wallet-entry ${entry.direction}`}
                onClick={() => onTransactionClick?.(entry.transactionId)}
              >
                <div className="entry-main">
                  <div className="entry-left">
                    <div className="entry-type">{getTypeLabel(entry.type)}</div>
                    <div className="entry-date">{formatDate(entry.createdAt)}</div>
                  </div>
                  <div className="entry-right">
                    <div className={`entry-amount ${entry.direction}`}>
                      {entry.direction === 'in' ? '+' : '-'}
                      {formatCurrency(Math.abs(entry.amount))}
                    </div>
                    <div className="entry-balance">
                      Saldo: {formatCurrency(entry.balanceAfter)}
                    </div>
                  </div>
                </div>
                {entry.metadata.message && (
                  <div className="entry-message">{entry.metadata.message}</div>
                )}
                {onTransactionClick && (
                  <div className="entry-action">Ver detalhes →</div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="wallet-load-more">
              <button
                onClick={() => loadStatement(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

















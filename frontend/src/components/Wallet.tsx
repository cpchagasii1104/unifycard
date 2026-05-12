// frontend/src/components/Wallet.tsx
// CONTINUOUS PRODUCTION: Wallet + Transaction Statement UI
import { InstitutionalPulse } from '../utils/institutional-pulse';
// Conectado ao Unify Bank (GET /bank/balance e GET /bank/statement).
// Conformidade §4.7: backend retorna `balanceCents`/`amountCents` (canônico);
// frontend converte para reais via `centsToReais` apenas na camada de exibição.

import { useState, useEffect } from 'react';
import { getBankBalance, getBankStatement, type BankStatementEntry } from '../api/bank';
import { useSession } from '../contexts/SessionProvider';
import { isAuthenticated, getTenantId } from '../config/auth';
import { centsToReais } from '../utils/money';
import './Wallet.css';

interface WalletProps {
  onTransactionClick?: (transactionId: string) => void;
}

export default function Wallet({ onTransactionClick }: WalletProps) {
  const { sessionReady, activeActor } = useSession();
  /** Saldo em centavos (canônico §4.7). Convertido para reais apenas na exibição. */
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [entries, setEntries] = useState<BankStatementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadWallet = async (reset = false) => {
    // Guard: só fazer chamadas quando sessão estiver pronta
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      // Carregar saldo e extrato em paralelo
      const [balanceResult, statementResult] = await Promise.all([
        getBankBalance(),
        getBankStatement({
          limit: 50,
          offset: reset ? 0 : offset,
        }),
      ]);

      // Preferir `balanceCents` canônico (§4.7); cair para `balance` legado se backend não enviar.
      setBalanceCents(balanceResult.balanceCents ?? balanceResult.balance ?? 0);

      if (reset) {
        setEntries(statementResult.entries);
      } else {
        setEntries((prev) => [...prev, ...statementResult.entries]);
      }

      setHasMore(statementResult.hasMore);
      setOffset((prev) => prev + statementResult.entries.length);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar carteira');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadWallet(true);
  }, [sessionReady, activeActor]);

  /**
   * Formata valor em CENTAVOS para string monetária BRL.
   * Aplica `centsToReais` antes de `Intl.NumberFormat` para evitar bug de
   * unidade (saldo 100x maior).
   */
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
      event_ticket: 'Evento',
      service_booking: 'Serviço',
      ride_payment: 'Corrida',
      donation: 'Doação',
      p2p_transfer: 'Transferência P2P',
      group_contribution: 'Grupo',
      deposit: 'Depósito',
      withdrawal: 'Saque',
    };
    return context ? (labels[context] || context) : 'Transação';
  };

  const getStatusLabel = (status?: string): string => {
    if (status === 'reversed') return 'Revertida';
    if (status === 'completed') return 'Concluída';
    if (status === 'pending') return 'Pendente';
    if (status === 'failed') return 'Falhou';
    return 'Concluída';
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
          <button onClick={() => loadWallet(true)}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <div className="wallet-header">
        <h2>Carteira</h2>
        <button onClick={() => loadWallet(true)} className="refresh-button">
          Atualizar
        </button>
      </div>

      {/* Saldo Atual */}
      <div className="wallet-balance-section">
        <div className="wallet-balance-label">Saldo Atual (MFI)</div>
        <div className={`wallet-balance-value ${balanceCents !== null && balanceCents >= 0 ? 'positive' : ''}`}>
          {balanceCents !== null ? (
            <>
              {balanceCents >= 0 ? '+' : ''}
              {formatCentsAsBRL(balanceCents)}
            </>
          ) : (
            'Carregando...'
          )}
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="wallet-transactions-section">
        <h3>Extrato</h3>
        {entries.length === 0 ? (
          <div className="wallet-empty">
            <p>Nenhuma transação encontrada</p>
            {/* SPRINT 22: Pulso institucional em estado vazio */}
            <InstitutionalPulse type="continuous" />
          </div>
        ) : (
          <>
            <div className="wallet-list">
              {entries.map((entry) => (
                <div
                  key={entry.transactionId}
                  className={`wallet-entry ${entry.direction} ${entry.status === 'reversed' ? 'reversed' : ''}`}
                  onClick={() => onTransactionClick?.(entry.transactionId)}
                >
                  <div className="entry-main">
                    <div className="entry-left">
                      <div className="entry-context">
                        {getContextLabel(entry.context)}
                        {entry.status === 'reversed' && (
                          <span className="entry-status-badge reversed">Revertida</span>
                        )}
                        {entry.status === 'completed' && (
                          <span className="entry-status-badge completed">Concluída</span>
                        )}
                      </div>
                      <div className="entry-date">{formatDate(entry.createdAt)}</div>
                      {entry.referenceType && entry.referenceId && (
                        <div className="entry-reference">
                          {entry.referenceType}: {entry.referenceId.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                    <div className="entry-right">
                      <div className={`entry-amount ${entry.direction}`}>
                        {entry.direction === 'in' ? '+' : '-'}
                        {formatCentsAsBRL(Math.abs(entry.amountCents))}
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
                  onClick={() => loadWallet(false)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
























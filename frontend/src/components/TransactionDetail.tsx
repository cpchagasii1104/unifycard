// frontend/src/components/TransactionDetail.tsx
// Detalhe de Transação com Splits - FASE 7

import { useState, useEffect } from 'react';
import { getTransactionSplits, type SplitDetail } from '../api/transparency';
import './TransactionDetail.css';

interface TransactionDetailProps {
  transactionId: string;
  onClose?: () => void;
}

export default function TransactionDetail({ transactionId, onClose }: TransactionDetailProps) {
  const [detail, setDetail] = useState<SplitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        const result = await getTransactionSplits(transactionId);
        setDetail(result);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar detalhes');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [transactionId]);

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

  const getTargetTypeLabel = (targetType: string) => {
    const labels: Record<string, string> = {
      user: 'Usuário',
      group: 'Grupo',
      project: 'Projeto',
      regional_fund: 'Fundo Regional',
      platform: 'Plataforma',
    };
    return labels[targetType] || targetType;
  };

  if (loading) {
    return (
      <div className="transaction-detail-container">
        <div className="transaction-detail-loading">Carregando detalhes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transaction-detail-container">
        <div className="transaction-detail-error">
          <p>Erro ao carregar detalhes</p>
          <p className="error-details">{error}</p>
          {onClose && <button onClick={onClose}>Fechar</button>}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="transaction-detail-container">
        <div className="transaction-detail-not-found">
          <p>Transação não encontrada</p>
          {onClose && <button onClick={onClose}>Fechar</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-detail-container">
      <div className="transaction-detail-header">
        <h2>Detalhe da Transação</h2>
        {onClose && (
          <button onClick={onClose} className="close-button">
            ×
          </button>
        )}
      </div>

      <div className="transaction-detail-base">
        <h3>Transação Base</h3>
        <div className="base-info">
          <div className="info-row">
            <span className="info-label">ID:</span>
            <span className="info-value">{detail.baseTransaction.transactionId}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tipo:</span>
            <span className="info-value">{detail.baseTransaction.type}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Valor:</span>
            <span className="info-value amount">
              {formatCurrency(detail.baseTransaction.amount)}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Data:</span>
            <span className="info-value">{formatDate(detail.baseTransaction.createdAt)}</span>
          </div>
        </div>
      </div>

      {detail.splits.length === 0 ? (
        <div className="transaction-detail-no-splits">
          <p>Esta transação não possui divisões (splits)</p>
        </div>
      ) : (
        <div className="transaction-detail-splits">
          <h3>Divisões (Splits)</h3>
          <div className="splits-summary">
            <div className="summary-item">
              <span className="summary-label">Total dividido:</span>
              <span className="summary-value">
                {formatCurrency(detail.totalAmount)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Percentual total:</span>
              <span className={`summary-value ${Math.abs(detail.totalPercentage - 1.0) < 0.01 ? 'valid' : 'invalid'}`}>
                {(detail.totalPercentage * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="splits-list">
            {detail.splits.map((split, index) => (
              <div key={split.transactionId} className="split-item">
                <div className="split-header">
                  <span className="split-number">#{index + 1}</span>
                  <span className="split-target">{getTargetTypeLabel(split.targetType)}</span>
                  {split.targetId && (
                    <span className="split-target-id">({split.targetId.substring(0, 8)}...)</span>
                  )}
                </div>
                <div className="split-details">
                  <div className="split-detail-row">
                    <span className="split-label">Percentual:</span>
                    <span className="split-value">{(split.percentage * 100).toFixed(2)}%</span>
                  </div>
                  <div className="split-detail-row">
                    <span className="split-label">Valor:</span>
                    <span className="split-value amount">{formatCurrency(split.amount)}</span>
                  </div>
                  <div className="split-detail-row">
                    <span className="split-label">Data:</span>
                    <span className="split-value">{formatDate(split.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
















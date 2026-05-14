// frontend/src/components/governance/TransactionSplitDetail.tsx
// CONTINUOUS PRODUCTION: Detalhe Visual de Split - SPRINT 4
// Mostra splits de uma transação de forma clara e auditável

import { useState, useEffect } from 'react';
import { getTransactionSplits, type SplitDetail } from '../../api/transparency';
import { CoherenceSignal } from '../../utils/functioning-evidence';
import { centsToReais } from '../../utils/money';
import './TransactionSplitDetail.css';

interface TransactionSplitDetailProps {
  transactionId: string;
}

export default function TransactionSplitDetail({ transactionId }: TransactionSplitDetailProps) {
  const [splitDetail, setSplitDetail] = useState<SplitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSplitDetail();
  }, [transactionId]);

  const loadSplitDetail = async () => {
    setLoading(true);
    setError(null);

    try {
      const detail = await getTransactionSplits(transactionId);
      setSplitDetail(detail);
    } catch (err: any) {
      console.error('Erro ao carregar detalhes de split:', err);
      setError(err.message || 'Erro ao carregar detalhes');
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

  const getTargetLabel = (targetType: string, targetId?: string): string => {
    const labels: Record<string, string> = {
      user: 'Usuário',
      group: 'Grupo',
      project: 'Projeto',
      regional_fund: 'Fundo Regional',
      reserve: 'Reserva',
      platform: 'Taxa do Sistema',
    };

    const baseLabel = labels[targetType] || targetType;
    if (
      targetId &&
      targetType !== 'platform' &&
      targetType !== 'regional_fund' &&
      targetType !== 'reserve'
    ) {
      return `${baseLabel} (${targetId.substring(0, 8)}...)`;
    }
    return baseLabel;
  };

  const getTargetDescription = (targetType: string): string => {
    const descriptions: Record<string, string> = {
      user: 'Prestador, motorista ou destinatário',
      group: 'Grupo comunitário configurado',
      project: 'Projeto específico',
      regional_fund: 'Circula valor de volta para a sua região',
      reserve: 'Garante coberturas e estabilidade econômica futura',
      platform: 'Cobrança operacional do sistema',
    };
    return descriptions[targetType] || 'Destino do split';
  };

  if (loading) {
    return (
      <div className="transaction-split-detail">
        <div className="split-loading">
          <div className="skeleton skeleton-header" />
          <div className="skeleton skeleton-item" />
          <div className="skeleton skeleton-item" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transaction-split-detail">
        <div className="split-error">
          <p>Erro ao carregar detalhes: {error}</p>
          <button onClick={loadSplitDetail}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!splitDetail) {
    return (
      <div className="transaction-split-detail">
        <div className="split-empty">
          <p>Esta transação não possui splits registrados.</p>
        </div>
      </div>
    );
  }

  const baseAmountCents = splitDetail.baseTransaction.amountCents;
  const totalSplitCents = splitDetail.totalAmountCents;
  const totalPercentage = splitDetail.totalPercentage * 100;

  return (
    <div className="transaction-split-detail">
      <div className="split-header">
        <h3>Distribuição desta Transação</h3>
        <div className="split-summary">
          <div className="split-summary-item">
            <span className="split-summary-label">Valor Bruto:</span>
            <span className="split-summary-value">{formatCurrency(centsToReais(baseAmountCents))}</span>
          </div>
          <div className="split-summary-item">
            <span className="split-summary-label">Total Distribuído:</span>
            <span className="split-summary-value">{formatCurrency(centsToReais(totalSplitCents))}</span>
          </div>
          <div className="split-summary-item">
            <span className="split-summary-label">Total %:</span>
            <span className="split-summary-value">{totalPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="split-list">
        {splitDetail.splits.map((split, index) => {
          const percentage = split.percentage * 100;
          const percentageOfBase = baseAmountCents > 0 ? (split.amountCents / baseAmountCents) * 100 : 0;
          
          return (
            <div key={index} className="split-item">
              <div className="split-target">
                <div className="split-target-name">{getTargetLabel(split.targetType, split.targetId)}</div>
                <div className="split-target-desc">{getTargetDescription(split.targetType)}</div>
              </div>
              <div className="split-values">
                <div className="split-amount">{formatCurrency(centsToReais(split.amountCents))}</div>
                <div className="split-percentage">{percentage.toFixed(1)}%</div>
              </div>
              <div className="split-bar">
                <div 
                  className="split-bar-fill"
                  style={{ width: `${percentageOfBase}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {splitDetail.baseTransaction.metadata && Object.keys(splitDetail.baseTransaction.metadata).length > 0 && (
        <div className="split-metadata">
          <h4>Informações Adicionais</h4>
          <div className="split-metadata-content">
            <div className="metadata-item">
              <span className="metadata-label">Data:</span>
              <span className="metadata-value">{formatDate(splitDetail.baseTransaction.createdAt)}</span>
            </div>
            {splitDetail.baseTransaction.metadata.context && (
              <div className="metadata-item">
                <span className="metadata-label">Contexto:</span>
                <span className="metadata-value">{splitDetail.baseTransaction.metadata.context}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPRINT 21: Evidência de funcionamento - sinal de coerência */}
      {splitDetail && (
        <div style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e0e0e0',
        }}>
          <CoherenceSignal type="consistent" />
        </div>
      )}
    </div>
  );
}



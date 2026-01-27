// frontend/src/components/marketplace/RefundItemVisual.tsx
// UX CANÔNICA: Visualização de estorno por item (apenas UX, não executa estorno)
// 🔴 BLINDAGEM: Apenas exibição, sem lógica financeira, sem execução de estorno

import './RefundItemVisual.css';

export type RefundStatus = 'solicitado' | 'processando' | 'concluído' | 'recusado';

interface RefundItemVisualProps {
  itemId: string;
  itemName?: string;
  storeId: string;
  storeName: string;
  amount: number; // Em centavos
  status: RefundStatus;
  requestedAt?: string;
  completedAt?: string;
  reason?: string;
}

export default function RefundItemVisual({
  itemId,
  itemName,
  storeId,
  storeName,
  amount,
  status,
  requestedAt,
  completedAt,
  reason,
}: RefundItemVisualProps) {
  const formatPrice = (cents: number): string => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusLabel = (): string => {
    switch (status) {
      case 'solicitado':
        return 'Estorno solicitado';
      case 'processando':
        return 'Estorno em análise';
      case 'concluído':
        return 'Estorno processado';
      case 'recusado':
        return 'Estorno recusado';
      default:
        return 'Status desconhecido';
    }
  };

  const getStatusClass = (): string => {
    switch (status) {
      case 'solicitado':
        return 'status-requested';
      case 'processando':
        return 'status-processing';
      case 'concluído':
        return 'status-completed';
      case 'recusado':
        return 'status-refused';
      default:
        return '';
    }
  };

  return (
    <div className={`refund-item-visual ${getStatusClass()}`}>
      <div className="refund-header">
        <div className="refund-item-info">
          <span className="item-name">{itemName || `Item ${itemId}`}</span>
          <span className="store-name">Vendedor: {storeName}</span>
        </div>
        <div className="refund-amount">
          <span className="amount-label">Valor:</span>
          <span className="amount-value">{formatPrice(amount)}</span>
        </div>
      </div>

      <div className="refund-status">
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusLabel()}
        </span>
      </div>

      {requestedAt && (
        <div className="refund-dates">
          <span className="date-label">Solicitado em:</span>
          <span className="date-value">
            {new Date(requestedAt).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {completedAt && status === 'concluído' && (
        <div className="refund-dates">
          <span className="date-label">Processado em:</span>
          <span className="date-value">
            {new Date(completedAt).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      {reason && status === 'recusado' && (
        <div className="refund-reason">
          <span className="reason-label">Motivo:</span>
          <span className="reason-value">{reason}</span>
        </div>
      )}

      {/* NOTA: Este componente apenas exibe informações de estorno */}
      {/* A execução de estorno é feita pelo backend via Core Financeiro */}
      {/* Conforme CORE_ESTORNOS_FINANCEIROS_CANONICO.md */}
    </div>
  );
}



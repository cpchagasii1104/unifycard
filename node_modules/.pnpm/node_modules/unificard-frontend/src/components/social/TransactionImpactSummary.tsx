// src/components/social/TransactionImpactSummary.tsx
// Mini-resumo de impacto após transação (usa apenas dados já retornados)

import './TransactionImpactSummary.css';

interface TransactionImpactSummaryProps {
  totalAmount: number;
  currency?: string;
  revenueEntry?: {
    amount_cents: number;
    currency: string;
    recipient_actor_id?: string | null;
  };
  profitShareEntry?: {
    amount_cents: number;
    currency: string;
    recipient_group_id?: string | null;
  };
  isProduct?: boolean;
  onViewLedger?: () => void;
  onBackToFeed?: () => void;
}

export default function TransactionImpactSummary({
  totalAmount,
  currency = 'BRL',
  revenueEntry,
  profitShareEntry,
  isProduct = false,
  onViewLedger,
  onBackToFeed,
}: TransactionImpactSummaryProps) {
  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const totalFormatted = formatPrice(totalAmount);

  return (
    <div className="transaction-impact-summary">
      <div className="impact-summary-header">
        <span className="impact-summary-icon">💰</span>
        <h3 className="impact-summary-title">Impacto Gerado</h3>
      </div>

      <div className="impact-summary-content">
        <div className="impact-summary-total">
          <span className="total-label">Total pago:</span>
          <span className="total-value">{totalFormatted}</span>
        </div>

        {(revenueEntry || profitShareEntry) ? (
          <div className="impact-summary-destinations">
            <p className="destinations-label">Principais destinos:</p>
            
            {revenueEntry && revenueEntry.amount_cents > 0 && (
              <div className="destination-item">
                <span className="destination-label">Prestador / Organizador</span>
                <span className="destination-value">{formatPrice(revenueEntry.amount_cents)}</span>
              </div>
            )}
            
            {profitShareEntry && profitShareEntry.amount_cents > 0 && (
              <div className="destination-item">
                <span className="destination-label">Comunidade / Grupo</span>
                <span className="destination-value">{formatPrice(profitShareEntry.amount_cents)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="impact-summary-note">
            <span className="note-icon">💡</span>
            <p className="note-text">
              A distribuição do valor será processada automaticamente pelo Split Engine e aparecerá no seu ledger.
            </p>
          </div>
        )}

        <div className="impact-summary-message">
          <span className="message-icon">💚</span>
          <span className="message-text">Sua transação gerou impacto no ecossistema!</span>
        </div>

        {/* Mensagem de progressão */}
        <div className="impact-summary-progression">
          <span className="progression-icon">✨</span>
          <div className="progression-content">
            <p className="progression-title">Você fortaleceu sua comunidade!</p>
            <p className="progression-description">
              Seu saldo de impacto foi atualizado. Continue engajando para gerar mais impacto!
            </p>
            {isProduct && (
              <p className="progression-recurrence">
                💡 Você pode comprar novamente a qualquer momento no feed!
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="impact-summary-actions">
        {onViewLedger && (
          <button
            className="impact-action-btn impact-action-ledger"
            onClick={onViewLedger}
          >
            Ver no Ledger
          </button>
        )}
        {onBackToFeed && (
          <button
            className="impact-action-btn impact-action-feed"
            onClick={onBackToFeed}
          >
            Voltar ao Feed
          </button>
        )}
      </div>
    </div>
  );
}


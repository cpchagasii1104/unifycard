// src/components/social/TransactionMiniSummary.tsx
// Bloco 4.2: Mini-resumo após transações - Feedback curto, não invasivo
// 2-3 linhas máximo, clareza > marketing

import { safeNumber } from '../../utils/guardrails';
import './TransactionMiniSummary.css';

interface TransactionMiniSummaryProps {
  totalAmount: number; // em centavos
  currency?: string;
  profitShareEntry?: {
    amount_cents: number;
    recipient_group_id?: string | null;
  };
  onViewLedger?: () => void;
}

export default function TransactionMiniSummary({
  totalAmount,
  currency = 'BRL',
  profitShareEntry,
  onViewLedger,
}: TransactionMiniSummaryProps) {
  // Bloco 4.2: Usar apenas dados reais retornados pela API (não calcular)
  const totalFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(safeNumber(totalAmount, 0) / 100);

  const hasGroupImpact = profitShareEntry && safeNumber(profitShareEntry.amount_cents, 0) > 0;

  return (
    <div className="transaction-mini-summary">
      <div className="mini-summary-content">
        <p className="mini-summary-text">
          <span className="mini-summary-amount">{totalFormatted}</span>
          {' '}movimentados
          {hasGroupImpact && (
            <>
              {' • '}
              <span className="mini-summary-impact">💚 Impacto gerado</span>
            </>
          )}
        </p>
        {onViewLedger && (
          <button
            className="mini-summary-link"
            onClick={onViewLedger}
          >
            Ver detalhes no Ledger →
          </button>
        )}
      </div>
    </div>
  );
}















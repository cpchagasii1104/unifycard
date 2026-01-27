// frontend/src/components/marketplace/CheckoutSummary.tsx
// UX CANÔNICA: Resumo consolidado do checkout
// 🔴 BLINDAGEM: Apenas exibição, sem cálculos

import { type CheckoutIntent, type MarketplaceStore } from '../../api/marketplace';
import './CheckoutSummary.css';

interface CheckoutSummaryProps {
  checkout: CheckoutIntent;
  stores: Map<string, MarketplaceStore>;
}

export default function CheckoutSummary({ checkout, stores }: CheckoutSummaryProps) {
  // Formatar valor em centavos para exibição
  const formatPrice = (cents: number): string => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calcular subtotais por vendedor (apenas para exibição visual)
  const subtotalsByVendor = new Map<string, number>();
  checkout.orders.forEach((order) => {
    const current = subtotalsByVendor.get(order.store_id) || 0;
    subtotalsByVendor.set(order.store_id, current + order.subtotal);
  });

  // Total consolidado vem do backend (fonte de verdade)
  const totalConsolidated = checkout.total;

  return (
    <div className="checkout-summary">
      <h3>Resumo do Pedido</h3>

      {/* Breakdown por vendedor */}
      <div className="summary-breakdown">
        <h4>Por Vendedor</h4>
        {Array.from(subtotalsByVendor.entries()).map(([storeId, subtotal]) => {
          const store = stores.get(storeId);
          return (
            <div key={storeId} className="breakdown-item">
              <span>{store?.name || `Loja ${storeId}`}:</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
          );
        })}
      </div>

      {/* Frete consolidado (se aplicável) */}
      {/* NOTA: Frete será exibido quando a API retornar essa informação no CheckoutIntent */}
      {/* Conforme UX canônica: frete é exibido separadamente e consolidado no total final */}
      {/* Por enquanto, apenas exibimos o total de produtos */}

      {/* Total consolidado (destacado) */}
      <div className="summary-total">
        <span className="total-label">Total:</span>
        <span className="total-value">{formatPrice(totalConsolidated)}</span>
      </div>

      {/* Nota sobre valor único */}
      <div className="summary-note">
        <p>
          Este é o valor único que será debitado. O pagamento é consolidado para todos os vendedores.
        </p>
      </div>
    </div>
  );
}


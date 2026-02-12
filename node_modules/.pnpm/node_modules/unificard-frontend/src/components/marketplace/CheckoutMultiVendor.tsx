// frontend/src/components/marketplace/CheckoutMultiVendor.tsx
// UX CANÔNICA: Checkout Multi-Vendor conforme UX_MARKETPLACE_CHECKOUT_MULTI_VENDOR.md
// 🔴 BLINDAGEM: Apenas exibição, sem cálculos, sem lógica financeira

import { useState, useEffect } from 'react';
import { getCheckout, confirmCheckout, type CheckoutIntent, type CheckoutOrder } from '../../api/marketplace';
import { getStores, type MarketplaceStore } from '../../api/marketplace';
import CheckoutVendorGroup from './CheckoutVendorGroup';
import CheckoutSummary from './CheckoutSummary';
import './CheckoutMultiVendor.css';

interface CheckoutMultiVendorProps {
  checkoutId: string;
  onPaymentPlanCreated?: (paymentPlanId: string) => void;
  onError?: (error: string) => void;
}

export default function CheckoutMultiVendor({
  checkoutId,
  onPaymentPlanCreated,
  onError,
}: CheckoutMultiVendorProps) {
  const [checkout, setCheckout] = useState<CheckoutIntent | null>(null);
  const [stores, setStores] = useState<Map<string, MarketplaceStore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadCheckout();
  }, [checkoutId]);

  const loadCheckout = async () => {
    try {
      setLoading(true);
      setError(null);

      const [checkoutData, storesData] = await Promise.all([
        getCheckout(checkoutId),
        getStores(),
      ]);

      setCheckout(checkoutData);

      // Mapear stores por ID para acesso rápido
      const storesMap = new Map<string, MarketplaceStore>();
      storesData.stores.forEach((store) => {
        storesMap.set(store.store_id, store);
      });
      setStores(storesMap);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar checkout';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!checkout) return;

    try {
      setConfirming(true);
      setError(null);

      const confirmedCheckout = await confirmCheckout(checkout.checkout_id);
      setCheckout(confirmedCheckout);

      // Notificar que checkout foi confirmado (pronto para criar payment plan)
      if (onPaymentPlanCreated) {
        // Payment plan será criado pela página pai após confirmação
        // Este componente apenas confirma o checkout
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao confirmar checkout';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-multi-vendor loading">
        <div className="loading-message">Carregando checkout...</div>
      </div>
    );
  }

  if (error && !checkout) {
    return (
      <div className="checkout-multi-vendor error">
        <div className="error-message">
          <h3>Erro ao carregar checkout</h3>
          <p>{error}</p>
          <button onClick={loadCheckout}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="checkout-multi-vendor error">
        <div className="error-message">
          <h3>Checkout não encontrado</h3>
          <p>O checkout solicitado não foi encontrado.</p>
        </div>
      </div>
    );
  }

  // Agrupar orders por store_id (agrupamento visual apenas)
  const ordersByStore = new Map<string, CheckoutOrder[]>();
  checkout.orders.forEach((order) => {
    if (!ordersByStore.has(order.store_id)) {
      ordersByStore.set(order.store_id, []);
    }
    ordersByStore.get(order.store_id)!.push(order);
  });

  return (
    <div className="checkout-multi-vendor">
      <div className="checkout-header">
        <h2>Checkout</h2>
        {checkout.status === 'open' && (
          <p className="checkout-status">Aguardando confirmação</p>
        )}
        {checkout.status === 'confirmed' && (
          <p className="checkout-status confirmed">Checkout confirmado</p>
        )}
      </div>

      {/* Agrupamento visual por vendedor */}
      <div className="checkout-vendor-groups">
        {Array.from(ordersByStore.entries()).map(([storeId, orders]) => {
          const store = stores.get(storeId);
          return (
            <CheckoutVendorGroup
              key={storeId}
              storeId={storeId}
              storeName={store?.name || `Loja ${storeId}`}
              orders={orders}
            />
          );
        })}
      </div>

      {/* Total consolidado */}
      <CheckoutSummary
        checkout={checkout}
        stores={stores}
      />

      {/* Nota fiscal - texto explícito */}
      <div className="checkout-invoice-info">
        <h3>Nota Fiscal</h3>
        <p>
          <strong>A nota fiscal é emitida pelo vendedor.</strong> A plataforma atua como intermediadora.
        </p>
        <p className="invoice-note">
          Cada vendedor emite sua própria nota fiscal para os produtos que você comprou dele.
        </p>
      </div>

      {/* Botão de confirmação */}
      {checkout.status === 'open' && (
        <div className="checkout-actions">
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Confirmando...' : 'Confirmar Checkout'}
          </button>
        </div>
      )}

      {/* Mensagem de erro (se houver) */}
      {error && checkout && (
        <div className="checkout-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}



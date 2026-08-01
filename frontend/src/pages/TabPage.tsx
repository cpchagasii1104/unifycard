// frontend/src/pages/TabPage.tsx
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTabByToken,
  createTabOrder,
  addItemToTabOrder,
  submitTabOrder,
  payTabOrder,
  type TabWithOrders,
} from '../api/venue';
import { getLoyaltyAccount } from '../api/loyalty';
import './TabPage.css';

export default function TabPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [tabData, setTabData] = useState<TabWithOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'UNIFYCARD'>('PIX');
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  useEffect(() => {
    if (qrToken) {
      loadTab();
    }
  }, [qrToken]);

  const loadTab = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTabByToken(qrToken!);
      setTabData(data);
      
      // Se não há order, criar um
      if (data.orders.length === 0) {
        await handleCreateOrder();
      } else {
        // Usar o primeiro order ou o mais recente
        const latestOrder = data.orders[data.orders.length - 1];
        if (latestOrder.status === 'draft' || latestOrder.status === 'submitted') {
          setCurrentOrderId(latestOrder.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar comanda');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const result = await createTabOrder(qrToken!);
      setCurrentOrderId(result.orderId);
      await loadTab();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar pedido');
    }
  };

  const handleAddItem = async (variantId: string, quantity: number = 1) => {
    if (!currentOrderId) {
      await handleCreateOrder();
      return;
    }

    try {
      await addItemToTabOrder(qrToken!, currentOrderId, {
        productVariantId: variantId,
        quantity,
      });
      await loadTab();
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar item');
    }
  };

  const handleSubmitOrder = async () => {
    if (!currentOrderId) {
      setError('Nenhum pedido selecionado');
      return;
    }

    try {
      await submitTabOrder(qrToken!, currentOrderId);
      await loadTab();
      setShowPayment(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao submeter pedido');
    }
  };

  const handlePayNow = async () => {
    if (!currentOrderId) {
      setError('Nenhum pedido selecionado');
      return;
    }

    try {
      setError(null);
      const result = await payTabOrder(qrToken!, currentOrderId, {
        paymentMethod,
      });

      // SPRINT 93: Mostrar pontos ganhos
      if (result.earnedPoints !== undefined) {
        setEarnedPoints(result.earnedPoints);
      }

      if (result.paymentMethod === 'PIX' && result.pixQrCode) {
        setPixQrCode(result.pixQrCode);
        setPaymentStatus('PENDING');
        // Futuro: polling para verificar status
      } else {
        setPaymentStatus(result.status);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    }
  };

  if (loading) {
    return <div className="tab-page loading">Carregando...</div>;
  }

  if (error && !tabData) {
    return <div className="tab-page error">{error}</div>;
  }

  if (!tabData) {
    return <div className="tab-page error">Comanda não encontrada</div>;
  }

  const currentOrder = tabData.orders.find((o) => o.id === currentOrderId);

  return (
    <div className="tab-page">
      <div className="tab-header">
        <h1>Comanda {tabData.tab.tableLabel || `#${tabData.tab.id.slice(0, 8)}`}</h1>
        <span className={`status-badge ${tabData.tab.status.toLowerCase()}`}>
          {tabData.tab.status}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-orders">
        <h2>Pedidos</h2>
        {tabData.orders.length === 0 ? (
          <p>Nenhum pedido ainda. Adicione itens do cardápio.</p>
        ) : (
          tabData.orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-info">
                <h3>Pedido #{order.id.slice(0, 8)}</h3>
                <span className={`status-badge ${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
                <p>Quantidade: {order.totalQuantity}</p>
              </div>
              {order.status === 'DRAFT' && order.id === currentOrderId && (
                <button className="btn-primary" onClick={handleSubmitOrder}>
                  Finalizar Pedido
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {earnedPoints !== null && earnedPoints > 0 && (
        <div className="points-notification">
          <p>🎉 Você ganhou {earnedPoints.toLocaleString('pt-BR')} pontos de fidelidade!</p>
        </div>
      )}

      {showPayment && currentOrder && currentOrder.status === 'submitted' && (
        <div className="payment-section">
          <h2>Pagamento</h2>
          {!paymentStatus ? (
            <>
              <div className="payment-methods">
                <label>
                  <input
                    type="radio"
                    value="PIX"
                    checked={paymentMethod === 'PIX'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'PIX')}
                  />
                  PIX
                </label>
                <label>
                  <input
                    type="radio"
                    value="UNIFYCARD"
                    checked={paymentMethod === 'UNIFYCARD'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'UNIFYCARD')}
                  />
                  UnifyCard
                </label>
              </div>
              <button className="btn-primary" onClick={handlePayNow}>
                Pagar Agora
              </button>
              <button className="btn-secondary" onClick={() => setShowPayment(false)}>
                Conta Aberta (Pagar no Caixa)
              </button>
            </>
          ) : (
            <div className="payment-result">
              {paymentMethod === 'PIX' && pixQrCode ? (
                <>
                  <p>Escaneie o QR Code para pagar:</p>
                  <div className="pix-qr-code">
                    <img src={pixQrCode} alt="QR Code PIX" />
                  </div>
                  <p>Status: {paymentStatus}</p>
                </>
              ) : (
                <p>Status do pagamento: {paymentStatus}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


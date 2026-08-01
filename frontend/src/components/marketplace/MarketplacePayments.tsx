// src/components/marketplace/MarketplacePayments.tsx
// Pagamentos: intent, authorize, execute, splits, payout
import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { useSearchParams } from 'react-router-dom';
import {
  createPaymentIntent,
  authorizePaymentIntent,
  executePayment,
  defineSplits,
  executePayout,
  getPayouts,
  listOrders,
  type PaymentIntent,
  type PaymentTransaction,
  type PaymentSplit,
  type PayoutTransaction,
} from '../../api/marketplace';
import { showToast } from '../common/Toast';
import StatusBadge from './StatusBadge';

export default function MarketplacePayments() {
  const { activeActor } = useActiveActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedIntent, setSelectedIntent] = useState<PaymentIntent | null>(null);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [payouts, setPayouts] = useState<PayoutTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIntentForm, setShowIntentForm] = useState(false);
  const [showSplitForm, setShowSplitForm] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (selectedIntent) {
      loadPayouts(selectedIntent.id);
    }
  }, [selectedIntent]);

  // Carregar intent a partir da URL (seria necessário buscar do backend)
  // Por enquanto, apenas detectar se há intentId na URL
  useEffect(() => {
    const intentId = searchParams.get('intentId');
    if (intentId) {
      // Em produção, buscar intent do backend
      // Por enquanto, apenas logar
      console.log('Intent ID na URL:', intentId);
    }
  }, [searchParams]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const ords = await listOrders();
      setOrders(ords.filter((o: any) => o.status === 'submitted'));
    } catch (error: any) {
      showToast('Erro ao carregar pedidos: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayouts = async (paymentIntentId: string) => {
    try {
      const pts = await getPayouts(paymentIntentId);
      setPayouts(pts);
    } catch (error: any) {
      // Ignorar erro silenciosamente
    }
  };

  const handleCreateIntent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const intent = await createPaymentIntent({
        orderId: formData.get('orderId') as string,
        amount: parseFloat(formData.get('amount') as string),
        currency: formData.get('currency') as string || 'BRL',
      });
      showToast('Payment intent criado com sucesso', 'success');
      setShowIntentForm(false);
      setSelectedIntent(intent);
    } catch (error: any) {
      showToast('Erro ao criar payment intent: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleAuthorize = async () => {
    if (!selectedIntent) return;
    try {
      const intent = await authorizePaymentIntent(selectedIntent.id);
      setSelectedIntent(intent);
      showToast('Pagamento autorizado com sucesso', 'success');
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('limite') || message.includes('limit')) {
        showToast('Limite atingido', 'error');
      } else {
        showToast('Erro ao autorizar: ' + message, 'error');
      }
    }
  };

  const handleExecute = async () => {
    if (!selectedIntent || !activeActor) return;
    if (!confirm('Tem certeza que deseja executar este pagamento? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      const txn = await executePayment({
        paymentIntentId: selectedIntent.id,
        buyerActorId: activeActor.actor_id,
        sellerActorId: '', // Seria obtido do order
      });
      setTransaction(txn);
      showToast('Pagamento executado com sucesso', 'success');
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('limite') || message.includes('limit')) {
        showToast('Limite atingido', 'error');
      } else if (message.includes('split') || message.includes('soma')) {
        showToast('Split inválido: soma diferente do valor do pagamento', 'error');
      } else {
        showToast('Erro ao executar pagamento: ' + message, 'error');
      }
    }
  };

  const handleDefineSplits = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedIntent) return;
    const formData = new FormData(e.currentTarget);
    try {
      const splitsData = await defineSplits(selectedIntent.id, [
        {
          recipientActorId: formData.get('recipientActorId') as string,
          amount: parseFloat(formData.get('amount') as string),
          percentage: parseFloat(formData.get('percentage') as string) || undefined,
          role: formData.get('role') as 'SELLER' | 'PLATFORM' | 'FUND' | 'OTHER',
        },
      ]);
      setSplits(splitsData);
      showToast('Splits definidos com sucesso', 'success');
      setShowSplitForm(false);
    } catch (error: any) {
      showToast('Erro ao definir splits: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleExecutePayout = async () => {
    if (!selectedIntent) return;
    if (!confirm('Tem certeza que deseja executar os payouts? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      const pts = await executePayout(selectedIntent.id);
      setPayouts(pts);
      showToast('Payout executado com sucesso', 'success');
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('split') || message.includes('soma')) {
        showToast('Split inválido: soma diferente do valor do pagamento', 'error');
      } else {
        showToast('Erro ao executar payout: ' + message, 'error');
      }
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="marketplace-payments">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Pagamentos</h2>
        <button onClick={() => setShowIntentForm(!showIntentForm)}>
          {showIntentForm ? 'Cancelar' : '+ Novo Payment Intent'}
        </button>
      </div>

      {showIntentForm && (
        <form onSubmit={handleCreateIntent} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Pedido: 
              <select name="orderId" required>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>Pedido {o.id.substring(0, 8)}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Valor: <input type="number" name="amount" step="0.01" required /></label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Moeda: <input type="text" name="currency" defaultValue="BRL" /></label>
          </div>
          <button type="submit">Criar</button>
        </form>
      )}

      {selectedIntent && (
        <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3>Payment Intent {selectedIntent.id.substring(0, 8)}</h3>
          <p><strong>Status:</strong> <StatusBadge status={selectedIntent.status} type="payment" /></p>
          <p><strong>Valor:</strong> {selectedIntent.amount} {selectedIntent.currency}</p>

          {selectedIntent.status === 'CREATED' && (
            <button onClick={handleAuthorize} style={{ marginRight: '0.5rem' }}>Autorizar</button>
          )}

          {selectedIntent.status === 'AUTHORIZED' && (
            <>
              <button onClick={handleExecute} style={{ marginRight: '0.5rem' }}>Executar Pagamento</button>
              <button onClick={() => setShowSplitForm(!showSplitForm)} style={{ marginRight: '0.5rem' }}>
                {showSplitForm ? 'Cancelar' : 'Definir Splits'}
              </button>
            </>
          )}

          {transaction && (
            <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px' }}>
              <strong>Transação:</strong> <StatusBadge status={transaction.status} type="payment" />
              {transaction.bankTransactionId && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                  ({transaction.bankTransactionId.substring(0, 8)})
                </span>
              )}
            </div>
          )}

          {showSplitForm && (
            <form onSubmit={handleDefineSplits} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Recipient Actor ID: <input type="text" name="recipientActorId" required /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Valor: <input type="number" name="amount" step="0.01" required /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Porcentagem: <input type="number" name="percentage" step="0.01" /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Role: 
                  <select name="role" required>
                    <option value="SELLER">Vendedor</option>
                    <option value="PLATFORM">Plataforma</option>
                    <option value="FUND">Fundo</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </label>
              </div>
              <button type="submit">Definir</button>
            </form>
          )}

          {splits.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Splits</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Recipient</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Valor</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split) => (
                    <tr key={split.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{split.recipientActorId.substring(0, 8)}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{split.amount}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{split.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={handleExecutePayout} style={{ marginTop: '0.5rem' }}>Executar Payout</button>
            </div>
          )}

          {payouts.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Payouts</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Valor</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                        <StatusBadge status={payout.status} type="payout" />
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{payout.amount}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{payout.bankTransactionId?.substring(0, 8) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


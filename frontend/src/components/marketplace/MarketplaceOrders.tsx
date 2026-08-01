// src/components/marketplace/MarketplaceOrders.tsx
// Pedidos: criar, gerenciar, submit/cancel
import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { useSearchParams } from 'react-router-dom';
import {
  listOrders,
  createLegacyOrder,
  addLegacyOrderItem,
  removeOrderItem,
  submitOrder,
  cancelOrder,
  getOrderHistory,
  listProducts,
  listVariants,
  type LegacyOrder as Order,
  type LegacyOrderItem as OrderItem,
  type OrderStatusHistory,
} from '../../api/marketplace';
import { showToast } from '../common/Toast';
import StatusBadge from './StatusBadge';

export default function MarketplaceOrders() {
  const { activeActor } = useActiveActor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);

  useEffect(() => {
    loadOrders();
    loadVariants();
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      loadOrderData(selectedOrder.id);
    }
  }, [selectedOrder]);

  // Carregar order a partir da URL
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && orders.length > 0) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
      }
    }
  }, [searchParams, orders]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const ords = await listOrders();
      setOrders(ords);
    } catch (error: any) {
      showToast('Erro ao carregar pedidos: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderData = async (orderId: string) => {
    try {
      const hist = await getOrderHistory(orderId);
      setHistory(hist);
      // Items seriam carregados via endpoint separado (simplificado aqui)
    } catch (error: any) {
      showToast('Erro ao carregar dados do pedido: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const loadVariants = async () => {
    try {
      // Simplificado - em produção, teria endpoint específico
      const prods = await listProducts();
      const allVariants: any[] = [];
      for (const prod of prods) {
        const vars = await listVariants(prod.id);
        allVariants.push(...vars);
      }
      setVariants(allVariants);
    } catch (error: any) {
      // Ignorar erro silenciosamente
    }
  };

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeActor) {
      showToast('Actor ativo não encontrado', 'error');
      return;
    }
    const formData = new FormData(e.currentTarget);
    try {
      const order = await createLegacyOrder({
        buyerActorId: activeActor.actor_id,
        sellerActorId: formData.get('sellerActorId') as string,
      });
      showToast('Pedido criado com sucesso', 'success');
      setShowOrderForm(false);
      setSelectedOrder(order);
      loadOrders();
    } catch (error: any) {
      showToast('Erro ao criar pedido: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const formData = new FormData(e.currentTarget);
    try {
      await addLegacyOrderItem(selectedOrder.id, {
        productVariantId: formData.get('productVariantId') as string,
        quantity: parseFloat(formData.get('quantity') as string),
        unit: formData.get('unit') as string || 'UN',
      });
      showToast('Item adicionado com sucesso', 'success');
      setShowItemForm(false);
      loadOrderData(selectedOrder.id);
    } catch (error: any) {
      showToast('Erro ao adicionar item: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedOrder) return;
    if (!confirm('Tem certeza que deseja submeter este pedido? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      await submitOrder(selectedOrder.id);
      showToast('Pedido submetido com sucesso', 'success');
      loadOrders();
      loadOrderData(selectedOrder.id);
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('limite') || message.includes('limit')) {
        showToast('Limite atingido', 'error');
      } else {
        showToast('Erro ao submeter pedido: ' + message, 'error');
      }
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) {
      return;
    }
    try {
      await cancelOrder(selectedOrder.id);
      showToast('Pedido cancelado com sucesso', 'success');
      loadOrders();
      loadOrderData(selectedOrder.id);
    } catch (error: any) {
      showToast('Erro ao cancelar pedido: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="marketplace-orders">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Pedidos</h2>
        <button onClick={() => setShowOrderForm(!showOrderForm)}>
          {showOrderForm ? 'Cancelar' : '+ Novo Pedido'}
        </button>
      </div>

      {showOrderForm && (
        <form onSubmit={handleCreateOrder} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Seller Actor ID: <input type="text" name="sellerActorId" required /></label>
          </div>
          <button type="submit">Criar</button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Lista de pedidos */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(order)}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{order.id.substring(0, 8)}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <StatusBadge status={order.status} type="order" />
                  </td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detalhes do pedido selecionado */}
        {selectedOrder && (
          <div>
            <h3>Pedido {selectedOrder.id.substring(0, 8)}</h3>
            <p><strong>Status:</strong> <StatusBadge status={selectedOrder.status} type="order" /></p>

            {selectedOrder.status === 'draft' && (
              <>
                <button onClick={() => setShowItemForm(!showItemForm)} style={{ marginRight: '0.5rem' }}>
                  {showItemForm ? 'Cancelar' : '+ Adicionar Item'}
                </button>
                <button onClick={handleSubmitOrder} style={{ marginRight: '0.5rem' }}>Submeter</button>
                <button onClick={handleCancelOrder}>Cancelar</button>
              </>
            )}

            {showItemForm && (
              <form onSubmit={handleAddItem} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>Variante: 
                    <select name="productVariantId" required>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>{v.sku}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>Quantidade: <input type="number" name="quantity" step="0.01" required /></label>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>Unidade: <input type="text" name="unit" defaultValue="UN" /></label>
                </div>
                <button type="submit">Adicionar</button>
              </form>
            )}

            <div style={{ marginTop: '1rem' }}>
              <h4>Histórico</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>De</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Para</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{h.fromStatus}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{h.toStatus}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{new Date(h.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


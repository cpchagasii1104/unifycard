// src/pages/PdvPage.tsx
// PDV - Ponto de Venda (UI simples)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  openPdvSession,
  closePdvSession,
  getOpenPdvSession,
  createOrderFromPdv,
  addItemByVariant,
  addItemByWeight,
  payOrderFromPdv,
  closeSessionWithSummary,
  getSessionSummary,
  type PdvSession,
  type PayOrderFromPdvResult,
  type PdvSessionSummary,
} from '../api/pdv';
import {
  listProducts,
  listVariants,
  type Product,
  type ProductVariant,
} from '../api/marketplace';
import { showToast } from '../components/common/Toast';
import './PdvPage.css';

export default function PdvPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [session, setSession] = useState<PdvSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentResult, setPaymentResult] = useState<PayOrderFromPdvResult | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionSummary, setSessionSummary] = useState<PdvSessionSummary | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (session) {
      loadProducts();
    }
  }, [session]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const openSession = await getOpenPdvSession();
      setSession(openSession);
      
      // Se sessão existe, carregar resumo
      if (openSession) {
        try {
          const summary = await getSessionSummary(openSession.id);
          setSessionSummary(summary);
        } catch (err) {
          // Ignorar erro se sessão não tiver resumo ainda
        }
      }
    } catch (error: any) {
      showToast('Erro ao carregar sessão PDV: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const prods = await listProducts();
      setProducts(prods);
      
      // Carregar variantes de todos os produtos
      const allVariants: ProductVariant[] = [];
      for (const prod of prods) {
        const vars = await listVariants(prod.id);
        allVariants.push(...vars);
      }
      setVariants(allVariants);
    } catch (error: any) {
      showToast('Erro ao carregar produtos: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleOpenSession = async () => {
    if (!activeActor) {
      showToast('Actor ativo não encontrado', 'error');
      return;
    }
    try {
      const newSession = await openPdvSession({
        actorId: activeActor.actor_id,
      });
      setSession(newSession);
      showToast('Caixa aberto com sucesso', 'success');
    } catch (error: any) {
      showToast('Erro ao abrir caixa: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    setShowCloseModal(true);
  };

  const handleConfirmCloseSession = async () => {
    if (!session) return;
    setIsClosingSession(true);
    try {
      const summary = await closeSessionWithSummary(session.id);
      setSession(summary.session);
      setSessionSummary(summary);
      setCurrentOrder(null);
      setOrderItems([]);
      setShowCloseModal(false);
      showToast('Caixa fechado com sucesso', 'success');
    } catch (error: any) {
      showToast('Erro ao fechar caixa: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsClosingSession(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!session || !activeActor) return;
    try {
      const order = await createOrderFromPdv({
        sessionId: session.id,
        buyerActorId: activeActor.actor_id, // Cliente (pode ser diferente do operador)
        sellerActorId: activeActor.actor_id, // Vendedor (por enquanto, mesmo actor)
      });
      setCurrentOrder(order);
      setOrderItems([]);
      showToast('Pedido criado com sucesso', 'success');
    } catch (error: any) {
      showToast('Erro ao criar pedido: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleAddItem = async () => {
    if (!session || !currentOrder || !selectedVariant) return;

    try {
      // Verificar se variante é WEIGHT
      const product = products.find((p) => p.id === selectedVariant.productId);
      
      if (product?.productType === 'WEIGHT') {
        const weight = parseFloat(weightInput);
        if (isNaN(weight) || weight <= 0) {
          showToast('Peso inválido', 'error');
          return;
        }
        await addItemByWeight({
          sessionId: session.id,
          orderId: currentOrder.id,
          variantId: selectedVariant.id,
          weight,
          unit: 'KG',
        });
        showToast(`${weight}kg adicionado com sucesso`, 'success');
      } else {
        const quantity = parseFloat(quantityInput);
        if (isNaN(quantity) || quantity <= 0) {
          showToast('Quantidade inválida', 'error');
          return;
        }
        await addItemByVariant({
          sessionId: session.id,
          orderId: currentOrder.id,
          variantId: selectedVariant.id,
          quantity,
          unit: 'UN',
        });
        showToast(`${quantity} unidade(s) adicionada(s) com sucesso`, 'success');
      }

      // Limpar inputs
      setWeightInput('');
      setQuantityInput('1');
      setSelectedVariant(null);
      
      // Recarregar itens do pedido (simplificado - em produção, teria endpoint)
      // Por enquanto, apenas mostrar mensagem
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('WEIGHT')) {
        showToast('Este produto só pode ser vendido por peso', 'error');
      } else {
        showToast('Erro ao adicionar item: ' + message, 'error');
      }
    }
  };

  const handleFinalizeOrder = () => {
    if (!currentOrder) return;
    // Navegar para marketplace/orders com o pedido selecionado
    navigate(`/marketplace?tab=orders&orderId=${currentOrder.id}`);
  };

  const handlePayOrder = async () => {
    if (!session || !currentOrder || !activeActor) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Valor inválido', 'error');
      return;
    }

    if (!confirm(`Confirmar pagamento de R$ ${amount.toFixed(2)}?`)) {
      return;
    }

    setIsProcessingPayment(true);
    setPaymentResult(null);

    try {
      const result = await payOrderFromPdv({
        sessionId: session.id,
        orderId: currentOrder.id,
        amount,
        currency: 'BRL',
        buyerActorId: activeActor.actor_id,
        sellerActorId: activeActor.actor_id,
      });

      setPaymentResult(result);
      showToast('Pagamento realizado com sucesso', 'success');
      
      // Limpar campo de valor
      setPaymentAmount('');
    } catch (error: any) {
      const message = error.message || 'Erro desconhecido';
      if (message.includes('limite') || message.includes('limit')) {
        showToast('Limite atingido', 'error');
      } else {
        showToast('Erro ao processar pagamento: ' + message, 'error');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filteredVariants = variants.filter((v) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const product = products.find((p) => p.id === v.productId);
    return (
      v.sku.toLowerCase().includes(search) ||
      v.plu?.toLowerCase().includes(search) ||
      product?.name.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return <div className="pdv-page">Carregando...</div>;
  }

  return (
    <div className="pdv-page">
      <div className="pdv-header">
        <h1>PDV - Ponto de Venda</h1>
        {!session ? (
          <button onClick={handleOpenSession} className="pdv-button-primary">
            Abrir Caixa
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ padding: '0.5rem', background: '#d1fae5', borderRadius: '4px' }}>
              Caixa Aberto
            </span>
            <button onClick={handleCloseSession} className="pdv-button-secondary">
              Fechar Caixa
            </button>
          </div>
        )}
      </div>

      {session && (
        <div className="pdv-content">
          {/* Bloqueio se sessão fechada */}
          {session.status === 'closed' && (
            <div className="pdv-section" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
              <h3 style={{ color: '#991b1b' }}>Caixa Fechado</h3>
              <p style={{ color: '#7f1d1d' }}>
                Esta sessão está fechada. Não é possível criar novos pedidos ou processar pagamentos.
              </p>
              {sessionSummary && (
                <div style={{ marginTop: '1rem' }}>
                  <h4>Resumo do Turno</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>Total de Pedidos</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{sessionSummary.totalOrders}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Recebido</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                        R$ {sessionSummary.totalPaid.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>Total com Falha</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: sessionSummary.totalFailed > 0 ? '#dc2626' : '#666' }}>
                        R$ {sessionSummary.totalFailed.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {sessionSummary.orders.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h5>Pedidos do Turno</h5>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', marginTop: '0.5rem' }}>
                        {sessionSummary.orders.map((order) => (
                          <div key={order.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 'bold' }}>Pedido #{order.id.substring(0, 8)}</div>
                                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                  Status: {order.status} | Pagamento: {order.paymentStatus}
                                </div>
                              </div>
                              {order.amount && (
                                <div style={{ fontWeight: 'bold' }}>
                                  R$ {order.amount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Criar Pedido (só se sessão aberta) */}
          {session.status === 'open' && !currentOrder && (
            <div className="pdv-section">
              <button onClick={handleCreateOrder} className="pdv-button-primary">
                Criar Novo Pedido
              </button>
            </div>
          )}

          {session.status === 'open' && currentOrder && (
            <>
              {/* Busca de Produtos */}
              <div className="pdv-section">
                <h2>Buscar Produto</h2>
                <input
                  type="text"
                  placeholder="Buscar por nome, SKU ou PLU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                />

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                  {filteredVariants.map((variant) => {
                    const product = products.find((p) => p.id === variant.productId);
                    return (
                      <div
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          background: selectedVariant?.id === variant.id ? '#e0f2fe' : 'white',
                          borderBottom: '1px solid #eee',
                        }}
                      >
                        <div style={{ fontWeight: 'bold' }}>{product?.name || variant.sku}</div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          SKU: {variant.sku} {variant.plu && `| PLU: ${variant.plu}`}
                          {product?.productType === 'WEIGHT' && ' (por peso)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Adicionar Item */}
              {selectedVariant && (
                <div className="pdv-section">
                  <h3>Adicionar Item</h3>
                  {products.find((p) => p.id === selectedVariant.productId)?.productType === 'WEIGHT' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label>
                        Peso (kg):
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
                        />
                      </label>
                      <button onClick={handleAddItem} className="pdv-button-primary">
                        Adicionar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label>
                        Quantidade:
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={quantityInput}
                          onChange={(e) => setQuantityInput(e.target.value)}
                          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
                        />
                      </label>
                      <button onClick={handleAddItem} className="pdv-button-primary">
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Itens do Pedido */}
              <div className="pdv-section">
                <h3>Pedido #{currentOrder.id.substring(0, 8)}</h3>
                <p style={{ fontSize: '0.875rem', color: '#666' }}>
                  Itens serão carregados após adicionar...
                </p>

                {/* Pagamento */}
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '4px' }}>
                  <h4 style={{ marginTop: 0 }}>Receber Pagamento</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label>
                      Valor (R$):
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        style={{ marginLeft: '0.5rem', padding: '0.5rem', width: '150px' }}
                        disabled={isProcessingPayment}
                      />
                    </label>
                    <button
                      onClick={handlePayOrder}
                      className="pdv-button-primary"
                      disabled={isProcessingPayment || !paymentAmount}
                    >
                      {isProcessingPayment ? 'Processando...' : 'Receber Pagamento'}
                    </button>
                  </div>

                  {paymentResult && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d1fae5', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 'bold', color: '#065f46' }}>✓ Pagamento realizado com sucesso</div>
                      <div style={{ fontSize: '0.875rem', color: '#047857', marginTop: '0.25rem' }}>
                        Transação: {paymentResult.transaction.id.substring(0, 8)}
                        {paymentResult.transaction.status === 'success' && ' (Sucesso)'}
                        {paymentResult.transaction.status === 'pending' && ' (Pendente)'}
                        {paymentResult.transaction.status === 'failed' && ' (Falhou)'}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={handleFinalizeOrder} className="pdv-button-primary" style={{ marginTop: '1rem' }}>
                  Ver no Marketplace →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de confirmação de fechamento */}
      {showCloseModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !isClosingSession && setShowCloseModal(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Fechar Caixa</h2>
            <p>Tem certeza que deseja fechar o caixa? Um resumo do turno será gerado.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={isClosingSession}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isClosingSession ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCloseSession}
                disabled={isClosingSession}
                className="pdv-button-secondary"
              >
                {isClosingSession ? 'Fechando...' : 'Fechar Caixa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


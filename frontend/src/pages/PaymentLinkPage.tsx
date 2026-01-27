// frontend/src/pages/PaymentLinkPage.tsx
// SPRINT 86: PAYMENT LINKS

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './PaymentLinkPage.css';

interface PaymentLink {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  status: string;
}

interface PaymentIntent {
  paymentIntentId: string;
  availableMethods: string[];
  amount: number;
  currency: string;
}

interface PaymentStatus {
  paymentIntent: {
    id: string;
    status: string;
    amount: number;
    currency: string;
  };
  transaction: {
    id: string;
    status: string;
    amount: number;
  } | null;
  link: {
    id: string;
    title: string;
    amount: number;
    usesCount: number;
  };
}

export default function PaymentLinkPage() {
  const { slug } = useParams<{ slug: string }>();
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('PIX');
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [contact, setContact] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
  });

  // Resolver tenantId (por enquanto, usar query param ou localStorage)
  const getTenantId = (): string | null => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenantId') || localStorage.getItem('tenantId') || null;
  };

  useEffect(() => {
    if (!slug) {
      setError('Slug não fornecido');
      setLoading(false);
      return;
    }

    loadLink();
  }, [slug]);

  // Polling para atualizar status do pagamento
  useEffect(() => {
    if (!paymentIntent?.paymentIntentId || !slug) {
      return;
    }

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 3000); // Polling a cada 3 segundos

    return () => clearInterval(interval);
  }, [paymentIntent?.paymentIntentId, slug]);

  const loadLink = async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        setError('tenantId não encontrado');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/pay/${slug}?tenantId=${tenantId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao carregar link');
      }

      const data = await response.json();
      setLink(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar link');
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    if (!slug) {
      return;
    }

    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        setError('tenantId não encontrado');
        return;
      }

      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/pay/${slug}/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          contact: contact.name ? contact : undefined,
          paymentMethodId: selectedMethod === 'UNIFYCARD' ? 'unifycard' : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar payment intent');
      }

      const data = await response.json();
      setPaymentIntent(data);
      checkPaymentStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar payment intent');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!slug || !paymentIntent?.paymentIntentId) {
      return;
    }

    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/pay/${slug}/status?tenantId=${tenantId}&paymentIntentId=${paymentIntent.paymentIntentId}`
      );

      if (response.ok) {
        const data = await response.json();
        setPaymentStatus(data);

        // Se pagamento confirmado, parar polling
        if (data.transaction?.status === 'SUCCESS') {
          // Mostrar mensagem de sucesso
        }
      }
    } catch (err) {
      // Silenciar erros de polling
      console.warn('Erro ao verificar status:', err);
    }
  };

  const executePayment = async () => {
    if (!paymentIntent) {
      return;
    }

    try {
      setLoading(true);
      const tenantId = getTenantId();
      if (!tenantId) {
        setError('tenantId não encontrado');
        return;
      }

      // Executar pagamento via PaymentExecutionService
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/marketplace/payments/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.paymentIntentId,
          buyerActorId: link?.id, // Usar link ID como buyer temporário
          sellerActorId: link?.id, // Mesmo actor
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao executar pagamento');
      }

      const transaction = await response.json();
      
      // Se PIX, mostrar QR Code
      if (selectedMethod === 'PIX' && transaction.metadata?.pix_qr_code) {
        // QR Code já está no metadata
      }

      checkPaymentStatus();
    } catch (err: any) {
      setError(err.message || 'Erro ao executar pagamento');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !link) {
    return (
      <div className="payment-link-page">
        <div className="payment-link-loading">Carregando...</div>
      </div>
    );
  }

  if (error && !link) {
    return (
      <div className="payment-link-page">
        <div className="payment-link-error">
          <p>Erro: {error}</p>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="payment-link-page">
        <div className="payment-link-error">
          <p>Link não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-link-page">
      <div className="payment-link-container">
        <h1>{link.title}</h1>
        {link.description && <p className="payment-link-description">{link.description}</p>}

        <div className="payment-link-amount">
          <span className="amount-value">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: link.currency,
            }).format(link.amount)}
          </span>
        </div>

        {!paymentIntent ? (
          <>
            <div className="payment-link-contact-form">
              <h3>Dados do Pagador (Opcional)</h3>
              <input
                type="text"
                placeholder="Nome"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
              <input
                type="tel"
                placeholder="Telefone"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
              <input
                type="text"
                placeholder="CPF/CNPJ (opcional)"
                value={contact.taxId}
                onChange={(e) => setContact({ ...contact, taxId: e.target.value })}
              />
            </div>

            <div className="payment-link-methods">
              <h3>Escolha o método de pagamento</h3>
              <button
                className={selectedMethod === 'PIX' ? 'active' : ''}
                onClick={() => setSelectedMethod('PIX')}
              >
                PIX
              </button>
              <button
                className={selectedMethod === 'UNIFYCARD' ? 'active' : ''}
                onClick={() => setSelectedMethod('UNIFYCARD')}
              >
                UnifyCard
              </button>
            </div>

            <button className="payment-link-button" onClick={createPaymentIntent} disabled={loading}>
              {loading ? 'Criando...' : 'Continuar'}
            </button>
          </>
        ) : (
          <>
            {selectedMethod === 'PIX' && (paymentStatus?.transaction as any)?.metadata?.pix_qr_code && (
              <div className="payment-link-qrcode">
                <h3>Escaneie o QR Code ou copie o código</h3>
                <img
                  src={(paymentStatus.transaction as any).metadata.pix_qr_code}
                  alt="QR Code PIX"
                />
                <textarea
                  readOnly
                  value={(paymentStatus.transaction as any).metadata.pix_qr_code_text || ''}
                />
                <button onClick={() => {
                  navigator.clipboard.writeText((paymentStatus.transaction as any)?.metadata.pix_qr_code_text);
                  alert('Código copiado!');
                }}>
                  Copiar código
                </button>
              </div>
            )}

            {paymentStatus?.transaction?.status === 'SUCCESS' && (
              <div className="payment-link-success">
                <h2>Pagamento confirmado!</h2>
                <p>Obrigado pelo pagamento.</p>
              </div>
            )}

            {paymentStatus?.transaction?.status === 'PENDING' && (
              <div className="payment-link-pending">
                <p>Aguardando confirmação do pagamento...</p>
              </div>
            )}
          </>
        )}

        {error && <div className="payment-link-error">{error}</div>}
      </div>
    </div>
  );
}


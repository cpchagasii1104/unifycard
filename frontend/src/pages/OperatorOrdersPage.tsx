// frontend/src/pages/OperatorOrdersPage.tsx
// F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-C) — 2026-06-27.
// Tela do OPERADOR NÃO-PARTY: listar/abrir ordens de um provider que lhe concedeu 'service_order:view'
// (DECISION-0136). O operador informa o actor do provider; o backend decide (canViewOrderForParty
// resolve canRepresentActor OU hasCapabilityGrant a partir do USUÁRIO logado). Esta tela é READ-ONLY:
//   - só lê via GET /service-orders (filtro por party) e GET /service-orders/:id (allowViewGrant);
//   - NÃO confirma/inicia/conclui/cancela; NÃO lê financial-terms (negado a grant no backend);
//   - sem Bank, sem payout, sem checkout, sem disputa.
// "Frontend nunca cria verdade — projeta verdade resolvida": sem acesso, o backend recusa (403) e
// mostramos um terminal honesto — nada é fabricado aqui.

import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listServiceOrders, type ServiceOrder } from '../api/service-orders';
import { getServiceName, getActorName, formatEntityDisplay, shortId } from '../utils/service-orders-helpers';
import './ServiceOrdersPage.css';

export default function OperatorOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [providerActorId, setProviderActorId] = useState(searchParams.get('provider') ?? '');
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, { service?: string | null; customer?: string | null }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const load = useCallback(async (providerId: string) => {
    const id = providerId.trim();
    if (!id) {
      setError('Informe o actor do prestador que lhe concedeu acesso.');
      return;
    }
    setLoading(true);
    setError(null);
    setLoaded(false);
    try {
      // Operador NÃO-party consulta as ordens onde o provider é o worker. O backend autoriza por grant
      // a partir do usuário logado (canViewOrderForParty). Sem concessão → 403 honesto.
      const data = await listServiceOrders({ workerActorId: id });
      setOrders(data);
      setLoaded(true);

      const names: Record<string, { service?: string | null; customer?: string | null }> = {};
      for (const order of data) {
        const [service, customer] = await Promise.all([
          getServiceName(order.serviceId),
          getActorName(order.customerActorId),
        ]);
        names[order.id] = { service, customer };
      }
      setEntityNames(names);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as ordens deste prestador.';
      // 403 = sem concessão; mensagem honesta, sem fabricar lista.
      setError(message);
      setOrders([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = providerActorId.trim();
    setSearchParams(id ? { provider: id } : {});
    load(id);
  };

  return (
    <div className="service-orders-page">
      <div className="page-header">
        <div>
          <h1>Ordens por concessão (operador)</h1>
          <p className="acting-as">
            Você vê aqui apenas ordens de um prestador que lhe concedeu acesso de leitura
            (<code>service_order:view</code>). Somente leitura — sem valores financeiros e sem ações.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/service-orders')}>
            Minhas ordens
          </button>
        </div>
      </div>

      <form className="filters" onSubmit={handleSubmit}>
        <label htmlFor="provider-actor">Prestador (actor id):</label>
        <input
          id="provider-actor"
          type="text"
          value={providerActorId}
          onChange={(e) => setProviderActorId(e.target.value)}
          placeholder="actor id do prestador que concedeu o acesso"
          style={{ flex: '1 1 320px', minWidth: 0 }}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Carregando…' : 'Ver ordens'}
        </button>
      </form>

      {error && <div className="error" role="alert">{error}</div>}

      {loaded && orders.length === 0 && !error && (
        <div className="empty-state">
          <p>Nenhuma ordem encontrada para o prestador {shortId(providerActorId.trim())}.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order) => (
            <div
              key={order.id}
              className="order-card"
              onClick={() => navigate(`/service-orders/${order.id}`)}
            >
              <div className="order-header">
                <h3>Ordem #{order.id.substring(0, 8)}</h3>
                <span className="status-badge">{order.status}</span>
              </div>
              <div className="order-info">
                <p>
                  <strong>Serviço:</strong>{' '}
                  {entityNames[order.id]?.service
                    ? formatEntityDisplay(order.serviceId, entityNames[order.id].service)
                    : `${order.serviceId.substring(0, 8)}...`}
                </p>
                <p>
                  <strong>Cliente:</strong>{' '}
                  {entityNames[order.id]?.customer
                    ? formatEntityDisplay(order.customerActorId, entityNames[order.id].customer)
                    : `${order.customerActorId.substring(0, 8)}...`}
                </p>
                <p><strong>Agendado para:</strong> {formatDate(order.scheduledStart)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

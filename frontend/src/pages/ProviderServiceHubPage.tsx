// src/pages/ProviderServiceHubPage.tsx
// GAP-2(lista) + GAP-3(inbox) + GAP-4(link ordens) / F-MVP-SERVICE-CHAIN-FRONTEND-WIRING (Opção A).
// Central do prestador para o MEMBRO operando-como-a-empresa (company_users / canRepresentActor).
// Concentra a vitrine sem console paralelo novo de dinheiro: serviços, reservas pendentes (canônicas),
// inbox de ORDER (ordem nascida), e atalho às ordens. TODA leitura é do ACTOR ATIVO (a empresa que o
// membro representa) — o backend exige canRepresentActor (DECISION-0113). SEM grant, SEM dinheiro, SEM
// localStorage como autoridade. As reservas pendentes vêm do SSOT temporal (unified-availability),
// escopadas por disponibilidade da própria oferta (nunca listagem tenant-wide).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { useOperatingMode } from '../hooks/useOperatingMode';
import { showToast } from '../components/common/Toast';
import { listActorServices, type Service } from '../api/services';
import { getOfferingsByCanonical } from '../api/offerings';
import { listAvailabilities, listBookings, type UnifiedBooking } from '../api/availability';
import { getOrderInbox, type InboxItem } from '../api/inbox';
import { shortId } from '../utils/service-orders-helpers';
import OperatorGrantsManager from '../components/authority/OperatorGrantsManager';
import './ProviderServiceHubPage.css';

interface PendingBooking {
  booking: UnifiedBooking;
  serviceId: string;
  serviceName: string;
  startDatetime: string;
  endDatetime: string;
}

export default function ProviderServiceHubPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  // Doutrina actor×modo (D1): o modo REORDENA a apresentação, nunca esconde capability.
  // Consumindo → descoberta primeiro (contratar); Operando → a central do prestador como está.
  const { mode } = useOperatingMode();

  const [services, setServices] = useState<Service[]>([]);
  const [pending, setPending] = useState<PendingBooking[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeActor) {
      setLoading(false);
      return;
    }
    const actorId = activeActor.actor_id;
    setLoading(true);
    setError(null);
    try {
      // 1. Serviços do prestador (actor ativo).
      const svcs = await listActorServices(actorId);
      setServices(svcs);

      // 2. Reservas pendentes CANÔNICAS: serviço → oferta(s) do provider → disponibilidades → bookings 'requested'.
      //    Escopo por disponibilidade da própria oferta (o backend autoriza por dono da availability).
      const pendingRows: PendingBooking[] = [];
      for (const svc of svcs) {
        if (!svc.canonicalServiceId) continue;
        const offerings = await getOfferingsByCanonical(svc.canonicalServiceId);
        const mine = offerings.filter((o) => o.providerActorId === actorId);
        for (const off of mine) {
          const avails = await listAvailabilities({
            ownerType: 'service_offering',
            ownerId: off.id,
            status: 'active',
          });
          for (const av of avails) {
            const bookings = await listBookings({ availabilityId: av.availabilityId, status: 'requested' });
            for (const b of bookings) {
              pendingRows.push({
                booking: b,
                serviceId: svc.serviceId,
                serviceName: svc.name,
                startDatetime: av.startDatetime,
                endDatetime: av.endDatetime,
              });
            }
          }
        }
      }
      setPending(pendingRows);

      // 3. Inbox de ORDER (ordem confirmada nasce aqui automaticamente — sourceId = service_order.id).
      const items = await getOrderInbox(actorId);
      setInbox(items.filter((i) => i.status !== 'archived'));
    } catch (err) {
      console.error('[ProviderServiceHub] erro ao carregar central do prestador:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível carregar a central do prestador. Tente atualizar.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeActor]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

  const goDecide = (row: PendingBooking) => {
    navigate(`/service-bookings/${row.booking.bookingId}/decision`, {
      state: {
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        requesterActorId: row.booking.requesterActorId,
        startDatetime: row.startDatetime,
        endDatetime: row.endDatetime,
      },
    });
  };

  if (!activeActor) {
    return (
      <div className="provider-hub-page">
        <h1>Central do prestador</h1>
        <p className="hub-empty">Escolha o perfil da empresa para operar como prestador.</p>
      </div>
    );
  }

  return (
    <div className="provider-hub-page">
      {/* Modo CONSUMINDO: a intenção natural é CONTRATAR — descoberta vem primeiro.
          A central do prestador continua logo abaixo (modo nunca esconde — D1). */}
      {mode === 'consumir' && (
        <div className="hub-mode-banner" role="note">
          <div>
            <strong>Você está consumindo.</strong> Procurando um serviço para contratar?
          </div>
          <button className="btn-primary" onClick={() => navigate('/discover/services')}>
            Buscar serviços
          </button>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>{mode === 'consumir' ? 'Serviços' : 'Central do prestador'}</h1>
          <p className="acting-as">
            {mode === 'consumir' ? 'Sua operação como prestador (abaixo): ' : 'Operando como: '}
            <strong>{activeActor.display_name}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={load} disabled={loading}>Atualizar</button>
          <button className="btn-primary" onClick={() => navigate('/services/new')}>Publicar serviço</button>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="hub-loading">Carregando…</p>}

      {/* Reservas pendentes (canônicas) — decidir → nasce a ordem */}
      <section className="hub-section">
        <h2>Reservas pendentes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="hub-empty">Nenhuma reserva aguardando decisão.</p>
        ) : (
          <ul className="pending-list">
            {pending.map((row) => (
              <li key={row.booking.bookingId} className="pending-row">
                <div className="pending-info">
                  <strong>{row.serviceName}</strong>
                  <span>{fmtDt(row.startDatetime)} → {fmtDt(row.endDatetime)}</span>
                  <span className="muted" title={row.booking.requesterActorId}>
                    solicitante: {shortId(row.booking.requesterActorId)}
                  </span>
                </div>
                <button className="btn-primary" onClick={() => goDecide(row)}>Decidir</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Inbox de ORDER — ordens nascidas */}
      <section className="hub-section">
        <div className="section-head">
          <h2>Caixa de entrada · Ordens ({inbox.length})</h2>
          <button className="btn-link" onClick={() => navigate('/service-orders')}>ver todas as ordens →</button>
        </div>
        {inbox.length === 0 ? (
          <p className="hub-empty">Nenhuma ordem nova.</p>
        ) : (
          <ul className="inbox-list">
            {inbox.map((item) => (
              <li key={item.inboxItemId} className={`inbox-row ${item.status === 'unread' ? 'unread' : ''}`}>
                <div className="inbox-info">
                  <strong>
                    Ordem de serviço confirmada
                    {item.status === 'unread' && <span className="badge-unread">novo</span>}
                  </strong>
                  <span className="muted">{fmtDt(item.createdAt)}</span>
                </div>
                <button className="btn-secondary" onClick={() => navigate(`/service-orders/${item.sourceId}`)}>
                  Abrir ordem
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Serviços publicados */}
      <section className="hub-section">
        <h2>Meus serviços ({services.length})</h2>
        {services.length === 0 ? (
          <p className="hub-empty">Você ainda não publicou serviços. Use “Publicar serviço”.</p>
        ) : (
          <ul className="services-list">
            {services.map((svc) => (
              <li key={svc.serviceId} className="service-row">
                <div className="service-info">
                  <strong>{svc.name}</strong>
                  <span className={`status-pill status-${svc.status}`}>{svc.status}</span>
                </div>
                {/* F-MVP-SERVICE-CHAIN-PROVIDER-SURFACE-CONSOLIDATION (2026-06-26): porta de
                    gestão por serviço — a árvore /services/:id (detalhe → disponibilidade →
                    reservas) é preservada como está, apenas alcançável daqui. */}
                <div className="service-row-actions">
                  <button className="btn-link" onClick={() => navigate(`/services/${svc.serviceId}`)}>
                    gerir →
                  </button>
                  <button className="btn-link" onClick={() => navigate(`/discover/services/${svc.serviceId}`)}>
                    ver vitrine →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-B): conceder a operadores acesso de LEITURA
          às ordens desta empresa (service_order:view, DECISION-0136). Escopo = actor ativo. Read-grant,
          money-free; o backend decide a autoridade (canRepresentActor). */}
      <OperatorGrantsManager scopeActorId={activeActor.actor_id} scopeActorName={activeActor.display_name} />
    </div>
  );
}

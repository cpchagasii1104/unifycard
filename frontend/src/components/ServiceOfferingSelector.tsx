// frontend/src/components/ServiceOfferingSelector.tsx
// B2 / F-OFFER-B2-FRONTEND-SERVICE-OFFERING-WIRING (jornada de serviço PRÉ-DINHEIRO na tela).
//
// Liga a jornada canônica já provada no backend (B1 e2e): discover → canonicalServiceId →
// by-canonical (ofertas ACTIVE) → availability(owner=service_offering) → booking 'requested' → confirm.
// Disciplina: frontend PROJETA verdade resolvida. requesterActorId vem do ACTOR ATIVO de sessão
// (waitForActorContext — mesmo do ActionContext que o apiFetch envia), NUNCA de input/hardcode; o backend
// liga actionContext===requester + canRepresentActor. confirm é OWNER-only (só ofertado se o actor ativo for
// o provider da oferta); o 409 BOOKING_PROVIDER_TIME_CONFLICT recebe UX honesta. SEM dinheiro/checkout.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOfferingsByCanonical, isProviderTimeConflict, type ServiceOffering } from '../api/offerings';
import { listAvailabilities, createBooking, confirmBooking, type UnifiedAvailability } from '../api/availability';
import { waitForActorContext } from '../api/client';

const fmtPrice = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

export default function ServiceOfferingSelector({
  canonicalServiceId,
  serviceId,
}: {
  canonicalServiceId: string;
  // serviceId do serviço em tela (DiscoveredService.serviceId). Transportado para o booking como
  // metadata.serviceId — é a HINT exigida por confirmBookingFromDecision p/ a reserva virar service_order
  // (o backend valida que o serviço pertence ao dono soberano da disponibilidade — DECISION-0113). Sem ele,
  // a reserva nasce mas NUNCA vira ordem. Opcional: discovery legado sem serviceId continua reservando.
  serviceId?: string | null;
}) {
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [selected, setSelected] = useState<ServiceOffering | null>(null);
  const [slots, setSlots] = useState<UnifiedAvailability[]>([]);
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Pós-reserva do cliente: oferece acompanhamento na área de ordens já existente.
  // NÃO cria ordem nem chama endpoint financeiro — só projeta um atalho de navegação honesto.
  const [booked, setBooked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [offs, actor] = await Promise.all([
          getOfferingsByCanonical(canonicalServiceId),
          waitForActorContext(),
        ]);
        if (!alive) return;
        setOfferings(offs);
        setActiveActorId(actor);
      } catch (e) {
        if (alive) setError((e as Error)?.message || 'Erro ao carregar ofertas');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [canonicalServiceId]);

  async function pickOffering(o: ServiceOffering) {
    setSelected(o);
    setSlots([]);
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const av = await listAvailabilities({ ownerType: 'service_offering', ownerId: o.id, status: 'active' });
      setSlots(av);
      if (av.length === 0) setNotice('Esta oferta ainda não tem horários disponíveis.');
    } catch (e) {
      setError((e as Error)?.message || 'Erro ao carregar disponibilidade');
    } finally {
      setBusy(false);
    }
  }

  async function book(slot: UnifiedAvailability) {
    if (!selected) return;
    if (!activeActorId) {
      setError('Sessão sem actor ativo — entre/escolha um perfil para reservar.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setBooked(false);
    try {
      const booking = await createBooking({
        availabilityId: slot.availabilityId,
        requesterActorId: activeActorId,
        // metadata.serviceId é a ponte reserva→ordem (confirmBookingFromDecision exige). Só envia se houver.
        ...(serviceId ? { metadata: { serviceId } } : {}),
      });
      // confirm é OWNER-only: só o provider da oferta confirma. Para o cliente, fica 'requested'.
      if (activeActorId === selected.providerActorId) {
        try {
          await confirmBooking(booking.bookingId);
          setNotice('Reserva confirmada.');
          setBooked(true);
        } catch (e) {
          if (isProviderTimeConflict(e)) {
            setError('Horário indisponível: já existe um compromisso confirmado deste prestador nesse intervalo.');
          } else {
            setError((e as Error)?.message || 'Erro ao confirmar reserva');
          }
        }
      } else {
        setNotice('Solicitação de reserva enviada — aguardando confirmação do prestador.');
        setBooked(true);
      }
    } catch (e) {
      if (isProviderTimeConflict(e)) {
        setError('Horário indisponível: conflito com outro compromisso deste prestador.');
      } else {
        setError((e as Error)?.message || 'Erro ao criar reserva');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="offering-selector">Carregando ofertas…</div>;
  if (offerings.length === 0) {
    return (
      <div className="offering-selector">
        <h2>Ofertas</h2>
        <p>{error || 'Nenhuma oferta ativa para este serviço ainda.'}</p>
      </div>
    );
  }

  return (
    <div className="offering-selector service-section">
      <h2>Ofertas disponíveis</h2>
      <ul className="offering-list">
        {offerings.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => pickOffering(o)} disabled={busy} aria-pressed={selected?.id === o.id}>
              {fmtPrice(o.priceCents)} · {o.durationMinutes} min{o.modality ? ` · ${o.modality}` : ''}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="offering-slots">
          <h3>Horários</h3>
          {slots.length === 0 ? (
            <p>{notice ?? 'Sem horários para esta oferta.'}</p>
          ) : (
            <ul>
              {slots.map((s) => (
                <li key={s.availabilityId}>
                  <button type="button" onClick={() => book(s)} disabled={busy}>
                    {fmtDt(s.startDatetime)} → {fmtDt(s.endDatetime)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {notice && <p role="status" className="offering-notice">{notice}</p>}
      {booked && (
        <button type="button" className="offering-track-cta" onClick={() => navigate('/service-orders')}>
          Acompanhar pedido
        </button>
      )}
      {error && <p role="alert" className="offering-error">{error}</p>}
    </div>
  );
}

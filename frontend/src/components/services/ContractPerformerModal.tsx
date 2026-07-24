// frontend/src/components/services/ContractPerformerModal.tsx
// 🔴 FATIA 3B — CONTRATAR: última costura da jornada do organizador. Da descoberta, o organizador
// propõe uma reserva na oferta do performer (janela + formação opcional), amarrada a um evento SEU,
// e vê o resultado HONESTO do backend:
//   · confirmed + autoConfirmed → fechado na hora (aceita-direto within-reach) + prova do elenco
//     (BIND on-confirm C3 EDGE C-2 em event_staff, lido via GET /api/events/:id/v2/commitments);
//   · requested → proposta enviada, aguardando a banda (negociação) — com o motivo do gate.
// DISCIPLINA: frontend NUNCA cria verdade — modo/gate/autoridade são decididos server-side
// (POST /services/offerings/:offeringId/bookings, C3). O fluxo LEGADO do ServiceOfferingSelector
// (createBooking/confirmBooking core) fica INTOCADO — convergência é frente futura.
// Bank-free: 'confirmed' = compromisso de agenda; nenhum movimento de dinheiro.

import { useEffect, useMemo, useState } from 'react';
import {
  getOfferingsByCanonical,
  listOfferingConfigs,
  requestOfferingBooking,
  type OfferingBookingResult,
  type OfferingConfig,
  type ServiceOffering,
} from '../../api/offerings';
import { listAvailabilities, type UnifiedAvailability } from '../../api/availability';
import { getCommitments } from '../../api/commitments';
import { listEventCommitmentsV2, type EventCommitmentView } from '../../api/events';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../common/Toast';
import './ContractPerformerModal.css';

interface ContractPerformerModalProps {
  canonicalServiceId: string;
  serviceName: string;
  /** Evento pré-selecionado via navegação (?eventId= vindo do painel do organizador). */
  preselectedEventId?: string | null;
  onClose: () => void;
}

interface MyEventOption {
  eventId: string;
  title: string;
  startTime?: string | null;
}

const fmtPrice = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

// De-para dos códigos do backend → pt-BR amigável. O backend é a autoridade; aqui só se traduz.
const BOOKING_ERROR_MESSAGES: Array<[string, string]> = [
  ['BOOKING_PROVIDER_TIME_CONFLICT', 'Horário já ocupado: existe outro compromisso confirmado desta banda/prestador nesse intervalo.'],
  ['SERVICE_OFFERING_CONFIG_MISMATCH', 'A formação escolhida não pertence a esta oferta — recarregue e tente de novo.'],
  ['SERVICE_OFFERING_EVENT_NOT_MANAGEABLE', 'Você não tem autoridade de organizador (manage_attendees) sobre o evento escolhido.'],
  ['SERVICE_OFFERING_EVENT_NOT_FOUND', 'O evento escolhido não foi encontrado.'],
  ['SERVICE_OFFERING_AVAILABILITY_MISMATCH', 'A janela escolhida não pertence a esta oferta.'],
  ['SERVICE_OFFERING_NOT_BOOKABLE', 'Esta oferta está indisponível/não-ativa no momento.'],
  ['SERVICE_OFFERING_BOOK_NOT_REPRESENTABLE', 'Sua sessão não tem autoridade sobre o perfil ativo para contratar.'],
  ['SERVICE_OFFERING_BAD_REQUEST', 'Proposta incompleta — escolha uma janela de horário.'],
];

function friendlyBookingError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const raw = `${e?.code ?? ''} ${e?.message ?? ''}`;
  for (const [token, msg] of BOOKING_ERROR_MESSAGES) {
    if (raw.includes(token)) return msg;
  }
  return e?.message || 'Erro ao enviar a proposta de contratação.';
}

// gateReason vem do backend (isWithinContractingReach / modo manual). Tradução honesta, sem inventar.
function friendlyGateReason(reason: string): string | null {
  if (!reason) return null;
  if (reason === 'manual') return 'Esta banda/prestador analisa cada proposta manualmente.';
  if (reason === 'same_city') return 'Aceite direto: vocês estão na mesma cidade.';
  if (reason.startsWith('radius_ok')) return `Aceite direto: dentro do raio de contratação (${reason}).`;
  if (reason.startsWith('radius_exceeded')) return `Fora do raio de aceite direto do prestador (${reason}) — vai para negociação.`;
  if (reason === 'location_absent') return 'Localização ausente de um dos lados — a proposta vai para negociação.';
  if (reason === 'no_condition' || reason === 'not_within_reach') return 'Sem condição de aceite direto atendida — a proposta vai para negociação.';
  return reason;
}

export default function ContractPerformerModal({
  canonicalServiceId,
  serviceName,
  preselectedEventId,
  onClose,
}: ContractPerformerModalProps) {
  const { activeActor } = useActiveActor();

  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState<ServiceOffering | null>(null);
  const [slots, setSlots] = useState<UnifiedAvailability[]>([]);
  const [configs, setConfigs] = useState<OfferingConfig[]>([]);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [myEvents, setMyEvents] = useState<MyEventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(preselectedEventId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OfferingBookingResult | null>(null);
  const [elencoRow, setElencoRow] = useState<EventCommitmentView | null>(null);
  const [elencoChecked, setElencoChecked] = useState(false);

  // Carga inicial: ofertas ATIVAS do serviço canônico + "meus eventos" (eventsOrganizing do painel
  // de compromissos — eventos da tabela canônica `events` criados pelo usuário logado).
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const offs = await getOfferingsByCanonical(canonicalServiceId);
        if (!alive) return;
        setOfferings(offs);
        if (offs.length === 1) void pickOffering(offs[0]);
      } catch (e) {
        if (alive) showToast((e as Error)?.message || 'Erro ao carregar ofertas.', 'error');
      } finally {
        if (alive) setLoading(false);
      }
      try {
        const c = await getCommitments();
        if (!alive) return;
        const evs: MyEventOption[] = (c.eventsOrganizing || []).map((e) => ({
          eventId: e.eventId,
          title: e.title,
          startTime: e.startTime,
        }));
        setMyEvents(evs);
      } catch {
        // Fonte de "meus eventos" indisponível: o dropdown fica só com o pré-selecionado (se houver).
        if (alive) setMyEvents([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalServiceId]);

  async function pickOffering(o: ServiceOffering) {
    setSelectedOffering(o);
    setSelectedSlotId('');
    setSelectedConfigId('');
    setSlots([]);
    setConfigs([]);
    setLoadingOffering(true);
    try {
      // Janelas REAIS da oferta: eixo soberano owner_type='service_offering' (mesma fonte do selector).
      const [av, cfgs] = await Promise.all([
        listAvailabilities({ ownerType: 'service_offering', ownerId: o.id, status: 'active' }),
        listOfferingConfigs(o.id).catch(() => [] as OfferingConfig[]),
      ]);
      setSlots(av);
      setConfigs(cfgs);
    } catch (e) {
      showToast((e as Error)?.message || 'Erro ao carregar horários da oferta.', 'error');
    } finally {
      setLoadingOffering(false);
    }
  }

  // Dropdown de eventos: eventsOrganizing + (se veio por link e não está na lista) o pré-selecionado.
  const eventOptions = useMemo<MyEventOption[]>(() => {
    const opts = [...myEvents];
    if (preselectedEventId && !opts.some((e) => e.eventId === preselectedEventId)) {
      opts.unshift({ eventId: preselectedEventId, title: 'Evento selecionado (via link)' });
    }
    return opts;
  }, [myEvents, preselectedEventId]);

  async function handleSubmit() {
    if (!selectedOffering) { showToast('Escolha uma oferta.', 'error'); return; }
    if (!selectedSlotId) { showToast('Escolha uma janela de horário.', 'error'); return; }
    if (!activeActor?.actor_id) {
      showToast('Sessão sem perfil ativo — escolha um perfil para contratar.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // Body keys EXATAS do bookingSchema do backend: availabilityId, requesterActorId, eventId?, configId?
      const res = await requestOfferingBooking(selectedOffering.id, {
        availabilityId: selectedSlotId,
        requesterActorId: activeActor.actor_id,
        ...(selectedEventId ? { eventId: selectedEventId } : {}),
        ...(selectedConfigId ? { configId: selectedConfigId } : {}),
      });
      setResult(res);
      // Prova do elenco: se confirmou COM evento, lê event_staff pela rota v2 (BIND on-confirm C-2).
      if (res.status === 'confirmed' && selectedEventId) {
        try {
          const commitments = await listEventCommitmentsV2(selectedEventId);
          const row = commitments.find(
            (c) => c.responsibleActorId === selectedOffering.providerActorId && c.role === 'artist'
          ) ?? null;
          setElencoRow(row);
        } catch {
          setElencoRow(null);
        } finally {
          setElencoChecked(true);
        }
      }
    } catch (e) {
      showToast(friendlyBookingError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSlot = slots.find((s) => s.availabilityId === selectedSlotId) ?? null;

  return (
    <div className="contract-modal-overlay" role="dialog" aria-modal="true" aria-label={`Contratar ${serviceName}`}>
      <div className="contract-modal">
        <div className="contract-modal-header">
          <h2>Contratar · {serviceName}</h2>
          <button type="button" className="contract-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {result ? (
          /* ── RESULTADO (verdade resolvida do backend) ── */
          <div className="contract-result">
            {result.status === 'confirmed' ? (
              <>
                <p className="contract-result-headline contract-result-ok">
                  ✅ Fechado! Reserva confirmada na hora.
                </p>
                {selectedSlot && (
                  <p className="contract-result-line">
                    {fmtDt(selectedSlot.startDatetime)} → {fmtDt(selectedSlot.endDatetime)}
                  </p>
                )}
                {friendlyGateReason(result.gateReason) && (
                  <p className="contract-result-line contract-result-muted">{friendlyGateReason(result.gateReason)}</p>
                )}
                {selectedEventId && elencoChecked && (
                  elencoRow ? (
                    <p className="contract-result-line contract-result-ok">
                      🎤 Banda no elenco do evento ✓ (papel: {elencoRow.role} · status: {elencoRow.status})
                    </p>
                  ) : (
                    <p className="contract-result-line contract-result-muted">
                      Reserva confirmada; o vínculo de elenco não pôde ser lido agora — confira na página do evento.
                    </p>
                  )
                )}
              </>
            ) : (
              <>
                <p className="contract-result-headline contract-result-wait">
                  ⏳ Proposta enviada — aguardando a banda/prestador (negociação).
                </p>
                {selectedSlot && (
                  <p className="contract-result-line">
                    {fmtDt(selectedSlot.startDatetime)} → {fmtDt(selectedSlot.endDatetime)}
                  </p>
                )}
                {friendlyGateReason(result.gateReason) && (
                  <p className="contract-result-line contract-result-muted">{friendlyGateReason(result.gateReason)}</p>
                )}
              </>
            )}
            <div className="contract-modal-actions">
              <button type="button" className="contract-btn contract-btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : loading ? (
          <p className="contract-modal-loading">Carregando ofertas…</p>
        ) : offerings.length === 0 ? (
          <div className="contract-result">
            <p>Este serviço ainda não tem oferta contratável ativa.</p>
            <div className="contract-modal-actions">
              <button type="button" className="contract-btn" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : (
          <div className="contract-form">
            {/* 1. Oferta */}
            <div className="contract-step">
              <h3>1. Oferta</h3>
              <ul className="contract-offering-list">
                {offerings.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`contract-offering-item${selectedOffering?.id === o.id ? ' is-selected' : ''}`}
                      onClick={() => pickOffering(o)}
                      disabled={submitting}
                      aria-pressed={selectedOffering?.id === o.id}
                    >
                      {fmtPrice(o.priceCents)} · {o.durationMinutes} min
                      {o.bookingApprovalMode === 'automatic' ? ' · aceita-direto' : ' · negocia'}
                      {o.audienceMin != null && o.audienceMax != null ? ` · público ${o.audienceMin}–${o.audienceMax}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {selectedOffering && (
              <>
                {/* 2. Formação (opcional) */}
                <div className="contract-step">
                  <h3>2. Formação (opcional)</h3>
                  {loadingOffering ? (
                    <p className="contract-modal-loading">Carregando…</p>
                  ) : configs.length === 0 ? (
                    <p className="contract-hint">Esta oferta não tem formações cadastradas.</p>
                  ) : (
                    <select
                      className="contract-select"
                      value={selectedConfigId}
                      onChange={(e) => setSelectedConfigId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">— sem formação específica —</option>
                      {configs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} · {c.teamSize} integrante(s)
                          {c.status === 'sob_consulta' ? ' · sob consulta' : ''}
                          {c.defaultPriceCents != null ? ` · a partir de ${fmtPrice(c.defaultPriceCents)}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 3. Horário */}
                <div className="contract-step">
                  <h3>3. Janela de horário</h3>
                  {loadingOffering ? (
                    <p className="contract-modal-loading">Carregando…</p>
                  ) : slots.length === 0 ? (
                    <p className="contract-hint">Esta oferta ainda não tem janelas de disponibilidade.</p>
                  ) : (
                    <ul className="contract-slot-list">
                      {slots.map((s) => (
                        <li key={s.availabilityId}>
                          <label className="contract-slot-item">
                            <input
                              type="radio"
                              name="contract-slot"
                              value={s.availabilityId}
                              checked={selectedSlotId === s.availabilityId}
                              onChange={() => setSelectedSlotId(s.availabilityId)}
                              disabled={submitting}
                            />
                            <span>{fmtDt(s.startDatetime)} → {fmtDt(s.endDatetime)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 4. Evento */}
                <div className="contract-step">
                  <h3>4. Para qual evento?</h3>
                  {eventOptions.length === 0 ? (
                    <p className="contract-hint">
                      Você ainda não organiza nenhum evento — a proposta segue sem vínculo de evento
                      (o vínculo de elenco exige um evento seu).
                    </p>
                  ) : (
                    <select
                      className="contract-select"
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">— sem vínculo de evento —</option>
                      {eventOptions.map((ev) => (
                        <option key={ev.eventId} value={ev.eventId}>
                          {ev.title}{ev.startTime ? ` · ${fmtDt(ev.startTime)}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="contract-modal-actions">
                  <button type="button" className="contract-btn" onClick={onClose} disabled={submitting}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="contract-btn contract-btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedSlotId}
                  >
                    {submitting ? 'Enviando…' : 'Enviar proposta de contratação'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

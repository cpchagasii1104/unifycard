// src/pages/ServiceBookingDecisionPage.tsx
// GAP-2 / F-MVP-SERVICE-CHAIN-FRONTEND-WIRING (Opção A).
// O MEMBRO operando-como-a-empresa decide uma reserva (aceitar/recusar) pelo fluxo CANÔNICO:
//   accept  → createBookingDecision(ACCEPTED) → confirmBookingFromDecision → nasce service_order (+inbox auto).
//   reject  → createBookingDecision(REJECTED) (não nasce ordem).
// Disciplina: decidedByActorId = ACTOR ATIVO (não input). O backend exige representar o dono soberano da
// disponibilidade. serviceId chega por nav-state (a Central do prestador conhece a oferta→serviço). SEM dinheiro.
// POST /service-orders direto continua 403 — a ordem nasce SÓ por este caminho de confirmação.

import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import { createBookingDecision } from '../api/service-booking-decisions';
import { confirmBookingFromDecision } from '../api/service-orders';
import { shortId } from '../utils/service-orders-helpers';
import './ServiceBookingDecisionPage.css';

interface DecisionNavState {
  serviceId?: string;
  serviceName?: string;
  requesterActorId?: string;
  startDatetime?: string;
  endDatetime?: string;
}

export default function ServiceBookingDecisionPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const nav = (location.state as DecisionNavState) || {};

  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deep-link sem contexto: a decisão depende do serviço da reserva, que a Central do
  // prestador conhece (nav-state). Sem ele NÃO resolvemos autoridade pela URL — orientamos
  // o usuário gentilmente de volta à Central, onde a reserva é aberta com contexto.
  const missingContext = !nav.serviceId;

  const fmtDt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : null);

  const guard = (): { serviceId: string; actorId: string } | null => {
    setError(null);
    if (!activeActor) {
      setError('Sessão sem actor ativo — escolha o perfil da empresa para decidir.');
      return null;
    }
    if (!bookingId) {
      setError('Reserva não identificada.');
      return null;
    }
    if (!nav.serviceId) {
      setError('Para decidir, abra a reserva pela Central do prestador — assim trazemos o serviço vinculado.');
      return null;
    }
    return { serviceId: nav.serviceId, actorId: activeActor.actor_id };
  };

  const handleAccept = async () => {
    const g = guard();
    if (!g || !bookingId) return;
    setBusy('accept');
    try {
      const decision = await createBookingDecision(g.serviceId, bookingId, {
        bookingId,
        decidedByActorId: g.actorId,
        status: 'accepted',
      });
      const order = await confirmBookingFromDecision(bookingId, decision.decisionId);
      showToast('Reserva aceita — ordem de serviço criada.', 'success');
      const orderId = (order as { id?: string })?.id;
      navigate(orderId ? `/service-orders/${orderId}` : '/service-orders');
    } catch (err) {
      console.error('[BookingDecision] erro ao aceitar reserva:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível aceitar a reserva. Tente novamente.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    const g = guard();
    if (!g || !bookingId) return;
    setBusy('reject');
    try {
      await createBookingDecision(g.serviceId, bookingId, {
        bookingId,
        decidedByActorId: g.actorId,
        status: 'rejected',
        reason: reason.trim() || undefined,
      });
      showToast('Reserva recusada.', 'info');
      navigate('/provider/services');
    } catch (err) {
      console.error('[BookingDecision] erro ao recusar reserva:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível recusar a reserva. Tente novamente.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="booking-decision-page">
      <div className="page-header">
        <h1>Decisão da reserva</h1>
        <button className="btn-secondary" onClick={() => navigate('/provider/services')}>
          Voltar
        </button>
      </div>

      <p className="acting-as">
        Decidindo como: <strong>{activeActor ? activeActor.display_name : '— sem perfil —'}</strong>
      </p>

      {missingContext ? (
        <div className="deep-link-notice" role="status">
          <p>
            Esta decisão precisa ser aberta pela <strong>Central do prestador</strong> — é lá que a
            reserva carrega o serviço vinculado. Abra a reserva por lá para aceitar ou recusar.
          </p>
          <button className="btn-primary" onClick={() => navigate('/provider/services')}>
            Ir para a Central do prestador
          </button>
        </div>
      ) : (
        <>
          <div className="booking-card">
            <div>
              <strong>Reserva:</strong>{' '}
              <span title={bookingId}>{shortId(bookingId)}</span>
            </div>
            {nav.serviceName && <div><strong>Serviço:</strong> {nav.serviceName}</div>}
            {nav.requesterActorId && (
              <div>
                <strong>Solicitante:</strong>{' '}
                <span title={nav.requesterActorId}>{shortId(nav.requesterActorId)}</span>
              </div>
            )}
            {fmtDt(nav.startDatetime) && (
              <div><strong>Horário:</strong> {fmtDt(nav.startDatetime)}{nav.endDatetime ? ` → ${fmtDt(nav.endDatetime)}` : ''}</div>
            )}
          </div>

          <label className="reject-reason">
            Motivo (opcional, usado se recusar)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="decision-actions">
            <button className="btn-accept" onClick={handleAccept} disabled={busy !== null}>
              {busy === 'accept' ? 'Aceitando…' : 'Aceitar e criar ordem'}
            </button>
            <button className="btn-reject" onClick={handleReject} disabled={busy !== null}>
              {busy === 'reject' ? 'Recusando…' : 'Recusar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

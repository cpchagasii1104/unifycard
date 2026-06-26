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
      setError('Abra esta decisão pela Central do prestador (serviço da reserva não informado).');
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
      const message = err instanceof Error ? err.message : 'Erro ao aceitar reserva';
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
      const message = err instanceof Error ? err.message : 'Erro ao recusar reserva';
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

      <div className="booking-card">
        <div><strong>Reserva:</strong> {bookingId}</div>
        {nav.serviceName && <div><strong>Serviço:</strong> {nav.serviceName}</div>}
        {nav.requesterActorId && <div><strong>Solicitante:</strong> {nav.requesterActorId}</div>}
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
    </div>
  );
}

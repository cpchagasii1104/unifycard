// src/pages/RentalResourceDetailPage.tsx
// F-RENTAL-RESOURCE-SURFACE-SLICE-B — detalhe de UM recurso. Duas vistas condicionadas por
// ownerActorId === activeActor.actor_id (hint de APRESENTAÇÃO apenas — a autoridade real é sempre
// revalidada no backend via canRepresentActor; se o front errar o hint, o backend recusa a ação):
//   DONO: declarar janelas de disponibilidade (createAvailability, rota já existente) + ver/confirmar
//         reservas pendentes (listBookings/confirmBooking, rotas já existentes) + mudar status.
//   VISITANTE (chegou via link direto — sem vitrine/discovery, freio doutrinário respeitado):
//         ver janelas disponíveis e solicitar reserva (createBooking, rota já existente).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import { getRentableResource, updateRentableResourceStatus, type RentableResource, type RentableResourceStatus } from '../api/rentals';
import { listAvailabilities, createAvailability, listBookings, createBooking, confirmBooking, type UnifiedAvailability, type UnifiedBooking } from '../api/availability';
import './RentalResourceDetailPage.css';

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  equipment: 'Equipamento', vehicle: 'Veículo', property: 'Imóvel', space: 'Espaço',
};
const STATUS_LABEL: Record<string, string> = { active: 'Ativo', paused: 'Pausado', retired: 'Aposentado' };

interface WindowWithBookings {
  availability: UnifiedAvailability;
  bookings: UnifiedBooking[];
}

export default function RentalResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  const [resource, setResource] = useState<RentableResource | null>(null);
  const [windows, setWindows] = useState<WindowWithBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [submittingWindow, setSubmittingWindow] = useState(false);

  const isOwner = !!activeActor && !!resource && resource.ownerActorId === activeActor.actor_id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getRentableResource(id);
      setResource(r);
      const avails = await listAvailabilities({ ownerType: 'rentable_resource', ownerId: id });
      const withBookings = await Promise.all(
        avails.map(async (a) => ({ availability: a, bookings: await listBookings({ availabilityId: a.availabilityId }) }))
      );
      // mais recentes primeiro
      withBookings.sort((a, b) => new Date(b.availability.startDatetime).getTime() - new Date(a.availability.startDatetime).getTime());
      setWindows(withBookings);
    } catch (err: any) {
      setError(err?.message || 'Recurso não encontrado');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeclareWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !startAt || !endAt) {
      showToast('Informe início e fim da janela.', 'error');
      return;
    }
    const startIso = new Date(startAt).toISOString();
    const endIso = new Date(endAt).toISOString();
    if (new Date(endIso) <= new Date(startIso)) {
      showToast('O fim deve ser depois do início.', 'error');
      return;
    }
    setSubmittingWindow(true);
    try {
      await createAvailability({ ownerType: 'rentable_resource', ownerId: id, startDatetime: startIso, endDatetime: endIso });
      showToast('Janela de disponibilidade criada.', 'success');
      setStartAt('');
      setEndAt('');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar janela', 'error');
    } finally {
      setSubmittingWindow(false);
    }
  };

  const handleConfirm = async (bookingId: string) => {
    try {
      await confirmBooking(bookingId);
      showToast('Reserva confirmada.', 'success');
      await load();
    } catch (err: any) {
      // RENTAL_RESOURCE_TIME_CONFLICT chega aqui se outra reserva já ocupou o intervalo
      showToast(err?.message || 'Erro ao confirmar reserva', 'error');
    }
  };

  const handleRequestBooking = async (availabilityId: string) => {
    if (!activeActor) return;
    try {
      await createBooking({ availabilityId, requesterActorId: activeActor.actor_id });
      showToast('Reserva solicitada. Aguarde a confirmação do dono do recurso.', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao solicitar reserva', 'error');
    }
  };

  const handleStatusChange = async (status: RentableResourceStatus) => {
    if (!id) return;
    try {
      await updateRentableResourceStatus(id, status);
      showToast('Status atualizado.', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar status', 'error');
    }
  };

  if (loading) return <div className="rrd-page"><p>Carregando…</p></div>;
  if (error || !resource) return <div className="rrd-page"><p className="rrd-error">{error || 'Recurso não encontrado'}</p></div>;

  return (
    <div className="rrd-page">
      <button type="button" className="rrd-back" onClick={() => navigate('/locacoes')}>← Meus recursos</button>

      <div className="rrd-header">
        <div>
          <span className={`rrd-status-badge rrd-status-${resource.status}`}>{STATUS_LABEL[resource.status]}</span>
          <h1 className="rrd-title">{resource.label}</h1>
          <p className="rrd-subtitle">{RESOURCE_TYPE_LABEL[resource.resourceType]}{resource.description ? ` · ${resource.description}` : ''}</p>
        </div>
        {isOwner && (
          <div className="rrd-status-actions">
            {(['active', 'paused', 'retired'] as RentableResourceStatus[]).map((s) => (
              <button key={s} type="button" disabled={resource.status === s} onClick={() => handleStatusChange(s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <section className="rrd-section">
          <h2>Declarar disponibilidade</h2>
          <form className="rrd-window-form" onSubmit={handleDeclareWindow}>
            <label>Início <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
            <label>Fim <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
            <button type="submit" disabled={submittingWindow}>{submittingWindow ? 'Criando…' : 'Criar janela'}</button>
          </form>
        </section>
      )}

      <section className="rrd-section">
        <h2>{isOwner ? 'Janelas e reservas' : 'Disponibilidade'}</h2>
        {windows.length === 0 && <p className="rrd-status-text">Nenhuma janela de disponibilidade ainda.</p>}
        <div className="rrd-windows">
          {windows.map(({ availability, bookings }) => {
            const activeBooking = bookings.find((b) => b.status === 'confirmed');
            const requestedBookings = bookings.filter((b) => b.status === 'requested');
            const isMine = activeActor && bookings.some((b) => b.requesterActorId === activeActor.actor_id && b.status !== 'cancelled' && b.status !== 'expired');
            return (
              <div key={availability.availabilityId} className="rrd-window-card">
                <span className="rrd-window-range">
                  {new Date(availability.startDatetime).toLocaleString('pt-BR')} — {new Date(availability.endDatetime).toLocaleString('pt-BR')}
                </span>
                {activeBooking && <span className="rrd-window-tag rrd-tag-confirmed">Reservado</span>}
                {!activeBooking && requestedBookings.length > 0 && <span className="rrd-window-tag rrd-tag-requested">{requestedBookings.length} solicitação(ões)</span>}
                {!activeBooking && requestedBookings.length === 0 && <span className="rrd-window-tag rrd-tag-open">Disponível</span>}

                {isOwner && requestedBookings.map((b) => (
                  <div key={b.bookingId} className="rrd-booking-row">
                    <span>Solicitado em {new Date(b.requestedAt).toLocaleDateString('pt-BR')}</span>
                    <button type="button" onClick={() => handleConfirm(b.bookingId)}>Confirmar</button>
                  </div>
                ))}

                {!isOwner && !activeBooking && requestedBookings.length === 0 && (
                  <button type="button" className="rrd-request-btn" onClick={() => handleRequestBooking(availability.availabilityId)}>
                    Solicitar reserva
                  </button>
                )}
                {!isOwner && isMine && !activeBooking && (
                  <span className="rrd-window-tag rrd-tag-requested">Sua solicitação aguarda confirmação</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

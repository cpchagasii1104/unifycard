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
import { getRentableResource, updateRentableResourceStatus, getResourcePublicAvailability, getRentalOfferDetail, requestResourceBooking, PRICING_UNIT_PT, type RentableResource, type RentableResourceStatus, type RentalOfferDetail } from '../api/rentals';
import { listAvailabilities, createAvailability, updateAvailability, deleteAvailability, listBookings, confirmBooking, type UnifiedAvailability, type UnifiedBooking } from '../api/availability';
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
  const [offer, setOffer] = useState<RentalOfferDetail | null>(null);
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
      // Oferta (faixas de preço + cidade do dono = local de retirada/devolução). Não crítico: se falhar,
      // a tela ainda funciona. O consumidor precisa ver por quanto e onde antes de solicitar.
      getRentalOfferDetail(id).then(setOffer).catch(() => setOffer(null));
      const viewerIsOwner = !!activeActor && r.ownerActorId === activeActor.actor_id;
      if (viewerIsOwner) {
        // DONO: agenda operacional privada (janelas + reservas pendentes para confirmar).
        const avails = await listAvailabilities({ ownerType: 'rentable_resource', ownerId: id });
        const withBookings = await Promise.all(
          avails.map(async (a) => ({ availability: a, bookings: await listBookings({ availabilityId: a.availabilityId }) }))
        );
        withBookings.sort((a, b) => new Date(b.availability.startDatetime).getTime() - new Date(a.availability.startDatetime).getTime());
        setWindows(withBookings);
      } else {
        // VISITANTE (chegou pela busca/descoberta): só as janelas PÚBLICAS do recurso, sem ver reservas
        // de terceiros. O backend só expõe se o recurso é público. Ele pode solicitar reserva.
        const publicWindows = await getResourcePublicAvailability(id);
        const mapped: WindowWithBookings[] = publicWindows
          .map((w) => ({ availability: { availabilityId: w.availabilityId, ownerType: 'rentable_resource', ownerId: id, startDatetime: w.startDatetime, endDatetime: w.endDatetime, status: 'active' } as unknown as UnifiedAvailability, bookings: [] }))
          .sort((a, b) => new Date(b.availability.startDatetime).getTime() - new Date(a.availability.startDatetime).getTime());
        setWindows(mapped);
      }
    } catch (err: any) {
      setError(err?.message || 'Recurso não encontrado');
    } finally {
      setLoading(false);
    }
  }, [id, activeActor]);

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

  const handleRequestBooking = async (availabilityId: string, startAt?: string, endAt?: string) => {
    if (!activeActor || !id) return;
    try {
      // O modo (auto/manual) é do DONO, decidido no backend — a tela só projeta o resultado.
      // startAt/endAt = subperíodo escolhido (locação por período); backend valida ⊆ janela.
      const result = await requestResourceBooking(id, availabilityId, startAt, endAt);
      showToast(
        result.autoConfirmed
          ? '✅ Reserva confirmada na hora! (o dono habilitou reserva automática)'
          : 'Reserva solicitada. Aguarde a confirmação do dono do recurso.',
        'success');
      await load();
    } catch (err: any) {
      const msg = String(err?.message || '');
      const friendly = msg.includes('TIME_CONFLICT') ? 'Este período acabou de ser reservado por outra pessoa. Escolha outro.'
        : msg.includes('OUT_OF_WINDOW') ? 'O período escolhido está fora da janela de disponibilidade. Ajuste as datas.'
        : msg.includes('PERIOD_INVALID') ? 'A data de fim precisa ser depois da de início.'
        : (msg || 'Erro ao solicitar reserva');
      showToast(friendly, 'error');
    }
  };

  // Subperíodo escolhido por janela (locação por período). Chave = availabilityId.
  const [pickStart, setPickStart] = useState<Record<string, string>>({});
  const [pickEnd, setPickEnd] = useState<Record<string, string>>({});

  // Editar/excluir janela (dono). datetime-local ISO (sem TZ) → o backend valida overlap e autoridade.
  const [editWinId, setEditWinId] = useState<string | null>(null);
  const [editWinStart, setEditWinStart] = useState('');
  const [editWinEnd, setEditWinEnd] = useState('');
  const [winBusy, setWinBusy] = useState(false);

  const openEditWindow = (w: UnifiedAvailability) => {
    const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    setEditWinStart(toLocal(w.startDatetime)); setEditWinEnd(toLocal(w.endDatetime)); setEditWinId(w.availabilityId);
  };
  const saveEditWindow = async (availabilityId: string) => {
    if (!editWinStart || !editWinEnd) { showToast('Informe início e fim.', 'error'); return; }
    setWinBusy(true);
    try {
      await updateAvailability(availabilityId, { startDatetime: new Date(editWinStart).toISOString(), endDatetime: new Date(editWinEnd).toISOString() });
      showToast('Janela atualizada. ✅', 'success');
      setEditWinId(null); await load();
    } catch (err: any) {
      const msg = String(err?.message || '');
      showToast(msg.includes('OVERLAP') ? 'A janela editada conflita com outra já cadastrada. Ajuste o período.' : (msg || 'Erro ao editar janela'), 'error');
    } finally { setWinBusy(false); }
  };
  const handleDeleteWindow = async (availabilityId: string) => {
    if (!window.confirm('Excluir esta janela de disponibilidade?')) return;
    try {
      await deleteAvailability(availabilityId);
      showToast('Janela excluída.', 'success');
      await load();
    } catch (err: any) {
      const msg = String(err?.message || '');
      showToast(msg.includes('ACTIVE_BOOKING') ? 'Esta janela tem reserva ativa e não pode ser excluída.' : (msg || 'Erro ao excluir'), 'error');
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
      <button type="button" className="rrd-back" onClick={() => navigate(isOwner ? '/locacoes' : -1 as any)}>← {isOwner ? 'Meus recursos' : 'Voltar'}</button>

      <div className="rrd-header">
        <div>
          <span className={`rrd-status-badge rrd-status-${resource.status}`}>{STATUS_LABEL[resource.status]}</span>
          <h1 className="rrd-title">{resource.label}</h1>
          <p className="rrd-subtitle">{RESOURCE_TYPE_LABEL[resource.resourceType]}{resource.description ? ` · ${resource.description}` : ''}</p>
          {/* Local (cidade do dono = retirada/devolução) + preço anunciado — o consumidor decide informado. */}
          {offer?.city && <p className="rrd-meta">📍 Retirada e devolução em {offer.city.name}{offer.city.uf ? `/${offer.city.uf}` : ''}</p>}
          {offer && offer.pricingTiers.length > 0 && (
            <p className="rrd-price">{offer.pricingTiers.map((t) => `${PRICING_UNIT_PT[t.unit]}: R$ ${(t.priceCents / 100).toFixed(2).replace('.', ',')}`).join(' · ')}</p>
          )}
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
        <h2>{isOwner ? 'Janelas e reservas' : 'Escolha um período disponível'}</h2>
        {windows.length === 0 && (
          isOwner
            ? <p className="rrd-status-text">Nenhuma janela de disponibilidade ainda. Crie uma acima para o recurso aparecer na busca.</p>
            : <div className="rrd-empty-visitor">
                <p>Este recurso ainda não tem datas publicadas pelo dono. Sem disponibilidade aberta, não é possível solicitar a locação agora.</p>
                <button type="button" className="rrd-request-btn" onClick={() => navigate(-1)}>← Ver outros recursos</button>
              </div>
        )}
        {!isOwner && windows.length > 0 && (
          <p className="rrd-hint-visitor">
            {resource.bookingApprovalMode === 'automatic'
              ? '⚡ Reserva instantânea: ao escolher uma janela, a reserva já fica confirmada. O pagamento não acontece agora.'
              : '💡 Escolha uma janela e solicite. É um pedido — o dono confirma a reserva. O pagamento não acontece agora.'}
          </p>
        )}
        <div className="rrd-windows">
          {windows.map(({ availability, bookings }) => {
            const activeBooking = bookings.find((b) => b.status === 'confirmed');
            const requestedBookings = bookings.filter((b) => b.status === 'requested');
            const isMine = activeActor && bookings.some((b) => b.requesterActorId === activeActor.actor_id && b.status !== 'cancelled' && b.status !== 'expired');
            return (
              <div key={availability.availabilityId} className="rrd-window-card">
                <div className="rrd-window-head">
                  <span className="rrd-window-range">
                    {new Date(availability.startDatetime).toLocaleString('pt-BR')} — {new Date(availability.endDatetime).toLocaleString('pt-BR')}
                  </span>
                  {isOwner && !activeBooking && requestedBookings.length === 0 && (
                    <div className="rrd-window-tools">
                      <button type="button" title="Editar janela" aria-label="Editar janela" onClick={() => (editWinId === availability.availabilityId ? setEditWinId(null) : openEditWindow(availability))}>✏️</button>
                      <button type="button" title="Excluir janela" aria-label="Excluir janela" onClick={() => handleDeleteWindow(availability.availabilityId)}>🗑️</button>
                    </div>
                  )}
                </div>
                {activeBooking && <span className="rrd-window-tag rrd-tag-confirmed">Reservado</span>}
                {!activeBooking && requestedBookings.length > 0 && <span className="rrd-window-tag rrd-tag-requested">{requestedBookings.length} solicitação(ões)</span>}
                {!activeBooking && requestedBookings.length === 0 && editWinId !== availability.availabilityId && <span className="rrd-window-tag rrd-tag-open">Disponível</span>}

                {editWinId === availability.availabilityId && (
                  <div className="rrd-window-edit">
                    <label>Início<input type="datetime-local" value={editWinStart} onChange={(e) => setEditWinStart(e.target.value)} /></label>
                    <label>Fim<input type="datetime-local" value={editWinEnd} onChange={(e) => setEditWinEnd(e.target.value)} /></label>
                    <div className="rrd-window-edit-actions">
                      <button type="button" className="rrd-win-cancel" onClick={() => setEditWinId(null)}>Cancelar</button>
                      <button type="button" className="rrd-win-save" disabled={winBusy} onClick={() => saveEditWindow(availability.availabilityId)}>{winBusy ? 'Salvando…' : 'Salvar'}</button>
                    </div>
                  </div>
                )}

                {isOwner && requestedBookings.map((b) => (
                  <div key={b.bookingId} className="rrd-booking-row">
                    <span>Solicitado em {new Date(b.requestedAt).toLocaleDateString('pt-BR')}</span>
                    <button type="button" onClick={() => handleConfirm(b.bookingId)}>Confirmar</button>
                  </div>
                ))}

                {!isOwner && !activeBooking && requestedBookings.length === 0 && (() => {
                  const wid = availability.availabilityId;
                  const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
                  const winMin = toLocal(availability.startDatetime);
                  const winMax = toLocal(availability.endDatetime);
                  return (
                    <div className="rrd-book-period">
                      <span className="rrd-book-period-hint">Escolha o período que você precisa (dentro da janela). Em branco = janela inteira.</span>
                      <div className="rrd-book-period-row">
                        <label>De<input type="datetime-local" min={winMin} max={winMax} value={pickStart[wid] ?? ''} onChange={(e) => setPickStart((p) => ({ ...p, [wid]: e.target.value }))} /></label>
                        <label>Até<input type="datetime-local" min={winMin} max={winMax} value={pickEnd[wid] ?? ''} onChange={(e) => setPickEnd((p) => ({ ...p, [wid]: e.target.value }))} /></label>
                      </div>
                      <button type="button" className="rrd-request-btn"
                        onClick={() => handleRequestBooking(wid,
                          pickStart[wid] ? new Date(pickStart[wid]).toISOString() : undefined,
                          pickEnd[wid] ? new Date(pickEnd[wid]).toISOString() : undefined)}>
                        {resource.bookingApprovalMode === 'automatic' ? '⚡ Reservar agora' : '🔑 Solicitar esta locação'}
                      </button>
                    </div>
                  );
                })()}
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

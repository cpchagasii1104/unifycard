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
import { getRentableResource, updateRentableResourceStatus, getResourcePublicAvailability, getRentalOfferDetail, updateRentalOffer, requestResourceBooking, getResourceRequests, declineResourceRequest, getQuotePreview, getResourceAddress, PRICING_UNIT_PT, type RentableResource, type RentableResourceStatus, type RentalOfferDetail, type RentalRequest, type QuotePreview, type ResourceAddress } from '../api/rentals';
import { listAvailabilities, createAvailability, updateAvailability, deleteAvailability, listBookings, confirmBooking, type UnifiedAvailability, type UnifiedBooking } from '../api/availability';
import ActorProfileModal from '../components/common/ActorProfileModal';
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
  const [address, setAddress] = useState<ResourceAddress | null>(null);
  const [windows, setWindows] = useState<WindowWithBookings[]>([]);
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [profileModalActorId, setProfileModalActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Declarar disponibilidade por tipo: datas (todos) + horário de uso (só espaço).
  const [availDateStart, setAvailDateStart] = useState('');
  const [availDateEnd, setAvailDateEnd] = useState('');
  const [availUseStart, setAvailUseStart] = useState('');
  const [availUseEnd, setAvailUseEnd] = useState('');
  const [submittingWindow, setSubmittingWindow] = useState(false);
  // Horário de retirada/devolução (regra do recurso — não limite diário). Prefill do recurso no load.
  const [handoffStart, setHandoffStart] = useState('');
  const [handoffEnd, setHandoffEnd] = useState('');

  const isOwner = !!activeActor && !!resource && resource.ownerActorId === activeActor.actor_id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getRentableResource(id);
      setResource(r);
      setHandoffStart(r.handoffTimeStart ? r.handoffTimeStart.slice(0, 5) : '');
      setHandoffEnd(r.handoffTimeEnd ? r.handoffTimeEnd.slice(0, 5) : '');
      // Oferta (faixas de preço + cidade do dono = local de retirada/devolução). Não crítico: se falhar,
      // a tela ainda funciona. O consumidor precisa ver por quanto e onde antes de solicitar.
      getRentalOfferDetail(id).then(setOffer).catch(() => setOffer(null));
      // Endereço com privacidade decidida no backend: público (cidade/bairro) ou completo (dono/confirmado).
      getResourceAddress(id).then(setAddress).catch(() => setAddress(null));
      const viewerIsOwner = !!activeActor && r.ownerActorId === activeActor.actor_id;
      if (viewerIsOwner) {
        // DONO: agenda operacional privada (janelas + reservas pendentes para confirmar).
        const avails = await listAvailabilities({ ownerType: 'actor_asset', ownerId: id });
        const withBookings = await Promise.all(
          avails.map(async (a) => ({ availability: a, bookings: await listBookings({ availabilityId: a.availabilityId }) }))
        );
        withBookings.sort((a, b) => new Date(b.availability.startDatetime).getTime() - new Date(a.availability.startDatetime).getTime());
        setWindows(withBookings);
        // Solicitações pendentes com QUEM pediu (o dono decide informado). Não crítico se falhar.
        getResourceRequests(id).then(setRequests).catch(() => setRequests([]));
      } else {
        // VISITANTE (chegou pela busca/descoberta): só as janelas PÚBLICAS do recurso, sem ver reservas
        // de terceiros. O backend só expõe se o recurso é público. Ele pode solicitar reserva.
        const publicWindows = await getResourcePublicAvailability(id);
        const mapped: WindowWithBookings[] = publicWindows
          .map((w) => ({ availability: { availabilityId: w.availabilityId, ownerType: 'actor_asset', ownerId: id, startDatetime: w.startDatetime, endDatetime: w.endDatetime, status: 'active' } as unknown as UnifiedAvailability, bookings: [] }))
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

  // Semântica por tipo: ESPAÇO usa horário de USO real (a janela é aquele intervalo); os demais são
  // POSSE CONTÍNUA — a janela vai por DATAS (dia inteiro), e o horário de retirada/devolução é regra
  // do recurso (handoffTime), não limite diário. Frontend não decide disponibilidade; só monta a janela.
  const isSpace = resource?.resourceType === 'space';
  const handleDeclareWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !availDateStart || !availDateEnd) { showToast('Informe as datas de início e fim.', 'error'); return; }
    let startIso: string, endIso: string;
    if (isSpace) {
      if (!availUseStart || !availUseEnd) { showToast('Informe o horário de uso.', 'error'); return; }
      startIso = new Date(`${availDateStart}T${availUseStart}:00`).toISOString();
      endIso = new Date(`${availDateEnd}T${availUseEnd}:00`).toISOString();
    } else {
      // posse contínua: dia inteiro do primeiro dia ao último.
      startIso = new Date(`${availDateStart}T00:00:00`).toISOString();
      endIso = new Date(`${availDateEnd}T23:59:59`).toISOString();
    }
    if (new Date(endIso) <= new Date(startIso)) { showToast('O fim deve ser depois do início.', 'error'); return; }
    setSubmittingWindow(true);
    try {
      await createAvailability({ ownerType: 'actor_asset', ownerId: id, startDatetime: startIso, endDatetime: endIso });
      showToast('Disponibilidade criada. ✅', 'success');
      setAvailDateStart(''); setAvailDateEnd(''); setAvailUseStart(''); setAvailUseEnd('');
      await load();
    } catch (err: any) {
      const msg = String(err?.message || '');
      showToast(msg.includes('OVERLAP') ? 'Esse período se sobrepõe a outra disponibilidade. Ajuste as datas.' : (msg || 'Erro ao criar janela'), 'error');
    } finally {
      setSubmittingWindow(false);
    }
  };

  const saveHandoffTime = async () => {
    if (!id) return;
    try {
      await updateRentalOffer(id, { handoffTimeStart: handoffStart || null, handoffTimeEnd: handoffEnd || null });
      showToast('Horário de retirada/devolução salvo.', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar horário', 'error');
    }
  };

  const handleConfirm = async (bookingId: string) => {
    try {
      await confirmBooking(bookingId);
      showToast('Reserva confirmada.', 'success');
      await load();
    } catch (err: any) {
      // RENTAL_RESOURCE_TIME_CONFLICT chega aqui se outra reserva já ocupou o intervalo
      const msg = String(err?.message || '');
      showToast(msg.includes('TIME_CONFLICT') ? 'Este período já foi confirmado para outra reserva.' : (msg || 'Erro ao confirmar reserva'), 'error');
    }
  };

  const handleDecline = async (bookingId: string, isCancel = false) => {
    if (!id || !window.confirm(isCancel ? 'Cancelar esta reserva? O período volta a ficar disponível.' : 'Recusar esta solicitação?')) return;
    try {
      await declineResourceRequest(id, bookingId);
      showToast(isCancel ? 'Reserva cancelada.' : 'Solicitação recusada.', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro', 'error');
    }
  };

  const handleRequestBooking = async (availabilityId: string, startAt?: string, endAt?: string) => {
    if (!activeActor || !id) return;
    try {
      // O modo (auto/manual) é do DONO, decidido no backend — a tela só projeta o resultado.
      // startAt/endAt = subperíodo escolhido (locação por período); backend valida ⊆ janela.
      const result = await requestResourceBooking(id, availabilityId, { startAt, endAt });
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
  // Cotação por janela: undefined=não pediu, 'loading', ou o preview do backend.
  const [quotes, setQuotes] = useState<Record<string, QuotePreview | 'loading' | undefined>>({});
  const fetchQuote = async (wid: string) => {
    if (!id || !pickStart[wid] || !pickEnd[wid]) return;
    setQuotes((q) => ({ ...q, [wid]: 'loading' }));
    try {
      const preview = await getQuotePreview(id, new Date(pickStart[wid]).toISOString(), new Date(pickEnd[wid]).toISOString());
      setQuotes((q) => ({ ...q, [wid]: preview }));
    } catch {
      setQuotes((q) => ({ ...q, [wid]: undefined }));
      showToast('Erro ao calcular a cotação.', 'error');
    }
  };

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
          {/* Local — rótulo por tipo (imóvel/espaço ≠ retirada/devolução). Público: cidade/UF. */}
          {offer?.city && <p className="rrd-meta">📍 {
            resource.resourceType === 'property' ? 'Localização'
            : resource.resourceType === 'space' ? 'Espaço em'
            : 'Retirada e devolução em'
          } {offer.city.name}{offer.city.uf ? `/${offer.city.uf}` : ''}</p>}
          {/* Horário de retirada/devolução: só veículo/equipamento (imóvel/espaço não têm handoff). */}
          {(resource.resourceType === 'vehicle' || resource.resourceType === 'equipment') && resource.handoffTimeStart && resource.handoffTimeEnd && (
            <p className="rrd-meta">🕗 Retirada/devolução entre {resource.handoffTimeStart.slice(0, 5)} e {resource.handoffTimeEnd.slice(0, 5)}</p>
          )}
          {/* Atributos de imóvel/espaço (facets do metadata, projeção). */}
          {(resource.resourceType === 'property' || resource.resourceType === 'space') && (() => {
            const m = (resource.metadata ?? {}) as Record<string, any>;
            const parts: string[] = [];
            if (m.areaM2) parts.push(`${m.areaM2} m²`);
            if (m.bedrooms != null) parts.push(`${m.bedrooms} quarto${Number(m.bedrooms) === 1 ? '' : 's'}`);
            if (m.bathrooms != null) parts.push(`${m.bathrooms} banheiro${Number(m.bathrooms) === 1 ? '' : 's'}`);
            if (m.parkingSpots) parts.push(`${m.parkingSpots} vaga${Number(m.parkingSpots) === 1 ? '' : 's'}`);
            if (m.floor != null) parts.push(`${m.floor}º andar`);
            if (m.furnished) parts.push('mobiliado');
            if (m.petsAllowed) parts.push('aceita pet');
            if (m.elevator) parts.push('elevador');
            return parts.length ? <p className="rrd-meta">🏠 {parts.join(' · ')}</p> : null;
          })()}
          {/* Endereço com privacidade do BACKEND: completo só p/ dono/locatário confirmado; senão aviso. */}
          {address && (address.access === 'full'
            ? <p className="rrd-meta">🔓 {[address.street, address.number].filter(Boolean).join(', ')}{address.complement ? ` · ${address.complement}` : ''}{address.neighborhood ? ` · ${address.neighborhood}` : ''}</p>
            : (address.neighborhood
                ? <p className="rrd-meta">🏙️ {address.neighborhood}{address.city ? ` · ${address.city}` : ''}{address.uf ? `/${address.uf}` : ''} <span className="rrd-soon">endereço completo após confirmar</span></p>
                : null))}
          {/* Quilometragem — só veículo, projetada do backend. */}
          {resource.resourceType === 'vehicle' && resource.mileagePolicy && (
            <p className="rrd-meta">🚗 {
              resource.mileagePolicy === 'unlimited' ? 'Km livre'
              : resource.mileagePolicy === 'to_be_arranged' ? 'Quilometragem a combinar direto com o dono'
              : `Inclui ${resource.includedKmPerDay ?? '—'} km/dia${resource.extraKmFeeCents != null ? ` · Excedente R$ ${(resource.extraKmFeeCents / 100).toFixed(2).replace('.', ',')}/km` : ''}`
            }</p>
          )}
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
          <h2>{isSpace ? 'Disponibilizar o espaço' : 'Disponibilizar para locação'}</h2>
          <form className="rrd-window-form" onSubmit={handleDeclareWindow}>
            <label>Disponível de <input type="date" value={availDateStart} onChange={(e) => setAvailDateStart(e.target.value)} /></label>
            <label>até <input type="date" value={availDateEnd} onChange={(e) => setAvailDateEnd(e.target.value)} /></label>
            {isSpace && (
              <>
                <label>das <input type="time" value={availUseStart} onChange={(e) => setAvailUseStart(e.target.value)} /></label>
                <label>às <input type="time" value={availUseEnd} onChange={(e) => setAvailUseEnd(e.target.value)} /></label>
              </>
            )}
            <button type="submit" disabled={submittingWindow}>{submittingWindow ? 'Criando…' : 'Disponibilizar'}</button>
          </form>
          <p className="rrd-help-text">
            {isSpace
              ? 'Para espaços, o horário é a janela de uso real (ex.: salão sábado das 18h às 23h).'
              : resource.resourceType === 'vehicle'
                ? 'O cliente fica com o veículo durante todo o período reservado — os horários abaixo são só para retirada e devolução, não um limite diário de uso.'
                : resource.resourceType === 'equipment'
                  ? 'O cliente fica com o equipamento durante todo o período — os horários abaixo indicam quando pode ser entregue, retirado ou devolvido.'
                  : 'O período define a disponibilidade; horários abaixo valem para entrega/visita/devolução, se houver.'}
          </p>
          {!isSpace && (
            <div className="rrd-handoff-time">
              <span className="rrd-handoff-time-label">🕗 Retirada/devolução entre</span>
              <input type="time" value={handoffStart} onChange={(e) => setHandoffStart(e.target.value)} />
              <span>e</span>
              <input type="time" value={handoffEnd} onChange={(e) => setHandoffEnd(e.target.value)} />
              <button type="button" className="rrd-win-save" onClick={saveHandoffTime}>Salvar horário</button>
            </div>
          )}
        </section>
      )}

      {/* Solicitações com QUEM pediu — o dono cede um bem, decide informado. Reputação honesta (sem fake). */}
      {isOwner && requests.length > 0 && (
        <section className="rrd-section">
          <h2>Solicitações de locação ({requests.length})</h2>
          <div className="rrd-requests">
            {requests.map((r) => (
              <div key={r.bookingId} className="rrd-request-card">
                <div className="rrd-request-head">
                  {r.requester.avatarUrl
                    ? <img className="rrd-avatar" src={r.requester.avatarUrl} alt="" />
                    : <span className="rrd-avatar rrd-avatar-fallback">{r.requester.displayName.charAt(0).toUpperCase()}</span>}
                  <div>
                    <span className="rrd-request-name">{r.requester.displayName}</span>
                    <span className="rrd-request-type">{r.requester.actorType === 'page' ? 'Empresa' : 'Pessoa Física'}</span>
                  </div>
                  <span className={`rrd-request-status rrd-bk-${r.status}`}>{r.status === 'confirmed' ? 'Confirmada' : r.status === 'checked_in' ? 'Em uso' : 'Pendente'}</span>
                </div>
                {r.bookedStart && r.bookedEnd && (
                  <p className="rrd-request-line">📅 {new Date(r.bookedStart).toLocaleString('pt-BR')} → {new Date(r.bookedEnd).toLocaleString('pt-BR')}</p>
                )}
                <p className="rrd-request-line">
                  {r.estimate?.available ? `💰 Estimativa: R$ ${(r.estimate.estimatedPriceCents / 100).toFixed(2).replace('.', ',')}` : '💰 Preço a combinar'}
                </p>
                {/* Reputação: só projeta se houver fato real; hoje o substrato está dormente → honesto. */}
                <p className="rrd-request-trust">{r.trust ? '' : '🔒 Perfil público disponível · histórico de reputação ainda não disponível'}</p>
                <div className="rrd-request-actions">
                  <button type="button" className="rrd-req-profile" onClick={() => setProfileModalActorId(r.requester.actorId)}>Ver perfil</button>
                  {/* Mensagem direta ainda não está viva no sistema — placeholder honesto, sem backend falso. */}
                  <button type="button" className="rrd-req-message" title="Em desenvolvimento"
                    onClick={() => showToast('Envio de mensagem em desenvolvimento — em breve.', 'success')}>
                    💬 Enviar mensagem <span className="rrd-soon">em breve</span>
                  </button>
                  {/* Pendente: recusar/confirmar. Confirmada: cancelar (libera o período — a regra do banco valida). */}
                  {r.status === 'requested' ? (
                    <>
                      <button type="button" className="rrd-req-decline" onClick={() => handleDecline(r.bookingId)}>Recusar</button>
                      <button type="button" className="rrd-req-confirm" onClick={() => handleConfirm(r.bookingId)}>Confirmar</button>
                    </>
                  ) : (
                    <button type="button" className="rrd-req-decline" onClick={() => handleDecline(r.bookingId, true)}>Cancelar reserva</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rrd-section">
        <h2>{isOwner ? 'Janelas de disponibilidade' : 'Escolha um período disponível'}</h2>
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

                {/* Solicitações agora aparecem na seção "Solicitações de locação" acima (com quem pediu). */}
                {isOwner && requestedBookings.length > 0 && (
                  <span className="rrd-window-tag rrd-tag-requested">{requestedBookings.length} solicitação(ões) — ver acima</span>
                )}

                {!isOwner && !activeBooking && requestedBookings.length === 0 && (() => {
                  const wid = availability.availabilityId;
                  const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
                  const winMin = toLocal(availability.startDatetime);
                  const winMax = toLocal(availability.endDatetime);
                  return (
                    <div className="rrd-book-period">
                      <span className="rrd-book-period-hint">Escolha o período que você precisa (dentro da janela). Em branco = janela inteira.</span>
                      <div className="rrd-book-period-row">
                        <label>De<input type="datetime-local" min={winMin} max={winMax} value={pickStart[wid] ?? ''} onChange={(e) => { setPickStart((p) => ({ ...p, [wid]: e.target.value })); setQuotes((q) => ({ ...q, [wid]: undefined })); }} /></label>
                        <label>Até<input type="datetime-local" min={winMin} max={winMax} value={pickEnd[wid] ?? ''} onChange={(e) => { setPickEnd((p) => ({ ...p, [wid]: e.target.value })); setQuotes((q) => ({ ...q, [wid]: undefined })); }} /></label>
                        <button type="button" className="rrd-quote-btn" disabled={!pickStart[wid] || !pickEnd[wid]} onClick={() => fetchQuote(wid)}>Ver cotação</button>
                      </div>
                      {/* COTAÇÃO — o backend calcula available/preço/handoff. O front só projeta. */}
                      {quotes[wid] === 'loading' && <span className="rrd-book-period-hint">Calculando…</span>}
                      {quotes[wid] && quotes[wid] !== 'loading' && (() => {
                        const q = quotes[wid] as QuotePreview;
                        return q.bookable ? (
                          <div className="rrd-quote rrd-quote-ok">
                            <strong>✅ Disponível neste período</strong>
                            {q.hasEstimate ? <span>Estimativa: R$ {(q.estimatedPriceCents / 100).toFixed(2).replace('.', ',')}</span> : <span>Preço a combinar (sem faixa cadastrada)</span>}
                            {q.handoffTimeStart && q.handoffTimeEnd && <span>🕗 Retirada/devolução entre {q.handoffTimeStart.slice(0, 5)} e {q.handoffTimeEnd.slice(0, 5)}</span>}
                            {/* Quilometragem projetada — sem cobrança de excedente (sem km rodado real). */}
                            {q.mileage && <span>🚗 {
                              q.mileage.policy === 'unlimited' ? 'Km livre'
                              : q.mileage.policy === 'to_be_arranged' ? 'Quilometragem a combinar direto com o dono'
                              : `Inclui ${q.mileage.includedKmForPeriod ?? '—'} km neste período${q.mileage.extraKmFeeCents != null ? ` · Excedente R$ ${(q.mileage.extraKmFeeCents / 100).toFixed(2).replace('.', ',')}/km` : ''}`
                            }</span>}
                            {/* Taxa de limpeza anunciada + total estimado (aluguel + limpeza) — não é cobrança. */}
                            {q.cleaning && q.cleaning.policy === 'separate_required' && q.cleaning.cents != null && <span>🧹 Taxa de limpeza: R$ {(q.cleaning.cents / 100).toFixed(2).replace('.', ',')}</span>}
                            {q.cleaning && q.cleaning.policy === 'included' && <span>🧹 Limpeza incluída</span>}
                            {q.cleaning && q.cleaning.policy === 'to_be_arranged' && <span>🧹 Limpeza a combinar</span>}
                            {q.hasEstimate && q.totalEstimatedCents != null && q.totalEstimatedCents !== q.estimatedPriceCents && <strong>Total estimado: R$ {(q.totalEstimatedCents / 100).toFixed(2).replace('.', ',')}</strong>}
                            <span className="rrd-quote-disclaimer">{q.disclaimer}</span>
                          </div>
                        ) : (
                          <div className="rrd-quote rrd-quote-no">
                            ❌ {q.unavailableReason === 'OUT_OF_WINDOW' ? 'Fora da janela de disponibilidade.'
                              : q.unavailableReason === 'PERIOD_TAKEN' ? 'Esse período já está reservado.'
                              : q.unavailableReason === 'PERIOD_INVALID' ? 'Período inválido (fim deve ser depois do início).'
                              : q.unavailableReason === 'BELOW_MINIMUM' ? `Período abaixo do mínimo${q.minRental ? ` de ${q.minRental.qty} ${q.minRental.unit}` : ''}.`
                              : 'Indisponível neste período.'}
                          </div>
                        );
                      })()}
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
      {profileModalActorId && <ActorProfileModal actorId={profileModalActorId} onClose={() => setProfileModalActorId(null)} />}
    </div>
  );
}

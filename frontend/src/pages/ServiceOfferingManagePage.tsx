// src/pages/ServiceOfferingManagePage.tsx
// F-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-SLICE-A / DT-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-MISSING
//
// A PORTA VERDADEIRA da oferta: gestão pós-publicação. O ServiceCreatePage cria serviço + oferta +
// UMA janela no ato de publicar; depois disso NÃO existia superfície para adicionar nova janela ou
// ajustar preço/duração — daí a vitrine ficar presa em "Sem disponibilidade" quando a janela única
// expira/é consumida. Esta página fecha o buraco SEM ressuscitar agenda service-level: a
// disponibilidade reservável é a da OFERTA (owner_type='service_offering' — SSOT temporal, a MESMA
// que o consumer lê no ServiceOfferingSelector). Nada de owner_type='service' aqui.
//
// Disciplina (frontend PROJETA verdade resolvida): provider = ACTOR ATIVO de sessão (não input nem
// hardcode); o backend liga actionContext + canRepresentActor(provider) e é dono da autoridade.
// Money-free: priceCents é centavo inteiro (nunca float como verdade); zero Bank/checkout/payout.
// Endpoints (todos já existentes): GET /services/offerings/by-canonical/:id · PUT /services/offerings/:id
// · POST /services/offerings/:id/availability · GET /availability?ownerType=service_offering&ownerId=.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import { getService, type Service } from '../api/services';
import {
  getOfferingsByCanonical,
  declareOfferingAvailability,
  updateOffering,
  isProviderTimeConflict,
  type ServiceOffering,
} from '../api/offerings';
import { listAvailabilities, type UnifiedAvailability } from '../api/availability';
import './ServiceOfferingManagePage.css';

export default function ServiceOfferingManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  const [service, setService] = useState<Service | null>(null);
  const [offering, setOffering] = useState<ServiceOffering | null>(null);
  const [availabilities, setAvailabilities] = useState<UnifiedAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form: nova janela de disponibilidade da OFERTA.
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [addingWindow, setAddingWindow] = useState(false);

  // Form: editar preço/duração da oferta (PUT genérico).
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const svc = await getService(id);
      setService(svc);
      if (!svc.canonicalServiceId) {
        setOffering(null);
        setAvailabilities([]);
        setError('Este serviço não está vinculado a um serviço canônico — não há oferta gerenciável.');
        return;
      }
      const actorId = activeActor?.actor_id ?? null;
      const offerings = await getOfferingsByCanonical(svc.canonicalServiceId);
      // Projeta a verdade do backend: a oferta gerida é a do PROVIDER = actor ativo (não inventa vínculo).
      const mine = actorId ? offerings.filter((o) => o.providerActorId === actorId) : offerings;
      const off = mine[0] ?? null;
      setOffering(off);
      if (off) {
        setPrice((off.priceCents / 100).toString());
        setDuration(String(off.durationMinutes));
        const avails = await listAvailabilities({
          ownerType: 'service_offering',
          ownerId: off.id,
          status: 'active',
        });
        setAvailabilities(avails);
      } else {
        setAvailabilities([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar a oferta.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, activeActor]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-BR');
  const fmtPrice = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const handleAddWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offering) return;
    if (!startLocal || !endLocal) {
      showToast('Informe início e fim da janela.', 'error');
      return;
    }
    const startDatetime = new Date(startLocal).toISOString();
    const endDatetime = new Date(endLocal).toISOString();
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      showToast('O fim da janela deve ser depois do início.', 'error');
      return;
    }
    setAddingWindow(true);
    try {
      await declareOfferingAvailability(offering.id, { startDatetime, endDatetime });
      showToast('Janela de disponibilidade adicionada.', 'success');
      setStartLocal('');
      setEndLocal('');
      await load();
    } catch (err) {
      const message = isProviderTimeConflict(err)
        ? 'Conflito de horário: você já tem uma janela que se sobrepõe a esse intervalo.'
        : err instanceof Error
        ? err.message
        : 'Não foi possível adicionar a janela.';
      showToast(message, 'error');
    } finally {
      setAddingWindow(false);
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offering) return;
    const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      showToast('Preço inválido.', 'error');
      return;
    }
    const durationMinutes = parseInt(duration, 10);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      showToast('Duração inválida.', 'error');
      return;
    }
    setSavingOffer(true);
    try {
      await updateOffering(offering.id, { priceCents, durationMinutes });
      showToast('Oferta atualizada.', 'success');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar a oferta.';
      showToast(message, 'error');
    } finally {
      setSavingOffer(false);
    }
  };

  const statusLabel: Record<ServiceOffering['status'], string> = {
    draft: 'Rascunho',
    active: 'Ativa',
    suspended: 'Suspensa',
  };

  return (
    <div className="offering-manage-page">
      <div className="page-header">
        <button className="back-link" onClick={() => navigate(`/services/${id}`)}>
          ← Voltar ao serviço
        </button>
        <h1>Gerenciar oferta e agenda</h1>
        {service && <p className="subtitle">{service.name}</p>}
      </div>

      {loading ? (
        <p>Carregando oferta…</p>
      ) : !activeActor ? (
        <div className="offering-section">
          <p className="empty-hint">Escolha o perfil da empresa para gerenciar a oferta deste serviço.</p>
          <button className="btn-primary" onClick={() => navigate('/services')}>
            Ir para a Central do prestador
          </button>
        </div>
      ) : error && !offering ? (
        <div className="offering-section">
          <p className="form-error" role="alert">{error}</p>
          <button className="btn-secondary" onClick={() => navigate(`/services/${id}`)}>
            Voltar ao serviço
          </button>
        </div>
      ) : !offering ? (
        <div className="offering-section">
          <p className="empty-hint">
            Nenhuma oferta encontrada para este serviço com o perfil ativo. Publique a oferta para abrir
            preço e agenda reserváveis.
          </p>
          <button className="btn-primary" onClick={() => navigate('/services/new')}>
            Publicar serviço
          </button>
        </div>
      ) : (
        <>
          {/* Oferta atual + edição de preço/duração */}
          <form className="offering-card" onSubmit={handleSaveOffer}>
            <div className="offering-meta">
              <div className="meta-item">
                <label>Preço atual</label>
                <span>{fmtPrice(offering.priceCents)}</span>
              </div>
              <div className="meta-item">
                <label>Duração</label>
                <span>{offering.durationMinutes} min</span>
              </div>
              {offering.modality && (
                <div className="meta-item">
                  <label>Modalidade</label>
                  <span>{offering.modality}</span>
                </div>
              )}
              <div className="meta-item">
                <label>Status</label>
                <span className={`status-pill status-${offering.status}`}>
                  {statusLabel[offering.status]}
                </span>
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="offer-price">Preço (R$)</label>
                <input
                  id="offer-price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="25,00"
                />
              </div>
              <div className="field">
                <label htmlFor="offer-duration">Duração (min)</label>
                <input
                  id="offer-duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-secondary" type="submit" disabled={savingOffer}>
              {savingOffer ? 'Salvando…' : 'Salvar preço/duração'}
            </button>
          </form>

          {/* Janelas de disponibilidade da OFERTA (owner_type=service_offering) */}
          <div className="offering-section">
            <h2>Disponibilidade reservável</h2>
            {availabilities.length === 0 ? (
              <p className="empty-hint">
                Sem janelas ativas. Adicione uma janela futura abaixo para que o cliente possa reservar.
              </p>
            ) : (
              <ul className="availability-list">
                {availabilities.map((av) => (
                  <li key={av.availabilityId}>
                    <span>{fmtDt(av.startDatetime)} → {fmtDt(av.endDatetime)}</span>
                    {av.capacity != null && <span>cap. {av.capacity}</span>}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddWindow}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="win-start">Início</label>
                  <input
                    id="win-start"
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="win-end">Fim</label>
                  <input
                    id="win-end"
                    type="datetime-local"
                    value={endLocal}
                    onChange={(e) => setEndLocal(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn-primary" type="submit" disabled={addingWindow}>
                {addingWindow ? 'Adicionando…' : 'Adicionar janela'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

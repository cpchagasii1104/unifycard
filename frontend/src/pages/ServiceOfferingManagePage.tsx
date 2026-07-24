// src/pages/ServiceOfferingManagePage.tsx
// F-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-SLICE-A / DT-MVP-SERVICE-OFFERING-MANAGEMENT-SURFACE-MISSING
// + RAIO-X DO PERFORMER (fatia 1b): torna VISÍVEL/editável no navegador o backend SELADO da oferta —
// faixa de público, política de contratação, gênero, equipamento, formações/line-up e grade de preço.
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
// Pickers GOVERNADOS (nunca hardcode de concept): gênero = /api/events/themes/search (pool de assunto,
// mesma autoridade shared_subject_concepts do tagueamento); equipamento = /rentable-resources/concepts
// filtrado por use-area de palco/evento (audio_video_lighting + events_parties).

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
  listOfferingGenres,
  tagOfferingGenres,
  untagOfferingGenre,
  listOfferingEquipment,
  tagOfferingEquipment,
  untagOfferingEquipment,
  listOfferingConfigs,
  createOfferingConfig,
  updateOfferingConfig,
  deleteOfferingConfig,
  addConfigMember,
  removeConfigMember,
  listConfigPrices,
  setConfigPrice,
  removeConfigPrice,
  type ServiceOffering,
  type OfferingConfig,
  type OfferingConfigStatus,
  type OfferingConfigPeriodOfDay,
  type OfferingConfigPriceCell,
} from '../api/offerings';
import { searchEventThemes } from '../api/events';
import { listRentalConceptsByType } from '../api/rentals';
import { listAvailabilities, type UnifiedAvailability } from '../api/availability';
import './ServiceOfferingManagePage.css';

// ── Vocabulário canônico da grade de preço (0=Dom..6=Sáb §4.25; período pt-BR governado).
const DAYS: Array<{ v: number; l: string }> = [
  { v: 0, l: 'Dom' }, { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' },
];
const PERIODS: Array<{ v: OfferingConfigPeriodOfDay; l: string }> = [
  { v: 'manha', l: 'Manhã' }, { v: 'tarde', l: 'Tarde' }, { v: 'noite', l: 'Noite' },
];
// use-areas de palco/evento aceitas pelo tagueamento de equipamento do performer (backend selado).
const EQUIPMENT_USE_AREAS = ['audio_video_lighting', 'events_parties'] as const;

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const reaisToCents = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};
const centsToReais = (cents: number | null | undefined): string =>
  cents == null ? '' : (cents / 100).toString().replace('.', ',');

type TabKey = 'oferta' | 'publico' | 'contratacao' | 'genero' | 'equipamento' | 'formacoes';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'oferta', label: 'Oferta & Agenda' },
  { key: 'publico', label: 'Público-faixa' },
  { key: 'contratacao', label: 'Contratação' },
  { key: 'genero', label: 'Gênero' },
  { key: 'equipamento', label: 'Equipamento' },
  { key: 'formacoes', label: 'Formações & Preço' },
];

export default function ServiceOfferingManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  const [service, setService] = useState<Service | null>(null);
  const [offering, setOffering] = useState<ServiceOffering | null>(null);
  const [availabilities, setAvailabilities] = useState<UnifiedAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('oferta');

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
    const priceCents = reaisToCents(price);
    if (priceCents == null) {
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
          <div className="offering-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`offering-tab${tab === t.key ? ' is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'oferta' && (
            <>
              {/* Oferta atual + edição de preço/duração */}
              <form className="offering-card" onSubmit={handleSaveOffer}>
                <div className="offering-meta">
                  <div className="meta-item">
                    <label>Preço atual</label>
                    <span>{fmtBRL(offering.priceCents)}</span>
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

          {tab === 'publico' && <AudienceTab offering={offering} onReload={load} />}
          {tab === 'contratacao' && <ContractingTab offering={offering} onReload={load} />}
          {tab === 'genero' && <GenreTab offeringId={offering.id} />}
          {tab === 'equipamento' && <EquipmentTab offeringId={offering.id} />}
          {tab === 'formacoes' && <ConfigsTab offeringId={offering.id} />}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PÚBLICO-FAIXA — audience_min/audience_max (both-or-neither validado no backend; min<=max).
// ─────────────────────────────────────────────────────────────────────────────────────────────
function AudienceTab({ offering, onReload }: { offering: ServiceOffering; onReload: () => Promise<void> }) {
  const [min, setMin] = useState(offering.audienceMin != null ? String(offering.audienceMin) : '');
  const [max, setMax] = useState(offering.audienceMax != null ? String(offering.audienceMax) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMin(offering.audienceMin != null ? String(offering.audienceMin) : '');
    setMax(offering.audienceMax != null ? String(offering.audienceMax) : '');
  }, [offering.audienceMin, offering.audienceMax]);

  const save = async () => {
    const nMin = parseInt(min, 10);
    const nMax = parseInt(max, 10);
    if (!Number.isInteger(nMin) || nMin <= 0 || !Number.isInteger(nMax) || nMax <= 0) {
      showToast('Informe os dois extremos da faixa (inteiros > 0).', 'error');
      return;
    }
    if (nMin > nMax) {
      showToast('O mínimo não pode ser maior que o máximo.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateOffering(offering.id, { audienceMin: nMin, audienceMax: nMax });
      showToast('Faixa de público salva.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar a faixa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await updateOffering(offering.id, { audienceMin: null, audienceMax: null });
      showToast('Faixa de público removida.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível remover a faixa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="offering-section">
      <h2>Faixa de público preferida</h2>
      <p className="empty-hint">
        Quantas pessoas seu show atende melhor. Alimenta a descoberta; é uma PREFERÊNCIA (não um limite físico).
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="aud-min">Mínimo (pessoas)</label>
          <input id="aud-min" type="number" min={1} value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="aud-max">Máximo (pessoas)</label>
          <input id="aud-max" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar faixa'}
        </button>
        {(offering.audienceMin != null || offering.audienceMax != null) && (
          <button className="btn-secondary" onClick={clear} disabled={saving}>
            Limpar faixa
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CONTRATAÇÃO — bookingApprovalMode (manual=negocia / automatic=aceita-direto) + condição de distância.
// ─────────────────────────────────────────────────────────────────────────────────────────────
function ContractingTab({ offering, onReload }: { offering: ServiceOffering; onReload: () => Promise<void> }) {
  const [mode, setMode] = useState<'manual' | 'automatic'>(offering.bookingApprovalMode ?? 'manual');
  const [sameCity, setSameCity] = useState<boolean>(offering.acceptDirectSameCity ?? false);
  const [radius, setRadius] = useState(offering.acceptDirectRadiusKm != null ? String(offering.acceptDirectRadiusKm) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(offering.bookingApprovalMode ?? 'manual');
    setSameCity(offering.acceptDirectSameCity ?? false);
    setRadius(offering.acceptDirectRadiusKm != null ? String(offering.acceptDirectRadiusKm) : '');
  }, [offering.bookingApprovalMode, offering.acceptDirectSameCity, offering.acceptDirectRadiusKm]);

  const save = async () => {
    let radiusKm: number | null = null;
    if (radius.trim() !== '') {
      const n = parseFloat(radius.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) {
        showToast('Raio (km) deve ser um número > 0 (ou vazio).', 'error');
        return;
      }
      radiusKm = n;
    }
    setSaving(true);
    try {
      await updateOffering(offering.id, {
        bookingApprovalMode: mode,
        acceptDirectSameCity: sameCity,
        acceptDirectRadiusKm: radiusKm,
      });
      showToast('Política de contratação salva.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível salvar a política.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="offering-section">
      <h2>Política de contratação</h2>
      <p className="empty-hint">
        No modo <strong>aceita-direto</strong>, reservas dentro da condição de distância confirmam na hora;
        fora dela (ou no modo <strong>negocia</strong>) ficam como solicitação.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ct-mode">Modo</label>
          <select id="ct-mode" value={mode} onChange={(e) => setMode(e.target.value as 'manual' | 'automatic')}>
            <option value="manual">Negocia (aprovação manual)</option>
            <option value="automatic">Aceita-direto (automático)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ct-radius">Raio de aceite direto (km)</label>
          <input
            id="ct-radius"
            type="text"
            inputMode="decimal"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder="ex.: 30"
          />
        </div>
      </div>
      <label className="checkbox-line">
        <input type="checkbox" checked={sameCity} onChange={(e) => setSameCity(e.target.checked)} />
        Aceitar direto na MESMA cidade
      </label>
      <div className="btn-row">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar política'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// GÊNERO — picker GOVERNADO via /api/events/themes/search (pool de assunto), tag/untag na oferta.
// Os gêneros já tagueados vêm como concept ids (backend não devolve rótulo); o cache de rótulos é
// alimentado pela busca e pelos itens adicionados na sessão.
// ─────────────────────────────────────────────────────────────────────────────────────────────
function GenreTab({ offeringId }: { offeringId: string }) {
  const [tagged, setTagged] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ conceptId: string; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadTagged = useCallback(async () => {
    setLoadingList(true);
    try {
      setTagged(await listOfferingGenres(offeringId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar gêneros.', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [offeringId]);

  useEffect(() => { loadTagged(); }, [loadTagged]);

  const doSearch = async () => {
    if (q.trim().length < 2) {
      showToast('Digite ao menos 2 letras.', 'error');
      return;
    }
    setSearching(true);
    try {
      const themes = await searchEventThemes(q);
      setResults(themes.map((t) => ({ conceptId: t.conceptId, label: t.label })));
      setLabels((prev) => {
        const next = { ...prev };
        for (const t of themes) next[t.conceptId] = t.label;
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na busca.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const add = async (conceptId: string, label: string) => {
    setBusy(true);
    try {
      await tagOfferingGenres(offeringId, [conceptId]);
      setLabels((prev) => ({ ...prev, [conceptId]: label }));
      showToast('Gênero adicionado.', 'success');
      await loadTagged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar gênero.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (conceptId: string) => {
    setBusy(true);
    try {
      await untagOfferingGenre(offeringId, conceptId);
      showToast('Gênero removido.', 'success');
      await loadTagged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover gênero.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="offering-section">
      <h2>Gêneros da banda</h2>
      <p className="empty-hint">Ajuda o público a achar sua banda pelo estilo. Busque no catálogo governado e marque.</p>

      {loadingList ? (
        <p>Carregando…</p>
      ) : tagged.length === 0 ? (
        <p className="empty-hint">Nenhum gênero marcado ainda.</p>
      ) : (
        <div className="chip-list">
          {tagged.map((cid) => (
            <span key={cid} className="chip">
              {labels[cid] ?? `#${cid.slice(0, 8)}`}
              <button className="chip-x" disabled={busy} onClick={() => remove(cid)} aria-label="Remover">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="field-row" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="genre-q">Buscar gênero</label>
          <input
            id="genre-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            placeholder="ex.: rock, samba, funk"
          />
        </div>
      </div>
      <button className="btn-secondary" onClick={doSearch} disabled={searching}>
        {searching ? 'Buscando…' : 'Buscar'}
      </button>

      {results.length > 0 && (
        <ul className="picker-list">
          {results.map((r) => {
            const already = tagged.includes(r.conceptId);
            return (
              <li key={r.conceptId}>
                <span>{r.label}</span>
                <button className="btn-secondary" disabled={busy || already} onClick={() => add(r.conceptId, r.label)}>
                  {already ? 'Marcado' : 'Adicionar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EQUIPAMENTO — picker GOVERNADO via /rentable-resources/concepts filtrado por use-area de palco/evento
// (audio_video_lighting + events_parties), tag/untag na oferta. Mesma disciplina de cache de rótulos.
// ─────────────────────────────────────────────────────────────────────────────────────────────
function EquipmentTab({ offeringId }: { offeringId: string }) {
  const [tagged, setTagged] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ conceptId: string; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadTagged = useCallback(async () => {
    setLoadingList(true);
    try {
      setTagged(await listOfferingEquipment(offeringId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar equipamentos.', 'error');
    } finally {
      setLoadingList(false);
    }
  }, [offeringId]);

  useEffect(() => { loadTagged(); }, [loadTagged]);

  const doSearch = async () => {
    setSearching(true);
    try {
      // Une as duas use-areas de palco/evento e deduplica por concept_id.
      const perArea = await Promise.all(
        EQUIPMENT_USE_AREAS.map((ua) => listRentalConceptsByType('equipment', q.trim() || undefined, ua))
      );
      const map = new Map<string, string>();
      for (const list of perArea) for (const c of list) map.set(c.concept_id, c.label);
      const merged = Array.from(map.entries())
        .map(([conceptId, label]) => ({ conceptId, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      setResults(merged);
      setLabels((prev) => {
        const next = { ...prev };
        for (const m of merged) next[m.conceptId] = m.label;
        return next;
      });
      if (merged.length === 0) showToast('Nenhum equipamento encontrado para o termo.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na busca.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const add = async (conceptId: string, label: string) => {
    setBusy(true);
    try {
      await tagOfferingEquipment(offeringId, [conceptId]);
      setLabels((prev) => ({ ...prev, [conceptId]: label }));
      showToast('Equipamento adicionado.', 'success');
      await loadTagged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar equipamento.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (conceptId: string) => {
    setBusy(true);
    try {
      await untagOfferingEquipment(offeringId, conceptId);
      showToast('Equipamento removido.', 'success');
      await loadTagged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover equipamento.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="offering-section">
      <h2>Equipamento próprio</h2>
      <p className="empty-hint">Checklist do que a banda leva (som, luz, palco). Catálogo governado de palco/evento.</p>

      {loadingList ? (
        <p>Carregando…</p>
      ) : tagged.length === 0 ? (
        <p className="empty-hint">Nenhum equipamento marcado ainda.</p>
      ) : (
        <div className="chip-list">
          {tagged.map((cid) => (
            <span key={cid} className="chip">
              {labels[cid] ?? `#${cid.slice(0, 8)}`}
              <button className="chip-x" disabled={busy} onClick={() => remove(cid)} aria-label="Remover">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="field-row" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="eq-q">Buscar equipamento (vazio = todos)</label>
          <input
            id="eq-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            placeholder="ex.: caixa de som, refletor"
          />
        </div>
      </div>
      <button className="btn-secondary" onClick={doSearch} disabled={searching}>
        {searching ? 'Buscando…' : 'Buscar'}
      </button>

      {results.length > 0 && (
        <ul className="picker-list">
          {results.map((r) => {
            const already = tagged.includes(r.conceptId);
            return (
              <li key={r.conceptId}>
                <span>{r.label}</span>
                <button className="btn-secondary" disabled={busy || already} onClick={() => add(r.conceptId, r.label)}>
                  {already ? 'Marcado' : 'Adicionar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// FORMAÇÕES & PREÇO — cardápio de configs (CRUD + line-up) e grade de preço por config.
// Line-up só existe em provider grupo-actor; o backend rejeita (409) quando não for grupo — a UI
// deixa o dono tentar e propaga a mensagem (o front NÃO decide autoridade).
// ─────────────────────────────────────────────────────────────────────────────────────────────
function ConfigsTab({ offeringId }: { offeringId: string }) {
  const [configs, setConfigs] = useState<OfferingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newTeamSize, setNewTeamSize] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await listOfferingConfigs(offeringId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar formações.', 'error');
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const teamSize = parseInt(newTeamSize, 10);
    if (!newLabel.trim()) {
      showToast('Dê um rótulo à formação.', 'error');
      return;
    }
    if (!Number.isInteger(teamSize) || teamSize <= 0) {
      showToast('Tamanho da equipe deve ser inteiro > 0.', 'error');
      return;
    }
    setCreating(true);
    try {
      await createOfferingConfig(offeringId, { label: newLabel.trim(), teamSize });
      showToast('Formação criada.', 'success');
      setNewLabel('');
      setNewTeamSize('');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar formação.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="offering-section">
      <h2>Formações (line-up) e preço</h2>
      <p className="empty-hint">
        Monte o cardápio de formações (ex.: “Trio”, “Banda completa”), o line-up e a grade de preço por formação.
      </p>

      <div className="config-card create">
        <div className="field-row">
          <div className="field">
            <label htmlFor="cfg-label">Rótulo da formação</label>
            <input id="cfg-label" type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ex.: Banda completa" />
          </div>
          <div className="field">
            <label htmlFor="cfg-team">Tamanho da equipe</label>
            <input id="cfg-team" type="number" min={1} value={newTeamSize} onChange={(e) => setNewTeamSize(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={create} disabled={creating}>
          {creating ? 'Criando…' : 'Adicionar formação'}
        </button>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : configs.length === 0 ? (
        <p className="empty-hint">Nenhuma formação ainda.</p>
      ) : (
        configs.map((c) => (
          <ConfigCard key={c.id} offeringId={offeringId} config={c} onChanged={load} />
        ))
      )}
    </div>
  );
}

function ConfigCard({
  offeringId, config, onChanged,
}: { offeringId: string; config: OfferingConfig; onChanged: () => Promise<void> }) {
  const [label, setLabel] = useState(config.label);
  const [teamSize, setTeamSize] = useState(String(config.teamSize));
  const [status, setStatus] = useState<OfferingConfigStatus>(config.status);
  const [defaultPrice, setDefaultPrice] = useState(centsToReais(config.defaultPriceCents));
  const [savingMeta, setSavingMeta] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [busyMember, setBusyMember] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  useEffect(() => {
    setLabel(config.label);
    setTeamSize(String(config.teamSize));
    setStatus(config.status);
    setDefaultPrice(centsToReais(config.defaultPriceCents));
  }, [config.label, config.teamSize, config.status, config.defaultPriceCents]);

  const saveMeta = async () => {
    const n = parseInt(teamSize, 10);
    if (!label.trim()) { showToast('Rótulo não pode ficar vazio.', 'error'); return; }
    if (!Number.isInteger(n) || n <= 0) { showToast('Tamanho da equipe inválido.', 'error'); return; }
    let defCents: number | null = null;
    if (defaultPrice.trim() !== '') {
      const c = reaisToCents(defaultPrice);
      if (c == null) { showToast('Preço-base inválido.', 'error'); return; }
      defCents = c;
    }
    setSavingMeta(true);
    try {
      await updateOfferingConfig(offeringId, config.id, {
        label: label.trim(), teamSize: n, status, defaultPriceCents: defCents,
      });
      showToast('Formação atualizada.', 'success');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar formação.', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  const removeConfig = async () => {
    setSavingMeta(true);
    try {
      await deleteOfferingConfig(offeringId, config.id);
      showToast('Formação removida.', 'success');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover formação.', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  const addMember = async () => {
    if (!memberInput.trim()) { showToast('Informe o ID do integrante (actor).', 'error'); return; }
    setBusyMember(true);
    try {
      await addConfigMember(offeringId, config.id, memberInput.trim());
      showToast('Integrante incluído.', 'success');
      setMemberInput('');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao incluir integrante.', 'error');
    } finally {
      setBusyMember(false);
    }
  };

  const removeMember = async (memberActorId: string) => {
    setBusyMember(true);
    try {
      await removeConfigMember(offeringId, config.id, memberActorId);
      showToast('Integrante removido.', 'success');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover integrante.', 'error');
    } finally {
      setBusyMember(false);
    }
  };

  return (
    <div className="config-card">
      <div className="field-row">
        <div className="field">
          <label>Rótulo</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label>Equipe</label>
          <input type="number" min={1} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
        </div>
        <div className="field">
          <label>Situação</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as OfferingConfigStatus)}>
            <option value="disponivel">Disponível</option>
            <option value="sob_consulta">Sob consulta</option>
          </select>
        </div>
        <div className="field">
          <label>Preço-base “a partir de” (R$)</label>
          <input type="text" inputMode="decimal" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} placeholder="opcional" />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-secondary" onClick={saveMeta} disabled={savingMeta}>
          {savingMeta ? 'Salvando…' : 'Salvar formação'}
        </button>
        <button className="btn-danger" onClick={removeConfig} disabled={savingMeta}>Remover</button>
        <button className="btn-secondary" onClick={() => setShowPrices((v) => !v)}>
          {showPrices ? 'Ocultar grade de preço' : 'Grade de preço'}
        </button>
      </div>

      {/* Line-up */}
      <div className="lineup">
        <label className="lineup-title">Line-up {config.lineupComplete ? '' : '(incompleto)'}</label>
        {config.members.length === 0 ? (
          <p className="empty-hint">Sem integrantes declarados.</p>
        ) : (
          <ul className="member-list">
            {config.members.map((m) => (
              <li key={m.memberActorId}>
                <span title={m.memberActorId}>#{m.memberActorId.slice(0, 8)}</span>
                <span className={`status-pill ${m.isActiveMember ? 'status-active' : 'status-suspended'}`}>
                  {m.isActiveMember ? 'ativo' : 'inativo'}
                </span>
                <button className="chip-x" disabled={busyMember} onClick={() => removeMember(m.memberActorId)} aria-label="Remover">×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="field-row">
          <div className="field">
            <label>Incluir integrante (ID do actor)</label>
            <input
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="cole o ID do actor da pessoa"
            />
          </div>
        </div>
        <button className="btn-secondary" onClick={addMember} disabled={busyMember}>
          Incluir no line-up
        </button>
        <p className="empty-hint">Line-up só se aplica a banda (provider grupo). Solo declara apenas o tamanho da equipe.</p>
      </div>

      {showPrices && <PriceGrid offeringId={offeringId} configId={config.id} />}
    </div>
  );
}

function PriceGrid({ offeringId, configId }: { offeringId: string; configId: string }) {
  const [cells, setCells] = useState<Record<string, string>>({}); // `${day}-${period}` → reais string
  const [loaded, setLoaded] = useState<Record<string, number>>({}); // baseline priceCents já persistido
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const keyOf = (day: number, period: OfferingConfigPeriodOfDay) => `${day}-${period}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { cells: persisted } = await listConfigPrices(offeringId, configId);
      const grid: Record<string, string> = {};
      const base: Record<string, number> = {};
      for (const c of persisted as OfferingConfigPriceCell[]) {
        grid[keyOf(c.dayOfWeek, c.periodOfDay)] = centsToReais(c.priceCents);
        base[keyOf(c.dayOfWeek, c.periodOfDay)] = c.priceCents;
      }
      setCells(grid);
      setLoaded(base);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar grade.', 'error');
    } finally {
      setLoading(false);
    }
  }, [offeringId, configId]);

  useEffect(() => { load(); }, [load]);

  const saveGrid = async () => {
    setSaving(true);
    try {
      // Diff célula-a-célula: define/atualiza as preenchidas-mudadas; remove as que foram esvaziadas.
      const ops: Array<Promise<void>> = [];
      for (const day of DAYS) {
        for (const period of PERIODS) {
          const k = keyOf(day.v, period.v);
          const raw = (cells[k] ?? '').trim();
          const hadBaseline = k in loaded;
          if (raw === '') {
            if (hadBaseline) ops.push(removeConfigPrice(offeringId, configId, { dayOfWeek: day.v, periodOfDay: period.v }));
            continue;
          }
          const cents = reaisToCents(raw);
          if (cents == null) { throw new Error(`Preço inválido em ${day.l}/${period.l}.`); }
          if (!hadBaseline || loaded[k] !== cents) {
            ops.push(setConfigPrice(offeringId, configId, { dayOfWeek: day.v, periodOfDay: period.v, priceCents: cents }));
          }
        }
      }
      if (ops.length === 0) {
        showToast('Nada a salvar na grade.', 'info');
      } else {
        await Promise.all(ops);
        showToast('Grade de preço salva.', 'success');
        await load();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar grade.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Carregando grade…</p>;

  return (
    <div className="price-grid-wrap">
      <div className="price-grid-scroll">
        <table className="price-grid">
          <thead>
            <tr>
              <th>Dia \ Período</th>
              {PERIODS.map((p) => <th key={p.v}>{p.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.v}>
                <th>{d.l}</th>
                {PERIODS.map((p) => {
                  const k = `${d.v}-${p.v}`;
                  return (
                    <td key={p.v}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cells[k] ?? ''}
                        onChange={(e) => setCells((prev) => ({ ...prev, [k]: e.target.value }))}
                        placeholder="R$"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="empty-hint">Célula vazia cai na base “a partir de” da formação; sem ela, na base da oferta.</p>
      <button className="btn-primary" onClick={saveGrid} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar grade'}
      </button>
    </div>
  );
}

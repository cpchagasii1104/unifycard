// src/pages/RentalResourceListPage.tsx
// /locacoes por MODO OPERANTE (ordem Clayton 2026-07-07 — freio "sem discovery" da SLICE-B revogado):
//  · CONSUMIR → descoberta ("o que você quer alugar?"): tipos como filtro + recursos ATIVOS de terceiros.
//  · OPERAR  → gestão do dono: cadastro COMPLETO (catálogo + tipo + cobrança REGISTRO/0151-A)
//              + disponibilidade pela AGENDA UNIVERSAL (owner_type='rentable_resource' — SSOT temporal,
//              anti-sobreposição no banco; NUNCA calendário paralelo).
// A verdade mora no backend: esta tela só projeta (vocabulários e conflitos são do motor).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { useOperatingMode } from '../hooks/useOperatingMode';
import { showToast } from '../components/common/Toast';
import PublishProfileIntentPrompt from '../components/PublishProfileIntentPrompt';
import {
  createRentableResource,
  listMyRentableResources,
  listActiveRentableResources,
  PRICING_UNIT_PT,
  type RentableResource,
  type RentableResourceType,
  type RentalPricingUnit,
} from '../api/rentals';
import { createAvailability } from '../api/availability';
import { searchCanonicalServices, type CanonicalService } from '../api/canonical-services';
import './RentalResourceListPage.css';

const RESOURCE_TYPE_LABEL: Record<RentableResourceType, string> = {
  equipment: 'Equipamento',
  vehicle: 'Veículo',
  property: 'Imóvel',
  space: 'Espaço',
  other: 'Outro',
};

const RESOURCE_TYPE_ICON: Record<RentableResourceType, string> = {
  equipment: '🔧',
  vehicle: '🚗',
  property: '🏠',
  space: '🏟️',
  other: '📦',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  retired: 'Aposentado',
};

const formatPrice = (r: RentableResource) =>
  r.priceCents != null && r.pricingUnit
    ? `R$ ${(r.priceCents / 100).toFixed(2).replace('.', ',')} · ${PRICING_UNIT_PT[r.pricingUnit]}`
    : 'Preço a combinar';

export default function RentalResourceListPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const { mode } = useOperatingMode();

  const [resources, setResources] = useState<RentableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RentableResourceType | 'all'>('all');

  // formulário de criação (operar)
  const [label, setLabel] = useState('');
  const [resourceType, setResourceType] = useState<RentableResourceType>('equipment');
  const [description, setDescription] = useState('');
  const [pricingUnit, setPricingUnit] = useState<RentalPricingUnit>('por_dia');
  const [priceReais, setPriceReais] = useState('');
  const [conceptQuery, setConceptQuery] = useState('');
  const [conceptOptions, setConceptOptions] = useState<CanonicalService[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<CanonicalService | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const publishProfileRef = useRef<() => Promise<void>>(async () => {});

  // disponibilidade inline por recurso (operar) — janela vai pra AGENDA UNIVERSAL
  const [availFor, setAvailFor] = useState<string | null>(null);
  const [availStart, setAvailStart] = useState('');
  const [availEnd, setAvailEnd] = useState('');
  const [availTimeStart, setAvailTimeStart] = useState('08:00');
  const [availTimeEnd, setAvailTimeEnd] = useState('18:00');
  const [availBusy, setAvailBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'operar') {
        if (!activeActor) { setResources([]); return; }
        setResources(await listMyRentableResources(activeActor.actor_id));
      } else {
        const all = await listActiveRentableResources();
        // descoberta = recursos de TERCEIROS (os meus eu gerencio no operar)
        setResources(all.filter((r) => r.ownerActorId !== activeActor?.actor_id));
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar recursos');
    } finally {
      setLoading(false);
    }
  }, [activeActor, mode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = conceptQuery.trim();
    if (q.length < 2) { setConceptOptions([]); return; }
    const t = setTimeout(() => {
      searchCanonicalServices(q).then(setConceptOptions).catch(() => setConceptOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [conceptQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept?.conceptId) { showToast('Escolha uma categoria existente do catálogo.', 'error'); return; }
    if (!label.trim()) { showToast('Informe um nome para o recurso.', 'error'); return; }
    setSubmitting(true);
    try {
      const cents = priceReais.trim() ? Math.round(parseFloat(priceReais.replace(',', '.')) * 100) : null;
      await createRentableResource({
        conceptId: selectedConcept.conceptId,
        resourceType,
        label: label.trim(),
        description: description.trim() || null,
        pricingUnit: cents != null ? pricingUnit : null,
        priceCents: cents,
      });
      await publishProfileRef.current();
      showToast('Recurso cadastrado. Agora adicione a disponibilidade. 🗓️', 'success');
      setShowForm(false);
      setLabel(''); setDescription(''); setPriceReais('');
      setSelectedConcept(null); setConceptQuery('');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cadastrar recurso', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAvailability = async (resourceId: string) => {
    if (!availStart) { showToast('Informe a data de início da janela.', 'error'); return; }
    setAvailBusy(true);
    try {
      await createAvailability({
        ownerType: 'rentable_resource',
        ownerId: resourceId,
        startDatetime: `${availStart}T${availTimeStart || '00:00'}:00`,
        endDatetime: `${availEnd || availStart}T${availTimeEnd || '23:59'}:00`,
      });
      showToast('Janela de disponibilidade registrada na Agenda. ✅', 'success');
      setAvailFor(null); setAvailStart(''); setAvailEnd('');
    } catch (err: any) {
      // conflito de sobreposição vem do BANCO (advisory lock + trigger) — a verdade é do motor
      showToast(err?.message || 'Erro ao registrar disponibilidade', 'error');
    } finally {
      setAvailBusy(false);
    }
  };

  if (!activeActor) {
    return <div className="rrl-page"><p>Selecione um actor para usar Locações.</p></div>;
  }

  const visible = typeFilter === 'all' ? resources : resources.filter((r) => r.resourceType === typeFilter);

  // ── MODO CONSUMIR: descoberta (análogo ao Fazer compras) ──
  if (mode === 'consumir') {
    return (
      <div className="rrl-page">
        <div className="rrl-header">
          <div>
            <h1 className="rrl-title">🔑 Alugar algo</h1>
            <p className="rrl-subtitle">Imóveis, veículos, equipamentos e espaços disponíveis na comunidade.</p>
          </div>
        </div>

        <div className="rrl-type-hub">
          <button type="button" className={`rrl-type-card ${typeFilter === 'all' ? 'selected' : ''}`} onClick={() => setTypeFilter('all')}>
            <span className="rrl-type-icon">🔎</span><strong>Tudo</strong>
          </button>
          {(Object.keys(RESOURCE_TYPE_LABEL) as RentableResourceType[]).map((t) => (
            <button key={t} type="button" className={`rrl-type-card ${typeFilter === t ? 'selected' : ''}`} onClick={() => setTypeFilter(t)}>
              <span className="rrl-type-icon">{RESOURCE_TYPE_ICON[t]}</span>
              <strong>{RESOURCE_TYPE_LABEL[t]}s</strong>
            </button>
          ))}
        </div>

        {loading && <p className="rrl-status">Carregando…</p>}
        {error && <p className="rrl-status rrl-error">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <p className="rrl-status">Nenhum recurso disponível {typeFilter !== 'all' ? `em ${RESOURCE_TYPE_LABEL[typeFilter as RentableResourceType]}s` : ''} ainda — a comunidade está começando. Troque para OPERAR e seja o primeiro a anunciar. 🚀</p>
        )}

        <div className="rrl-grid">
          {visible.map((r) => (
            <button key={r.id} type="button" className="rrl-card" onClick={() => navigate(`/locacoes/${r.id}`)}>
              <span className="rrl-card-type">{RESOURCE_TYPE_ICON[r.resourceType]} {RESOURCE_TYPE_LABEL[r.resourceType]}</span>
              <span className="rrl-card-label">{r.label}</span>
              <span className="rrl-card-price">{formatPrice(r)}</span>
              {r.description && <span className="rrl-card-desc">{r.description.slice(0, 90)}</span>}
              <span className="rrl-card-cta">Ver disponibilidade →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── MODO OPERAR: gestão do dono ──
  return (
    <div className="rrl-page">
      <div className="rrl-header">
        <div>
          <h1 className="rrl-title">Meus Recursos Alugáveis</h1>
          <p className="rrl-subtitle">Equipamentos, veículos, imóveis e espaços que você disponibiliza para locação.</p>
        </div>
        <button type="button" className="rrl-new-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Novo recurso'}
        </button>
      </div>

      {showForm && (
        <form className="rrl-form" onSubmit={handleCreate}>
          <label className="rrl-field">
            Categoria (catálogo)
            <input type="text" placeholder="Buscar categoria existente…" value={conceptQuery}
              onChange={(e) => { setConceptQuery(e.target.value); setSelectedConcept(null); }} />
            {conceptOptions.length > 0 && !selectedConcept && (
              <ul className="rrl-concept-options">
                {conceptOptions.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setSelectedConcept(c); setConceptQuery(c.name); setConceptOptions([]); }}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedConcept && <span className="rrl-concept-selected">✓ {selectedConcept.name}</span>}
          </label>

          <label className="rrl-field">
            Tipo de recurso
            <select value={resourceType} onChange={(e) => setResourceType(e.target.value as RentableResourceType)}>
              {(Object.keys(RESOURCE_TYPE_LABEL) as RentableResourceType[]).map((t) => (
                <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label className="rrl-field">
            Nome do recurso
            <input type="text" placeholder="Ex.: Furadeira Bosch, Fusca 1978…" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
          </label>

          <div className="rrl-row">
            <label className="rrl-field">
              Cobrança
              <select value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value as RentalPricingUnit)}>
                {(Object.keys(PRICING_UNIT_PT) as RentalPricingUnit[]).map((u) => (
                  <option key={u} value={u}>{PRICING_UNIT_PT[u]}</option>
                ))}
              </select>
            </label>
            <label className="rrl-field">
              Preço anunciado (R$)
              <input type="text" inputMode="decimal" placeholder="Ex.: 150,00 (opcional)" value={priceReais} onChange={(e) => setPriceReais(e.target.value)} />
            </label>
          </div>
          <p className="rrl-hint">💡 O preço é o ANÚNCIO — o pagamento em si ainda não acontece pelo sistema.</p>

          <label className="rrl-field">
            Descrição (opcional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          </label>

          <PublishProfileIntentPrompt
            contextLabel="Seu recurso será achável para locação."
            onRegister={(fn) => { publishProfileRef.current = fn; }}
          />

          <button type="submit" className="rrl-submit-btn" disabled={submitting}>
            {submitting ? 'Cadastrando…' : 'Cadastrar recurso'}
          </button>
        </form>
      )}

      {loading && <p className="rrl-status">Carregando…</p>}
      {error && <p className="rrl-status rrl-error">{error}</p>}
      {!loading && !error && resources.length === 0 && (
        <p className="rrl-status">Nenhum recurso cadastrado ainda.</p>
      )}

      <div className="rrl-grid">
        {resources.map((r) => (
          <div key={r.id} className="rrl-card rrl-card--own">
            <span className={`rrl-status-badge rrl-status-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            <span className="rrl-card-type">{RESOURCE_TYPE_ICON[r.resourceType]} {RESOURCE_TYPE_LABEL[r.resourceType]}</span>
            <span className="rrl-card-label">{r.label}</span>
            <span className="rrl-card-price">{formatPrice(r)}</span>
            <div className="rrl-card-actions">
              <button type="button" onClick={() => navigate(`/locacoes/${r.id}`)}>Detalhes</button>
              <button type="button" onClick={() => setAvailFor(availFor === r.id ? null : r.id)}>
                {availFor === r.id ? 'Fechar' : '🗓️ Disponibilidade'}
              </button>
            </div>
            {availFor === r.id && (
              <div className="rrl-avail-form">
                <div className="rrl-row">
                  <label className="rrl-field">De<input type="date" value={availStart} onChange={(e) => setAvailStart(e.target.value)} /></label>
                  <label className="rrl-field">Até<input type="date" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)} /></label>
                </div>
                <div className="rrl-row">
                  <label className="rrl-field">Das<input type="time" value={availTimeStart} onChange={(e) => setAvailTimeStart(e.target.value)} /></label>
                  <label className="rrl-field">Às<input type="time" value={availTimeEnd} onChange={(e) => setAvailTimeEnd(e.target.value)} /></label>
                </div>
                <button type="button" className="rrl-submit-btn" disabled={availBusy} onClick={() => handleAddAvailability(r.id)}>
                  {availBusy ? 'Registrando…' : 'Registrar janela na Agenda'}
                </button>
                <p className="rrl-hint">A Agenda universal recusa janelas sobrepostas — se o recurso já estiver comprometido no período, o sistema barra sozinho.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

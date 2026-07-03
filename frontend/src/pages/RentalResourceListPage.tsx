// src/pages/RentalResourceListPage.tsx
// F-RENTAL-RESOURCE-SURFACE-SLICE-B — gestão do dono: listar/criar recursos alugáveis do actor
// ativo. Concept escolhido do catálogo governado (searchCanonicalServices) — nunca inventado aqui
// (Lei de Coerência). Sem discovery de recursos de terceiros (freio doutrinário "sem discovery" —
// ver mapa.png/BASE.png — essa fatia é só gestão do dono; achar recurso de terceiro é via link direto,
// não vitrine).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import {
  createRentableResource,
  listMyRentableResources,
  type RentableResource,
  type RentableResourceType,
} from '../api/rentals';
import { searchCanonicalServices, type CanonicalService } from '../api/canonical-services';
import './RentalResourceListPage.css';

const RESOURCE_TYPE_LABEL: Record<RentableResourceType, string> = {
  equipment: 'Equipamento',
  vehicle: 'Veículo',
  property: 'Imóvel',
  space: 'Espaço',
  other: 'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  retired: 'Aposentado',
};

export default function RentalResourceListPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  const [resources, setResources] = useState<RentableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // formulário de criação
  const [label, setLabel] = useState('');
  const [resourceType, setResourceType] = useState<RentableResourceType>('equipment');
  const [description, setDescription] = useState('');
  const [conceptQuery, setConceptQuery] = useState('');
  const [conceptOptions, setConceptOptions] = useState<CanonicalService[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<CanonicalService | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!activeActor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listMyRentableResources(activeActor.actor_id);
      setResources(list);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar recursos');
    } finally {
      setLoading(false);
    }
  }, [activeActor]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = conceptQuery.trim();
    if (q.length < 2) {
      setConceptOptions([]);
      return;
    }
    const t = setTimeout(() => {
      searchCanonicalServices(q).then(setConceptOptions).catch(() => setConceptOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [conceptQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcept?.conceptId) {
      showToast('Escolha uma categoria existente do catálogo para o recurso.', 'error');
      return;
    }
    if (!label.trim()) {
      showToast('Informe um nome para o recurso.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createRentableResource({
        conceptId: selectedConcept.conceptId,
        resourceType,
        label: label.trim(),
        description: description.trim() || null,
      });
      showToast('Recurso cadastrado.', 'success');
      setShowForm(false);
      setLabel('');
      setDescription('');
      setSelectedConcept(null);
      setConceptQuery('');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao cadastrar recurso', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeActor) {
    return <div className="rrl-page"><p>Selecione um actor para gerenciar recursos alugáveis.</p></div>;
  }

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
            <input
              type="text"
              placeholder="Buscar categoria existente…"
              value={conceptQuery}
              onChange={(e) => { setConceptQuery(e.target.value); setSelectedConcept(null); }}
            />
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

          <label className="rrl-field">
            Descrição (opcional)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          </label>

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
          <button key={r.id} type="button" className="rrl-card" onClick={() => navigate(`/locacoes/${r.id}`)}>
            <span className={`rrl-status-badge rrl-status-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            <span className="rrl-card-type">{RESOURCE_TYPE_LABEL[r.resourceType]}</span>
            <span className="rrl-card-label">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

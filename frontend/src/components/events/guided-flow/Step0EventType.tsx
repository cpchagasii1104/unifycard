// src/components/events/guided-flow/Step0EventType.tsx
// ETAPA 0 — CONCEPT-FIRST (F-EVENT-CONCEPT-FIRST-MODEL, GO Clayton 2026-07-08).
// Identidade do evento = FORMATO (concept) + TEMA (concept, opcional) + CATEGORIAS (facets de descoberta).
// TUDO vem do backend (/api/events/taxonomy + /themes/search) — o frontend NUNCA enumera formato/categoria.
// Plateia (AudiencePicker) segue no topo (plano separado). NÃO chama backend aqui (pre-draft).

import { useState, useEffect } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import { useAudienceOptions } from '../../../hooks/useAudienceOptions';
import AudiencePicker from '../../composer/AudiencePicker';
import { resolveAudiencePayload } from '../../composer/audience-payload';
import { getEventTaxonomy, searchEventThemes, type EventTaxonomy } from '../../../api/events';
import './Step0EventType.css';

interface Step0EventTypeProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: (updatedData?: Partial<GuidedFlowData>) => void;
  isLoading: boolean;
  /** CARRY-OVER: plateia herdada do composer inicial — abre já selecionada (não pergunta do zero). */
  initialAudienceKeys?: string[];
}

export default function Step0EventType({ data, onUpdate, onComplete, isLoading, initialAudienceKeys }: Step0EventTypeProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Plateia via hook central (fonte única /audience-options). Carry-over do composer inicial.
  const { options: audienceOptions } = useAudienceOptions();
  const [audienceKeys, setAudienceKeys] = useState<string[]>(initialAudienceKeys ?? []);
  const inheritedAudience = (initialAudienceKeys?.length ?? 0) > 0;
  const [audienceExpanded, setAudienceExpanded] = useState<boolean>(!inheritedAudience);
  const audienceSummary = audienceKeys
    .map((k) => audienceOptions.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(' + ') || 'Público';

  // Taxonomia SERVER-DRIVEN: formatos + categorias (o front só projeta).
  const [taxonomy, setTaxonomy] = useState<EventTaxonomy | null>(null);
  useEffect(() => { getEventTaxonomy().then(setTaxonomy).catch(() => setTaxonomy(null)); }, []);

  const [formatId, setFormatId] = useState<string | null>(data.eventFormatConceptId);
  const [formatLabel, setFormatLabel] = useState<string | null>(data.eventFormatLabel);
  const [facets, setFacets] = useState<string[]>(data.categoryFacets ?? []);

  // Tema (opcional): busca governada por CONCEPT. Multi-seleção via chips.
  const [themeQuery, setThemeQuery] = useState('');
  const [themeResults, setThemeResults] = useState<Array<{ conceptId: string; label: string }>>([]);
  const [themes, setThemes] = useState<Array<{ conceptId: string; label: string }>>(
    (data.themeConceptIds ?? []).map((id, i) => ({ conceptId: id, label: data.themeLabels?.[i] ?? id }))
  );
  useEffect(() => {
    const t = themeQuery.trim();
    if (t.length < 2) { setThemeResults([]); return; }
    let live = true;
    searchEventThemes(t).then((r) => { if (live) setThemeResults(r); }).catch(() => { if (live) setThemeResults([]); });
    return () => { live = false; };
  }, [themeQuery]);

  const toggleFacet = (key: string) => {
    setFacets((prev) => prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]);
    setErrorMessage(null);
  };
  const addTheme = (t: { conceptId: string; label: string }) => {
    if (!themes.find((x) => x.conceptId === t.conceptId)) setThemes([...themes, t]);
    setThemeQuery(''); setThemeResults([]);
  };
  const removeTheme = (id: string) => setThemes(themes.filter((t) => t.conceptId !== id));

  const handleContinue = () => {
    setErrorMessage(null);
    if (audienceKeys.length === 0) { setErrorMessage('Selecione para quem é este evento'); return; }
    if (!formatId) { setErrorMessage('Escolha o formato do evento'); return; }

    const aud = resolveAudiencePayload(audienceOptions, audienceKeys);
    const updatedData: Partial<GuidedFlowData> = {
      eventFormatConceptId: formatId,
      eventFormatLabel: formatLabel,
      themeConceptIds: themes.map((t) => t.conceptId),
      themeLabels: themes.map((t) => t.label),
      categoryFacets: facets,
      visibility: audienceKeys.length > 0 ? aud.visibility : 'public',
      audience_relationship_types: aud.audienceRelationshipTypes,
    };
    onUpdate(updatedData);
    onComplete(updatedData);
  };

  return (
    <div className="step0-event-type">
      <div className="step-header">
        <h2>Que evento você quer organizar?</h2>
        <p className="step-hint">Esta é apenas uma exploração. Nada será criado ainda.</p>
      </div>

      <div className="step-content">
        {/* Plateia primeiro (mesma ordem do composer). Herança colapsada quando vem do composer inicial. */}
        <div className="form-section">
          {audienceExpanded ? (
            <AudiencePicker options={audienceOptions} selectedKeys={audienceKeys} onChange={(k) => { setAudienceKeys(k); setErrorMessage(null); }} title="1 · Para quem é este evento?" />
          ) : (
            <div className="audience-collapsed">
              <span className="audience-collapsed-title">Plateia</span>
              <span className="audience-collapsed-value">{audienceSummary}</span>
              <button type="button" className="audience-collapsed-alter" onClick={() => setAudienceExpanded(true)}>Alterar</button>
            </div>
          )}
        </div>

        {/* FORMATO (obrigatório) — do backend. Ex.: festa, campeonato, show, reunião, workshop… */}
        <div className="form-section">
          <label className="form-label">2 · Formato do evento</label>
          {!taxonomy ? (
            <p className="step-hint">Carregando formatos…</p>
          ) : (
            <div className="option-grid">
              {taxonomy.formats.map((f) => (
                <button key={f.conceptId} type="button"
                  className={`option-button ${formatId === f.conceptId ? 'selected' : ''}`}
                  onClick={() => { setFormatId(f.conceptId); setFormatLabel(f.label); setErrorMessage(null); }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TEMA (opcional) — CONCEPT buscável. Composição formato × tema (ex.: campeonato + sinuca). */}
        <div className="form-section">
          <label className="form-label">3 · Tema (opcional)</label>
          {themes.length > 0 && (
            <div className="theme-chips">
              {themes.map((t) => (
                <span key={t.conceptId} className="theme-chip">{t.label}<button type="button" onClick={() => removeTheme(t.conceptId)} aria-label="remover">✕</button></span>
              ))}
            </div>
          )}
          <input type="text" className="form-textarea" placeholder="Ex.: sinuca, futebol, carros antigos, música…"
            value={themeQuery} onChange={(e) => setThemeQuery(e.target.value)} />
          {themeResults.length > 0 && (
            <div className="theme-results">
              {themeResults.map((t) => (
                <button key={t.conceptId} type="button" className="theme-result" onClick={() => addTheme(t)}>{t.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* CATEGORIAS (facets de descoberta, múltiplas) — do backend. */}
        <div className="form-section">
          <label className="form-label">4 · Categorias de descoberta (opcional)</label>
          {taxonomy && (
            <div className="option-grid">
              {taxonomy.categories.map((c) => (
                <button key={c.key} type="button"
                  className={`option-button ${facets.includes(c.key) ? 'selected' : ''}`}
                  onClick={() => toggleFacet(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {errorMessage && <div className="step-error">{errorMessage}</div>}
      </div>

      <div className="step-actions">
        <button className="step-button step-button-primary" onClick={handleContinue} disabled={isLoading}>
          Continuar
        </button>
      </div>
    </div>
  );
}

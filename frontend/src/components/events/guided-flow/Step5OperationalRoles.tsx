// src/components/events/guided-flow/Step5OperationalRoles.tsx
// ETAPA 5 — Operação (necessidades operacionais SUGERIDAS) · F-EVENT-ORCHESTRATION-PHASE-B-WRITE.
// SUBSTITUI a lista hardcoded (food/music/decoration/photography/security) + o operational_roles MORTO
// (nunca era persistido). Agora: LÊ GET /events/:id/orchestration-suggestions (governadas por template do
// formato), o organizador seleciona/remove, e GRAVA por needConceptId em event_operational_needs (POST/DELETE).
// SSOT = concepts.concept_id; nada de texto livre/slug/category. NÃO dispara demanda/RFQ/booking/agenda/dinheiro.

import { useState, useEffect } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import {
  getOrchestrationSuggestions,
  getOperationalNeeds,
  addOperationalNeed,
  removeOperationalNeed,
  type OrchestrationSuggestion,
} from '../../../api/events';
import './Step5OperationalRoles.css';

interface Step5OperationalRolesProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
  isLoading: boolean;
}

export default function Step5OperationalRoles({ data, onComplete, isLoading = false }: Step5OperationalRolesProps) {
  const eventId = data.event_id;
  const [suggestions, setSuggestions] = useState<OrchestrationSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    let live = true;
    Promise.all([getOrchestrationSuggestions(eventId), getOperationalNeeds(eventId)])
      .then(([sug, needs]) => {
        if (!live) return;
        setSuggestions(sug);
        setSelected(new Set(needs.map((n) => n.needConceptId)));
      })
      .catch(() => { if (live) setError('Não foi possível carregar as sugestões.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [eventId]);

  const toggle = async (needConceptId: string) => {
    if (!eventId || busy) return;
    setBusy(needConceptId);
    setError(null);
    const isOn = selected.has(needConceptId);
    try {
      if (isOn) {
        await removeOperationalNeed(eventId, needConceptId);
        setSelected((prev) => { const n = new Set(prev); n.delete(needConceptId); return n; });
      } else {
        await addOperationalNeed(eventId, needConceptId);
        setSelected((prev) => new Set(prev).add(needConceptId));
      }
    } catch {
      setError('Não foi possível salvar essa necessidade.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="step5-operational-roles">
      <div className="step-header">
        <h2>Operação (necessidades do evento)</h2>
        <p className="step-hint">
          Sugestões do formato do evento — selecione as que você vai precisar. É só o combinado operacional,
          não contrata ninguém nem envia pedido.
        </p>
      </div>

      <div className="step-content">
        {loading ? (
          <p className="step-hint">Carregando sugestões…</p>
        ) : suggestions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-message">Sem sugestões para este formato.</p>
            <p className="empty-state-hint">Você pode continuar sem necessidades operacionais.</p>
          </div>
        ) : (
          <div className="option-grid">
            {suggestions.map((s) => (
              <button
                key={s.needConceptId}
                type="button"
                className={`option-button ${selected.has(s.needConceptId) ? 'selected' : ''}`}
                onClick={() => toggle(s.needConceptId)}
                disabled={busy === s.needConceptId}
              >
                {s.label}{s.isRequired ? ' *' : ''}
              </button>
            ))}
          </div>
        )}
        {error && <div className="step-error">{error}</div>}
      </div>

      <div className="step-actions">
        <button className="step-button step-button-primary" onClick={onComplete} disabled={isLoading}>
          {isLoading ? 'Carregando preview...' : 'Ver Preview Econômico'}
        </button>
      </div>
    </div>
  );
}

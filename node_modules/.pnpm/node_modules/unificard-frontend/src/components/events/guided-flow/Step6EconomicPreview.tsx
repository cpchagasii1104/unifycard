// src/components/events/guided-flow/Step6EconomicPreview.tsx
// ETAPA 6 — Preview Econômico (TEST)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Chama GET /events/:id/v2/summary
// - Mostra breakdown por papel
// - Moeda TEST
// - Faixas / cenários
// - PROIBIDO: valores finais, "vai custar X", qualquer CTA econômico

import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step6EconomicPreview.css';

interface Step6EconomicPreviewProps {
  data: GuidedFlowData;
  economicPreview: any | null;
  onComplete: () => void;
}

export default function Step6EconomicPreview({ economicPreview, onComplete }: Step6EconomicPreviewProps) {
  return (
    <div className="step6-economic-preview">
      <div className="step-header">
        <h2>Preview Econômico (TEST)</h2>
        <p className="step-hint">
          ⚠️ Esta é uma simulação informacional com moeda TEST. Nenhum valor é final.
        </p>
      </div>

      <div className="step-content">
        {economicPreview ? (
          <div className="preview-content">
            <div className="preview-box">
              <h3>Simulação (TEST)</h3>
              {economicPreview.status === 'simulated' && (
                <div>
                  <p><strong>Moeda:</strong> {economicPreview.currency || 'TEST'}</p>
                  {economicPreview.total_amount_cents && (
                    <p>
                      <strong>Intervalo estimado:</strong>{' '}
                      R$ {(economicPreview.total_amount_cents / 100).toFixed(2)} (simulado)
                    </p>
                  )}
                  {economicPreview.notes && (
                    <p className="preview-notes">{economicPreview.notes}</p>
                  )}
                </div>
              )}
              {economicPreview.status === 'not_applicable' && (
                <p>{economicPreview.notes || 'Evento não possui preço de ingresso para simulação econômica.'}</p>
              )}
            </div>

            <div className="warning-box">
              <p>
                <strong>⚠️ ATENÇÃO:</strong> Este é apenas um preview simulado com moeda TEST.
                Nenhum valor é final. Nada foi pago, reservado ou contratado.
              </p>
            </div>
          </div>
        ) : (
          <div className="preview-loading">
            <p>Carregando preview econômico...</p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
        >
          Ver Resumo Final
        </button>
      </div>
    </div>
  );
}


// src/components/events/EventCheckInModal.tsx
// Modal de Confirmação de Check-in - Bloco 3.3
// Exibe confirmação e impacto real gerado pelo check-in

import { type CheckInResponse } from '../../api/cultural';
import { safeNumber } from '../../utils/guardrails';
import TransactionImpactSummary from '../social/TransactionImpactSummary';
import './EventCheckInModal.css';

interface EventCheckInModalProps {
  checkInResult: CheckInResponse;
  eventTitle: string;
  onClose: () => void;
  onBackToFeed?: () => void;
}

export default function EventCheckInModal({
  checkInResult,
  eventTitle,
  onClose,
  onBackToFeed,
}: EventCheckInModalProps) {
  // Bloco 3.3: Usar apenas dados reais retornados pela API (não calcular)
  const impactGenerated = safeNumber(checkInResult.impact_generated, 0);
  const checkInTime = new Date(checkInResult.check_in.check_in_time).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="event-checkin-modal-overlay" onClick={onClose}>
      <div className="event-checkin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-checkin-success">
          <div className="success-icon">✓</div>
          <h2>Check-in Realizado!</h2>
          <p>Você confirmou presença no evento <strong>{eventTitle}</strong>.</p>
          
          <div className="checkin-details">
            <div className="checkin-detail-item">
              <span className="detail-label">Horário:</span>
              <span className="detail-value">{checkInTime}</span>
            </div>
            <div className="checkin-detail-item">
              <span className="detail-label">Método:</span>
              <span className="detail-value">
                {checkInResult.check_in.method === 'QR_CODE' ? 'QR Code' :
                 checkInResult.check_in.method === 'MANUAL' ? 'Manual' :
                 checkInResult.check_in.method === 'AUTO' ? 'Automático' :
                 checkInResult.check_in.method}
              </span>
            </div>
          </div>

          {/* Bloco 3.3: Exibir impacto real gerado (quando existir) */}
          {impactGenerated > 0 && (
            <div className="checkin-impact-section">
              <div className="impact-header">
                <span className="impact-icon">💚</span>
                <h3>Impacto Gerado</h3>
              </div>
              <div className="impact-amount">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(impactGenerated / 100)}
              </div>
              <p className="impact-description">
                Seu check-in gerou impacto no ecossistema local!
              </p>
            </div>
          )}

          {/* Mini-resumo de impacto (se houver valor significativo) */}
          {impactGenerated > 0 && (
            <TransactionImpactSummary
              totalAmount={impactGenerated}
              currency="BRL"
              onViewLedger={() => {
                window.location.href = '/social/ledger';
              }}
              onBackToFeed={() => {
                if (onBackToFeed) {
                  onBackToFeed();
                }
                onClose();
              }}
            />
          )}

          {/* Ações */}
          <div className="checkin-actions">
            {impactGenerated > 0 ? (
              <>
                <button
                  className="checkin-action-btn checkin-action-ledger"
                  onClick={() => {
                    window.location.href = '/social/ledger';
                  }}
                >
                  Ver no Ledger
                </button>
                <button
                  className="checkin-action-btn checkin-action-feed"
                  onClick={() => {
                    if (onBackToFeed) {
                      onBackToFeed();
                    }
                    onClose();
                  }}
                >
                  Voltar ao Feed
                </button>
              </>
            ) : (
              <button
                className="checkin-action-btn checkin-action-close"
                onClick={onClose}
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}















// src/components/social/OccupancyModelConfig.tsx
// Componente para configurar modelo de ocupação (sugestão + ajuste manual)

import { useState } from 'react';
import type { OccupancyType } from '../../utils/intent-classifier';
import './OccupancyModelConfig.css';

interface OccupancyModelConfigProps {
  suggestedModel?: {
    type: OccupancyType;
    confidence: number;
    reasoning: string;
    requiresReservation?: boolean;
    reservationPrice?: number;
  };
  onConfirm: (model: {
    type: OccupancyType;
    requiresReservation: boolean;
    reservationPrice?: number;
    config?: any;
  }) => void;
  onCancel?: () => void;
}

export default function OccupancyModelConfig({
  suggestedModel,
  onConfirm,
  onCancel,
}: OccupancyModelConfigProps) {
  const [selectedType, setSelectedType] = useState<OccupancyType>(
    suggestedModel?.type || 'PERSON'
  );
  const [requiresReservation, setRequiresReservation] = useState(
    suggestedModel?.requiresReservation ?? false
  );
  const [reservationPrice, setReservationPrice] = useState<string>(
    suggestedModel?.reservationPrice?.toString() || ''
  );

  const handleConfirm = () => {
    onConfirm({
      type: selectedType,
      requiresReservation,
      reservationPrice: reservationPrice ? parseFloat(reservationPrice) : undefined,
    });
  };

  return (
    <div className="occupancy-model-config">
      <div className="config-header">
        <h3>Como funciona a ocupação?</h3>
        {suggestedModel && (
          <div className="suggestion-badge">
            <span className="suggestion-icon">💡</span>
            <span className="suggestion-text">{suggestedModel.reasoning}</span>
            {suggestedModel.confidence < 0.8 && (
              <span className="confidence-warning"> (confiança: {Math.round(suggestedModel.confidence * 100)}%)</span>
            )}
          </div>
        )}
      </div>

      <div className="config-options">
        <label className="config-option">
          <input
            type="radio"
            name="occupancy-type"
            value="TABLE"
            checked={selectedType === 'TABLE'}
            onChange={(e) => setSelectedType(e.target.value as OccupancyType)}
          />
          <div className="option-content">
            <div className="option-icon">🪑</div>
            <div className="option-info">
              <div className="option-title">Por Mesa</div>
              <div className="option-description">Restaurante, jantar, área VIP</div>
            </div>
          </div>
        </label>

        <label className="config-option">
          <input
            type="radio"
            name="occupancy-type"
            value="PERSON"
            checked={selectedType === 'PERSON'}
            onChange={(e) => setSelectedType(e.target.value as OccupancyType)}
          />
          <div className="option-content">
            <div className="option-icon">👥</div>
            <div className="option-info">
              <div className="option-title">Por Pessoa (em pé)</div>
              <div className="option-description">Show, bar, evento aberto</div>
            </div>
          </div>
        </label>

        <label className="config-option">
          <input
            type="radio"
            name="occupancy-type"
            value="SLOT"
            checked={selectedType === 'SLOT'}
            onChange={(e) => setSelectedType(e.target.value as OccupancyType)}
          />
          <div className="option-content">
            <div className="option-icon">📅</div>
            <div className="option-info">
              <div className="option-title">Por Horário (Agenda)</div>
              <div className="option-description">Workshop, consulta, serviço</div>
            </div>
          </div>
        </label>

        <label className="config-option">
          <input
            type="radio"
            name="occupancy-type"
            value="HYBRID"
            checked={selectedType === 'HYBRID'}
            onChange={(e) => setSelectedType(e.target.value as OccupancyType)}
          />
          <div className="option-content">
            <div className="option-icon">🔄</div>
            <div className="option-info">
              <div className="option-title">Híbrido</div>
              <div className="option-description">Bar com mesas + pista</div>
            </div>
          </div>
        </label>
      </div>

      <div className="config-details">
        <label className="config-checkbox">
          <input
            type="checkbox"
            checked={requiresReservation}
            onChange={(e) => setRequiresReservation(e.target.checked)}
          />
          <span>Exigir reserva</span>
        </label>

        {requiresReservation && (
          <div className="config-price">
            <label>
              Preço da reserva (R$):
              <input
                type="number"
                step="0.01"
                min="0"
                value={reservationPrice}
                onChange={(e) => setReservationPrice(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <small>Deixe em branco para reserva gratuita</small>
          </div>
        )}
      </div>

      <div className="config-actions">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-cancel">
            Cancelar
          </button>
        )}
        <button type="button" onClick={handleConfirm} className="btn-confirm">
          Confirmar
        </button>
      </div>
    </div>
  );
}














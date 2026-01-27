// frontend/src/components/compatibility/ServiceSetupSelector.tsx
// Seletor de Setup de Serviço
// 🔴 BLINDAGEM: Seleção explícita, sem automação

import { useState } from 'react';
import type { ServiceSetupPackage } from '../../types/compatibility';
import './ServiceSetupSelector.css';

interface ServiceSetupSelectorProps {
  setups: ServiceSetupPackage[];
  selectedSetupId?: string;
  onSelect: (setupId: string) => void;
}

export default function ServiceSetupSelector({
  setups,
  selectedSetupId,
  onSelect,
}: ServiceSetupSelectorProps) {
  const [expandedSetupId, setExpandedSetupId] = useState<string | null>(null);

  if (setups.length === 0) {
    return (
      <div className="service-setup-selector">
        <p className="no-setups">Nenhum setup disponível para este serviço.</p>
      </div>
    );
  }

  return (
    <div className="service-setup-selector">
      <h4>Escolha o Setup:</h4>
      <div className="setups-list">
        {setups.map((setup) => (
          <div
            key={setup.id}
            className={`setup-card ${selectedSetupId === setup.id ? 'selected' : ''}`}
            onClick={() => onSelect(setup.id)}
          >
            <div className="setup-header">
              <input
                type="radio"
                name="setup"
                value={setup.id}
                checked={selectedSetupId === setup.id}
                onChange={() => onSelect(setup.id)}
              />
              <label className="setup-label">
                <strong>{setup.label}</strong>
                {setup.priceModifier !== 1 && (
                  <span className="price-modifier">
                    {setup.priceModifier > 1 ? '+' : ''}
                    {((setup.priceModifier - 1) * 100).toFixed(0)}%
                  </span>
                )}
              </label>
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSetupId(expandedSetupId === setup.id ? null : setup.id);
                }}
              >
                {expandedSetupId === setup.id ? '▼' : '▶'}
              </button>
            </div>

            {expandedSetupId === setup.id && (
              <div className="setup-details">
                {setup.brings.length > 0 && (
                  <div className="setup-section">
                    <strong>Artista traz:</strong>
                    <ul>
                      {setup.brings.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {setup.requires.length > 0 && (
                  <div className="setup-section">
                    <strong>Local deve ter (obrigatório):</strong>
                    <ul>
                      {setup.requires.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {setup.optional && setup.optional.length > 0 && (
                  <div className="setup-section">
                    <strong>Local pode ter (opcional):</strong>
                    <ul>
                      {setup.optional.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(setup.minCapacityClass || setup.maxCapacityClass) && (
                  <div className="setup-section">
                    <strong>Capacidade suportada:</strong>
                    <p>
                      {setup.minCapacityClass && setup.maxCapacityClass
                        ? `${setup.minCapacityClass} - ${setup.maxCapacityClass}`
                        : setup.minCapacityClass
                        ? `Mínimo: ${setup.minCapacityClass}`
                        : `Máximo: ${setup.maxCapacityClass}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}





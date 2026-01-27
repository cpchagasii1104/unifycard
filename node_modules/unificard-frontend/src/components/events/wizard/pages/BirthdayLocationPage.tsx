// frontend/src/components/events/wizard/pages/BirthdayLocationPage.tsx
// FASE 5 — PÁGINA: Local do Evento
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayLocationPageProps {
  eventSpec: {
    answers?: {
      location?: {
        has_venue?: boolean;
        address?: {
          cep?: string;
          number?: string;
          complement?: string;
        };
        region?: {
          city?: string;
          area?: string;
        };
        desired_venue_types?: ("SALAO" | "CHACARA" | "CLUBE" | "ESPACO_INFANTIL" | "CASA_EVENTOS" | "INDIFERENTE" | "NAO_SEI")[];
        provided_items?: ("MESAS" | "CADEIRAS" | "COZINHA" | "SOM" | "ILUMINACAO" | "ESPACO_INFANTIL" | "AREA_EXTERNA" | "ACESSIBILIDADE")[];
      };
    };
  };
  onChange: (partialSpec: {
    location?: {
      has_venue?: boolean;
      address?: {
        cep?: string;
        number?: string;
        complement?: string;
      };
      region?: {
        city?: string;
        area?: string;
      };
      desired_venue_types?: ("SALAO" | "CHACARA" | "CLUBE" | "ESPACO_INFANTIL" | "CASA_EVENTOS" | "INDIFERENTE" | "NAO_SEI")[];
      provided_items?: ("MESAS" | "CADEIRAS" | "COZINHA" | "SOM" | "ILUMINACAO" | "ESPACO_INFANTIL" | "AREA_EXTERNA" | "ACESSIBILIDADE")[];
    };
  }) => void;
}

/**
 * BirthdayLocationPage
 * 
 * Objetivo: Declarar situação e intenção de local do evento
 * Campos EventSpec permitidos:
 * - location.has_venue
 * - location.address.cep
 * - location.address.number
 * - location.address.complement
 * - location.region.city
 * - location.region.area
 * - location.desired_venue_types[]
 * - location.provided_items[]
 * 
 * Regras duras:
 * - provided_items não elimina necessidade futura
 * - Adequação é sempre considerada desconhecida
 * - Condicional somente de UI (has_venue)
 */
export default function BirthdayLocationPage({ eventSpec, onChange }: BirthdayLocationPageProps) {
  const [location, setLocation] = useState<{
    has_venue?: boolean;
    address?: {
      cep?: string;
      number?: string;
      complement?: string;
    };
    region?: {
      city?: string;
      area?: string;
    };
    desired_venue_types?: ("SALAO" | "CHACARA" | "CLUBE" | "ESPACO_INFANTIL" | "CASA_EVENTOS" | "INDIFERENTE" | "NAO_SEI")[];
    provided_items?: ("MESAS" | "CADEIRAS" | "COZINHA" | "SOM" | "ILUMINACAO" | "ESPACO_INFANTIL" | "AREA_EXTERNA" | "ACESSIBILIDADE")[];
  }>(eventSpec.answers?.location || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ location });
  }, [location, onChange]);

  const hasVenue = location.has_venue === true;
  const hasNoVenue = location.has_venue === false;
  const hasNotDecided = location.has_venue === undefined;

  return (
    <div className="wizard-page">
      <h3>Local do Evento</h3>
      <p className="step-description">
        Informações sobre o local da festa. "Possui" não significa "é suficiente".
      </p>

      <div className="form-group">
        <label className="form-label">
          Você já tem o local da festa? <span className="required">*</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${hasVenue ? 'selected' : ''}`}
            onClick={() => setLocation(prev => ({ ...prev, has_venue: true }))}
          >
            Sim
          </button>
          <button
            type="button"
            className={`yes-no-button ${hasNoVenue ? 'selected' : ''}`}
            onClick={() => setLocation(prev => ({ ...prev, has_venue: false }))}
          >
            Não
          </button>
          <button
            type="button"
            className={`yes-no-button ${hasNotDecided ? 'selected' : ''}`}
            onClick={() => setLocation(prev => ({ ...prev, has_venue: undefined }))}
          >
            Ainda não sei
          </button>
        </div>
      </div>

      {/* SE has_venue = true */}
      {hasVenue && (
        <>
          <div className="form-group">
            <label htmlFor="address_cep" className="form-label">
              CEP <span className="optional">(opcional)</span>
            </label>
            <input
              id="address_cep"
              type="text"
              value={location.address?.cep || ''}
              onChange={(e) => setLocation(prev => ({
                ...prev,
                address: {
                  ...prev.address,
                  cep: e.target.value || undefined,
                }
              }))}
              placeholder="00000-000"
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address_number" className="form-label">
                Número <span className="optional">(opcional)</span>
              </label>
              <input
                id="address_number"
                type="text"
                value={location.address?.number || ''}
                onChange={(e) => setLocation(prev => ({
                  ...prev,
                  address: {
                    ...prev.address,
                    number: e.target.value || undefined,
                  }
                }))}
                placeholder="123"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="address_complement" className="form-label">
                Complemento <span className="optional">(opcional)</span>
              </label>
              <input
                id="address_complement"
                type="text"
                value={location.address?.complement || ''}
                onChange={(e) => setLocation(prev => ({
                  ...prev,
                  address: {
                    ...prev.address,
                    complement: e.target.value || undefined,
                  }
                }))}
                placeholder="Apto 101"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              O local possui (marque o que EXISTE) <span className="optional">(opcional)</span>
            </label>
            <p className="field-hint">
              ⚠️ "Possui" ≠ "é suficiente". Nenhuma marcação elimina contratação futura.
            </p>
            <div className="checkbox-grid">
              {(['MESAS', 'CADEIRAS', 'COZINHA', 'SOM', 'ILUMINACAO', 'ESPACO_INFANTIL', 'AREA_EXTERNA', 'ACESSIBILIDADE'] as const).map(item => (
                <label key={item} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={location.provided_items?.includes(item) || false}
                    onChange={(e) => {
                      const current = location.provided_items || [];
                      const updated = e.target.checked
                        ? [...current, item]
                        : current.filter(i => i !== item);
                      setLocation(prev => ({
                        ...prev,
                        provided_items: updated.length > 0 ? updated : undefined,
                      }));
                    }}
                  />
                  <span>{item.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* SE has_venue = false ou undefined */}
      {(hasNoVenue || hasNotDecided) && (
        <>
          <div className="form-group">
            <label htmlFor="region_city" className="form-label">
              Cidade desejada <span className="optional">(opcional)</span>
            </label>
            <input
              id="region_city"
              type="text"
              value={location.region?.city || ''}
              onChange={(e) => setLocation(prev => ({
                ...prev,
                region: {
                  ...prev.region,
                  city: e.target.value || undefined,
                }
              }))}
              placeholder="Ex: Curitiba"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="region_area" className="form-label">
              Bairro / região <span className="optional">(opcional)</span>
            </label>
            <input
              id="region_area"
              type="text"
              value={location.region?.area || ''}
              onChange={(e) => setLocation(prev => ({
                ...prev,
                region: {
                  ...prev.region,
                  area: e.target.value || undefined,
                }
              }))}
              placeholder="Ex: Zona Norte"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Tipo de espaço desejado <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['SALAO', 'CHACARA', 'CLUBE', 'ESPACO_INFANTIL', 'CASA_EVENTOS', 'INDIFERENTE', 'NAO_SEI'] as const).map(venueType => (
                <label key={venueType} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={location.desired_venue_types?.includes(venueType) || false}
                    onChange={(e) => {
                      const current = location.desired_venue_types || [];
                      const updated = e.target.checked
                        ? [...current, venueType]
                        : current.filter(v => v !== venueType);
                      setLocation(prev => ({
                        ...prev,
                        desired_venue_types: updated.length > 0 ? updated : undefined,
                      }));
                    }}
                  />
                  <span>{venueType.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// frontend/src/components/events/wizard/pages/BirthdaySupportServicesPage.tsx
// FASE 5 — PÁGINA: Serviços de Apoio
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdaySupportServicesPageProps {
  eventSpec: {
    answers?: {
      support_services?: ("LIMPEZA" | "GARCONS" | "SEGURANCA" | "DECORACAO")[];
    };
  };
  onChange: (partialSpec: {
    support_services?: ("LIMPEZA" | "GARCONS" | "SEGURANCA" | "DECORACAO")[];
  }) => void;
}

/**
 * BirthdaySupportServicesPage
 * 
 * Objetivo: Registrar intenção de serviços de apoio
 * Campos EventSpec permitidos:
 * - support_services[]
 * 
 * Observações:
 * - Lista declarativa
 * - Pode conter valores múltiplos
 * - Não implica execução
 */
export default function BirthdaySupportServicesPage({ eventSpec, onChange }: BirthdaySupportServicesPageProps) {
  const [supportServices, setSupportServices] = useState<("LIMPEZA" | "GARCONS" | "SEGURANCA" | "DECORACAO")[]>(
    eventSpec.answers?.support_services || []
  );

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ support_services: supportServices.length > 0 ? supportServices : undefined });
  }, [supportServices, onChange]);

  return (
    <div className="wizard-page">
      <h3>Serviços de Apoio</h3>
      <p className="step-description">
        Quais serviços de apoio você precisa? (opcional)
      </p>

      <div className="form-group">
        <label className="form-label">
          Serviços de apoio <span className="optional">(opcional)</span>
        </label>
        <div className="checkbox-grid">
          {(['LIMPEZA', 'GARCONS', 'SEGURANCA', 'DECORACAO'] as const).map(service => (
            <label key={service} className="checkbox-option">
              <input
                type="checkbox"
                checked={supportServices.includes(service)}
                onChange={(e) => {
                  const updated = e.target.checked
                    ? [...supportServices, service]
                    : supportServices.filter(s => s !== service);
                  setSupportServices(updated);
                }}
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => setSupportServices([])}
        >
          Nenhum
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => setSupportServices([])}
        >
          Não sei
        </button>
      </div>
    </div>
  );
}


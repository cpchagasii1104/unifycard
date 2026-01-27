// src/components/events/guided-flow/Step5OperationalRoles.tsx
// ETAPA 5 — Operação (Papéis, não pessoas)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Comida (caseiro / buffet)
// - Música (playlist / DJ / banda)
// - Decoração (simples / temática)
// - Sempre como PAPEL OPERACIONAL
// - Nunca fornecedor
// - Nunca pessoa

import { useState } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step5OperationalRoles.css';

interface Step5OperationalRolesProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
  isLoading: boolean;
}

export default function Step5OperationalRoles({ data, onUpdate, onComplete, isLoading = false }: Step5OperationalRolesProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<'casual' | 'professional' | null>(null);

  // 🔴 DEFAULTS SEGUROS: Garantir que operational_roles sempre seja array
  const operationalRoles = data.operational_roles ?? [];

  const addRole = () => {
    if (selectedRole && selectedLevel) {
      const roles = [...operationalRoles, { role: selectedRole, level: selectedLevel }];
      onUpdate({ operational_roles: roles });
      setSelectedRole('');
      setSelectedLevel(null);
    }
  };

  const removeRole = (index: number) => {
    const roles = operationalRoles.filter((_, i) => i !== index);
    onUpdate({ operational_roles: roles });
  };

  return (
    <div className="step5-operational-roles">
      <div className="step-header">
        <h2>Operação (Papéis Necessários)</h2>
        <p className="step-hint">
          ⚠️ Defina papéis operacionais, não fornecedores ou pessoas específicas.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Papel Operacional</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="form-select"
          >
            <option value="">Selecione...</option>
            <option value="food">Comida</option>
            <option value="music">Música</option>
            <option value="decoration">Decoração</option>
            <option value="photography">Fotografia</option>
            <option value="security">Segurança</option>
          </select>
        </div>

        {selectedRole && (
          <div className="form-group">
            <label className="form-label">Nível</label>
            <div className="option-grid">
              <button
                type="button"
                className={`option-button ${selectedLevel === 'casual' ? 'selected' : ''}`}
                onClick={() => setSelectedLevel('casual')}
              >
                Casual
              </button>
              <button
                type="button"
                className={`option-button ${selectedLevel === 'professional' ? 'selected' : ''}`}
                onClick={() => setSelectedLevel('professional')}
              >
                Profissional
              </button>
            </div>
          </div>
        )}

        {selectedRole && selectedLevel && (
          <button
            type="button"
            className="step-button step-button-secondary"
            onClick={addRole}
          >
            Adicionar Papel
          </button>
        )}

        {operationalRoles.length > 0 ? (
          <div className="roles-list">
            <h3>Papéis Definidos</h3>
            {operationalRoles.map((role, index) => (
              <div key={index} className="role-item">
                <span>
                  <strong>{role.role}</strong> - {role.level}
                </span>
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeRole(index)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-message">
              Nenhum papel definido ainda
            </p>
            <p className="empty-state-hint">
              Você pode definir papéis operacionais agora ou continuar sem eles.
            </p>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
          disabled={isLoading}
        >
          {isLoading ? 'Carregando preview...' : 'Ver Preview Econômico'}
        </button>
      </div>
    </div>
  );
}


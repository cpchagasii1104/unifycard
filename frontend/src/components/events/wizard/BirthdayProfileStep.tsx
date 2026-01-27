// frontend/src/components/events/wizard/BirthdayProfileStep.tsx
// Step isolado para perguntar faixa etária ANTES do EventFoundationStep
// Respeitando a ordem canônica: faixa etária → data/horário → resto do wizard

import { useState, useEffect } from 'react';
import type { WizardData } from '../EventCreationWizard';
import './BirthdayWizard.css';

interface BirthdayProfileStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function BirthdayProfileStep({ data, onUpdate }: BirthdayProfileStepProps) {
  const [birthdayProfile, setBirthdayProfile] = useState<'child' | 'teen' | 'adult' | null>(
    data.birthday_wizard?.birthday_profile || null
  );

  // Atualizar wizardData quando mudar (apenas birthday_profile, tema será perguntado depois)
  useEffect(() => {
    onUpdate({
      birthday_wizard: {
        ...data.birthday_wizard,
        birthday_profile: birthdayProfile,
      } as any,
    });
  }, [birthdayProfile, onUpdate]);

  const canProceed = (): boolean => {
    return birthdayProfile !== null;
  };

  return (
    <div className="birthday-wizard-step">
      <h3>Identidade do Aniversário</h3>
      <p className="step-description">
        Primeiro, vamos identificar o tipo de aniversário para personalizar as próximas perguntas:
      </p>
      
      <div className="form-group">
        <label className="form-label">
          Tipo do aniversário <span className="required">*</span>
        </label>
        <div className="option-grid">
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'child' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('child')}
          >
            <div className="option-icon">🎈</div>
            <div className="option-label">Infantil</div>
            <div className="option-description">Para crianças</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'teen' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('teen')}
          >
            <div className="option-icon">🎉</div>
            <div className="option-label">Jovem</div>
            <div className="option-description">Para adolescentes</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'adult' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('adult')}
          >
            <div className="option-icon">🍾</div>
            <div className="option-label">Adulto</div>
            <div className="option-description">Aniversário adulto</div>
          </button>
        </div>
      </div>

      {!canProceed() && (
        <div className="field-error" style={{ marginTop: '16px', color: '#dc2626', fontSize: '0.875rem' }}>
          ⚠️ Selecione o tipo de aniversário para continuar
        </div>
      )}
    </div>
  );
}


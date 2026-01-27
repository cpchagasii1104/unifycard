// src/components/events/wizard/Step1Actor.tsx
// Step 1: Actor - Detectar activeActor automaticamente

import type { WizardData } from '../EventCreationWizard';
import type { AvailableActor } from '../../../contexts/ActiveActorContext';
import './Step1Actor.css';

interface Step1ActorProps {
  data: WizardData;
  activeActor: AvailableActor;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function Step1Actor({ activeActor }: Step1ActorProps) {
  const actorDisplayName = activeActor.display_name || 'Sem nome';
  const actorTypeLabel = activeActor.actor_type === 'user' ? 'Pessoa Física' : 'Pessoa Jurídica';

  return (
    <div className="step-container">
      <h2>Step 1 · Actor</h2>
      <p className="step-description">
        Você está criando este evento como:
      </p>
      
      <div className="actor-display">
        <div className="actor-card">
          <div className="actor-icon">
            {activeActor.actor_type === 'user' ? '👤' : '🏢'}
          </div>
          <div className="actor-info">
            <div className="actor-name">{actorDisplayName}</div>
            <div className="actor-type">{actorTypeLabel}</div>
          </div>
        </div>
      </div>

      <p className="step-note">
        O actor foi definido automaticamente com base no seu contexto atual.
      </p>
    </div>
  );
}













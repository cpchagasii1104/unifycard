// src/components/events/EventNeedsOptInModal.tsx
// Modal de Opt-in para Assistência de Eventos
// SPRINT: Eventos Assistidos

import { useState } from 'react';
import EventNeedsWizard from './EventNeedsWizard';
import type { EventNeed } from './EventNeedsWizard';
import './EventNeedsOptInModal.css';

export interface EventNeedsOptInModalProps {
  eventId: string;
  eventType: string;
  onComplete: (needs: EventNeed[]) => void;
  onSkip: () => void;
}

export default function EventNeedsOptInModal({
  eventId,
  eventType,
  onComplete,
  onSkip,
}: EventNeedsOptInModalProps) {
  const [showWizard, setShowWizard] = useState(false);

  const handleYes = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = (needs: EventNeed[]) => {
    onComplete(needs);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  if (showWizard) {
    return (
      <div className="event-needs-modal-overlay">
        <div className="event-needs-modal">
          <EventNeedsWizard
            eventType={eventType}
            onComplete={handleWizardComplete}
            onCancel={handleWizardCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="event-needs-modal-overlay">
      <div className="event-needs-modal">
        <div className="opt-in-content">
          <h2>Quer ajuda para organizar e encontrar fornecedores?</h2>
          <p>
            Podemos ajudá-lo a identificar as necessidades do seu evento e criar uma lista
            de serviços que você pode precisar (decoração, buffet, som, fotografia, etc.).
          </p>
          <p className="opt-in-note">
            Você poderá editar ou remover itens da lista a qualquer momento.
          </p>
          <div className="opt-in-actions">
            <button onClick={handleYes} className="btn-primary">
              Sim, preciso de ajuda
            </button>
            <button onClick={onSkip} className="btn-secondary">
              Não, obrigado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


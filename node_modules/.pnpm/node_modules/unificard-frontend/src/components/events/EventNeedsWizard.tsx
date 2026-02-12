// src/components/events/EventNeedsWizard.tsx
// Wizard de Necessidades do Evento
// SPRINT: Eventos Assistidos

import { useState } from 'react';
import './EventNeedsWizard.css';

export interface EventNeed {
  id: string;
  category: string;
  status: 'PENDENTE';
  description: string | null;
  createdAt: string;
}

export interface EventNeedsWizardProps {
  eventType: string;
  onComplete: (needs: EventNeed[]) => void;
  onCancel: () => void;
}

// BLOCKED_BY_FRONTEND_DEPENDENCY: Lista hardcoded mantida para compatibilidade
// Migrar para busca canônica quando backend suportar categorias de necessidades de eventos
const NEEDS_CATEGORIES_BY_EVENT_TYPE: Record<string, string[]> = {
  social: ['Decoração', 'Buffet/Comida', 'Som/Iluminação', 'Fotografia/Filmagem', 'Limpeza'],
  cultural: ['Som/Iluminação', 'Segurança', 'Limpeza', 'Fotografia/Filmagem'],
  gastronomic: ['Buffet/Comida', 'Decoração', 'Limpeza'],
  professional: ['Som/Iluminação', 'Limpeza', 'Fotografia/Filmagem'],
  sports: ['Segurança', 'Limpeza', 'Transporte'],
  community: ['Decoração', 'Buffet/Comida', 'Som/Iluminação', 'Limpeza'],
  spiritual: ['Decoração', 'Som/Iluminação', 'Limpeza'],
  private: ['Decoração', 'Buffet/Comida', 'Som/Iluminação', 'Fotografia/Filmagem', 'Limpeza'],
};

const ALL_CATEGORIES = [
  'Decoração',
  'Buffet/Comida',
  'Som/Iluminação',
  'Fotografia/Filmagem',
  'Segurança',
  'Limpeza',
  'Transporte',
  'Outros',
];

export default function EventNeedsWizard({ eventType, onComplete, onCancel }: EventNeedsWizardProps) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [otherServices, setOtherServices] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<'questions' | 'review'>('questions');

  // Categorias sugeridas para este tipo de evento
  const suggestedCategories = NEEDS_CATEGORIES_BY_EVENT_TYPE[eventType] || ALL_CATEGORIES;
  const categoriesToShow = [...new Set([...suggestedCategories, ...ALL_CATEGORIES])];

  const handleToggle = (category: string) => {
    setAnswers(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleGenerate = () => {
    const needs: EventNeed[] = [];

    // Adicionar necessidades baseadas em respostas SIM
    Object.entries(answers).forEach(([category, value]) => {
      if (value) {
        needs.push({
          id: `need-${Date.now()}-${Math.random()}`,
          category,
          status: 'PENDENTE',
          description: null,
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Adicionar "Outros" se preenchido
    if (otherServices.trim()) {
      needs.push({
        id: `need-${Date.now()}-${Math.random()}`,
        category: 'Outros',
        status: 'PENDENTE',
        description: otherServices.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    if (needs.length === 0) {
      alert('Selecione pelo menos uma necessidade ou preencha "Outros serviços"');
      return;
    }

    setCurrentStep('review');
  };

  const handleConfirm = () => {
    const needs: EventNeed[] = [];

    Object.entries(answers).forEach(([category, value]) => {
      if (value) {
        needs.push({
          id: `need-${Date.now()}-${Math.random()}`,
          category,
          status: 'PENDENTE',
          description: null,
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (otherServices.trim()) {
      needs.push({
        id: `need-${Date.now()}-${Math.random()}`,
        category: 'Outros',
        status: 'PENDENTE',
        description: otherServices.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    onComplete(needs);
  };

  if (currentStep === 'review') {
    const needs: EventNeed[] = [];
    Object.entries(answers).forEach(([category, value]) => {
      if (value) {
        needs.push({
          id: `need-${Date.now()}-${Math.random()}`,
          category,
          status: 'PENDENTE',
          description: null,
          createdAt: new Date().toISOString(),
        });
      }
    });
    if (otherServices.trim()) {
      needs.push({
        id: `need-${Date.now()}-${Math.random()}`,
        category: 'Outros',
        status: 'PENDENTE',
        description: otherServices.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    return (
      <div className="event-needs-wizard">
        <div className="wizard-header">
          <h2>Lista de Necessidades Gerada</h2>
          <p>Revise as necessidades identificadas para seu evento:</p>
        </div>

        <div className="needs-review-list">
          {needs.map((need) => (
            <div key={need.id} className="need-item">
              <strong>{need.category}</strong>
              {need.description && <p>{need.description}</p>}
              <span className="status-badge">Pendente</span>
            </div>
          ))}
        </div>

        <div className="wizard-actions">
          <button onClick={() => setCurrentStep('questions')} className="btn-secondary">
            Voltar
          </button>
          <button onClick={handleConfirm} className="btn-primary">
            Confirmar e Salvar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-needs-wizard">
      <div className="wizard-header">
        <h2>Quais serviços você precisa para seu evento?</h2>
        <p>Marque as opções que se aplicam ao seu evento:</p>
      </div>

      <div className="needs-questions">
        {categoriesToShow.map((category) => (
          <div key={category} className="need-question">
            <label className="need-checkbox">
              <input
                type="checkbox"
                checked={answers[category] || false}
                onChange={() => handleToggle(category)}
              />
              <span>{category}</span>
            </label>
          </div>
        ))}

        <div className="need-question-other">
          <label htmlFor="other-services">Outros serviços (descreva):</label>
          <textarea
            id="other-services"
            value={otherServices}
            onChange={(e) => setOtherServices(e.target.value)}
            placeholder="Ex: Transporte para convidados, Equipamentos especiais..."
            rows={3}
          />
        </div>
      </div>

      <div className="wizard-actions">
        <button onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
        <button onClick={handleGenerate} className="btn-primary">
          Gerar Lista de Necessidades
        </button>
      </div>
    </div>
  );
}





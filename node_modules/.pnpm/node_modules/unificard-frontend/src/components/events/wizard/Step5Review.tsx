// src/components/events/wizard/Step5Review.tsx
// Step 5: Revisão - Resumo completo + botões salvar/publicar

import { DateTime } from 'luxon';
import type { WizardData } from '../EventCreationWizard';
import type { AvailableActor } from '../../../contexts/ActiveActorContext';
import './Step5Review.css';

interface Step5ReviewProps {
  data: WizardData;
  activeActor: AvailableActor;
  onSaveDraft: () => void;
  onPublish: () => void;
  isSubmitting: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  cultural: 'Cultural',
  gastronomic: 'Gastronômico',
  social: 'Social',
  professional: 'Profissional',
  community: 'Comunitário',
  spiritual: 'Espiritual',
  sports: 'Esportivo',
  private: 'Privado',
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Público',
  group: 'Grupo',
  followers: 'Seguidores',
  private: 'Privado',
  unlisted: 'Não listado',
};

export default function Step5Review({
  data,
  activeActor,
  onSaveDraft,
  onPublish,
  isSubmitting,
}: Step5ReviewProps) {
  const formatDateTime = (iso: string | null): string => {
    if (!iso) return 'Não definido';
    const dt = DateTime.fromISO(iso);
    return dt.setLocale('pt-BR').toLocaleString(DateTime.DATETIME_FULL);
  };

  const formatPrice = (cents: number | null): string => {
    if (cents === null || cents === 0) return 'Gratuito';
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="step-container">
      <h2>Step 5 · Revisão</h2>
      <p className="step-description">
        Revise todas as informações antes de salvar ou publicar:
      </p>

      <div className="review-summary">
        <div className="review-section">
          <h3>1. Actor</h3>
          <div className="review-item">
            <span className="review-label">Criando como:</span>
            <span className="review-value">
              {activeActor.display_name} ({activeActor.actor_type === 'user' ? 'Pessoa Física' : 'Pessoa Jurídica'})
            </span>
          </div>
        </div>

        <div className="review-section">
          <h3>2. Tipo de Evento</h3>
          <div className="review-item">
            <span className="review-label">Tipo:</span>
            <span className="review-value">
              {data.event_type ? EVENT_TYPE_LABELS[data.event_type] : 'Não definido'}
            </span>
          </div>
          {data.custom_subtype_text && (
            <div className="review-item">
              <span className="review-label">Categoria personalizada:</span>
              <span className="review-value">{data.custom_subtype_text}</span>
            </div>
          )}
        </div>

        <div className="review-section">
          <h3>3. Contexto</h3>
          <div className="review-item">
            <span className="review-label">Título:</span>
            <span className="review-value">{data.title || 'Não definido'}</span>
          </div>
          {data.description && (
            <div className="review-item">
              <span className="review-label">Descrição:</span>
              <span className="review-value">{data.description}</span>
            </div>
          )}
          <div className="review-item">
            <span className="review-label">Início:</span>
            <span className="review-value">{formatDateTime(data.datetime_start)}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Fim:</span>
            <span className="review-value">{formatDateTime(data.datetime_end)}</span>
          </div>
          <div className="review-item">
            <span className="review-label">Local:</span>
            <span className="review-value">
              {data.location_type === 'physical' ? '📍 Presencial' : '💻 Online'}
              {data.location_type === 'physical' && data.location_name && ` - ${data.location_name}`}
            </span>
          </div>
          <div className="review-item">
            <span className="review-label">Visibilidade:</span>
            <span className="review-value">{VISIBILITY_LABELS[data.visibility]}</span>
          </div>
        </div>

        <div className="review-section">
          <h3>4. Economia</h3>
          <div className="review-item">
            <span className="review-label">Tipo:</span>
            <span className="review-value">
              {data.economy_type === 'free' && '🆓 Gratuito'}
              {data.economy_type === 'symbolic' && '💝 Valor Simbólico'}
              {data.economy_type === 'fixed' && '💰 Valor Fixo'}
            </span>
          </div>
          {data.economy_type !== 'free' && (
            <div className="review-item">
              <span className="review-label">Valor do ingresso:</span>
              <span className="review-value">{formatPrice(data.ticket_price_cents)}</span>
            </div>
          )}
          {data.max_attendees && (
            <div className="review-item">
              <span className="review-label">Limite de público:</span>
              <span className="review-value">{data.max_attendees} pessoas</span>
            </div>
          )}
          <div className="review-note">
            ℹ️ A distribuição de valores será aplicada automaticamente pelo sistema.
          </div>
        </div>
      </div>

      <div className="review-actions">
        <button
          className="wizard-button wizard-button-secondary"
          onClick={onSaveDraft}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Rascunho'}
        </button>
        <button
          className="wizard-button wizard-button-primary"
          onClick={onPublish}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Publicando...' : 'Publicar Evento'}
        </button>
      </div>
    </div>
  );
}













// src/components/events/wizard/Step3Context.tsx
// Step 3: Contexto - Campos dinâmicos conforme event_type

import React, { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import type { WizardData } from '../EventCreationWizard';
import AudienceSelector from '../../publication/AudienceSelector';
import type { Visibility, PublicationDestination, InvitationMethod } from '../../../types/publication';
import './Step3Context.css';

interface Step3ContextProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function Step3Context({ data, onUpdate }: Step3ContextProps) {
  // Se foundation existe, usar dados de lá para preencher automaticamente
  const foundation = data.foundation;
  const hasFoundation = foundation && data.event_type === 'private';
  
  // Preencher datetime_start e datetime_end do foundation se disponível
  useEffect(() => {
    if (hasFoundation && foundation) {
      if (foundation.event_date && foundation.event_time_start) {
        const startDateTime = `${foundation.event_date}T${foundation.event_time_start}`;
        const startISO = DateTime.fromISO(startDateTime).toISO();
        if (startISO && !data.datetime_start) {
          onUpdate({ datetime_start: startISO });
        }
        
        // Calcular datetime_end
        let endISO: string | null = null;
        if (foundation.event_duration_hours) {
          const endDateTime = DateTime.fromISO(startDateTime).plus({ hours: foundation.event_duration_hours });
          endISO = endDateTime.toISO();
        } else if (foundation.event_time_end) {
          const endDateTime = `${foundation.event_date}T${foundation.event_time_end}`;
          endISO = DateTime.fromISO(endDateTime).toISO();
        }
        if (endISO && !data.datetime_end) {
          onUpdate({ datetime_end: endISO });
        }
      }
      
      // Preencher location_name se tem cidade do foundation
      if (foundation.city && !data.location_name) {
        const locationName = foundation.region 
          ? `${foundation.city} - ${foundation.region}`
          : foundation.city;
        onUpdate({ location_name: locationName });
      }
      
      // Preencher location_type se tem local
      if (foundation.has_venue !== null && !data.location_type) {
        onUpdate({ location_type: 'physical' });
      }
    }
  }, [hasFoundation, foundation, data.datetime_start, data.datetime_end, data.location_name, data.location_type, onUpdate]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ description: e.target.value || null });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (date) {
      const datetime = DateTime.fromISO(date).toISO();
      onUpdate({ datetime_start: datetime });
    } else {
      onUpdate({ datetime_start: null });
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (date) {
      const datetime = DateTime.fromISO(date).toISO();
      onUpdate({ datetime_end: datetime });
    } else {
      onUpdate({ datetime_end: null });
    }
  };

  const handleLocationTypeChange = (type: 'physical' | 'online') => {
    onUpdate({ location_type: type });
    if (type === 'online') {
      onUpdate({ location_name: null });
    }
  };

  const handleLocationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ location_name: e.target.value || null });
  };

  const handleVisibilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ visibility: e.target.value as WizardData['visibility'] });
  };

  // Converter datetime para input datetime-local
  const formatDateTimeForInput = (iso: string | null): string => {
    if (!iso) return '';
    const dt = DateTime.fromISO(iso);
    return dt.toFormat("yyyy-MM-dd'T'HH:mm");
  };

  return (
    <div className="step-container">
      <h2>Step 3 · Contexto</h2>
      <p className="step-description">
        Preencha as informações básicas do evento:
      </p>

      <div className="context-form">
        <div className="form-group">
          <label htmlFor="title">
            Título <span className="required">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={data.title}
            onChange={handleTitleChange}
            placeholder="Ex: Show de Rock"
            maxLength={255}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            value={data.description || ''}
            onChange={handleDescriptionChange}
            placeholder="Descreva o evento..."
            rows={4}
          />
        </div>

        {/* Dados da Fundação - apenas exibição informativa */}
        {hasFoundation && foundation && (
          <div className="foundation-data-summary">
            <h4>Informações da Fundação do Evento</h4>
            <div className="foundation-summary-grid">
              {foundation.event_date && foundation.event_time_start && (
                <div className="summary-item">
                  <span className="summary-label">Data e Horário:</span>
                  <span className="summary-value">
                    {foundation.event_date} às {foundation.event_time_start}
                    {foundation.event_duration_hours && ` (${foundation.event_duration_hours}h)`}
                    {foundation.event_time_end && ` até ${foundation.event_time_end}`}
                  </span>
                </div>
              )}
              {foundation.city && (
                <div className="summary-item">
                  <span className="summary-label">Local:</span>
                  <span className="summary-value">
                    {foundation.city}
                    {foundation.region && ` - ${foundation.region}`}
                    {foundation.has_venue && ' (local já possui)'}
                  </span>
                </div>
              )}
            </div>
            <p className="summary-note">
              Estes dados foram coletados no passo "Fundação do Evento" e não podem ser alterados aqui.
            </p>
          </div>
        )}

        {/* Seção de Convites & Colaboração */}
        <div className="publication-section">
          <AudienceSelector
            visibility={data.visibility as Visibility}
            onVisibilityChange={(visibility) => {
              onUpdate({ visibility: visibility as WizardData['visibility'] });
            }}
            publicationDestinations={(data.publication_destinations || []) as PublicationDestination[]}
            onDestinationsChange={(destinations) => {
              onUpdate({ publication_destinations: destinations });
            }}
            showAdvanced={false}
            invitationsEnabled={data.invitations_enabled || false}
            onInvitationsEnabledChange={(enabled) => {
              onUpdate({ invitations_enabled: enabled });
            }}
            invitationMethods={(data.invitation_methods || []) as InvitationMethod[]}
            onInvitationMethodsChange={(methods) => {
              onUpdate({ invitation_methods: methods });
            }}
            actorType={data.actor_type === 'page' ? 'page' : 'user'}
          />
        </div>
      </div>
    </div>
  );
}













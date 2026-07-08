// src/components/events/EventDeclarationForm.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Declaration / Creation Page
// Declaração progressiva de evento - sem wizard obrigatório

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { createEvent, updateEvent, getEventById, type CreateEventInput } from '../../api/events';
import { showToast } from '../common/Toast';
import AudienceSelector from '../publication/AudienceSelector';
import type { Visibility, PublicationDestination, InvitationMethod } from '../../types/publication';
import './EventDeclarationForm.css';

interface EventDeclarationData {
  // Actor (preenchido automaticamente)
  actor_id: string;
  actor_type: 'user' | 'page';
  
  // Tipo de evento (atributo declarativo)
  event_type: 'cultural' | 'gastronomic' | 'social' | 'professional' | 'community' | 'spiritual' | 'sports' | 'private' | null;
  event_subtype: string | null;
  custom_subtype_text: string | null;
  
  // Contexto (todos opcionais - declaração progressiva)
  title: string;
  description: string | null;
  datetime_start: string | null; // Apenas INPUT VISUAL - sem validação
  datetime_end: string | null; // Apenas INPUT VISUAL - sem validação
  location_type: 'physical' | 'online' | null;
  location_name: string | null;
  visibility: 'public' | 'connections' | 'only_me';
  
  // Publicação e Convites
  publication_destinations?: string[];
  invitations_enabled?: boolean;
  invitation_methods?: string[];
  referral_code?: string | null;
  
  // Economia (opcional)
  economy_type: 'free' | 'symbolic' | 'fixed' | null;
  ticket_price_cents: number | null;
  max_attendees: number | null;
  
  // Metadata (para birthday_party e outros atributos)
  metadata?: Record<string, any>;
}

const INITIAL_DATA: EventDeclarationData = {
  actor_id: '',
  actor_type: 'user',
  event_type: null,
  event_subtype: null,
  custom_subtype_text: null,
  title: '',
  description: null,
  datetime_start: null,
  datetime_end: null,
  location_type: null,
  location_name: null,
  visibility: 'public',
  publication_destinations: undefined,
  invitations_enabled: false,
  invitation_methods: [],
  referral_code: null,
  economy_type: null,
  ticket_price_cents: null,
  max_attendees: null,
  metadata: {},
};

export default function EventDeclarationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeActor, isLoading } = useActiveActor();
  const eventId = searchParams.get('id'); // Para edição de rascunho existente
  
  const [data, setData] = useState<EventDeclarationData>(INITIAL_DATA);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(eventId);

  // Preencher actor automaticamente
  useEffect(() => {
    if (!isLoading && activeActor) {
      setData(prev => ({
        ...prev,
        actor_id: activeActor.actor_id,
        actor_type: activeActor.actor_type as 'user' | 'page',
      }));
    }
  }, [activeActor, isLoading]);

  // Carregar rascunho existente se editando
  useEffect(() => {
    if (eventId && !savedEventId) {
      loadDraft(eventId);
    }
  }, [eventId]);

  const loadDraft = async (id: string) => {
    try {
      const response = await getEventById(id);
      const event = response.event;
      
      setData({
        actor_id: event.actor_id || '',
        actor_type: event.actor_type as 'user' | 'page',
        event_type: event.event_type as any,
        event_subtype: event.event_subtype,
        custom_subtype_text: event.metadata?.custom_subtype_text || null,
        title: event.title,
        description: event.description,
        datetime_start: event.datetime_start || null,
        datetime_end: event.datetime_end || null,
        location_type: event.metadata?.location_type || null,
        location_name: event.metadata?.location_name || null,
        visibility: event.visibility as any,
        publication_destinations: event.metadata?.publication_destinations,
        invitations_enabled: event.metadata?.invitations_enabled || false,
        invitation_methods: event.metadata?.invitation_methods || [],
        referral_code: event.metadata?.referral_code || null,
        economy_type: event.ticket_price_cents === null ? 'free' : event.ticket_price_cents === 0 ? 'symbolic' : 'fixed',
        ticket_price_cents: event.ticket_price_cents,
        max_attendees: event.max_attendees,
        metadata: event.metadata || {},
      });
      setSavedEventId(id);
    } catch (err) {
      console.error('Erro ao carregar rascunho:', err);
      showToast('Erro ao carregar rascunho', 'error');
    }
  };

  const updateData = (updates: Partial<EventDeclarationData>) => {
    setData(prev => ({ ...prev, ...updates }));
    setError(null);
  };

  // Salvar como rascunho (a qualquer momento, sem validação)
  const handleSaveDraft = async () => {
    if (!data.actor_id || !data.actor_type) {
      setError('Actor não definido');
      return;
    }

    // 🔴 DECLARAÇÃO PROGRESSIVA: Não validar completude
    // Campos podem estar vazios - é apenas um rascunho
    
    setIsSaving(true);
    setError(null);

    try {
      // Se datetime_start ou datetime_end estão vazios, usar valores padrão temporários
      // (backend pode rejeitar, mas frontend não valida)
      const datetimeStart = data.datetime_start || new Date().toISOString();
      const datetimeEnd = data.datetime_end || new Date(Date.now() + 3600000).toISOString();

      const input: CreateEventInput = {
        actor_id: data.actor_id,
        actor_type: data.actor_type,
        event_type: data.event_type || 'social', // Default se não definido
        event_subtype: data.event_subtype,
        title: data.title || 'Rascunho sem título',
        description: data.description || null,
        datetime_start: datetimeStart,
        datetime_end: datetimeEnd,
        visibility: data.visibility,
        ticket_price_cents: data.ticket_price_cents,
        max_attendees: data.max_attendees,
        metadata: {
          ...data.metadata,
          location_type: data.location_type,
          location_name: data.location_name,
          custom_subtype_text: data.custom_subtype_text,
          publication_destinations: data.publication_destinations,
          invitations_enabled: data.invitations_enabled,
          invitation_methods: data.invitation_methods,
          referral_code: data.referral_code,
          // birthday_party é apenas atributo declarativo
          event_type_metadata: data.event_type === 'private' && data.event_subtype === 'birthday' 
            ? { type: 'birthday_party' }
            : undefined,
        },
      };

      let eventId = savedEventId;
      
      if (eventId) {
        // Atualizar rascunho existente
        await updateEvent(eventId, input);
        showToast('Rascunho salvo', 'success');
      } else {
        // Criar novo rascunho
        const response = await createEvent(input);
        eventId = response.event.id;
        setSavedEventId(eventId);
        showToast('Rascunho criado', 'success');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao salvar rascunho';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/eventos');
  };

  if (isLoading) {
    return (
      <div className="event-declaration-form">
        <div className="event-declaration-loading">Carregando...</div>
      </div>
    );
  }

  if (!activeActor) {
    return (
      <div className="event-declaration-form">
        <div className="event-declaration-error">
          <p>Nenhum actor ativo encontrado. Por favor, selecione um actor antes de criar um evento.</p>
          <button onClick={handleCancel}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="event-declaration-form">
      <div className="event-declaration-header">
        <h1>{savedEventId ? 'Editar Evento' : 'Criar Novo Evento'}</h1>
        <p className="event-declaration-subtitle">
          Preencha as informações do evento. Você pode salvar como rascunho a qualquer momento.
        </p>
      </div>

      {error && (
        <div className="event-declaration-error-message">
          {error}
        </div>
      )}

      <div className="event-declaration-sections">
        {/* Seção: Tipo de Evento */}
        <section className="event-declaration-section">
          <h2>Tipo de Evento</h2>
          <div className="form-group">
            <label htmlFor="event_type">Tipo</label>
            <select
              id="event_type"
              value={data.event_type || ''}
              onChange={(e) => {
                const value = e.target.value || null;
                updateData({ 
                  event_type: value as any,
                  // Reset subtype quando tipo muda
                  event_subtype: null,
                });
              }}
            >
              <option value="">Selecione...</option>
              <option value="cultural">Cultural</option>
              <option value="gastronomic">Gastronômico</option>
              <option value="social">Social</option>
              <option value="professional">Profissional</option>
              <option value="community">Comunidade</option>
              <option value="spiritual">Espiritual</option>
              <option value="sports">Esportes</option>
              <option value="private">Privado</option>
            </select>
          </div>

          {data.event_type === 'private' && (
            <div className="form-group">
              <label htmlFor="event_subtype">Subtipo</label>
              <select
                id="event_subtype"
                value={data.event_subtype || ''}
                onChange={(e) => {
                  const value = e.target.value || null;
                  updateData({ 
                    event_subtype: value,
                    // birthday_party é apenas atributo - não altera etapas
                    metadata: {
                      ...data.metadata,
                      event_type_metadata: value === 'birthday' 
                        ? { type: 'birthday_party' }
                        : undefined,
                    },
                  });
                }}
              >
                <option value="">Selecione...</option>
                <option value="birthday">Aniversário</option>
                <option value="wedding">Casamento</option>
                <option value="other">Outro</option>
              </select>
            </div>
          )}
        </section>

        {/* Seção: Informações Básicas */}
        <section className="event-declaration-section">
          <h2>Informações Básicas</h2>
          
          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input
              id="title"
              type="text"
              value={data.title}
              onChange={(e) => updateData({ title: e.target.value })}
              placeholder="Ex: Show de Rock"
              maxLength={255}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrição</label>
            <textarea
              id="description"
              value={data.description || ''}
              onChange={(e) => updateData({ description: e.target.value || null })}
              placeholder="Descreva o evento..."
              rows={4}
            />
          </div>
        </section>

        {/* Seção: Data e Horário (APENAS INPUT VISUAL - SEM VALIDAÇÃO) */}
        <section className="event-declaration-section">
          <h2>Data e Horário</h2>
          <p className="section-hint">
            ⚠️ Estes campos são apenas para referência visual. A Agenda Universal é a fonte de verdade temporal.
          </p>
          
          <div className="form-group">
            <label htmlFor="datetime_start">Início</label>
            <input
              id="datetime_start"
              type="datetime-local"
              value={data.datetime_start ? new Date(data.datetime_start).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                const value = e.target.value;
                updateData({ 
                  datetime_start: value ? new Date(value).toISOString() : null 
                });
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="datetime_end">Fim</label>
            <input
              id="datetime_end"
              type="datetime-local"
              value={data.datetime_end ? new Date(data.datetime_end).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                const value = e.target.value;
                updateData({ 
                  datetime_end: value ? new Date(value).toISOString() : null 
                });
              }}
            />
          </div>
        </section>

        {/* Seção: Localização */}
        <section className="event-declaration-section">
          <h2>Localização</h2>
          
          <div className="form-group">
            <label htmlFor="location_type">Tipo de Local</label>
            <select
              id="location_type"
              value={data.location_type || ''}
              onChange={(e) => {
                const value = e.target.value || null;
                updateData({ 
                  location_type: value as any,
                  location_name: value === 'online' ? null : data.location_name,
                });
              }}
            >
              <option value="">Selecione...</option>
              <option value="physical">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>

          {data.location_type === 'physical' && (
            <div className="form-group">
              <label htmlFor="location_name">Nome do Local</label>
              <input
                id="location_name"
                type="text"
                value={data.location_name || ''}
                onChange={(e) => updateData({ location_name: e.target.value || null })}
                placeholder="Ex: Parque Central"
              />
            </div>
          )}
        </section>

        {/* Seção: Visibilidade e Publicação */}
        <section className="event-declaration-section">
          <h2>Visibilidade e Publicação</h2>
          <AudienceSelector
            visibility={data.visibility as Visibility}
            onVisibilityChange={(visibility) => {
              updateData({ visibility: visibility as EventDeclarationData['visibility'] });
            }}
            publicationDestinations={(data.publication_destinations || []) as PublicationDestination[]}
            onDestinationsChange={(destinations) => {
              updateData({ publication_destinations: destinations });
            }}
            showAdvanced={false}
            invitationsEnabled={data.invitations_enabled || false}
            onInvitationsEnabledChange={(enabled) => {
              updateData({ invitations_enabled: enabled });
            }}
            invitationMethods={(data.invitation_methods || []) as InvitationMethod[]}
            onInvitationMethodsChange={(methods) => {
              updateData({ invitation_methods: methods });
            }}
            actorType={data.actor_type === 'page' ? 'page' : 'user'}
          />
        </section>

        {/* Seção: Economia */}
        <section className="event-declaration-section">
          <h2>Economia</h2>
          
          <div className="form-group">
            <label htmlFor="economy_type">Tipo de Economia</label>
            <select
              id="economy_type"
              value={data.economy_type || ''}
              onChange={(e) => {
                const value = e.target.value || null;
                updateData({ 
                  economy_type: value as any,
                  ticket_price_cents: value === 'free' ? 0 : value === 'symbolic' ? 1 : data.ticket_price_cents,
                });
              }}
            >
              <option value="">Selecione...</option>
              <option value="free">Gratuito</option>
              <option value="symbolic">Simbólico</option>
              <option value="fixed">Valor Fixo</option>
            </select>
          </div>

          {data.economy_type === 'fixed' && (
            <div className="form-group">
              <label htmlFor="ticket_price_cents">Preço do Ingresso (centavos)</label>
              <input
                id="ticket_price_cents"
                type="number"
                value={data.ticket_price_cents || ''}
                onChange={(e) => updateData({ ticket_price_cents: e.target.value ? parseInt(e.target.value) : null })}
                min="0"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="max_attendees">Capacidade Máxima (opcional)</label>
            <input
              id="max_attendees"
              type="number"
              value={data.max_attendees || ''}
              onChange={(e) => updateData({ max_attendees: e.target.value ? parseInt(e.target.value) : null })}
              min="1"
            />
          </div>
        </section>
      </div>

      <div className="event-declaration-actions">
        <button
          className="event-declaration-button event-declaration-button-secondary"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          className="event-declaration-button event-declaration-button-primary"
          onClick={handleSaveDraft}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : savedEventId ? 'Salvar Alterações' : 'Salvar Rascunho'}
        </button>
        {savedEventId && (
          <button
            className="event-declaration-button event-declaration-button-primary"
            onClick={() => navigate(`/events/${savedEventId}`)}
          >
            Ver Evento
          </button>
        )}
      </div>
    </div>
  );
}


// src/components/events/EventCreationGuidedFlow.tsx
// FASE 5.0 — Fluxo Guiado de Criação de Evento
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - Apenas orquestra chamadas declarativas ao backend
//
// REGRAS SEMÂNTICAS OBRIGATÓRIAS:
// - Evento = Rascunho
// - Data = Janela possível
// - Local = Requisito de espaço
// - Fornecedor = Papel operacional
// - Valor = Intervalo estimado (TEST)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { useSession } from '../../contexts/SessionProvider';
import { createOrAdvanceDraft, declareEvent, setTimeWindows, getEventSummary } from '../../api/events-v2';
import { showToast } from '../common/Toast';
import { getTenantId, isAuthenticated } from '../../config/auth';
import Step0EventType from './guided-flow/Step0EventType';
import Step1Declaration from './guided-flow/Step1Declaration';
import Step2Description from './guided-flow/Step2Description';
import Step3TimeWindows from './guided-flow/Step3TimeWindows';
import Step4SpaceRequirements from './guided-flow/Step4SpaceRequirements';
import Step5OperationalRoles from './guided-flow/Step5OperationalRoles';
import Step6EconomicPreview from './guided-flow/Step6EconomicPreview';
import Step7FinalSummary from './guided-flow/Step7FinalSummary';
import BirthdayWizard from './wizard/BirthdayWizard';
import { createRFQFromSpec, getCompatibleCompanies, dispatchRFQ, type CompatibleCompany } from '../../api/event-rfq';
import type { EventSpec } from '../../types/event-spec';
import './EventCreationGuidedFlow.css';

// F-GUARD-ANTI-HARDCODE-EVENT-ORCHESTRATION (2026-07-08): EVENT_TYPE_TO_ASPECT_MAP + mapEventTypeToAspect
// REMOVIDOS — eram código MORTO (event_type legado não é autoridade canônica; o declare deriva aspects das
// CATEGORIAS facet, ver FACET_TO_ASPECT em handleStep1Complete). event_type legado não é chave de orquestração.

export interface GuidedFlowData {
  // ETAPA 0 — CONCEPT-FIRST (F-EVENT-CONCEPT-FIRST-MODEL): identidade = formato + tema; categorias = facets.
  // event_type/event_subtype = LEGADO (não mais autoridade; mantidos só p/ compat de transição, não usados).
  event_type: 'social' | 'cultural' | 'gastronomic' | 'professional' | 'community' | 'spiritual' | 'sports' | 'private' | null;
  event_subtype: string | null;
  eventFormatConceptId: string | null;   // OBRIGATÓRIO no novo modelo
  eventFormatLabel: string | null;       // projeção UX
  themeConceptIds: string[];             // OPCIONAL (multi)
  themeLabels: string[];                 // projeção UX
  categoryFacets: string[];              // facets de descoberta (multi, ⊆ taxonomy.categories)
  visibility: 'public' | 'connections' | 'only_me';
  /** 0161: refinamento de plateia (subconjunto do vocabulário GOVERNADO do typed-edge; null = sem). */
  audience_relationship_types?: string[] | null;
  
  // ETAPA 1 - Declaração Inicial (cria rascunho)
  event_id: string | null; // Criado após ETAPA 1
  
  // ETAPA 2 - Descrição e Intenção
  title: string;
  description: string | null;
  // Acesso/custo (vocabulário GOVERNADO pt-BR) + capacidade. Substitui o antigo "tom" (confundia com plateia).
  eventAccessType: 'gratuito' | 'pago' | 'contribuicao_opcional' | null;
  priceReais: string; // valor ANUNCIADO (convertido p/ cents no submit); Δbank=0
  minAttendees: string;
  maxAttendees: string;
  
  // ETAPA 3 - Quando (Time Windows)
  desired_time_windows: Array<{
    start_datetime: string;
    end_datetime: string;
    timezone?: string;
  }>;
  flexibility_level: 'strict' | 'flexible' | 'very_flexible' | null;
  estimated_duration_hours: number | null;
  
  // ETAPA 4 — Onde (LOCAL) — Fase A orquestração. location_mode governado + região via Location Core.
  // space_type/scale = LEGADO removido da UI (não são mais autoridade). restrictions = observação (metadata).
  space_type: 'home' | 'venue' | 'buffet' | null;
  scale: 'small' | 'medium' | 'large' | null;
  restrictions: string | null;
  locationMode: 'fixed_place' | 'to_be_defined' | 'online' | 'hybrid' | null;
  venueCityId: string | null;          // cidade GOVERNADA (Location Core)
  venueCityLabel: string | null;       // projeção UX
  venuePostalCode: string | null;
  venueNeighborhoodDisplay: string | null;
  desiredRadiusKm: string;             // "preciso de local": raio de busca
  locationObservations: string;        // observação livre (metadata, NUNCA matching semântico)

  // ETAPA 5 — Operação: necessidades governadas em event_operational_needs (backend), não mais em estado
  // local. O operational_roles morto (nunca persistido) foi REMOVIDO em F-EVENT-ORCHESTRATION-PHASE-B-WRITE.

  // ETAPA 6 - Preview Econômico (TEST)
  economic_preview: any | null;
  
  // ETAPA 7 - Resumo Final
  // (usa dados das etapas anteriores)
}

const INITIAL_DATA: GuidedFlowData = {
  event_type: null,
  event_subtype: null,
  eventFormatConceptId: null,
  eventFormatLabel: null,
  themeConceptIds: [],
  themeLabels: [],
  categoryFacets: [],
  visibility: 'public',
  event_id: null,
  title: '',
  description: null,
  eventAccessType: null,
  priceReais: '',
  minAttendees: '',
  maxAttendees: '',
  desired_time_windows: [],
  flexibility_level: null,
  estimated_duration_hours: null,
  space_type: null,
  scale: null,
  locationMode: null,
  venueCityId: null,
  venueCityLabel: null,
  venuePostalCode: null,
  venueNeighborhoodDisplay: null,
  desiredRadiusKm: '',
  locationObservations: '',
  restrictions: null,
  economic_preview: null,
};

// initialAudienceKeys: CARRY-OVER da plateia escolhida no composer inicial (IntentComposer). O Step0
// abre com ela já selecionada no AudiencePicker — o usuário não escolhe do zero (fluxo/rascunho; a
// AUTORIDADE segue no backend no submit). Aberto direto (/events/new) = sem prop = escolhe normalmente.
export default function EventCreationGuidedFlow({ initialAudienceKeys, groupId }: { initialAudienceKeys?: string[]; groupId?: string } = {}) {
  const navigate = useNavigate();
  const { activeActor, isLoading } = useActiveActor();
  const { sessionReady } = useSession();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [data, setData] = useState<GuidedFlowData>(INITIAL_DATA);
  const [isLoadingStep, setIsLoadingStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🔴 ESTADO PARA MODO BIRTHDAY
  const [isBirthdayMode, setIsBirthdayMode] = useState(false);
  const [createdEventSpec, setCreatedEventSpec] = useState<EventSpec | null>(null);
  const [compatibleCompanies, setCompatibleCompanies] = useState<CompatibleCompany[]>([]);
  const [rfqId, setRfqId] = useState<string | null>(null);

  // Verificar se contexto institucional está pronto
  const isContextReady = sessionReady && !isLoading && activeActor !== null && isAuthenticated() && getTenantId() !== null;

  const updateData = (updates: Partial<GuidedFlowData>) => {
    setData(prev => ({ ...prev, ...updates }));
    setError(null);
  };

  // ETAPA 0 → ETAPA 1: Criar rascunho
  const handleStep0Complete = async (updatedData?: Partial<GuidedFlowData>) => {
    // 🔴 VALIDAÇÃO DE CONTEXTO INSTITUCIONAL OBRIGATÓRIA
    if (!isContextReady) {
      setError('Aguardando contexto institucional. Por favor, aguarde...');
      return;
    }

    // CONCEPT-FIRST: identidade = FORMATO (concept). event_type deixou de ser autoridade.
    const formatId = updatedData?.eventFormatConceptId ?? data.eventFormatConceptId;
    const themes = updatedData?.themeConceptIds ?? data.themeConceptIds;
    const facets = updatedData?.categoryFacets ?? data.categoryFacets;
    const visibility = updatedData?.visibility ?? data.visibility;

    if (!formatId || !activeActor) {
      setError('Escolha o formato do evento antes de continuar');
      return;
    }

    const tenantId = getTenantId();
    if (!tenantId) {
      setError('Tenant não encontrado. Faça login novamente.');
      return;
    }

    setIsLoadingStep(true);
    setError(null);

    try {
      // Draft FORMATO-FIRST (sem event_type — não é mais autoridade). Só actor + título mínimo.
      const response = await createOrAdvanceDraft({
        event: {
          actor_id: activeActor.actor_id,
          actor_type: activeActor.actor_type as 'user' | 'page',
          visibility: visibility,
          title: 'Rascunho de evento',
          // A1b: quando aberto com contexto de grupo (/events/new?group_id=X), PROJETA o alvo ao writer
          // governado; o backend prova a autoridade (representar o group-actor) e cria o vínculo (F0-grupo).
          ...(groupId ? { group_id: groupId } : {}),
        },
      });
      const eventId = response.event.id;
      updateData({ event_id: eventId });

      // Persiste a IDENTIDADE concept-first: formato + temas + facets (backend valida tudo).
      const { updateEvent, patchEventAudience } = await import('../../api/events');
      await updateEvent(eventId, {
        event_format_concept_id: formatId,
        theme_concept_ids: themes,
        category_facets: facets,
        visibility,
      });

      // Refinamento de plateia (organizer-only; CHECK do banco valida).
      const audienceTypes = updatedData?.audience_relationship_types ?? data.audience_relationship_types ?? null;
      if (audienceTypes && audienceTypes.length > 0) {
        try {
          await patchEventAudience(eventId, visibility, audienceTypes);
        } catch {
          showToast('Não foi possível aplicar a plateia refinada — evento ficou no modo padrão.', 'error');
        }
      }

      setCurrentStep(1);
      showToast('Rascunho criado', 'success');
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao criar rascunho';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingStep(false);
    }
  };

  // ETAPA 1 → ETAPA 2: Declarar evento
  const handleStep1Complete = async () => {
    if (!data.event_id || !data.title) {
      setError('Preencha o título antes de continuar');
      return;
    }

    setIsLoadingStep(true);
    setError(null);

    try {
      // event_aspects (legado obrigatório do declare) DERIVADO das categorias facet (concept-first).
      // Map facet→aspect (esportivo→esportes; educacional/comercial sem aspecto); fallback 'social'.
      const FACET_TO_ASPECT: Record<string, string> = {
        social: 'social', cultural: 'cultural', gastronomico: 'gastronomico', profissional: 'profissional',
        comunitario: 'comunitario', espiritual: 'espiritual', esportivo: 'esportes',
      };
      const aspects = Array.from(new Set(data.categoryFacets.map((f) => FACET_TO_ASPECT[f]).filter(Boolean)));
      await declareEvent(data.event_id, {
        title: data.title,
        description: data.description || null,
        event_aspects: aspects.length > 0 ? aspects : ['social'],
        visibility: data.visibility,
        intent_flags: [],
      });

      setCurrentStep(2);
      showToast('Declaração salva', 'success');
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao declarar evento';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingStep(false);
    }
  };

  // ETAPA 2 → ETAPA 3: Avançar para time windows
  const handleStep2Complete = async () => {
    // Persiste descrição + acesso/custo (anúncio) + capacidade via PATCH /events/:id (updateEvent).
    // Δbank=0: ticket_price_cents é só o valor ANUNCIADO — pagamento/estorno real = etapa futura (Bank).
    if (data.event_id) {
      try {
        const { updateEvent } = await import('../../api/events');
        const min = data.minAttendees.trim() ? parseInt(data.minAttendees, 10) : null;
        const max = data.maxAttendees.trim() ? parseInt(data.maxAttendees, 10) : null;
        if (min != null && max != null && min > max) {
          setError('O mínimo de participantes não pode ser maior que o máximo.');
          return;
        }
        const priceCents = data.eventAccessType === 'pago' && data.priceReais.trim()
          ? Math.round(parseFloat(data.priceReais.replace(',', '.')) * 100) : null;
        await updateEvent(data.event_id, {
          description: data.description ?? null,
          event_access_type: data.eventAccessType,
          ticket_price_cents: priceCents,
          min_attendees: min,
          max_attendees: max,
        });
      } catch {
        setError('Não foi possível salvar acesso/capacidade. Tente novamente.');
        return;
      }
    }
    setError(null);
    setCurrentStep(3);
  };

  // ETAPA 3 → ETAPA 4: Definir time windows
  const handleStep3Complete = async () => {
    if (!data.event_id) {
      setError('Evento não encontrado');
      return;
    }

    if (data.desired_time_windows.length === 0) {
      setError('Defina pelo menos uma janela de tempo possível');
      return;
    }

    setIsLoadingStep(true);
    setError(null);

    try {
      await setTimeWindows(data.event_id, {
        desired_time_windows: data.desired_time_windows,
        flexibility_level: data.flexibility_level || undefined,
        timezone: 'America/Sao_Paulo', // Default - pode ser configurável
      });

      setCurrentStep(4);
      showToast('Janelas de tempo salvas', 'success');
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao salvar janelas de tempo';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingStep(false);
    }
  };

  // ETAPA 4 → ETAPA 5: Avançar para papéis operacionais
  const handleStep4Complete = async () => {
    if (!data.event_id) { setError('Evento não encontrado'); return; }
    if (!data.locationMode) { setError('Informe se você já tem o local'); return; }
    setIsLoadingStep(true); setError(null);
    try {
      const { updateEvent } = await import('../../api/events');
      const isVenue = data.locationMode === 'fixed_place' || data.locationMode === 'hybrid';
      const meta: Record<string, unknown> = {};
      if (data.locationMode === 'to_be_defined' && data.venueCityId) {
        meta.desiredCityId = data.venueCityId;
        meta.desiredRadiusKm = data.desiredRadiusKm.trim() ? parseInt(data.desiredRadiusKm, 10) : null;
      }
      if (data.locationObservations.trim()) meta.locationObservations = data.locationObservations.trim();
      await updateEvent(data.event_id, {
        location_mode: data.locationMode,
        // LOCAL real (já tenho/híbrido) via Location Core; cidade SSOT, nunca texto.
        ...(isVenue && data.venueCityId ? {
          venue_city_id: data.venueCityId,
          venue_neighborhood_display: data.venueNeighborhoodDisplay,
          venue_postal_code: data.venuePostalCode,
        } : {}),
        ...(Object.keys(meta).length > 0 ? { metadata: meta } : {}),
      });
      setCurrentStep(5);
    } catch {
      setError('Não foi possível salvar o local. Tente novamente.');
    } finally {
      setIsLoadingStep(false);
    }
  };

  // ETAPA 5 → ETAPA 6: Avançar para preview econômico
  const handleStep5Complete = async () => {
    if (!data.event_id) {
      setError('Evento não encontrado');
      return;
    }

    setIsLoadingStep(true);
    setError(null);

    try {
      const response = await getEventSummary(data.event_id);
      updateData({ economic_preview: response.summary.economic_preview });
      setCurrentStep(6);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao carregar preview econômico';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoadingStep(false);
    }
  };

  // ETAPA 6 → ETAPA 7: Avançar para resumo final
  const handleStep6Complete = () => {
    setCurrentStep(7);
  };

  // ETAPA 7: Finalizar (avançar para fase econômica ou salvar)
  const handleStep7Complete = () => {
    if (data.event_id) {
      // Navegar para fase econômica (sem executar nada)
      navigate(`/events/${data.event_id}/economic`);
    }
  };

  const handleCancel = () => {
    navigate('/eventos');
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 🔴 VALIDAÇÃO DE CONTEXTO INSTITUCIONAL
  // Aguardar sessionReady, activeActor e tenant antes de renderizar
  if (isLoading || !sessionReady) {
    return (
      <div className="event-creation-guided-flow">
        <div className="flow-loading">Carregando contexto institucional...</div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return (
      <div className="event-creation-guided-flow">
        <div className="flow-error">
          <p>Você precisa estar autenticado para criar um evento.</p>
          <button onClick={handleCancel}>Voltar</button>
        </div>
      </div>
    );
  }

  if (!getTenantId()) {
    return (
      <div className="event-creation-guided-flow">
        <div className="flow-error">
          <p>Tenant não encontrado. Faça login novamente.</p>
          <button onClick={handleCancel}>Voltar</button>
        </div>
      </div>
    );
  }

  if (!activeActor) {
    return (
      <div className="event-creation-guided-flow">
        <div className="flow-error">
          <p>Nenhum actor ativo encontrado. Por favor, selecione um actor antes de criar um evento.</p>
          <button onClick={handleCancel}>Voltar</button>
        </div>
      </div>
    );
  }

  const stepTitles = [
    'Tipo de Evento',
    'Declaração Inicial',
    'Descrição e Intenção',
    'Quando (Janelas de Tempo)',
    'Onde (Requisitos de Espaço)',
    'Operação (Papéis)',
    'Preview Econômico (TEST)',
    'Resumo Final',
  ];

  return (
    <div className="event-creation-guided-flow">
      <div className="flow-header">
        <h1>Explorar Ideia de Evento</h1>
        <p className="flow-subtitle">
          Este é um rascunho. Nada será pago, reservado ou contratado nesta fase.
        </p>
      </div>

      {/* Indicador de progresso */}
      <div className="flow-progress">
        {stepTitles.map((title, index) => (
          <div
            key={index}
            className={`progress-step ${index === currentStep ? 'active' : index < currentStep ? 'completed' : ''}`}
          >
            <div className="progress-step-number">{index + 1}</div>
            <div className="progress-step-title">{title}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flow-error-message">
          {error}
        </div>
      )}

      <div className="flow-content">
        {/* 🔴 P0-1: MODO BIRTHDAY - Renderizar BirthdayWizard com eventId */}
        {isBirthdayMode ? (
          <BirthdayWizard
            data={{
              ...data,
              event_type: data.event_type || 'private',
              event_subtype: 'birthday',
              event_id: data.event_id, // 🔴 P0-1: Garantir que eventId está disponível
            } as any}
            onUpdate={(updates) => {
              updateData(updates);
            }}
            onComplete={async (eventSpec?: EventSpec) => {
              // Após finalizar BirthdayWizard, criar RFQ e buscar empresas
              if (!data.event_id) {
                showToast('Erro: Evento não encontrado', 'error');
                return;
              }

              // Se EventSpec foi passado, usar ele; senão, buscar o mais recente
              const specToUse = eventSpec || createdEventSpec;
              if (!specToUse) {
                showToast('Erro: EventSpec não encontrado', 'error');
                return;
              }

              setCreatedEventSpec(specToUse);

              setIsLoadingStep(true);
              setError(null);

              try {
                // 1. Criar RFQ a partir de EventSpec
                const rfqResult = await createRFQFromSpec(data.event_id, specToUse.spec_id);
                setRfqId(rfqResult.rfq.rfqId);

                // 2. Buscar empresas compatíveis
                const companiesResult = await getCompatibleCompanies(data.event_id, rfqResult.rfq.rfqId);
                setCompatibleCompanies(companiesResult.companies || []);

                showToast('RFQ criado com sucesso! Empresas compatíveis encontradas.', 'success');
                
                // 3. Navegar para página de seleção de empresas / dispatch
                // Por enquanto, apenas mostrar sucesso e navegar para o evento
                navigate(`/events/${data.event_id}?rfq=${rfqResult.rfq.rfqId}`);
              } catch (err: any) {
                console.error('Erro ao criar RFQ:', err);
                setError(err.message || 'Erro ao criar RFQ e buscar empresas');
                showToast(err.message || 'Erro ao criar RFQ e buscar empresas', 'error');
              } finally {
                setIsLoadingStep(false);
              }
            }}
          />
        ) : (
          <>
            {currentStep === 0 && (
              <Step0EventType
                data={data}
                onUpdate={updateData}
                onComplete={handleStep0Complete}
                isLoading={isLoadingStep}
                initialAudienceKeys={initialAudienceKeys}
              />
            )}

        {currentStep === 1 && (
          <Step1Declaration
            data={data}
            onUpdate={updateData}
            onComplete={handleStep1Complete}
            isLoading={isLoadingStep}
          />
        )}

        {currentStep === 2 && (
          <Step2Description
            data={data}
            onUpdate={updateData}
            onComplete={handleStep2Complete}
          />
        )}

        {currentStep === 3 && (
          <Step3TimeWindows
            data={data}
            onUpdate={updateData}
            onComplete={handleStep3Complete}
            isLoading={isLoadingStep}
          />
        )}

        {currentStep === 4 && (
          <Step4SpaceRequirements
            data={data}
            onUpdate={updateData}
            onComplete={handleStep4Complete}
          />
        )}

        {currentStep === 5 && (
          <Step5OperationalRoles
            data={data}
            onUpdate={updateData}
            onComplete={handleStep5Complete}
            isLoading={isLoadingStep}
          />
        )}

        {currentStep === 6 && (
          <Step6EconomicPreview
            data={data}
            economicPreview={data.economic_preview}
            onComplete={handleStep6Complete}
          />
        )}

        {currentStep === 7 && (
          <Step7FinalSummary
            data={data}
            onComplete={handleStep7Complete}
            onAdvanceToEconomic={() => {
              if (data.event_id) {
                navigate(`/events/${data.event_id}/economic`);
              }
            }}
          />
        )}
          </>
        )}
      </div>

      <div className="flow-actions">
        <button
          className="flow-button flow-button-secondary"
          onClick={handleCancel}
          disabled={isLoadingStep}
        >
          Cancelar
        </button>
        {currentStep > 0 && (
          <button
            className="flow-button flow-button-secondary"
            onClick={handleBack}
            disabled={isLoadingStep}
          >
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}


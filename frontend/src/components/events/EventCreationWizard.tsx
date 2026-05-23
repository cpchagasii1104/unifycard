// frontend/src/components/events/EventCreationWizard.tsx
// FASE 5 — WIZARD ORQUESTRADOR GENÉRICO
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO conhece domínio
// - Apenas orquestra páginas dinamicamente
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_WIZARD_ORQUESTRATOR_CONTRACT.md

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getEventById, createEvent, type CreateEventInput } from '../../api/events';
import { getEventSpecById, updateEventSpecIncremental, closeEventSpec, getActiveEventSpecForEvent, createEventSpec } from '../../api/event-spec';
import { getTenantId } from '../../config/auth';
import { showToast } from '../common/Toast';
import { getPagesForEventType, isEventTypeRegistered } from './wizard/WizardPageRegistry';
import type { WizardPageDefinition } from './wizard/WizardPageRegistry';
import * as Pages from './wizard/pages';
import './EventCreationWizard.css';

/**
 * Dados compartilhados entre as páginas do wizard (steps).
 * Cada step pode ler/escrever campos via onUpdate(Partial<WizardData>).
 * Tipagem permissiva para compatibilidade com steps que acessam data.foundation, data.birthday_profile, etc.
 */
export type WizardData = Record<string, any>;

/**
 * EventCreationWizard - Orquestrador Genérico de Páginas
 * 
 * 🔴 REGRA DE OURO:
 * - Não conhece tipo de evento
 * - Não contém lógica de domínio
 * - Apenas orquestra páginas dinamicamente
 * - Consulta Page Registry para saber quais páginas renderizar
 */
export default function EventCreationWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeActor, isLoading } = useActiveActor();

  // Estado do Wizard
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [eventSpec, setEventSpec] = useState<any>(null);
  const [pages, setPages] = useState<WizardPageDefinition[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicialização: Buscar event_id da query string ou criar novo evento
  useEffect(() => {
    const eventIdParam = searchParams.get('eventId');
    if (eventIdParam) {
      setEventId(eventIdParam);
    } else {
      // Se não tem eventId, criar um evento draft inicial
      // 🔴 NOTA: Esta é criação mínima - apenas para ter um event_id
      // O event_type será definido na primeira página (CommonProjectNamePage não define, mas pode vir de outra fonte)
      // Por enquanto, assumir que eventId é obrigatório via query param
      // TODO: Implementar criação inicial de evento se necessário
    }
  }, [searchParams]);

  // Buscar dados do evento e EventSpec
  useEffect(() => {
    if (!eventId || isLoading || !activeActor) return;

    const loadData = async () => {
      setIsLoadingData(true);
      setError(null);

      try {
        // 1. Buscar evento para obter event_type
        const eventResponse = await getEventById(eventId);
        const event = eventResponse.event;
        
        if (!event) {
          throw new Error('Evento não encontrado');
        }

        setEventType(event.event_type);

        // 2. Verificar se event_type está registrado no Page Registry
        if (!isEventTypeRegistered(event.event_type)) {
          throw new Error(`Tipo de evento '${event.event_type}' não está registrado no Page Registry`);
        }

        // 3. Consultar Page Registry para obter lista de páginas
        const pageList = getPagesForEventType(event.event_type);
        if (!pageList || pageList.length === 0) {
          throw new Error(`Nenhuma página registrada para o tipo de evento '${event.event_type}'`);
        }
        setPages(pageList);

        // 4. Buscar EventSpec ativo (não fechado) para este evento
        const activeSpec = await getActiveEventSpecForEvent(eventId);
        
        if (activeSpec) {
          setEventSpec(activeSpec);
        } else {
          // Se não existe EventSpec, criar um inicial (vazio, em construção)
          const tenantId = getTenantId();
          if (tenantId && activeActor) {
            // Determinar macro_intention e subflow baseado em event_type
            // 🔴 NOTA: Esta é a ÚNICA lógica condicional permitida - mapeamento técnico, não de negócio
            const macroIntentionMap: Record<string, string> = {
              'private': 'celebrate',
              'social': 'gather',
              'cultural': 'present',
              'professional': 'teach',
            };
            const subflowMap: Record<string, string> = {
              'birthday': 'birthday_party',
            };
            
            const macroIntention = (macroIntentionMap[event.event_type] || 'other') as any;
            const subflow = (event.event_subtype && subflowMap[event.event_subtype]) 
              ? (subflowMap[event.event_subtype] as any)
              : 'other';
            
            const newSpec = await createEventSpec({
              tenant_id: tenantId,
              actor_id: activeActor.actor_id,
              actor_type: activeActor.actor_type as 'user' | 'page' | 'group' | 'channel',
              macro_intention: macroIntention,
              subflow: subflow,
              answers: {},
              event_id: eventId,
              metadata: {
                lifecycle_stage: 'INTENT_DRAFT',
              },
            });
            
            setEventSpec(newSpec);
          }
        }

      } catch (err: any) {
        console.error('Erro ao carregar dados:', err);
        setError(err.message || 'Erro ao carregar dados do evento');
        showToast(err.message || 'Erro ao carregar dados do evento', 'error');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, [eventId, isLoading, activeActor]);

  // Mapear nome do componente para componente React
  const getPageComponent = (componentName: string): React.ComponentType<any> | null => {
    const componentMap: Record<string, React.ComponentType<any>> = {
      'CommonProjectNamePage': Pages.CommonProjectNamePage,
      'CommonFinalizePage': Pages.CommonFinalizePage,
      'BirthdayProfilePage': Pages.BirthdayProfilePage,
      'BirthdayAttendancePage': Pages.BirthdayAttendancePage,
      'BirthdayLocationPage': Pages.BirthdayLocationPage,
      'BirthdayStyleThemePage': Pages.BirthdayStyleThemePage,
      'BirthdayActivitiesPage': Pages.BirthdayActivitiesPage,
      'BirthdayMusicAVPage': Pages.BirthdayMusicAVPage,
      'BirthdaySupportServicesPage': Pages.BirthdaySupportServicesPage,
      'BirthdayTimeWindowPage': Pages.BirthdayTimeWindowPage,
    };

    return componentMap[componentName] || null;
  };

  // Salvar incrementalmente (chamado a cada onChange de página)
  const saveIncremental = useCallback(async (partialSpec: Record<string, any>) => {
    if (!eventSpec?.spec_id) {
      // Se não tem EventSpec ainda, criar um novo
      // TODO: Implementar criação inicial de EventSpec quando necessário
      console.warn('EventSpec não existe ainda. Criar novo EventSpec antes de atualizar.');
      return;
    }

    try {
      const updatedSpec = await updateEventSpecIncremental(
        eventSpec.spec_id,
        partialSpec
      );
      setEventSpec(updatedSpec);
    } catch (err: any) {
      console.error('Erro ao salvar incremental:', err);
      showToast('Erro ao salvar alterações', 'error');
    }
  }, [eventSpec]);

  // Fechar EventSpec (chamado pela CommonFinalizePage)
  const handleFinalize = useCallback(async () => {
    if (!eventSpec?.spec_id) {
      setError('EventSpec não encontrado');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await closeEventSpec(eventSpec.spec_id);
      showToast('Planejamento salvo com sucesso!', 'success');
      
      // Navegar para página do evento
      if (eventId) {
        navigate(`/events/${eventId}`);
      } else {
        navigate('/eventos');
      }
    } catch (err: any) {
      console.error('Erro ao fechar EventSpec:', err);
      setError(err.message || 'Erro ao salvar planejamento');
      showToast(err.message || 'Erro ao salvar planejamento', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [eventSpec, eventId, navigate]);

  // Navegação
  const handleNext = () => {
    if (currentStep < pages.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Renderização
  if (isLoading || isLoadingData) {
    return (
      <div className="wizard-container">
        <div className="wizard-loading">Carregando...</div>
      </div>
    );
  }

  if (!activeActor) {
    return (
      <div className="wizard-container">
        <div className="wizard-error">
          <p>Nenhum actor ativo encontrado. Por favor, selecione um actor antes de criar um evento.</p>
          <button onClick={() => navigate('/home')}>Voltar</button>
        </div>
      </div>
    );
  }

  if (error && !eventType) {
    return (
      <div className="wizard-container">
        <div className="wizard-error">
          <p>{error}</p>
          <button onClick={() => navigate('/eventos')}>Voltar</button>
        </div>
      </div>
    );
  }

  if (!eventType || pages.length === 0) {
    return (
      <div className="wizard-container">
        <div className="wizard-error">
          <p>Tipo de evento não suportado ou páginas não encontradas.</p>
          <button onClick={() => navigate('/eventos')}>Voltar</button>
        </div>
      </div>
    );
  }

  // Obter página atual
  const currentPage = pages[currentStep];
  if (!currentPage) {
    return (
      <div className="wizard-container">
        <div className="wizard-error">
          <p>Página não encontrada.</p>
          <button onClick={() => navigate('/eventos')}>Voltar</button>
        </div>
      </div>
    );
  }

  const PageComponent = getPageComponent(currentPage.component);
  if (!PageComponent) {
    return (
      <div className="wizard-container">
        <div className="wizard-error">
          <p>Componente de página não encontrado: {currentPage.component}</p>
          <button onClick={() => navigate('/eventos')}>Voltar</button>
        </div>
      </div>
    );
  }

  // Preparar eventSpec para páginas (sempre objeto, mesmo se null)
  const eventSpecForPages = eventSpec || {
    spec_id: null,
    answers: {},
  };

  // Determinar se é a última página (CommonFinalizePage)
  const isLastPage = currentPage.id === 'finalize';

  return (
    <div className="wizard-container">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h1 id="wizard-title">Criar Novo Evento</h1>
          <button
            className="wizard-close-button"
            onClick={() => navigate('/eventos')}
            aria-label="Fechar wizard"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Progresso */}
        <div className="wizard-progress">
          {pages.map((page, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div
                key={page.id}
                className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                title={`Etapa ${index + 1}: ${page.id}`}
              >
                <div className="step-number">{index + 1}</div>
              </div>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div className="wizard-content">
          {error && (
            <div className="wizard-error-message">
              {error}
            </div>
          )}

          {/* Renderizar página atual */}
          {isLastPage ? (
            <PageComponent
              eventSpec={eventSpecForPages}
              onFinalize={handleFinalize}
              isClosing={isSaving}
            />
          ) : (
            <PageComponent
              eventSpec={eventSpecForPages}
              onChange={saveIncremental}
            />
          )}
        </div>

        {/* Navegação (não mostrar na última página - CommonFinalizePage tem seu próprio botão) */}
        {!isLastPage && (
          <div className="wizard-footer">
            {currentStep > 0 && (
              <button
                className="wizard-button wizard-button-secondary"
                onClick={handleBack}
                disabled={isSaving}
                type="button"
                aria-label="Voltar para o passo anterior"
              >
                Voltar
              </button>
            )}
            {currentStep < pages.length - 1 && (
              <button
                className="wizard-button wizard-button-primary"
                onClick={handleNext}
                disabled={isSaving}
                type="button"
                aria-label="Avançar para o próximo passo"
              >
                Próximo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

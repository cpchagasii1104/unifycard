// frontend/src/components/events/EventWizardAdaptive.tsx
// Event Wizard Adaptativo - Fluxo guiado inteligente
// 🔴 BLINDAGEM: Nenhuma automação silenciosa
// 🔴 BLINDAGEM: Todas as decisões são explícitas

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getWizardConfiguration, getContextualHelpText } from '../../services/event-wizard-rules';
import { discoverServices } from '../../api/service-discovery';
import type {
  EventWizardContext,
  WizardQuestion,
  ServiceSuggestion,
  WizardAnswers,
  EventWizardConfig,
  EventSubtype,
} from '../../types/event-wizard';
import type { DiscoveredService } from '../../api/service-discovery';
import './EventWizardAdaptive.css';

interface EventWizardAdaptiveProps {
  eventType: string;
  eventSubtype?: EventSubtype;
  onComplete: (config: EventWizardConfig) => void;
  onCancel: () => void;
  onSkip?: () => void;
}

export default function EventWizardAdaptive({
  eventType,
  eventSubtype,
  onComplete,
  onCancel,
  onSkip,
}: EventWizardAdaptiveProps) {
  const { activeActor } = useActiveActor();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({});
  const [suggestedServices, setSuggestedServices] = useState<DiscoveredService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // Criar contexto
  const context: EventWizardContext = {
    eventType,
    eventSubtype,
    actorType: (activeActor?.actor_type as any) || 'user',
    actorId: activeActor?.actor_id || '',
  };

  // Obter configuração do wizard
  const wizardConfig = getWizardConfiguration(context);

  // Filtrar perguntas visíveis baseado em condições
  const visibleQuestions = wizardConfig.questions.filter((q) => {
    if (q.showCondition) {
      return q.showCondition(answers);
    }
    if (q.skipCondition) {
      return !q.skipCondition(answers);
    }
    return true;
  });

  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= visibleQuestions.length - 1;

  // Carregar serviços sugeridos quando necessário
  useEffect(() => {
    if (isLastQuestion && wizardConfig.serviceSuggestions.length > 0) {
      loadSuggestedServices();
    }
  }, [isLastQuestion, answers]);

  const loadSuggestedServices = async () => {
    setIsLoadingServices(true);
    try {
      // Buscar serviços para cada sugestão
      const allServices: DiscoveredService[] = [];
      
      for (const suggestion of wizardConfig.serviceSuggestions) {
        const filters: any = {};
        if (suggestion.discoveryFilters?.categoryId) {
          filters.category_id = suggestion.discoveryFilters.categoryId;
        }
        if (suggestion.discoveryFilters?.actorType) {
          filters.actor_type = suggestion.discoveryFilters.actorType;
        }
        if (answers.event_date_start) {
          filters.start_date = answers.event_date_start;
        }
        if (answers.event_date_end) {
          filters.end_date = answers.event_date_end;
        }
        filters.has_availability = true;
        filters.limit = 5; // Limitar a 5 por categoria

        try {
          const services = await discoverServices(filters);
          allServices.push(...services);
        } catch (err) {
          // Ignorar erros de busca individual
          console.warn(`Erro ao buscar serviços para ${suggestion.category}:`, err);
        }
      }

      setSuggestedServices(allServices);
    } catch (err) {
      console.error('Erro ao carregar serviços sugeridos:', err);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleAnswer = (value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = () => {
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      return; // Não avança se pergunta obrigatória não foi respondida
    }

    if (isLastQuestion) {
      handleComplete();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSkip = () => {
    if (isLastQuestion) {
      handleComplete();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleComplete = () => {
    // Processar capacidade e infraestrutura
    const expectedAttendance = answers.expected_attendance ? Number(answers.expected_attendance) : null;
    const venueInfrastructure = answers.venue_infrastructure
      ? (Array.isArray(answers.venue_infrastructure) ? answers.venue_infrastructure : [answers.venue_infrastructure])
      : [];

    const config: EventWizardConfig = {
      context,
      answers,
      serviceSuggestions: wizardConfig.serviceSuggestions,
      moduleActivations: wizardConfig.moduleActivations,
      needsAssistance: answers.needs_assistance === true,
      completedAt: new Date().toISOString(),
      // DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK: activeActor.user_id é NULL pra actor_type='page'
      // (empresa organizadora) — cenário comum de criação de evento. actor_id é sempre populado.
      completedBy: activeActor?.actor_id || '',
      // Incluir capacidade e infraestrutura no config
      capacity: expectedAttendance
        ? {
            expectedAttendance: expectedAttendance,
            capacityClass: getCapacityClass(expectedAttendance),
          }
        : undefined,
      venueInfrastructure: venueInfrastructure.length > 0
        ? {
            available: venueInfrastructure,
            unavailable: [],
            constraints: [],
          }
        : undefined,
    };

    onComplete(config);
  };

  // Helper para calcular classe de capacidade
  const getCapacityClass = (attendance: number): 'S' | 'M' | 'L' | 'XL' | 'XXL' => {
    if (attendance <= 50) return 'S';
    if (attendance <= 200) return 'M';
    if (attendance <= 800) return 'L';
    if (attendance <= 3000) return 'XL';
    return 'XXL';
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;

    const helpText = getContextualHelpText(context, currentQuestion.id) || currentQuestion.helpText;

    return (
      <div className="wizard-question">
        <div className="question-header">
          <h3>{currentQuestion.question}</h3>
          {helpText && (
            <div className="help-bubble">
              <span className="help-icon">💡</span>
              <p>{helpText}</p>
            </div>
          )}
        </div>

        <div className="question-content">
          {currentQuestion.type === 'yes_no' && (
            <div className="yes-no-buttons">
              <button
                className={`answer-button ${answers[currentQuestion.id] === true ? 'selected' : ''}`}
                onClick={() => handleAnswer(true)}
              >
                Sim
              </button>
              <button
                className={`answer-button ${answers[currentQuestion.id] === false ? 'selected' : ''}`}
                onClick={() => handleAnswer(false)}
              >
                Não
              </button>
            </div>
          )}

          {currentQuestion.type === 'multiple_choice' && 
            currentQuestion.id !== 'venue_infrastructure' && 
            currentQuestion.id !== 'operational_services' && 
            currentQuestion.id !== 'birthday_items' &&
            currentQuestion.id !== 'food_and_beverages' && (
            <div className="multiple-choice-options">
              {currentQuestion.options?.map((option) => (
                <label key={option.value} className="option-label">
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={option.value}
                    checked={answers[currentQuestion.id] === option.value}
                    onChange={(e) => handleAnswer(e.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'text' && (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Digite sua resposta..."
              rows={4}
            />
          )}

          {currentQuestion.type === 'date' && (
            <input
              type="date"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
            />
          )}

          {currentQuestion.type === 'number' && (
            <input
              type="number"
              min="1"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(parseFloat(e.target.value) || 0)}
              placeholder="Ex: 100"
            />
          )}

          {currentQuestion.type === 'multiple_choice' && (
            currentQuestion.id === 'venue_infrastructure' || 
            currentQuestion.id === 'operational_services' || 
            currentQuestion.id === 'birthday_items' ||
            currentQuestion.id === 'food_and_beverages'
          ) && (
            <div className="multiple-choice-checkboxes">
              {currentQuestion.options?.map((option) => (
                <label key={option.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={Array.isArray(answers[currentQuestion.id])
                      ? answers[currentQuestion.id].includes(option.value)
                      : answers[currentQuestion.id] === option.value}
                    onChange={(e) => {
                      const current = Array.isArray(answers[currentQuestion.id])
                        ? answers[currentQuestion.id]
                        : answers[currentQuestion.id]
                        ? [answers[currentQuestion.id]]
                        : [];
                      if (e.target.checked) {
                        handleAnswer([...current, option.value]);
                      } else {
                        handleAnswer(current.filter((v: string) => v !== option.value));
                      }
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!isLastQuestion) return null;

    return (
      <div className="wizard-summary">
        <h3>Resumo da Configuração</h3>

        <div className="summary-section">
          <h4>Módulos a Ativar:</h4>
          <ul>
            {wizardConfig.moduleActivations.map((activation, index) => (
              <li key={index}>
                <strong>{activation.module}</strong>: {activation.reason}
              </li>
            ))}
          </ul>
        </div>

        {wizardConfig.serviceSuggestions.length > 0 && (
          <div className="summary-section">
            <h4>Serviços Sugeridos:</h4>
            <ul>
              {wizardConfig.serviceSuggestions.map((suggestion, index) => (
                <li key={index}>
                  <strong>{suggestion.category}</strong>: {suggestion.description}
                  {suggestion.canCreateBundle && <span className="bundle-badge">Pode criar bundle</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoadingServices ? (
          <div className="loading-services">Carregando serviços sugeridos...</div>
        ) : suggestedServices.length > 0 && (
          <div className="summary-section">
            <h4>Serviços Encontrados ({suggestedServices.length}):</h4>
            <div className="services-preview">
              {suggestedServices.slice(0, 5).map((service) => (
                <div key={service.serviceId} className="service-preview-card">
                  <h5>{service.name}</h5>
                  <p>{service.shortDescription || service.description || 'Sem descrição'}</p>
                </div>
              ))}
            </div>
            <p className="services-note">
              💡 Você pode buscar mais serviços depois ou criar bundles com estes.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="event-wizard-adaptive">
      <div className="wizard-header">
        <h2>Configuração do Evento</h2>
        <p className="wizard-subtitle">
          Vamos personalizar seu evento baseado no tipo e no seu perfil.
        </p>
        <div className="wizard-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / visibleQuestions.length) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            Pergunta {currentQuestionIndex + 1} de {visibleQuestions.length}
          </span>
        </div>
      </div>

      <div className="wizard-content">
        {renderQuestion()}
        {renderSummary()}
      </div>

      <div className="wizard-actions">
        {currentQuestionIndex > 0 && (
          <button className="btn-secondary" onClick={handleBack}>
            Voltar
          </button>
        )}
        {onSkip && (
          <button className="btn-secondary" onClick={onSkip}>
            Pular Wizard
          </button>
        )}
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          className="btn-primary"
          onClick={isLastQuestion ? handleComplete : handleNext}
          disabled={currentQuestion?.required && !answers[currentQuestion.id]}
        >
          {isLastQuestion ? 'Finalizar' : 'Próximo'}
        </button>
      </div>
    </div>
  );
}


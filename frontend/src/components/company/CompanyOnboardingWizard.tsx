// frontend/src/components/company/CompanyOnboardingWizard.tsx
// Wizard de onboarding e configuração de empresa

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import {
  updateCompany,
  getOperationalCompanyTypes,
  getAllowedConceptsForCompanyType,
  activateCompanyOperationally,
  type OperationalCompanyType,
  type AllowedOperationalConcept,
} from '../../api/companies';
import { showToast } from '../common/Toast';
import type {
  CompanyModules,
  CompanyInitialRoles,
  CompanyCalendarConfig,
  CompanyOnboardingConfig,
} from '../../types/company-onboarding';
import './CompanyOnboardingWizard.css';

interface CompanyOnboardingWizardProps {
  companyId: string;
  companyName: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const TOTAL_STEPS = 5;

export default function CompanyOnboardingWizard({
  companyId,
  companyName,
  onComplete,
  onCancel,
}: CompanyOnboardingWizardProps) {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado do wizard
  // F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR: classificação operacional = par soberano
  // (companyTypeId, conceptId), vindo do catálogo governado do backend. SEM businessType.
  const [companyTypes, setCompanyTypes] = useState<OperationalCompanyType[]>([]);
  const [companyTypesLoading, setCompanyTypesLoading] = useState(true);
  const [companyTypesError, setCompanyTypesError] = useState<string | null>(null);
  const [selectedCompanyTypeId, setSelectedCompanyTypeId] = useState<string>('');

  const [concepts, setConcepts] = useState<AllowedOperationalConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');

  const [modules, setModules] = useState<CompanyModules>({
    services: false,
    events: false,
    calendar: false,
    financial: false,
  });
  const [initialRoles, setInitialRoles] = useState<CompanyInitialRoles>({
    owner: true, // Sempre true para criador
    manager: false,
    staff: false,
  });
  const [calendarConfig, setCalendarConfig] = useState<CompanyCalendarConfig>({
    defaultStartTime: '09:00',
    defaultEndTime: '18:00',
    activeDays: [1, 2, 3, 4, 5], // Segunda a sexta
    timezone: 'America/Sao_Paulo',
  });

  // Carrega o catálogo governado de company_types (Momento 2) ao montar.
  useEffect(() => {
    let cancelled = false;
    setCompanyTypesLoading(true);
    setCompanyTypesError(null);
    getOperationalCompanyTypes()
      .then((types) => {
        if (!cancelled) setCompanyTypes(types);
      })
      .catch((err: any) => {
        if (!cancelled) setCompanyTypesError(err?.message || 'Erro ao carregar tipos de empresa');
      })
      .finally(() => {
        if (!cancelled) setCompanyTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ao escolher o company_type, carrega os concepts PERMITIDOS daquele type (e reseta a escolha).
  useEffect(() => {
    if (!selectedCompanyTypeId) {
      setConcepts([]);
      setSelectedConceptId('');
      setConceptsError(null);
      return;
    }
    let cancelled = false;
    setConceptsLoading(true);
    setConceptsError(null);
    setSelectedConceptId('');
    getAllowedConceptsForCompanyType(selectedCompanyTypeId)
      .then((list) => {
        if (!cancelled) setConcepts(list);
      })
      .catch((err: any) => {
        if (!cancelled) setConceptsError(err?.message || 'Erro ao carregar atividades permitidas');
      })
      .finally(() => {
        if (!cancelled) setConceptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyTypeId]);

  const handleNext = () => {
    // Validações por etapa
    if (currentStep === 1 && (!selectedCompanyTypeId || !selectedConceptId)) {
      showToast('Selecione o tipo da empresa e a atividade', 'error');
      return;
    }

    if (currentStep === 2 && !modules.services && !modules.events && !modules.calendar) {
      showToast('Selecione pelo menos um módulo', 'error');
      return;
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleModuleToggle = (module: keyof CompanyModules) => {
    setModules((prev) => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  const handleRoleToggle = (role: keyof CompanyInitialRoles) => {
    if (role === 'owner') return; // Owner não pode ser desativado
    setInitialRoles((prev) => ({
      ...prev,
      [role]: !prev[role],
    }));
  };

  const handleDayToggle = (day: number) => {
    setCalendarConfig((prev) => {
      const newDays = prev.activeDays.includes(day)
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day].sort();
      return { ...prev, activeDays: newDays };
    });
  };

  const handleSubmit = async () => {
    if (!selectedCompanyTypeId || !selectedConceptId) {
      showToast('Selecione o tipo da empresa e a atividade', 'error');
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      // ── Momento 2 — ATIVAÇÃO OPERACIONAL: grava o par soberano no backend ──────
      // (primary_company_type_id, primary_concept_id). Autoridade contextual e validação
      // do par são resolvidas no backend. Falha aqui ABORTA — nada de UX é salvo.
      try {
        await activateCompanyOperationally(companyId, {
          companyTypeId: selectedCompanyTypeId,
          conceptId: selectedConceptId,
        });
      } catch (error: any) {
        const code = error?.code;
        let msg = error?.message || 'Erro ao ativar a empresa';
        if (code === 'COMPANY_TYPE_CONCEPT_NOT_ALLOWED') {
          msg = 'A combinação de tipo de empresa e atividade não é permitida.';
        } else if (code === 'COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN') {
          msg = 'Você não tem autoridade para ativar operacionalmente esta empresa.';
        } else if (code === 'COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION') {
          msg = 'Esta empresa já foi ativada com outra classificação.';
        }
        showToast(msg, 'error');
        setIsSubmitting(false);
        return;
      }

      // ── Config de UX (NÃO é verdade operacional): módulos/papéis/agenda + marcador ──
      const config: CompanyOnboardingConfig = {
        modules,
        initialRoles,
        calendarConfig,
        completedAt: new Date().toISOString(),
        completedBy: activeActor?.user_id,
      };

      await updateCompany(companyId, {
        metadata: {
          onboarding: config,
          onboardingCompleted: true,
        },
      });

      showToast('Empresa ativada e configuração salva!', 'success');

      if (onComplete) {
        onComplete();
      } else {
        navigate(`/empresa/${companyId}`);
      }
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar configuração', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="company-onboarding-wizard">
      <div className="wizard-header">
        <h1>Configuração Inicial da Empresa</h1>
        <p className="wizard-subtitle">{companyName}</p>
        <div className="wizard-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="progress-text">Etapa {currentStep} de {TOTAL_STEPS}</span>
        </div>
      </div>

      <div className="wizard-content">
        {/* Etapa 1: Classificação operacional — par soberano (company_type + concept) */}
        {currentStep === 1 && (
          <div className="wizard-step">
            <h2>Qual o tipo da sua empresa?</h2>
            <p className="step-description">
              Selecione o tipo e a atividade principal. Isso define a classificação operacional
              canônica da empresa.
            </p>

            {companyTypesLoading && <p className="step-description">Carregando tipos…</p>}
            {companyTypesError && (
              <p className="step-description" role="alert">{companyTypesError}</p>
            )}
            {!companyTypesLoading && !companyTypesError && companyTypes.length === 0 && (
              <p className="step-description">Nenhum tipo de empresa disponível.</p>
            )}

            {!companyTypesLoading && !companyTypesError && companyTypes.length > 0 && (
              <div className="business-type-grid">
                {companyTypes.map((type) => (
                  <button
                    key={type.companyTypeId}
                    className={`business-type-card ${selectedCompanyTypeId === type.companyTypeId ? 'selected' : ''}`}
                    onClick={() => setSelectedCompanyTypeId(type.companyTypeId)}
                  >
                    <h3>{type.name}</h3>
                    <p>{type.slug}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedCompanyTypeId && (
              <div className="concept-selection">
                <h3>Atividade principal</h3>
                {conceptsLoading && <p className="step-description">Carregando atividades…</p>}
                {conceptsError && <p className="step-description" role="alert">{conceptsError}</p>}
                {!conceptsLoading && !conceptsError && concepts.length === 0 && (
                  <p className="step-description">
                    Nenhuma atividade disponível para este tipo. Não é possível ativar a empresa.
                  </p>
                )}
                {!conceptsLoading && !conceptsError && concepts.length > 0 && (
                  <div className="business-type-grid">
                    {concepts.map((c) => (
                      <button
                        key={c.conceptId}
                        className={`business-type-card ${selectedConceptId === c.conceptId ? 'selected' : ''}`}
                        onClick={() => setSelectedConceptId(c.conceptId)}
                      >
                        {/* DECISION-0107: nome legível (concept_labels) com fallback técnico ao slug.
                            Identidade/ativação seguem por c.conceptId — displayName é só apresentação. */}
                        <h3>{c.displayName ?? c.slug}</h3>
                        <p>{c.domain}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Etapa 2: Módulos */}
        {currentStep === 2 && (
          <div className="wizard-step">
            <h2>Quais módulos você quer ativar?</h2>
            <p className="step-description">
              Você pode ativar ou desativar módulos depois, mas vamos começar com o essencial.
            </p>
            <div className="modules-list">
              <div className="module-card">
                <div className="module-header">
                  <input
                    type="checkbox"
                    id="module-services"
                    checked={modules.services}
                    onChange={() => handleModuleToggle('services')}
                  />
                  <label htmlFor="module-services">
                    <h3>Serviços</h3>
                    <p>Oferecer e gerenciar serviços</p>
                  </label>
                </div>
              </div>

              <div className="module-card">
                <div className="module-header">
                  <input
                    type="checkbox"
                    id="module-events"
                    checked={modules.events}
                    onChange={() => handleModuleToggle('events')}
                  />
                  <label htmlFor="module-events">
                    <h3>Eventos</h3>
                    <p>Criar e gerenciar eventos</p>
                  </label>
                </div>
              </div>

              <div className="module-card">
                <div className="module-header">
                  <input
                    type="checkbox"
                    id="module-calendar"
                    checked={modules.calendar}
                    onChange={() => handleModuleToggle('calendar')}
                  />
                  <label htmlFor="module-calendar">
                    <h3>Agenda</h3>
                    <p>Gerenciar disponibilidade e agendamentos</p>
                  </label>
                </div>
              </div>

              <div className="module-card">
                <div className="module-header">
                  <input
                    type="checkbox"
                    id="module-financial"
                    checked={modules.financial}
                    onChange={() => handleModuleToggle('financial')}
                  />
                  <label htmlFor="module-financial">
                    <h3>Financeiro (Opcional)</h3>
                    <p>Gestão financeira e relatórios</p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Etapa 3: Papéis */}
        {currentStep === 3 && (
          <div className="wizard-step">
            <h2>Quais papéis você quer configurar?</h2>
            <p className="step-description">
              Defina os papéis iniciais da sua empresa. Você pode adicionar mais depois.
            </p>
            <div className="roles-list">
              <div className="role-card">
                <div className="role-header">
                  <input
                    type="checkbox"
                    id="role-owner"
                    checked={initialRoles.owner}
                    disabled
                  />
                  <label htmlFor="role-owner">
                    <h3>Owner (Proprietário)</h3>
                    <p>Acesso total à empresa</p>
                  </label>
                </div>
                <span className="role-badge">Você</span>
              </div>

              <div className="role-card">
                <div className="role-header">
                  <input
                    type="checkbox"
                    id="role-manager"
                    checked={initialRoles.manager}
                    onChange={() => handleRoleToggle('manager')}
                  />
                  <label htmlFor="role-manager">
                    <h3>Manager (Gerente)</h3>
                    <p>Gerenciar operações</p>
                  </label>
                </div>
              </div>

              <div className="role-card">
                <div className="role-header">
                  <input
                    type="checkbox"
                    id="role-staff"
                    checked={initialRoles.staff}
                    onChange={() => handleRoleToggle('staff')}
                  />
                  <label htmlFor="role-staff">
                    <h3>Staff (Equipe)</h3>
                    <p>Acesso operacional básico</p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Etapa 4: Agenda */}
        {currentStep === 4 && (
          <div className="wizard-step">
            <h2>Configure sua agenda inicial</h2>
            <p className="step-description">
              Defina os horários padrão e dias de funcionamento. Você pode ajustar depois.
            </p>
            <div className="calendar-config">
              <div className="config-group">
                <label>Horário de Início</label>
                <input
                  type="time"
                  value={calendarConfig.defaultStartTime}
                  onChange={(e) =>
                    setCalendarConfig((prev) => ({
                      ...prev,
                      defaultStartTime: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="config-group">
                <label>Horário de Fim</label>
                <input
                  type="time"
                  value={calendarConfig.defaultEndTime}
                  onChange={(e) =>
                    setCalendarConfig((prev) => ({
                      ...prev,
                      defaultEndTime: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="config-group">
                <label>Dias Ativos</label>
                <div className="days-selector">
                  {dayLabels.map((label, index) => (
                    <button
                      key={index}
                      className={`day-button ${calendarConfig.activeDays.includes(index) ? 'active' : ''}`}
                      onClick={() => handleDayToggle(index)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="config-group">
                <label>Fuso Horário</label>
                <select
                  value={calendarConfig.timezone}
                  onChange={(e) =>
                    setCalendarConfig((prev) => ({
                      ...prev,
                      timezone: e.target.value,
                    }))
                  }
                >
                  <option value="America/Sao_Paulo">Brasil (São Paulo)</option>
                  <option value="America/Manaus">Brasil (Manaus)</option>
                  <option value="America/Fortaleza">Brasil (Fortaleza)</option>
                  <option value="America/Recife">Brasil (Recife)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Etapa 5: Resumo */}
        {currentStep === 5 && (
          <div className="wizard-step">
            <h2>Resumo da Configuração</h2>
            <p className="step-description">
              Revise as configurações antes de finalizar.
            </p>
            <div className="summary-section">
              <div className="summary-item">
                <strong>Tipo da Empresa:</strong>
                <span>{companyTypes.find((t) => t.companyTypeId === selectedCompanyTypeId)?.name ?? '—'}</span>
              </div>

              <div className="summary-item">
                <strong>Atividade:</strong>
                <span>
                  {(() => {
                    const c = concepts.find((x) => x.conceptId === selectedConceptId);
                    return c ? `${c.slug} (${c.domain})` : '—';
                  })()}
                </span>
              </div>

              <div className="summary-item">
                <strong>Módulos Ativados:</strong>
                <div className="summary-tags">
                  {modules.services && <span className="tag">Serviços</span>}
                  {modules.events && <span className="tag">Eventos</span>}
                  {modules.calendar && <span className="tag">Agenda</span>}
                  {modules.financial && <span className="tag">Financeiro</span>}
                  {!modules.services && !modules.events && !modules.calendar && !modules.financial && (
                    <span className="tag-empty">Nenhum módulo selecionado</span>
                  )}
                </div>
              </div>

              <div className="summary-item">
                <strong>Papéis Configurados:</strong>
                <div className="summary-tags">
                  {initialRoles.owner && <span className="tag">Owner</span>}
                  {initialRoles.manager && <span className="tag">Manager</span>}
                  {initialRoles.staff && <span className="tag">Staff</span>}
                </div>
              </div>

              <div className="summary-item">
                <strong>Agenda:</strong>
                <span>
                  {calendarConfig.defaultStartTime} - {calendarConfig.defaultEndTime}
                  {' '}({calendarConfig.activeDays.length} dias por semana)
                </span>
              </div>
            </div>

            <div className="next-steps">
              <h3>Próximos Passos Sugeridos:</h3>
              <ul>
                {modules.services && <li>Cadastrar seus primeiros serviços</li>}
                {modules.events && <li>Criar seu primeiro evento</li>}
                {modules.calendar && <li>Configurar disponibilidade detalhada</li>}
                <li>Convidar membros da equipe</li>
                <li>Personalizar perfil da empresa</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="wizard-actions">
        {currentStep > 1 && (
          <button className="btn-secondary" onClick={handleBack} disabled={isSubmitting}>
            Voltar
          </button>
        )}
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </button>
        )}
        {currentStep < TOTAL_STEPS ? (
          <button className="btn-primary" onClick={handleNext} disabled={isSubmitting}>
            Próximo
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Finalizar Configuração'}
          </button>
        )}
      </div>
    </div>
  );
}


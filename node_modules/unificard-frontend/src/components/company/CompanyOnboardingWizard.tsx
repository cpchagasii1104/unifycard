// frontend/src/components/company/CompanyOnboardingWizard.tsx
// Wizard de onboarding e configuração de empresa

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { updateCompany } from '../../api/companies';
import { showToast } from '../common/Toast';
import type {
  CompanyBusinessType,
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
  const [businessType, setBusinessType] = useState<CompanyBusinessType | ''>('');
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

  const businessTypes: Array<{ value: CompanyBusinessType; label: string; description: string }> = [
    { value: 'bar', label: 'Bar', description: 'Bar ou pub' },
    { value: 'restaurant', label: 'Restaurante', description: 'Restaurante ou lanchonete' },
    { value: 'nightclub', label: 'Casa Noturna', description: 'Boate ou casa noturna' },
    { value: 'producer', label: 'Produtora', description: 'Produtora de eventos' },
    { value: 'venue', label: 'Espaço para Eventos', description: 'Espaço para aluguel' },
    { value: 'service_provider', label: 'Prestador de Serviços', description: 'Serviços diversos' },
    { value: 'retail', label: 'Comércio', description: 'Loja ou comércio' },
    { value: 'clinic', label: 'Clínica', description: 'Clínica ou consultório' },
    { value: 'other', label: 'Outro', description: 'Outro tipo de negócio' },
  ];

  const handleNext = () => {
    // Validações por etapa
    if (currentStep === 1 && !businessType) {
      showToast('Selecione o tipo de negócio', 'error');
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
    if (!businessType) {
      showToast('Selecione o tipo de negócio', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const config: CompanyOnboardingConfig = {
        businessType,
        modules,
        initialRoles,
        calendarConfig,
        completedAt: new Date().toISOString(),
        completedBy: activeActor?.user_id,
      };

      // Salvar no metadata da empresa
      await updateCompany(companyId, {
        metadata: {
          onboarding: config,
          onboardingCompleted: true,
        },
      });

      showToast('Configuração salva com sucesso!', 'success');
      
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
        {/* Etapa 1: Tipo de Empresa */}
        {currentStep === 1 && (
          <div className="wizard-step">
            <h2>Qual o tipo do seu negócio?</h2>
            <p className="step-description">
              Isso nos ajuda a configurar os módulos mais adequados para você.
            </p>
            <div className="business-type-grid">
              {businessTypes.map((type) => (
                <button
                  key={type.value}
                  className={`business-type-card ${businessType === type.value ? 'selected' : ''}`}
                  onClick={() => setBusinessType(type.value)}
                >
                  <h3>{type.label}</h3>
                  <p>{type.description}</p>
                </button>
              ))}
            </div>
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
                <strong>Tipo de Negócio:</strong>
                <span>{businessTypes.find((t) => t.value === businessType)?.label}</span>
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


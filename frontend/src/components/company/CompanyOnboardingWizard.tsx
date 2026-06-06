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
  type CompanyUserRole,
} from '../../api/companies';
import { showToast } from '../common/Toast';
import type {
  CompanyModules,
  CompanyInitialRoles,
  CompanyCalendarConfig,
  CompanyOnboardingConfig,
} from '../../types/company-onboarding';
import { deriveOnboardingTrackFromConceptDomain } from '../../utils/onboarding-track';
import './CompanyOnboardingWizard.css';

interface CompanyOnboardingWizardProps {
  companyId: string;
  companyName: string;
  /** F-PJ-ONBOARDING-ROLE-DEDUP: papel FORMAL do chamador, já definido no cadastro (company_users.role).
   *  O wizard CONFIRMA esse papel — não repergunta. Vem de company.userRole.role (getCompanyById). */
  initialRole?: CompanyUserRole;
  initialRoleDescription?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const TOTAL_STEPS = 5;

// F-PJ-ONBOARDING-ROLE-DEDUP: rótulo PT do vínculo formal (mesma fonte do cadastro). Apresentação apenas.
const COMPANY_ROLE_LABEL: Record<CompanyUserRole, string> = {
  owner: 'Proprietário',
  partner: 'Sócio',
  director: 'Diretor',
  manager: 'Gerente',
  employee: 'Funcionário',
  other: 'Outro',
};

export default function CompanyOnboardingWizard({
  companyId,
  companyName,
  initialRole,
  initialRoleDescription,
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

  // F-PJ-ONBOARDING-MODULES-DERIVED-FROM-CLASSIFICATION: o trilho/módulos são DERIVADOS do domínio do
  // concept classificado (projeção, não escolha). `modules` segue no payload só como compat de UX.
  const selectedConcept = concepts.find((c) => c.conceptId === selectedConceptId);
  const selectedTypeName = companyTypes.find((t) => t.companyTypeId === selectedCompanyTypeId)?.name;
  const onboardingTrack = deriveOnboardingTrackFromConceptDomain(selectedConcept?.domain);

  // Mantém `modules` (compat) refletindo o trilho derivado; financial nunca é operacional.
  useEffect(() => {
    const sel = concepts.find((c) => c.conceptId === selectedConceptId);
    setModules(deriveOnboardingTrackFromConceptDomain(sel?.domain).modules);
  }, [selectedConceptId, concepts]);

  // F-PJ-ONBOARDING-ROLE-DEDUP: o papel é CONFIRMADO do vínculo formal (company_users, definido no
  // cadastro), NÃO reperguntado. `formalRoleLabel` é só apresentação.
  // Defensivo: company_users.role pode carregar vocabulário do banco (owner/admin/staff/contractor/member)
  // diferente do contrato (owner/partner/...). Se não houver rótulo PT, mostra o valor cru (sem "undefined").
  const formalRoleLabel = initialRole
    ? (initialRole === 'other' && initialRoleDescription
        ? initialRoleDescription
        : (COMPANY_ROLE_LABEL[initialRole] ?? String(initialRole)))
    : null;

  // `initialRoles` (owner/manager/staff) permanece no payload APENAS como compat de UX não-operacional —
  // derivado do papel formal, nunca usado como autoridade (nenhum runtime lê metadata.onboarding.roles).
  useEffect(() => {
    setInitialRoles({
      owner: true, // o responsável pelo cadastro é o owner-equivalente da página da empresa
      manager: initialRole === 'manager',
      staff: initialRole === 'employee',
    });
  }, [initialRole]);

  const handleNext = () => {
    // Validações por etapa
    if (currentStep === 1 && (!selectedCompanyTypeId || !selectedConceptId)) {
      showToast('Selecione o tipo da empresa e a atividade', 'error');
      return;
    }

    // Etapa 2 agora é o RESUMO DERIVADO da classificação (não escolha de módulo). Só bloqueia se o
    // domínio não for derivável → volta para confirmar a atividade. NÃO exige módulo irrelevante.
    if (currentStep === 2 && !onboardingTrack.derivable) {
      showToast('Não foi possível derivar os módulos desta atividade. Confirme a atividade principal.', 'error');
      setCurrentStep(1);
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

        {/* Etapa 2: Trilho inicial DERIVADO da classificação (F-PJ-ONBOARDING-MODULES-DERIVED-FROM-CLASSIFICATION).
            Não é mais escolha de módulo genérico — o sistema projeta o trilho do domínio do concept. */}
        {currentStep === 2 && (
          <div className="wizard-step">
            <h2>Trilho inicial do seu negócio</h2>
            {onboardingTrack.derivable ? (
              <>
                <p className="step-description">
                  Derivado da classificação
                  {selectedConcept ? ` (${selectedConcept.displayName ?? selectedConcept.slug})` : ''}. Confira e siga.
                </p>
                <div className="onboarding-track-summary">
                  <h3>{selectedTypeName ? `Seu ${selectedTypeName} começará com:` : 'Seu negócio começará com:'}</h3>
                  <ul>
                    {onboardingTrack.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {onboardingTrack.note && (
                    <p className="step-description">{onboardingTrack.note}</p>
                  )}
                </div>
              </>
            ) : (
              <p className="step-description" role="alert">
                {onboardingTrack.note}
              </p>
            )}
          </div>
        )}

        {/* Etapa 3: Papel — CONFIRMA o vínculo formal definido no cadastro (não repergunta).
            F-PJ-ONBOARDING-ROLE-DEDUP: o papel é company_users.role (SSOT), projetado por
            company.userRole; o wizard apenas confirma. A gestão de membros/papéis da equipe é
            feita depois de finalizar (não é etapa de onboarding). */}
        {currentStep === 3 && (
          <div className="wizard-step">
            <h2>Seu papel nesta empresa</h2>
            <div className="role-confirmation">
              {formalRoleLabel ? (
                <p className="step-description">
                  Você está configurando esta empresa como <strong>{formalRoleLabel}</strong>.
                  Esse vínculo foi definido no cadastro e não precisa ser informado de novo.
                </p>
              ) : (
                <p className="step-description">
                  Você é o responsável por esta empresa (vínculo definido no cadastro).
                </p>
              )}
              <p className="step-description">
                Os papéis da equipe (gerentes, funcionários, sócios) são gerenciados depois de
                finalizar a configuração, na área de membros da empresa.
              </p>
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
                <strong>Seu papel:</strong>
                <div className="summary-tags">
                  <span className="tag">{formalRoleLabel ?? 'Responsável'}</span>
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


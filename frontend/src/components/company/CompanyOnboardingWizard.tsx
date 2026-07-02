// frontend/src/components/company/CompanyOnboardingWizard.tsx
// Wizard de onboarding e configuração de empresa

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import {
  updateCompany,
  getOperationalCompanyTypes,
  getAllowedConceptsForCompanyType,
  getCompanyEconomicActivitySuggestion,
  activateCompanyOperationally,
  submitCompanyKybDocument,
  submitCompanyKybRequest,
  type OperationalCompanyType,
  type AllowedOperationalConcept,
  type CompanyUserRole,
  type KybDocumentType,
} from '../../api/companies';
import { showToast } from '../common/Toast';
import type {
  CompanyModules,
  CompanyInitialRoles,
  CompanyCalendarConfig,
  CompanyOnboardingConfig,
} from '../../types/company-onboarding';
import { deriveOnboardingTrackFromConceptDomain } from '../../utils/onboarding-track';
import { getAvailableActors } from '../../api/social';
import { putWeeklyAvailabilityTemplate, type WeeklyAvailabilitySchedule } from '../../api/availability';
import './CompanyOnboardingWizard.css';

interface CompanyOnboardingWizardProps {
  companyId: string;
  companyName: string;
  /** F-PJ-ONBOARDING-ROLE-DEDUP: papel FORMAL do chamador, já definido no cadastro (company_users.role).
   *  O wizard CONFIRMA esse papel — não repergunta. Vem de company.userRole.role (getCompanyById). */
  initialRole?: CompanyUserRole;
  initialRoleDescription?: string;
  /** CP3: par soberano JÁ PERSISTIDO (projeção de companies.primary_*). Ao reabrir o wizard,
   *  a Etapa 1 mostra o par gravado em vez de estado vazio — a verdade é do backend. */
  initialCompanyTypeId?: string;
  initialConceptId?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const TOTAL_STEPS = 6;

// F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND: documentos mínimos do KYB (release gate exige ambos 'accepted').
// Apresentação/copy apenas — a verdade documental é do SSOT fiscal_identity_documents (backend).
const KYB_REQUIRED_DOCS: { type: KybDocumentType; label: string; hint: string }[] = [
  { type: 'cnpj_registration', label: 'Cartão CNPJ / Comprovante de inscrição', hint: 'Comprovante de inscrição e situação cadastral (Receita).' },
  { type: 'articles_of_association', label: 'Contrato social / Ato constitutivo', hint: 'Contrato social, requerimento de empresário ou ato constitutivo equivalente.' },
];

// F-PJ-ONBOARDING-ROLE-DEDUP / F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH: rótulo PT do vínculo
// formal. Vocabulário ALINHADO ao banco (chk_company_users_role_valid). Apresentação apenas.
const COMPANY_ROLE_LABEL: Record<CompanyUserRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  staff: 'Funcionário',
  contractor: 'Prestador',
  member: 'Membro',
};

export default function CompanyOnboardingWizard({
  companyId,
  companyName,
  initialRole,
  initialRoleDescription,
  initialCompanyTypeId,
  initialConceptId,
  onComplete,
  onCancel,
}: CompanyOnboardingWizardProps) {
  const navigate = useNavigate();
  const { activeActor, refreshActors } = useActiveActor();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND: estado VISUAL do envio documental (não é fonte de verdade —
  // o SSOT é fiscal_identity_documents no backend). 'sent' = enviado/aguardando análise, NUNCA "aprovado".
  const [kybUploading, setKybUploading] = useState<KybDocumentType | null>(null);
  const [kybSent, setKybSent] = useState<Record<string, boolean>>({});
  const [kybErrors, setKybErrors] = useState<Record<string, string>>({});
  // CP2 PJ-B1: estado VISUAL do pedido de análise (a verdade é fiscal_identity_kyb_requests no
  // backend). 'sent' = pedido aberto/aguardando reviewer humano — NUNCA "aprovado".
  const [kybRequestSending, setKybRequestSending] = useState(false);
  const [kybRequestSent, setKybRequestSent] = useState(false);
  const [kybRequestError, setKybRequestError] = useState<string | null>(null);
  
  // Estado do wizard
  // F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR: classificação operacional = par soberano
  // (companyTypeId, conceptId), vindo do catálogo governado do backend. SEM businessType.
  const [companyTypes, setCompanyTypes] = useState<OperationalCompanyType[]>([]);
  const [companyTypesLoading, setCompanyTypesLoading] = useState(true);
  const [companyTypesError, setCompanyTypesError] = useState<string | null>(null);
  // CP3: reabertura mostra o par PERSISTIDO (companies.primary_*); o concept inicial é aplicado
  // depois que a lista de concepts permitidos carrega (efeito abaixo), uma única vez.
  const [selectedCompanyTypeId, setSelectedCompanyTypeId] = useState<string>(initialCompanyTypeId ?? '');
  const pendingInitialConceptRef = useRef<string | null>(initialConceptId ?? null);

  const [concepts, setConcepts] = useState<AllowedOperationalConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsError, setConceptsError] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string>('');
  // F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION: sugestão derivada da ATIVIDADE FISCAL da empresa
  // (resolvida server-side por companyId; o frontend NUNCA manuseia CNAE cru). É SÓ sugestão — o usuário confirma.
  const [activitySuggestion, setActivitySuggestion] = useState<{
    suggestedConceptId: string;
    label: string | null;
    suggestedConceptSlug: string;
    companyTypeId: string | null;
  } | null>(null);

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
        if (cancelled) return;
        setConcepts(list);
        // CP3: aplica o concept persistido UMA vez (reabertura) — só se ainda for permitido.
        const pending = pendingInitialConceptRef.current;
        if (pending && list.some((c) => c.conceptId === pending)) {
          setSelectedConceptId(pending);
        }
        pendingInitialConceptRef.current = null;
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

  // F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION: carrega a sugestão (company-scoped, server-side) em
  // background ao montar. Falha/null NÃO bloqueia o onboarding — a seleção manual segue válida.
  useEffect(() => {
    let cancelled = false;
    getCompanyEconomicActivitySuggestion(companyId)
      .then((res) => {
        if (cancelled) return;
        const s = res?.suggestion ?? null;
        setActivitySuggestion(s ? {
          suggestedConceptId: s.suggestedConceptId,
          label: s.label,
          suggestedConceptSlug: s.suggestedConceptSlug,
          companyTypeId: s.companyTypeId,
        } : null);
      })
      .catch(() => { if (!cancelled) setActivitySuggestion(null); });
    return () => { cancelled = true; };
  }, [companyId]);

  // Aplicar a sugestão é AÇÃO EXPLÍCITA do usuário (clique) — nunca auto-apply. Reusa o mecanismo de
  // rehidratação (pendingInitialConceptRef) quando precisa trocar o company_type antes do concept.
  const applyActivitySuggestion = () => {
    if (!activitySuggestion) return;
    if (activitySuggestion.companyTypeId && selectedCompanyTypeId !== activitySuggestion.companyTypeId) {
      pendingInitialConceptRef.current = activitySuggestion.suggestedConceptId;
      setSelectedCompanyTypeId(activitySuggestion.companyTypeId);
    } else {
      setSelectedConceptId(activitySuggestion.suggestedConceptId);
    }
  };

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
  // F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH: vocabulário do contrato agora == banco
  // (owner/admin/staff/contractor/member). A nuance livre (ex.: "Sócio", "Diretor") vem de
  // roleDescription; quando presente em papel não-owner, ela é mais informativa que o rótulo coarse.
  // Fallback defensivo ao valor cru se algum dado legado trouxer role fora do mapa.
  const formalRoleLabel = initialRole
    ? (initialRoleDescription && initialRole !== 'owner'
        ? initialRoleDescription
        : (COMPANY_ROLE_LABEL[initialRole] ?? String(initialRole)))
    : null;

  // `initialRoles` (owner/manager/staff) permanece no payload APENAS como compat de UX não-operacional —
  // derivado do papel formal, nunca usado como autoridade (nenhum runtime lê metadata.onboarding.roles).
  useEffect(() => {
    setInitialRoles({
      owner: true, // o responsável pelo cadastro é o owner-equivalente da página da empresa
      manager: initialRole === 'admin',
      staff: initialRole === 'staff' || initialRole === 'contractor' || initialRole === 'member',
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

  // F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND: envia 1 documento pela rota canônica. Frontend só anexa o
  // arquivo; autoria/autoridade/validação/scan são do backend. Sucesso = "enviado/aguardando análise"
  // (NUNCA "aprovado"). Erro do backend aparece no campo.
  const handleKybDocUpload = async (documentType: KybDocumentType, file: File | undefined): Promise<void> => {
    if (!file) return;
    setKybErrors((prev) => ({ ...prev, [documentType]: '' }));
    setKybUploading(documentType);
    try {
      await submitCompanyKybDocument(companyId, documentType, file);
      setKybSent((prev) => ({ ...prev, [documentType]: true }));
    } catch (err) {
      setKybErrors((prev) => ({ ...prev, [documentType]: err instanceof Error ? err.message : 'Falha no envio do documento.' }));
    } finally {
      setKybUploading(null);
    }
  };

  // CP2 PJ-B1: "Enviar para análise" — abre o pedido de KYB no backend (writer único). O backend
  // prova autoridade + documentos mínimos + 1 pending por fiscal; o frontend só dispara e exibe
  // o estado material. 409 ALREADY_PENDING = já em análise (estado honesto, não erro fatal).
  const handleKybRequestSubmit = async (): Promise<void> => {
    setKybRequestError(null);
    setKybRequestSending(true);
    try {
      await submitCompanyKybRequest(companyId);
      setKybRequestSent(true);
      showToast('Empresa enviada para análise (KYB).', 'success');
    } catch (err: any) {
      if (err?.code === 'KYB_REQUEST_ALREADY_PENDING') {
        setKybRequestSent(true);
        setKybRequestError(null);
      } else {
        setKybRequestError(err instanceof Error ? err.message : 'Falha ao enviar para análise.');
      }
    } finally {
      setKybRequestSending(false);
    }
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

      // ── F-COMPANY-AGENDA-REAL-WIRING: materializa a grade semanal DE VERDADE no SSOT temporal
      // (unified_availability, ownerType='page'), não só no metadado decorativo acima. A empresa só
      // vira "operacional" (e o page-actor só aparece em findAvailableActors) NESTE PONTO — depois de
      // activateCompanyOperationally, um instante atrás. Por isso buscamos os actors FRESCOS aqui
      // (getAvailableActors direto, sem depender do estado React do switcher já ter propagado) em vez
      // de usar `activeActor` do hook (que ainda seria a Pessoa Física que fez o onboarding).
      // Não-bloqueante: se falhar, a empresa já foi criada/ativada — falha aqui não deve abortar o
      // onboarding (mesmo padrão de "erro não-bloqueante" usado no fetch de Receita/opportunity-prefs).
      try {
        const freshActors = await getAvailableActors();
        const pageActor = freshActors.find(
          (a) => a.actor_type === 'page' && a.company_id === companyId
        );
        if (pageActor) {
          const DAY_INDEX_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const range = `${calendarConfig.defaultStartTime}-${calendarConfig.defaultEndTime}`;
          const schedule: WeeklyAvailabilitySchedule = {};
          for (const dayIndex of calendarConfig.activeDays) {
            const key = DAY_INDEX_TO_KEY[dayIndex];
            if (key) schedule[key] = [range];
          }
          if (Object.keys(schedule).length > 0) {
            await putWeeklyAvailabilityTemplate({
              schedule,
              timezone: calendarConfig.timezone,
              ownerType: 'page',
              actorIdOverride: pageActor.actor_id,
            });
          }
        } else {
          console.warn('[CompanyOnboardingWizard] page-actor não encontrado após ativação — agenda real não materializada (metadado de UX preservado).');
        }
        // Actors frescos (a empresa agora aparece) ficam disponíveis para o switcher na próxima leitura.
        await refreshActors();
      } catch (agendaError) {
        console.error('[CompanyOnboardingWizard] Erro ao materializar agenda real da empresa (não-bloqueante):', agendaError);
      }

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
                {/* F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION: sugestão baseada na atividade fiscal.
                    É APENAS sugestão — exige confirmação explícita (clicar) e nunca autoaplica/autoativa. */}
                {activitySuggestion && selectedConceptId !== activitySuggestion.suggestedConceptId && (
                  <div className="activity-suggestion-banner" role="note">
                    <span>
                      Encontramos uma sugestão com base na atividade fiscal da empresa:{' '}
                      <strong>{activitySuggestion.label ?? activitySuggestion.suggestedConceptSlug}</strong>. Confirme se faz sentido ou escolha outra opção.
                    </span>
                    <button type="button" className="activity-suggestion-apply" onClick={applyActivitySuggestion}>
                      Usar sugestão
                    </button>
                  </div>
                )}
                {!conceptsLoading && !conceptsError && concepts.length > 0 && (
                  <div className="business-type-grid">
                    {concepts.map((c) => {
                      const isSuggested = activitySuggestion?.suggestedConceptId === c.conceptId;
                      return (
                        <button
                          key={c.conceptId}
                          className={`business-type-card ${selectedConceptId === c.conceptId ? 'selected' : ''}${isSuggested ? ' suggested' : ''}`}
                          onClick={() => setSelectedConceptId(c.conceptId)}
                        >
                          {/* DECISION-0107: nome legível (concept_labels) com fallback técnico ao slug.
                              Identidade/ativação seguem por c.conceptId — displayName é só apresentação. */}
                          <h3>{c.displayName ?? c.slug}</h3>
                          <p>{c.domain}</p>
                          {isSuggested && <span className="suggestion-badge">Sugerida pela atividade fiscal</span>}
                        </button>
                      );
                    })}
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

        {/* Etapa 5: Documentos de verificação (KYB) — envio canônico; NÃO aprova KYB */}
        {currentStep === 5 && (
          <div className="wizard-step">
            <h2>Documentos de verificação (KYB)</h2>
            <p className="step-description">
              Envie os documentos da empresa para análise. <strong>O envio não aprova a empresa
              automaticamente</strong> — os documentos serão analisados por um operador, e a empresa só
              será verificada após a análise.
            </p>
            <div className="kyb-docs-list">
              {KYB_REQUIRED_DOCS.map((doc) => (
                <div key={doc.type} className="kyb-doc-slot">
                  <div className="kyb-doc-info">
                    <strong>{doc.label}</strong>
                    <p className="step-description">{doc.hint}</p>
                  </div>
                  {kybSent[doc.type] ? (
                    <span className="kyb-doc-status kyb-doc-sent">✅ Enviado — aguardando análise</span>
                  ) : (
                    <label className="kyb-doc-upload">
                      {kybUploading === doc.type ? '⏳ Enviando…' : '📎 Anexar arquivo'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        style={{ display: 'none' }}
                        disabled={kybUploading !== null}
                        onChange={(e) => handleKybDocUpload(doc.type, e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {kybErrors[doc.type] && <span className="field-error">{kybErrors[doc.type]}</span>}
                </div>
              ))}
            </div>
            {/* CP2 PJ-B1: ação explícita "Enviar para análise" — só habilita com ambos os documentos
                enviados (o backend revalida; o gate material é dele). Após enviar: estado honesto. */}
            <div className="kyb-request-submit" style={{ marginTop: '1rem' }}>
              {kybRequestSent ? (
                <span className="kyb-doc-status kyb-doc-sent">📨 Em análise — aguardando o reviewer</span>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleKybRequestSubmit}
                  disabled={kybRequestSending || !KYB_REQUIRED_DOCS.every((d) => kybSent[d.type])}
                >
                  {kybRequestSending ? '⏳ Enviando…' : 'Enviar para análise'}
                </button>
              )}
              {kybRequestError && <span className="field-error" role="alert">{kybRequestError}</span>}
              {!kybRequestSent && !KYB_REQUIRED_DOCS.every((d) => kybSent[d.type]) && (
                <p className="step-description" style={{ marginTop: '0.5rem' }}>
                  Anexe os dois documentos para poder enviar a empresa para análise.
                </p>
              )}
            </div>
            <p className="step-description" style={{ marginTop: '0.75rem' }}>
              Sem os documentos, a verificação (KYB) da empresa fica <strong>pendente</strong>. Você pode
              continuar e enviar depois.
            </p>
          </div>
        )}

        {/* Etapa 6: Resumo */}
        {currentStep === 6 && (
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

              <div className="summary-item">
                <strong>Documentos (KYB):</strong>
                <div className="summary-tags">
                  {KYB_REQUIRED_DOCS.map((doc) => (
                    <span key={doc.type} className={`tag ${kybSent[doc.type] ? '' : 'tag-empty'}`}>
                      {doc.label}: {kybSent[doc.type] ? 'enviado (aguardando análise)' : 'pendente'}
                    </span>
                  ))}
                  <span className={`tag ${kybRequestSent ? '' : 'tag-empty'}`}>
                    Pedido de análise: {kybRequestSent ? 'em análise (aguardando reviewer)' : 'não enviado'}
                  </span>
                </div>
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


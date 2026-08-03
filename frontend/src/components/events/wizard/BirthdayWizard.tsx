// frontend/src/components/events/wizard/BirthdayWizard.tsx
// FASE 5 — FORM FLOW · FESTA DE ANIVERSÁRIO
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - Apenas coleta intenções declaradas
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/birthday/01_birthday_form_flow.md
// Este componente implementa EXATAMENTE as 9 etapas documentadas.

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../../contexts/ActiveActorContext';
import { useSession } from '../../../contexts/SessionProvider';
import { createEventSpec } from '../../../api/event-spec';
import { getTenantId } from '../../../config/auth';
import { showToast } from '../../common/Toast';
// WizardData era `Record<string, any>` exportado por EventCreationWizard (wizard MORTO, removido
// em 2026-08-03 — ver REMEDIATION_DT_LOG.md). O tipo não carregava informação nenhuma; fica local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WizardData = Record<string, any>;
import type { EventSpec } from '../../../types/event-spec';
import './BirthdayWizard.css';

// 🔴 ESTRUTURA DE DADOS CONFORME 02_birthday_eventspec_v1.md
interface BirthdayWizardData {
  // ETAPA 0: IDENTIFICAÇÃO HUMANA
  project_name: string; // OBRIGATÓRIO

  // ETAPA 1: PERFIL DO ANIVERSÁRIO
  birthday_profile?: "INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO";
  is_birthday_person_you?: boolean; // Q2: O aniversariante é você? (contextual, não persiste)
  birthday_person?: {
    name?: string;
    birth_date?: string; // ISO-8601
    gender?: "MASCULINO" | "FEMININO" | "NAO_INFORMADO";
  };

  // ETAPA 2: QUANTIDADE REAL DE PESSOAS
  attendance?: {
    total?: number;
    adults?: number;
    children?: number;
    elderly?: number;
  };

  // ETAPA 3: LOCAL DO EVENTO
  location?: {
    has_venue?: boolean; // Q6: Você já tem o local?
    address?: {
      cep?: string;
      number?: string;
      complement?: string;
    };
    region?: {
      city?: string;
      area?: string;
    };
    desired_venue_types?: ("SALAO" | "CHACARA" | "CLUBE" | "ESPACO_INFANTIL" | "CASA_EVENTOS" | "INDIFERENTE" | "NAO_SEI")[];
    provided_items?: ("MESAS" | "CADEIRAS" | "COZINHA" | "SOM" | "ILUMINACAO" | "ESPACO_INFANTIL" | "AREA_EXTERNA" | "ACESSIBILIDADE")[];
  };

  // ETAPA 4: ESTILO E TEMA
  style?: {
    general?: "SIMPLES" | "ANIMADA" | "SOFISTICADA" | "TEMATICA" | "INDEFINIDA";
    theme?: string; // Apenas se general = TEMATICA
  };

  // ETAPA 5: ATIVIDADES (vocabulário fechado por perfil)
  activities?: {
    entertainment?: ("BRINQUEDOS" | "PISCINA_DE_BOLINHAS" | "RECREADOR" | "PERSONAGENS" | "APENAS_BOLO_COMIDA" | "DJ" | "BANDA" | "COREOGRAFIA" | "ROUPA_ESPECIAL" | "DECORACAO_TEMATICA" | "ALGO_SIMPLES" | "COMIDA_COMO_FOCO" | "BEBIDAS" | "MUSICA_AMBIENTE" | "MUSICA_AO_VIVO" | "CONFRATERNIZACAO_SIMPLES" | "EVENTO_TRANQUILO" | "ACESSIBILIDADE" | "ALIMENTACAO_LEVE" | "NAO_SEI")[];
    food_focus?: boolean;
    special_outfit?: {
      required?: boolean;
      mode?: "COMPRA" | "ALUGUEL" | "NAO_SEI";
    };
  };

  // ETAPA 6: MÚSICA E AUDIOVISUAL
  music?: {
    present?: boolean;
    types?: ("DJ" | "BANDA" | "PLAYLIST")[];
    styles?: ("POP" | "ROCK" | "SERTANEJO" | "REGGAE" | "ELETRONICA" | "VARIADO")[];
    formation_size?: "PEQUENO" | "MEDIO" | "GRANDE" | "INDEFINIDO";
    equipment_needs?: ("SOM" | "LUZ" | "PALCO" | "TELAO")[];
    equipment_source_hypothesis?: "LOCAL" | "ARTISTA" | "ALUGUEL" | "COMBINADO" | "INDEFINIDO";
    volume?: "BAIXO" | "MEDIO" | "ALTO" | "INDEFINIDO";
  };
  audiovisual?: {
    photography?: boolean;
    filming?: boolean;
  };

  // ETAPA 7: SERVIÇOS DE APOIO
  support_services?: ("LIMPEZA" | "GARCONS" | "SEGURANCA" | "DECORACAO")[];

  // ETAPA 8: DATA E HORÁRIO
  time_window?: {
    date?: string;
    range?: string;
    start_time?: string;
    end_time?: string;
    flexible?: boolean;
  };
}

interface BirthdayWizardProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (eventSpec?: EventSpec) => void;
}

export default function BirthdayWizard({ data, onUpdate, onComplete }: BirthdayWizardProps) {
  const { activeActor } = useActiveActor();
  const { sessionReady } = useSession();

  // Inicializar dados conforme estrutura do EventSpec
  const [wizardData, setWizardData] = useState<BirthdayWizardData>(() => {
    const existing = data.birthday_wizard || {};
    return {
      project_name: existing.project_name || data.title || '',
      birthday_profile: existing.birthday_profile,
      is_birthday_person_you: existing.is_birthday_person_you,
      birthday_person: existing.birthday_person,
      attendance: existing.attendance,
      location: existing.location,
      style: existing.style,
      activities: existing.activities,
      music: existing.music,
      audiovisual: existing.audiovisual,
      support_services: existing.support_services,
      time_window: existing.time_window,
    };
  });

  const [currentStep, setCurrentStep] = useState(0); // ETAPA 0 a 9
  const [isSaving, setIsSaving] = useState(false);

  // Persistir dados no WizardData
  useEffect(() => {
    onUpdate({ birthday_wizard: wizardData });
  }, [wizardData, onUpdate]);

  const updateWizardData = (updates: Partial<BirthdayWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  // 🔴 VALIDAÇÃO POR ETAPA CONFORME 01_birthday_form_flow.md
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: // ETAPA 0: Nome do evento (OBRIGATÓRIO)
        return wizardData.project_name.trim().length > 0;
      case 1: // ETAPA 1: Perfil do aniversário
        return wizardData.birthday_profile !== undefined;
      case 2: // ETAPA 2: Quantidade (pode ser "Ainda não sei")
        return true; // Sempre pode avançar
      case 3: // ETAPA 3: Local
        return wizardData.location?.has_venue !== undefined;
      case 4: // ETAPA 4: Estilo e tema
        return wizardData.style?.general !== undefined;
      case 5: // ETAPA 5: Atividades
        return true; // Opcional
      case 6: // ETAPA 6: Música e audiovisual
        return true; // Opcional
      case 7: // ETAPA 7: Serviços de apoio
        return true; // Opcional
      case 8: // ETAPA 8: Data e horário
        return true; // Sempre janela desejada
      case 9: // ETAPA 9: Finalização
        return false; // Não avança além
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 🔴 SALVAR PLANEJAMENTO CONFORME 01_birthday_form_flow.md (ETAPA 9)
  const handleSavePlanning = async () => {
    if (!sessionReady || !activeActor) {
      showToast('Sessão não está pronta. Aguarde um momento.', 'error');
      return;
    }

    const tenantId = getTenantId();
    if (!tenantId) {
      showToast('Tenant ID não encontrado. Faça login novamente.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      // 🔴 MAPEAMENTO CONFORME 03_birthday_data_mapping.md
      const answers: any = {
        project_name: wizardData.project_name,
        // event_ticket será gerado automaticamente pelo backend
        birthday_profile: wizardData.birthday_profile,
        birthday_person: wizardData.birthday_person,
        attendance: wizardData.attendance,
        location: wizardData.location,
        style: wizardData.style,
        activities: wizardData.activities,
        music: wizardData.music,
        audiovisual: wizardData.audiovisual,
        support_services: wizardData.support_services,
        time_window: wizardData.time_window,
      };

      // 🔴 P0-2: event_id é OBRIGATÓRIO
      const eventId = (data as any).event_id;
      if (!eventId) {
        showToast('Erro: Evento não encontrado. Por favor, recarregue a página.', 'error');
        return;
      }

      // 🔴 responsible_actor_id e responsible_actor_type vêm do contexto autenticado
      // 🔴 P0-2: event_id é obrigatório - EventSpec DEVE referenciar Event existente
      const eventSpec = await createEventSpec({
        tenant_id: tenantId,
        actor_id: activeActor.actor_id,
        actor_type: activeActor.actor_type as 'user' | 'page' | 'group' | 'channel',
        macro_intention: 'celebrate',
        subflow: 'birthday_party',
        answers: answers,
        event_id: eventId, // 🔴 P0-2: OBRIGATÓRIO
        metadata: {
          lifecycle_stage: 'INTENT_DRAFT',
          execution_state: 'NON_EXECUTABLE',
        },
      });

      showToast('Planejamento da festa salvo com sucesso!', 'success');
      onComplete(eventSpec);
    } catch (error: any) {
      console.error('Erro ao salvar planejamento:', error);
      showToast(error.message || 'Erro ao salvar planejamento da festa', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 🔴 ETAPA 0: IDENTIFICAÇÃO HUMANA DO EVENTO
  const renderStep0 = () => (
    <div className="birthday-wizard-step">
      <h3>Nome do Evento</h3>
      <p className="step-description">
        Como você quer chamar este evento? (Ex: Festa de Aniversário do João)
      </p>
      <div className="form-group">
        <label htmlFor="project_name" className="form-label">
          Nome do evento / projeto <span className="required">*</span>
        </label>
        <input
          id="project_name"
          type="text"
          value={wizardData.project_name}
          onChange={(e) => updateWizardData({ project_name: e.target.value })}
          placeholder="Ex: Festa de Aniversário do João"
          className="form-input"
          required
        />
        <p className="field-hint">
          Este nome serve apenas para identificação humana. Pode ser editado no futuro.
        </p>
      </div>
    </div>
  );

  // 🔴 ETAPA 1: PERFIL DO ANIVERSÁRIO
  const renderStep1 = () => (
    <div className="birthday-wizard-step">
      <h3>Perfil do Aniversário</h3>
      <p className="step-description">
        Qual a faixa etária do aniversário? Esta informação controla quais perguntas aparecem depois.
      </p>

      <div className="form-group">
        <label className="form-label">
          Faixa etária do aniversário <span className="required">*</span>
        </label>
        <div className="option-grid">
          <button
            type="button"
            className={`option-card ${wizardData.birthday_profile === 'INFANTIL' ? 'selected' : ''}`}
            onClick={() => updateWizardData({ birthday_profile: 'INFANTIL' })}
          >
            <div className="option-label">Infantil</div>
            <div className="option-description">0–12 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_profile === 'JOVEM' ? 'selected' : ''}`}
            onClick={() => updateWizardData({ birthday_profile: 'JOVEM' })}
          >
            <div className="option-label">Jovem / 15 Anos</div>
            <div className="option-description">15 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_profile === 'ADULTO' ? 'selected' : ''}`}
            onClick={() => updateWizardData({ birthday_profile: 'ADULTO' })}
          >
            <div className="option-label">Adulto</div>
            <div className="option-description">18–59 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_profile === 'TERCEIRA_IDADE' ? 'selected' : ''}`}
            onClick={() => updateWizardData({ birthday_profile: 'TERCEIRA_IDADE' })}
          >
            <div className="option-label">Terceira Idade</div>
            <div className="option-description">60+ anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_profile === 'NEUTRO' ? 'selected' : ''}`}
            onClick={() => updateWizardData({ birthday_profile: 'NEUTRO' })}
          >
            <div className="option-label">Neutro</div>
            <div className="option-description">Prefiro não definir agora</div>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          O aniversariante é você? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${wizardData.is_birthday_person_you === true ? 'selected' : ''}`}
            onClick={() => updateWizardData({ is_birthday_person_you: true })}
          >
            Sim
          </button>
          <button
            type="button"
            className={`yes-no-button ${wizardData.is_birthday_person_you === false ? 'selected' : ''}`}
            onClick={() => updateWizardData({ is_birthday_person_you: false })}
          >
            Não
          </button>
        </div>
        <p className="field-hint">
          Esta informação é contextual de UX e não é persistida no EventSpec.
        </p>
      </div>

      {/* Q3: Dados do aniversariante (OPCIONAIS) */}
      <div className="form-group">
        <label htmlFor="birthday_person_name" className="form-label">
          Nome do aniversariante <span className="optional">(opcional)</span>
        </label>
        <input
          id="birthday_person_name"
          type="text"
          value={wizardData.birthday_person?.name || ''}
          onChange={(e) => updateWizardData({
            birthday_person: {
              ...wizardData.birthday_person,
              name: e.target.value || undefined,
            }
          })}
          placeholder="Ex: João"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="birth_date" className="form-label">
          Data de nascimento <span className="optional">(opcional)</span>
        </label>
        <input
          id="birth_date"
          type="date"
          value={wizardData.birthday_person?.birth_date || ''}
          onChange={(e) => updateWizardData({
            birthday_person: {
              ...wizardData.birthday_person,
              birth_date: e.target.value || undefined,
            }
          })}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Sexo / gênero <span className="optional">(opcional)</span>
        </label>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_person?.gender === 'MASCULINO' ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              birthday_person: {
                ...wizardData.birthday_person,
                gender: 'MASCULINO',
              }
            })}
          >
            <div className="option-label">Masculino</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_person?.gender === 'FEMININO' ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              birthday_person: {
                ...wizardData.birthday_person,
                gender: 'FEMININO',
              }
            })}
          >
            <div className="option-label">Feminino</div>
          </button>
          <button
            type="button"
            className={`option-card ${wizardData.birthday_person?.gender === 'NAO_INFORMADO' ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              birthday_person: {
                ...wizardData.birthday_person,
                gender: 'NAO_INFORMADO',
              }
            })}
          >
            <div className="option-label">Prefiro não informar</div>
          </button>
        </div>
      </div>
    </div>
  );

  // 🔴 ETAPA 2: QUANTIDADE REAL DE PESSOAS
  const renderStep2 = () => (
    <div className="birthday-wizard-step">
      <h3>Quantidade de Convidados</h3>
      <p className="step-description">
        Quantas pessoas você espera? Tudo aqui é estimativa declarada, não é verdade absoluta do sistema.
      </p>

      <div className="form-group">
        <label htmlFor="attendance_total" className="form-label">
          Quantidade total de convidados <span className="optional">(opcional)</span>
        </label>
        <input
          id="attendance_total"
          type="number"
          min="1"
          value={wizardData.attendance?.total || ''}
          onChange={(e) => updateWizardData({
            attendance: {
              ...wizardData.attendance,
              total: e.target.value ? parseInt(e.target.value, 10) : undefined,
            }
          })}
          placeholder="Ex: 50"
          className="form-input"
        />
        <button
          type="button"
          className="link-button"
          onClick={() => updateWizardData({
            attendance: {
              ...wizardData.attendance,
              total: undefined,
            }
          })}
        >
          Ainda não sei
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">
          Composição dos convidados <span className="optional">(opcional - se souber)</span>
        </label>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="attendance_adults" className="form-label-small">
              Quantos adultos?
            </label>
            <input
              id="attendance_adults"
              type="number"
              min="0"
              value={wizardData.attendance?.adults || ''}
              onChange={(e) => updateWizardData({
                attendance: {
                  ...wizardData.attendance,
                  adults: e.target.value ? parseInt(e.target.value, 10) : undefined,
                }
              })}
              placeholder="Ex: 30"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="attendance_children" className="form-label-small">
              Quantas crianças?
            </label>
            <input
              id="attendance_children"
              type="number"
              min="0"
              value={wizardData.attendance?.children || ''}
              onChange={(e) => updateWizardData({
                attendance: {
                  ...wizardData.attendance,
                  children: e.target.value ? parseInt(e.target.value, 10) : undefined,
                }
              })}
              placeholder="Ex: 20"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="attendance_elderly" className="form-label-small">
              Quantos idosos?
            </label>
            <input
              id="attendance_elderly"
              type="number"
              min="0"
              value={wizardData.attendance?.elderly || ''}
              onChange={(e) => updateWizardData({
                attendance: {
                  ...wizardData.attendance,
                  elderly: e.target.value ? parseInt(e.target.value, 10) : undefined,
                }
              })}
              placeholder="Ex: 5"
              className="form-input"
            />
          </div>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => updateWizardData({
            attendance: {
              ...wizardData.attendance,
              adults: undefined,
              children: undefined,
              elderly: undefined,
            }
          })}
        >
          Não sei informar agora
        </button>
      </div>
    </div>
  );

  // 🔴 ETAPA 3: LOCAL DO EVENTO (EIXO ESTRUTURAL)
  const renderStep3 = () => {
    const hasVenue = wizardData.location?.has_venue === true;
    const hasNoVenue = wizardData.location?.has_venue === false;
    const hasNotDecided = wizardData.location?.has_venue === undefined;

    return (
      <div className="birthday-wizard-step">
        <h3>Local do Evento</h3>
        <p className="step-description">
          Informações sobre o local da festa. "Possui" não significa "é suficiente".
        </p>

        <div className="form-group">
          <label className="form-label">
            Você já tem o local da festa? <span className="required">*</span>
          </label>
          <div className="yes-no-buttons">
            <button
              type="button"
              className={`yes-no-button ${hasVenue ? 'selected' : ''}`}
              onClick={() => updateWizardData({
                location: {
                  ...wizardData.location,
                  has_venue: true,
                }
              })}
            >
              Sim
            </button>
            <button
              type="button"
              className={`yes-no-button ${hasNoVenue ? 'selected' : ''}`}
              onClick={() => updateWizardData({
                location: {
                  ...wizardData.location,
                  has_venue: false,
                }
              })}
            >
              Não
            </button>
            <button
              type="button"
              className={`yes-no-button ${hasNotDecided ? 'selected' : ''}`}
              onClick={() => updateWizardData({
                location: {
                  ...wizardData.location,
                  has_venue: undefined,
                }
              })}
            >
              Ainda não sei
            </button>
          </div>
        </div>

        {/* SE Q6 = SIM */}
        {hasVenue && (
          <>
            <div className="form-group">
              <label htmlFor="address_cep" className="form-label">
                CEP <span className="optional">(opcional)</span>
              </label>
              <input
                id="address_cep"
                type="text"
                value={wizardData.location?.address?.cep || ''}
                onChange={(e) => updateWizardData({
                  location: {
                    ...wizardData.location,
                    address: {
                      ...wizardData.location?.address,
                      cep: e.target.value || undefined,
                    }
                  }
                })}
                placeholder="00000-000"
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="address_number" className="form-label">
                  Número <span className="optional">(opcional)</span>
                </label>
                <input
                  id="address_number"
                  type="text"
                  value={wizardData.location?.address?.number || ''}
                  onChange={(e) => updateWizardData({
                    location: {
                      ...wizardData.location,
                      address: {
                        ...wizardData.location?.address,
                        number: e.target.value || undefined,
                      }
                    }
                  })}
                  placeholder="123"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="address_complement" className="form-label">
                  Complemento <span className="optional">(opcional)</span>
                </label>
                <input
                  id="address_complement"
                  type="text"
                  value={wizardData.location?.address?.complement || ''}
                  onChange={(e) => updateWizardData({
                    location: {
                      ...wizardData.location,
                      address: {
                        ...wizardData.location?.address,
                        complement: e.target.value || undefined,
                      }
                    }
                  })}
                  placeholder="Apto 101"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                O local possui (marque o que EXISTE) <span className="optional">(opcional)</span>
              </label>
              <p className="field-hint">
                ⚠️ "Possui" ≠ "é suficiente". Nenhuma marcação elimina contratação futura.
              </p>
              <div className="checkbox-grid">
                {(['MESAS', 'CADEIRAS', 'COZINHA', 'SOM', 'ILUMINACAO', 'ESPACO_INFANTIL', 'AREA_EXTERNA', 'ACESSIBILIDADE'] as const).map(item => (
                  <label key={item} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={wizardData.location?.provided_items?.includes(item) || false}
                      onChange={(e) => {
                        const current = wizardData.location?.provided_items || [];
                        const updated = e.target.checked
                          ? [...current, item]
                          : current.filter(i => i !== item);
                        updateWizardData({
                          location: {
                            ...wizardData.location,
                            provided_items: updated.length > 0 ? updated : undefined,
                          }
                        });
                      }}
                    />
                    <span>{item.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SE Q6 = NÃO ou AINDA NÃO SEI */}
        {(hasNoVenue || hasNotDecided) && (
          <>
            <div className="form-group">
              <label htmlFor="region_city" className="form-label">
                Cidade desejada <span className="optional">(opcional)</span>
              </label>
              <input
                id="region_city"
                type="text"
                value={wizardData.location?.region?.city || ''}
                onChange={(e) => updateWizardData({
                  location: {
                    ...wizardData.location,
                    region: {
                      ...wizardData.location?.region,
                      city: e.target.value || undefined,
                    }
                  }
                })}
                placeholder="Ex: Curitiba"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="region_area" className="form-label">
                Bairro / região <span className="optional">(opcional)</span>
              </label>
              <input
                id="region_area"
                type="text"
                value={wizardData.location?.region?.area || ''}
                onChange={(e) => updateWizardData({
                  location: {
                    ...wizardData.location,
                    region: {
                      ...wizardData.location?.region,
                      area: e.target.value || undefined,
                    }
                  }
                })}
                placeholder="Ex: Zona Norte"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Tipo de espaço desejado <span className="optional">(opcional)</span>
              </label>
              <div className="checkbox-grid">
                {(['SALAO', 'CHACARA', 'CLUBE', 'ESPACO_INFANTIL', 'CASA_EVENTOS', 'INDIFERENTE', 'NAO_SEI'] as const).map(venueType => (
                  <label key={venueType} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={wizardData.location?.desired_venue_types?.includes(venueType) || false}
                      onChange={(e) => {
                        const current = wizardData.location?.desired_venue_types || [];
                        const updated = e.target.checked
                          ? [...current, venueType]
                          : current.filter(v => v !== venueType);
                        updateWizardData({
                          location: {
                            ...wizardData.location,
                            desired_venue_types: updated.length > 0 ? updated : undefined,
                          }
                        });
                      }}
                    />
                    <span>{venueType.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // 🔴 ETAPA 4: ESTILO E TEMA
  const renderStep4 = () => {
    const isThematic = wizardData.style?.general === 'TEMATICA';

    return (
      <div className="birthday-wizard-step">
        <h3>Estilo e Tema</h3>
        <p className="step-description">
          Como você imagina essa festa? Tema NUNCA cria serviço, apenas classifica contexto.
        </p>

        <div className="form-group">
          <label className="form-label">
            Como você imagina essa festa? <span className="required">*</span>
          </label>
          <div className="option-grid">
            {(['SIMPLES', 'ANIMADA', 'SOFISTICADA', 'TEMATICA', 'INDEFINIDA'] as const).map(style => (
              <button
                key={style}
                type="button"
                className={`option-card ${wizardData.style?.general === style ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  style: {
                    ...wizardData.style,
                    general: style,
                    // Limpar tema se não for temática
                    theme: style === 'TEMATICA' ? wizardData.style?.theme : undefined,
                  }
                })}
              >
                <div className="option-label">{style.replace('_', ' ')}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Q8: Tema da festa (CONDICIONAL - apenas se Q7 = Temática) */}
        {isThematic && (
          <div className="form-group">
            <label htmlFor="theme" className="form-label">
              Tema da festa <span className="optional">(opcional)</span>
            </label>
            <input
              id="theme"
              type="text"
              value={wizardData.style?.theme || ''}
              onChange={(e) => updateWizardData({
                style: {
                  ...wizardData.style,
                  theme: e.target.value || undefined,
                }
              })}
              placeholder="Ex: Super-heróis, Princesas, Vintage, etc."
              className="form-input"
            />
            <p className="field-hint">
              ⚠️ Tema NUNCA cria serviço. Tema apenas classifica contexto.
            </p>
            <button
              type="button"
              className="link-button"
              onClick={() => updateWizardData({
                style: {
                  ...wizardData.style,
                  theme: undefined,
                }
              })}
            >
              Ainda não sei
            </button>
          </div>
        )}
      </div>
    );
  };

  // 🔴 ETAPA 5: ATIVIDADES (VOCABULÁRIO FECHADO POR PERFIL)
  const renderStep5 = () => {
    const profile = wizardData.birthday_profile;

    // Vocabulário fechado por perfil conforme 01_birthday_form_flow.md
    const getActivitiesByProfile = () => {
      if (profile === 'INFANTIL') {
        return ['BRINQUEDOS', 'PISCINA_DE_BOLINHAS', 'RECREADOR', 'PERSONAGENS', 'APENAS_BOLO_COMIDA', 'NAO_SEI'] as const;
      } else if (profile === 'JOVEM') {
        return ['DJ', 'BANDA', 'COREOGRAFIA', 'ROUPA_ESPECIAL', 'DECORACAO_TEMATICA', 'ALGO_SIMPLES', 'NAO_SEI'] as const;
      } else if (profile === 'ADULTO') {
        // COMIDA_COMO_FOCO vai para food_focus, não para entertainment[]
        return ['BEBIDAS', 'MUSICA_AMBIENTE', 'MUSICA_AO_VIVO', 'CONFRATERNIZACAO_SIMPLES', 'NAO_SEI'] as const;
      } else if (profile === 'TERCEIRA_IDADE') {
        // ALIMENTACAO_LEVE vai para food_focus, não para entertainment[]
        return ['MUSICA_AMBIENTE', 'EVENTO_TRANQUILO', 'ACESSIBILIDADE', 'NAO_SEI'] as const;
      }
      // NEUTRO ou não definido: mostrar todas as opções (exceto COMIDA_COMO_FOCO e ALIMENTACAO_LEVE que são food_focus)
      return ['BRINQUEDOS', 'PISCINA_DE_BOLINHAS', 'RECREADOR', 'PERSONAGENS', 'DJ', 'BANDA', 'COREOGRAFIA', 'ROUPA_ESPECIAL', 'DECORACAO_TEMATICA', 'BEBIDAS', 'MUSICA_AMBIENTE', 'MUSICA_AO_VIVO', 'CONFRATERNIZACAO_SIMPLES', 'EVENTO_TRANQUILO', 'ACESSIBILIDADE', 'NAO_SEI'] as const;
    };

    const activities = getActivitiesByProfile();
    const hasSpecialOutfit = wizardData.activities?.entertainment?.includes('ROUPA_ESPECIAL');
    const isAdult = profile === 'ADULTO';
    const isElderly = profile === 'TERCEIRA_IDADE';

    return (
      <div className="birthday-wizard-step">
        <h3>Atividades</h3>
        <p className="step-description">
          Quais atividades você deseja ter na festa? Lista de intenções, não implica contratação.
        </p>

        {/* COMIDA_COMO_FOCO (apenas para ADULTO) - mapeado para food_focus */}
        {isAdult && (
          <div className="form-group">
            <label className="form-label">
              Comida como foco <span className="optional">(opcional)</span>
            </label>
            <div className="yes-no-buttons">
              <button
                type="button"
                className={`yes-no-button ${wizardData.activities?.food_focus === true ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    food_focus: true,
                  }
                })}
              >
                Sim
              </button>
              <button
                type="button"
                className={`yes-no-button ${wizardData.activities?.food_focus === false ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    food_focus: false,
                  }
                })}
              >
                Não
              </button>
            </div>
          </div>
        )}

        {/* ALIMENTACAO_LEVE (apenas para TERCEIRA_IDADE) - mapeado para food_focus */}
        {isElderly && (
          <div className="form-group">
            <label className="form-label">
              Alimentação leve <span className="optional">(opcional)</span>
            </label>
            <div className="yes-no-buttons">
              <button
                type="button"
                className={`yes-no-button ${wizardData.activities?.food_focus === true ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    food_focus: true,
                  }
                })}
              >
                Sim
              </button>
              <button
                type="button"
                className={`yes-no-button ${wizardData.activities?.food_focus === false ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    food_focus: false,
                  }
                })}
              >
                Não
              </button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Atividades desejadas <span className="optional">(opcional)</span>
          </label>
          <div className="checkbox-grid">
            {activities.map(activity => (
              <label key={activity} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={wizardData.activities?.entertainment?.includes(activity) || false}
                  onChange={(e) => {
                    const current = wizardData.activities?.entertainment || [];
                    const updated = e.target.checked
                      ? [...current, activity]
                      : current.filter(a => a !== activity);
                    updateWizardData({
                      activities: {
                        ...wizardData.activities,
                        entertainment: updated.length > 0 ? updated : undefined,
                        // Se desmarcar ROUPA_ESPECIAL, limpar special_outfit
                        special_outfit: (activity === 'ROUPA_ESPECIAL' && !e.target.checked)
                          ? undefined
                          : wizardData.activities?.special_outfit,
                      }
                    });
                  }}
                />
                <span>{activity.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Se marcar "ROUPA_ESPECIAL" (apenas para JOVEM) */}
        {hasSpecialOutfit && profile === 'JOVEM' && (
          <div className="form-group">
            <label className="form-label">
              Modo da roupa especial <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <button
                type="button"
                className={`option-card ${wizardData.activities?.special_outfit?.mode === 'COMPRA' ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    special_outfit: {
                      required: true,
                      mode: 'COMPRA',
                    }
                  }
                })}
              >
                <div className="option-label">Compra</div>
              </button>
              <button
                type="button"
                className={`option-card ${wizardData.activities?.special_outfit?.mode === 'ALUGUEL' ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    special_outfit: {
                      required: true,
                      mode: 'ALUGUEL',
                    }
                  }
                })}
              >
                <div className="option-label">Aluguel</div>
              </button>
              <button
                type="button"
                className={`option-card ${wizardData.activities?.special_outfit?.mode === 'NAO_SEI' ? 'selected' : ''}`}
                onClick={() => updateWizardData({
                  activities: {
                    ...wizardData.activities,
                    special_outfit: {
                      required: true,
                      mode: 'NAO_SEI',
                    }
                  }
                })}
              >
                <div className="option-label">Não sei</div>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 🔴 ETAPA 6: MÚSICA E AUDIOVISUAL
  const renderStep6 = () => (
    <div className="birthday-wizard-step">
      <h3>Música e Audiovisual</h3>
      <p className="step-description">
        Informações sobre música e registro audiovisual. Nenhum campo escolhe fornecedor ou cria booking.
      </p>

      <div className="form-group">
        <label className="form-label">
          Terá música? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${wizardData.music?.present === true ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              music: {
                ...wizardData.music,
                present: true,
              }
            })}
          >
            Sim
          </button>
          <button
            type="button"
            className={`yes-no-button ${wizardData.music?.present === false ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              music: {
                ...wizardData.music,
                present: false,
              }
            })}
          >
            Não
          </button>
          <button
            type="button"
            className={`yes-no-button ${wizardData.music?.present === undefined ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              music: {
                ...wizardData.music,
                present: undefined,
              }
            })}
          >
            Não sei
          </button>
        </div>
      </div>

      {wizardData.music?.present === true && (
        <>
          <div className="form-group">
            <label className="form-label">
              Tipo de música <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['DJ', 'BANDA', 'PLAYLIST'] as const).map(type => (
                <label key={type} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={wizardData.music?.types?.includes(type) || false}
                    onChange={(e) => {
                      const current = wizardData.music?.types || [];
                      const updated = e.target.checked
                        ? [...current, type]
                        : current.filter(t => t !== type);
                      updateWizardData({
                        music: {
                          ...wizardData.music,
                          types: updated.length > 0 ? updated : undefined,
                        }
                      });
                    }}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Estilo musical <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['POP', 'ROCK', 'SERTANEJO', 'REGGAE', 'ELETRONICA', 'VARIADO'] as const).map(style => (
                <label key={style} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={wizardData.music?.styles?.includes(style) || false}
                    onChange={(e) => {
                      const current = wizardData.music?.styles || [];
                      const updated = e.target.checked
                        ? [...current, style]
                        : current.filter(s => s !== style);
                      updateWizardData({
                        music: {
                          ...wizardData.music,
                          styles: updated.length > 0 ? updated : undefined,
                        }
                      });
                    }}
                  />
                  <span>{style}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Porte da apresentação <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(['PEQUENO', 'MEDIO', 'GRANDE', 'INDEFINIDO'] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  className={`option-card ${wizardData.music?.formation_size === size ? 'selected' : ''}`}
                  onClick={() => updateWizardData({
                    music: {
                      ...wizardData.music,
                      formation_size: size,
                    }
                  })}
                >
                  <div className="option-label">{size}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Necessidade de equipamento <span className="optional">(opcional)</span>
            </label>
            <div className="checkbox-grid">
              {(['SOM', 'LUZ', 'PALCO', 'TELAO'] as const).map(equipment => (
                <label key={equipment} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={wizardData.music?.equipment_needs?.includes(equipment) || false}
                    onChange={(e) => {
                      const current = wizardData.music?.equipment_needs || [];
                      const updated = e.target.checked
                        ? [...current, equipment]
                        : current.filter(eq => eq !== equipment);
                      updateWizardData({
                        music: {
                          ...wizardData.music,
                          equipment_needs: updated.length > 0 ? updated : undefined,
                        }
                      });
                    }}
                  />
                  <span>{equipment}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Origem imaginada do equipamento <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {(['LOCAL', 'ARTISTA', 'ALUGUEL', 'COMBINADO', 'INDEFINIDO'] as const).map(source => (
                <button
                  key={source}
                  type="button"
                  className={`option-card ${wizardData.music?.equipment_source_hypothesis === source ? 'selected' : ''}`}
                  onClick={() => updateWizardData({
                    music: {
                      ...wizardData.music,
                      equipment_source_hypothesis: source,
                    }
                  })}
                >
                  <div className="option-label">{source}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Volume <span className="optional">(opcional)</span>
            </label>
            <div className="option-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {(['BAIXO', 'MEDIO', 'ALTO', 'INDEFINIDO'] as const).map(volume => (
                <button
                  key={volume}
                  type="button"
                  className={`option-card ${wizardData.music?.volume === volume ? 'selected' : ''}`}
                  onClick={() => updateWizardData({
                    music: {
                      ...wizardData.music,
                      volume: volume,
                    }
                  })}
                >
                  <div className="option-label">{volume}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">
          Fotografia / filmagem <span className="optional">(opcional)</span>
        </label>
        <div className="form-row">
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={wizardData.audiovisual?.photography || false}
              onChange={(e) => updateWizardData({
                audiovisual: {
                  ...wizardData.audiovisual,
                  photography: e.target.checked || undefined,
                }
              })}
            />
            <span>Fotografia</span>
          </label>
          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={wizardData.audiovisual?.filming || false}
              onChange={(e) => updateWizardData({
                audiovisual: {
                  ...wizardData.audiovisual,
                  filming: e.target.checked || undefined,
                }
              })}
            />
            <span>Filmagem</span>
          </label>
        </div>
      </div>
    </div>
  );

  // 🔴 ETAPA 7: SERVIÇOS DE APOIO
  const renderStep7 = () => (
    <div className="birthday-wizard-step">
      <h3>Serviços de Apoio</h3>
      <p className="step-description">
        Quais serviços de apoio você precisa? (opcional)
      </p>

      <div className="form-group">
        <label className="form-label">
          Serviços de apoio <span className="optional">(opcional)</span>
        </label>
        <div className="checkbox-grid">
          {(['LIMPEZA', 'GARCONS', 'SEGURANCA', 'DECORACAO'] as const).map(service => (
            <label key={service} className="checkbox-option">
              <input
                type="checkbox"
                checked={wizardData.support_services?.includes(service) || false}
                onChange={(e) => {
                  const current = wizardData.support_services || [];
                  const updated = e.target.checked
                    ? [...current, service]
                    : current.filter(s => s !== service);
                  updateWizardData({
                    support_services: updated.length > 0 ? updated : undefined,
                  });
                }}
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => updateWizardData({
            support_services: undefined,
          })}
        >
          Nenhum
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => updateWizardData({
            support_services: undefined,
          })}
        >
          Não sei
        </button>
      </div>
    </div>
  );

  // 🔴 ETAPA 8: DATA E HORÁRIO
  const renderStep8 = () => (
    <div className="birthday-wizard-step">
      <h3>Data e Horário</h3>
      <p className="step-description">
        Data específica ou janela desejada. Sempre janela desejada, nunca agenda fixa.
      </p>

      <div className="form-group">
        <label htmlFor="time_window_date" className="form-label">
          Data específica <span className="optional">(opcional)</span>
        </label>
        <input
          id="time_window_date"
          type="date"
          value={wizardData.time_window?.date || ''}
          onChange={(e) => updateWizardData({
            time_window: {
              ...wizardData.time_window,
              date: e.target.value || undefined,
            }
          })}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="time_window_range" className="form-label">
          Janela de datas <span className="optional">(opcional)</span>
        </label>
        <input
          id="time_window_range"
          type="text"
          value={wizardData.time_window?.range || ''}
          onChange={(e) => updateWizardData({
            time_window: {
              ...wizardData.time_window,
              range: e.target.value || undefined,
            }
          })}
          placeholder="Ex: Fim de semana de 15 a 17 de março"
          className="form-input"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="time_window_start_time" className="form-label">
            Horário início <span className="optional">(opcional)</span>
          </label>
          <input
            id="time_window_start_time"
            type="time"
            value={wizardData.time_window?.start_time || ''}
            onChange={(e) => updateWizardData({
              time_window: {
                ...wizardData.time_window,
                start_time: e.target.value || undefined,
              }
            })}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="time_window_end_time" className="form-label">
            Horário fim <span className="optional">(opcional)</span>
          </label>
          <input
            id="time_window_end_time"
            type="time"
            value={wizardData.time_window?.end_time || ''}
            onChange={(e) => updateWizardData({
              time_window: {
                ...wizardData.time_window,
                end_time: e.target.value || undefined,
              }
            })}
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Flexível ou não? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${wizardData.time_window?.flexible === true ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              time_window: {
                ...wizardData.time_window,
                flexible: true,
              }
            })}
          >
            Sim, flexível
          </button>
          <button
            type="button"
            className={`yes-no-button ${wizardData.time_window?.flexible === false ? 'selected' : ''}`}
            onClick={() => updateWizardData({
              time_window: {
                ...wizardData.time_window,
                flexible: false,
              }
            })}
          >
            Não, fixo
          </button>
        </div>
      </div>
    </div>
  );

  // 🔴 ETAPA 9: FINALIZAÇÃO
  const renderStep9 = () => (
    <div className="birthday-wizard-step">
      <h3>Finalização</h3>
      <p className="step-description">
        Revise as informações e salve o planejamento da festa.
      </p>

      <div className="summary-section">
        <h4>Resumo do Planejamento</h4>
        <div className="summary-item">
          <strong>Nome do evento:</strong> {wizardData.project_name || 'Não informado'}
        </div>
        {wizardData.birthday_profile && (
          <div className="summary-item">
            <strong>Perfil:</strong> {wizardData.birthday_profile}
          </div>
        )}
        {wizardData.attendance?.total && (
          <div className="summary-item">
            <strong>Convidados:</strong> {wizardData.attendance.total} pessoas
          </div>
        )}
        {wizardData.location?.has_venue !== undefined && (
          <div className="summary-item">
            <strong>Local:</strong> {wizardData.location.has_venue ? 'Já tem local' : 'Busca local'}
          </div>
        )}
        {wizardData.style?.general && (
          <div className="summary-item">
            <strong>Estilo:</strong> {wizardData.style.general}
          </div>
        )}
      </div>

      <div className="form-group">
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem' }}>
          ⚠️ Este formulário escuta intenções. Ele não decide, não contrata e não executa.
        </p>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Estado interno gerado: lifecycle_stage = INTENT_DRAFT, execution_state = NON_EXECUTABLE
        </p>
      </div>
    </div>
  );

  return (
    <div className="birthday-wizard-container">
      <div className="birthday-wizard-header">
        <h2>Planejamento de Festa de Aniversário</h2>
        <div className="wizard-progress">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => {
            const isActive = step === currentStep;
            const isCompleted = step < currentStep;

            return (
              <div
                key={step}
                className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isCompleted || isActive ? 'clickable' : ''}`}
                onClick={() => {
                  if (isCompleted || isActive) {
                    setCurrentStep(step);
                  }
                }}
                title={isCompleted || isActive ? `Clique para revisar etapa ${step + 1}` : 'Complete as etapas anteriores primeiro'}
              >
                <div className="step-number">{step + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="birthday-wizard-content">
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
        {currentStep === 7 && renderStep7()}
        {currentStep === 8 && renderStep8()}
        {currentStep === 9 && renderStep9()}
      </div>

      <div className="birthday-wizard-footer">
        {currentStep > 0 && (
          <button
            type="button"
            className="wizard-button wizard-button-secondary"
            onClick={handleBack}
          >
            Voltar
          </button>
        )}
        {currentStep < 9 ? (
          <button
            type="button"
            className="wizard-button wizard-button-primary"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            className="wizard-button wizard-button-primary"
            onClick={handleSavePlanning}
            disabled={isSaving || !sessionReady || !activeActor}
          >
            {isSaving ? 'Salvando...' : 'Salvar planejamento da festa'}
          </button>
        )}
      </div>
    </div>
  );
}

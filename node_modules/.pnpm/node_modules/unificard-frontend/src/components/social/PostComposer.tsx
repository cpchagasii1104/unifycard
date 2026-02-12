// src/components/social/PostComposer.tsx
// Composer para criar novos posts (texto + mídia)
// Fluxo: Ator → Público → Tipo de Experiência → CTA
// Usa ActiveActorContext global - fonte única da verdade

import { useState, useEffect } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getPublishingAsText, getSuccessMessage } from '../../utils/actorLanguage';
import { getActorPermissions, type ActorPermissions } from '../../api/reputation';
import './PostComposer.css';
import './ActorContextInfo.css';

interface PostComposerProps {
  onSubmit: (
    content: string,
    mediaIds: string[],
    actorId: string | null,
    intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event',
    intentMetadata?: Record<string, any>,
    targeting?: Record<string, any>,
    cta?: {
      type: 'booking' | 'service' | 'payment';
      target_actor_id?: string;
      target_group_id?: string;
      price?: number;
      currency?: string;
    }
  ) => Promise<void>;
  placeholder?: string;
}

// Tipos de evento suportados pelo backend
type EventSubtype = 'SHOW' | 'CINEMA' | 'ESPORTE' | 'BAR' | 'RESTAURANTE' | 'FEIRA' | 'WORKSHOP' | 'EXPOSICAO' | 'FESTIVAL' | 'BALADA';

// Tipo de experiência (categorias humanas)
type ExperienceType = 
  | 'content_personal'      // Atualização pessoal
  | 'content_institutional' // Conteúdo institucional
  | 'booking'               // Agendamento
  | 'event'                 // Evento (requer subtipo)
  | 'product_offer'         // Venda de produto
  | 'service_offer'         // Oferta de serviço
  | 'vote'                  // Votação
  | 'project';              // Projeto de grupo

// Público (alcance)
type Audience = 'public' | 'friends' | 'company' | 'group';

export default function PostComposer({ onSubmit, placeholder = 'O que você está pensando?' }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PASSO 0: Ator (sempre usa o ator ativo global)
  const { activeActor } = useActiveActor();
  const selectedActorId = activeActor?.actor_id || null;
  const [permissions, setPermissions] = useState<ActorPermissions | null>(null);
  
  // Reagir à mudança de ator ativo
  useEffect(() => {
    if (activeActor) {
      // Reset experiência quando muda o ator (pode mudar opções disponíveis)
      setExperienceType('');
      setShowExperienceOptions(false);
      setEventSubtype('');
      setShowCta(false);
      
      // FASE 11: Carregar permissões do ator
      loadPermissions();
    } else {
      setPermissions(null);
    }
  }, [activeActor?.actor_id, activeActor?.actor_type]);

  const loadPermissions = async () => {
    if (!activeActor) return;
    
    try {
      const perms = await getActorPermissions(
        activeActor.actor_id,
        activeActor.actor_type as 'user' | 'page',
        activeActor.company_status
      );
      setPermissions(perms);
    } catch (err) {
      console.warn('Erro ao carregar permissões (não crítico):', err);
      // Se falhar, assumir permissões mínimas
      setPermissions({
        canVote: false,
        canCreateProject: false,
        canCreateCTA: false,
        hasExtendedReach: false,
        hasAdvancedAccess: false,
      });
    }
  };
  
  // PASSO 1: Público (sempre visível, segunda decisão)
  // REGRA: Audiências diferentes por tipo de ator
  const getAvailableAudiences = (): Audience[] => {
    if (activeActor?.actor_type === 'page') {
      // Empresa: PUBLIC, FOLLOWERS (company), GROUPS
      return ['public', 'company', 'group'];
    } else {
      // Pessoa Física: PUBLIC, FRIENDS
      return ['public', 'friends'];
    }
  };

  const availableAudiences = getAvailableAudiences();
  const [audience, setAudience] = useState<Audience>(availableAudiences[0]);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  
  // Resetar audiência quando ator muda
  useEffect(() => {
    const newAudiences = getAvailableAudiences();
    if (!newAudiences.includes(audience)) {
      setAudience(newAudiences[0]);
    }
  }, [activeActor?.actor_id]);
  
  // PASSO 2: Tipo de Experiência
  const [experienceType, setExperienceType] = useState<ExperienceType | ''>('');
  const [showExperienceOptions, setShowExperienceOptions] = useState(false);
  
  // Subtipo de evento (obrigatório quando experienceType === 'event')
  const [eventSubtype, setEventSubtype] = useState<EventSubtype | ''>('');
  
  // Campos específicos para vote
  const [voteOptions, setVoteOptions] = useState<string[]>(['', '']);
  const [voteClosesAt, setVoteClosesAt] = useState<string>('');
  
  // Campos específicos para project
  const [projectGroupId, setProjectGroupId] = useState<string>('');
  const [projectBudget, setProjectBudget] = useState<string>('');
  const [projectDeadline, setProjectDeadline] = useState<string>('');
  
  // PASSO 3: CTA (só aparece depois do tipo de experiência)
  const [showCta, setShowCta] = useState(false);
  const [ctaType, setCtaType] = useState<'booking' | 'service' | 'payment'>('booking');
  const [ctaPrice, setCtaPrice] = useState<string>('');
  const [ctaGroupId, setCtaGroupId] = useState<string>('');

  // Mapear ExperienceType para intent do backend
  const getIntentFromExperience = (expType: ExperienceType): 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event' => {
    switch (expType) {
      case 'content_personal':
        return audience === 'friends' ? 'friends' : 'personal';
      case 'content_institutional':
        return 'personal'; // Será filtrado por audience
      case 'booking':
        return 'booking';
      case 'event':
        return 'event';
      case 'product_offer':
        return 'product_offer';
      case 'service_offer':
        return 'service_offer';
      case 'vote':
        return 'vote';
      case 'project':
        return 'project';
      default:
        return 'personal';
    }
  };

  // Determinar CTAs disponíveis baseado no tipo de experiência
  const getAvailableCTAs = (expType: ExperienceType): Array<'booking' | 'service' | 'payment'> => {
    switch (expType) {
      case 'event':
        return ['booking', 'payment']; // Agendar ou Pagar ingresso
      case 'booking':
        return ['booking']; // Agendar
      case 'service_offer':
        return ['service', 'payment']; // Contratar ou Pagar
      case 'product_offer':
        return ['payment']; // Comprar
      case 'vote':
        return []; // Votação não precisa de CTA externo
      case 'project':
        return ['payment']; // Contribuir
      default:
        return ['booking', 'service', 'payment']; // Todos disponíveis
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaIds.length === 0) return;

    // Validações
    if (!experienceType) {
      alert('Por favor, escolha o tipo de experiência');
      return;
    }

    if (experienceType === 'event' && !eventSubtype) {
      alert('Por favor, escolha o subtipo do evento');
      return;
    }

    if (experienceType === 'vote') {
      const validOptions = voteOptions.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        alert('Votação precisa de pelo menos 2 opções');
        return;
      }
    }

    // Validação: ator deve estar selecionado
    if (!selectedActorId || !activeActor) {
      alert('Por favor, selecione um ator no menu superior antes de postar');
      return;
    }

    setIsSubmitting(true);
    try {
      // Construir intent_metadata baseado no tipo de experiência
      let intentMetadata: Record<string, any> = {};
      
      if (experienceType === 'event' && eventSubtype) {
        intentMetadata = {
          event_subtype: eventSubtype,
        };
      } else if (experienceType === 'vote') {
        const validOptions = voteOptions.filter(opt => opt.trim());
        intentMetadata = {
          options: validOptions,
          closes_at: voteClosesAt || undefined,
        };
      } else if (experienceType === 'project') {
        intentMetadata = {
          group_id: projectGroupId || undefined,
          budget_cents: projectBudget ? Math.round(parseFloat(projectBudget) * 100) : undefined,
          deadline: projectDeadline || undefined,
        };
      }

      // Construir targeting baseado no público
      const targeting: Record<string, any> = {};
      if (audience === 'group' && targetGroupId) {
        targeting.group_id = targetGroupId;
      }
      // TODO: Adicionar outros filtros de targeting conforme necessário

      // Construir intent
      const intent = getIntentFromExperience(experienceType);

      // Construir CTA (só se foi configurado)
      const cta = showCta ? {
        type: ctaType,
        price: ctaPrice ? parseFloat(ctaPrice) : undefined,
        currency: 'BRL',
        target_group_id: ctaGroupId || undefined,
      } : undefined;

      await onSubmit(content, mediaIds, selectedActorId, intent, intentMetadata, targeting, cta);
      
      // Mostrar mensagem de sucesso adaptativa
      const successMsg = getSuccessMessage(activeActor, 'published');
      alert(successMsg);
      
      // Reset form (mas mantém o ator selecionado)
      setContent('');
      setMediaIds([]);
      setAudience('public');
      setTargetGroupId('');
      setExperienceType('');
      setShowExperienceOptions(false);
      setEventSubtype('');
      setShowCta(false);
      setCtaType('booking');
      setCtaPrice('');
      setCtaGroupId('');
      setVoteOptions(['', '']);
      setVoteClosesAt('');
      setProjectGroupId('');
      setProjectBudget('');
      setProjectDeadline('');
      // selectedActorId permanece (contexto ativo)
    } catch (error) {
      console.error('Erro ao criar post:', error);
      alert('Erro ao criar post. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Por enquanto, apenas adiciona IDs temporários
    // Em produção, faria upload e obteria media_ids reais
    const newMediaIds: string[] = [];
    for (let i = 0; i < files.length; i++) {
      // Placeholder: em produção, chamaria /media/presign
      newMediaIds.push(`temp-${Date.now()}-${i}`);
    }
    setMediaIds([...mediaIds, ...newMediaIds]);
  };

  const removeMedia = (index: number) => {
    setMediaIds(mediaIds.filter((_, i) => i !== index));
  };

  // Quando o tipo de experiência muda, resetar CTA e mostrar opções relevantes
  const handleExperienceTypeChange = (newType: ExperienceType) => {
    setExperienceType(newType);
    setShowCta(false); // Reset CTA quando muda o tipo
    setEventSubtype(''); // Reset subtipo de evento
  };

  // Filtrar opções de experiência baseado no tipo de ator
  const getAvailableExperienceTypes = (): ExperienceType[] => {
    if (!activeActor) return [];
    
    const baseTypes: ExperienceType[] = ['content_personal', 'content_institutional', 'booking', 'event', 'product_offer', 'service_offer', 'project'];
    
    if (activeActor.actor_type === 'user') {
      // Pessoa física: todas as opções incluindo votações
      return [...baseTypes, 'vote'];
    } else if (activeActor.actor_type === 'page') {
      // Empresa: foco em negócio, mas PROVISIONAL não pode votar
      if (activeActor.company_status === 'PROVISIONAL') {
        return ['content_institutional', 'booking', 'event', 'product_offer', 'service_offer', 'project'];
      }
      // Empresas VERIFIED+ podem votar
      return ['content_institutional', 'booking', 'event', 'product_offer', 'service_offer', 'project', 'vote'];
    } else {
      // Grupo ou canal: todas as opções
      return [...baseTypes, 'vote'];
    }
  };

  const availableExperienceTypes = getAvailableExperienceTypes();
  const availableCTAs = experienceType ? getAvailableCTAs(experienceType) : [];
  
  // Verificar se uma opção está disponível
  const isExperienceTypeAvailable = (expType: ExperienceType): boolean => {
    return availableExperienceTypes.includes(expType);
  };

  return (
    <div className="post-composer">
      <form onSubmit={handleSubmit}>
        {/* Contexto de Ator (informativo apenas) */}
        {activeActor && (
          <div className="actor-context-info">
            <div className="actor-context-display">
              {activeActor.avatar_url ? (
                <img 
                  src={activeActor.avatar_url} 
                  alt={activeActor.display_name} 
                  className="actor-context-avatar"
                />
              ) : (
                <div className="actor-context-avatar-placeholder">
                  {activeActor.actor_type === 'user' ? '👤' : activeActor.actor_type === 'page' ? '🏢' : '👥'}
                </div>
              )}
              <div className="actor-context-text">
                <span className="actor-context-label">{getPublishingAsText(activeActor)}</span>
                <span className="actor-context-name">{activeActor.display_name}</span>
                {activeActor.actor_type === 'page' && activeActor.user_role && (
                  <span className="actor-context-role">
                    {activeActor.user_role === 'owner' && '👑 Proprietário'}
                    {activeActor.user_role === 'director' && '💼 Diretor'}
                    {activeActor.user_role === 'manager' && '📋 Gerente'}
                    {activeActor.user_role === 'employee' && '👔 Funcionário'}
                  </span>
                )}
                {activeActor.actor_type === 'page' && activeActor.company_status === 'PROVISIONAL' && (
                  <span className="actor-context-badge provisional">
                    ⚠️ Empresa em validação
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Campo de conteúdo */}
        <div className="composer-input">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        {mediaIds.length > 0 && (
          <div className="composer-media-preview">
            {mediaIds.map((id, index) => (
              <div key={id} className="media-preview-item">
                <span>Mídia {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="remove-media-btn"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PASSO 1: PÚBLICO (sempre visível) */}
        <div className="composer-step composer-step-audience">
          <label className="step-label">
            <span className="step-number">1</span>
            <span className="step-title">Para quem é isso?</span>
          </label>
          <div className="audience-options">
            {availableAudiences.includes('public') && (
              <button
                type="button"
                className={`audience-btn ${audience === 'public' ? 'active' : ''}`}
                onClick={() => setAudience('public')}
                disabled={isSubmitting}
              >
                🌍 Público
              </button>
            )}
            {availableAudiences.includes('friends') && (
              <button
                type="button"
                className={`audience-btn ${audience === 'friends' ? 'active' : ''}`}
                onClick={() => setAudience('friends')}
                disabled={isSubmitting}
              >
                👥 Amigos
              </button>
            )}
            {availableAudiences.includes('company') && (
              <button
                type="button"
                className={`audience-btn ${audience === 'company' ? 'active' : ''}`}
                onClick={() => setAudience('company')}
                disabled={isSubmitting}
              >
                👥 Seguidores
              </button>
            )}
            {availableAudiences.includes('group') && (
              <button
                type="button"
                className={`audience-btn ${audience === 'group' ? 'active' : ''}`}
                onClick={() => setAudience('group')}
                disabled={isSubmitting}
              >
                🎯 Grupo específico
              </button>
            )}
          </div>
          {audience === 'group' && (
            <input
              type="text"
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              placeholder="ID do grupo"
              disabled={isSubmitting}
              className="group-id-input"
            />
          )}
        </div>

        {/* PASSO 2: TIPO DE EXPERIÊNCIA */}
        <div className="composer-step composer-step-experience">
          <label className="step-label">
            <span className="step-number">2</span>
            <span className="step-title">O que é isso que você está criando?</span>
          </label>
          
          {!showExperienceOptions ? (
            <button
              type="button"
              onClick={() => setShowExperienceOptions(true)}
              className="open-experience-btn"
              disabled={isSubmitting}
            >
              {experienceType ? '✏️ Alterar tipo' : '🎯 Escolher tipo de experiência'}
            </button>
          ) : (
            <div className="experience-options">
              {/* Conteúdo */}
              <div className="experience-category">
                <div className="category-label">💬 Conteúdo</div>
                <div className="category-options">
                  {isExperienceTypeAvailable('content_personal') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'content_personal' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('content_personal')}
                      disabled={isSubmitting}
                    >
                      Atualização pessoal
                    </button>
                  )}
                  {isExperienceTypeAvailable('content_institutional') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'content_institutional' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('content_institutional')}
                      disabled={isSubmitting}
                    >
                      Conteúdo institucional
                    </button>
                  )}
                </div>
              </div>

              {/* Experiência com tempo */}
              <div className="experience-category">
                <div className="category-label">📅 Experiência com tempo</div>
                <div className="category-options">
                  {isExperienceTypeAvailable('booking') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'booking' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('booking')}
                      disabled={isSubmitting}
                    >
                      Agendamento
                    </button>
                  )}
                  {isExperienceTypeAvailable('event') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'event' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('event')}
                      disabled={isSubmitting}
                    >
                      Evento
                    </button>
                  )}
                </div>
              </div>

              {/* Troca econômica */}
              <div className="experience-category">
                <div className="category-label">🛒 Troca econômica</div>
                <div className="category-options">
                  {isExperienceTypeAvailable('product_offer') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'product_offer' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('product_offer')}
                      disabled={isSubmitting}
                    >
                      Venda de produto
                    </button>
                  )}
                  {isExperienceTypeAvailable('service_offer') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'service_offer' ? 'active' : ''}`}
                      onClick={() => handleExperienceTypeChange('service_offer')}
                      disabled={isSubmitting}
                    >
                      Oferta de serviço
                    </button>
                  )}
                </div>
              </div>

              {/* Decisão coletiva */}
              <div className="experience-category">
                <div className="category-label">🗳️ Decisão coletiva</div>
                <div className="category-options">
                  {isExperienceTypeAvailable('vote') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'vote' ? 'active' : ''} ${!permissions?.canVote ? 'disabled' : ''}`}
                      onClick={() => {
                        if (!permissions?.canVote) {
                          alert('Esta funcionalidade está disponível após uso contínuo da plataforma. Continue interagindo para desbloquear.');
                          return;
                        }
                        handleExperienceTypeChange('vote');
                      }}
                      disabled={isSubmitting || !permissions?.canVote}
                      title={!permissions?.canVote ? 'Disponível após uso contínuo' : undefined}
                    >
                      Votação
                    </button>
                  )}
                  {isExperienceTypeAvailable('project') && (
                    <button
                      type="button"
                      className={`experience-btn ${experienceType === 'project' ? 'active' : ''} ${!permissions?.canCreateProject ? 'disabled' : ''}`}
                      onClick={() => {
                        if (!permissions?.canCreateProject) {
                          alert('Criar projetos está disponível após uso contínuo da plataforma. Continue interagindo para desbloquear.');
                          return;
                        }
                        handleExperienceTypeChange('project');
                      }}
                      disabled={isSubmitting || !permissions?.canCreateProject}
                      title={!permissions?.canCreateProject ? 'Disponível após uso contínuo' : undefined}
                    >
                      Projeto de grupo
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExperienceOptions(false)}
                className="close-experience-btn"
                disabled={isSubmitting}
              >
                ✓ Confirmar
              </button>
            </div>
          )}

          {/* Subtipo de evento (obrigatório quando evento é selecionado) */}
          {experienceType === 'event' && (
            <div className="event-subtype-section">
              <label className="subtype-label">
                Tipo de evento: <span className="required">*</span>
              </label>
              <select
                value={eventSubtype}
                onChange={(e) => setEventSubtype(e.target.value as EventSubtype)}
                disabled={isSubmitting}
                className="event-subtype-select"
                required
              >
                <option value="">Selecione o tipo...</option>
                <option value="SHOW">🎶 Show</option>
                <option value="CINEMA">🎬 Cinema</option>
                <option value="ESPORTE">⚽ Esporte</option>
                <option value="BAR">🍺 Bar / Happy Hour</option>
                <option value="RESTAURANTE">🍽️ Restaurante</option>
                <option value="FEIRA">🎪 Feira</option>
                <option value="WORKSHOP">📚 Workshop</option>
                <option value="EXPOSICAO">🖼️ Exposição</option>
                <option value="FESTIVAL">🎉 Festival</option>
                <option value="BALADA">💃 Balada</option>
              </select>
            </div>
          )}

          {/* Opções específicas para vote */}
          {experienceType === 'vote' && (
            <div className="intent-vote-options">
              <label>Opções de votação (mínimo 2):</label>
              {voteOptions.map((opt, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...voteOptions];
                    newOptions[idx] = e.target.value;
                    setVoteOptions(newOptions);
                  }}
                  placeholder={`Opção ${idx + 1}`}
                  disabled={isSubmitting}
                />
              ))}
              <button
                type="button"
                onClick={() => setVoteOptions([...voteOptions, ''])}
                disabled={isSubmitting}
              >
                + Adicionar opção
              </button>
              <label>
                Fecha em (opcional):
                <input
                  type="datetime-local"
                  value={voteClosesAt}
                  onChange={(e) => setVoteClosesAt(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          )}
          
          {/* Opções específicas para project */}
          {experienceType === 'project' && (
            <div className="intent-project-options">
              <label>
                Grupo:
                <input
                  type="text"
                  value={projectGroupId}
                  onChange={(e) => setProjectGroupId(e.target.value)}
                  placeholder="ID do grupo"
                  disabled={isSubmitting}
                />
              </label>
              <label>
                Orçamento (R$):
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={projectBudget}
                  onChange={(e) => setProjectBudget(e.target.value)}
                  placeholder="0.00"
                  disabled={isSubmitting}
                />
              </label>
              <label>
                Prazo:
                <input
                  type="date"
                  value={projectDeadline}
                  onChange={(e) => setProjectDeadline(e.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          )}
        </div>

        {/* PASSO 3: CTA (só aparece depois do tipo de experiência) */}
        {experienceType && availableCTAs.length > 0 && (
          <div className="composer-step composer-step-cta">
            <label className="step-label">
              <span className="step-number">3</span>
              <span className="step-title">O que você quer que as pessoas façam?</span>
            </label>
            
            {!showCta ? (
              <button
                type="button"
                onClick={() => {
                  // FASE 11: Verificar permissão antes de mostrar CTA
                  if (!permissions?.canCreateCTA) {
                    alert('Criar ações (CTAs) está disponível após uso contínuo da plataforma. Continue interagindo para desbloquear.');
                    return;
                  }
                  setShowCta(true);
                }}
                className={`open-cta-btn ${!permissions?.canCreateCTA ? 'disabled' : ''}`}
                disabled={isSubmitting || !permissions?.canCreateCTA}
                title={!permissions?.canCreateCTA ? 'Disponível após uso contínuo' : undefined}
              >
                ➕ Adicionar ação (CTA)
              </button>
            ) : (
              <div className="composer-cta">
                <label>
                  Tipo de ação:
                  <select
                    value={ctaType}
                    onChange={(e) => setCtaType(e.target.value as 'booking' | 'service' | 'payment')}
                    disabled={isSubmitting}
                  >
                    {availableCTAs.includes('booking') && (
                      <option value="booking">📅 Agendar</option>
                    )}
                    {availableCTAs.includes('service') && (
                      <option value="service">💼 Contratar Serviço</option>
                    )}
                    {availableCTAs.includes('payment') && (
                      <option value="payment">💳 Pagar / Comprar</option>
                    )}
                  </select>
                </label>
                {(ctaType === 'service' || ctaType === 'payment') && (
                  <label>
                    Preço (R$):
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ctaPrice}
                      onChange={(e) => setCtaPrice(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                    />
                  </label>
                )}
                <label>
                  Grupo para repasse (opcional):
                  <input
                    type="text"
                    value={ctaGroupId}
                    onChange={(e) => setCtaGroupId(e.target.value)}
                    placeholder="ID do grupo"
                    disabled={isSubmitting}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowCta(false)}
                  className="remove-cta-btn"
                  disabled={isSubmitting}
                >
                  ✕ Remover ação
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ações do composer */}
        <div className="composer-actions">
          <div className="composer-actions-left">
            <label className="attach-media-btn">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                disabled={isSubmitting}
              />
              📷 Foto/Vídeo
            </label>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || (!content.trim() && mediaIds.length === 0) || !experienceType || (experienceType === 'event' && !eventSubtype)}
            className="submit-post-btn"
          >
            {isSubmitting ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}


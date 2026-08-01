// src/components/social/SocialFeed2.tsx
// Feed Social 2.0 com layout 3 colunas + Eventos integrados

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedItem } from '@unificard/contracts';
import IntentComposer from './IntentComposer';
import ConnectionRequests from './ConnectionRequests';
import PostCard, { type PostCardData } from './PostCard';
import EventCard from '../events/EventCard';
import CulturalEventCard from './CulturalEventCard';
import ImpactBalanceBadge from './ImpactBalanceBadge';
import FeaturedToday from './FeaturedToday';
import FirstActionHint from './FirstActionHint';
import PersonalProgressCard from './PersonalProgressCard';
import SmartEmptyState from './SmartEmptyState';
import CommunityActivitySummary from './CommunityActivitySummary';
import TodayForYou from './TodayForYou';
import { OnboardingHighlight, useOnboardingHighlights } from '../onboarding/OnboardingHighlights';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getSocialFeed, createSocialPost, toggleReaction, createComment, vote } from '../../api/social';
import { getUnifiedFeed } from '../../api/feed';
import { getActiveLocation, type ActiveLocation } from '../../api/active-location';
import FeedScopeSelector, { type FeedScopeValue } from '../feed/FeedScopeSelector';
import ActiveLocationManager from '../feed/ActiveLocationManager';
import { listPublicCulturalEvents, type CulturalEvent } from '../../api/cultural';
import { getEmptyStateText } from '../../utils/actorLanguage';
import { getMyAccount, type UserAccount } from '../../api/economy';
import { getGroupSuggestions, type GroupSuggestion } from '../../api/groups';
import { getFundDashboard, type FundDashboardData } from '../../api/fund';
import { getIdentityProfile } from '../../api/identity';
import { sortFeedByRelevance, type FeedItem as ScoringFeedItem } from '../../utils/feedScoring';
import { validateActiveActor, safeApiCall, safeArray, safeNumber, safeString } from '../../utils/guardrails';
import { devLog } from '../../utils/devLog';
import { centsToReais } from '../../utils/money';
import './SocialFeed2.css';

export default function SocialFeed2() {
  const navigate = useNavigate();
  const { activeActor, actors, isLoading: actorsLoading } = useActiveActor();
  const showHighlights = useOnboardingHighlights();
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [events, setEvents] = useState<Array<{
    eventId: string;
    title: string;
    eventType: string;
    cityId: string | null;
    status: string;
    ticketPrice: number | null;
    acceptsConsumption: boolean;
  }>>([]);
  const [culturalEvents, setCulturalEvents] = useState<CulturalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // DECISION-0030 (F5): filtro geo do feed
  const [feedScope, setFeedScope] = useState<FeedScopeValue>({
    scope: 'unlimited',
    includeGlobal: true,
  });
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  // Hidratar localização ativa ao montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await getActiveLocation();
      if (!cancelled) setActiveLocation(loc);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userPreferences, setUserPreferences] = useState<{ music_genres?: string[]; event_types?: string[] } | null>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  
  // Sidebar data
  const [myAccount, setMyAccount] = useState<UserAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [fundData, setFundData] = useState<FundDashboardData | null>(null);
  const [fundLoading, setFundLoading] = useState(false);

  // EVENTOS ÂNCORA: Buscar geolocalização (opt-in, não bloqueia)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          devLog.warn('Geolocalização não disponível (não crítico):', err);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Carregar cidade do usuário para scoring de relevância
  useEffect(() => {
    const loadUserCity = async () => {
      try {
        const identity = await getIdentityProfile();
        setUserCity(identity.residence?.city?.name || null);
      } catch (err) {
        console.warn('Erro ao carregar cidade do usuário para scoring:', err);
      }
    };
    loadUserCity();
  }, []);

  // EVENTOS ÂNCORA: Buscar preferências do usuário (se endpoint existir)
  useEffect(() => {
    // TODO: Implementar endpoint de preferências quando disponível
    // Por enquanto, pode ser mockado ou buscado de localStorage
    const savedPreferences = localStorage.getItem('user_preferences');
    if (savedPreferences) {
      try {
        setUserPreferences(JSON.parse(savedPreferences));
      } catch (err) {
        console.warn('Erro ao parsear preferências salvas:', err);
      }
    }
  }, []);

  // Carregar feed quando activeActor estiver disponível
  useEffect(() => {
    if (activeActor && !actorsLoading) {
      loadFeed();
    }
    // F5 — Recarrega também quando filtro geo (scope/value/includeGlobal) muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeActor?.actor_id, actorsLoading, feedScope.scope, feedScope.value, feedScope.includeGlobal]);

  // Reagir à mudança de ator ativo (evento customizado)
  useEffect(() => {
    const handleActorChange = () => {
      // Recarregar feed quando o ator mudar
      if (activeActor && !actorsLoading) {
        loadFeed();
      }
    };

    window.addEventListener('active-actor-changed', handleActorChange);
    return () => {
      window.removeEventListener('active-actor-changed', handleActorChange);
    };
  }, [activeActor, actorsLoading]);

  // Carregar dados da sidebar
  useEffect(() => {
    if (validateActiveActor(activeActor) && !actorsLoading) {
      loadSidebarData();
    }
  }, [activeActor?.actor_id, actorsLoading]);

  const loadSidebarData = async () => {
    // Guardrail: validar activeActor antes de carregar
    if (!validateActiveActor(activeActor)) {
      return;
    }

    // Carregar conta do usuário com safeApiCall
    setAccountLoading(true);
    const account = await safeApiCall(
      async () => getMyAccount(),
      null,
      'Erro ao carregar conta'
    );
    setMyAccount(account);
    setAccountLoading(false);

    // Carregar sugestões de grupos com safeApiCall e safeArray
    setGroupsLoading(true);
    const suggestionsResponse = await safeApiCall(
      async () => getGroupSuggestions(3),
      { groups: [] },
      'Erro ao carregar sugestões de grupos'
    );
    setGroupSuggestions(safeArray<GroupSuggestion>(suggestionsResponse.groups, []));
    setGroupsLoading(false);

    // Carregar dados do fundo regional com safeApiCall
    setFundLoading(true);
    const dashboard = await safeApiCall(
      async () => getFundDashboard(30),
      null,
      'Erro ao carregar dados do fundo'
    );
    setFundData(dashboard);
    setFundLoading(false);
  };

  // 🔴 GUARD: Prevenir chamadas duplicadas de loadFeed
  const isLoadingFeedRef = useRef(false);

  const loadFeed = async (nextCursor?: string | null) => {
    // Aguardar ator ativo - não mostrar erro imediatamente
    if (!activeActor) {
      // Não definir erro - apenas aguardar
      setIsLoading(false);
      return;
    }

    // 🔴 GUARD: Prevenir chamadas duplicadas simultâneas
    if (isLoadingFeedRef.current && !nextCursor) {
      // Já está carregando (e não é paginação), ignorar
      return;
    }

    isLoadingFeedRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      // Buscar feed social usando API centralizada com modo de atuação + preferências + geo
      // DECISION-0030 (F5): payload polimórfico {scope, value, include_global} enviado ao backend
      const data = await getSocialFeed({
        cursor: nextCursor || undefined,
        limit: 20,
        actor_type: activeActor.actor_type as 'user' | 'page',
        actor_id: activeActor.actor_id,
        actor_status: activeActor.company_status, // Status da empresa (PROVISIONAL, VERIFIED, etc)
        user_preferences: userPreferences || undefined, // EVENTOS ÂNCORA: Preferências
        user_location: userLocation || undefined, // EVENTOS ÂNCORA: Geolocalização
        // F5 — filtro geo soberano via backend (frontend NÃO calcula raio)
        scope: feedScope.scope,
        value: feedScope.value,
        include_global: feedScope.includeGlobal,
      });
      
      // CORREÇÃO: usar função de atualização para evitar closure
      setPosts(prev => nextCursor ? [...prev, ...data.posts] : data.posts);
      
      setCursor(data.next_cursor);
      setHasMore(data.has_more);

      // Buscar feed unificado (posts + eventos standalone)
      try {
        const unifiedData = await getUnifiedFeed({ limit: 30 });
        
        if (unifiedData.items) {
          // Separar eventos standalone usando tipos do contrato
          const standaloneEvents = unifiedData.items
            .filter((item: FeedItem): item is Extract<FeedItem, { type: 'EVENT_STANDALONE' }> => 
              item.type === 'EVENT_STANDALONE' && item.event !== undefined
            )
            .map((item) => ({
              eventId: item.event.id,
              title: item.event.title,
              eventType: item.event.eventType,
              cityId: item.event.cityId,
              status: item.event.status,
              ticketPrice: item.event.ticketPrice,
              acceptsConsumption: item.event.acceptsConsumption,
            }));
          
          // Remover duplicatas por eventId
          const uniqueEvents = Array.from(
            new Map(standaloneEvents.map((e: { eventId: string; title: string; eventType: string; cityId: string | null; status: string; ticketPrice: number | null; acceptsConsumption: boolean }) => [e.eventId, e])).values()
          );
          setEvents(uniqueEvents);
        } else if (unifiedData.posts) {
          // Fallback: compatibilidade com formato antigo
          const eventItems = unifiedData.posts
            .filter((p: any) => p.eventId && p.event && (p.event.status === 'published' || p.event.status === 'active'))
            .map((p: any) => ({
              eventId: p.event!.id,
              title: p.event!.title,
              eventType: p.event!.eventType,
              cityId: p.event!.cityId,
              status: p.event!.status,
              ticketPrice: p.event!.ticketPrice,
              acceptsConsumption: p.event!.acceptsConsumption,
            }));
          const uniqueEvents = Array.from(
            new Map(eventItems.map((e: { eventId: string; title: string; eventType: string; cityId: string | null; status: string; ticketPrice: number | null; acceptsConsumption: boolean }) => [e.eventId, e])).values()
          );
          setEvents(uniqueEvents);
        }
      } catch (eventsErr) {
        // Não bloqueia o feed se eventos falharem
        console.warn('Erro ao carregar eventos:', eventsErr);
      }

      // FASE 16: Buscar eventos culturais (PAC) - apenas na primeira carga
      // Trata 404 como feature indisponível (não erro)
      if (!nextCursor) {
        try {
          const culturalData = await listPublicCulturalEvents({ limit: 10 });
          setCulturalEvents(culturalData.events || []);
        } catch (culturalErr: any) {
          // Se 404, feature não está disponível (não logar como erro)
          if (culturalErr?.code !== 'FEATURE_UNAVAILABLE' && culturalErr?.status !== 404) {
            // Apenas logar se não for 404
            console.warn('Erro ao carregar eventos culturais:', culturalErr);
          }
          // 404 é tratado silenciosamente - não bloqueia o feed
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar feed');
      console.error('Erro ao carregar feed:', err);
    } finally {
      setIsLoading(false);
      isLoadingFeedRef.current = false;
    }
  };

  const handleCreatePost = async (
    content: string,
    mediaIds: string[],
    _actorId: string | null, // Parâmetro ignorado - sempre usa activeActor
    intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event',
    intentMetadata?: Record<string, any>,
    targeting?: Record<string, any>,
    cta?: {
      type: 'booking' | 'service' | 'payment';
      target_actor_id?: string;
      target_group_id?: string;
      price?: number;
      currency?: string;
    },
    /** F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5). Ausente = backend assume 'public'. */
    visibility?: 'public' | 'connections' | 'only_me',
    /** DECISION-0162: refinamento da plateia por tipo de relação. */
    audienceRelationshipTypes?: string[],
    /** DECISION-0176 (S-CITY-1): intenção territorial "same_city" (backend resolve a cidade; piloto Curitiba). */
    audienceSameCity?: boolean
  ): Promise<void> => {
    // Guardrail: validar activeActor
    if (!validateActiveActor(activeActor)) {
      throw new Error('Nenhum ator ativo selecionado. Selecione um ator no menu superior.');
    }

    if (!activeActor) return;

    try {
      const newPost = await createSocialPost({
        content,
        actor_id: activeActor.actor_id, // Sempre usa activeActor
        media_ids: mediaIds,
        intent,
        intent_metadata: intentMetadata,
        targeting,
        cta: cta ? {
          type: cta.type,
          target_actor_id: cta.target_actor_id,
          target_group_id: cta.target_group_id,
          price: cta.price,
          currency: cta.currency || 'BRL',
        } : undefined,
        visibility,
        audience_relationship_types: audienceRelationshipTypes,
        audience_same_city: audienceSameCity,
      });
      
      // CORREÇÃO: usar função de atualização
      setPosts(prev => [newPost, ...prev]);
      
      // Marcar primeira ação como completa
      const { markFirstActionCompleted } = await import('./FirstActionHint');
      markFirstActionCompleted();
      
      // Disparar evento para atualizar progresso
      window.dispatchEvent(new CustomEvent('post-created'));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao criar post');
    }
  };

  const handleViewServices = () => {
    // Scroll suave até FeaturedToday ou primeira seção de serviços
    const featuredSection = document.getElementById('featured-today-section');
    if (featuredSection) {
      featuredSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll até primeiro post de serviço
      const firstServicePost = document.querySelector('.post-card--service');
      if (firstServicePost) {
        firstServicePost.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleFocusComposer = () => {
    // Focar no IntentComposer
    const composerContainer = document.getElementById('intent-composer');
    if (composerContainer) {
      composerContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        // Tentar focar no textarea ou input dentro do composer
        const textarea = composerContainer.querySelector('textarea') as HTMLTextAreaElement;
        const input = composerContainer.querySelector('input[type="text"]') as HTMLInputElement;
        const target = textarea || input;
        if (target) {
          target.focus();
        }
      }, 300);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      // Passar actor_id e actor_type para registrar impacto
      const queryParams = new URLSearchParams();
      if (activeActor) {
        queryParams.append('actor_id', activeActor.actor_id);
        queryParams.append('actor_type', activeActor.actor_type);
      }
      
      await toggleReaction(postId, reactionType as 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry', queryParams.toString());
      
      // Disparar evento de mudança de impacto se foi novo like
      if (activeActor) {
        const post = posts.find(p => p.post_id === postId);
        const wasLiked = post?.user_reaction === reactionType;
        if (!wasLiked) {
          // Novo like = impacto gerado
          window.dispatchEvent(new CustomEvent('impact-changed', {
            detail: {
              actor_id: activeActor.actor_id,
              actor_type: activeActor.actor_type,
            },
          }));
        }
      }
      
      // Atualiza post localmente usando função de atualização
      setPosts(prev => prev.map((post) => {
        if (post.post_id === postId) {
          const wasLiked = post.user_reaction === reactionType;
          return {
            ...post,
            user_reaction: wasLiked ? null : reactionType,
            reactions_count: wasLiked
              ? post.reactions_count - 1
              : post.reactions_count + (post.user_reaction ? 0 : 1),
          };
        }
        return post;
      }));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao reagir');
    }
  };

  const handleComment = async (postId: string, content: string) => {
    try {
      await createComment(postId, { content });
      
      // Atualiza contador de comentários usando função de atualização
      setPosts(prev => prev.map((post) => {
        if (post.post_id === postId) {
          return {
            ...post,
            comments_count: post.comments_count + 1,
          };
        }
        return post;
      }));
    } catch (err) {
      devLog.error('Erro ao comentar:', err);
      throw new Error(err instanceof Error ? err.message : 'Erro ao comentar');
    }
  };

  const handleCTAConfirmed = async () => {
    // Recarregar feed para atualizar impacto social
    await loadFeed();
    
    // Marcar primeira ação como completa
    const { markFirstActionCompleted } = await import('./FirstActionHint');
    markFirstActionCompleted();
    
    // Notificar ledger para recarregar
    window.dispatchEvent(new CustomEvent('cta-confirmed'));
  };

  const loadMore = () => {
    if (cursor && hasMore && !isLoading) {
      loadFeed(cursor);
    }
  };

  // Após bootstrap, activeActor nunca deve ser null
  // Se for null, significa que não há atores disponíveis - redirecionar
  useEffect(() => {
    if (!actorsLoading && !activeActor) {
      // 🔴 REGRA: Todas as empresas aparecem (can_post sempre true)
      const postableActors = actors;
      if (postableActors.length === 0) {
        navigate('/perfil');
      } else {
        // Múltiplos atores sem seleção - redirecionar para dashboard
        navigate('/dashboard');
      }
    }
  }, [activeActor, actors, actorsLoading, navigate]);

  // Não renderizar feed se não houver ator ativo (após bootstrap)
  if (!activeActor) {
    return null; // Redirecionamento em andamento
  }

  const modeLabel = activeActor.actor_type === 'user' 
    ? 'Modo Pessoa Física' 
    : 'Modo Empresa';

  return (
    <div className="social-feed-2">
      <ActiveLocationManager
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onLocationChange={(next) => setActiveLocation(next)}
      />
      <div className="feed-layout">
        {/* Feed Central - Expandido */}
      <main className="feed-center">
        {/* Badge discreto do modo */}
        <div className="feed-mode-badge" id="feed-mode-badge">
          <span className="mode-badge-icon">
            {activeActor.actor_type === 'user' ? '👤' : '🏢'}
          </span>
          <span className="mode-badge-text">{modeLabel}</span>
        </div>

        {/* DECISION-0030 (F5): seletor de scope geográfico */}
        <FeedScopeSelector
          value={feedScope}
          onChange={setFeedScope}
          hasActiveLocation={activeLocation !== null}
          onActivateLocation={() => setLocationModalOpen(true)}
          disabled={isLoading}
        />

        {/* Saldo de Impacto */}
        <div id="impact-balance-badge">
          <ImpactBalanceBadge />
        </div>
        
        {showHighlights && (
          <>
            <OnboardingHighlight
              targetId="impact-balance-badge"
              message="Seu saldo de impacto aumenta com cada ação"
              position="right"
              delay={1000}
            />
          </>
        )}

        {/* First Action Hint */}
        <FirstActionHint
          onViewServices={handleViewServices}
          onCreatePost={handleFocusComposer}
        />

        {/* Personal Progress Card */}
        <PersonalProgressCard postsCount={posts.length} />

        {/* Community Activity Summary */}
        <CommunityActivitySummary />

        {/* Today For You */}
        <TodayForYou />

          {/* Em destaque hoje */}
          <div id="featured-today-section">
            <FeaturedToday 
              posts={posts} 
              culturalEvents={culturalEvents}
              onCTAConfirmed={handleCTAConfirmed}
            />
          </div>
          
          <div id="intent-composer-wrapper">
            <ConnectionRequests />
            <IntentComposer onSubmit={handleCreatePost} />
          </div>
          
          {isLoading && posts.length === 0 ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Carregando feed...</p>
            </div>
          ) : error && posts.length === 0 ? (
            <div className="error">
              <p>{error}</p>
              <button onClick={() => loadFeed()} className="retry-btn">
                Tentar novamente
              </button>
            </div>
          ) : (
            <div>
              {/* Smart Empty State - aparece quando não há conteúdo relevante */}
              <SmartEmptyState 
                posts={posts}
                culturalEvents={culturalEvents}
                standaloneEvents={events}
                isLoading={isLoading}
              />
              
              {posts.length === 0 ? (
                <div className="empty-state">
                  <p>{getEmptyStateText(activeActor, 'feed')}</p>
                </div>
              ) : (
            <div>
              <div className="posts-list">
                {/* FASE 16: Feed unificado - Posts e Eventos Culturais misturados */}
                {(() => {
                  // Criar array unificado de itens do feed
                  type FeedItem = 
                    | { type: 'post'; data: PostCardData }
                    | { type: 'cultural_event'; data: CulturalEvent }
                    | { type: 'standalone_event'; data: typeof events[0] };

                  const feedItems: FeedItem[] = [];

                  // Adicionar eventos culturais (prioridade visual - aparecem primeiro)
                  culturalEvents.forEach(event => {
                    if (event.status === 'PUBLISHED' || event.status === 'CONFIRMED') {
                      feedItems.push({ type: 'cultural_event', data: event });
                    }
                  });

                  // Adicionar posts do feed social
                  posts.forEach(post => {
                    feedItems.push({ type: 'post', data: post });
                  });

                  // Adicionar eventos standalone (legado)
                  events.forEach(event => {
                    feedItems.push({ type: 'standalone_event', data: event });
                  });

                  // Ordenar por relevância usando sistema de scoring
                  const sortedFeedItems = sortFeedByRelevance(feedItems as ScoringFeedItem[], {
                    userCity: userCity || null,
                    userRegion: null, // Pode ser adicionado no futuro
                  });

                  // Renderizar itens misturados (já ordenados por relevância)
                  return sortedFeedItems.map((item) => {
                    if (item.type === 'cultural_event') {
                      return (
                        <CulturalEventCard
                          key={`cultural-${item.data.id}`}
                          event={item.data}
                          onLike={async (eventId) => {
                            // FASE 16: Curtir evento cultural (gera impacto)
                            // TODO: Implementar endpoint de like para eventos culturais
                            console.log('Curtir evento cultural:', eventId);
                            // Disparar evento de impacto (quando implementado)
                            window.dispatchEvent(new CustomEvent('impact-changed', {
                              detail: { actor_id: activeActor.actor_id, actor_type: activeActor.actor_type }
                            }));
                          }}
                          onShare={async (eventId) => {
                            // FASE 16: Compartilhar evento (peso alto na priorização)
                            // TODO: Implementar compartilhamento de eventos culturais
                                devLog.log('Compartilhar evento cultural:', eventId);
                          }}
                          onViewDetails={(eventId) => {
                            // Navegar para detalhes do evento
                            navigate(`/cultural/events/${eventId}`);
                          }}
                          onCheckIn={async () => {
                            // FASE 17: Check-in realizado - recarregar feed para atualizar status
                            await loadFeed();
                            // Disparar evento de impacto
                            if (activeActor) {
                              window.dispatchEvent(new CustomEvent('impact-changed', {
                                detail: {
                                  actor_id: activeActor.actor_id,
                                  actor_type: activeActor.actor_type,
                                },
                              }));
                            }
                          }}
                        />
                      );
                    }

                    if (item.type === 'standalone_event') {
                      return (
                        <EventCard
                          key={`event-${item.data.eventId}`}
                          eventId={item.data.eventId}
                          title={item.data.title}
                          eventType={item.data.eventType}
                          cityId={item.data.cityId}
                          status={item.data.status}
                          ticketPrice={item.data.ticketPrice}
                          acceptsConsumption={item.data.acceptsConsumption}
                          onClick={() => {
                            navigate(`/events/${item.data.eventId}`);
                          }}
                        />
                      );
                    }

                    // Post normal
                    return (
                      <PostCard
                        key={item.data.post_id}
                        post={item.data}
                        onReaction={handleReaction}
                        onComment={handleComment}
                        onCTAConfirmed={handleCTAConfirmed}
                        onVote={async (postId: string, optionIndex: number) => {
                          try {
                            await vote(postId, String(optionIndex));
                            // Recarregar feed para atualizar resultados
                            await loadFeed();
                          } catch (err) {
                            throw new Error(err instanceof Error ? err.message : 'Erro ao votar');
                          }
                        }}
                      />
                    );
                  });
                })()}
              </div>
              
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="load-more-btn"
                >
                  {isLoading ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
              </div>
            )}
            </div>
          )}
        </main>

        {/* Coluna Direita - Widgets */}
        <aside className="feed-sidebar-right">
          {/* Bloco 1: Meu Saldo Disponível */}
          <div className="sidebar-section">
            <h3>Meu Saldo Disponível</h3>
            <div className="widget-content">
              {accountLoading ? (
                <div className="widget-loading">Carregando...</div>
              ) : myAccount ? (
                <div className="account-balance">
                  <div className="balance-amount">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: safeString(myAccount.currency, 'BRL'),
                    }).format(centsToReais(safeNumber(myAccount.balanceCents, 0)))}
                  </div>
                  <div className="account-status">
                    <span className={`status-badge status-${myAccount.status === 'active' ? 'active' : 'inactive'}`}>
                      {myAccount.status === 'active' ? 'Status: Ativo' : 'Status: Inativo'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="widget-empty">Saldo não disponível no momento</div>
              )}
            </div>
          </div>

          {/* Bloco 2: Sugestões de Comunidades */}
          <div className="sidebar-section">
            <h3>Sugestões Comunidade</h3>
            <div className="widget-content">
              {groupsLoading ? (
                <div className="widget-loading">Carregando...</div>
              ) : groupSuggestions.length > 0 ? (
                <ul className="group-suggestions-list">
                  {groupSuggestions.map((group) => (
                    <li
                      key={group.group_id}
                      className="group-suggestion-item"
                      onClick={() => navigate(`/groups/${group.group_id}`)}
                    >
                      {group.avatar_url && (
                        <img
                          src={group.avatar_url}
                          alt={safeString(group.name, 'Grupo')}
                          className="group-avatar"
                        />
                      )}
                      <div className="group-info">
                        <div className="group-name">• {safeString(group.name, 'Grupo')}</div>
                        {group.description && (
                          <div className="group-description">{safeString(group.description)}</div>
                        )}
                        {group.member_count !== undefined && (
                          <div className="group-members">
                            {safeNumber(group.member_count, 0)} membros
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="widget-empty">Nenhuma sugestão no momento</div>
              )}
            </div>
          </div>

          {/* Bloco 3: Economia Local / Fundo Regional */}
          <div className="sidebar-section">
            <h3>Economia Local</h3>
            <div className="widget-content">
              {fundLoading ? (
                <div className="widget-loading">Carregando...</div>
              ) : fundData ? (
                <div className="fund-info">
                  <div className="fund-balance">
                    <div className="fund-label">Fundo Regional</div>
                    <div className="fund-amount">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(safeNumber(fundData.summary?.currentBalance, 0))}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/fund')}
                    className="widget-link-button"
                  >
                    Visitar loja
                  </button>
                </div>
              ) : (
                <div className="widget-empty">Dados não disponíveis no momento</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}






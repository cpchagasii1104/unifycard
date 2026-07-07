// src/modules/social/social-2.0.service.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { bankSplitRepository } from '@modules/bank/bank-split.repository';
import { getLocalUserIdByGlobalUserId } from '@modules/identity/actor-ssot.service';
import { actorRepository } from './actor.repository';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { impactService } from './impact.service';
import { HttpError } from '@core/errors/http-error';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import type { PermissionKey } from '@core/authorization/permission-keys';

function tsIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5, fecha DT-SOCIAL-POST-VISIBILITY-NOT-
 * ENFORCED-ON-READ). Vocabulário GOVERNADO (CHECK físico `chk_posts_visibility`, migration
 * 20260705120000) — NÃO confundir com o `PostVisibility` fantasma de `social.types.ts` (schema
 * legado que não bate com a tabela viva). Fonte da plateia = `actor_relationships` (Fatia 1,
 * DESENHO §2.4c SELADO), não `follows`. 'group' fica fora (DT irmã, groups.visibility fantasma).
 */
export type PostAudienceVisibility = 'public' | 'connections' | 'only_me';
export const POST_AUDIENCE_VISIBILITY_VALUES: readonly PostAudienceVisibility[] = ['public', 'connections', 'only_me'];

/**
 * Predicado SQL de plateia — REUSADO por getFeed/getActorPosts (nunca duplicar a lógica).
 * `viewerParam` é o placeholder JÁ vinculado (ex.: '$2') do actor que está LENDO, resolvido
 * SERVER-SIDE pelo caller (nunca client-declared cru — DECISION-0113). Semântica:
 *   public      → sempre visível;
 *   dono do post → sempre visível a si mesmo (cobre 'only_me' e 'connections' do próprio autor);
 *   connections → visível se houver aresta actor_relationships ACEITA com o autor (qualquer label).
 */
function postVisibilitySql(postAlias: string, viewerParam: string): string {
  // DECISION-0162 (refinamento por tipo de relação): quando audience_relationship_types
  // NÃO é NULL, além da aresta aceita exige-se que a ÓTICA DO AUTOR sobre o leitor
  // (requester_label se o autor enviou; target_label se o autor aceitou) ∈ refinamento.
  // "Post pra familiares" = quem O AUTOR classificou como familiar.
  return `(
    ${postAlias}.visibility = 'public'
    OR ${postAlias}.actor_id = ${viewerParam}
    OR (
      ${postAlias}.visibility = 'connections'
      AND ${viewerParam}::uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM actor_relationships ar
        WHERE ar.tenant_id = ${postAlias}.tenant_id
          AND ar.status = 'accepted'
          AND (
            (ar.from_actor_id = ${postAlias}.actor_id AND ar.to_actor_id = ${viewerParam})
            OR (ar.from_actor_id = ${viewerParam} AND ar.to_actor_id = ${postAlias}.actor_id)
          )
          AND (
            ${postAlias}.audience_relationship_types IS NULL
            OR (
              CASE WHEN ar.from_actor_id = ${postAlias}.actor_id
                   THEN ar.requester_label ELSE ar.target_label END
            ) = ANY(${postAlias}.audience_relationship_types)
          )
      )
    )
  )`;
}

export interface PostWithActor {
  post_id: string;
  tenant_id: string;
  actor_id: string | null;
  /** @deprecated Coluna não existe em posts (schema canônico usa actor_id). Campo será removido quando createPost (Fatia B) convergir; getFeed/getActorPosts já não preenchem. */
  global_user_id?: string;
  content: string;
  media: any[];
  /** F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5) — plateia GOVERNADA e OBEDECIDA na leitura. */
  visibility?: PostAudienceVisibility;
  intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  intent_metadata?: Record<string, any>;
  targeting?: {
    demographics?: {
      age_range?: [number, number];
      gender?: ('male' | 'female' | 'other')[];
    };
    lifestyle?: {
      drinks?: boolean;
      smokes?: boolean;
    };
    mobility?: {
      has_car?: boolean;
      uses_bike?: boolean;
      uses_skate?: boolean;
    };
    interests?: string[];
    professions?: string[];
    locations?: {
      radius_km?: number;
      city_id?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
  actor: {
    actor_id: string;
    actor_type: string;
    display_name: string;
    avatar_url: string | null;
    cover_url?: string | null;
  };
  reactions_count: number;
  comments_count: number;
  user_reaction: string | null;
  relevance_score?: number; // Score de relevância baseado em Raio-X
  cta?: {
    cta_id: string;
    cta_type: 'booking' | 'service' | 'payment';
    target_actor_id: string | null;
    target_group_id: string | null;
    price: number | null;
    currency: string;
  };
  social_impact?: {
    group_name: string | null;
    total_impact_cents: number; // Em centavos (integer)
  };
  vote_results?: {
    options: Array<{ index: number; text: string; count: number; percentage: number }>;
    total_votes: number;
    closesAt?: string;
  };
  linked_event?: {
    id: string;
    title: string;
    datetime_start: string;
    location_cultural_profile_id: string | null;
    shared_by: string;
  };
}

export interface FeedResponse {
  posts: PostWithActor[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ReactionResponse {
  reaction_id: string;
  reaction_type: string;
  createdAt: string;
  is_new: boolean;
}

export interface CommentResponse {
  comment_id: string;
  post_id: string;
  /** @deprecated Coluna não existe em comments (schema canônico usa actor_id). Campo será removido quando getComments (Fatia C) convergir; createComment já não preenche. */
  global_user_id?: string;
  content: string;
  parent_comment_id: string | null;
  createdAt: string;
  actor: {
    actor_id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export class Social2Service {
  /**
   * 🔴 F-SOCIAL-POST-INTENT-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. canRepresentActor (na rota) DECIDE
   * permissão de publicar como o author; quarentena DECIDE se o actor está ATIVO. Intent é SEMÂNTICA da ação
   * (pode gerar effect/CTA/promessa social) — actor bloqueado não publica. Recebe actorId JÁ RESOLVIDO server-side
   * (author OU acting/createdAs), NUNCA userId cru/actionContext cru/referral. Chamar ANTES da 1ª escrita (post/
   * effect/outbox) e da validação de intent. NÃO toca canRepresentActor (que segue puro). 403 ACTOR_EFFECTIVELY_BLOCKED.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw HttpError.forbidden(
        'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — publicação de post/intent bloqueada (§4.8.4).'
      );
    }
  }

  /**
   * Busca feed com cursor pagination (prioriza posts conforme modo de atuação)
   * REGRA: actor_type é OBRIGATÓRIO - não existe feed genérico
   * @param actorType 'user' = Pessoa Física, 'page' = Pessoa Jurídica (OBRIGATÓRIO)
   * @param actorId ID do ator ativo (opcional, usado para seguir)
   * @param actorStatus Status da empresa (PROVISIONAL, VERIFIED, etc) - usado para aplicar limites
   */
  async getFeed(
    tenantId: string,
    globalUserId: string,
    cursor: string | undefined,
    limit: number,
    actorType: 'user' | 'page', // OBRIGATÓRIO - sem default
    actorId?: string,
    actorStatus?: string,
    userPreferences?: { // NOVO: Preferências do usuário (tags: rock, eletrônica, etc.)
      music_genres?: string[];
      event_types?: string[];
    },
    userLocation?: { // NOVO: Localização do usuário
      lat: number;
      lng: number;
    },
    groupId?: string, // NOVO: ID do grupo para filtrar posts (opcional)
    // DECISION-0030 (F3): filtro de proximidade por scope (radius_km/city/state/unlimited)
    proximityFilter?: import('@core/location/feed-proximity.types').FeedProximityFilterInput
  ): Promise<FeedResponse> {
    // Usar actor_id fornecido ou buscar actor padrão do usuário
    let currentActorId: string | null = actorId || null;
    let user: { user_id: string } | undefined = undefined;
    
    if (!currentActorId) {
      // Busca actor do usuário atual (fallback)
      // Nota: globalUserId ainda é usado aqui temporariamente para compatibilidade
      // mas será removido em refatoração futura
      const uid = await getLocalUserIdByGlobalUserId(tenantId, globalUserId);
      if (uid) {
        user = { user_id: uid };
        const actor = await ensureUserActor(tenantId, uid);
        currentActorId = actor.actor_id;
      }
    } else {
      // Buscar user_id mesmo quando currentActorId já existe, para usar no cálculo de relevância
      const uid2 = await getLocalUserIdByGlobalUserId(tenantId, globalUserId);
      if (uid2) {
        user = { user_id: uid2 };
      }
    }

    // Query convergida com schema canônico — fecha DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH.
    // DECISION-0031: reactions polimórfico (entity_type/entity_id/actor_id).
    // DECISION-0032-social: post_cta PREMATURO — JOIN e 6 campos cta removidos.
    // DECISION-0033: alias `id AS post_id` preserva contrato externo (frontend tem 65 callers de Post.post_id).
    // #4 media: opção (c) — array vazio até DT-FEED-MEDIA-HIDRATATION-PENDING resolver hidratação.
    // $2 = currentActorId (pode ser null; `WHERE actor_id = NULL` devolve 0 rows = sem user_reaction).
    let query = `
      SELECT
        p.id AS post_id,
        p.tenant_id,
        p.actor_id,
        p.content,
        '[]'::jsonb AS media,
        p.intent,
        p.visibility,
        NULL::jsonb as intent_metadata,
        NULL::jsonb as targeting,
        p.created_at,
        p.updated_at,
        COALESCE(a.id, NULL::uuid) as actor_actor_id,
        a.actor_type,
        a.display_name,
        a.avatar_url,
        a.cover_url,
        COALESCE((
          SELECT COUNT(*)::int
          FROM reactions r
          WHERE r.entity_type = 'post' AND r.entity_id = p.id
        ), 0) as reactions_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.id AND c.is_deleted = false
        ), 0) as comments_count,
        (
          SELECT r.reaction_type
          FROM reactions r
          WHERE r.entity_type = 'post' AND r.entity_id = p.id AND r.actor_id = $2
          LIMIT 1
        ) as user_reaction,
        CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_followed,
        NULL::text as group_name,
        0::bigint AS total_impact_cents
      FROM posts p
      LEFT JOIN actors a ON p.actor_id = a.id
      -- FASE 3.6: groups table não existe ainda, então group_name é NULL por enquanto
    `;

    const params: any[] = [tenantId, currentActorId];
    let paramIndex = 3;

    // JOIN follows usa $2 (currentActorId) direto; sem actor, ON é trivialmente false.
    if (currentActorId) {
      query += ` LEFT JOIN follows f ON f.followed_actor_id = p.actor_id AND f.follower_actor_id = $2`;
    } else {
      query += ` LEFT JOIN follows f ON false`;
    }

    query += ` WHERE p.tenant_id = $1`;

    // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5, fecha DT-SOCIAL-POST-VISIBILITY-NOT-
    // ENFORCED-ON-READ): a plateia declarada na escrita agora É OBEDECIDA na leitura. $2 =
    // currentActorId, JÁ resolvido server-side acima (nunca client-declared cru).
    query += ` AND ${postVisibilitySql('p', '$2')}`;

    // FILTRO POR GRUPO: Quando groupId é fornecido, retornar apenas posts do grupo
    // 🔴 VALIDAÇÃO: Verificar se usuário é membro do grupo (se grupo não for público)
    if (groupId) {
      query += ` AND p.metadata->>'groupId' = $${paramIndex}`;
      params.push(groupId);
      paramIndex++;
      
      // Validar membership para grupos privados/secretos
      // Grupos públicos podem ser visualizados por qualquer um
      const { groupsRepository } = await import('../groups/groups.repository');
      const group = await groupsRepository.findById(tenantId, groupId);
      if (group && group.visibility !== 'public') {
        // Verificar se usuário é membro
        const members = await groupsRepository.getMembers(tenantId, groupId);
        const isMember = members.some(m => m.userId === globalUserId);
        if (!isMember) {
          throw new Error('User is not a member of this group');
        }
      }
    } else {
      // 🔴 FILTRO DE GRUPOS NO FEED GLOBAL: Incluir post sem grupo OU de grupo ativo.
      // Schema canônico vigente (20260530180000_groups.sql): groups.id (PK), groups.status.
      // `visibility public/private/secret` é semântica aspiracional sem coluna materializada
      // — DT-PRESSURE-GROUPS-VISIBILITY-FANTASMA. Filtro defensivo via status='active'.
      query += ` AND (
        p.metadata->>'groupId' IS NULL
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id::text = p.metadata->>'groupId'
            AND g.tenant_id = p.tenant_id
            AND g.status = 'active'
        )
      )`;
    }

    // DECISION-0030 (F3): filtro de proximidade por scope/value
    // Resolução server-side (princípio "Frontend nunca cria verdade") via feed-proximity.service.
    // Só aplica quando há actor resolvido (currentActorId) — sem actor não há de quem buscar localização ativa.
    if (proximityFilter && currentActorId) {
      const { feedProximityService } = await import('@core/location/feed-proximity.service');
      const resolved = await feedProximityService.resolveFilter(
        tenantId,
        currentActorId,
        proximityFilter,
        paramIndex - 1 // resolveFilter usa offset+1, +2, ... ; offset = paramIndex - 1 alinha
      );
      query += ` AND (${resolved.sqlFragment})`;
      params.push(...resolved.params);
      paramIndex += resolved.params.length;
    }

    if (cursor) {
      query += ` AND p.created_at < (SELECT created_at FROM posts WHERE id = $${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    // Buscar mais posts para permitir ranking por relevância
    // Ordenação final será feita após cálculo de relevância
    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex}`;
    params.push(Math.min(limit * 3, 100)); // Busca 3x o limite para ter opções de ranking

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);

    const postIds = rows.map((r: { post_id: string }) => r.post_id).filter(Boolean);
    const impactMap = await bankSplitRepository.sumImpactCentsByTransactionReferenceIds(
      tenantId,
      postIds
    );
    for (const r of rows) {
      r.total_impact_cents = impactMap.get(r.post_id) ?? 0;
    }

    // Buscar perfil CORE do usuário para calcular relevância
    let userCoreProfile: any = null;
    let userAge: number | undefined = undefined;
    try {
      const { coreService } = await import('@core/core.service');
      if (user) {
        userCoreProfile = await coreService.getCompleteProfile(tenantId, user.user_id);
        // Calcular idade se houver birthdate
        if (userCoreProfile?.personal_profile?.metadata?.birthdate) {
          const birthdate = new Date(userCoreProfile.personal_profile.metadata.birthdate);
          const today = new Date();
          userAge = today.getFullYear() - birthdate.getFullYear();
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar CORE profile para targeting (não crítico):', err);
    }

    // Calcular relevância e mapear posts
    const { socialTargetingService } = await import('./social-targeting.service');
    const { socialVotesService } = await import('./social-votes.service');
    
    /**
     * Calcula distância entre duas coordenadas (Haversine)
     */
    const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Raio da Terra em km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    /**
     * Calcula peso de prioridade baseado no modo de atuação (PF vs PJ)
     * MODELO OFICIAL DE PESOS - FASE 8 + EVENTOS ÂNCORA
     * 
     * 👤 MODO PESSOA FÍSICA: Prioriza pertencimento, conversa, comunidade
     * 🏢 MODO PESSOA JURÍDICA: Prioriza propósito, impacto, estrutura
     */
    const calculateContentWeight = (row: any, mode: 'user' | 'page', userPreferences?: any, userLocation?: any): number => {
      const actorType = row.actor_type; // Tipo do autor do post
      const intent = row.intent || 'personal';
      const metadata = row.metadata || {};
      let baseWeight = 0;
      
      // EVENTOS COMO PRIMEIRO CIDADÃO - Prioridade máxima para eventos culturais
      // Verificar se post está vinculado a evento cultural (via metadata ou event_id)
      // DEFENSIVE: row.event_id pode não existir se coluna não foi criada
      const eventId = (row as any).event_id;
      if (metadata.cultural_event_id || eventId) {
        baseWeight = 150; // Peso máximo - eventos sempre primeiro
        
        // BONUS POR PREFERÊNCIAS (não filtra, apenas reordena)
        if (userPreferences) {
          const eventType = metadata.event_type || metadata.cultural_event_type;
          if (eventType && userPreferences.event_types?.includes(eventType)) {
            baseWeight += 20; // Match de tipo de evento
          }
        }
        
        // BONUS POR GEOLOCALIZAÇÃO (não filtra, apenas reordena)
        if (userLocation && metadata.event_location) {
          const eventLat = metadata.event_location.lat;
          const eventLng = metadata.event_location.lng;
          if (eventLat && eventLng) {
            const distance = calculateHaversineDistance(
              userLocation.lat, userLocation.lng,
              eventLat, eventLng
            );
            if (distance < 5) {
              baseWeight += 50; // < 5km = muito próximo
            } else if (distance < 20) {
              baseWeight += 30; // < 20km = próximo
            }
          }
        }
        
        return baseWeight;
      }
      
      // Posts relacionados a eventos (compartilhamentos) = 120
      // eventId já foi declarado acima na linha 284
      if (metadata.event_id || eventId || intent === 'event') {
        baseWeight = 120;
        
        // Aplicar mesmos bônus de preferências e geo se disponível
        if (userPreferences && metadata.event_type && userPreferences.event_types?.includes(metadata.event_type)) {
          baseWeight += 20;
        }
        
        if (userLocation && metadata.event_location) {
          const eventLat = metadata.event_location.lat;
          const eventLng = metadata.event_location.lng;
          if (eventLat && eventLng) {
            const distance = calculateHaversineDistance(
              userLocation.lat, userLocation.lng,
              eventLat, eventLng
            );
            if (distance < 5) {
              baseWeight += 50;
            } else if (distance < 20) {
              baseWeight += 30;
            }
          }
        }
        
        return baseWeight;
      }
      
      if (mode === 'user') {
        // 👤 MODO PESSOA FÍSICA
        // 1. Post de Pessoa = 100 (prioridade máxima)
        if (actorType === 'user') {
          return 100;
        }
        
        // 2. Post em Grupo Comunitário = 90
        // (Identificado por target_group_id ou metadata de grupo)
        if (row.target_group_id) {
          return 90;
        }
        
        // 3. Evento / Ação Social = 80 (já coberto acima, mas mantido para compatibilidade)
        if (intent === 'event') {
          return 80;
        }
        
        // 4. Post de Empresa = 40
        if (actorType === 'page') {
          return 40;
        }
        
        // 5. Conteúdo Institucional = 30
        if (intent === 'service_offer' || intent === 'product_offer' || intent === 'project') {
          return 30;
        }
        
        // Default para PF = 20
        return 20;
      } else {
        // 🏢 MODO PESSOA JURÍDICA
        // 1. Projeto / Iniciativa = 100 (prioridade máxima)
        // (Eventos culturais já têm peso 150 acima, então vêm antes)
        if (intent === 'project') {
          return 100;
        }
        
        // 2. Post Institucional = 90
        if (actorType === 'page') {
          return 90;
        }
        
        // 3. Grupo Institucional = 80
        if (row.target_group_id) {
          return 80;
        }
        
        // 4. Resultado / Impacto = 70
        // (Posts com social_impact ou resultados de ações)
        if (row.total_impact_cents > 0) {
          return 70;
        }
        
        // Votações também = 70 (empresas podem votar)
        if (intent === 'vote') {
          return 70;
        }
        
        // 5. Post de Pessoa = 30
        if (actorType === 'user') {
          return 30;
        }
        
        // Default para PJ = 30
        return 30;
      }
    };
    
    // Frequência POR CONEXÃO (ideia Clayton 2026-07-07): a MINHA preferência explícita na aresta
    // vira fator DETERMINÍSTICO do ranking — camada soberana do usuário, acima dos pesos
    // automáticos. COMPÕE do vocabulário GOVERNADO (FEED_PRIORITIES) via reader do módulo dono.
    const { FEED_PRIORITIES } = await import('../relationships/actor-relationship.types');
    type FeedPriorityValue = (typeof FEED_PRIORITIES)[number];
    const [FP_PADRAO, FP_VER_PRIMEIRO, FP_VER_MAIS, FP_VER_MENOS] = FEED_PRIORITIES;
    let feedPriorityMap = new Map<string, FeedPriorityValue>();
    if (currentActorId) {
      try {
        const { actorRelationshipRepository } = await import('../relationships/actor-relationship.repository');
        feedPriorityMap = await actorRelationshipRepository.mapMyFeedPriorities(tenantId, currentActorId);
      } catch (err) {
        console.warn('Feed priority map indisponível (não crítico):', err);
      }
    }

    // Calcular scores de relevância para todos os posts
    const postsWithScores = await Promise.all(rows.map(async (row) => {
      const targeting = null; // FASE 3.6: targeting não existe na tabela posts ainda
      const baseRelevanceScore = userCoreProfile
        ? socialTargetingService.calculateRelevanceScore(
            targeting,
            userCoreProfile,
            row.is_followed || false,
            userAge
          )
        : { score: 50, breakdown: {} };
      
      // Calcular peso baseado no modo de atuação (FASE 8 + EVENTOS ÂNCORA)
      const contentWeight = calculateContentWeight(row, actorType, userPreferences, userLocation);
      
      // SPRINT 66: Combinar peso do conteúdo com score de relevância base
      // Peso do conteúdo tem prioridade dominante (80%) + relevância base (20%)
      // Isso garante que o modo de atuação realmente governa a ordem do feed
      const contentWeightPercent = 0.8;
      const baseRelevancePercent = 0.2;
      let weightedScore = (contentWeight * contentWeightPercent) + (baseRelevanceScore.score * baseRelevancePercent);

      // Preferência explícita POR CONEXÃO (dual-ótica; só a MINHA afeta o MEU feed):
      //   ver_primeiro → +1000 (fixa no topo) · ver_mais → ×1.5 · ver_menos → ×0.25
      const connectionFeedPriority = (row.actor_id && feedPriorityMap.get(row.actor_id)) || FP_PADRAO;
      if (connectionFeedPriority === FP_VER_PRIMEIRO) weightedScore = weightedScore + 1000;
      else if (connectionFeedPriority === FP_VER_MAIS) weightedScore = weightedScore * 1.5;
      else if (connectionFeedPriority === FP_VER_MENOS) weightedScore = weightedScore * 0.25;
      
      // SPRINT 66: Breakdown completo e explicável
      const relevanceScore = {
        // 0-100 normal; 'ver_primeiro' passa por cima do teto de propósito (pin determinístico)
        score: connectionFeedPriority === FP_VER_PRIMEIRO
          ? Math.max(0, weightedScore)
          : Math.min(100, Math.max(0, weightedScore)),
        breakdown: {
          connectionFeedPriority: connectionFeedPriority !== FP_PADRAO ? {
            value: connectionFeedPriority,
            explanation: 'Preferência explícita do leitor para esta conexão (actor_relationships)',
          } : undefined,
          contentWeight: {
            valueCents: contentWeight,
            weight: contentWeightPercent,
            contribution: contentWeight * contentWeightPercent,
            explanation: `Peso do conteúdo baseado no modo de atuação (${actorType})`,
          },
          baseRelevance: {
            valueCents: baseRelevanceScore.score,
            weight: baseRelevancePercent,
            contribution: baseRelevanceScore.score * baseRelevancePercent,
            explanation: `Score de relevância base (targeting + perfil)`,
            factors: baseRelevanceScore.breakdown || {},
          },
          finalScore: weightedScore,
          explanation: `Score final: ${contentWeight} (${(contentWeightPercent * 100).toFixed(0)}%) + ${baseRelevanceScore.score} (${(baseRelevancePercent * 100).toFixed(0)}%) = ${weightedScore.toFixed(2)}`,
        },
      };

      // Buscar resultados de votação se o post for do tipo 'vote'
      let voteResults = undefined;
      if (row.intent === 'vote') {
        try {
          voteResults = await socialVotesService.getVoteResults(tenantId, row.post_id);
        } catch (err) {
          console.warn('Erro ao buscar resultados de votação (não crítico):', err);
        }
      }

      // EVENTOS COMO ÂNCORA: Buscar evento vinculado se post compartilha evento
      let linkedEvent = undefined;
      const postMetadata = row.metadata || {};
      // DEFENSIVE: row.event_id pode não existir se coluna não foi criada
      const eventIdFromRow = (row as any).event_id;
      if (postMetadata.cultural_event_id || eventIdFromRow) {
        try {
          const { culturalEventService } = await import('../cultural/cultural-event.service');
          const eventId = postMetadata.cultural_event_id || eventIdFromRow;
          const event = await culturalEventService.getEvent(tenantId, eventId);
          if (event) {
            linkedEvent = {
              id: event.id,
              title: event.title,
              datetime_start: event.datetime_start,
              location_cultural_profile_id: event.location_cultural_profile_id,
              shared_by: row.display_name, // Nome do ator que compartilhou
            };
          }
        } catch (err) {
          console.warn('Erro ao buscar evento vinculado (não crítico):', err);
        }
      }

      return {
        post_id: row.post_id,
        tenant_id: row.tenant_id,
        actor_id: row.actor_id,
        global_user_id: row.global_user_id,
        content: row.content,
        media: row.media || [],
        visibility: row.visibility || 'public',
        intent: row.intent || 'personal',
        intent_metadata: undefined, // FASE 3.6: intent_metadata não existe na tabela posts ainda
        targeting: targeting || undefined, // FASE 3.6: targeting não existe na tabela posts ainda
        createdAt: tsIso(row.created_at),
        updatedAt: tsIso(row.updated_at),
        actor: row.actor_actor_id
          ? {
              actor_id: row.actor_actor_id,
              actor_type: row.actor_type,
              display_name: row.display_name,
              avatar_url: row.avatar_url,
              cover_url: row.cover_url,
            }
          : {
              actor_id: '',
              actor_type: 'user',
              display_name: 'Usuário',
              avatar_url: null,
              cover_url: null,
            },
        reactions_count: row.reactions_count || 0,
        comments_count: row.comments_count || 0,
        user_reaction: row.user_reaction || null,
        relevance_score: relevanceScore.score,
        is_followed: row.is_followed || false,
        cta: row.cta_id
          ? {
              cta_id: row.cta_id,
              cta_type: row.cta_type as 'booking' | 'service' | 'payment',
              target_actor_id: row.target_actor_id,
              target_group_id: row.target_group_id,
              price: row.price ? parseFloat(row.price.toString()) : null,
              currency: row.currency || 'BRL',
            }
          : undefined,
        social_impact:
          row.total_impact_cents > 0
            ? {
                group_name: row.group_name,
                total_impact_cents: parseInt(row.total_impact_cents.toString(), 10),
              }
            : undefined,
        vote_results: voteResults ? {
          options: voteResults.options,
          total_votes: voteResults.total_votes,
          closesAt: voteResults.closesAt,
        } : undefined,
        linked_event: linkedEvent,
      };
    }));

    // Ordenar por relevância (mantendo 20% discovery)
    const rankedPosts = socialTargetingService.rankPosts(postsWithScores, 20);

    const hasMore = rankedPosts.length > limit;
    const posts = hasMore ? rankedPosts.slice(0, limit) : rankedPosts;

    // SPRINT 66: Incluir breakdown de relevância no response (não remover)
    const cleanPosts = posts.map((p) => {
      const { is_followed, ...rest } = p;
      // Manter relevanceScore com breakdown completo
      return rest;
    });

    return {
      posts: cleanPosts as PostWithActor[],
      next_cursor: hasMore && cleanPosts.length > 0 ? (cleanPosts[cleanPosts.length - 1] as any).post_id : null,
      has_more: hasMore,
    };
  }

  /**
   * Cria um novo post (com CTA opcional)
   */
  async createPost(
    tenantId: string,
    userId: string,
    content: string,
    actorId: string | undefined,
    mediaIds: string[],
    intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event',
    intentMetadata?: Record<string, any>,
    targeting?: {
      demographics?: { age_range?: [number, number]; gender?: ('male' | 'female' | 'other')[] };
      lifestyle?: { drinks?: boolean; smokes?: boolean };
      mobility?: { has_car?: boolean; uses_bike?: boolean; uses_skate?: boolean };
      interests?: string[];
      professions?: string[];
      locations?: { radius_km?: number; city_id?: string };
    },
    cta?: {
      type?: 'booking' | 'service' | 'payment';
      target_actor_id?: string;
      target_group_id?: string;
      price?: number;
      currency?: string;
      metadata?: Record<string, any>;
    },
    groupId?: string, // ID do grupo para vincular o post
    createdByUserId?: string, // CONTINUOUS PRODUCTION: Audit field
    createdAsActorId?: string, // CONTINUOUS PRODUCTION: Audit field
    visibility?: PostAudienceVisibility, // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5)
    audienceRelationshipTypes?: string[] // DECISION-0162: refinamento OPCIONAL (⊆ vocabulário typed-edge)
  ): Promise<PostWithActor> {
    // Vocabulário GOVERNADO fail-closed (Lei §8) — já validado por zod na rota (defense-in-depth
    // aqui, mesmo padrão de assertLabelAllowedForPair na Fatia 1). Nunca coage silenciosamente.
    const resolvedVisibility: PostAudienceVisibility =
      visibility && POST_AUDIENCE_VISIBILITY_VALUES.includes(visibility) ? visibility : 'public';
    if (visibility && !POST_AUDIENCE_VISIBILITY_VALUES.includes(visibility)) {
      throw HttpError.badRequest(`Plateia inválida: '${visibility}' fora do vocabulário governado (public/connections/only_me)`);
    }
    // DECISION-0162: refinamento só faz sentido SOBRE 'connections'; valores ⊆ vocabulário
    // GOVERNADO do typed-edge (mesma fonte do CHECK chk_posts_audience_relationship_types).
    let resolvedAudienceTypes: string[] | null = null;
    if (audienceRelationshipTypes !== undefined && audienceRelationshipTypes !== null) {
      const { RELATIONSHIP_LABELS } = await import('../relationships/actor-relationship.types');
      if (!Array.isArray(audienceRelationshipTypes)
          || audienceRelationshipTypes.some((t) => !(RELATIONSHIP_LABELS as readonly string[]).includes(t))) {
        throw HttpError.badRequest('Refinamento de plateia fora do vocabulário governado (typed-edge)');
      }
      if (audienceRelationshipTypes.length > 0 && resolvedVisibility !== 'connections') {
        throw HttpError.badRequest("Refinamento de plateia exige visibility='connections'");
      }
      resolvedAudienceTypes = audienceRelationshipTypes.length > 0 ? audienceRelationshipTypes : null;
    }
    // Busca ou cria actor
    let actor;
    let companyStatus: string | null = null;
    
    if (actorId) {
      actor = await actorRepository.findById(tenantId, actorId);
      if (!actor) {
        throw new Error('Actor não encontrado');
      }
      
      // Se for empresa (page), buscar status
      if (actor.actor_type === 'page' && actor.company_id) {
        const company = await runQueryWithTenant<{ company_status: string }>(
          tenantId,
          `
          SELECT company_status FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          LIMIT 1
          `,
          [actor.company_id, tenantId]
        );
        companyStatus = company?.company_status || null;
      }
    } else {
      actor = await ensureUserActor(tenantId, userId);
    }

    // 🔴 F-SOCIAL-POST-INTENT-QUARANTINE-GATE: author (actor.actor_id) bloqueado → não publica post/intent em seu
    // nome; e o acting/createdAs bloqueado → não opera. ANTES da validação de intent e de QUALQUER escrita/effect.
    await this.assertActorNotQuarantined(tenantId, actor.actor_id);
    if (createdAsActorId && createdAsActorId !== actor.actor_id) {
      await this.assertActorNotQuarantined(tenantId, createdAsActorId);
    }

    // 🔴 BLINDAGEM: Validar Intent em um único lugar centralizado
    // Nenhuma rota deve validar intent manualmente
    // Intent: o "por quê" da ação, o significado do evento
    // UI NÃO decide intent - intent é semântica explícita
    // Payload NÃO define semântica - intent define semântica
    const { actorIntentsService } = await import('./actor-intents.service');
    const intentValidation = await actorIntentsService.validateIntent(
      tenantId,
      actor.actor_id,
      intent,
      companyStatus || undefined,
      userId
    );

    if (!intentValidation.valid) {
      const { HttpError } = await import('@core/errors/http-error');
      throw HttpError.forbidden(
        intentValidation.reason || `Invalid intent: ${intent}`
      );
    }

    // 🔴 BLINDAGEM: permissão via authority.service (fachada modules — §4.9)
    // reputationService.getPermissions() retorna apenas MÉTRICAS/INPUT, não decisão
    const { authorityService } = await import('@modules/authority/authority.service');
    const auth = await authorityService.canPerformAction(
      actor.actor_id,
      'publish_feed',
      undefined,
      { tenantId, userId }
    );
    if (!auth.allowed) {
      throw HttpError.forbidden(
        auth.reason || 'Você não tem permissão para publicar no feed. Complete a verificação da empresa para habilitar postagens.'
      );
    }

    // DECISION-0094 Fase Social Gate 1: page-actor/PJ só publica feed se KYB approved.
    // O canActAs (acima) é delegation-only e NÃO é KYB-aware — este gate fecha o broadcast
    // público de PJ não-verificada. Fonte única = fiscal_identities.kyb_status (server-side,
    // fail-closed). NUNCA company_status/is_verified. PF/user inalterado.
    if (actor.actor_type === 'page') {
      const { isPageActorKybApproved, PJ_KYB_SOCIAL_BLOCK_MESSAGE } = await import('./pj-kyb-gate');
      const kybApproved = await isPageActorKybApproved(tenantId, actor.actor_id);
      if (!kybApproved) {
        throw HttpError.forbidden(PJ_KYB_SOCIAL_BLOCK_MESSAGE);
      }
    }

    // Preparar metadata com groupId e audit fields
    const metadata: Record<string, any> = {};
    if (groupId) {
      metadata.groupId = groupId;
    }
    
    // CONTINUOUS PRODUCTION: Adicionar campos de audit
    // Usar parâmetros se fornecidos, senão usar userId e actorId como fallback
    metadata.created_by_user_id = createdByUserId || userId;
    metadata.created_as_actor_id = createdAsActorId || actor.actor_id;

    // INSERT canônico convergido (DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH).
    // DECISION-0033: mídia embedded via posts.media_ids UUID[] (sem tabela paralela post_media);
    //   alias `id AS post_id` preserva contrato externo (frontend espera Post.post_id).
    // global_user_id removido da coluna list (coluna não existe em posts; identidade soberana
    //   é actor_id por §3.2 / DECISION-0031).
    const post = await runQueryWithTenant<{
      post_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      tenantId,
      `
      INSERT INTO posts (
        tenant_id, actor_id, content, media_ids, intent, intent_metadata, targeting, metadata, visibility,
        audience_relationship_types
      )
      VALUES ($1, $2, $3, $4::uuid[], $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::text[])
      RETURNING id AS post_id, created_at, updated_at
      `,
      [
        tenantId,
        actor.actor_id,
        content,
        mediaIds,
        intent || 'personal',
        JSON.stringify(intentMetadata || {}),
        JSON.stringify(targeting || {}),
        JSON.stringify(metadata),
        resolvedVisibility,
        resolvedAudienceTypes,
      ]
    );

    // Validação explícita: post é obrigatório após INSERT
    if (!post) {
      throw new Error('Erro ao criar post: registro não foi retornado pelo banco de dados');
    }

    // Após validação, TypeScript sabe que post não é undefined
    const safePost = post;

    // post_media (UPDATE) removido — DECISION-0033: mídia já gravada no INSERT acima via
    // posts.media_ids UUID[]; tabela post_media é FANTASMA (modelo legacy substituído).

    // post_projects (INSERT) removido — DECISION-0034: post_projects PREMATURO (feature
    // aspiracional sem ecossistema runtime; tabela não materializada em migrations vivas).

    // post_cta (INSERT + variável createdCta) removido — DECISION-0032-social: post_cta
    // PREMATURO (tabela fantasma; campo `cta` do return permanece undefined, frontend tolera
    // via optional chaining `post.cta?.X`).

    // 🔴 BLINDAGEM: Emitir effects centralizadamente
    // Effects são consequências sistêmicas, não decisões humanas
    // Service NÃO decide efeito - effect é definido pelo contrato
    // Chamado APENAS após validateIntent
    if (intent) {
      const { actorIntentsService } = await import('./actor-intents.service');
      const { actorEffectsService } = await import('./actor-effects.service');
      const normalizedIntent = actorIntentsService.normalizeIntent(intent);
      
      if (normalizedIntent) {
        try {
          await actorEffectsService.emitEffects(
            tenantId,
            actor.actor_id,
            normalizedIntent,
            {
              sourceId: safePost.post_id,
              sourceType: 'post',
              metadata: {
                intent_metadata: intentMetadata,
                targeting,
                media_count: mediaIds?.length || 0,
              },
            }
          );
        } catch (err) {
          // Não quebra criação do post se effects falharem (log apenas)
          console.warn('Erro ao emitir effects (não crítico):', err);
        }
      }
    }

    // FASE 10: Registrar impacto quando post é publicado (mantido para compatibilidade)
    // 🔴 NOTA: Impacto também é emitido via effect IMPACT_RECORDED
    // Mantido aqui para não quebrar código existente
    try {
      await impactService.recordImpact({
        tenantId,
        actor: {
          actor_id: actor.actor_id,
          actor_type: actor.actor_type as 'user' | 'page',
        },
        eventType: 'POST_PUBLISHED',
        delta: 1,
        sourceType: 'post',
        sourceId: safePost.post_id,
      });
    } catch (err) {
      // Não quebra criação do post se impacto falhar (log apenas)
      console.warn('Erro ao registrar impacto de post publicado (não crítico):', err);
    }

    return {
      post_id: safePost.post_id,
      tenant_id: tenantId,
      actor_id: actor.actor_id,
      content,
      media: [],
      visibility: resolvedVisibility,
      intent: intent || 'personal',
      intent_metadata: intentMetadata,
      targeting,
      createdAt: tsIso(safePost.created_at),
      updatedAt: tsIso(safePost.updated_at),
      actor: {
        actor_id: actor.actor_id,
        actor_type: actor.actor_type,
        display_name: actor.display_name,
        avatar_url: actor.avatar_url,
        cover_url: actor.cover_url,
      },
      reactions_count: 0,
      comments_count: 0,
      user_reaction: null,
      // cta omitido — DECISION-0032-social (post_cta PREMATURO); tipo PostWithActor.cta? é opcional
    };
  }

  /**
   * Adiciona ou atualiza reação
   * FASE 10: Registra impacto quando nova reação é criada
   */
  async toggleReaction(
    tenantId: string,
    postId: string,
    actorId: string,
    reactionType: string
  ): Promise<ReactionResponse> {
    // Schema canônico (DECISION-0031): reactions é polimórfica via entity_type/entity_id/actor_id.
    // Padrão alias (DECISION-0033): `id AS reaction_id` preserva contrato externo.
    const existing = await runQueryWithTenant<{
      reaction_id: string;
      reaction_type: string;
    }>(
      tenantId,
      `
      SELECT id AS reaction_id, reaction_type
      FROM reactions
      WHERE entity_type = 'post' AND entity_id = $1 AND actor_id = $2
      LIMIT 1
      `,
      [postId, actorId]
    );

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Toggle off: remove reação do mesmo tipo
        await runQueryWithTenant(
          tenantId,
          `DELETE FROM reactions WHERE id = $1`,
          [existing.reaction_id]
        );
        return {
          reaction_id: existing.reaction_id,
          reaction_type: reactionType,
          createdAt: new Date().toISOString(),
          is_new: false,
        };
      } else {
        // Troca tipo
        const updated = await runQueryWithTenant<{
          reaction_id: string;
          created_at: string | Date;
        }>(
          tenantId,
          `
          UPDATE reactions
          SET reaction_type = $1
          WHERE id = $2
          RETURNING id AS reaction_id, created_at
          `,
          [reactionType, existing.reaction_id]
        );
        return {
          reaction_id: updated!.reaction_id,
          reaction_type: reactionType,
          createdAt: tsIso(updated!.created_at),
          is_new: false,
        };
      }
    }

    // Nova reação
    const newReaction = await runQueryWithTenant<{
      reaction_id: string;
      created_at: string | Date;
    }>(
      tenantId,
      `
      INSERT INTO reactions (tenant_id, actor_id, entity_type, entity_id, reaction_type)
      VALUES ($1, $2, 'post', $3, $4)
      RETURNING id AS reaction_id, created_at
      `,
      [tenantId, actorId, postId, reactionType]
    );

    if (!newReaction) {
      throw new Error('Erro ao criar reação');
    }

    return {
      reaction_id: newReaction.reaction_id,
      reaction_type: reactionType,
      createdAt: tsIso(newReaction.created_at),
      is_new: true,
    };
  }

  /**
   * Cria comentário
   */
  async createComment(
    tenantId: string,
    postId: string,
    actorId: string,
    content: string,
    parentCommentId: string | undefined
  ): Promise<CommentResponse> {
    // Schema canônico (20260530330000_social_comments.sql): comments(id, tenant_id,
    // actor_id, post_id, parent_comment_id, content, ...). DECISION-0033: alias canônico
    // `id AS comment_id` preserva contrato externo. global_user_id não existe na tabela.
    const comment = await runQueryWithTenant<{
      comment_id: string;
      created_at: string | Date;
    }>(
      tenantId,
      `
      INSERT INTO comments (
        tenant_id, post_id, actor_id, content, parent_comment_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id AS comment_id, created_at
      `,
      [tenantId, postId, actorId, content, parentCommentId || null]
    );

    if (!comment) {
      throw new Error('Erro ao criar comentário');
    }

    // Hidrata actor pelo actorId direto (sem pivot via users/global_user_id).
    const actor = await actorRepository.findById(tenantId, actorId);

    return {
      comment_id: comment.comment_id,
      post_id: postId,
      content,
      parent_comment_id: parentCommentId || null,
      createdAt: tsIso(comment.created_at),
      actor: actor
        ? {
            actor_id: actor.actor_id,
            display_name: actor.display_name,
            avatar_url: actor.avatar_url,
          }
        : {
            actor_id: '',
            display_name: 'Usuário',
            avatar_url: null,
          },
    };
  }

  /**
   * Busca comentários de um post com cursor pagination
   */
  async getComments(
    tenantId: string,
    postId: string,
    cursor: string | undefined,
    limit: number
  ): Promise<{ comments: CommentResponse[]; next_cursor: string | null; has_more: boolean }> {
    // Query convergida com schema canônico (DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH).
    // DECISION-0033: alias `id AS comment_id`/`id AS actor_id` preserva contrato externo.
    // Pivot duplo via users (LEFT JOIN users → actors via global_user_id) eliminado:
    // comments.actor_id é FK direta para actors.id (schema 20260530330000).
    let query = `
      SELECT
        c.id AS comment_id,
        c.post_id,
        c.content,
        c.parent_comment_id,
        c.created_at,
        a.id AS actor_id,
        a.display_name,
        a.avatar_url
      FROM comments c
      LEFT JOIN actors a ON a.id = c.actor_id AND a.tenant_id = $1
      WHERE c.post_id = $2 AND c.tenant_id = $1 AND c.is_deleted = false
    `;

    const params: any[] = [tenantId, postId];
    let paramIndex = 3;

    if (cursor) {
      // Cursor pagination: buscar comentários criados após o cursor (para ordem ASC)
      query += ` AND c.created_at > (SELECT created_at FROM comments WHERE id = $${paramIndex} AND tenant_id = $1)`;
      params.push(cursor);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at ASC LIMIT $${paramIndex}`;
    params.push(limit + 1); // Buscar um a mais para verificar se há mais

    const rows = await runQueriesWithTenant<any>(tenantId, query, params);

    const hasMore = rows.length > limit;
    const comments = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      comment_id: row.comment_id,
      post_id: row.post_id,
      content: row.content,
      parent_comment_id: row.parent_comment_id,
      createdAt: tsIso(row.created_at),
      actor: row.actor_id
        ? {
            actor_id: row.actor_id,
            display_name: row.display_name || 'Usuário',
            avatar_url: row.avatar_url,
          }
        : {
            actor_id: '',
            display_name: 'Usuário',
            avatar_url: null,
          },
    }));

    return {
      comments,
      next_cursor: hasMore && comments.length > 0 ? comments[comments.length - 1].comment_id : null,
      has_more: hasMore,
    };
  }

  /**
   * Busca posts de um actor
   */
  async getActorPosts(
    tenantId: string,
    actorId: string,
    limit: number,
    // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5): quem está LENDO, resolvido
    // SERVER-SIDE pelo caller (req.user → actor próprio; nunca client-declared). null = anônimo.
    viewerActorId: string | null = null
  ): Promise<PostWithActor[]> {
    // Query convergida com schema canônico (DT-DRIFT-SOCIAL-2.0-SERVICE-SCHEMA-MISMATCH).
    // Mesmas DECISIONs do getFeed: 0031 (reactions polimórfico), 0032-social (post_cta removido),
    // 0033 (alias id AS post_id). #4 media: opção (c) — array vazio até DT-FEED-MEDIA-HIDRATATION
    // resolver hidratação. Sem subquery user_reaction (já hardcoded null aqui).
    const rows = await runQueriesWithTenant<any>(
      tenantId,
      `
      SELECT
        p.id AS post_id,
        p.tenant_id,
        p.actor_id,
        p.content,
        '[]'::jsonb AS media,
        p.intent,
        p.visibility,
        NULL::jsonb as intent_metadata,
        NULL::jsonb as targeting,
        p.created_at,
        p.updated_at,
        COALESCE(a.id, NULL::uuid) as actor_actor_id,
        a.actor_type,
        a.display_name,
        a.avatar_url,
        a.cover_url,
        COALESCE((
          SELECT COUNT(*)::int
          FROM reactions r
          WHERE r.entity_type = 'post' AND r.entity_id = p.id
        ), 0) as reactions_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.id AND c.is_deleted = false
        ), 0) as comments_count,
        null as user_reaction,
        NULL::text as group_name,
        0::bigint AS total_impact_cents
      FROM posts p
      LEFT JOIN actors a ON p.actor_id = a.id
      -- FASE 3.6: groups table não existe ainda, então group_name é NULL por enquanto
      WHERE p.tenant_id = $1 AND p.actor_id = $2 AND ${postVisibilitySql('p', '$4')}
      ORDER BY p.created_at DESC
      LIMIT $3
      `,
      [tenantId, actorId, limit, viewerActorId]
    );

    const actorPostIds = rows.map((r: { post_id: string }) => r.post_id).filter(Boolean);
    const actorImpactMap = await bankSplitRepository.sumImpactCentsByTransactionReferenceIds(
      tenantId,
      actorPostIds
    );
    for (const r of rows) {
      r.total_impact_cents = actorImpactMap.get(r.post_id) ?? 0;
    }

    return rows.map((row) => ({
      post_id: row.post_id,
      tenant_id: row.tenant_id,
      actor_id: row.actor_id,
      content: row.content,
      media: row.media || [],
      visibility: row.visibility || 'public',
      intent: row.intent || 'personal',
      intent_metadata: row.intent_metadata ? (typeof row.intent_metadata === 'string' ? JSON.parse(row.intent_metadata) : row.intent_metadata) : undefined,
      targeting: row.targeting ? (typeof row.targeting === 'string' ? JSON.parse(row.targeting) : row.targeting) : undefined,
      createdAt: tsIso(row.created_at),
      updatedAt: tsIso(row.updated_at),
      actor: row.actor_actor_id
        ? {
            actor_id: row.actor_actor_id,
            actor_type: row.actor_type,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            cover_url: row.cover_url,
          }
        : {
            actor_id: '',
            actor_type: 'user',
            display_name: 'Usuário',
            avatar_url: null,
            cover_url: null,
          },
      reactions_count: row.reactions_count || 0,
      comments_count: row.comments_count || 0,
      user_reaction: row.user_reaction || null,
      // cta removido — DECISION-0032-social (post_cta PREMATURO)
      social_impact: row.group_name && parseInt(row.total_impact_cents.toString(), 10) > 0
        ? {
            group_name: row.group_name,
            total_impact_cents: parseInt(row.total_impact_cents.toString(), 10),
          }
        : undefined,
    }));
  }

  /**
   * Segue um actor
   */
  async followActor(
    tenantId: string,
    followerActorId: string,
    targetActorId: string
  ): Promise<{ success: boolean; is_following: boolean }> {
    // Schema canônico (20260530310000_social_follows.sql): follows(id, tenant_id,
    // follower_actor_id, followed_actor_id, created_at). Alias `id AS follow_id`
    // preserva contrato externo (DECISION-0033).
    const existing = await runQueryWithTenant<{ follow_id: string }>(
      tenantId,
      `
      SELECT id AS follow_id
      FROM follows
      WHERE followed_actor_id = $1 AND follower_actor_id = $2
      LIMIT 1
      `,
      [targetActorId, followerActorId]
    );

    if (existing) {
      return { success: true, is_following: true };
    }

    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO follows (tenant_id, followed_actor_id, follower_actor_id)
      VALUES ($1, $2, $3)
      `,
      [tenantId, targetActorId, followerActorId]
    );

    return { success: true, is_following: true };
  }

  /**
   * Deixa de seguir um actor
   */
  async unfollowActor(
    tenantId: string,
    followerActorId: string,
    targetActorId: string
  ): Promise<{ success: boolean; is_following: boolean }> {
    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM follows
      WHERE followed_actor_id = $1 AND follower_actor_id = $2
      `,
      [targetActorId, followerActorId]
    );

    return { success: true, is_following: false };
  }

  /**
   * Verifica se está seguindo
   */
  async isFollowing(
    tenantId: string,
    followerActorId: string,
    targetActorId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ follow_id: string }>(
      tenantId,
      `
      SELECT id AS follow_id
      FROM follows
      WHERE followed_actor_id = $1 AND follower_actor_id = $2
      LIMIT 1
      `,
      [targetActorId, followerActorId]
    );

    return !!result;
  }

  /**
   * Busca contadores de um actor
   */
  async getActorCounts(
    tenantId: string,
    actorId: string,
    // F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5): sem isto, um estranho veria
    // "5 posts" mas só 2 renderizados (a contagem vazaria a EXISTÊNCIA de posts 'connections'/
    // 'only_me' que ele não pode ler). Coerência com getActorPosts, mesmo predicado.
    viewerActorId: string | null = null
  ): Promise<{ followers_count: number; posts_count: number }> {
    const result = await runQueryWithTenant<{
      followers_count: number;
      posts_count: number;
    }>(
      tenantId,
      `
      SELECT
        COALESCE((
          SELECT COUNT(*)::int
          FROM follows f
          WHERE f.followed_actor_id = $1
        ), 0) as followers_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM posts p
          WHERE p.actor_id = $1 AND ${postVisibilitySql('p', '$2')}
        ), 0) as posts_count
      `,
      [actorId, viewerActorId]
    );

    return result || { followers_count: 0, posts_count: 0 };
  }
  /**
   * Busca actor de um usuário (helper para outras rotas)
   */
  async getUserActor(tenantId: string, userId: string): Promise<{ actor_id: string } | null> {
    try {
      const user = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `
        SELECT user_id FROM users
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [userId, tenantId]
      );

      if (!user) {
        return null;
      }

      const actor = await ensureUserActor(tenantId, user.user_id);
      return { actor_id: actor.actor_id };
    } catch (err) {
      console.error('Erro ao buscar actor do usuário:', err);
      return null;
    }
  }
}

export const social2Service = new Social2Service();




// frontend/src/api/social.ts
// SPRINT 47: API client para referências do marketplace no social
// Re-exports para compatibilidade com imports legados

import { apiFetch } from './client';
import { getAuthToken, getTenantId, setTenantId } from '../config/auth';
import { decodeJwtPayload } from '../utils/jwt';

// Re-export from social-2.0.ts for backwards compatibility
export {
  getFeed as getSocialFeed,
  createPost as createSocialPost,
  toggleReaction,
  createComment,
  getComments,
  getActorProfile,
  getActorProfile as getActor,
} from './social-2.0';

export type { Comment, Actor, Post } from './social-2.0';
export type { Actor as ActorResponse } from './social-2.0';
export type { Post as PostCardData } from './social-2.0';

// Extended Actor type with legacy fields
export interface AvailableActor {
  actor_id: string;
  actor_type: 'user' | 'page' | 'group' | 'channel';
  display_name: string;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  user_id?: string;
  user_role?: string;
  company_status?: string;
  can_post?: boolean;
  // DECISION-0043 pendente: company_id usado pelo redirect contextual síncrono
  // em /perfil quando actor_type='page' (Profile.tsx guard). Backend já envia
  // (actors.company_id em actor.repository.ts:39); type apenas expõe.
  company_id?: string | null;
  // 2026-05-18 P1 Frente C — REVERTIDA. Coluna companies.activity não existe
  // no schema material. DT-PRESSURE-AVAILABLE-ACTOR-ACTIVITY-FIELD aberta.
  // Quando migration adicionar a coluna, propagar aqui.
}

export async function getAvailableActors(_options?: any): Promise<AvailableActor[]> {
  // 🔴 GUARD EXPLÍCITO: Validar contexto antes de fazer requisição
  // Prevenir chamadas inválidas durante bootstrap que geram 400 e warnings
  
  // 1. Verificar token (autenticação obrigatória)
  const token = getAuthToken();
  if (!token) {
    // Sem token = não autenticado = não fazer chamada
    return [];
  }
  
  // 2. Verificar tenantId (obrigatório para requisições autenticadas)
  let tenantId = getTenantId();
  
  // 3. Se não estiver no storage, tentar extrair do JWT
  if (!tenantId) {
    try {
      const tokenPayload = decodeJwtPayload(token);
      tenantId = tokenPayload.tenantId;
      
      // Validar tenantId extraído
      if (tenantId && typeof tenantId === 'string' && tenantId.trim() !== '') {
        setTenantId(tenantId);
      } else {
        // tenantId inválido no JWT = não fazer chamada
        return [];
      }
    } catch (e) {
      // Falha ao extrair tenantId = não fazer chamada
      return [];
    }
  }
  
  // 4. Validação final: tenantId deve ser válido
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    // tenantId inválido = não fazer chamada
    return [];
  }
  
  // 5. Contexto válido: fazer requisição
  const response = await apiFetch('/social/actors/available');
  const data = await response.json();
  // Backend retorna { actors: [...] }
  return Array.isArray(data.actors) ? data.actors : [];
}

// Type alias for backwards compatibility
export type CreatePostPayload = any;

// Re-export vote from votes.ts
export { vote } from './votes';

// =====================================================================
// QUARENTENA 2026-05-18 P1 — Frente A
//
// As 6 funções abaixo eram stubs que retornavam {success:true} OU coleções
// vazias HARDCODED sem chamar `apiFetch`. Padrão extremamente perigoso:
//   - confirmCTA afirmava sucesso de operação financeira inexistente
//   - followActor/unfollowActor afirmavam sucesso silencioso
//   - getLedger/getLedgerSummary/getComments falsificavam "vazio"
//
// Todas agora dão `throw new Error('NOT_IMPLEMENTED: ...')` — callers
// existentes têm try/catch e mostrarão erro honesto / empty state.
//
// Decisões arquiteturais relevantes:
//   - confirmCTA: backend endpoint inexistente (DT-PRESSURE-CONFIRM-CTA-FANTASMA)
//   - follow/unfollowActor: Princípio Operacional §10 — relação no UnifiCard
//     emerge de comportamento, não de declaração tipo Facebook. Mecânica
//     "follow" provavelmente não terá implementação backend (DT-FOLLOW-MECHANICS-DECISION-PENDING)
//   - getLedger/Summary: legados de modules/social/social-ledger.service.ts
//     que está em REGIME DE EXTINÇÃO (SSOT_EXCLUSIVE_BANK_RULE §4). Não vai
//     ganhar endpoint novo.
//   - getComments: endpoint backend pode existir mas frontend não chega
//     lá (DT-PRESSURE-COMMENTS-FANTASMA — abrir quando consumir for prioridade)
//
// Princípio operacional Clayton 2026-05-18:
//   "Frontend NUNCA cria verdade. Stub que afirma sucesso é violação grave."
// =====================================================================

export async function getLedger(_options?: any): Promise<any> {
  throw new Error('NOT_IMPLEMENTED: getLedger — social-ledger em regime de extinção (SSOT_EXCLUSIVE_BANK_RULE §4). Usar bank statement via getBankStatement.');
}

export type LedgerSummary = Record<string, any>;

export async function getLedgerSummary(_actorId?: string): Promise<any> {
  throw new Error('NOT_IMPLEMENTED: getLedgerSummary — social-ledger em regime de extinção (SSOT_EXCLUSIVE_BANK_RULE §4).');
}

export async function followActor(_actorId: string): Promise<{ success: boolean }> {
  throw new Error('NOT_IMPLEMENTED: followActor — mecânica "follow" não é parte do modelo UnifiCard (Princípio Operacional §10: relação emerge de comportamento, não de declaração). DT-FOLLOW-MECHANICS-DECISION-PENDING.');
}

export async function unfollowActor(_actorId: string): Promise<{ success: boolean }> {
  throw new Error('NOT_IMPLEMENTED: unfollowActor — mecânica "follow" não é parte do modelo UnifiCard. DT-FOLLOW-MECHANICS-DECISION-PENDING.');
}

export interface ConfirmCTAResponse {
  success: boolean;
  transactionId?: string;
  message?: string;
  revenue_entry?: any;
  profit_share_entry?: any;
}

export async function confirmCTA(_ctaId: string, _data?: any): Promise<ConfirmCTAResponse> {
  throw new Error('NOT_IMPLEMENTED: confirmCTA — backend endpoint ausente. Caller estava recebendo {success:true} silencioso afirmando sucesso de operação financeira. DT-PRESSURE-CONFIRM-CTA-FANTASMA.');
}

export interface CreateSocialMarketplaceRefInput {
  postId: string;
  refType: 'PRODUCT' | 'ORDER' | 'CAMPAIGN';
  refId: string;
  metadata?: Record<string, any>;
}

export interface SocialMarketplaceRef {
  id: string;
  tenantId: string;
  postId: string;
  refType: 'PRODUCT' | 'ORDER' | 'CAMPAIGN';
  refId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface SocialMarketplaceRefWithDetails {
  ref: SocialMarketplaceRef;
  details: {
    type: 'PRODUCT' | 'ORDER' | 'CAMPAIGN';
    id: string;
    name: string;
    status?: string;
    link: string;
  } | null;
}

/**
 * Cria referência do marketplace no social
 */
export async function createSocialMarketplaceRef(
  input: CreateSocialMarketplaceRefInput
): Promise<SocialMarketplaceRef> {
  const response = await apiFetch('/social/marketplace-ref', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Busca referências do marketplace por post
 */
export async function getSocialMarketplaceRefsByPost(
  postId: string
): Promise<{ refs: SocialMarketplaceRefWithDetails[] }> {
  const response = await apiFetch(`/social/marketplace-ref/${postId}`);
  return response.json();
}

/**
 * Busca detalhes de uma referência específica
 */
export async function getSocialMarketplaceRefDetails(
  refId: string
): Promise<SocialMarketplaceRefWithDetails> {
  const response = await apiFetch(`/social/marketplace-ref/details/${refId}`);
  return response.json();
}

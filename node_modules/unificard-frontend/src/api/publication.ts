// frontend/src/api/publication.ts
// API client para o Motor Canônico de Publicação, Visibilidade e Convites

import { apiFetch, apiFetchJson } from './client';
import type {
  PublicationMetadata,
  UpsertPublicationMetadataInput,
  GeneratedLink,
  ReactionCount,
} from '../types/publication';

/**
 * Busca metadados de publicação
 */
export async function getPublicationMetadata(
  entityType: 'event' | 'post' | 'group' | 'channel',
  entityId: string
): Promise<PublicationMetadata | null> {
  try {
    const data = await apiFetchJson<{ metadata: PublicationMetadata }>(
      `/publication/${entityType}/${entityId}`,
      {
        method: 'GET',
      },
      { silent404: true } // Tratar 404 como feature indisponível (não erro)
    );
    return data.metadata;
  } catch (error: any) {
    // Se for 404, retornar null (não é erro, apenas não existe)
    if (error.status === 404 || error.code === 'FEATURE_UNAVAILABLE') {
      return null;
    }
    throw error;
  }
}

/**
 * Cria ou atualiza metadados de publicação
 */
export async function upsertPublicationMetadata(
  input: UpsertPublicationMetadataInput
): Promise<PublicationMetadata> {
  const data = await apiFetchJson<{ metadata: PublicationMetadata }>(
    `/publication/${input.entity_type}/${input.entity_id}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  return data.metadata;
}

/**
 * Gera link compartilhável
 */
export async function generateShareableLink(
  entityType: 'event' | 'post' | 'group' | 'channel',
  entityId: string,
  options?: { referral_code?: string; expires_at?: string }
): Promise<GeneratedLink> {
  const data = await apiFetchJson<{ link: GeneratedLink }>(
    `/publication/${entityType}/${entityId}/generate-link`,
    {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }
  );
  return data.link;
}

/**
 * Busca contagens de reações
 */
export async function getReactionCounts(
  entityType: 'event' | 'post' | 'group' | 'channel',
  entityId: string
): Promise<ReactionCount[]> {
  const data = await apiFetchJson<{ counts: ReactionCount[] }>(
    `/publication/${entityType}/${entityId}/reactions`,
    {
      method: 'GET',
    }
  );
  return data.counts || [];
}

/**
 * Cria ou atualiza reação
 */
export async function upsertReaction(
  entityType: 'event' | 'post' | 'group' | 'channel',
  entityId: string,
  reactionType: 'like' | 'dislike' | 'love' | 'laugh' | 'angry' | 'sad',
  actorId?: string
): Promise<void> {
  await apiFetchJson<{ success: boolean }>(
    `/publication/${entityType}/${entityId}/reactions`,
    {
      method: 'POST',
      body: JSON.stringify({
        reaction_type: reactionType,
        actor_id: actorId,
      }),
    }
  );
}

/**
 * Remove reação
 */
export async function removeReaction(
  entityType: 'event' | 'post' | 'group' | 'channel',
  entityId: string
): Promise<void> {
  await apiFetchJson<{ success: boolean }>(
    `/publication/${entityType}/${entityId}/reactions`,
    {
      method: 'DELETE',
    }
  );
}


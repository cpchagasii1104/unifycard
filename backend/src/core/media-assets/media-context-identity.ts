// media-context-identity.ts
// DECISION-0118 D1 — identidade CONTEXTUAL da declaração de mídia lógica.
//
// O asset lógico é uma DECLARAÇÃO de uso: blob físico + tenant + actor
// declarante + context_type + context_owner + source + purpose + licença +
// provenance. Contexto materialmente diferente NUNCA colapsa no asset anterior;
// idempotência só existe quando TODAS as dimensões coincidem. Moderação fica
// FORA da identidade (estado independente por declaração).
//
// A fórmula V1 é ESPELHADA no backfill SQL da migration
// 20260612100000_media_asset_contextual_identity.sql — não alterar uma sem a outra.

import { createHash } from 'crypto';

export const MEDIA_CONTEXT_TYPES = ['company', 'canonical_suggestion', 'platform'] as const;
export type MediaContextType = (typeof MEDIA_CONTEXT_TYPES)[number];

export const MEDIA_PURPOSES = ['business_media', 'canonical_catalog', 'platform_curation'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export interface MediaContextDeclaration {
  mediaBlobId: string;
  originTenantId: string;
  /** Actor humano declarante (nunca autoridade por si — DECISION-0113). */
  createdByActorId: string | null;
  contextType: MediaContextType;
  /** Empresa/recurso dono do uso (OBRIGATÓRIO quando contextType='company'). */
  contextOwnerId: string | null;
  source: string;
  purpose: MediaPurpose;
  license: string | null;
  /** Provenance/origem declarada (origin_note). */
  provenance: string | null;
}

/** Normalização de dimensão textual livre (licença/provenance): trim + lowercase. */
export function normalizeContextDimension(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Fingerprint V1 da declaração contextual — md5 de
 * blob|tenant|actor|context_type|context_owner|source|purpose|license_norm|provenance_norm.
 * QUALQUER dimensão divergente ⇒ fingerprint diferente ⇒ declaração NOVA
 * (mesmo blob físico; nenhuma intenção descartada em silêncio).
 */
export function computeMediaContextFingerprintV1(decl: MediaContextDeclaration): string {
  const parts = [
    decl.mediaBlobId,
    decl.originTenantId ?? '',
    decl.createdByActorId ?? '',
    decl.contextType,
    decl.contextOwnerId ?? '',
    decl.source,
    decl.purpose,
    normalizeContextDimension(decl.license),
    normalizeContextDimension(decl.provenance),
  ];
  return createHash('md5').update(parts.join('|')).digest('hex');
}

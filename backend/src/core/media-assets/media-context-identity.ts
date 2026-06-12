// media-context-identity.ts
// DECISION-0118 D1 (implementação V2) — identidade CONTEXTUAL da declaração de
// mídia lógica, collision-safe.
//
// O asset lógico é uma DECLARAÇÃO de uso: blob físico + tenant + actor
// declarante + context_type + context_owner + source + purpose + licença +
// provenance. Contexto materialmente diferente NUNCA colapsa no asset anterior;
// idempotência só existe quando TODAS as dimensões coincidem. Moderação fica
// FORA da identidade (estado independente por declaração).
//
// V2 (fecha DT-MEDIA-CONTEXT-FINGERPRINT-SERIALIZATION-AMBIGUITY, achado Yala):
//   · a V1 concatenava dimensões com '|' (md5) — campos livres adjacentes
//     permitiam PREIMAGES idênticos (license='a'/prov='b|c' == license='a|b'/
//     prov='c') e a 2ª declaração era descartada em silêncio;
//   · o encoder V2 é a FUNÇÃO SQL media_context_fingerprint_v2 (migration
//     20260612120000) — FONTE ÚNICA, usada por backfill E por runtime: NÃO
//     existe segunda fórmula manuscrita aqui (este módulo só a invoca);
//   · serialização inequívoca: versão + campo nomeado + marcador 'N' de NULL +
//     tamanho em BYTES UTF-8 + conteúdo (length-prefixed e parseável);
//   · hash sha256; context_identity_version = 2 persistido;
//   · HASH NUNCA É PROVA DE IGUALDADE: qualquer match de fingerprint ou de
//     idempotency_key exige recomparação material INTEGRAL
//     (materiallyEqualMediaContext — IS NOT DISTINCT FROM, NULL-safe).
//
// SEMÂNTICA NORMADA das dimensões livres (licença/provenance) — explícita e
// provada em e2e:
//   · canonicalização PRÉ-PERSISTÊNCIA: trim de whitespace ASCII e string
//     vazia ⇒ NULL (NULL ≡ '' por DECISÃO via normalização, nunca por
//     ambiguidade de encoding); case PRESERVADO na persistência;
//   · IDENTIDADE/comparação usam lower() (case-insensitive — DECISION-0118 D1);
//   · Unicode é byte-exato em UTF-8 (NFC ≠ NFD = declarações DISTINTAS);
//   · espaços INTERNOS são significativos ('a  b' ≠ 'a b').

import { pool } from '../database/pool';

export const MEDIA_CONTEXT_IDENTITY_VERSION = 2;

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

/** Whitespace ASCII canônico — espelho EXATO do btrim da função SQL (não usar \s do JS). */
const MEDIA_CONTEXT_ASCII_WS = ' \t\n\r\f';

/**
 * Canonicalização PRÉ-PERSISTÊNCIA de dimensão livre: trim do charset ASCII
 * explícito + vazio ⇒ NULL. Case é PRESERVADO (a identidade lowercases depois,
 * dentro do encoder SQL).
 */
export function canonicalizeContextDimension(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  let start = 0;
  let end = s.length;
  while (start < end && MEDIA_CONTEXT_ASCII_WS.includes(s[start])) start++;
  while (end > start && MEDIA_CONTEXT_ASCII_WS.includes(s[end - 1])) end--;
  const trimmed = s.slice(start, end);
  return trimmed === '' ? null : trimmed;
}

/**
 * Fingerprint V2 — invoca a FUNÇÃO SQL canônica (fonte única do encoder;
 * a mesma usada pelo backfill da migration 20260612120000). Preimage:
 * 'MEDIA_CTX_V2' + campos nomeados, NULL='N', conteúdo com length-prefix em
 * bytes UTF-8; hash sha256 hex.
 */
export async function computeMediaContextFingerprintV2(decl: MediaContextDeclaration): Promise<string> {
  const r = await pool.query<{ fp: string }>(
    `SELECT media_context_fingerprint_v2(
       $1::uuid, $2::uuid, $3::uuid, $4::text, $5::uuid, $6::text, $7::text, $8::text, $9::text
     ) AS fp`,
    [
      decl.mediaBlobId,
      decl.originTenantId,
      decl.createdByActorId,
      decl.contextType,
      decl.contextOwnerId,
      decl.source,
      decl.purpose,
      canonicalizeContextDimension(decl.license),
      canonicalizeContextDimension(decl.provenance),
    ]
  );
  return r.rows[0].fp;
}

/**
 * COMPARAÇÃO MATERIAL INTEGRAL — regra V2: fingerprint igual NUNCA basta.
 * Compara TODAS as dimensões persistidas do candidato com a intenção
 * normalizada (blob, tenant, actor, context_type, context_owner, source,
 * purpose, licença, provenance) via IS NOT DISTINCT FROM (NULL-safe) e
 * media_context_dimension_norm — a MESMA normalização da identidade.
 * Nenhuma dimensão é ignorada.
 */
export async function materiallyEqualMediaContext(
  candidateAssetId: string,
  decl: MediaContextDeclaration
): Promise<boolean> {
  const r = await pool.query<{ equal: boolean }>(
    `SELECT (
        ma.media_blob_id = $2::uuid
        AND ma.origin_tenant_id IS NOT DISTINCT FROM $3::uuid
        AND ma.created_by_actor_id IS NOT DISTINCT FROM $4::uuid
        AND ma.context_type = $5::text
        AND ma.context_owner_id IS NOT DISTINCT FROM $6::uuid
        AND ma.source = $7::text
        AND ma.purpose = $8::text
        AND media_context_dimension_norm(ma.license) IS NOT DISTINCT FROM media_context_dimension_norm($9::text)
        AND media_context_dimension_norm(ma.origin_note) IS NOT DISTINCT FROM media_context_dimension_norm($10::text)
      ) AS equal
       FROM media_assets ma
      WHERE ma.id = $1::uuid`,
    [
      candidateAssetId,
      decl.mediaBlobId,
      decl.originTenantId,
      decl.createdByActorId,
      decl.contextType,
      decl.contextOwnerId,
      decl.source,
      decl.purpose,
      decl.license,
      decl.provenance,
    ]
  );
  return r.rows[0]?.equal === true;
}

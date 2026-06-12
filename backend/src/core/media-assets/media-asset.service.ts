// media-asset.service.ts
// DECISION-0117 C + F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE.
//
// DUAS CAMADAS (correção do FAIL Yala — DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK):
//   media_blobs  = BLOB FÍSICO content-addressed (sha-256 UNIQUE GLOBAL; mesmos bytes
//                  NUNCA gravam novo blob). Sem tenant/actor/moderação/licença — blob,
//                  hash e storage_reference NÃO são recursos autorizáveis.
//   media_assets = ASSET LÓGICO tenant/actor-scoped (origem, autoria, licença, moderação,
//                  trilha). Tenants/actores distintos com os mesmos bytes = assets lógicos
//                  DISTINTOS apontando para o MESMO blob. Nenhuma metadata do 1º uploader
//                  é herdada pelo 2º; reenvio idempotente SÓ dentro do mesmo contexto.
//
// Pipeline no molde document-storage PJ (DECISION-0112): MIME allowlist → magic bytes →
// MalwareScanPort (clean-only) → hash sha-256 → dedup FÍSICA por blob → StoragePort
// (referência opaca) → asset lógico do contexto do caller, com COMPENSAÇÃO ref-count-safe
// (blob compartilhado JAMAIS é apagado). Attach canônico é ato CURATORIAL; leitura de
// arquivo/metadata exige prova de visibilidade (canônica pública aprovada OU contexto do
// criador OU curador). Provider de produção FORA. Zero Bank writer.

import { createHash } from 'crypto';
import { pool } from '../database/pool';
import type { DocumentStoragePort } from '../document-storage/document-storage.port';
import { resolveDocumentStorageProvider } from '../document-storage/document-storage.provider';
import type { MalwareScanPort } from '../document-malware-scan/document-malware-scan.port';
import { resolveMalwareScanProvider } from '../document-malware-scan/document-malware-scan.provider';
import { magicBytesMatchMime } from '../kyb-documents/kyb-document-validation';
import { insertCatalogEvent } from '../catalog/canonical/canonical-variant.service';
import { authorizationService } from '../authorization/authorization.service';
import {
  computeMediaContextFingerprintV2,
  materiallyEqualMediaContext,
  canonicalizeContextDimension,
  MEDIA_CONTEXT_IDENTITY_VERSION,
  type MediaContextDeclaration,
  type MediaContextType,
  type MediaPurpose,
  MEDIA_CONTEXT_TYPES,
  MEDIA_PURPOSES,
} from './media-context-identity';

export class MediaAssetError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'MediaAssetError';
  }
}

/** Allowlist de mídia de catálogo (imagens; subset da allowlist do storage). */
export const MEDIA_ALLOWED_MIME = ['image/jpeg', 'image/png'] as const;
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/** Camada FÍSICA — nunca exposta como recurso autorizável. */
export interface MediaBlob {
  id: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  storageReference: string;
}

/**
 * Camada LÓGICA — DECLARAÇÃO CONTEXTUAL (DECISION-0118 D1). Campos físicos
 * projetados do blob por JOIN (leitura interna).
 */
export interface MediaAsset {
  id: string;
  mediaBlobId: string;
  mimeType: string;
  sizeBytes: number;
  source: string;
  license: string | null;
  version: number;
  moderationStatus: string;
  createdByActorId: string | null;
  originTenantId: string | null;
  contextType: MediaContextType;
  contextOwnerId: string | null;
  purpose: MediaPurpose;
  provenance: string | null;
  contextFingerprint: string;
  contextIdentityVersion: number;
  idempotencyKey: string | null;
}

interface BlobRow {
  id: string;
  content_hash: string;
  mime_type: string;
  size_bytes: string | number;
  storage_reference: string;
}

interface AssetRow {
  id: string;
  media_blob_id: string;
  mime_type: string;
  size_bytes: string | number;
  source: string;
  license: string | null;
  version: number;
  moderation_status: string;
  created_by_actor_id: string | null;
  origin_tenant_id: string | null;
  context_type: string;
  context_owner_id: string | null;
  purpose: string;
  origin_note: string | null;
  context_fingerprint: string;
  context_identity_version: number;
  idempotency_key: string | null;
}

const ASSET_SELECT =
  'ma.id, ma.media_blob_id, mb.mime_type, mb.size_bytes, ma.source, ma.license, ma.version, ' +
  'ma.moderation_status, ma.created_by_actor_id, ma.origin_tenant_id, ma.context_type, ' +
  'ma.context_owner_id, ma.purpose, ma.origin_note, ma.context_fingerprint, ' +
  'ma.context_identity_version, ma.idempotency_key';
const ASSET_FROM = 'media_assets ma JOIN media_blobs mb ON mb.id = ma.media_blob_id';

function toBlob(row: BlobRow): MediaBlob {
  return {
    id: row.id,
    contentHash: row.content_hash,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storageReference: row.storage_reference,
  };
}

function toAsset(row: AssetRow): MediaAsset {
  return {
    id: row.id,
    mediaBlobId: row.media_blob_id,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    source: row.source,
    license: row.license,
    version: row.version,
    moderationStatus: row.moderation_status,
    createdByActorId: row.created_by_actor_id,
    originTenantId: row.origin_tenant_id,
    contextType: row.context_type as MediaContextType,
    contextOwnerId: row.context_owner_id,
    purpose: row.purpose as MediaPurpose,
    provenance: row.origin_note,
    contextFingerprint: row.context_fingerprint,
    contextIdentityVersion: Number(row.context_identity_version),
    idempotencyKey: row.idempotency_key,
  };
}

/** Projeção PÚBLICA de mídia canônica — sem autoria/origem/storage (metadata privada não vaza). */
export interface PublicMediaProjection {
  id: string;
  mimeType: string;
  sizeBytes: number;
  license: string | null;
  version: number;
}

export function toPublicMediaProjection(asset: MediaAsset): PublicMediaProjection {
  return { id: asset.id, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, license: asset.license, version: asset.version };
}

/** Contexto do sujeito para leitura/attach (autoridade provada na rota + resolvida aqui). */
export interface MediaReadContext {
  tenantId: string;
  userId: string;
  /** Necessário para autoridade de CONTEXT_OWNER empresarial (canManageCompany). */
  globalUserId?: string;
  /** Curador humano (requireRole admin já provado na rota OU rbac consultado pela rota). */
  isCurator?: boolean;
}

export interface PersistAssetParams {
  mediaBlobId: string;
  source: string;
  license: string | null;
  createdByActorId: string | null;
  originTenantId: string | null;
  contextType: MediaContextType;
  contextOwnerId: string | null;
  purpose: MediaPurpose;
  provenance: string | null;
  contextFingerprint: string;
  contextIdentityVersion: number;
  idempotencyKey: string | null;
}

/** Test seam (mesmo molde do submitKybDocument): storage/scanner/persist fakes no e2e. */
export interface IngestMediaDeps {
  storage?: DocumentStoragePort;
  scanner?: MalwareScanPort;
  /** Override do INSERT do ASSET LÓGICO (e2e de compensação ref-count-safe). */
  persistAssetRow?: (params: PersistAssetParams) => Promise<AssetRow>;
}

async function defaultPersistAssetRow(params: PersistAssetParams): Promise<AssetRow> {
  const r = await pool.query<AssetRow>(
    `WITH ins AS (
       INSERT INTO media_assets (
         media_blob_id, source, license, created_by_actor_id, origin_tenant_id,
         context_type, context_owner_id, purpose, origin_note, context_fingerprint,
         context_identity_version, idempotency_key
       )
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid, $6, $7::uuid, $8, $9, $10, $11, $12)
       RETURNING id, media_blob_id, source, license, version, moderation_status,
                 created_by_actor_id, origin_tenant_id, context_type, context_owner_id,
                 purpose, origin_note, context_fingerprint, context_identity_version, idempotency_key
     )
     SELECT ins.id, ins.media_blob_id, mb.mime_type, mb.size_bytes, ins.source, ins.license,
            ins.version, ins.moderation_status, ins.created_by_actor_id, ins.origin_tenant_id,
            ins.context_type, ins.context_owner_id, ins.purpose, ins.origin_note,
            ins.context_fingerprint, ins.context_identity_version, ins.idempotency_key
       FROM ins JOIN media_blobs mb ON mb.id = ins.media_blob_id`,
    [
      params.mediaBlobId,
      params.source,
      params.license,
      params.createdByActorId,
      params.originTenantId,
      params.contextType,
      params.contextOwnerId,
      params.purpose,
      params.provenance,
      params.contextFingerprint,
      params.contextIdentityVersion,
      params.idempotencyKey,
    ]
  );
  return r.rows[0];
}

export const mediaAssetService = {
  async findById(mediaAssetId: string): Promise<MediaAsset | null> {
    const r = await pool.query<AssetRow>(
      `SELECT ${ASSET_SELECT} FROM ${ASSET_FROM} WHERE ma.id = $1::uuid LIMIT 1`,
      [mediaAssetId]
    );
    return r.rows[0] ? toAsset(r.rows[0]) : null;
  },

  /** Dedup FÍSICA global (camada blob; nunca devolve asset lógico de terceiro). */
  async findBlobByHash(contentHash: string): Promise<MediaBlob | null> {
    const r = await pool.query<BlobRow>(
      `SELECT id, content_hash, mime_type, size_bytes, storage_reference
         FROM media_blobs WHERE content_hash = $1 LIMIT 1`,
      [contentHash]
    );
    return r.rows[0] ? toBlob(r.rows[0]) : null;
  },

  /**
   * Localiza o CANDIDATO pela identidade contextual V2 (context_fingerprint
   * sha256 da declaração completa). REGRA V2: o retorno NÃO autoriza reuso —
   * hash nunca é prova de igualdade; o caller DEVE recomparar todas as
   * dimensões materiais (materiallyEqualMediaContext) antes de reutilizar.
   */
  async findAssetByContextFingerprint(contextFingerprint: string): Promise<MediaAsset | null> {
    const r = await pool.query<AssetRow>(
      `SELECT ${ASSET_SELECT} FROM ${ASSET_FROM}
        WHERE ma.context_fingerprint = $1
        LIMIT 1`,
      [contextFingerprint]
    );
    return r.rows[0] ? toAsset(r.rows[0]) : null;
  },

  /** Chave explícita de idempotência — escopo (tenant, actor declarante). */
  async findAssetByIdempotencyKey(originTenantId: string, createdByActorId: string, idempotencyKey: string): Promise<MediaAsset | null> {
    const r = await pool.query<AssetRow>(
      `SELECT ${ASSET_SELECT} FROM ${ASSET_FROM}
        WHERE ma.origin_tenant_id = $1::uuid
          AND ma.created_by_actor_id = $2::uuid
          AND ma.idempotency_key = $3
        LIMIT 1`,
      [originTenantId, createdByActorId, idempotencyKey]
    );
    return r.rows[0] ? toAsset(r.rows[0]) : null;
  },

  /** Asset aprovado E vinculado a entidade canônica = mídia canônica PÚBLICA. */
  async isAttachedToCanonical(mediaAssetId: string): Promise<boolean> {
    const r = await pool.query<{ ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM canonical_product_media WHERE media_asset_id = $1::uuid)
           OR EXISTS (SELECT 1 FROM canonical_variant_media WHERE media_asset_id = $1::uuid)
           OR EXISTS (SELECT 1 FROM canonical_service_media WHERE media_asset_id = $1::uuid) AS ok`,
      [mediaAssetId]
    );
    return r.rows[0]?.ok === true;
  },

  /**
   * Resolver de VISIBILIDADE da declaração (metadata e arquivo) — DECISION-0118 D1:
   *   (a) canônica pública: approved + vinculada a produto/variante/serviço canônico;
   *   (b) autoridade do CONTEXT_OWNER: declaração com empresa dona do uso exige
   *       canManageCompany sobre ELA (representação genérica do actor autor NÃO
   *       basta quando o ownership real é uma empresa específica);
   *   (c) contexto do criador (declarações de plataforma/legadas sem owner):
   *       mesmo tenant + canRepresentActor sobre o actor declarante;
   *   (d) curador humano do tenant (moderação precisa VER o pending).
   * Cross-tenant privado: invisível (caller recebe 404 — sem oráculo de existência).
   */
  async canReadMediaAsset(asset: MediaAsset, ctx: MediaReadContext): Promise<boolean> {
    if (asset.moderationStatus === 'approved' && (await this.isAttachedToCanonical(asset.id))) {
      return true;
    }
    if (asset.originTenantId !== ctx.tenantId) {
      return false;
    }
    if (ctx.isCurator === true) {
      return true;
    }
    if (asset.contextOwnerId) {
      if (!ctx.globalUserId) return false;
      try {
        const { companiesService } = await import('../companies/companies.service');
        return await companiesService.canManageCompany(ctx.tenantId, asset.contextOwnerId, ctx.globalUserId);
      } catch {
        return false; // fail-closed
      }
    }
    if (asset.createdByActorId) {
      return authorizationService.canRepresentActor(ctx.tenantId, ctx.userId, asset.createdByActorId);
    }
    return false;
  },

  /**
   * COMPENSAÇÃO ref-count-safe: só apaga o blob (linha + arquivo) se NENHUM asset
   * lógico o referencia. Blob compartilhado por outro tenant JAMAIS é apagado —
   * dupla guarda: NOT EXISTS no DELETE + FK ON DELETE RESTRICT (corrida → 23503 = manter).
   */
  async deleteBlobIfUnreferenced(blob: MediaBlob, storage: DocumentStoragePort): Promise<void> {
    try {
      const del = await pool.query(
        `DELETE FROM media_blobs mb
          WHERE mb.id = $1::uuid
            AND NOT EXISTS (SELECT 1 FROM media_assets ma WHERE ma.media_blob_id = $1::uuid)`,
        [blob.id]
      );
      if (del.rowCount === 1) {
        try { await storage.deleteDocument(blob.storageReference); } catch { /* best-effort */ }
      }
    } catch (err) {
      // 23503 = outro asset referenciou o blob durante a corrida → compartilhado, manter.
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23503') return;
      throw err;
    }
  },

  /**
   * Ingestão fail-closed: validações ANTES de qualquer efeito; dedup FÍSICA por hash
   * ANTES de gravar blob; asset LÓGICO criado/reusado SÓ no contexto do caller;
   * compensação nunca remove blob compartilhado.
   */
  async ingest(
    input: {
      tenantId: string;
      buffer: Buffer;
      mimeType: string;
      originalFilename?: string;
      license?: string | null;
      source?: 'company_suggestion' | 'curated' | 'seed';
      createdByActorId?: string | null;
      /** DECISION-0118 D1 — declaração contextual completa. */
      contextType?: MediaContextType;
      contextOwnerId?: string | null;
      purpose?: MediaPurpose;
      provenance?: string | null;
      idempotencyKey?: string | null;
    },
    deps: IngestMediaDeps = {}
  ): Promise<{ asset: MediaAsset; reusedExistingBlob: boolean; reusedExistingAsset: boolean }> {
    const mime = String(input.mimeType ?? '').trim().toLowerCase();
    if (!(MEDIA_ALLOWED_MIME as readonly string[]).includes(mime)) {
      throw new MediaAssetError(400, 'MEDIA_MIME_NOT_ALLOWED', `MIME '${mime}' não permitido para mídia de catálogo.`);
    }
    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      throw new MediaAssetError(400, 'MEDIA_EMPTY_FILE', 'Arquivo vazio.');
    }
    if (input.buffer.length > MEDIA_MAX_BYTES) {
      throw new MediaAssetError(400, 'MEDIA_TOO_LARGE', `Arquivo excede ${MEDIA_MAX_BYTES} bytes.`);
    }
    if (!magicBytesMatchMime(input.buffer, mime)) {
      throw new MediaAssetError(400, 'MEDIA_MAGIC_MISMATCH', 'Conteúdo não corresponde ao MIME declarado (magic bytes).');
    }

    const scanner = deps.scanner ?? resolveMalwareScanProvider();
    const scan = await scanner.scanDocument({ tenantId: input.tenantId, buffer: input.buffer, mimeType: mime });
    if (scan.status !== 'clean') {
      throw new MediaAssetError(422, 'MEDIA_SCAN_NOT_CLEAN', `Scan de malware não-clean (${scan.status}) — mídia bloqueada.`);
    }

    const contentHash = createHash('sha256').update(input.buffer).digest('hex');
    const storage = deps.storage ?? resolveDocumentStorageProvider();

    // ── Camada FÍSICA: dedup global por hash ANTES do storage ────────────────
    let blob = await this.findBlobByHash(contentHash);
    let blobCreatedHere = false;
    if (!blob) {
      const stored = await storage.storeDocument({
        tenantId: input.tenantId,
        buffer: input.buffer,
        mimeType: mime,
        originalFilename: input.originalFilename,
      });
      try {
        const ins = await pool.query<BlobRow>(
          `INSERT INTO media_blobs (content_hash, mime_type, size_bytes, storage_reference)
           VALUES ($1, $2, $3, $4)
           RETURNING id, content_hash, mime_type, size_bytes, storage_reference`,
          [contentHash, mime, input.buffer.length, stored.fileReference]
        );
        blob = toBlob(ins.rows[0]);
        blobCreatedHere = true;
      } catch (err) {
        // Corrida no UNIQUE(content_hash): outro processo gravou o blob primeiro —
        // remove o ARQUIVO recém-duplicado e reusa o blob vencedor.
        try { await storage.deleteDocument(stored.fileReference); } catch { /* best-effort */ }
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          blob = await this.findBlobByHash(contentHash);
        }
        if (!blob) throw err;
      }
    }

    // ── Camada LÓGICA: DECLARAÇÃO CONTEXTUAL (DECISION-0118 D1) ─────────────
    const source = input.source ?? 'company_suggestion';
    const createdByActorId = input.createdByActorId ?? null;
    const contextType = input.contextType ?? (source === 'company_suggestion' ? 'canonical_suggestion' : 'platform');
    const contextOwnerId = input.contextOwnerId ?? null;
    const purpose = input.purpose ?? (source === 'company_suggestion' ? 'canonical_catalog' : 'platform_curation');
    // Canonicalização PRÉ-PERSISTÊNCIA (semântica normada): trim ASCII + ''⇒NULL
    // (NULL ≡ vazio por DECISÃO explícita, via normalização — case preservado).
    const provenance = canonicalizeContextDimension(input.provenance);
    const license = canonicalizeContextDimension(input.license);
    const idempotencyKey = input.idempotencyKey ?? null;
    if (!(MEDIA_CONTEXT_TYPES as readonly string[]).includes(contextType)) {
      throw new MediaAssetError(400, 'MEDIA_CONTEXT_TYPE_INVALID', `context_type '${contextType}' fora do vocabulário.`);
    }
    if (!(MEDIA_PURPOSES as readonly string[]).includes(purpose)) {
      throw new MediaAssetError(400, 'MEDIA_PURPOSE_INVALID', `purpose '${purpose}' fora do vocabulário.`);
    }
    if (contextType === 'company' && !contextOwnerId) {
      throw new MediaAssetError(400, 'MEDIA_CONTEXT_OWNER_REQUIRED', 'Uso empresarial exige context_owner_id (empresa dona do uso).');
    }

    // Declaração contextual NORMALIZADA — usada pelo encoder V2 (função SQL,
    // fonte única) E pela recomparação material integral de qualquer match.
    const declaration: MediaContextDeclaration = {
      mediaBlobId: blob.id,
      originTenantId: input.tenantId,
      createdByActorId,
      contextType,
      contextOwnerId,
      source,
      purpose,
      license,
      provenance,
    };
    const contextFingerprint = await computeMediaContextFingerprintV2(declaration);

    try {
      // CHAVE EXPLÍCITA de idempotência: payload divergente = CONFLITO observável
      // (409); jamais sucesso falso, jamais alteração do registro anterior.
      // Hash NUNCA é prova de igualdade: recompara TODAS as dimensões materiais.
      if (idempotencyKey && createdByActorId) {
        const byKey = await this.findAssetByIdempotencyKey(input.tenantId, createdByActorId, idempotencyKey);
        if (byKey) {
          if (await materiallyEqualMediaContext(byKey.id, declaration)) {
            return { asset: byKey, reusedExistingBlob: true, reusedExistingAsset: true };
          }
          throw new MediaAssetError(409, 'MEDIA_IDEMPOTENCY_CONFLICT',
            'Idempotency-Key reutilizada com payload contextual divergente — nada foi alterado.');
        }
      }

      // CASO 1 — match de fingerprint NÃO basta (V2): reuso idempotente SÓ se a
      // comparação material INTEGRAL confirmar igualdade dimensão a dimensão.
      const candidate = await this.findAssetByContextFingerprint(contextFingerprint);
      if (candidate) {
        if (await materiallyEqualMediaContext(candidate.id, declaration)) {
          return { asset: candidate, reusedExistingBlob: true, reusedExistingAsset: true };
        }
        // Colisão de hash com contexto materialmente DIFERENTE: conflito
        // OBSERVÁVEL — nunca devolve o asset anterior, nunca descarta a nova
        // intenção, nunca altera o registro existente.
        throw new MediaAssetError(409, 'MEDIA_CONTEXT_FINGERPRINT_COLLISION',
          'Colisão de fingerprint contextual com declaração materialmente distinta — nada foi reutilizado nem alterado.');
      }

      // CASO 2 — mesmos bytes, contexto DIFERENTE ⇒ declaração NOVA sobre o mesmo blob.
      const persist = deps.persistAssetRow ?? defaultPersistAssetRow;
      let row: AssetRow;
      try {
        row = await persist({
          mediaBlobId: blob.id,
          source,
          license,
          createdByActorId,
          originTenantId: input.tenantId,
          contextType,
          contextOwnerId,
          purpose,
          provenance,
          contextFingerprint,
          contextIdentityVersion: MEDIA_CONTEXT_IDENTITY_VERSION,
          idempotencyKey,
        });
      } catch (err) {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          // Corrida no UNIQUE de fingerprint: vencedor TAMBÉM é recomparado
          // materialmente — igual ⇒ idempotente; diferente ⇒ colisão observável.
          const winner = await this.findAssetByContextFingerprint(contextFingerprint);
          if (winner) {
            if (await materiallyEqualMediaContext(winner.id, declaration)) {
              return { asset: winner, reusedExistingBlob: true, reusedExistingAsset: true };
            }
            throw new MediaAssetError(409, 'MEDIA_CONTEXT_FINGERPRINT_COLLISION',
              'Colisão de fingerprint contextual com declaração materialmente distinta — nada foi reutilizado nem alterado.');
          }
          // Corrida no UNIQUE de idempotency_key: outro payload ganhou a chave —
          // recomparação material decide reuso × conflito.
          if (idempotencyKey && createdByActorId) {
            const byKey = await this.findAssetByIdempotencyKey(input.tenantId, createdByActorId, idempotencyKey);
            if (byKey) {
              if (await materiallyEqualMediaContext(byKey.id, declaration)) {
                return { asset: byKey, reusedExistingBlob: true, reusedExistingAsset: true };
              }
              throw new MediaAssetError(409, 'MEDIA_IDEMPOTENCY_CONFLICT',
                'Idempotency-Key reutilizada com payload contextual divergente — nada foi alterado.');
            }
          }
        }
        throw err;
      }

      const asset = toAsset(row);
      await insertCatalogEvent({
        entityType: 'media_asset',
        entityId: asset.id,
        eventType: 'media_ingested',
        payload: {
          mediaBlobId: blob.id,
          mimeType: mime,
          sizeBytes: asset.sizeBytes,
          reusedExistingBlob: !blobCreatedHere,
          contextType,
          contextOwnerId,
          purpose,
        },
        actorId: createdByActorId,
        tenantId: input.tenantId,
      });
      return { asset, reusedExistingBlob: !blobCreatedHere, reusedExistingAsset: false };
    } catch (err) {
      // COMPENSAÇÃO: só se o blob nasceu NESTA chamada e ninguém mais o referencia
      // (blob COMPARTILHADO jamais é apagado — guarda NOT EXISTS + FK RESTRICT).
      if (blobCreatedHere) {
        await this.deleteBlobIfUnreferenced(blob, storage);
      }
      throw err;
    }
  },

  /**
   * Moderação curatorial (admin humano): pending → approved. Idempotente.
   * Moderação vive no ASSET LÓGICO: aprovar o asset de um tenant NUNCA altera
   * o asset de outro tenant que aponte para o mesmo blob.
   */
  async approve(input: { mediaAssetId: string; curatorActorId: string }): Promise<MediaAsset> {
    const asset = await this.findById(input.mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    if (asset.moderationStatus === 'approved') return asset;
    await pool.query(
      `UPDATE media_assets SET moderation_status = 'approved', updated_at = NOW() WHERE id = $1::uuid`,
      [asset.id]
    );
    await insertCatalogEvent({
      entityType: 'media_asset',
      entityId: asset.id,
      eventType: 'media_approved',
      payload: {},
      actorId: input.curatorActorId,
      tenantId: asset.originTenantId,
    });
    return { ...asset, moderationStatus: 'approved' };
  },

  /**
   * Attach CURATORIAL a entidade canônica (produto/variante/serviço).
   * Exige asset APROVADO. Idempotente (UNIQUE por par). Não copia blob.
   * O ato curatorial é o "fluxo explícito de referência" que torna o ASSET público.
   */
  async attachToCanonical(input: {
    entity: 'product' | 'variant' | 'service';
    entityId: string;
    mediaAssetId: string;
    mediaRole?: 'primary' | 'gallery';
    curatorActorId: string;
  }): Promise<void> {
    const asset = await this.findById(input.mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    if (asset.moderationStatus !== 'approved') {
      throw new MediaAssetError(422, 'MEDIA_NOT_APPROVED', 'Mídia ainda não aprovada pela curadoria — attach canônico bloqueado.');
    }
    const table =
      input.entity === 'product' ? 'canonical_product_media'
      : input.entity === 'variant' ? 'canonical_variant_media'
      : 'canonical_service_media';
    const fk =
      input.entity === 'product' ? 'canonical_product_id'
      : input.entity === 'variant' ? 'canonical_variant_id'
      : 'canonical_service_id';
    await pool.query(
      `INSERT INTO ${table} (${fk}, media_asset_id, media_role, created_by_actor_id)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
       ON CONFLICT (${fk}, media_asset_id) DO NOTHING`,
      [input.entityId, input.mediaAssetId, input.mediaRole ?? 'gallery', input.curatorActorId]
    );
  },

  /** Lista mídia canônica de uma entidade (assets aprovados; projeção interna). */
  async listCanonicalMedia(entity: 'product' | 'variant' | 'service', entityId: string): Promise<MediaAsset[]> {
    const table =
      entity === 'product' ? 'canonical_product_media'
      : entity === 'variant' ? 'canonical_variant_media'
      : 'canonical_service_media';
    const fk =
      entity === 'product' ? 'canonical_product_id'
      : entity === 'variant' ? 'canonical_variant_id'
      : 'canonical_service_id';
    const r = await pool.query<AssetRow>(
      `SELECT ${ASSET_SELECT}
         FROM ${table} rel
         JOIN ${ASSET_FROM} ON ma.id = rel.media_asset_id
        WHERE rel.${fk} = $1::uuid AND ma.moderation_status = 'approved'
        ORDER BY rel.media_role = 'primary' DESC, rel.position ASC, rel.created_at ASC`,
      [entityId]
    );
    return r.rows.map(toAsset);
  },

  /**
   * Complemento EMPRESARIAL (isolado por CONTEXTO — DECISION-0118 D1).
   * Autoridade sobre o OWNER actor (canRepresentActor) é provada na ROTA; aqui se
   * prova que o ASSET pertence ao CONTEXTO EMPRESARIAL do alvo do attach:
   * declaração `context_type='company'` cuja `context_owner_id` é a MESMA empresa
   * do alvo — OU mídia canônica pública aprovada (referência explícita).
   * O mesmo humano representar duas empresas NÃO torna os ativos privados de uma
   * anexáveis pela outra. Cross-tenant privado → 404 sem oráculo.
   */
  async attachBusinessMedia(input: {
    tenantId: string;
    subjectUserId: string;
    ownerActorId: string;
    attachedToType: 'product_offer' | 'service_offering' | 'company' | 'establishment';
    attachedToId: string;
    mediaAssetId: string;
    caption?: string | null;
  }): Promise<void> {
    const asset = await this.findById(input.mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    const isCanonicalPublic =
      asset.moderationStatus === 'approved' && (await this.isAttachedToCanonical(asset.id));
    if (!isCanonicalPublic) {
      if (asset.originTenantId !== input.tenantId) {
        // Cross-tenant privado: invisível — sem oráculo de existência.
        throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
      }
      // Empresa-alvo do attach: 'company' usa o próprio alvo; demais derivam do
      // page actor dono (actors.company_id). PF sem empresa ⇒ sem contexto empresarial.
      let targetCompanyId: string | null = null;
      if (input.attachedToType === 'company') {
        targetCompanyId = input.attachedToId;
      } else {
        const owner = await pool.query<{ company_id: string | null }>(
          `SELECT company_id FROM actors WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
          [input.ownerActorId, input.tenantId]
        );
        targetCompanyId = owner.rows[0]?.company_id ?? null;
      }
      const contextMatches =
        asset.contextType === 'company' &&
        asset.contextOwnerId !== null &&
        targetCompanyId !== null &&
        asset.contextOwnerId === targetCompanyId;
      if (!contextMatches) {
        throw new MediaAssetError(403, 'MEDIA_ASSET_FOREIGN',
          'Asset lógico de outro contexto — anexe declaração empresarial DESTA empresa ou mídia canônica pública.');
      }
    }
    await pool.query(
      `INSERT INTO business_media (tenant_id, owner_actor_id, attached_to_type, attached_to_id, media_asset_id, caption)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6)
       ON CONFLICT (attached_to_type, attached_to_id, media_asset_id) DO NOTHING`,
      [input.tenantId, input.ownerActorId, input.attachedToType, input.attachedToId, input.mediaAssetId, input.caption ?? null]
    );
  },

  async listBusinessMedia(tenantId: string, attachedToType: string, attachedToId: string): Promise<Array<MediaAsset & { ownerActorId: string }>> {
    const r = await pool.query<AssetRow & { owner_actor_id: string }>(
      `SELECT ${ASSET_SELECT}, bm.owner_actor_id
         FROM business_media bm
         JOIN ${ASSET_FROM} ON ma.id = bm.media_asset_id
        WHERE bm.tenant_id = $1::uuid AND bm.attached_to_type = $2 AND bm.attached_to_id = $3::uuid
        ORDER BY bm.created_at ASC`,
      [tenantId, attachedToType, attachedToId]
    );
    return r.rows.map((row) => ({ ...toAsset(row), ownerActorId: row.owner_actor_id }));
  },

  /**
   * Retire de RELAÇÃO canônica: remove o vínculo, NUNCA o blob/asset
   * (content-addressed; pode estar referenciado por outras entidades).
   */
  async detachFromCanonical(input: {
    entity: 'product' | 'variant' | 'service';
    entityId: string;
    mediaAssetId: string;
  }): Promise<void> {
    const table =
      input.entity === 'product' ? 'canonical_product_media'
      : input.entity === 'variant' ? 'canonical_variant_media'
      : 'canonical_service_media';
    const fk =
      input.entity === 'product' ? 'canonical_product_id'
      : input.entity === 'variant' ? 'canonical_variant_id'
      : 'canonical_service_id';
    await pool.query(
      `DELETE FROM ${table} WHERE ${fk} = $1::uuid AND media_asset_id = $2::uuid`,
      [input.entityId, input.mediaAssetId]
    );
  },

  /**
   * Leitura AUTORIZADA do conteúdo: resolve o asset lógico + visibilidade
   * (canReadMediaAsset). Asset invisível ao caller = 404 (sem oráculo).
   * Hash/blob/storage_reference NUNCA autorizam acesso.
   */
  async readContentAuthorized(
    mediaAssetId: string,
    ctx: MediaReadContext,
    deps: { storage?: DocumentStoragePort } = {}
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const asset = await this.findById(mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    const visible = await this.canReadMediaAsset(asset, ctx);
    if (!visible) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    const blobRef = await pool.query<{ storage_reference: string }>(
      `SELECT mb.storage_reference FROM media_blobs mb WHERE mb.id = $1::uuid`,
      [asset.mediaBlobId]
    );
    const storage = deps.storage ?? resolveDocumentStorageProvider();
    const read = await storage.readDocument(blobRef.rows[0].storage_reference);
    return { buffer: read.buffer, mimeType: asset.mimeType };
  },
};

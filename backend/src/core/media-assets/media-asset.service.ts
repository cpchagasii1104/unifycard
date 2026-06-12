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

/** Camada LÓGICA — campos físicos projetados do blob por JOIN (leitura interna). */
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
}

const ASSET_SELECT =
  'ma.id, ma.media_blob_id, mb.mime_type, mb.size_bytes, ma.source, ma.license, ma.version, ' +
  'ma.moderation_status, ma.created_by_actor_id, ma.origin_tenant_id';
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
  /** Curador humano (requireRole admin já provado na rota OU rbac consultado pela rota). */
  isCurator?: boolean;
}

/** Test seam (mesmo molde do submitKybDocument): storage/scanner/persist fakes no e2e. */
export interface IngestMediaDeps {
  storage?: DocumentStoragePort;
  scanner?: MalwareScanPort;
  /** Override do INSERT do ASSET LÓGICO (e2e de compensação ref-count-safe). */
  persistAssetRow?: (params: {
    mediaBlobId: string;
    source: string;
    license: string | null;
    createdByActorId: string | null;
    originTenantId: string | null;
  }) => Promise<AssetRow>;
}

async function defaultPersistAssetRow(params: {
  mediaBlobId: string;
  source: string;
  license: string | null;
  createdByActorId: string | null;
  originTenantId: string | null;
}): Promise<AssetRow> {
  const r = await pool.query<AssetRow>(
    `WITH ins AS (
       INSERT INTO media_assets (media_blob_id, source, license, created_by_actor_id, origin_tenant_id)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid)
       RETURNING id, media_blob_id, source, license, version, moderation_status, created_by_actor_id, origin_tenant_id
     )
     SELECT ins.id, ins.media_blob_id, mb.mime_type, mb.size_bytes, ins.source, ins.license,
            ins.version, ins.moderation_status, ins.created_by_actor_id, ins.origin_tenant_id
       FROM ins JOIN media_blobs mb ON mb.id = ins.media_blob_id`,
    [params.mediaBlobId, params.source, params.license, params.createdByActorId, params.originTenantId]
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
   * Reuso LÓGICO context-scoped: mesmo blob + mesmo tenant + mesmo actor criador
   * = asset idempotente. Contexto diferente NUNCA reusa asset de terceiro.
   */
  async findAssetByBlobAndContext(mediaBlobId: string, originTenantId: string, createdByActorId: string): Promise<MediaAsset | null> {
    const r = await pool.query<AssetRow>(
      `SELECT ${ASSET_SELECT} FROM ${ASSET_FROM}
        WHERE ma.media_blob_id = $1::uuid
          AND ma.origin_tenant_id = $2::uuid
          AND ma.created_by_actor_id = $3::uuid
        LIMIT 1`,
      [mediaBlobId, originTenantId, createdByActorId]
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
   * Resolver de VISIBILIDADE do asset lógico (metadata e arquivo):
   *   (a) canônica pública: approved + vinculada a produto/variante/serviço canônico;
   *   (b) contexto do criador: mesmo tenant + canRepresentActor sobre o actor criador;
   *   (c) curador humano (moderação precisa VER o pending).
   * Cross-tenant privado: invisível (caller recebe 404 — sem oráculo de existência).
   */
  async canReadMediaAsset(asset: MediaAsset, ctx: MediaReadContext): Promise<boolean> {
    if (asset.moderationStatus === 'approved' && (await this.isAttachedToCanonical(asset.id))) {
      return true;
    }
    if (ctx.isCurator === true && asset.originTenantId === ctx.tenantId) {
      return true;
    }
    if (asset.originTenantId === ctx.tenantId && asset.createdByActorId) {
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

    // ── Camada LÓGICA: reuso SÓ no contexto do caller (tenant + actor criador) ──
    const source = input.source ?? 'company_suggestion';
    const createdByActorId = input.createdByActorId ?? null;
    if (createdByActorId) {
      const own = await this.findAssetByBlobAndContext(blob.id, input.tenantId, createdByActorId);
      if (own) {
        return { asset: own, reusedExistingBlob: true, reusedExistingAsset: true };
      }
    }

    const persist = deps.persistAssetRow ?? defaultPersistAssetRow;
    let row: AssetRow;
    try {
      row = await persist({
        mediaBlobId: blob.id,
        source,
        license: input.license ?? null,
        createdByActorId,
        originTenantId: input.tenantId,
      });
    } catch (err) {
      // Corrida no UNIQUE de contexto: o próprio contexto inseriu em paralelo → idempotente.
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505' && createdByActorId) {
        const winner = await this.findAssetByBlobAndContext(blob.id, input.tenantId, createdByActorId);
        if (winner) return { asset: winner, reusedExistingBlob: true, reusedExistingAsset: true };
      }
      // COMPENSAÇÃO: só se o blob nasceu NESTA chamada e ninguém mais o referencia.
      if (blobCreatedHere) {
        await this.deleteBlobIfUnreferenced(blob, storage);
      }
      throw err;
    }

    const asset = toAsset(row);
    await insertCatalogEvent({
      entityType: 'media_asset',
      entityId: asset.id,
      eventType: 'media_ingested',
      payload: { mediaBlobId: blob.id, mimeType: mime, sizeBytes: asset.sizeBytes, reusedExistingBlob: !blobCreatedHere },
      actorId: createdByActorId,
      tenantId: input.tenantId,
    });
    return { asset, reusedExistingBlob: !blobCreatedHere, reusedExistingAsset: false };
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
   * Complemento EMPRESARIAL (isolado por actor; nunca substitui a canônica).
   * Autoridade sobre o OWNER (canRepresentActor) é provada na ROTA; aqui se prova
   * que o ASSET pertence ao contexto do caller: mesmo tenant E (contexto do criador
   * representável OU mídia canônica pública aprovada — referência explícita).
   * Asset privado de OUTRO tenant/contexto: inanexável (cross-tenant → 404 sem oráculo).
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
      const creatorOk =
        asset.createdByActorId !== null &&
        (await authorizationService.canRepresentActor(input.tenantId, input.subjectUserId, asset.createdByActorId));
      if (!creatorOk) {
        throw new MediaAssetError(403, 'MEDIA_ASSET_FOREIGN', 'Asset lógico de outro contexto — anexe mídia do próprio contexto ou mídia canônica pública.');
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

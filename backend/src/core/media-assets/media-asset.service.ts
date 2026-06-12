// media-asset.service.ts
// DECISION-0117 C — mídia canônica CONTENT-ADDRESSED.
//
// Pipeline no molde document-storage PJ (DECISION-0112): MIME allowlist →
// magic bytes → MalwareScanPort (clean-only) → hash sha-256 → DEDUP por
// content_hash (mesmo conteúdo NUNCA grava novo blob) → StoragePort (referência
// opaca) → INSERT media_assets, com COMPENSAÇÃO (deleteDocument) se o INSERT
// falhar após o storage. Mídia canônica é reutilizável; attach canônico é ato
// CURATORIAL; mídia empresarial fica isolada por actor (business_media).
// Provider de produção FORA desta macrofrente. Zero Bank writer.

import { createHash } from 'crypto';
import { pool } from '../database/pool';
import type { DocumentStoragePort } from '../document-storage/document-storage.port';
import { resolveDocumentStorageProvider } from '../document-storage/document-storage.provider';
import type { MalwareScanPort } from '../document-malware-scan/document-malware-scan.port';
import { resolveMalwareScanProvider } from '../document-malware-scan/document-malware-scan.provider';
import { magicBytesMatchMime } from '../kyb-documents/kyb-document-validation';
import { insertCatalogEvent } from '../catalog/canonical/canonical-variant.service';

export class MediaAssetError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'MediaAssetError';
  }
}

/** Allowlist de mídia de catálogo (imagens; subset da allowlist do storage). */
export const MEDIA_ALLOWED_MIME = ['image/jpeg', 'image/png'] as const;
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export interface MediaAsset {
  id: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  storageReference: string;
  source: string;
  license: string | null;
  version: number;
  moderationStatus: string;
  createdByActorId: string | null;
  originTenantId: string | null;
}

interface MediaRow {
  id: string;
  content_hash: string;
  mime_type: string;
  size_bytes: string | number;
  storage_reference: string;
  source: string;
  license: string | null;
  version: number;
  moderation_status: string;
  created_by_actor_id: string | null;
  origin_tenant_id: string | null;
}

const MA_SELECT =
  'id, content_hash, mime_type, size_bytes, storage_reference, source, license, version, ' +
  'moderation_status, created_by_actor_id, origin_tenant_id';

function toAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    contentHash: row.content_hash,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storageReference: row.storage_reference,
    source: row.source,
    license: row.license,
    version: row.version,
    moderationStatus: row.moderation_status,
    createdByActorId: row.created_by_actor_id,
    originTenantId: row.origin_tenant_id,
  };
}

/** Test seam (mesmo molde do submitKybDocument): storage/scanner/persist fakes no e2e. */
export interface IngestMediaDeps {
  storage?: DocumentStoragePort;
  scanner?: MalwareScanPort;
  /** Override do INSERT (e2e de compensação). */
  persistAssetRow?: (params: {
    contentHash: string;
    mimeType: string;
    sizeBytes: number;
    storageReference: string;
    source: string;
    license: string | null;
    createdByActorId: string | null;
    originTenantId: string | null;
  }) => Promise<MediaRow>;
}

async function defaultPersistAssetRow(params: {
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  storageReference: string;
  source: string;
  license: string | null;
  createdByActorId: string | null;
  originTenantId: string | null;
}): Promise<MediaRow> {
  const r = await pool.query<MediaRow>(
    `INSERT INTO media_assets (
       content_hash, mime_type, size_bytes, storage_reference, source, license,
       created_by_actor_id, origin_tenant_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${MA_SELECT}`,
    [
      params.contentHash,
      params.mimeType,
      params.sizeBytes,
      params.storageReference,
      params.source,
      params.license,
      params.createdByActorId,
      params.originTenantId,
    ]
  );
  return r.rows[0];
}

export const mediaAssetService = {
  async findById(mediaAssetId: string): Promise<MediaAsset | null> {
    const r = await pool.query<MediaRow>(
      `SELECT ${MA_SELECT} FROM media_assets WHERE id = $1::uuid LIMIT 1`,
      [mediaAssetId]
    );
    return r.rows[0] ? toAsset(r.rows[0]) : null;
  },

  async findByContentHash(contentHash: string): Promise<MediaAsset | null> {
    const r = await pool.query<MediaRow>(
      `SELECT ${MA_SELECT} FROM media_assets WHERE content_hash = $1 LIMIT 1`,
      [contentHash]
    );
    return r.rows[0] ? toAsset(r.rows[0]) : null;
  },

  /**
   * Ingestão fail-closed: validações ANTES de qualquer efeito; dedup por hash
   * ANTES de gravar blob; compensação se o INSERT falhar após o storage.
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
  ): Promise<{ asset: MediaAsset; reusedExistingBlob: boolean }> {
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

    // DEDUP content-addressed: mesmo conteúdo ⇒ mesmo asset; NENHUM blob novo.
    const existing = await this.findByContentHash(contentHash);
    if (existing) {
      return { asset: existing, reusedExistingBlob: true };
    }

    const storage = deps.storage ?? resolveDocumentStorageProvider();
    const stored = await storage.storeDocument({
      tenantId: input.tenantId,
      buffer: input.buffer,
      mimeType: mime,
      originalFilename: input.originalFilename,
    });

    const persist = deps.persistAssetRow ?? defaultPersistAssetRow;
    let row: MediaRow;
    try {
      row = await persist({
        contentHash,
        mimeType: mime,
        sizeBytes: input.buffer.length,
        storageReference: stored.fileReference,
        source: input.source ?? 'company_suggestion',
        license: input.license ?? null,
        createdByActorId: input.createdByActorId ?? null,
        originTenantId: input.tenantId,
      });
    } catch (err) {
      // Corrida concorrente no UNIQUE(content_hash): outro processo ganhou —
      // remove o blob recém-gravado e reutiliza o asset vencedor.
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
        try { await storage.deleteDocument(stored.fileReference); } catch { /* best-effort */ }
        const winner = await this.findByContentHash(contentHash);
        if (winner) return { asset: winner, reusedExistingBlob: true };
      }
      // COMPENSAÇÃO fail-closed: INSERT falhou após o storage → blob removido.
      try { await storage.deleteDocument(stored.fileReference); } catch { /* best-effort */ }
      throw err;
    }

    const asset = toAsset(row);
    await insertCatalogEvent({
      entityType: 'media_asset',
      entityId: asset.id,
      eventType: 'media_ingested',
      payload: { contentHash, mimeType: mime, sizeBytes: asset.sizeBytes },
      actorId: input.createdByActorId ?? null,
      tenantId: input.tenantId,
    });
    return { asset, reusedExistingBlob: false };
  },

  /** Moderação curatorial (admin humano): pending → approved. Idempotente. */
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

  /** Lista mídia canônica de uma entidade (assets aprovados). */
  async listCanonicalMedia(entity: 'product' | 'variant' | 'service', entityId: string): Promise<MediaAsset[]> {
    const table =
      entity === 'product' ? 'canonical_product_media'
      : entity === 'variant' ? 'canonical_variant_media'
      : 'canonical_service_media';
    const fk =
      entity === 'product' ? 'canonical_product_id'
      : entity === 'variant' ? 'canonical_variant_id'
      : 'canonical_service_id';
    const r = await pool.query<MediaRow>(
      `SELECT ${MA_SELECT.split(', ').map((c) => 'ma.' + c).join(', ')}
         FROM ${table} rel
         JOIN media_assets ma ON ma.id = rel.media_asset_id
        WHERE rel.${fk} = $1::uuid AND ma.moderation_status = 'approved'
        ORDER BY rel.media_role = 'primary' DESC, rel.position ASC, rel.created_at ASC`,
      [entityId]
    );
    return r.rows.map(toAsset);
  },

  /**
   * Complemento EMPRESARIAL (isolado por actor; nunca substitui a canônica).
   * A autoridade (canRepresentActor sobre ownerActorId) é provada na ROTA.
   */
  async attachBusinessMedia(input: {
    tenantId: string;
    ownerActorId: string;
    attachedToType: 'product_offer' | 'service_offering' | 'company' | 'establishment';
    attachedToId: string;
    mediaAssetId: string;
    caption?: string | null;
  }): Promise<void> {
    const asset = await this.findById(input.mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    await pool.query(
      `INSERT INTO business_media (tenant_id, owner_actor_id, attached_to_type, attached_to_id, media_asset_id, caption)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6)
       ON CONFLICT (attached_to_type, attached_to_id, media_asset_id) DO NOTHING`,
      [input.tenantId, input.ownerActorId, input.attachedToType, input.attachedToId, input.mediaAssetId, input.caption ?? null]
    );
  },

  async listBusinessMedia(tenantId: string, attachedToType: string, attachedToId: string): Promise<Array<MediaAsset & { ownerActorId: string }>> {
    const r = await pool.query<MediaRow & { owner_actor_id: string }>(
      `SELECT ${MA_SELECT.split(', ').map((c) => 'ma.' + c).join(', ')}, bm.owner_actor_id
         FROM business_media bm
         JOIN media_assets ma ON ma.id = bm.media_asset_id
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

  /** Lê o conteúdo (review/preview dev). */
  async readContent(mediaAssetId: string, deps: { storage?: DocumentStoragePort } = {}): Promise<{ buffer: Buffer; mimeType: string }> {
    const asset = await this.findById(mediaAssetId);
    if (!asset) throw new MediaAssetError(404, 'MEDIA_NOT_FOUND', 'Asset inexistente.');
    const storage = deps.storage ?? resolveDocumentStorageProvider();
    const read = await storage.readDocument(asset.storageReference);
    return { buffer: read.buffer, mimeType: asset.mimeType };
  },
};

// media-assets.routes.ts
// DECISION-0117 C + F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE
// — superfícies de mídia canônica (prefixo /catalog/media).
//
// Upload (sugestão empresarial): autenticado + actor humano por LEITURA +
// canManageCompany (fail-closed; sem cura). Moderação/attach canônico = admin
// humano. Complemento empresarial = canRepresentActor sobre o owner actor +
// asset do PRÓPRIO contexto (ou canônico público). Leitura de arquivo é
// AUTORIZADA (canônica pública / contexto do criador / curador) — asset privado
// de outro tenant é invisível (404). Mesmo conteúdo NUNCA duplica BLOB físico,
// mas cada tenant/contexto tem seu ASSET lógico. Zero Bank writer.

import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { socialPortsRegistry } from '../social/ports-registry';
import { authorizationService } from '../authorization/authorization.service';
import { rbacService } from '../rbac/rbac.service';
import { mediaAssetService, MediaAssetError, MEDIA_MAX_BYTES, toPublicMediaProjection } from './media-asset.service';

const attachCanonicalSchema = z.object({
  entity: z.enum(['product', 'variant', 'service']),
  entityId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  mediaRole: z.enum(['primary', 'gallery']).optional(),
});

const attachBusinessSchema = z.object({
  ownerActorId: z.string().uuid(),
  attachedToType: z.enum(['product_offer', 'service_offering', 'company', 'establishment']),
  attachedToId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  caption: z.string().max(500).optional().nullable(),
});

const mediaAssetsRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, { limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } });

  function subject(req: { user?: { userId?: string; globalUserId?: string } }): { userId: string; globalUserId: string } | null {
    const userId = req.user?.userId;
    const globalUserId = req.user?.globalUserId;
    if (!userId || !globalUserId) return null;
    return { userId, globalUserId };
  }

  async function humanActorId(tenantId: string, userId: string): Promise<string | null> {
    const actor = await socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId);
    return actor?.actor_id ?? null;
  }

  /**
   * POST /assets?companyId=&purpose= — upload de mídia (DECLARAÇÃO CONTEXTUAL,
   * DECISION-0118 D1). multipart: file. Dimensões: purpose (business_media |
   * canonical_catalog; default canonical_catalog), license, provenance,
   * idempotencyKey. A empresa (companyId) é o CONTEXT_OWNER da declaração —
   * mesmo humano + mesmos bytes em empresas/finalidades distintas = declarações
   * distintas (nenhuma dimensão descartada em silêncio).
   */
  fastify.post<{ Querystring: { companyId?: string; license?: string; purpose?: string; provenance?: string; idempotencyKey?: string } }>('/assets', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const companyId = String(req.query.companyId ?? '').trim();
    if (!companyId) {
      return reply.status(400).send({ ok: false, code: 'MEDIA_COMPANY_REQUIRED', message: 'companyId é obrigatório (declaração empresarial).' });
    }
    const purpose = String(req.query.purpose ?? 'canonical_catalog').trim();
    if (purpose !== 'business_media' && purpose !== 'canonical_catalog') {
      return reply.status(400).send({ ok: false, code: 'MEDIA_PURPOSE_INVALID', message: 'purpose deve ser business_media ou canonical_catalog.' });
    }
    const actorId = await humanActorId(req.tenant.id, sub.userId);
    if (!actorId) return reply.status(403).send({ ok: false, code: 'MEDIA_ACTOR_MISSING' });
    const { companiesService } = await import('../companies/companies.service');
    const canManage = await companiesService.canManageCompany(req.tenant.id, companyId, sub.globalUserId);
    if (!canManage) return reply.status(403).send({ ok: false, code: 'MEDIA_FORBIDDEN' });

    const data = await req.file();
    if (!data) return reply.status(400).send({ ok: false, code: 'MEDIA_FILE_REQUIRED', message: 'Arquivo é obrigatório (multipart).' });
    const buffer = await data.toBuffer();

    try {
      const result = await mediaAssetService.ingest({
        tenantId: req.tenant.id,
        buffer,
        mimeType: data.mimetype,
        originalFilename: data.filename,
        license: req.query.license ?? null,
        source: 'company_suggestion',
        createdByActorId: actorId,
        // purpose dirige o contexto: uso empresarial ≠ sugestão canônica.
        contextType: purpose === 'business_media' ? 'company' : 'canonical_suggestion',
        contextOwnerId: companyId,
        purpose,
        provenance: req.query.provenance ?? null,
        idempotencyKey: req.query.idempotencyKey ?? null,
      });
      // Hash global NÃO é exposto (não é identificador público de mídia privada).
      // reusedExistingBlob = bytes físicos reutilizados; o ASSET é sempre do contexto do caller.
      return reply.status(result.reusedExistingAsset ? 200 : 201).send({
        ok: true,
        data: {
          mediaAssetId: result.asset.id,
          moderationStatus: result.asset.moderationStatus,
          reusedExistingBlob: result.reusedExistingBlob,
          reusedExistingAsset: result.reusedExistingAsset,
        },
      });
    } catch (err) {
      if (err instanceof MediaAssetError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  /** Moderação curatorial (admin humano). */
  fastify.post<{ Params: { mediaAssetId: string } }>(
    '/assets/:mediaAssetId/approve',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      const sub = subject(req as never);
      if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
      const curator = await humanActorId(req.tenant.id, sub.userId);
      if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
      try {
        const asset = await mediaAssetService.approve({ mediaAssetId: req.params.mediaAssetId, curatorActorId: curator });
        return reply.send({ ok: true, data: { mediaAssetId: asset.id, moderationStatus: asset.moderationStatus } });
      } catch (err) {
        if (err instanceof MediaAssetError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
        throw err;
      }
    }
  );

  /** Attach canônico (curatorial, admin). */
  fastify.post('/attach/canonical', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = attachCanonicalSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, code: 'MEDIA_ATTACH_BAD_REQUEST', issues: parsed.error.issues });
    const curator = await humanActorId(req.tenant.id, sub.userId);
    if (!curator) return reply.status(403).send({ ok: false, code: 'CURATOR_ACTOR_MISSING' });
    try {
      await mediaAssetService.attachToCanonical({
        entity: parsed.data.entity as 'product' | 'variant' | 'service',
        entityId: parsed.data.entityId as string,
        mediaAssetId: parsed.data.mediaAssetId as string,
        mediaRole: parsed.data.mediaRole as 'primary' | 'gallery' | undefined,
        curatorActorId: curator,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof MediaAssetError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  /** Detach canônico (curatorial; remove o vínculo, preserva asset/blob). */
  fastify.post('/detach/canonical', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
    const parsed = attachCanonicalSchema.omit({ mediaRole: true }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, code: 'MEDIA_DETACH_BAD_REQUEST', issues: parsed.error.issues });
    await mediaAssetService.detachFromCanonical({
      entity: parsed.data.entity as 'product' | 'variant' | 'service',
      entityId: parsed.data.entityId as string,
      mediaAssetId: parsed.data.mediaAssetId as string,
    });
    return reply.send({ ok: true });
  });

  /** Complemento empresarial — exige canRepresentActor sobre o owner (DECISION-0113). */
  fastify.post('/attach/business', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    const parsed = attachBusinessSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, code: 'MEDIA_ATTACH_BAD_REQUEST', issues: parsed.error.issues });
    const ownerActorId = parsed.data.ownerActorId as string;
    const canRep = await authorizationService.canRepresentActor(req.tenant.id, sub.userId, ownerActorId);
    if (!canRep) {
      return reply.status(403).send({ ok: false, code: 'MEDIA_ACTOR_NOT_REPRESENTABLE', message: 'Sem autoridade sobre o actor dono da mídia empresarial.' });
    }
    try {
      await mediaAssetService.attachBusinessMedia({
        tenantId: req.tenant.id,
        subjectUserId: sub.userId,
        ownerActorId,
        attachedToType: parsed.data.attachedToType as 'product_offer' | 'service_offering' | 'company' | 'establishment',
        attachedToId: parsed.data.attachedToId as string,
        mediaAssetId: parsed.data.mediaAssetId as string,
        caption: parsed.data.caption ?? null,
      });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof MediaAssetError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });

  /**
   * Mídia canônica de uma entidade (assets aprovados; reutilizável por todas as
   * ofertas). Projeção PÚBLICA: sem autoria/origem/storage — metadata privada
   * do uploader nunca vaza no payload público.
   */
  fastify.get<{ Params: { entity: string; entityId: string } }>(
    '/canonical/:entity/:entityId',
    async (req, reply) => {
      const entity = req.params.entity;
      if (!['product', 'variant', 'service'].includes(entity)) {
        return reply.status(400).send({ ok: false, code: 'MEDIA_ENTITY_INVALID' });
      }
      const assets = await mediaAssetService.listCanonicalMedia(entity as 'product' | 'variant' | 'service', req.params.entityId);
      return reply.send({ ok: true, data: assets.map(toPublicMediaProjection) });
    }
  );

  /**
   * Conteúdo do asset — leitura AUTORIZADA (canônica pública aprovada / contexto
   * do criador via canRepresentActor / curador admin). Asset privado de outro
   * tenant/contexto = 404 (sem oráculo de existência). Asset ID/hash/blob NÃO
   * autorizam acesso por si.
   */
  fastify.get<{ Params: { mediaAssetId: string } }>('/assets/:mediaAssetId/file', async (req, reply) => {
    const sub = subject(req as never);
    if (!sub) return reply.status(401).send({ ok: false, code: 'UNAUTHENTICATED' });
    try {
      const isCurator = await rbacService.userHasRole(req.tenant.id, sub.userId, 'admin');
      const { buffer, mimeType } = await mediaAssetService.readContentAuthorized(req.params.mediaAssetId, {
        tenantId: req.tenant.id,
        userId: sub.userId,
        globalUserId: sub.globalUserId,
        isCurator,
      });
      return reply.header('content-type', mimeType).send(buffer);
    } catch (err) {
      if (err instanceof MediaAssetError) return reply.status(err.statusCode).send({ ok: false, code: err.code, message: err.message });
      throw err;
    }
  });
};

export default mediaAssetsRoutes;

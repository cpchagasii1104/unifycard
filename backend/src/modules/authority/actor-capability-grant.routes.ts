// backend/src/modules/authority/actor-capability-grant.routes.ts
// F-ACTOR-CAPABILITY-GRANTS-ENDPOINTS-SLICE-1B (DECISION-0136). Endpoints de GESTÃO de grants.
//
// 🔴 ESCOPO: SÓ gestão de grants (criar/listar/revogar). NENHUM enforcement em rota de negócio.
// Autoridade do endpoint = user autenticado + actor operacional server-side + canRepresentActor(userId,
// scopeActorId) (gate no service). NÃO usa business-permissions.types.ts, NÃO usa rbac PermissionString/
// requirePermission, NÃO usa users.referral_code. Registry de capability = permission-keys.ts (allowlist
// não-financeira do Slice 1A via z.enum). Grant grava sempre actor_id; slug é só lookup humano.
// Representar o scope_actor permite gerir grants daquele scope; NÃO confundir com ter/receber grant nem ser owner.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueryWithTenant } from '@core/database/pool';
import { actorCapabilityGrantService } from './actor-capability-grant.service';
import { actorLookupService } from './actor-lookup.service';
import { NON_FINANCIAL_CAPABILITY_ALLOWLIST } from './actor-capability-grant.types';

const createGrantSchema = z
  .object({
    granteeActorSlug: z.string().min(1).max(255).optional(),
    granteeActorId: z.string().uuid().optional(),
    scopeActorId: z.string().uuid(),
    // 🔴 só allowlist não-financeira (Slice 1A); z.enum rejeita financeiro/desconhecido na borda.
    capabilityKey: z.enum(NON_FINANCIAL_CAPABILITY_ALLOWLIST),
    validUntil: z.string().datetime().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => Boolean(d.granteeActorSlug) || Boolean(d.granteeActorId), {
    message: 'Informe granteeActorSlug OU granteeActorId',
  });

const listGrantsSchema = z.object({
  // 🔴 scopeActorId OBRIGATÓRIO (fail-closed; sem listagem global).
  scopeActorId: z.string().uuid(),
  granteeActorId: z.string().uuid().optional(),
  capabilityKey: z.string().optional(),
  status: z.enum(['active', 'revoked', 'expired', 'suspended']).optional(),
});

const revokeGrantSchema = z.object({ reason: z.string().min(1).max(500) });

const actorCapabilityGrantRoutes: FastifyPluginAsync = async (fastify) => {
  // Resolve o grantee server-side → actor_id (slug fail-closed; actorId validado no tenant). Nunca referral.
  async function resolveGranteeActorId(
    tenantId: string,
    body: { granteeActorSlug?: string; granteeActorId?: string }
  ): Promise<string | null> {
    if (body.granteeActorId) {
      const row = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `SELECT id::text AS id FROM actors WHERE tenant_id=$1::uuid AND id=$2::uuid LIMIT 1`,
        [tenantId, body.granteeActorId]
      );
      return row ? row.id : null;
    }
    if (body.granteeActorSlug) {
      const r = await actorLookupService.resolveBySlug(tenantId, body.granteeActorSlug);
      return r ? r.actorId : null;
    }
    return null;
  }

  /**
   * POST /authority/grants — cria um grant (concedente representa o scope_actor).
   */
  fastify.post('/grants', async (req, reply) => {
    const tenantId = req.tenant?.id as string | undefined;
    const userId = (req as any).user?.userId as string | undefined;
    const actorId = (req as any).actionContext?.actorId as string | undefined;
    if (!tenantId) return reply.status(400).send({ error: 'Tenant não encontrado' });
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
    if (!actorId) return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });

    const parsed = createGrantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.errors });
    }

    const granteeActorId = await resolveGranteeActorId(tenantId, parsed.data);
    if (!granteeActorId) {
      // fail-closed não-leak: slug inexistente/ambíguo OU actorId fora do tenant → 404 uniforme.
      return reply.status(404).send({ ok: false, code: 'GRANT_GRANTEE_NOT_RESOLVED', error: 'Grantee actor não encontrado' });
    }

    try {
      const grant = await actorCapabilityGrantService.grant(tenantId, {
        granteeActorId,
        capabilityKey: parsed.data.capabilityKey,
        scopeActorId: parsed.data.scopeActorId,
        grantedByUserId: userId,
        grantedByActorId: actorId,
        validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
        reason: parsed.data.reason ?? null,
        // event_reason: narrativa factual do evento append-only (NOT NULL na trilha); distinta do
        // `reason` de negócio (opcional) — cai no `reason` quando informado, senão descreve o ato.
        eventReason: parsed.data.reason?.trim() || 'Capability grant concedido via POST /authority/grants',
      });
      return reply.status(201).send(grant);
    } catch (error: any) {
      const msg = error?.message || '';
      // duplicidade de grant ativo (UNIQUE parcial) → 409 explícito.
      if (/uidx_actor_capability_grants_active|duplicate key|unique/i.test(msg)) {
        return reply.status(409).send({ ok: false, code: 'GRANT_ALREADY_ACTIVE', error: 'Já existe um grant ativo para (grantee, capability, scope)' });
      }
      const sc = error?.statusCode ?? 500;
      return reply.status(sc).send({ ok: false, error: sc >= 500 ? 'Erro ao conceder grant' : msg });
    }
  });

  /**
   * GET /authority/grants — lista grants de um scope que o caller representa. scopeActorId OBRIGATÓRIO.
   */
  fastify.get('/grants', async (req, reply) => {
    const tenantId = req.tenant?.id as string | undefined;
    const userId = (req as any).user?.userId as string | undefined;
    if (!tenantId) return reply.status(400).send({ error: 'Tenant não encontrado' });
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });

    const parsed = listGrantsSchema.safeParse(req.query);
    if (!parsed.success) {
      // scopeActorId ausente/ inválido → 400 (sem listagem global).
      return reply.status(400).send({ error: 'scopeActorId é obrigatório', details: parsed.error.errors });
    }

    let canRep = false;
    try {
      canRep = await authorizationService.canRepresentActor(tenantId, userId, parsed.data.scopeActorId);
    } catch {
      canRep = false;
    }
    if (!canRep) {
      return reply.status(403).send({ error: 'Sem autoridade sobre o scope (scope_actor não representável)' });
    }

    const grants = await actorCapabilityGrantService.list(tenantId, {
      scopeActorId: parsed.data.scopeActorId,
      granteeActorId: parsed.data.granteeActorId,
      status: parsed.data.status,
    });
    const filtered = parsed.data.capabilityKey ? grants.filter((g) => g.capabilityKey === parsed.data.capabilityKey) : grants;
    return reply.send({ grants: filtered });
  });

  /**
   * POST /authority/grants/:grantId/revoke — revoga (status, NÃO delete físico). Caller representa o scope.
   */
  fastify.post<{ Params: { grantId: string } }>('/grants/:grantId/revoke', async (req, reply) => {
    const tenantId = req.tenant?.id as string | undefined;
    const userId = (req as any).user?.userId as string | undefined;
    const actorId = (req as any).actionContext?.actorId as string | undefined;
    if (!tenantId) return reply.status(400).send({ error: 'Tenant não encontrado' });
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
    if (!actorId) return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });

    const parsed = revokeGrantSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'reason é obrigatório para revogar (motivo próprio, nunca sobrescreve o reason da concessão)', details: parsed.error.errors });
    }
    try {
      const revoked = await actorCapabilityGrantService.revoke(
        tenantId,
        req.params.grantId,
        { userId, actorId },
        parsed.data.reason
      );
      return reply.send(revoked);
    } catch (error: any) {
      const sc = error?.statusCode ?? 500;
      return reply.status(sc).send({ ok: false, error: sc >= 500 ? 'Erro ao revogar grant' : error?.message });
    }
  });
};

export default actorCapabilityGrantRoutes;

// backend/src/core/companies/company-access-invitations.routes.ts
// DECISION-0189 (F5) — rotas do convite/aceite canônico (§8).
//
// AUTORIDADE vive no SERVICE (locks + tetos DENTRO da tx). As rotas: autenticam, validam
// shape (zod), provam AUTORIA (representação do actor declarado) nos writes de gestão, e
// NUNCA logam token em claro. Lookup por código de indicação: SÓ diretório de pessoa
// (zero poder), gestor-gated, rate limit FAIL-CLOSED próprio (não reusa o caminho
// fail-open de auth.routes — R15).

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { companyAccessInvitationsService } from './company-access-invitations.service';
import { COMPANY_CATALOG_KEYS } from '@core/authorization/company-policy-registry';

// ── rate limit FAIL-CLOSED (janela fixa em memória; single-node dev). Estourou → 429 SEMPRE;
//    não existe caminho de erro que "continue" (anti-padrão fail-open condenado em §8.3).
const lookupBuckets = new Map<string, { count: number; resetAt: number }>();
function failClosedRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = lookupBuckets.get(key);
  if (!b || b.resetAt <= now) {
    lookupBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

const companyAccessInvitationsRoutes: FastifyPluginAsync = async (fastify) => {
  async function requireRepresentsActingActor(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const tenantId = req.tenant!.id;
    const userId = (req as { user?: { id?: string } }).user?.id;
    const actingActorId = req.actionContext?.actorId;
    if (!userId || !actingActorId) {
      reply.status(401).send({ error: 'Autenticação + actionContext obrigatórios' });
      return false;
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    let represents = false;
    try {
      represents = await authorizationService.canRepresentActor(tenantId, userId, actingActorId);
    } catch {
      represents = false;
    }
    if (!represents) {
      reply.status(403).send({ error: 'Actor declarado não representado pelo principal', code: 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE' });
      return false;
    }
    return true;
  }

  const sendErr = (reply: FastifyReply, error: unknown) => {
    const e = error as Error & { statusCode?: number; code?: string };
    // NUNCA ecoar token/corpo — só código/mensagem de domínio
    return reply.status(typeof e.statusCode === 'number' ? e.statusCode : 500).send({ error: e.message, code: e.code });
  };

  const invitableKeys = COMPANY_CATALOG_KEYS as readonly string[];

  /** POST /companies/:companyId/invitations — cria convite (manage_members + tetos). */
  const createSchema = z.object({
    inviteeGlobalUserId: z.string().uuid(),
    permissionKeys: z.array(z.string()).max(16).default([]),
    idempotencyKey: z.string().min(8).max(128),
  });
  fastify.post<{ Params: { companyId: string }; Body: z.infer<typeof createSchema> }>(
    '/:companyId/invitations',
    async (req, reply) => {
      if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
      if (!(await requireRepresentsActingActor(req, reply))) return;
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Body inválido', details: parsed.error.errors });
      // shape-check cedo: chaves precisam pertencer ao vocabulário convidável conhecido (o
      // service revalida contra o catálogo + tetos — esta é só a borda anti-lixo)
      for (const k of parsed.data.permissionKeys) {
        if (!invitableKeys.includes(k)) {
          return reply.status(400).send({ error: `permissão desconhecida: ${k}`, code: 'UNKNOWN_PERMISSION' });
        }
      }
      try {
        const out = await companyAccessInvitationsService.createInvitation({
          tenantId: req.tenant.id,
          companyId: req.params.companyId,
          invokerUserId: (req as { user?: { id?: string } }).user!.id!,
          invokerActorId: req.actionContext?.actorId ?? null,
          inviteeGlobalUserId: parsed.data.inviteeGlobalUserId,
          permissionKeys: parsed.data.permissionKeys,
          idempotencyKey: parsed.data.idempotencyKey,
        });
        reply.header('Cache-Control', 'no-store'); // token em claro na resposta — nunca cachear
        return reply.status(out.idempotentReplay ? 200 : 201).send({ ok: true, data: out });
      } catch (error) {
        return sendErr(reply, error);
      }
    }
  );

  /** GET /companies/:companyId/invitations — lista (gestão manage_members via service? leitura: gestão) */
  fastify.get<{ Params: { companyId: string } }>('/:companyId/invitations', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
    try {
      // leitura da fila de convites = superfície de administração de membros
      const { authorizationService } = await import('@core/authorization/authorization.service');
      const { companiesService } = await import('./companies.service');
      const pageActorId = await companiesService.getPageActorId(req.tenant.id, req.params.companyId);
      if (!pageActorId) return reply.status(404).send({ error: 'Empresa sem actor' });
      const decision = await authorizationService.canActAs(req.tenant.id, userId, pageActorId, 'manage_members');
      if (!decision.allowed) return reply.status(403).send({ error: 'manage_members exigida para ler a fila de convites' });
      const rows = await companyAccessInvitationsService.listInvitations(req.tenant.id, req.params.companyId);
      return reply.send({ ok: true, data: rows });
    } catch (error) {
      return sendErr(reply, error);
    }
  });

  /** POST /companies/:companyId/invitations/:invitationId/revoke */
  fastify.post<{ Params: { companyId: string; invitationId: string } }>(
    '/:companyId/invitations/:invitationId/revoke',
    async (req, reply) => {
      if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
      if (!(await requireRepresentsActingActor(req, reply))) return;
      try {
        await companyAccessInvitationsService.revokeInvitation({
          tenantId: req.tenant.id,
          companyId: req.params.companyId,
          invitationId: req.params.invitationId,
          invokerUserId: (req as { user?: { id?: string } }).user!.id!,
        });
        return reply.send({ ok: true });
      } catch (error) {
        return sendErr(reply, error);
      }
    }
  );

  /**
   * POST /companies/:companyId/invitations/lookup — DIRETÓRIO por código de indicação (R15).
   * Gestor-gated · rate limit FAIL-CLOSED · resposta MÍNIMA e uniforme · ZERO poder materializado.
   */
  const lookupSchema = z.object({ referralCode: z.string().regex(/^[A-Za-z0-9]{4,32}$/) });
  fastify.post<{ Params: { companyId: string }; Body: z.infer<typeof lookupSchema> }>(
    '/:companyId/invitations/lookup',
    async (req, reply) => {
      if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
      const userId = (req as { user?: { id?: string } }).user?.id;
      if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
      const parsed = lookupSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Código inválido' });

      // rate limit FAIL-CLOSED: por principal E por IP (janela 60s)
      const ip = req.ip ?? 'no-ip';
      if (
        !failClosedRateLimit(`u:${req.tenant.id}:${userId}`, 10, 60_000) ||
        !failClosedRateLimit(`ip:${req.tenant.id}:${ip}`, 20, 60_000)
      ) {
        return reply.status(429).send({ error: 'Rate limit excedido', code: 'LOOKUP_RATE_LIMITED' });
      }

      try {
        // gestor-gated (manage_members terminal via decisor canônico)
        const { authorizationService } = await import('@core/authorization/authorization.service');
        const { companiesService } = await import('./companies.service');
        const pageActorId = await companiesService.getPageActorId(req.tenant.id, req.params.companyId);
        if (!pageActorId) return reply.status(404).send({ error: 'Pessoa não encontrada' });
        const decision = await authorizationService.canActAs(req.tenant.id, userId, pageActorId, 'manage_members');
        if (!decision.allowed) return reply.status(403).send({ error: 'manage_members exigida para o lookup' });

        // resolve server-side: código ATIVO → actor dono → PESSOA (actor humano) → Identity
        const { runQueryWithTenant } = await import('@core/database/pool');
        const row = await runQueryWithTenant<{ global_user_id: string; display_name: string | null }>(
          req.tenant.id,
          `SELECT a.global_user_id, a.display_name
             FROM actor_referral_codes rc
             JOIN actors a ON a.tenant_id = rc.tenant_id AND a.id = rc.owner_actor_id
            WHERE rc.tenant_id = $1 AND UPPER(rc.code) = UPPER($2) AND rc.code_status = 'active'
              AND a.actor_type IN ('user','actor_human','person') AND a.global_user_id IS NOT NULL
            LIMIT 1`,
          [req.tenant.id, parsed.data.referralCode]
        );
        // resposta UNIFORME (inexistente/inativo/empresa/grupo → mesmo 404; zero oráculo)
        if (!row) return reply.status(404).send({ error: 'Pessoa não encontrada' });
        reply.header('Cache-Control', 'no-store');
        return reply.send({ ok: true, data: { globalUserId: row.global_user_id, displayName: row.display_name } });
      } catch (error) {
        return sendErr(reply, error);
      }
    }
  );
};

/** Rotas do CONVIDADO (aceite/recusa) — fora do prefixo /companies (token é o endereço). */
export const invitationAcceptanceRoutes: FastifyPluginAsync = async (fastify) => {
  const tokenSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) });

  fastify.post<{ Body: z.infer<typeof tokenSchema> }>('/invitations/accept', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Token inválido' });
    try {
      const out = await companyAccessInvitationsService.acceptInvitation({
        tenantId: req.tenant.id,
        token: parsed.data.token,
        accepterUserId: userId,
      });
      return reply.send({ ok: true, data: out });
    } catch (error) {
      const e = error as Error & { statusCode?: number; code?: string };
      return reply.status(typeof e.statusCode === 'number' ? e.statusCode : 500).send({ error: e.message, code: e.code });
    }
  });

  fastify.post<{ Body: z.infer<typeof tokenSchema> }>('/invitations/decline', async (req, reply) => {
    if (!req.tenant?.id) return reply.status(400).send({ error: 'Tenant not found' });
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) return reply.status(401).send({ error: 'Não autenticado' });
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Token inválido' });
    try {
      await companyAccessInvitationsService.declineInvitation({
        tenantId: req.tenant.id,
        token: parsed.data.token,
        userId,
      });
      return reply.send({ ok: true });
    } catch (error) {
      const e = error as Error & { statusCode?: number; code?: string };
      return reply.status(typeof e.statusCode === 'number' ? e.statusCode : 500).send({ error: e.message, code: e.code });
    }
  });
};

export default companyAccessInvitationsRoutes;

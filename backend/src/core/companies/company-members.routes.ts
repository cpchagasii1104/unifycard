// src/core/companies/company-members.routes.ts
// Rotas para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
//
// 🔒 DECISION-0189 (F4): as mutações genéricas MORRERAM. Lifecycle e grants passam por
// COMANDOS GOVERNADOS (company-membership-commands.service — dois tetos, lock da empresa,
// proteção do último gestor, eventos append-only). Criação direta de membro (POST) morreu:
// só bootstrap e o aceite canônico de convite (F5) criam 'active' (R17).
// A autoridade dos comandos é resolvida DENTRO da transação do comando (grants terminais do
// caller) — a rota só autentica, resolve alvo e prova a AUTORIA (representação do actor
// declarado, não-forjável — R2.2 FIX-Q3).

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { companyMembersService } from './company-members.service';
import { companiesService } from './companies.service';
import { companyMembershipCommandsService } from './company-membership-commands.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { CompanyMemberRole, CompanyMemberStatus } from './company-members.types';
import { COMPANY_GRANT_COLUMNS } from '@core/authorization/company-policy-registry';
import { DELEGATION_RELATIONSHIP_TYPES } from '@core/actor-delegation/actor-delegation.repository';
import { z } from 'zod';

const companyMembersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GATE DE LEITURA (DECISION-0113 F6.5.5): ler a estrutura organizacional exige gestão
   * (canManageCompany = can_manage_company; role MORREU como autoridade — DECISION-0189 §5).
   */
  async function requireCompanyManage(req: FastifyRequest, reply: FastifyReply, companyId: string): Promise<boolean> {
    const tenantId = req.tenant!.id;
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      reply.status(401).send({ error: 'Autenticação obrigatória (req.user.id) para gerir membros' });
      return false;
    }
    let globalUserId: string | null = null;
    try {
      globalUserId = await resolveGlobalUserId(userId, tenantId);
    } catch {
      globalUserId = null;
    }
    if (!globalUserId) {
      reply.status(403).send({ error: 'Sem autoridade sobre a empresa (identidade não resolvida)' });
      return false;
    }
    const canManage = await companiesService.canManageCompany(tenantId, companyId, globalUserId);
    if (!canManage) {
      reply.status(403).send({
        error: 'Apenas quem gerencia a empresa pode ler/gerir a estrutura de membros (DECISION-0113/0189)',
        code: 'COMPANY_MEMBER_MANAGE_FORBIDDEN',
      });
      return false;
    }
    return true;
  }

  // 🔴 R2.2 FIX-Q3 — AUTORIA NÃO-FORJÁVEL: o principal autenticado precisa REPRESENTAR o actor
  // declarado em actionContext (a autoria dupla vai para company_member_events).
  async function requireRepresentsActingActor(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const tenantId = req.tenant!.id;
    const userId = (req as { user?: { id?: string } }).user?.id;
    const actingActorId = req.actionContext?.actorId;
    if (!userId || !actingActorId) {
      reply.status(401).send({ error: 'Autenticação + actionContext obrigatórios para gravar autoria' });
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
      reply.status(403).send({
        error: 'O actor declarado (actionContext.actorId) não é representado pelo principal — autoria não pode ser forjada (DECISION-0113 / R2 §4.9.9)',
        code: 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE',
      });
      return false;
    }
    return true;
  }

  function commandActor(req: FastifyRequest): { userId: string; actorId: string | null } {
    return {
      userId: (req as { user?: { id?: string } }).user!.id!,
      actorId: req.actionContext?.actorId ?? null,
    };
  }

  function sendCommandError(reply: FastifyReply, error: unknown, log: (e: unknown) => void) {
    const e = error as Error & { statusCode?: number; code?: string };
    log(error);
    return reply
      .status(typeof e.statusCode === 'number' ? e.statusCode : 500)
      .send({ error: e.message, code: e.code });
  }

  /**
   * POST /companies/:companyId/members — ☠️ MORTO (DECISION-0189 R17).
   * Só bootstrap e aceite canônico de convite criam membership 'active'.
   */
  fastify.post<{ Params: { companyId: string } }>('/:companyId/members', async (_req, reply) => {
    return reply.status(410).send({
      error:
        'Criação direta de membro morreu (DECISION-0189 R17): membership nasce APENAS pelo aceite canônico de convite (company_access_invitations) ou pelo bootstrap da empresa.',
      code: 'MEMBERSHIP_VIA_INVITATION_REQUIRED',
    });
  });

  /**
   * GET /companies/:companyId/members — listar (gestão)
   */
  fastify.get<{
    Params: { companyId: string };
    Querystring: { role?: string; status?: string };
  }>('/:companyId/members', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    if (!(await requireCompanyManage(req, reply, req.params.companyId))) return;

    try {
      const filters: { companyId: string; role?: CompanyMemberRole; status?: CompanyMemberStatus } = {
        companyId: req.params.companyId,
      };
      if (req.query.role) filters.role = req.query.role as CompanyMemberRole;
      if (req.query.status) filters.status = req.query.status as CompanyMemberStatus;

      const members = await companyMembersService.listMembers(req.tenant.id, filters);
      return reply.send({
        ok: true,
        data: members.map((m) => ({
          memberId: m.memberId,
          companyId: m.companyId,
          actorId: m.actorId,
          role: m.role,
          status: m.status,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
      });
    } catch (error: unknown) {
      return sendCommandError(reply, error, (e) => fastify.log.error(e));
    }
  });

  /**
   * GET /companies/:companyId/members/:memberId — detalhe (gestão; anti-IDOR pela empresa REAL)
   */
  fastify.get<{ Params: { companyId: string; memberId: string } }>(
    '/:companyId/members/:memberId',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }
      try {
        const member = await companyMembersService.getMember(req.tenant.id, req.params.memberId);
        if (!(await requireCompanyManage(req, reply, member.companyId))) return;
        return reply.send({
          ok: true,
          data: {
            memberId: member.memberId,
            companyId: member.companyId,
            actorId: member.actorId,
            role: member.role,
            status: member.status,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
          },
        });
      } catch (error: unknown) {
        if ((error as { statusCode?: number })?.statusCode === 404) {
          return reply.status(403).send({ error: 'Membro não acessível' });
        }
        return sendCommandError(reply, error, (e) => fastify.log.error(e));
      }
    }
  );

  /**
   * PUT /companies/:companyId/members/:memberId — SÓ RÓTULOS (role/metadata).
   * Status e grants NÃO passam por aqui (comandos governados).
   */
  const updateLabelsSchema = z.object({
    role: z.nativeEnum(CompanyMemberRole).optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.put<{
    Params: { companyId: string; memberId: string };
    Body: z.infer<typeof updateLabelsSchema>;
  }>('/:companyId/members/:memberId', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    if ((req.body as Record<string, unknown>)?.status !== undefined) {
      return reply.status(400).send({
        error: 'Mudança de status por PUT morreu (DECISION-0189) — use os comandos suspend/resume/revoke',
        code: 'USE_GOVERNED_COMMANDS',
      });
    }
    const parsed = updateLabelsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
    }
    try {
      const target = await companyMembersService.getMember(req.tenant.id, req.params.memberId);
      if (!(await requireCompanyManage(req, reply, target.companyId))) return;

      const member = await companyMembersService.updateMemberLabels(
        req.tenant.id,
        req.params.memberId,
        parsed.data
      );
      return reply.send({
        ok: true,
        data: {
          memberId: member.memberId,
          companyId: member.companyId,
          actorId: member.actorId,
          role: member.role,
          status: member.status,
          updatedAt: member.updatedAt,
        },
      });
    } catch (error: unknown) {
      return sendCommandError(reply, error, (e) => fastify.log.error(e));
    }
  });

  /**
   * DELETE /companies/:companyId/members/:memberId — REVOGAÇÃO LÓGICA via comando governado
   * (compat de UI; mesmo efeito de POST .../commands/revoke). DELETE físico não existe.
   */
  fastify.delete<{ Params: { companyId: string; memberId: string } }>(
    '/:companyId/members/:memberId',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }
      if (!(await requireRepresentsActingActor(req, reply))) return;
      try {
        await companyMembershipCommandsService.revokeMember(
          req.tenant.id,
          req.params.companyId,
          req.params.memberId,
          commandActor(req)
        );
        return reply.status(204).send();
      } catch (error: unknown) {
        return sendCommandError(reply, error, (e) => fastify.log.error(e));
      }
    }
  );

  /**
   * COMANDOS GOVERNADOS (DECISION-0189 F4): suspend · resume · revoke.
   * Autoridade (manage_members/governança + dois tetos + último gestor) DENTRO do comando.
   */
  for (const cmd of ['suspend', 'resume', 'revoke'] as const) {
    fastify.post<{ Params: { companyId: string; memberId: string } }>(
      `/:companyId/members/:memberId/commands/${cmd}`,
      async (req, reply) => {
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }
        if (!req.tenant || !req.tenant.id) {
          return reply.status(400).send({ error: 'Tenant not found' });
        }
        if (!(await requireRepresentsActingActor(req, reply))) return;
        try {
          const acted = commandActor(req);
          if (cmd === 'suspend') {
            await companyMembershipCommandsService.suspendMember(req.tenant.id, req.params.companyId, req.params.memberId, acted);
          } else if (cmd === 'resume') {
            await companyMembershipCommandsService.resumeMember(req.tenant.id, req.params.companyId, req.params.memberId, acted);
          } else {
            await companyMembershipCommandsService.revokeMember(req.tenant.id, req.params.companyId, req.params.memberId, acted);
          }
          return reply.status(200).send({ ok: true, command: cmd });
        } catch (error: unknown) {
          return sendCommandError(reply, error, (e) => fastify.log.error(e));
        }
      }
    );
  }

  /**
   * PATCH /companies/:companyId/members/:memberId/grants — alteração governada de grants
   * (allowlist tipada; dois tetos; protegidos exigem governança).
   */
  const grantsSchema = z.object(
    Object.fromEntries(COMPANY_GRANT_COLUMNS.map((c) => [c, z.boolean().optional()]))
  );

  fastify.patch<{
    Params: { companyId: string; memberId: string };
    Body: z.infer<typeof grantsSchema>;
  }>('/:companyId/members/:memberId/grants', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    const parsed = grantsSchema.strict().safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Grants fora da allowlist tipada', details: parsed.error.errors });
    }
    if (!(await requireRepresentsActingActor(req, reply))) return;
    try {
      await companyMembershipCommandsService.alterGrants(
        req.tenant.id,
        req.params.companyId,
        req.params.memberId,
        commandActor(req),
        parsed.data
      );
      return reply.status(200).send({ ok: true, command: 'alter-grants' });
    } catch (error: unknown) {
      return sendCommandError(reply, error, (e) => fastify.log.error(e));
    }
  });

  /**
   * POST /companies/:companyId/governance/transfer — transferência ATÔMICA de governança.
   */
  const transferSchema = z.object({ toMemberId: z.string().uuid() });

  fastify.post<{
    Params: { companyId: string };
    Body: z.infer<typeof transferSchema>;
  }>('/:companyId/governance/transfer', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
    }
    if (!(await requireRepresentsActingActor(req, reply))) return;
    try {
      await companyMembershipCommandsService.transferGovernance(
        req.tenant.id,
        req.params.companyId,
        parsed.data.toMemberId,
        commandActor(req)
      );
      return reply.status(200).send({ ok: true, command: 'transfer-governance' });
    } catch (error: unknown) {
      return sendCommandError(reply, error, (e) => fastify.log.error(e));
    }
  });

  /**
   * POST /companies/:companyId/members/:memberId/relationship — declara o vínculo jurídico
   * (casa canônica company_member_relationships; vocabulário GOVERNADO).
   */
  const relationshipSchema = z.object({
    relationshipType: z.enum(DELEGATION_RELATIONSHIP_TYPES).nullable(),
    departmentKey: z.string().regex(/^[a-z][a-z0-9_]*$/).nullable().optional(),
  });

  fastify.post<{
    Params: { companyId: string; memberId: string };
    Body: z.infer<typeof relationshipSchema>;
  }>('/:companyId/members/:memberId/relationship', async (req, reply) => {
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }
    const parsed = relationshipSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.errors });
    }
    if (!(await requireRepresentsActingActor(req, reply))) return;
    try {
      await companyMembershipCommandsService.declareRelationship(
        req.tenant.id,
        req.params.companyId,
        req.params.memberId,
        commandActor(req),
        parsed.data.relationshipType,
        parsed.data.departmentKey ?? null
      );
      return reply.status(200).send({ ok: true, command: 'declare-relationship' });
    } catch (error: unknown) {
      return sendCommandError(reply, error, (e) => fastify.log.error(e));
    }
  });
};

export default companyMembersRoutes;

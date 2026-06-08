// src/core/companies/company-members.routes.ts
// Rotas para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { companyMembersService } from './company-members.service';
import { companiesService } from './companies.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { CompanyMemberRole, CompanyMemberStatus } from './company-members.types';
import { z } from 'zod';

const companyMembersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GATE DE AUTORIDADE (DECISION-0113 fatia 2): mutação de membro/delegação exige que o **usuário
   * autenticado** (`req.user`) prove gestão da empresa via `canManageCompany` (canônico:
   * `can_manage_company OR role='owner'`). `actionContext.actorId` é hint, não autoridade. Gateia
   * sobre a empresa REAL (parâmetro `companyId` resolvido pelo caller) — fail-closed em ausência de
   * `req.user`, principal sem global_user_id, ou sem gestão. Retorna true se autorizado (não responde);
   * false após já ter respondido o erro.
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
        error: 'Apenas quem gerencia a empresa pode gerir membros/delegações (DECISION-0113)',
        code: 'COMPANY_MEMBER_MANAGE_FORBIDDEN',
      });
      return false;
    }
    return true;
  }

  /**
   * POST /companies/:companyId/members
   * Adicionar membro à empresa
   * 🔴 BLINDAGEM: companyId e actorId são OBRIGATÓRIOS
   */
  const createMemberSchema = z.object({
    actorId: z.string().uuid(), // OBRIGATÓRIO: Actor CPF
    role: z.nativeEnum(CompanyMemberRole).optional(),
    status: z.nativeEnum(CompanyMemberStatus).optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.post<{
    Params: { companyId: string };
    Body: z.infer<typeof createMemberSchema>;
  }>(
    '/:companyId/members',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // 🔴 DECISION-0113 fatia 2: autoridade server-side (req.user gerencia a empresa) antes de criar membro/delegação
      if (!(await requireCompanyManage(req, reply, req.params.companyId))) return;

      // Validar payload
      const parsed = createMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        const member = await companyMembersService.createMember(
          req.tenant.id,
          req.actionContext.actorId,
          {
            companyId: req.params.companyId,
            actorId: parsed.data.actorId,
            role: parsed.data.role,
            status: parsed.data.status,
            metadata: parsed.data.metadata,
          }
        );

        return reply.status(201).send({
          ok: true,
          data: {
            memberId: member.memberId,
            companyId: member.companyId,
            actorId: member.actorId,
            role: member.role,
            status: member.status,
            createdAt: member.createdAt,
          },
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        if (error instanceof Error) {
          fastify.log.error(error);
          const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
          return reply.status(code ?? 500).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: String(error) });
      }
    }
  );

  /**
   * GET /companies/:companyId/members
   * Listar membros da empresa
   */
  fastify.get<{
    Params: { companyId: string };
    Querystring: {
      role?: string;
      status?: string;
    };
  }>('/:companyId/members', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    // 🔴 DECISION-0113 F6.5.5: ler a estrutura organizacional (membros/cargos) exige a MESMA autoridade
    // dos writes (fatia 2) — o `req.user` precisa GERENCIAR a empresa da URL (`canManageCompany`). Sem isso,
    // qualquer caller listava membros/roles de empresa alheia. fail-closed 401/403; não-leak (403 vs lista).
    if (!(await requireCompanyManage(req, reply, req.params.companyId))) return;

    try {
      const filters: any = {
        companyId: req.params.companyId,
      };

      if (req.query.role) {
        filters.role = req.query.role as CompanyMemberRole;
      }

      if (req.query.status) {
        filters.status = req.query.status as CompanyMemberStatus;
      }

      const members = await companyMembersService.listMembers(req.tenant.id, filters);

      return reply.send({
        ok: true,
        data: members.map(m => ({
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
      if (error instanceof Error) {
        fastify.log.error(error);
        const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
        return reply.status(code ?? 500).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: String(error) });
    }
  });

  /**
   * GET /companies/:companyId/members/:memberId
   * Buscar membro por ID
   */
  fastify.get<{
    Params: { companyId: string; memberId: string };
  }>('/:companyId/members/:memberId', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      // 🔴 DECISION-0113 F6.5.5 (anti-IDOR): resolve o membro REAL e gateia sobre a EMPRESA REAL dele
      // (NÃO o `companyId` da URL) — mesma autoridade dos writes (PUT/DELETE). Membro inexistente → 403
      // não-leak (uniforme com "sem autoridade": não revela existência de membro/empresa).
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
      // não-leak: membro inexistente (404) → 403 uniforme (não revela existência).
      if ((error as { statusCode?: number })?.statusCode === 404) {
        return reply.status(403).send({ error: 'Membro não acessível' });
      }
      if (error instanceof Error) {
        fastify.log.error(error);
        const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
        return reply.status(code ?? 500).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: String(error) });
    }
  });

  /**
   * PUT /companies/:companyId/members/:memberId
   * Atualizar membro
   * 🔴 BLINDAGEM: Empresa pode atualizar role/status, mas NÃO agenda pessoal
   */
  const updateMemberSchema = z.object({
    role: z.nativeEnum(CompanyMemberRole).optional(),
    status: z.nativeEnum(CompanyMemberStatus).optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.put<{
    Params: { companyId: string; memberId: string };
    Body: z.infer<typeof updateMemberSchema>;
  }>(
    '/:companyId/members/:memberId',
    async (req, reply) => {
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      if (!req.tenant || !req.tenant.id) {
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // Validar payload
      const parsed = updateMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        // 🔴 DECISION-0113 fatia 2: autoridade sobre a empresa REAL do membro (req.user), não actionContext.actorId
        const target = await companyMembersService.getMember(req.tenant.id, req.params.memberId);
        if (!(await requireCompanyManage(req, reply, target.companyId))) return;

        const member = await companyMembersService.updateMember(
          req.tenant.id,
          req.params.memberId,
          req.actionContext.actorId,
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
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        if (error instanceof Error) {
          fastify.log.error(error);
          const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
          return reply.status(code ?? 500).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: String(error) });
      }
    }
  );

  /**
   * DELETE /companies/:companyId/members/:memberId
   * Remover membro
   */
  fastify.delete<{
    Params: { companyId: string; memberId: string };
  }>('/:companyId/members/:memberId', async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      // 🔴 DECISION-0113 fatia 2: autoridade sobre a empresa REAL do membro (req.user), não actionContext.actorId
      const target = await companyMembersService.getMember(req.tenant.id, req.params.memberId);
      if (!(await requireCompanyManage(req, reply, target.companyId))) return;

      await companyMembersService.removeMember(
        req.tenant.id,
        req.params.memberId,
        req.actionContext.actorId
      );

      return reply.status(204).send();
    } catch (error: unknown) {
      if (error instanceof Error) {
        fastify.log.error(error);
        const code = 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode?: number }).statusCode : 500;
        return reply.status(code ?? 500).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: String(error) });
    }
  });
};

export default companyMembersRoutes;


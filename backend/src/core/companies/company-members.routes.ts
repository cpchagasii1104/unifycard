// src/core/companies/company-members.routes.ts
// Rotas para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário

import { FastifyPluginAsync } from 'fastify';
import { companyMembersService } from './company-members.service';
import { CompanyMemberRole, CompanyMemberStatus } from './company-members.types';
import { z } from 'zod';

const companyMembersRoutes: FastifyPluginAsync = async (fastify) => {
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
      const member = await companyMembersService.getMember(req.tenant.id, req.params.memberId);

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


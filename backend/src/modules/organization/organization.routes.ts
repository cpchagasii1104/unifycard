// backend/src/modules/organization/organization.routes.ts
// SPRINT 78: Rotas REST para Organization

import type { FastifyInstance } from 'fastify';
import { organizationRoleService } from './organization-role.service';
import { organizationInviteService } from './organization-invite.service';
import { organizationMemberService } from './organization-member.service';
import { organizationUnitService } from './organization-unit.service';
import type {
  InviteUserInput,
  AcceptInviteInput,
  OrganizationInviteFilters,
  OrganizationMemberFilters,
} from './organization.types';

const organizationRoutes = async (fastify: FastifyInstance) => {
  // ============================================================
  // INVITES
  // ============================================================

  /**
   * POST /organization/invites
   * Convidar usuário
   */
  fastify.post<{ Body: InviteUserInput }>('/invites', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    const invite = await organizationInviteService.inviteUser(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(invite);
  });

  /**
   * POST /organization/invites/:id/accept
   * Aceitar convite
   */
  fastify.post<{
    Params: { id: string };
    Body: { token: string; actorId: string };
  }>('/invites/:id/accept', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    const member = await organizationInviteService.acceptInvite(tenantId, {
      token: req.body.token,
      userId: actionContext.actorId,
      actorId: req.body.actorId,
    });

    return reply.send(member);
  });

  /**
   * POST /organization/invites/:id/revoke
   * Revogar convite
   */
  fastify.post<{ Params: { id: string } }>('/invites/:id/revoke', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    const revokedInvite = await organizationInviteService.revokeInvite(
      tenantId,
      req.params.id,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.send(revokedInvite);
  });

  /**
   * GET /organization/invites
   * Lista convites
   */
  fastify.get<{
    Querystring: {
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/invites', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: OrganizationInviteFilters = {};
    if (req.query.status) {
      filters.status = req.query.status as any;
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const invites = await organizationInviteService.listInvites(tenantId, filters);

    return reply.send({ invites, totalCents: invites.length });
  });

  // ============================================================
  // MEMBERS
  // ============================================================

  /**
   * GET /organization/members
   * Lista membros
   */
  fastify.get<{
    Querystring: {
      status?: string;
      roleKey?: string;
      limit?: number;
      offset?: number;
    };
  }>('/members', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: OrganizationMemberFilters = {};
    if (req.query.status) {
      filters.status = req.query.status as any;
    }
    if (req.query.roleKey) {
      filters.roleKey = req.query.roleKey as any;
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const members = await organizationMemberService.listMembers(tenantId, filters);

    return reply.send({ members, totalCents: members.length });
  });

  /**
   * POST /organization/members/:id/role
   * Muda papel do membro
   */
  fastify.post<{
    Params: { id: string };
    Body: { roleKey: string };
  }>('/members/:id/role', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    const member = await organizationMemberService.changeRole(
      tenantId,
      req.params.id,
      req.body.roleKey,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.send(member);
  });

  /**
   * POST /organization/members/:id/remove
   * Remove membro
   */
  fastify.post<{ Params: { id: string } }>('/members/:id/remove', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    await organizationMemberService.removeMember(
      tenantId,
      req.params.id,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(204).send();
  });

  // ============================================================
  // ORGANIZATION UNITS
  // ============================================================

  /**
   * GET /organization/units
   * Lista unidades organizacionais
   */
  fastify.get<{
    Querystring: {
      parentId?: string | null;
      type?: 'MATRIX' | 'BRANCH' | 'DC';
    };
  }>('/units', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { parentId, type } = req.query;

    const units = await organizationUnitService.listUnits(
      tenantId,
      parentId === 'null' || parentId === null ? null : parentId,
      type
    );

    return reply.status(200).send({ units });
  });

  /**
   * GET /organization/units/tree
   * Obtém árvore de unidades
   */
  fastify.get<{
    Querystring: {
      rootId?: string;
    };
  }>('/units/tree', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { rootId } = req.query;

    const tree = await organizationUnitService.getUnitTree(tenantId, rootId);

    return reply.status(200).send({ tree });
  });

  /**
   * GET /organization/units/:id
   * Busca unidade por ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/units/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const unit = await organizationUnitService.getUnitById(tenantId, id);

    if (!unit) {
      return reply.status(404).send({ error: 'Unidade não encontrada' });
    }

    return reply.status(200).send(unit);
  });

  /**
   * GET /organization/units/:id/children
   * Busca unidades filhas
   */
  fastify.get<{
    Params: { id: string };
  }>('/units/:id/children', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const children = await organizationUnitService.getChildren(tenantId, id);

    return reply.status(200).send({ units: children });
  });

  /**
   * GET /organization/units/:id/descendants
   * Busca descendentes
   */
  fastify.get<{
    Params: { id: string };
  }>('/units/:id/descendants', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const descendants = await organizationUnitService.getDescendants(tenantId, id);

    return reply.status(200).send({ units: descendants });
  });

  /**
   * GET /organization/units/actor/:actorId
   * Busca unidade por actor
   */
  fastify.get<{
    Params: { actorId: string };
  }>('/units/actor/:actorId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { actorId } = req.params;

    const unit = await organizationUnitService.getUnitByActor(tenantId, actorId);

    if (!unit) {
      return reply.status(404).send({ error: 'Unidade não encontrada para este actor' });
    }

    return reply.status(200).send(unit);
  });
};

export default organizationRoutes;


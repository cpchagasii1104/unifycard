// src/core/rbac/role.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { roleService } from './role.service';
import { rbacService } from './rbac.service';
import {
  roleIdSchema,
  roleUserParamsSchema,
  createRoleSchema,
  updateRoleSchema,
} from './role.schemas';

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /rbac/roles - Criar nova role
  fastify.post('/', async (req, reply) => {
    const tenantId = req.tenant!.id;

    // Verifica permissão
    await fastify.requirePermission(['roles:create'])(req, reply);

    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      const role = await roleService.createRole(tenantId, parsed.data);
      return reply.status(201).send(role);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /rbac/roles - Listar todas as roles
  fastify.get('/', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:read'])(req, reply);

    const roles = await roleService.listRoles(tenantId);
    return { roles };
  });

  // GET /rbac/roles/:roleId - Buscar role por ID
  fastify.get<{ Params: { roleId: string } }>('/:roleId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:read'])(req, reply);

    const parsed = roleIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid role ID',
        details: parsed.error.errors,
      });
    }

    const role = await roleService.getRoleById(tenantId, parsed.data.roleId);

    if (!role) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    return role;
  });

  // GET /rbac/roles/:roleId/permissions - Buscar role com permissions
  fastify.get<{ Params: { roleId: string } }>('/:roleId/permissions', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:read'])(req, reply);

    const parsed = roleIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid role ID',
        details: parsed.error.errors,
      });
    }

    const roleWithPermissions = await rbacService.getRoleWithPermissions(
      tenantId,
      parsed.data.roleId
    );

    if (!roleWithPermissions) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    return roleWithPermissions;
  });

  // PUT /rbac/roles/:roleId - Atualizar role
  fastify.put<{ Params: { roleId: string } }>('/:roleId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:update'])(req, reply);

    const parsedParams = roleIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid role ID',
        details: parsedParams.error.errors,
      });
    }

    const parsedBody = updateRoleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsedBody.error.errors,
      });
    }

    try {
      const role = await roleService.updateRole(
        tenantId,
        parsedParams.data.roleId,
        parsedBody.data
      );
      return role;
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /rbac/roles/:roleId - Deletar role
  fastify.delete<{ Params: { roleId: string } }>('/:roleId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:delete'])(req, reply);

    const parsed = roleIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid role ID',
        details: parsed.error.errors,
      });
    }

    try {
      await roleService.deleteRole(tenantId, parsed.data.roleId);
      return reply.status(204).send();
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /rbac/roles/:roleId/users/:userId - Atribuir role a usuário
  fastify.post<{ Params: { roleId: string; userId: string } }>(
    '/:roleId/users/:userId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const assignedBy = req.user!.id;

      await fastify.requirePermission(['roles:assign'])(req, reply);

      const parsed = roleUserParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid parameters',
          details: parsed.error.errors,
        });
      }

      try {
        const userRole = await rbacService.assignRoleToUser(
          tenantId,
          parsed.data.userId,
          parsed.data.roleId,
          assignedBy
        );
        return reply.status(201).send(userRole);
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  // DELETE /rbac/roles/:roleId/users/:userId - Remover role de usuário
  fastify.delete<{ Params: { roleId: string; userId: string } }>(
    '/:roleId/users/:userId',
    async (req, reply) => {
      const tenantId = req.tenant!.id;

      await fastify.requirePermission(['roles:assign'])(req, reply);

      const parsed = roleUserParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid parameters',
          details: parsed.error.errors,
        });
      }

      try {
        await rbacService.removeRoleFromUser(tenantId, parsed.data.userId, parsed.data.roleId);
        return reply.status(204).send();
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );

  // GET /rbac/users/:userId/roles - Buscar roles de um usuário
  fastify.get<{ Params: { userId: string } }>('/users/:userId/roles', async (req, reply) => {
    const tenantId = req.tenant!.id;

    await fastify.requirePermission(['roles:read'])(req, reply);

    const userWithRoles = await rbacService.getUserWithRoles(tenantId, req.params.userId);
    return userWithRoles;
  });
};

export default roleRoutes;

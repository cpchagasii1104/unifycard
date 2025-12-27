"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const role_service_1 = require("./role.service");
const rbac_service_1 = require("./rbac.service");
const role_schemas_1 = require("./role.schemas");
const roleRoutes = async (fastify) => {
    // POST /rbac/roles - Criar nova role
    fastify.post('/', async (req, reply) => {
        const tenantId = req.tenant.id;
        // Verifica permissão
        await fastify.requirePermission(['roles:create'])(req, reply);
        const parsed = role_schemas_1.createRoleSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            const role = await role_service_1.roleService.createRole(tenantId, parsed.data);
            return reply.status(201).send(role);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // GET /rbac/roles - Listar todas as roles
    fastify.get('/', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:read'])(req, reply);
        const roles = await role_service_1.roleService.listRoles(tenantId);
        return { roles };
    });
    // GET /rbac/roles/:roleId - Buscar role por ID
    fastify.get('/:roleId', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:read'])(req, reply);
        const parsed = role_schemas_1.roleIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid role ID',
                details: parsed.error.errors,
            });
        }
        const role = await role_service_1.roleService.getRoleById(tenantId, parsed.data.roleId);
        if (!role) {
            return reply.status(404).send({ error: 'Role not found' });
        }
        return role;
    });
    // GET /rbac/roles/:roleId/permissions - Buscar role com permissions
    fastify.get('/:roleId/permissions', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:read'])(req, reply);
        const parsed = role_schemas_1.roleIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid role ID',
                details: parsed.error.errors,
            });
        }
        const roleWithPermissions = await rbac_service_1.rbacService.getRoleWithPermissions(tenantId, parsed.data.roleId);
        if (!roleWithPermissions) {
            return reply.status(404).send({ error: 'Role not found' });
        }
        return roleWithPermissions;
    });
    // PUT /rbac/roles/:roleId - Atualizar role
    fastify.put('/:roleId', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:update'])(req, reply);
        const parsedParams = role_schemas_1.roleIdSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return reply.status(400).send({
                error: 'Invalid role ID',
                details: parsedParams.error.errors,
            });
        }
        const parsedBody = role_schemas_1.updateRoleSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsedBody.error.errors,
            });
        }
        try {
            const role = await role_service_1.roleService.updateRole(tenantId, parsedParams.data.roleId, parsedBody.data);
            return role;
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // DELETE /rbac/roles/:roleId - Deletar role
    fastify.delete('/:roleId', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:delete'])(req, reply);
        const parsed = role_schemas_1.roleIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid role ID',
                details: parsed.error.errors,
            });
        }
        try {
            await role_service_1.roleService.deleteRole(tenantId, parsed.data.roleId);
            return reply.status(204).send();
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // POST /rbac/roles/:roleId/users/:userId - Atribuir role a usuário
    fastify.post('/:roleId/users/:userId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const assignedBy = req.user.id;
        await fastify.requirePermission(['roles:assign'])(req, reply);
        const parsed = role_schemas_1.roleUserParamsSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid parameters',
                details: parsed.error.errors,
            });
        }
        try {
            const userRole = await rbac_service_1.rbacService.assignRoleToUser(tenantId, parsed.data.userId, parsed.data.roleId, assignedBy);
            return reply.status(201).send(userRole);
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // DELETE /rbac/roles/:roleId/users/:userId - Remover role de usuário
    fastify.delete('/:roleId/users/:userId', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:assign'])(req, reply);
        const parsed = role_schemas_1.roleUserParamsSchema.safeParse(req.params);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid parameters',
                details: parsed.error.errors,
            });
        }
        try {
            await rbac_service_1.rbacService.removeRoleFromUser(tenantId, parsed.data.userId, parsed.data.roleId);
            return reply.status(204).send();
        }
        catch (error) {
            const err = error;
            return reply.status(err.statusCode ?? 500).send({ error: err.message });
        }
    });
    // GET /rbac/users/:userId/roles - Buscar roles de um usuário
    fastify.get('/users/:userId/roles', async (req, reply) => {
        const tenantId = req.tenant.id;
        await fastify.requirePermission(['roles:read'])(req, reply);
        const userWithRoles = await rbac_service_1.rbacService.getUserWithRoles(tenantId, req.params.userId);
        return userWithRoles;
    });
};
exports.default = roleRoutes;
//# sourceMappingURL=role.routes.js.map
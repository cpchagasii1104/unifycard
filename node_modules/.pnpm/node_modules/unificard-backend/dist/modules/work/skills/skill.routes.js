"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const skill_service_1 = require("./skill.service");
const skill_schemas_1 = require("./skill.schemas");
const skillRoutes = async (fastify) => {
    /**
     * POST /work/skills
     * Criar nova skill
     */
    fastify.post('/', {
        preHandler: fastify.requirePermission(['work:skill:create']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const body = skill_schemas_1.createSkillSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const skill = await skill_service_1.skillService.createSkill(tenantId, body);
        return reply.status(201).send(skill);
    });
    /**
     * GET /work/skills
     * Listar skills com filtros
     */
    fastify.get('/', {
        preHandler: fastify.requirePermission(['work:skill:read']),
    }, async (req) => {
        // Validação manual com Zod
        const query = skill_schemas_1.listSkillsQuerySchema.parse(req.query);
        const tenantId = req.tenant.id;
        const result = await skill_service_1.skillService.listSkills(tenantId, query);
        return result;
    });
    /**
     * GET /work/skills/:skillId
     * Buscar skill por ID
     */
    fastify.get('/:skillId', {
        preHandler: fastify.requirePermission(['work:skill:read']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = skill_schemas_1.skillIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { skillId } = params;
        const skill = await skill_service_1.skillService.getById(tenantId, skillId);
        if (!skill) {
            return reply.notFound('Skill not found');
        }
        return skill;
    });
    /**
     * PATCH /work/skills/:skillId
     * Atualizar skill
     */
    fastify.patch('/:skillId', {
        preHandler: fastify.requirePermission(['work:skill:update']),
    }, async (req) => {
        // Validação manual com Zod
        const params = skill_schemas_1.skillIdParamsSchema.parse(req.params);
        const body = skill_schemas_1.updateSkillSchema.parse(req.body);
        const tenantId = req.tenant.id;
        const { skillId } = params;
        const skill = await skill_service_1.skillService.updateSkill(tenantId, skillId, body);
        return skill;
    });
    /**
     * DELETE /work/skills/:skillId
     * Deletar skill
     */
    fastify.delete('/:skillId', {
        preHandler: fastify.requirePermission(['work:skill:delete']),
    }, async (req, reply) => {
        // Validação manual com Zod
        const params = skill_schemas_1.skillIdParamsSchema.parse(req.params);
        const tenantId = req.tenant.id;
        const { skillId } = params;
        await skill_service_1.skillService.deleteSkill(tenantId, skillId);
        return reply.status(204).send();
    });
};
exports.default = skillRoutes;
//# sourceMappingURL=skill.routes.js.map
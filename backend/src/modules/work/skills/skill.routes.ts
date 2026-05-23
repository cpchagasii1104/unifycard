// src/modules/work/skills/skill.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { NotFoundError } from '@core/errors';
import { skillService } from './skill.service';
import {
  createSkillSchema,
  updateSkillSchema,
  skillIdParamsSchema,
  listSkillsQuerySchema,
} from './skill.schemas';
import { z } from 'zod';

const skillRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /work/skills
   * Criar nova skill
   */
  fastify.post<{
    Body: z.infer<typeof createSkillSchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:skill:create']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const body = createSkillSchema.parse(req.body);
    const tenantId = req.tenant!.id;

    const skill = await skillService.createSkill(tenantId, body);

    return reply.status(201).send(skill);
  });

  /**
   * GET /work/skills
   * Listar skills com filtros
   */
  fastify.get<{
    Querystring: z.infer<typeof listSkillsQuerySchema>;
  }>('/', {
    preHandler: fastify.requirePermission(['work:skill:read']),
  }, async (req) => {
    // Validação manual com Zod
    const query = listSkillsQuerySchema.parse(req.query);
    const tenantId = req.tenant!.id;
    const result = await skillService.listSkills(tenantId, query);
    return result;
  });

  /**
   * GET /work/skills/:skillId
   * Buscar skill por ID
   */
  fastify.get<{
    Params: z.infer<typeof skillIdParamsSchema>;
  }>('/:skillId', {
    preHandler: fastify.requirePermission(['work:skill:read']),
  }, async (req) => {
    // Validação manual com Zod
    const params = skillIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { skillId } = params;

    const skill = await skillService.getById(tenantId, skillId);

    if (!skill) {
      throw new NotFoundError('Skill not found');
    }

    return skill;
  });

  /**
   * PATCH /work/skills/:skillId
   * Atualizar skill
   */
  fastify.patch<{
    Params: z.infer<typeof skillIdParamsSchema>;
    Body: z.infer<typeof updateSkillSchema>;
  }>('/:skillId', {
    preHandler: fastify.requirePermission(['work:skill:update']),
  }, async (req) => {
    // Validação manual com Zod
    const params = skillIdParamsSchema.parse(req.params);
    const body = updateSkillSchema.parse(req.body);
    const tenantId = req.tenant!.id;
    const { skillId } = params;

    const skill = await skillService.updateSkill(tenantId, skillId, body);
    return skill;
  });

  /**
   * DELETE /work/skills/:skillId
   * Deletar skill
   */
  fastify.delete<{
    Params: z.infer<typeof skillIdParamsSchema>;
  }>('/:skillId', {
    preHandler: fastify.requirePermission(['work:skill:delete']),
  }, async (req, reply) => {
    // Validação manual com Zod
    const params = skillIdParamsSchema.parse(req.params);
    const tenantId = req.tenant!.id;
    const { skillId } = params;

    await skillService.deleteSkill(tenantId, skillId);

    return reply.status(204).send();
  });
};

export default skillRoutes;

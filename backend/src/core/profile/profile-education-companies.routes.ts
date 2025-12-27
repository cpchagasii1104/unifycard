// backend/src/core/profile/profile-education-companies.routes.ts
// Rotas para educação e empresas do usuário
// FASE 2: Educação + Empresa (Unify Platform)

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { profileEducationCompaniesService } from './profile-education-companies.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

// Schema de validação
const addEducationSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
});

const addCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
});

const profileEducationCompaniesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /profile/education
   * Adiciona formação acadêmica ao perfil do usuário
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * Contexto: education
   * Usa Category Input Gate
   * 
   * Payload:
   * {
   *   "name": "Engenharia de Software"
   * }
   * 
   * Respostas:
   * - 200: Formação adicionada com sucesso
   * - 400: Validação falhou (gate, limite, input inválido)
   * - 401: Não autenticado
   * - 409: Duplicata (usuário já possui)
   * - 500: Erro inesperado
   */
  fastify.post<{ Body: { name: string } }>('/education', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // 2. Validar payload
    const parsed = addEducationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      // 3. Adicionar educação
      const result = await profileEducationCompaniesService.addEducation(tenantId, userId, {
        name: parsed.data.name,
      });

      return reply.status(200).send({
        success: true,
        education: result,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const statusCode = err.statusCode || 500;

      fastify.log.error({ err: error }, 'Error adding education');
      return reply.status(statusCode).send({ error: err.message || 'Failed to add education' });
    }
  });

  /**
   * POST /profile/company
   * Adiciona empresa ao perfil do usuário
   * 
   * Autenticação: OBRIGATÓRIA (JWT)
   * Contexto: company
   * Usa Category Input Gate
   * 
   * Payload:
   * {
   *   "name": "Google"
   * }
   * 
   * Respostas:
   * - 200: Empresa adicionada com sucesso
   * - 400: Validação falhou (gate, limite, input inválido)
   * - 401: Não autenticado
   * - 409: Duplicata (usuário já possui)
   * - 500: Erro inesperado
   */
  fastify.post<{ Body: { name: string } }>('/company', async (req, reply) => {
    // 1. Verificar autenticação
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;

    // 2. Validar payload
    const parsed = addCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    try {
      // 3. Adicionar empresa
      const result = await profileEducationCompaniesService.addCompany(tenantId, userId, {
        name: parsed.data.name,
      });

      return reply.status(200).send({
        success: true,
        company: result,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const statusCode = err.statusCode || 500;

      fastify.log.error({ err: error }, 'Error adding company');
      return reply.status(statusCode).send({ error: err.message || 'Failed to add company' });
    }
  });

  /**
   * GET /profile/education
   * Lista formações do usuário autenticado
   */
  fastify.get('/education', async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const globalUserId = await resolveGlobalUserId(req.user.id, req.tenant.id);
      if (!globalUserId) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const education = await profileEducationCompaniesService.listEducation(globalUserId);
      return reply.status(200).send({
        success: true,
        education,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error listing education');
      return reply.status(500).send({ error: 'Failed to list education' });
    }
  });

  /**
   * GET /profile/company
   * Lista empresas do usuário autenticado
   */
  fastify.get('/company', async (req, reply) => {
    if (!req.user || !req.user.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    try {
      const globalUserId = await resolveGlobalUserId(req.user.id, req.tenant.id);
      if (!globalUserId) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const companies = await profileEducationCompaniesService.listCompanies(globalUserId);
      return reply.status(200).send({
        success: true,
        companies,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Error listing companies');
      return reply.status(500).send({ error: 'Failed to list companies' });
    }
  });
};

export default profileEducationCompaniesRoutes;
















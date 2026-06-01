// src/core/profile/profile.routes.ts
// Rotas de perfil - READ-ONLY para visualização, permite atualização básica

import { FastifyPluginAsync } from 'fastify';
import { profileService } from './profile.service';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { ConflictError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';
import profileProfessionalRoutes from './profile-professional.routes';
import professionalC1Routes from './professional-c1/professional-c1.routes';
import learningC1Routes from './learning-c1/learning-c1.routes';
import interestC1Routes from './interest-c1/interest-c1.routes';
import profilePhysicalRoutes from './profile-physical.routes';
import profileLearningRoutes from './profile-learning.routes';
import profileInferenceRoutes from './profile-inference.routes';
import profileEducationRoutes from './profile-education.routes';
import profileHealthRoutes from './profile-health.routes';

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  // Registrar rotas de perfil profissional
  await fastify.register(profileProfessionalRoutes);
  // Registrar rotas C1 actor-first do perfil profissional (DESENHO_A2 / DECISION-0063)
  await fastify.register(professionalC1Routes);
  // Registrar rotas C1 actor-first de Aprendizado e Interesse (DECISION-0067, Fatia 2)
  await fastify.register(learningC1Routes);
  await fastify.register(interestC1Routes);
  // Registrar rotas de perfil físico
  await fastify.register(profilePhysicalRoutes);
  // Registrar rotas de perfil de aprendizado
  await fastify.register(profileLearningRoutes);
  // Registrar rotas de inferência entre trilhas
  await fastify.register(profileInferenceRoutes);
  // Registrar rotas de educação (domínio separado do profissional - MODELO 100% EVENT-BASED)
  await fastify.register(profileEducationRoutes);
  // Registrar rotas de autodeclaração de saúde
  await fastify.register(profileHealthRoutes);
  /**
   * Handler para buscar perfil
   */
  const getProfileHandler = async (req: any, reply: any) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
    fastify.log.info({
      pid: process.pid,
      route: '/profile',
      method: 'GET',
      userId: req.user?.userId,
      tenantId: req.tenant?.id,
    }, '[RUNTIME] GET /profile');
    
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const userId = req.user.userId;
      if (!userId) {
        return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
      }

      const profile = await profileService.getProfile(req.tenant.id, userId);
      
      if (!profile) {
        // Auto-create profile se não existir (DEV FRIENDLY)
        const newProfile = await profileService.createProfileIfNotExists(req.tenant.id, userId);
        return reply.send({ ok: true, data: newProfile });
      }

      return reply.send({ ok: true, data: profile });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar perfil');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar perfil',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // Rota principal
  fastify.get('/', getProfileHandler);
  
  // TODO: Remover após frontend migrar para rota canônica
  // Alias temporário para compatibilidade: /profile/profile -> /profile
  fastify.get('/profile', getProfileHandler);

  /**
   * Handler para atualizar perfil
   */
  const updateProfileHandler = async (req: any, reply: any) => {
    // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
    fastify.log.info({
      pid: process.pid,
      route: '/profile',
      method: 'PUT',
      userId: req.user?.userId,
      tenantId: req.tenant?.id,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    }, '[RUNTIME] PUT /profile');
    
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const userId = req.user.userId;
      if (!userId) {
        return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
      }

      // 🔴 CORREÇÃO: Aceitar payload vazio ou parcial
      // Normalizar body para garantir que sempre seja um objeto
      const body = req.body || {};
      
      // Log antes de atualizar
      fastify.log.info({
        pid: process.pid,
        tenantId: req.tenant.id,
        userId: userId,
        bodyKeys: Object.keys(body),
        hasBody: !!body && Object.keys(body).length > 0,
      }, 'Atualizando perfil');

      // 🔴 CORREÇÃO: Passar body normalizado (pode ser vazio - upsertProfile faz merge com dados existentes)
      const profile = await profileService.upsertProfile(req.tenant.id, userId, body);
      
      // 🔴 DIAGNÓSTICO: Log após atualizar
      fastify.log.info({
        profile,
      }, 'Perfil atualizado com sucesso');

      // Sincronizar display_name do actor se fullName foi atualizado
      if (body?.fullName && body.fullName.trim() !== '') {
        try {
          const actorRepository = socialPortsRegistry.getActorRepository();
          await actorRepository.updateUserActorDisplayName(
            req.tenant.id,
            userId,
            body.fullName.trim()
          );
          fastify.log.info({
            tenantId: req.tenant.id,
            userId: userId,
            displayName: body.fullName.trim(),
          }, 'Actor display_name sincronizado com perfil');
        } catch (error) {
          // Log erro mas não falha a atualização do perfil
          fastify.log.warn({ err: error }, 'Erro ao sincronizar actor display_name (não crítico)');
        }
      }

      return reply.send({ ok: true, data: profile });
    } catch (error) {
      // 🔴 DIAGNÓSTICO: Log detalhado de erro
      fastify.log.error({ 
        err: error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        body: req.body,
        tenantId: req.tenant?.id,
        userId: req.user?.userId,
      }, 'Erro ao atualizar perfil');
      
      // 🔴 CORREÇÃO: Tratar erros de negócio adequadamente
      // Se for ConflictError (erro de negócio), retornar 409
      if (error instanceof ConflictError) {
        return reply.status(409).send({ 
          ok: false, 
          message: error.message,
          code: error.code || 'CONFLICT'
        });
      }
      
      // Se tiver statusCode definido, usar ele
      const statusCode = (error as any).statusCode || 500;
      
      // Para erros 400 (bad request), retornar 400
      if (statusCode === 400) {
        return reply.status(400).send({ 
          ok: false, 
          message: error instanceof Error ? error.message : 'Erro ao atualizar perfil',
          code: (error as any).code || 'BAD_REQUEST'
        });
      }
      
      // Para outros erros, retornar 500
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao atualizar perfil',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // Rota principal
  fastify.put<{
    Body: {
      fullName?: string;
      phone?: string;
      metadata?: Record<string, any>;
    };
  }>('/', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
    },
  }, updateProfileHandler);
  
  // TODO: Remover após frontend migrar para rota canônica
  // Alias temporário para compatibilidade: /profile/profile -> /profile
  fastify.put<{
    Body: {
      fullName?: string;
      phone?: string;
      metadata?: Record<string, any>;
    };
  }>('/profile', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
    },
  }, updateProfileHandler);

  /**
   * POST /profile/complete-onboarding
   * Marca onboarding como concluído
   * 🔧 FIX (send empty body to completeOnboarding): Aceita body vazio
   */
  fastify.post('/complete-onboarding', {
    bodyLimit: 1024,
    preHandler: async (req: any, reply: any) => {
      // 🔧 FIX (send empty body to completeOnboarding): Aceitar body vazio ou null
      // Se body está vazio ou null, normalizar para objeto vazio
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        req.body = {};
      }
    },
  }, async (req: any, reply: any) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const userId = req.user.userId;
      if (!userId) {
        return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
      }

      const profile = await profileService.completeOnboarding(req.tenant.id, userId);

      return reply.send({
        ok: true,
        data: profile,
        message: 'Onboarding concluído com sucesso'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao completar onboarding');
      // 🔧 FIX: Respeitar statusCode do erro se existir (ex: 400 para validações)
      const statusCode = (error as any)?.statusCode || 500;
      return reply.status(statusCode).send({
        ok: false,
        message: 'Erro ao completar onboarding',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /profile/confirm-first-access
   * Confirma primeiro acesso - seta profile_personal_confirmed = true
   * 🔴 FONTE ÚNICA DE VERDADE: Esta é a flag que controla:
   *  - Se o modal de primeiro acesso aparece (false = aparece, true = não aparece)
   *  - Se os campos pessoais estão bloqueados (true = cadeado ativo)
   *
   * REGRA DE OURO:
   * - Este endpoint FAZ APENAS: setar profile_personal_confirmed = true
   * - NÃO valida dados obrigatórios (isso é responsabilidade do handleSavePersonal)
   * - Permite que o usuário feche o modal e preencha os campos DEPOIS
   * - A validação acontece no salvamento do perfil, não na confirmação do modal
   * - NÃO exige body (pode ser vazio)
   */
  fastify.post('/confirm-first-access', {
    bodyLimit: 1024,
    preHandler: async (req: any, reply: any) => {
      // 🔴 CORREÇÃO: Aceitar body vazio ou null
      // Se body está vazio ou null, normalizar para objeto vazio
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        req.body = {};
      }
    },
  }, async (req: any, reply: any) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const userId = req.user.userId;
      if (!userId) {
        return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
      }

      // ✅ REGRA DE OURO: Apenas setar flag, SEM validar dados obrigatórios
      // O usuário confirma que leu o aviso, mas pode preencher os campos depois
      fastify.log.info({ userId, tenantId: req.tenant.id }, 'Confirmando primeiro acesso (sem validação)');

      // Confirmar primeiro acesso (seta profile_personal_confirmed = true)
      await profileService.confirmFirstAccess(req.tenant.id, userId);

      return reply.send({
        ok: true,
        message: 'Primeiro acesso confirmado'
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao confirmar primeiro acesso');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao confirmar primeiro acesso',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /profile/progress
   * Retorna o progresso de preenchimento do perfil
   */
  fastify.get('/progress', async (req: any, reply: any) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const userId = req.user.userId;
      if (!userId) {
        return reply.status(400).send({ ok: false, message: 'User ID não encontrado' });
      }

      const { coreService } = await import('@core/core.service');
      const progress = await coreService.calculateProfileProgress(req.tenant.id, userId);
      
      // 🔴 CORREÇÃO: Garantir que sempre retorna formato correto
      return reply.send({ 
        ok: true, 
        data: progress || {
          progress: 0,
          maxProgressWithoutValidation: 80,
          hasPresentialValidation: false,
          breakdown: {
            personalData: 0,
            professionalProfile: 0,
            physicalProfile: 0,
            learningProfile: 0,
            companies: 0,
            presentialValidation: 0,
          },
          messages: [],
        }
      });
    } catch (error) {
      // 🔴 CORREÇÃO: Sempre retornar HTTP 200 com fallback zerado
      fastify.log.warn({ 
        err: error, 
        userId: req.user?.userId,
        tenantId: req.tenant?.id 
      }, 'Erro ao calcular progresso do perfil - retornando fallback zerado');
      
      return reply.send({ 
        ok: true, 
        data: {
          progress: 0,
          maxProgressWithoutValidation: 80,
          hasPresentialValidation: false,
          breakdown: {
            personalData: 0,
            professionalProfile: 0,
            physicalProfile: 0,
            learningProfile: 0,
            companies: 0,
            presentialValidation: 0,
          },
          messages: [],
        }
      });
    }
  });
};

export default profileRoutes;


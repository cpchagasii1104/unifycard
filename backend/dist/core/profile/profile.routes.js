"use strict";
// src/core/profile/profile.routes.ts
// Rotas de perfil - READ-ONLY para visualização, permite atualização básica
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const profile_service_1 = require("./profile.service");
const ports_registry_1 = require("@core/social/ports-registry");
const errors_1 = require("@core/errors");
const profile_professional_routes_1 = __importDefault(require("./profile-professional.routes"));
const profile_physical_routes_1 = __importDefault(require("./profile-physical.routes"));
const profile_learning_routes_1 = __importDefault(require("./profile-learning.routes"));
const profile_inference_routes_1 = __importDefault(require("./profile-inference.routes"));
const profile_education_routes_1 = __importDefault(require("./profile-education.routes"));
const profile_health_routes_1 = __importDefault(require("./profile-health.routes"));
const profileRoutes = async (fastify) => {
    // Registrar rotas de perfil profissional
    await fastify.register(profile_professional_routes_1.default);
    // Registrar rotas de perfil físico
    await fastify.register(profile_physical_routes_1.default);
    // Registrar rotas de perfil de aprendizado
    await fastify.register(profile_learning_routes_1.default);
    // Registrar rotas de inferência entre trilhas
    await fastify.register(profile_inference_routes_1.default);
    // Registrar rotas de educação (domínio separado do profissional - MODELO 100% EVENT-BASED)
    await fastify.register(profile_education_routes_1.default);
    // Registrar rotas de autodeclaração de saúde
    await fastify.register(profile_health_routes_1.default);
    /**
     * Handler para buscar perfil
     */
    const getProfileHandler = async (req, reply) => {
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
            const profile = await profile_service_1.profileService.getProfile(req.tenant.id, userId);
            if (!profile) {
                // Auto-create profile se não existir (DEV FRIENDLY)
                const newProfile = await profile_service_1.profileService.createProfileIfNotExists(req.tenant.id, userId);
                return reply.send({ ok: true, data: newProfile });
            }
            return reply.send({ ok: true, data: profile });
        }
        catch (error) {
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
    const updateProfileHandler = async (req, reply) => {
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
            const profile = await profile_service_1.profileService.upsertProfile(req.tenant.id, userId, body);
            // 🔴 DIAGNÓSTICO: Log após atualizar
            fastify.log.info({
                profile,
            }, 'Perfil atualizado com sucesso');
            // Sincronizar display_name do actor se fullName foi atualizado
            if (body?.fullName && body.fullName.trim() !== '') {
                try {
                    const actorRepository = ports_registry_1.socialPortsRegistry.getActorRepository();
                    await actorRepository.updateUserActorDisplayName(req.tenant.id, userId, body.fullName.trim());
                    fastify.log.info({
                        tenantId: req.tenant.id,
                        userId: userId,
                        displayName: body.fullName.trim(),
                    }, 'Actor display_name sincronizado com perfil');
                }
                catch (error) {
                    // Log erro mas não falha a atualização do perfil
                    fastify.log.warn({ err: error }, 'Erro ao sincronizar actor display_name (não crítico)');
                }
            }
            return reply.send({ ok: true, data: profile });
        }
        catch (error) {
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
            if (error instanceof errors_1.ConflictError) {
                return reply.status(409).send({
                    ok: false,
                    message: error.message,
                    code: error.code || 'CONFLICT'
                });
            }
            // Se tiver statusCode definido, usar ele
            const statusCode = error.statusCode || 500;
            // Para erros 400 (bad request), retornar 400
            if (statusCode === 400) {
                return reply.status(400).send({
                    ok: false,
                    message: error instanceof Error ? error.message : 'Erro ao atualizar perfil',
                    code: error.code || 'BAD_REQUEST'
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
    fastify.put('/', {
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
    fastify.put('/profile', {
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
        preHandler: async (req, reply) => {
            // 🔧 FIX (send empty body to completeOnboarding): Aceitar body vazio ou null
            // Se body está vazio ou null, normalizar para objeto vazio
            if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
                req.body = {};
            }
        },
    }, async (req, reply) => {
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
            const profile = await profile_service_1.profileService.completeOnboarding(req.tenant.id, userId);
            return reply.send({
                ok: true,
                data: profile,
                message: 'Onboarding concluído com sucesso'
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao completar onboarding');
            // 🔧 FIX: Respeitar statusCode do erro se existir (ex: 400 para validações)
            const statusCode = error?.statusCode || 500;
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
        preHandler: async (req, reply) => {
            // 🔴 CORREÇÃO: Aceitar body vazio ou null
            // Se body está vazio ou null, normalizar para objeto vazio
            if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
                req.body = {};
            }
        },
    }, async (req, reply) => {
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
            await profile_service_1.profileService.confirmFirstAccess(req.tenant.id, userId);
            return reply.send({
                ok: true,
                message: 'Primeiro acesso confirmado'
            });
        }
        catch (error) {
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
    fastify.get('/progress', async (req, reply) => {
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
            const { coreService } = await Promise.resolve().then(() => __importStar(require('@core/core.service')));
            const progress = await coreService.calculateProfileProgress(req.tenant.id, userId);
            return reply.send({
                ok: true,
                data: progress
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao calcular progresso do perfil');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao calcular progresso do perfil',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.default = profileRoutes;

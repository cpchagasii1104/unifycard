"use strict";
// src/core/profile/profile.routes.ts
// Rotas de perfil - READ-ONLY para visualização, permite atualização básica
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const profile_service_1 = require("./profile.service");
const profile_professional_routes_1 = __importDefault(require("./profile-professional.routes"));
const profile_physical_routes_1 = __importDefault(require("./profile-physical.routes"));
const profile_learning_routes_1 = __importDefault(require("./profile-learning.routes"));
const profile_inference_routes_1 = __importDefault(require("./profile-inference.routes"));
const profile_education_companies_routes_1 = __importDefault(require("./profile-education-companies.routes"));
const profileRoutes = async (fastify) => {
    // Registrar rotas de perfil profissional
    await fastify.register(profile_professional_routes_1.default);
    // Registrar rotas de perfil físico
    await fastify.register(profile_physical_routes_1.default);
    // Registrar rotas de perfil de aprendizado
    await fastify.register(profile_learning_routes_1.default);
    // Registrar rotas de inferência entre trilhas
    await fastify.register(profile_inference_routes_1.default);
    // Registrar rotas de educação e empresas
    await fastify.register(profile_education_companies_routes_1.default);
    /**
     * Handler para buscar perfil
     */
    const getProfileHandler = async (req, reply) => {
        // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
        fastify.log.info({
            pid: process.pid,
            route: '/profile',
            method: 'GET',
            userId: req.user?.id,
            tenantId: req.tenant?.id,
        }, '[RUNTIME] GET /profile');
        if (!req.user) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
        }
        try {
            const profile = await profile_service_1.profileService.getProfile(req.tenant.id, req.user.id);
            if (!profile) {
                // 🔴 CORREÇÃO CRÍTICA: NUNCA usar upsertProfile em GET - só INSERT se realmente não existir
                // Usar createProfileIfNotExists que faz INSERT IF NOT EXISTS, nunca sobrescreve
                const newProfile = await profile_service_1.profileService.createProfileIfNotExists(req.tenant.id, req.user.id);
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
            userId: req.user?.id,
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
            // 🔴 DIAGNÓSTICO: Log antes de atualizar
            fastify.log.info({
                pid: process.pid,
                tenantId: req.tenant.id,
                userId: req.user.id,
                body: req.body,
            }, 'Atualizando perfil');
            const profile = await profile_service_1.profileService.upsertProfile(req.tenant.id, req.user.id, req.body);
            // 🔴 DIAGNÓSTICO: Log após atualizar
            fastify.log.info({
                profile,
            }, 'Perfil atualizado com sucesso');
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
                userId: req.user?.id,
            }, 'Erro ao atualizar perfil');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao atualizar perfil',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    };
    // Rota principal
    fastify.put('/', updateProfileHandler);
    // TODO: Remover após frontend migrar para rota canônica
    // Alias temporário para compatibilidade: /profile/profile -> /profile
    fastify.put('/profile', updateProfileHandler);
};
exports.default = profileRoutes;
//# sourceMappingURL=profile.routes.js.map
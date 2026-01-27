"use strict";
// src/core/catalog/category-review.routes.ts
//
// Rotas administrativas para revisão de categorias criadas por IA
// Apenas role 'admin' pode acessar
Object.defineProperty(exports, "__esModule", { value: true });
const category_review_service_1 = require("./category-review.service");
const categoryReviewRoutes = async (fastify) => {
    /**
     * GET /admin/categories/pending
     * Lista categorias pendentes de aprovação
     * Apenas ADMIN pode acessar
     */
    fastify.get('/pending', {
        preHandler: async (req, reply) => {
            await fastify.requireRole(['admin'])(req, reply);
        },
    }, async (req, reply) => {
        if (!req.user || !req.tenant) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const categories = await category_review_service_1.categoryReviewService.getPendingCategories();
            const count = await category_review_service_1.categoryReviewService.getPendingCount();
            return reply.send({
                ok: true,
                data: {
                    categories,
                    count,
                },
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao buscar categorias pendentes');
            return reply.status(500).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao buscar categorias pendentes',
            });
        }
    });
    /**
     * POST /admin/categories/:id/approve
     * Aprova uma categoria pendente
     * Apenas ADMIN pode acessar
     */
    fastify.post('/:id/approve', {
        preHandler: async (req, reply) => {
            await fastify.requireRole(['admin'])(req, reply);
        },
    }, async (req, reply) => {
        if (!req.user || !req.tenant) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const category = await category_review_service_1.categoryReviewService.approveCategory({
                categoryId: req.params.id,
                adminId: req.user.id || req.user.globalUserId || '',
                tenantId: req.tenant.id,
            });
            return reply.send({
                ok: true,
                data: category,
                message: 'Categoria aprovada com sucesso',
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao aprovar categoria');
            return reply.status(400).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao aprovar categoria',
            });
        }
    });
    /**
     * POST /admin/categories/:id/reject
     * Rejeita uma categoria pendente
     * Apenas ADMIN pode acessar
     */
    fastify.post('/:id/reject', {
        preHandler: async (req, reply) => {
            await fastify.requireRole(['admin'])(req, reply);
        },
    }, async (req, reply) => {
        if (!req.user || !req.tenant) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const category = await category_review_service_1.categoryReviewService.rejectCategory({
                categoryId: req.params.id,
                adminId: req.user.id || req.user.globalUserId || '',
                tenantId: req.tenant.id,
                reason: req.body?.reason,
            });
            return reply.send({
                ok: true,
                data: category,
                message: 'Categoria rejeitada com sucesso',
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao rejeitar categoria');
            return reply.status(400).send({
                ok: false,
                message: error instanceof Error ? error.message : 'Erro ao rejeitar categoria',
            });
        }
    });
};
exports.default = categoryReviewRoutes;

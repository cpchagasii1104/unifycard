"use strict";
// src/modules/social/social-work-apply.routes.ts
//
// Rotas para aplicar a jobs criados a partir de posts sociais
// Permite que usuários se candidatem diretamente via post
Object.defineProperty(exports, "__esModule", { value: true });
const social_work_service_1 = require("./social-work.service");
const application_service_1 = require("../work/applications/application.service");
const worker_service_1 = require("../work/workers/worker.service");
const rbac_service_1 = require("@core/rbac/rbac.service");
const application_schemas_1 = require("../work/applications/application.schemas");
const socialWorkApplyRoutes = async (fastify) => {
    /**
     * POST /social/work/posts/:postId/apply
     * Aplica para um job criado a partir de um post
     * Qualquer usuário autenticado pode aplicar
     */
    fastify.post('/posts/:postId/apply', {
        preHandler: fastify.requirePermission(['work:application:create', 'social:post:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const globalUserId = req.user.globalUserId;
        const { postId } = req.params;
        const requestId = req.requestId || req.id;
        if (!globalUserId) {
            return reply.status(401).send({ error: 'Global user ID required' });
        }
        // Validar body
        const validated = application_schemas_1.createApplicationSchema.parse(req.body);
        req.log.info({
            requestId,
            tenantId,
            userId,
            globalUserId,
            'social-work.action': 'apply-to-post-job',
            postId,
            source: 'social_post',
        }, 'Applying to job from social post');
        try {
            // 1. Resolver job a partir do post
            const job = await social_work_service_1.socialWorkService.resolveJobFromPost(postId, tenantId);
            if (!job) {
                return reply.status(400).send({
                    error: 'Post does not have an associated job. Create a job from this post first.',
                    postId,
                });
            }
            // 2. Buscar worker profile do usuário
            const worker = await worker_service_1.workerService.getByUserId(tenantId, userId);
            if (!worker) {
                return reply.status(400).send({
                    error: 'Worker profile not found. Create a worker profile first.',
                });
            }
            // 3. Criar application
            const application = await application_service_1.applicationService.createApplication(tenantId, worker.workerId, job.jobId, {
                proposedRate: validated.proposedRate,
                message: validated.message,
            });
            req.log.info({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'application-created-from-post',
                postId,
                jobId: job.jobId,
                applicationId: application.applicationId,
                source: 'social_post',
            }, 'Social job application created successfully');
            return reply.status(201).send({
                application,
                postId,
                jobId: job.jobId,
                message: 'Application created successfully from social post',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'apply-to-post-job-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error applying to job from post');
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('does not have')) {
                    return reply.status(400).send({ error: error.message });
                }
            }
            return reply.status(500).send({ error: 'Failed to create application from post' });
        }
    });
    /**
     * GET /social/work/posts/:postId/applicants
     * Lista aplicações (applications) associadas ao job criado pelo post
     * Apenas OWNER ou ADMIN do tenant pode acessar
     */
    fastify.get('/posts/:postId/applicants', {
        preHandler: fastify.requirePermission(['work:application:read', 'social:post:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { postId } = req.params;
        const requestId = req.requestId || req.id;
        // Validar se é OWNER ou ADMIN
        const hasAdminRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, userId, ['admin', 'owner']);
        if (!hasAdminRole) {
            return reply.status(403).send({
                error: 'Only Owner or Admin can view applicants for jobs created from posts',
            });
        }
        req.log.info({
            requestId,
            tenantId,
            userId,
            'social-work.action': 'list-post-applicants',
            postId,
            source: 'social_post',
        }, 'Listing applicants for job from social post');
        try {
            // 1. Resolver job a partir do post
            const job = await social_work_service_1.socialWorkService.resolveJobFromPost(postId, tenantId);
            if (!job) {
                return reply.status(400).send({
                    error: 'Post does not have an associated job.',
                    postId,
                });
            }
            // 2. Buscar applications do job
            const result = await application_service_1.applicationService.listApplications(tenantId, {
                jobId: job.jobId,
            });
            req.log.info({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'applicants-listed-from-post',
                postId,
                jobId: job.jobId,
                count: result.applications.length,
                source: 'social_post',
            }, 'Applicants listed successfully');
            return {
                postId,
                jobId: job.jobId,
                applications: result.applications,
                total: result.total,
            };
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'list-post-applicants-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error listing applicants from post');
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to list applicants' });
        }
    });
};
exports.default = socialWorkApplyRoutes;

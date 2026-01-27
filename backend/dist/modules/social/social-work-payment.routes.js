"use strict";
// src/modules/social/social-work-payment.routes.ts
//
// Rotas para pagar serviços publicados em posts sociais
// Integra Social + Work + Schedule + Economy
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
Object.defineProperty(exports, "__esModule", { value: true });
const social_work_payment_service_1 = require("./social-work-payment.service");
const rbac_service_1 = require("@core/rbac/rbac.service");
const zod_1 = require("zod");
const paymentFromPostSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
});
const socialWorkPaymentRoutes = async (fastify) => {
    /**
     * POST /social/work/posts/:postId/pay
     * Cria um pagamento a partir de um post
     * Qualquer usuário autenticado pode pagar (se tiver schedule reservado)
     */
    fastify.post('/posts/:postId/pay', {
        preHandler: fastify.requirePermission(['economy:transaction:create', 'social:post:read']),
        schema: {
            params: {
                type: 'object',
                properties: {
                    postId: { type: 'string', format: 'uuid' },
                },
            },
            body: {
                type: 'object',
                required: ['amount'],
                properties: {
                    amount: { type: 'number', minimum: 0.01 },
                },
            },
        },
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
        const validated = paymentFromPostSchema.parse(req.body);
        req.log.info({
            requestId,
            tenantId,
            userId,
            globalUserId,
            'social-work.action': 'payment-from-post',
            postId,
            amount: validated.amount,
            source: 'social_post',
        }, 'Creating payment from social post');
        try {
            // Resolver job e schedule para obter IDs
            const scheduledJob = await social_work_payment_service_1.socialWorkPaymentService.resolveScheduledJobFromPost(postId, tenantId, userId);
            if (!scheduledJob) {
                return reply.status(400).send({
                    error: 'No scheduled service found for this post. Schedule a service first.',
                    postId,
                });
            }
            // Resolver job completo para obter providerUserId
            const { socialWorkService } = await Promise.resolve().then(() => __importStar(require('./social-work.service')));
            const jobFull = await socialWorkService.resolveJobFromPost(postId, tenantId);
            if (!jobFull) {
                return reply.status(400).send({
                    error: 'Job not found',
                    postId,
                });
            }
            // Criar pagamento
            const transaction = await social_work_payment_service_1.socialWorkPaymentService.createPaymentFromPost(postId, tenantId, userId, validated.amount);
            req.log.info({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'payment-created-from-post',
                postId,
                jobId: scheduledJob.jobId,
                scheduleId: scheduledJob.scheduleId,
                slotId: scheduledJob.slotId,
                amount: validated.amount,
                transactionId: transaction.transactionId,
                providerUserId: jobFull.clientUserId,
                source: 'social_post',
            }, 'Payment created from social post successfully');
            return reply.status(201).send({
                transaction,
                postId,
                jobId: scheduledJob.jobId,
                scheduleId: scheduledJob.scheduleId,
                slotId: scheduledJob.slotId,
                message: 'Payment processed successfully from social post',
            });
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                globalUserId,
                'social-work.action': 'payment-from-post-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error creating payment from post');
            if (error instanceof Error) {
                if (error.message.includes('not found')) {
                    return reply.status(404).send({ error: error.message });
                }
                if (error.message.includes('No scheduled service')) {
                    return reply.status(400).send({ error: error.message });
                }
                if (error.message.includes('insufficient')) {
                    return reply.status(402).send({ error: 'Insufficient balance' });
                }
            }
            return reply.status(500).send({ error: 'Failed to process payment from post' });
        }
    });
    /**
     * GET /social/work/posts/:postId/payments
     * Lista transações associadas ao job do post
     * Apenas OWNER ou ADMIN do tenant pode acessar
     */
    fastify.get('/posts/:postId/payments', {
        preHandler: fastify.requirePermission(['economy:transaction:read', 'social:post:read']),
    }, async (req, reply) => {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { postId } = req.params;
        const requestId = req.requestId || req.id;
        // Validar se é OWNER ou ADMIN
        const hasAdminRole = await rbac_service_1.rbacService.userHasAnyRole(tenantId, userId, ['admin', 'owner']);
        if (!hasAdminRole) {
            return reply.status(403).send({
                error: 'Only Owner or Admin can view payments for jobs created from posts',
            });
        }
        req.log.info({
            requestId,
            tenantId,
            userId,
            'social-work.action': 'list-post-payments',
            postId,
            source: 'social_post',
        }, 'Listing payments for job from social post');
        try {
            // Resolver job para obter jobId
            const { socialWorkService } = await Promise.resolve().then(() => __importStar(require('./social-work.service')));
            const job = await socialWorkService.resolveJobFromPost(postId, tenantId);
            if (!job) {
                return reply.status(400).send({
                    error: 'Post does not have an associated job.',
                    postId,
                });
            }
            // Buscar transações com metadata.postId ou metadata.jobId
            // Nota: transactionService não tem método de busca por metadata diretamente
            // Vou precisar criar uma query customizada ou usar o repository
            // Por enquanto, vamos retornar uma lista vazia com estrutura preparada
            // TODO: Implementar busca de transações por metadata quando disponível
            req.log.info({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'payments-listed-from-post',
                postId,
                jobId: job.jobId,
                source: 'social_post',
            }, 'Payments listed successfully');
            return {
                postId,
                jobId: job.jobId,
                payments: [], // TODO: Implementar busca real
                total: 0,
            };
        }
        catch (error) {
            req.log.error({
                requestId,
                tenantId,
                userId,
                'social-work.action': 'list-post-payments-error',
                postId,
                error: error instanceof Error ? error.message : String(error),
            }, 'Error listing payments from post');
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Failed to list payments' });
        }
    });
};
exports.default = socialWorkPaymentRoutes;

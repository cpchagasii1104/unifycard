"use strict";
// src/modules/social/social-work.service.ts
//
// Serviço de integração entre Social e Work
// Permite criar jobs a partir de posts da rede social
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialWorkService = void 0;
const social_service_1 = require("./social.service");
const job_service_1 = require("../work/jobs/job.service");
const pool_1 = require("@core/database/pool");
class SocialWorkService {
    /**
     * Resolve user_id local a partir de global_user_id
     */
    async resolveLocalUserId(tenantId, globalUserId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT user_id
      FROM users
      WHERE tenant_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [tenantId, globalUserId]);
        return result?.user_id || null;
    }
    /**
     * Cria um job automaticamente usando dados do post
     */
    async createJobFromPost(postId, globalUserId, tenantId) {
        // 1. Buscar post
        const post = await social_service_1.socialService.getPost(tenantId, postId);
        if (!post) {
            throw new Error('Post not found');
        }
        // 2. Verificar se post pertence ao usuário
        if (post.globalUserId !== globalUserId) {
            throw new Error('You can only create jobs from your own posts');
        }
        // 3. Verificar se já existe job vinculado a este post
        const existingJobId = post.metadata?.jobId;
        if (existingJobId) {
            const existingJob = await job_service_1.jobService.getById(tenantId, existingJobId);
            if (existingJob) {
                throw new Error('Job already exists for this post');
            }
        }
        // 4. Resolver user_id local
        const userId = await this.resolveLocalUserId(tenantId, globalUserId);
        if (!userId) {
            throw new Error('Local user not found for global user');
        }
        // 5. Criar job com dados do post
        // Extrair título do conteúdo (primeiras palavras ou usar conteúdo completo limitado)
        const title = post.content.length > 200
            ? post.content.substring(0, 197) + '...'
            : post.content || 'Job from social post';
        const job = await job_service_1.jobService.createJob(tenantId, userId, {
            title,
            description: post.content,
            requiredSkills: [], // Pode ser preenchido via AI no futuro
        });
        // Nota: metadata sobre source será adicionada via log no job.routes.ts
        // O relacionamento post->job é feito via linkJobToPost abaixo
        // 6. Vincular job ao post
        await social_service_1.socialService.linkJobToPost(postId, job.jobId, tenantId);
        return job;
    }
    /**
     * Retorna o job criado a partir de um post, caso exista
     */
    async getWorkOfferForPost(postId, tenantId) {
        // 1. Buscar post
        const post = await social_service_1.socialService.getPost(tenantId, postId);
        if (!post) {
            return null;
        }
        // 2. Verificar se há job vinculado
        const jobId = post.metadata?.jobId;
        if (!jobId) {
            return null;
        }
        // 3. Buscar job
        const job = await job_service_1.jobService.getById(tenantId, jobId);
        return job;
    }
    /**
     * Resolve job a partir de um post
     * Valida se post existe, se tem jobId e se o job existe
     * Retorna o job ou null se não houver
     */
    async resolveJobFromPost(postId, tenantId) {
        // 1. Buscar post
        const post = await social_service_1.socialService.getPost(tenantId, postId);
        if (!post) {
            throw new Error('Post not found');
        }
        // 2. Verificar se há job vinculado
        const jobId = post.metadata?.jobId || post.jobId;
        if (!jobId) {
            return null;
        }
        // 3. Buscar e validar job
        const job = await job_service_1.jobService.getById(tenantId, jobId);
        if (!job) {
            throw new Error('Job associated with post not found');
        }
        return job;
    }
}
exports.socialWorkService = new SocialWorkService();
//# sourceMappingURL=social-work.service.js.map
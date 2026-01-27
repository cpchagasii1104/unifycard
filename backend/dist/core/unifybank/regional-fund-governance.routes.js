"use strict";
// backend/src/core/unifybank/regional-fund-governance.routes.ts
// Rotas de Governança do Fundo Regional - FASE 8
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const regional_fund_governance_service_1 = require("./regional-fund-governance.service");
const regional_fund_governance_rate_limit_service_1 = require("./regional-fund-governance-rate-limit.service");
const identity_utils_1 = require("@core/identity/identity.utils");
// Schemas de validação
const createProposalSchema = zod_1.z.object({
    title: zod_1.z.string().min(5).max(500),
    description: zod_1.z.string().min(10).max(5000),
    proposalType: zod_1.z.enum(['PROJECT_FUNDING', 'REGIONAL_REINVESTMENT', 'COMMUNITY_EXPENSE']),
    targetType: zod_1.z.enum(['project', 'group', 'platform', 'regional_fund']),
    targetId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive(),
    votingStartsAt: zod_1.z.coerce.date(),
    votingEndsAt: zod_1.z.coerce.date(),
});
const voteSchema = zod_1.z.object({
    vote: zod_1.z.enum(['YES', 'NO']),
});
const listProposalsQuerySchema = zod_1.z.object({
    regionId: zod_1.z.string().optional(),
    status: zod_1.z.enum(['DRAFT', 'OPEN', 'CLOSED', 'EXECUTED', 'REJECTED']).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: zod_1.z.coerce.number().int().min(0).optional().default(0),
});
const governanceRoutes = async (fastify) => {
    /**
     * POST /regional-fund/proposals
     * Cria uma proposta de uso do fundo regional
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * Rate limit: 3 propostas/mês por usuário
     */
    fastify.post('/proposals', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        // 2. Resolver globalUserId
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // 3. Verificar rate limit
        const rateLimit = await regional_fund_governance_rate_limit_service_1.regionalFundGovernanceRateLimitService.checkProposalRateLimit(tenantId, globalUserId);
        if (!rateLimit.allowed) {
            return reply.status(429).send({
                error: 'Rate limit exceeded',
                message: `Limite de ${rateLimit.maxCount} propostas por mês atingido`,
                resetAt: rateLimit.resetAt,
            });
        }
        // 4. Validar payload
        const parsed = createProposalSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const input = parsed.data;
        // 5. Validar targetId se necessário
        if ((input.targetType === 'project' || input.targetType === 'group') && !input.targetId) {
            return reply.status(400).send({
                error: `targetId é obrigatório para ${input.targetType}`,
            });
        }
        try {
            // 6. Criar proposta
            const proposal = await regional_fund_governance_service_1.regionalFundGovernanceService.createProposal(tenantId, globalUserId, input);
            return reply.status(201).send({
                success: true,
                proposal,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error creating proposal');
            return reply.status(500).send({
                error: err.message || 'Failed to create proposal',
            });
        }
    });
    /**
     * GET /regional-fund/proposals
     * Lista propostas do fundo regional
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     */
    fastify.get('/proposals', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        // 2. Validar query params
        const parsed = listProposalsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: parsed.error.errors,
            });
        }
        try {
            const proposals = await regional_fund_governance_service_1.regionalFundGovernanceService.listProposals(tenantId, {
                regionId: parsed.data.regionId,
                status: parsed.data.status,
                limit: parsed.data.limit,
                offset: parsed.data.offset,
            });
            return reply.status(200).send({
                success: true,
                proposals,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error listing proposals');
            return reply.status(500).send({
                error: err.message || 'Failed to list proposals',
            });
        }
    });
    /**
     * GET /regional-fund/proposals/:proposalId
     * Obtém uma proposta específica
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     */
    fastify.get('/proposals/:proposalId', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const { proposalId } = req.params;
        try {
            const proposal = await regional_fund_governance_service_1.regionalFundGovernanceService.getProposal(tenantId, proposalId);
            if (!proposal) {
                return reply.status(404).send({ error: 'Proposal not found' });
            }
            return reply.status(200).send({
                success: true,
                proposal,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error fetching proposal');
            return reply.status(500).send({
                error: err.message || 'Failed to fetch proposal',
            });
        }
    });
    /**
     * POST /regional-fund/proposals/:proposalId/vote
     * Registra voto em uma proposta
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * Rate limit: 10 votos/minuto por usuário
     */
    fastify.post('/proposals/:proposalId/vote', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { proposalId } = req.params;
        // 2. Resolver globalUserId
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // 3. Verificar rate limit
        const rateLimit = await regional_fund_governance_rate_limit_service_1.regionalFundGovernanceRateLimitService.checkVoteRateLimit(tenantId, globalUserId);
        if (!rateLimit.allowed) {
            return reply.status(429).send({
                error: 'Rate limit exceeded',
                message: `Limite de ${rateLimit.maxCount} votos por minuto atingido`,
                resetAt: rateLimit.resetAt,
            });
        }
        // 4. Validar payload
        const parsed = voteSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        try {
            // 5. Registrar voto
            await regional_fund_governance_service_1.regionalFundGovernanceService.vote(tenantId, proposalId, globalUserId, parsed.data.vote);
            return reply.status(200).send({
                success: true,
                message: 'Vote registered',
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error voting on proposal');
            // Tratar erros específicos
            if (err.message.includes('já votou')) {
                return reply.status(409).send({ error: err.message });
            }
            if (err.message.includes('não está em votação')) {
                return reply.status(400).send({ error: err.message });
            }
            if (err.message.includes('não é elegível')) {
                return reply.status(403).send({ error: err.message });
            }
            return reply.status(500).send({
                error: err.message || 'Failed to vote',
            });
        }
    });
    /**
     * POST /regional-fund/proposals/:proposalId/open
     * Abre votação de uma proposta (Admin/System)
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * RBAC: Apenas admin
     */
    fastify.post('/proposals/:proposalId/open', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { proposalId } = req.params;
        // 2. Verificar RBAC (admin)
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Verificar se é admin (role ou allowlist)
        const isAdmin = req.user.role === 'admin' ||
            req.user.isAdmin === true ||
            regional_fund_governance_service_1.regionalFundGovernanceService.isAdmin(globalUserId);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Admin access required' });
        }
        try {
            const proposal = await regional_fund_governance_service_1.regionalFundGovernanceService.openVoting(tenantId, proposalId);
            return reply.status(200).send({
                success: true,
                proposal,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error opening voting');
            if (err.message.includes('não está em DRAFT')) {
                return reply.status(400).send({ error: err.message });
            }
            return reply.status(500).send({
                error: err.message || 'Failed to open voting',
            });
        }
    });
    /**
     * POST /regional-fund/proposals/:proposalId/close
     * Fecha votação de uma proposta (Admin/System)
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * RBAC: Apenas admin
     */
    fastify.post('/proposals/:proposalId/close', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { proposalId } = req.params;
        // 2. Verificar RBAC (admin)
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Verificar se é admin (role ou allowlist)
        const isAdmin = req.user.role === 'admin' ||
            req.user.isAdmin === true ||
            regional_fund_governance_service_1.regionalFundGovernanceService.isAdmin(globalUserId);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Admin access required' });
        }
        try {
            const proposal = await regional_fund_governance_service_1.regionalFundGovernanceService.closeVoting(tenantId, proposalId);
            return reply.status(200).send({
                success: true,
                proposal,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error closing voting');
            if (err.message.includes('não está em votação')) {
                return reply.status(400).send({ error: err.message });
            }
            return reply.status(500).send({
                error: err.message || 'Failed to close voting',
            });
        }
    });
    /**
     * POST /regional-fund/proposals/:proposalId/execute
     * Executa uma proposta aprovada (Admin/System)
     *
     * Autenticação: OBRIGATÓRIA (JWT)
     * RBAC: Apenas admin
     */
    fastify.post('/proposals/:proposalId/execute', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        const { proposalId } = req.params;
        // 2. Verificar RBAC (admin)
        const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(userId, tenantId);
        if (!globalUserId) {
            return reply.status(404).send({ error: 'User not found' });
        }
        // Verificar se é admin (role ou allowlist)
        const isAdmin = req.user.role === 'admin' ||
            req.user.isAdmin === true ||
            regional_fund_governance_service_1.regionalFundGovernanceService.isAdmin(globalUserId);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Admin access required' });
        }
        try {
            const result = await regional_fund_governance_service_1.regionalFundGovernanceService.executeProposal(tenantId, proposalId);
            return reply.status(200).send({
                success: true,
                proposal: result.proposal,
                transactionId: result.transactionId,
            });
        }
        catch (error) {
            const err = error;
            fastify.log.error({ err: error }, 'Error executing proposal');
            if (err.message.includes('não está fechada')) {
                return reply.status(400).send({ error: err.message });
            }
            if (err.message.includes('Quórum não atingido')) {
                return reply.status(400).send({ error: err.message });
            }
            if (err.message.includes('rejeitada')) {
                return reply.status(400).send({ error: err.message });
            }
            if (err.message.includes('Saldo insuficiente')) {
                return reply.status(400).send({ error: err.message });
            }
            return reply.status(500).send({
                error: err.message || 'Failed to execute proposal',
            });
        }
    });
};
exports.default = governanceRoutes;

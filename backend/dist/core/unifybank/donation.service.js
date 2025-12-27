"use strict";
// backend/src/core/unifybank/donation.service.ts
// Serviço de doações via feed
// FASE 4: Doações via Feed
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
exports.donationService = void 0;
const uuid_1 = require("uuid");
const pool_1 = require("@core/database/pool");
const bank_p2p_transfer_service_1 = require("./bank-p2p-transfer.service");
const account_service_1 = require("@core/economy/accounts/account.service");
const group_account_service_1 = require("@core/economy/group-account.service");
const identity_utils_1 = require("@core/identity/identity.utils");
const social_repository_1 = require("@modules/social/social.repository");
const split_engine_service_1 = require("./split-engine.service");
class DonationService {
    socialRepository = new social_repository_1.SocialRepository();
    MAX_DONATIONS_PER_DAY = 20;
    /**
     * Resolve conta de destino baseado no tipo
     */
    async resolveTargetAccount(tenantId, targetType, targetId) {
        if (targetType === 'user') {
            // Para usuário, usar conta primária
            const account = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, targetId, 'BRL');
            return { accountId: account.accountId, targetUserId: targetId };
        }
        else if (targetType === 'group') {
            // Para grupo, usar conta do grupo
            const accountId = await group_account_service_1.groupAccountService.createOrGetGroupAccount(tenantId, targetId);
            return { accountId };
        }
        else if (targetType === 'project') {
            // Para projeto, criar conta diretamente via SQL (project não está em OwnerType)
            // Verificar se já existe
            const existing = await pool_1.pool.query(`
        SELECT account_id
        FROM accounts
        WHERE tenant_id = $1 AND owner_id = $2 AND owner_type = 'project' AND currency = 'BRL'
        LIMIT 1
        `, [tenantId, targetId]);
            if (existing.rows.length > 0) {
                return { accountId: existing.rows[0].account_id };
            }
            // Criar conta de projeto
            const created = await pool_1.pool.query(`
        INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
        VALUES ($1, $2, 'project', 0, 'BRL')
        RETURNING account_id
        `, [tenantId, targetId]);
            if (created.rows.length === 0) {
                throw new Error('Failed to create project account');
            }
            return { accountId: created.rows[0].account_id };
        }
        throw new Error(`Invalid target type: ${targetType}`);
    }
    /**
     * Verifica se target existe
     */
    async validateTarget(tenantId, targetType, targetId) {
        if (targetType === 'user') {
            const globalUserId = await (0, identity_utils_1.resolveGlobalUserId)(targetId, tenantId);
            if (!globalUserId) {
                const error = new Error('Target user not found');
                error.statusCode = 404;
                throw error;
            }
        }
        else if (targetType === 'group') {
            // Verificar se grupo existe
            const { groupsRepository } = await Promise.resolve().then(() => __importStar(require('@modules/groups/groups.repository')));
            const group = await groupsRepository.findById(tenantId, targetId);
            if (!group) {
                const error = new Error('Target group not found');
                error.statusCode = 404;
                throw error;
            }
        }
        else if (targetType === 'project') {
            // Validar que projeto existe (post_projects)
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            const project = await runQueryWithTenant(tenantId, `
        SELECT project_id
        FROM post_projects
        WHERE tenant_id = $1 AND project_id = $2 AND status = 'active'
        LIMIT 1
        `, [tenantId, targetId]);
            if (!project) {
                const error = new Error('Target project not found');
                error.statusCode = 404;
                throw error;
            }
        }
    }
    /**
     * Verifica rate limit (máx 20 doações/dia por usuário)
     */
    async checkRateLimit(tenantId, userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const result = await pool_1.pool.query(`
      SELECT COUNT(*)::text as count
      FROM transactions t
      INNER JOIN accounts a ON t.from_account_id = a.account_id
      WHERE a.tenant_id = $1
        AND a.owner_id = $2
        AND a.owner_type = 'user'
        AND t.metadata->>'type' = 'donation'
        AND t.created_at >= $3
      `, [tenantId, userId, today]);
        const count = parseInt(result.rows[0]?.count || '0', 10);
        if (count >= this.MAX_DONATIONS_PER_DAY) {
            const error = new Error(`Daily donation limit exceeded (${this.MAX_DONATIONS_PER_DAY} donations per day)`);
            error.statusCode = 400;
            throw error;
        }
    }
    /**
     * Cria evento no feed social
     */
    async createFeedEvent(tenantId, fromGlobalUserId, donation) {
        try {
            const content = donation.message || `Doação de R$ ${donation.amount.toFixed(2)}`;
            const post = await this.socialRepository.create({
                tenantId,
                globalUserId: fromGlobalUserId,
                content,
                media: [],
                intent: 'donation',
                confidence: null,
                categories: [],
                suggestedActions: [],
                metadata: {
                    type: 'DONATION',
                    targetType: donation.targetType,
                    targetId: donation.targetId,
                    amount: donation.amount,
                    message: donation.message,
                    transactionId: donation.transactionId,
                },
            });
            return post.post_id;
        }
        catch (error) {
            // Log mas não falha a doação se feed falhar
            console.error('[DonationService] Erro ao criar evento no feed:', error);
            return undefined;
        }
    }
    /**
     * Cria uma doação
     *
     * Fluxo:
     * 1. Validar entrada
     * 2. Verificar rate limit
     * 3. Validar target existe
     * 4. Resolver contas
     * 5. Executar P2P Transfer
     * 6. Criar evento no feed
     * 7. Retornar resultado
     */
    async createDonation(tenantId, input) {
        const { fromUserId, targetType, targetId, amount, message, eventId } = input;
        // 1. Validações básicas
        if (amount <= 0) {
            const error = new Error('Amount must be greater than zero');
            error.statusCode = 400;
            throw error;
        }
        if (targetType === 'user' && fromUserId === targetId) {
            const error = new Error('Cannot donate to yourself');
            error.statusCode = 400;
            throw error;
        }
        // 2. Verificar rate limit
        await this.checkRateLimit(tenantId, fromUserId);
        // 3. Validar target existe
        await this.validateTarget(tenantId, targetType, targetId);
        // 4. Resolver conta de destino
        const targetAccount = await this.resolveTargetAccount(tenantId, targetType, targetId);
        // 5. Executar P2P Transfer
        // Para projetos/grupos, precisamos converter accountId para userId temporário
        // Por enquanto, vamos usar uma abordagem diferente: transferir diretamente
        const finalEventId = eventId || (0, uuid_1.v4)();
        let transferResult;
        if (targetType === 'user') {
            // Usar P2P Transfer diretamente
            transferResult = await bank_p2p_transfer_service_1.bankP2PTransferService.transferP2P(tenantId, {
                fromUserId,
                toUserId: targetId,
                amount,
                eventId: finalEventId,
            });
        }
        else {
            // Para projetos/grupos, usar transactionService diretamente
            const { transactionService } = await Promise.resolve().then(() => __importStar(require('@core/economy/transactions/transaction.service')));
            const fromAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, fromUserId, 'BRL');
            // Validar saldo
            if (fromAccount.balance < amount) {
                const error = new Error('Insufficient balance');
                error.statusCode = 400;
                throw error;
            }
            const result = await transactionService.transfer(tenantId, {
                fromAccount: fromAccount.accountId,
                toAccount: targetAccount.accountId,
                amount,
                eventId: finalEventId,
                metadata: {
                    type: 'donation',
                    targetType,
                    targetId,
                    fromUserId,
                    message: message || null,
                },
            });
            transferResult = {
                transaction: result.transaction,
                fromAccountBalance: result.fromAccountBalance,
                toAccountBalance: result.toAccountBalance,
                fromUserId,
                toUserId: targetId, // Para compatibilidade
            };
        }
        // 6. Aplicar Split Engine (após transação base)
        // IMPORTANTE: Split é obrigatório - se falhar, a doação falha
        // Isso garante consistência financeira
        const fromGlobalUserIdForSplit = await (0, identity_utils_1.resolveGlobalUserId)(fromUserId, tenantId);
        if (!fromGlobalUserIdForSplit) {
            throw new Error('Failed to resolve globalUserId for split');
        }
        const splitResult = await split_engine_service_1.splitEngineService.applySplit({
            baseTransactionId: transferResult.transaction.transactionId,
            amount,
            context: 'donation',
            metadata: {
                targetType,
                targetId,
                fromUserId,
                globalUserId: fromGlobalUserIdForSplit, // OBRIGATÓRIO para resolver regional_fund
                message: message || null,
            },
            tenantId,
        });
        // 7. Criar evento no feed
        const fromGlobalUserId = await (0, identity_utils_1.resolveGlobalUserId)(fromUserId, tenantId);
        const feedPostId = fromGlobalUserId
            ? await this.createFeedEvent(tenantId, fromGlobalUserId, {
                targetType,
                targetId,
                amount,
                message,
                transactionId: transferResult.transaction.transactionId,
            })
            : undefined;
        // 8. Retornar resultado
        return {
            donationId: finalEventId, // Usar eventId como donationId
            transactionId: transferResult.transaction.transactionId,
            fromUserId,
            targetType,
            targetId,
            amount,
            message,
            feedPostId,
            splitGroupId: splitResult.splitGroupId,
            createdAt: new Date(),
        };
    }
}
exports.donationService = new DonationService();
//# sourceMappingURL=donation.service.js.map
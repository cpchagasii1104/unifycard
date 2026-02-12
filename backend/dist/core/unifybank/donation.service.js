"use strict";
// backend/src/core/unifybank/donation.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de doações via feed
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
const ports_registry_1 = require("@core/bank/ports-registry");
const identity_utils_1 = require("@core/identity/identity.utils");
const ports_registry_2 = require("@core/social/ports-registry");
class DonationService {
    MAX_DONATIONS_PER_DAY = 20;
    /**
     * Resolve conta de destino baseado no tipo (Unify Bank)
     */
    async resolveTargetAccount(tenantId, targetType, targetId) {
        if (targetType === 'user') {
            // Para usuário, usar conta do Unify Bank
            const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
            const account = await bankAccount.getOrCreateAccount(tenantId, {
                ownerId: targetId,
                ownerType: 'user',
                currency: 'BRL',
            });
            return { accountId: account.accountId, targetUserId: targetId };
        }
        else if (targetType === 'group') {
            // Para grupo, usar conta do grupo no Unify Bank
            const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
            const account = await bankAccount.getOrCreateAccount(tenantId, {
                ownerId: targetId,
                ownerType: 'company', // Grupos usam ownerType 'company' no Unify Bank
                currency: 'BRL',
            });
            return { accountId: account.accountId };
        }
        else if (targetType === 'project') {
            // Para projeto, usar conta no Unify Bank (ownerType 'company')
            const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
            const account = await bankAccount.getOrCreateAccount(tenantId, {
                ownerId: targetId,
                ownerType: 'company',
                currency: 'BRL',
            });
            return { accountId: account.accountId };
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
            const { groupsPortsRegistry } = await Promise.resolve().then(() => __importStar(require('@core/groups/ports-registry')));
            const groupsRepository = groupsPortsRegistry.getGroupsRepository();
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
     * Verifica rate limit (máx 20 doações/dia por usuário) - usando Unify Bank
     */
    async checkRateLimit(tenantId, userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Buscar conta do usuário no Unify Bank
        const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
        const userAccount = await bankAccount.getAccountByOwner(tenantId, userId, 'user', 'BRL');
        if (!userAccount) {
            // Sem conta = sem doações = dentro do limite
            return;
        }
        // Contar doações do dia usando bank_transactions
        const result = await pool_1.pool.query(`
      SELECT COUNT(*)::text as count
      FROM bank_transactions t
      WHERE t.tenant_id = $1
        AND t.from_account_id = $2
        AND t.metadata->>'type' = 'donation'
        AND t.createdAt >= $3
      `, [tenantId, userAccount.accountId, today]);
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
            const socialRepository = ports_registry_2.socialPortsRegistry.getSocialRepository();
            const post = await socialRepository.create({
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
                    amountCents: donation.amount,
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
        // 5. Executar transferência via Unify Bank
        // Para user: usar P2P transfer (0% fee)
        // Para group/project: usar transaction com split (pode ter splits futuros)
        if (targetType === 'user') {
            // Usar P2P Transfer diretamente (0% fee, 100% para destinatário)
            transferResult = await bank_p2p_transfer_service_1.bankP2PTransferService.transferP2P(tenantId, {
                fromUserId,
                toUserId: targetId,
                amount,
                eventId: finalEventId,
            });
        }
        else {
            // Para projetos/grupos, usar Unify Bank diretamente
            const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
            const fromAccount = await bankAccount.getOrCreateAccount(tenantId, {
                ownerId: fromUserId,
                ownerType: 'user',
                currency: 'BRL',
            });
            // Validar saldo
            const fromBalance = await bankAccount.getBalance(tenantId, fromAccount.accountId);
            if (fromBalance.balance < amount) {
                const error = new Error('Insufficient balance');
                error.statusCode = 400;
                throw error;
            }
            // Resolver actor do doador para autoria
            const { actorRepository } = await Promise.resolve().then(() => __importStar(require('@modules/social/actor.repository')));
            const fromActor = await actorRepository.findOrCreateUserActor(tenantId, fromUserId);
            // Construir autoria (ownership: doador é dono da conta origem)
            const { buildFinancialAuthorshipFromRequest } = await Promise.resolve().then(() => __importStar(require('@modules/bank/financial-authorship.helper')));
            const authorship = buildFinancialAuthorshipFromRequest({
                performedByUserId: fromUserId,
                actingForActorId: fromActor.actor_id,
                actingForAccountId: fromAccount.accountId,
                authoritySource: 'ownership', // Doador é dono da conta origem
            });
            // Criar transação simples (sem split para doações - 100% para destinatário)
            const bankTransaction = ports_registry_1.bankPortsRegistry.getBankTransaction();
            const result = await bankTransaction.createSimpleTransaction(tenantId, {
                eventId: finalEventId,
                fromAccountId: fromAccount.accountId,
                toAccountId: targetAccount.accountId,
                amount,
                currency: 'BRL',
                transactionType: 'transfer',
                description: `Donation: ${targetType} ${targetId}`,
                metadata: {
                    type: 'donation',
                    targetType,
                    targetId,
                    fromUserId,
                    message: message || null,
                },
                authorship,
            });
            // Obter saldos atualizados
            const fromBalanceAfter = await bankAccount.getBalance(tenantId, fromAccount.accountId);
            const toBalanceAfter = await bankAccount.getBalance(tenantId, targetAccount.accountId);
            transferResult = {
                transaction: {
                    transactionId: result.transaction.transactionId,
                    eventId: finalEventId,
                    amount,
                    currency: 'BRL',
                    createdAt: result.transaction.createdAt,
                },
                fromAccountBalance: fromBalanceAfter.balance,
                toAccountBalance: toBalanceAfter.balance,
                fromUserId,
                toUserId: targetId, // Para compatibilidade
            };
        }
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
            splitGroupId: undefined, // CORE não retorna splitGroupId, mas mantém compatibilidade
            createdAt: new Date(),
        };
    }
}
exports.donationService = new DonationService();

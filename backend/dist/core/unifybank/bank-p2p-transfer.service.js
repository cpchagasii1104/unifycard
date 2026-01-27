"use strict";
// backend/src/core/unifybank/bank-p2p-transfer.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de transferência P2P entre usuários
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
exports.bankP2PTransferService = void 0;
const ports_registry_1 = require("@core/bank/ports-registry");
const identity_utils_1 = require("@core/identity/identity.utils");
const pilot_events_service_1 = require("../pilot/pilot-events.service");
class BankP2PTransferService {
    /**
     * Executa transferência P2P entre dois usuários
     *
     * GARANTIAS:
     * - Transação SQL atômica (via transactionService)
     * - Validação de saldo (>= amount)
     * - Idempotência via eventId
     * - Ledger imutável (double-entry)
     * - fromUserId !== toUserId
     * - toUserId deve existir
     *
     * @param tenantId - ID do tenant
     * @param params - Parâmetros da transferência
     * @returns Resultado da transferência
     */
    async transferP2P(tenantId, params) {
        const { fromUserId, toUserId, amount, eventId } = params;
        // 1. Validações básicas
        if (amount <= 0) {
            const error = new Error('Amount must be greater than zero');
            error.statusCode = 400;
            throw error;
        }
        if (fromUserId === toUserId) {
            const error = new Error('Cannot transfer to yourself');
            error.statusCode = 400;
            throw error;
        }
        // 2. Verificar se toUserId existe (buscar global_user_id)
        const toGlobalUserId = await (0, identity_utils_1.resolveGlobalUserId)(toUserId, tenantId);
        if (!toGlobalUserId) {
            const error = new Error('Destination user not found');
            error.statusCode = 404;
            throw error;
        }
        // 3. Resolver contas dos usuários no Unify Bank
        const bankAccount = ports_registry_1.bankPortsRegistry.getBankAccount();
        const fromAccount = await bankAccount.getOrCreateAccount(tenantId, {
            ownerId: fromUserId,
            ownerType: 'user',
            currency: 'BRL',
        });
        const toAccount = await bankAccount.getOrCreateAccount(tenantId, {
            ownerId: toUserId,
            ownerType: 'user',
            currency: 'BRL',
        });
        // 4. Validar saldo do remetente (deve ser >= amount)
        const fromBalance = await bankAccount.getBalance(tenantId, fromAccount.accountId);
        if (fromBalance.balance < amount) {
            const error = new Error('Insufficient balance');
            error.statusCode = 400;
            throw error;
        }
        // 5. SPRINT 36.2: Validar limite diário (enforcement)
        try {
            const bankLimit = ports_registry_1.bankPortsRegistry.getBankLimit();
            await bankLimit.validateLimit(tenantId, fromUserId, 'transfer_out', amount, fromUserId);
        }
        catch (limitError) {
            // Re-throw erro de limite (já tem statusCode 403)
            if (limitError.statusCode === 403) {
                throw limitError;
            }
            // Se não for erro de limite, logar mas não bloquear (fail-open)
            console.warn('[BankLimit] Erro ao validar limite (não bloqueante):', limitError);
        }
        // Resolver actor do remetente para autoria
        const { actorRepository } = await Promise.resolve().then(() => __importStar(require('@modules/social/actor.repository')));
        const fromActor = await actorRepository.findOrCreateUserActor(tenantId, fromUserId);
        // Construir autoria (ownership: remetente é dono da conta origem)
        const { buildFinancialAuthorshipFromRequest } = await Promise.resolve().then(() => __importStar(require('@modules/bank/financial-authorship.helper')));
        const authorship = buildFinancialAuthorshipFromRequest({
            performedByUserId: fromUserId,
            actingForActorId: fromActor.actor_id,
            actingForAccountId: fromAccount.accountId,
            authoritySource: 'ownership', // Remetente é dono da conta origem
        });
        // 5. Executar transferência usando Unify Bank (context: p2p_transfer, 0% fee)
        const bankTransaction = ports_registry_1.bankPortsRegistry.getBankTransaction();
        const result = await bankTransaction.createTransactionWithSplit(tenantId, {
            eventId,
            fromAccountId: fromAccount.accountId,
            amount,
            currency: 'BRL',
            context: 'p2p_transfer',
            revenueShareAccountId: toAccount.accountId, // 100% para destinatário
            fromUserId, // Para calcular referral e group allocation
            description: `P2P transfer: ${fromUserId} → ${toUserId}`,
            metadata: {
                type: 'p2p_transfer',
                fromUserId,
                toUserId,
            },
            authorship,
        });
        // 6. Obter saldos atualizados
        const fromBalanceAfter = await bankAccount.getBalance(tenantId, fromAccount.accountId);
        const toBalanceAfter = await bankAccount.getBalance(tenantId, toAccount.accountId);
        // SPRINT 13: Observar primeira transação (assíncrono, não bloqueia)
        pilot_events_service_1.pilotEventsService.recordEvent(tenantId, {
            eventType: 'first_transaction',
            actorId: fromUserId,
            actorType: 'user',
            metadata: {
                transactionType: 'p2p_transfer',
                amount,
            },
        }).catch((err) => {
            // Erro silencioso - não quebrar fluxo
            console.warn('[PilotObserver] Erro ao registrar evento de transação:', err);
        });
        return {
            transaction: {
                transactionId: result.transaction.transactionId,
                eventId,
                amount,
                currency: 'BRL',
                createdAt: result.transaction.createdAt,
            },
            fromAccountBalance: fromBalanceAfter.balance,
            toAccountBalance: toBalanceAfter.balance,
            fromUserId,
            toUserId,
        };
    }
}
exports.bankP2PTransferService = new BankP2PTransferService();

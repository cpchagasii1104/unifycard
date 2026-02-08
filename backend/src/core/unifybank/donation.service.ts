// backend/src/core/unifybank/donation.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de doações via feed

import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { bankP2PTransferService } from './bank-p2p-transfer.service';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { socialPortsRegistry } from '@core/social/ports-registry';
import type { P2PTransferResult } from './bank-p2p-transfer.service';

export type DonationTargetType = 'user' | 'project' | 'group';

export interface CreateDonationInput {
  fromUserId: string;
  targetType: DonationTargetType;
  targetId: string;
  amountCents: number;
  message?: string;
  eventId?: string;
}

export interface DonationResult {
  donationId: string;
  transactionId: string;
  fromUserId: string;
  targetType: DonationTargetType;
  targetId: string;
  amountCents: number;
  message?: string;
  feedPostId?: string;
  splitGroupId?: string; // ID do grupo de splits aplicados
  createdAt: Date;
}

class DonationService {
  private readonly MAX_DONATIONS_PER_DAY = 20;

  /**
   * Resolve conta de destino baseado no tipo (Unify Bank)
   */
  private async resolveTargetAccount(
    tenantId: string,
    targetType: DonationTargetType,
    targetId: string
  ): Promise<{ accountId: string; targetUserId?: string }> {
    if (targetType === 'user') {
      // Para usuário, usar conta do Unify Bank
      const bankAccount = bankPortsRegistry.getBankAccount();
      const account = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: targetId,
        ownerType: 'user',
        currency: 'BRL',
      });
      return { accountId: account.accountId, targetUserId: targetId };
    } else if (targetType === 'group') {
      // Para grupo, usar conta do grupo no Unify Bank
      const bankAccount = bankPortsRegistry.getBankAccount();
      const account = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: targetId,
        ownerType: 'company', // Grupos usam ownerType 'company' no Unify Bank
        currency: 'BRL',
      });
      return { accountId: account.accountId };
    } else if (targetType === 'project') {
      // Para projeto, usar conta no Unify Bank (ownerType 'company')
      const bankAccount = bankPortsRegistry.getBankAccount();
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
  private async validateTarget(
    tenantId: string,
    targetType: DonationTargetType,
    targetId: string
  ): Promise<void> {
    if (targetType === 'user') {
      const globalUserId = await resolveGlobalUserId(targetId, tenantId);
      if (!globalUserId) {
        const error = new Error('Target user not found');
        (error as any).statusCode = 404;
        throw error;
      }
    } else if (targetType === 'group') {
      // Verificar se grupo existe
      const { groupsPortsRegistry } = await import('@core/groups/ports-registry');
      const groupsRepository = groupsPortsRegistry.getGroupsRepository();
      const group = await groupsRepository.findById(tenantId, targetId);
      if (!group) {
        const error = new Error('Target group not found');
        (error as any).statusCode = 404;
        throw error;
      }
    } else if (targetType === 'project') {
      // Validar que projeto existe (post_projects)
      const { runQueryWithTenant } = await import('@core/database/pool');
      const project = await runQueryWithTenant<{ project_id: string }>(
        tenantId,
        `
        SELECT project_id
        FROM post_projects
        WHERE tenant_id = $1 AND project_id = $2 AND status = 'active'
        LIMIT 1
        `,
        [tenantId, targetId]
      );

      if (!project) {
        const error = new Error('Target project not found');
        (error as any).statusCode = 404;
        throw error;
      }
    }
  }

  /**
   * Verifica rate limit (máx 20 doações/dia por usuário) - usando Unify Bank
   */
  private async checkRateLimit(
    tenantId: string,
    userId: string
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar conta do usuário no Unify Bank
    const bankAccount = bankPortsRegistry.getBankAccount();
    const userAccount = await bankAccount.getAccountByOwner(tenantId, userId, 'user', 'BRL');
    if (!userAccount) {
      // Sem conta = sem doações = dentro do limite
      return;
    }

    // Contar doações do dia usando bank_transactions
    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text as count
      FROM bank_transactions t
      WHERE t.tenant_id = $1
        AND t.from_account_id = $2
        AND t.metadata->>'type' = 'donation'
        AND t.createdAt >= $3
      `,
      [tenantId, userAccount.accountId, today]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);

    if (count >= this.MAX_DONATIONS_PER_DAY) {
      const error = new Error(
        `Daily donation limit exceeded (${this.MAX_DONATIONS_PER_DAY} donations per day)`
      );
      (error as any).statusCode = 400;
      throw error;
    }
  }

  /**
   * Cria evento no feed social
   */
  private async createFeedEvent(
    tenantId: string,
    fromGlobalUserId: string,
    donation: {
      targetType: DonationTargetType;
      targetId: string;
      amountCents: number;
      message?: string;
      transactionId: string;
    }
  ): Promise<string | undefined> {
    try {
      const content = donation.message || `Doação de R$ ${donation.amount.toFixed(2)}`;
      
      const socialRepository = socialPortsRegistry.getSocialRepository();
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
    } catch (error) {
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
  async createDonation(
    tenantId: string,
    input: CreateDonationInput
  ): Promise<DonationResult> {
    const { fromUserId, targetType, targetId, amount, message, eventId } = input;

    // 1. Validações básicas
    if (amount <= 0) {
      const error = new Error('Amount must be greater than zero');
      (error as any).statusCode = 400;
      throw error;
    }

    if (targetType === 'user' && fromUserId === targetId) {
      const error = new Error('Cannot donate to yourself');
      (error as any).statusCode = 400;
      throw error;
    }

    // 2. Verificar rate limit
    await this.checkRateLimit(tenantId, fromUserId);

    // 3. Validar target existe
    await this.validateTarget(tenantId, targetType, targetId);

    // 4. Resolver conta de destino
    const targetAccount = await this.resolveTargetAccount(
      tenantId,
      targetType,
      targetId
    );

    // 5. Executar P2P Transfer
    // Para projetos/grupos, precisamos converter accountId para userId temporário
    // Por enquanto, vamos usar uma abordagem diferente: transferir diretamente
    const finalEventId = eventId || uuidv4();

    let transferResult: P2PTransferResult;

    // 5. Executar transferência via Unify Bank
    // Para user: usar P2P transfer (0% fee)
    // Para group/project: usar transaction com split (pode ter splits futuros)
    if (targetType === 'user') {
      // Usar P2P Transfer diretamente (0% fee, 100% para destinatário)
      transferResult = await bankP2PTransferService.transferP2P(tenantId, {
        fromUserId,
        toUserId: targetId,
        amount,
        eventId: finalEventId,
      });
    } else {
      // Para projetos/grupos, usar Unify Bank diretamente
      const bankAccount = bankPortsRegistry.getBankAccount();
      const fromAccount = await bankAccount.getOrCreateAccount(tenantId, {
        ownerId: fromUserId,
        ownerType: 'user',
        currency: 'BRL',
      });

      // Validar saldo
      const fromBalance = await bankAccount.getBalance(tenantId, fromAccount.accountId);
      if (fromBalance.balance < amount) {
        const error = new Error('Insufficient balance');
        (error as any).statusCode = 400;
        throw error;
      }

      // Resolver actor do doador para autoria
      const { actorRepository } = await import('@modules/social/actor.repository');
      const fromActor = await actorRepository.findOrCreateUserActor(tenantId, fromUserId);

      // Construir autoria (ownership: doador é dono da conta origem)
      const { buildFinancialAuthorshipFromRequest } = await import('@modules/bank/financial-authorship.helper');
      const authorship = buildFinancialAuthorshipFromRequest({
        performedByUserId: fromUserId,
        actingForActorId: fromActor.actor_id,
        actingForAccountId: fromAccount.accountId,
        authoritySource: 'ownership', // Doador é dono da conta origem
      });

      // Criar transação simples (sem split para doações - 100% para destinatário)
      const bankTransaction = bankPortsRegistry.getBankTransaction();
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
    const fromGlobalUserId = await resolveGlobalUserId(fromUserId, tenantId);
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

export const donationService = new DonationService();




























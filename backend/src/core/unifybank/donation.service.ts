// backend/src/core/unifybank/donation.service.ts
// Serviço de doações via feed
// FASE 4: Doações via Feed

import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { bankP2PTransferService } from './bank-p2p-transfer.service';
import { accountService } from '@core/economy/accounts/account.service';
import { groupAccountService } from '@core/economy/group-account.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { SocialRepository } from '@modules/social/social.repository';
import { splitEngineService } from './split-engine.service';
import type { P2PTransferResult } from './bank-p2p-transfer.service';

export type DonationTargetType = 'user' | 'project' | 'group';

export interface CreateDonationInput {
  fromUserId: string;
  targetType: DonationTargetType;
  targetId: string;
  amount: number;
  message?: string;
  eventId?: string;
}

export interface DonationResult {
  donationId: string;
  transactionId: string;
  fromUserId: string;
  targetType: DonationTargetType;
  targetId: string;
  amount: number;
  message?: string;
  feedPostId?: string;
  splitGroupId?: string; // ID do grupo de splits aplicados
  createdAt: Date;
}

class DonationService {
  private socialRepository = new SocialRepository();
  private readonly MAX_DONATIONS_PER_DAY = 20;

  /**
   * Resolve conta de destino baseado no tipo
   */
  private async resolveTargetAccount(
    tenantId: string,
    targetType: DonationTargetType,
    targetId: string
  ): Promise<{ accountId: string; targetUserId?: string }> {
    if (targetType === 'user') {
      // Para usuário, usar conta primária
      const account = await accountService.getOrCreateUserPrimaryAccount(
        tenantId,
        targetId,
        'BRL'
      );
      return { accountId: account.accountId, targetUserId: targetId };
    } else if (targetType === 'group') {
      // Para grupo, usar conta do grupo
      const accountId = await groupAccountService.createOrGetGroupAccount(
        tenantId,
        targetId
      );
      return { accountId };
    } else if (targetType === 'project') {
      // Para projeto, criar conta diretamente via SQL (project não está em OwnerType)
      // Verificar se já existe
      const existing = await pool.query<{ account_id: string }>(
        `
        SELECT account_id
        FROM accounts
        WHERE tenant_id = $1 AND owner_id = $2 AND owner_type = 'project' AND currency = 'BRL'
        LIMIT 1
        `,
        [tenantId, targetId]
      );

      if (existing.rows.length > 0) {
        return { accountId: existing.rows[0].account_id };
      }

      // Criar conta de projeto
      const created = await pool.query<{ account_id: string }>(
        `
        INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
        VALUES ($1, $2, 'project', 0, 'BRL')
        RETURNING account_id
        `,
        [tenantId, targetId]
      );

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
      const { groupsRepository } = await import('@modules/groups/groups.repository');
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
   * Verifica rate limit (máx 20 doações/dia por usuário)
   */
  private async checkRateLimit(
    tenantId: string,
    userId: string
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text as count
      FROM transactions t
      INNER JOIN accounts a ON t.from_account_id = a.account_id
      WHERE a.tenant_id = $1
        AND a.owner_id = $2
        AND a.owner_type = 'user'
        AND t.metadata->>'type' = 'donation'
        AND t.created_at >= $3
      `,
      [tenantId, userId, today]
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
      amount: number;
      message?: string;
      transactionId: string;
    }
  ): Promise<string | undefined> {
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

    if (targetType === 'user') {
      // Usar P2P Transfer diretamente
      transferResult = await bankP2PTransferService.transferP2P(tenantId, {
        fromUserId,
        toUserId: targetId,
        amount,
        eventId: finalEventId,
      });
    } else {
      // Para projetos/grupos, usar transactionService diretamente
      const { transactionService } = await import('@core/economy/transactions/transaction.service');
      const fromAccount = await accountService.getOrCreateUserPrimaryAccount(
        tenantId,
        fromUserId,
        'BRL'
      );

      // Validar saldo
      if (fromAccount.balance < amount) {
        const error = new Error('Insufficient balance');
        (error as any).statusCode = 400;
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
    const fromGlobalUserIdForSplit = await resolveGlobalUserId(fromUserId, tenantId);
    if (!fromGlobalUserIdForSplit) {
      throw new Error('Failed to resolve globalUserId for split');
    }

    const splitResult = await splitEngineService.applySplit({
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
      splitGroupId: splitResult.splitGroupId,
      createdAt: new Date(),
    };
  }
}

export const donationService = new DonationService();
















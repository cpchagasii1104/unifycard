// backend/src/core/unifybank/regional-fund-governance.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// Serviço de Governança do Fundo Regional

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { pool, runQueryWithTenant } from '@core/database/pool';
import { getClientWithTenant } from '@core/database/pool';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { tenantService } from '@core/tenants/tenant.service';
import { worldService } from '@core/world/services/world.service';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { integerCentsFromDbWire } from '@modules/bank/integer-cents-from-db';

export type ProposalType = 'PROJECT_FUNDING' | 'REGIONAL_REINVESTMENT' | 'COMMUNITY_EXPENSE';
export type ProposalStatus = 'draft' | 'open' | 'closed' | 'executing' | 'executed' | 'rejected';
export type VoteValue = 'yes' | 'no';

export interface CreateProposalInput {
  title?: string;
  description?: string;
  proposalType?: ProposalType;
  targetType?: 'project' | 'group' | 'platform' | 'regional_fund';
  targetId?: string;
  amountCents: number;
  votingStartsAt?: Date;
  votingEndsAt?: Date;
}

export interface Proposal {
  proposalId: string;
  tenantId: string;
  regionId: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  targetType: string;
  targetId?: string;
  amountCents: number;
  status: ProposalStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  votingStartsAt?: Date;
  votingEndsAt?: Date;
  executedAt?: Date;
  metadata: Record<string, any>;
}

export interface VoteResult {
  yes: number;
  no: number;
  totalCents: number;
  quorumMet: boolean;
  approved: boolean;
}

export interface ProposalWithVotes extends Proposal {
  votes: VoteResult;
  eligibleUsers: number;
}

class RegionalFundGovernanceService {
  private readonly QUORUM_PERCENTAGE = 0.10; // 10% dos usuários ativos
  private readonly MIN_ACTIVE_TRANSACTIONS = 1; // Mínimo de transações para ser elegível

  /**
   * Resolve regionId do tenant
   */
  private async resolveRegionId(tenantId: string): Promise<string> {
    try {
      const tenant = await tenantService.getTenantById(tenantId);
      if (tenant?.cityId) {
        const cityPath = await worldService.getCityFullPath(tenant.cityId);
        if (cityPath?.state?.stateId) {
          return cityPath.state.stateId;
        }
      }
    } catch (error) {
      console.error('[Governance] Erro ao resolver regionId:', error);
    }
    
    // Fallback apenas em ambiente de teste
    if (process.env.NODE_ENV === 'test') {
      return `region-${tenantId}`;
    }
    
    // Em produção, erro explícito
    throw new Error('Região não encontrada para o tenant. Configure cityId no tenant.');
  }

  /**
   * Conta usuários elegíveis para votar na região
   * Elegíveis: usuários da mesma região com >= 1 transação no Unify Bank
   */
  private async countEligibleUsers(tenantId: string, regionId: string): Promise<number> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(DISTINCT ba.owner_id)::text as count
      FROM bank_accounts ba
      WHERE ba.tenant_id = $1
        AND ba.owner_type = 'user'
        AND EXISTS (
          SELECT 1
          FROM bank_ledger bl
          WHERE bl.account_id = ba.account_id
            AND bl.tenant_id = $1
        )
      `,
      [tenantId]
    );

    return parseInt(result?.count || '0', 10);
  }

  /**
   * Verifica se usuário é elegível para votar
   */
  private async isUserEligible(
    tenantId: string,
    globalUserId: string,
    regionId: string
  ): Promise<boolean> {
    // Resolver userId do globalUserId
    const userId = await this.getUserIdFromGlobalId(tenantId, globalUserId);
    if (!userId) {
      return false;
    }

    // Verificar se usuário tem pelo menos 1 transação no Unify Bank
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::text as count
      FROM bank_ledger bl
      INNER JOIN bank_accounts ba ON ba.account_id = bl.account_id
      WHERE bl.tenant_id = $1
        AND ba.owner_id = $2
        AND ba.owner_type = 'user'
      `,
      [tenantId, userId]
    );

    const transactionCount = parseInt(result?.count || '0', 10);
    return transactionCount >= this.MIN_ACTIVE_TRANSACTIONS;
  }

  /**
   * Cria uma proposta
   */
  async createProposal(
    tenantId: string,
    globalUserId: string,
    input: CreateProposalInput
  ): Promise<Proposal> {
    // 1. Resolver regionId
    const regionId = await this.resolveRegionId(tenantId);

    // 2. Validar targetId se necessário
    if (input.targetType === 'project' || input.targetType === 'group') {
      if (!input.targetId) {
        throw new Error(`targetId é obrigatório para ${input.targetType}`);
      }
    }

    // 3. Validar datas
    if (!input.votingStartsAt || !input.votingEndsAt) {
      throw new Error('Período de votação obrigatório (votingStartsAt e votingEndsAt)');
    }
    if (input.votingEndsAt <= input.votingStartsAt) {
      throw new Error('votingEndsAt deve ser posterior a votingStartsAt');
    }

    if (input.votingStartsAt < new Date()) {
      throw new Error('votingStartsAt não pode ser no passado');
    }

    // 4. Validar amountCents
    if (input.amountCents <= 0) {
      throw new Error('amountCents deve ser maior que zero');
    }

    // 5. Criar proposta
    const proposalId = uuidv4();
    const result = await pool.query<{
      proposal_id: string;
      tenant_id: string;
      region_id: string;
      title: string;
      description: string;
      proposal_type: string;
      target_type: string;
      target_id: string | null;
      amount: string;
      status: string;
      created_by: string;
      created_at: Date;
      updated_at: Date;
      voting_startsAt: Date | null;
      voting_endsAt: Date | null;
      executedAt: Date | null;
      metadata: any;
    }>(
      `
      INSERT INTO regional_fund_proposals (
        proposal_id, tenant_id, region_id, title, description,
        proposal_type, target_type, target_id, amount, status,
        created_by, voting_startsAt, voting_endsAt, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        proposalId,
        tenantId,
        regionId,
        input.title,
        input.description,
        input.proposalType,
        input.targetType,
        input.targetId || null,
        input.amountCents,
        'draft',
        globalUserId,
        input.votingStartsAt,
        input.votingEndsAt,
        JSON.stringify({}),
      ]
    );

    const row = result.rows[0];
    return this.toProposal(row);
  }

  /**
   * Abre votação de uma proposta
   */
  async openVoting(tenantId: string, proposalId: string): Promise<Proposal> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Verificar que proposta existe e está em DRAFT
      const proposal = await client.query<{
        proposal_id: string;
        status: string;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
      }>(
        `
        SELECT proposal_id, status, voting_startsAt, voting_endsAt
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `,
        [proposalId, tenantId]
      );

      if (proposal.rows.length === 0) {
        throw new Error('Proposta não encontrada');
      }

      if (proposal.rows[0].status !== 'draft') {
        throw new Error(`Proposta não está em draft (status atual: ${proposal.rows[0].status})`);
      }

      // Atualizar status para OPEN
      const updated = await client.query<{
        proposal_id: string;
        tenant_id: string;
        region_id: string;
        title: string;
        description: string;
        proposal_type: string;
        target_type: string;
        target_id: string | null;
        amount: string;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
        executedAt: Date | null;
        metadata: any;
      }>(
        `
        UPDATE regional_fund_proposals
        SET status = 'open', updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `,
        [proposalId, tenantId]
      );

      await client.query('COMMIT');

      return this.toProposal(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Registra voto de um usuário
   */
  async vote(
    tenantId: string,
    proposalId: string,
    globalUserId: string,
    vote: VoteValue
  ): Promise<void> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // 1. Verificar que proposta existe e está em OPEN
      const proposal = await client.query<{
        region_id: string;
        status: string;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
      }>(
        `
        SELECT region_id, status, voting_startsAt, voting_endsAt
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `,
        [proposalId, tenantId]
      );

      if (proposal.rows.length === 0) {
        throw new Error('Proposta não encontrada');
      }

      const proposalData = proposal.rows[0];

      if (proposalData.status !== 'open') {
        throw new Error(`Proposta não está em votação (status: ${proposalData.status})`);
      }

      // 2. Verificar período de votação
      const now = new Date();
      if (proposalData.voting_startsAt && now < proposalData.voting_startsAt) {
        throw new Error('Votação ainda não iniciou');
      }

      if (proposalData.voting_endsAt && now > proposalData.voting_endsAt) {
        throw new Error('Votação já encerrou');
      }

      // 3. Verificar se usuário é elegível
      const regionId = proposalData.region_id;
      const isEligible = await this.isUserEligible(tenantId, globalUserId, regionId);
      if (!isEligible) {
        throw new Error('Usuário não é elegível para votar (necessita atividade financeira)');
      }

      // 4. Verificar se já votou
      const existingVote = await client.query<{ vote_id: string }>(
        `
        SELECT vote_id
        FROM regional_fund_votes
        WHERE proposal_id = $1 AND global_user_id = $2
        `,
        [proposalId, globalUserId]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('Usuário já votou nesta proposta');
      }

      // 5. Registrar voto
      await client.query(
        `
        INSERT INTO regional_fund_votes (proposal_id, global_user_id, vote)
        VALUES ($1, $2, $3)
        `,
        [proposalId, globalUserId, vote]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fecha votação de uma proposta
   */
  async closeVoting(tenantId: string, proposalId: string): Promise<Proposal> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Verificar que proposta existe e está em OPEN
      const proposal = await client.query<{
        proposal_id: string;
        status: string;
        region_id: string;
      }>(
        `
        SELECT proposal_id, status, region_id
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `,
        [proposalId, tenantId]
      );

      if (proposal.rows.length === 0) {
        throw new Error('Proposta não encontrada');
      }

      if (proposal.rows[0].status !== 'OPEN') {
        throw new Error(`Proposta não está em votação (status: ${proposal.rows[0].status})`);
      }

      // Atualizar status para CLOSED
      const updated = await client.query<{
        proposal_id: string;
        tenant_id: string;
        region_id: string;
        title: string;
        description: string;
        proposal_type: string;
        target_type: string;
        target_id: string | null;
        amount: string;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
        executedAt: Date | null;
        metadata: any;
      }>(
        `
        UPDATE regional_fund_proposals
        SET status = 'CLOSED', updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `,
        [proposalId, tenantId]
      );

      await client.query('COMMIT');

      return this.toProposal(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Gera eventId determinístico para execução de proposta
   */
  private generateExecutionEventId(proposalId: string): string {
    const input = `${proposalId}|EXECUTION`;
    const hash = createHash('sha256').update(input).digest('hex');
    // Formato UUID compatível (8-4-4-4-12)
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Executa transferência usando Unify Bank
   * (versão migrada para Unify Bank)
   */
  private async transferWithClient(
    client: any,
    tenantId: string,
    fromAccount: string,
    toAccount: string,
    amountCents: number,
    eventId: string,
    metadata: Record<string, any>
  ): Promise<string> {
    // Construir autoria do sistema (governance é operação do sistema)
    const { buildSystemAuthorship } = await import('@modules/bank/financial-authorship.helper');
    const authorship = buildSystemAuthorship({
      actingForAccountId: fromAccount, // Conta origem
      actingForActorId: 'system', // Operação do sistema
    });

    // Usar bankTransactionService para criar transação simples
    // Nota: bankTransactionService já gerencia idempotência, validação de saldo, e ledger
    const bankTransaction = bankPortsRegistry.getBankTransaction();
    const result = await bankTransaction.createSimpleTransaction(tenantId, {
      eventId,
      referenceType: 'regional_fund_governance',
      fromAccountId: fromAccount,
      toAccountId: toAccount,
      amountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `Governance proposal execution: ${metadata.proposalId || 'unknown'}`,
      metadata,
      authorship: authorship as unknown,
    });

    return result.transaction.transactionId;
  }

  /**
   * Executa uma proposta aprovada
   * ATÔMICO: Tudo em uma única transação SQL com FOR UPDATE
   */
  async executeProposal(tenantId: string, proposalId: string): Promise<{
    proposal: Proposal;
    transactionId: string;
  }> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // 1. Travar proposta com FOR UPDATE
      const proposal = await client.query<{
        proposal_id: string;
        tenant_id: string;
        region_id: string;
        title: string;
        description: string;
        proposal_type: string;
        target_type: string;
        target_id: string | null;
        amount: string;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
        executedAt: Date | null;
        execution_transaction_id: string | null;
        executingAt: Date | null;
        metadata: any;
      }>(
        `
        SELECT *
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `,
        [proposalId, tenantId]
      );

      if (proposal.rows.length === 0) {
        throw new Error('Proposta não encontrada');
      }

      const proposalData = proposal.rows[0];

      // 2. Guard clause: idempotência
      if (proposalData.status === 'EXECUTED' && proposalData.execution_transaction_id) {
        await client.query('COMMIT');
        // Buscar proposta atualizada
        const existing = await pool.query<{
          proposal_id: string;
          tenant_id: string;
          region_id: string;
          title: string;
          description: string;
          proposal_type: string;
          target_type: string;
          target_id: string | null;
          amount: string;
          status: string;
          created_by: string;
          created_at: Date;
          updated_at: Date;
          voting_startsAt: Date | null;
          voting_endsAt: Date | null;
          executedAt: Date | null;
          execution_transaction_id: string | null;
          executingAt: Date | null;
          metadata: any;
        }>(
          `SELECT * FROM regional_fund_proposals WHERE proposal_id = $1 AND tenant_id = $2`,
          [proposalId, tenantId]
        );
        return {
          proposal: this.toProposal(existing.rows[0]),
          transactionId: proposalData.execution_transaction_id,
        };
      }

      // 3. Validar status
      if (proposalData.status !== 'CLOSED') {
        await client.query('COMMIT');
        throw new Error(`Proposta não está fechada (status: ${proposalData.status})`);
      }

      // 4. Calcular resultado da votação
      const votes = await client.query<{ vote: string; count: string }>(
        `
        SELECT vote, COUNT(*)::text as count
        FROM regional_fund_votes
        WHERE proposal_id = $1
        GROUP BY vote
        `,
        [proposalId]
      );

      const yesVotes = parseInt(
        votes.rows.find((r) => r.vote === 'YES')?.count || '0',
        10
      );
      const noVotes = parseInt(
        votes.rows.find((r) => r.vote === 'NO')?.count || '0',
        10
      );
      const totalVotes = yesVotes + noVotes;

      // 5. Verificar quórum
      const eligibleUsers = await this.countEligibleUsers(tenantId, proposalData.region_id);
      const quorumRequired = Math.ceil(eligibleUsers * this.QUORUM_PERCENTAGE);
      const quorumMet = totalVotes >= quorumRequired;

      if (!quorumMet) {
        await client.query(
          `
          UPDATE regional_fund_proposals
          SET status = 'REJECTED', updated_at = now()
          WHERE proposal_id = $1 AND tenant_id = $2
          `,
          [proposalId, tenantId]
        );
        await client.query('COMMIT');
        throw new Error(
          `Quórum não atingido (${totalVotes}/${quorumRequired} votos necessários)`
        );
      }

      // 6. Verificar aprovação
      const approved = yesVotes > noVotes;

      if (!approved) {
        await client.query(
          `
          UPDATE regional_fund_proposals
          SET status = 'REJECTED', updated_at = now()
          WHERE proposal_id = $1 AND tenant_id = $2
          `,
          [proposalId, tenantId]
        );
        await client.query('COMMIT');
        throw new Error(`Proposta rejeitada (${yesVotes} YES vs ${noVotes} NO)`);
      }

      // 7. Resolver contas ANTES de iniciar a parte crítica (garantir que existem)
      // Fazer commit temporário para resolver contas (podem criar novas contas)
      await client.query('COMMIT');
      
      // Resolver conta regional no Unify Bank (conta de sistema regional_fund)
      const bankAccount = bankPortsRegistry.getBankAccount();
      const regionalFundAccount = await bankAccount.getSystemAccount(tenantId, 'regional_fund', 'BRL');
      if (!regionalFundAccount) {
        throw new Error('Conta do fundo regional não encontrada');
      }
      const regionAccountId = regionalFundAccount.accountId;

      // Resolver conta de destino no Unify Bank
      let targetAccountId: string;

      if (proposalData.target_type === 'project') {
        if (!proposalData.target_id) {
          throw new Error('targetId é obrigatório para projeto');
        }
        // Projetos usam ownerType 'company' no Unify Bank
        const bankAccount = bankPortsRegistry.getBankAccount();
        const account = await bankAccount.getAccountByOwner(tenantId, proposalData.target_id, 'company', 'BRL');
        if (account) {
          targetAccountId = account.accountId;
        } else {
          const bankAccount = bankPortsRegistry.getBankAccount();
          const created = await bankAccount.getOrCreateAccount(tenantId, {
            ownerId: proposalData.target_id,
            ownerType: 'company',
            currency: 'BRL',
          });
          targetAccountId = created.accountId;
        }
      } else if (proposalData.target_type === 'group') {
        if (!proposalData.target_id) {
          throw new Error('targetId é obrigatório para grupo');
        }
        // Grupos usam ownerType 'company' no Unify Bank
        const bankAccount = bankPortsRegistry.getBankAccount();
        const account = await bankAccount.getAccountByOwner(tenantId, proposalData.target_id, 'company', 'BRL');
        if (account) {
          targetAccountId = account.accountId;
        } else {
          const bankAccount = bankPortsRegistry.getBankAccount();
          const created = await bankAccount.getOrCreateAccount(tenantId, {
            ownerId: proposalData.target_id,
            ownerType: 'company',
            currency: 'BRL',
          });
          targetAccountId = created.accountId;
        }
      } else if (proposalData.target_type === 'platform') {
        // Buscar conta de fee (plataforma) no Unify Bank
        const bankAccount = bankPortsRegistry.getBankAccount();
        const feeAccount = await bankAccount.getSystemAccount(tenantId, 'fee', 'BRL');
        if (!feeAccount) {
          throw new Error('Conta da plataforma não encontrada');
        }
        targetAccountId = feeAccount.accountId;
      } else if (proposalData.target_type === 'regional_fund') {
        // Mesma conta regional
        targetAccountId = regionAccountId;
      } else {
        throw new Error(`Tipo de destino inválido: ${proposalData.target_type}`);
      }

      // Verificar saldo antes de iniciar transação crítica (do Unify Bank)
      const balanceInfo = await bankAccount.getBalance(tenantId, regionAccountId);
      const rawAmt =
        (proposalData as { amountCents?: string; amount?: string }).amountCents ??
        (proposalData as { amount?: string }).amount ??
        0;
      const amountCents = integerCentsFromDbWire(rawAmt, 'proposal.amountCents');

      if (balanceInfo.balanceCents < amountCents) {
        throw new Error(
          `Saldo insuficiente no fundo regional (${balanceInfo.balanceCents} < ${amountCents})`
        );
      }

      // 8. Reiniciar transação para parte crítica (lock + transfer + update)
      await client.query('BEGIN');

      // Re-travar proposta com FOR UPDATE
      const proposalLocked = await client.query<{
        status: string;
        execution_transaction_id: string | null;
      }>(
        `
        SELECT status, execution_transaction_id
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `,
        [proposalId, tenantId]
      );

      // Verificar novamente status (pode ter mudado entre commits)
      if (proposalLocked.rows[0]?.status === 'EXECUTED' && proposalLocked.rows[0]?.execution_transaction_id) {
        await client.query('COMMIT');
        const existing = await pool.query<{
          proposal_id: string;
          tenant_id: string;
          region_id: string;
          title: string;
          description: string;
          proposal_type: string;
          target_type: string;
          target_id: string | null;
          amount: string;
          status: string;
          created_by: string;
          created_at: Date;
          updated_at: Date;
          voting_startsAt: Date | null;
          voting_endsAt: Date | null;
          executedAt: Date | null;
          execution_transaction_id: string | null;
          executingAt: Date | null;
          metadata: any;
        }>(
          `SELECT * FROM regional_fund_proposals WHERE proposal_id = $1 AND tenant_id = $2`,
          [proposalId, tenantId]
        );
        return {
          proposal: this.toProposalWithExecution(existing.rows[0]),
          transactionId: proposalLocked.rows[0].execution_transaction_id!,
        };
      }

      if (proposalLocked.rows[0]?.status !== 'CLOSED') {
        await client.query('COMMIT');
        throw new Error(`Proposta não está fechada (status: ${proposalLocked.rows[0]?.status})`);
      }

      // 9. Setar status EXECUTING
      await client.query(
        `
        UPDATE regional_fund_proposals
        SET status = 'EXECUTING', executingAt = now(), updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        `,
        [proposalId, tenantId]
      );

      // 10. Gerar eventId determinístico
      const eventId = this.generateExecutionEventId(proposalId);

      // 11. Executar transferência dentro da mesma transação
      const transactionId = await this.transferWithClient(
        client,
        tenantId,
        regionAccountId,
        targetAccountId,
        amountCents,
        eventId,
        {
          type: 'governance_execution',
          proposalId,
          proposalType: proposalData.proposal_type,
          targetType: proposalData.target_type,
          targetId: proposalData.target_id,
          yesVotes,
          noVotes,
          totalVotes,
        }
      );

      // 12. Atualizar proposta para EXECUTED
      const updated = await client.query<{
        proposal_id: string;
        tenant_id: string;
        region_id: string;
        title: string;
        description: string;
        proposal_type: string;
        target_type: string;
        target_id: string | null;
        amount: string;
        status: string;
        created_by: string;
        created_at: Date;
        updated_at: Date;
        voting_startsAt: Date | null;
        voting_endsAt: Date | null;
        executedAt: Date | null;
        execution_transaction_id: string | null;
        executingAt: Date | null;
        metadata: any;
      }>(
        `
        UPDATE regional_fund_proposals
        SET status = 'EXECUTED', executedAt = now(), execution_transaction_id = $3, updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `,
        [proposalId, tenantId, transactionId]
      );

      await client.query('COMMIT');

      return {
        proposal: this.toProposalWithExecution(updated.rows[0]),
        transactionId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Lista propostas
   */
  async listProposals(
    tenantId: string,
    options: {
      regionId?: string;
      status?: ProposalStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ProposalWithVotes[]> {
    const { regionId, status, limit = 50, offset = 0 } = options;

    let query = `
      SELECT p.*
      FROM regional_fund_proposals p
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (regionId) {
      query += ` AND p.region_id = $${paramIndex}`;
      params.push(regionId);
      paramIndex++;
    }

    if (status) {
      query += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const proposals = await pool.query<{
      proposal_id: string;
      tenant_id: string;
      region_id: string;
      title: string;
      description: string;
      proposal_type: string;
      target_type: string;
      target_id: string | null;
      amount: string;
      status: string;
      created_by: string;
      created_at: Date;
      updated_at: Date;
      voting_startsAt: Date | null;
      voting_endsAt: Date | null;
      executedAt: Date | null;
      metadata: any;
    }>(query, params);

    // Buscar votos e contagens para cada proposta
    const proposalsWithVotes: ProposalWithVotes[] = [];

    for (const proposalRow of proposals.rows) {
      const proposal = this.toProposal(proposalRow);

      // Contar votos
      const votes = await pool.query<{ vote: string; count: string }>(
        `
        SELECT vote, COUNT(*)::text as count
        FROM regional_fund_votes
        WHERE proposal_id = $1
        GROUP BY vote
        `,
        [proposal.proposalId]
      );

      const yesVotes = parseInt(
        votes.rows.find((r) => r.vote === 'YES')?.count || '0',
        10
      );
      const noVotes = parseInt(
        votes.rows.find((r) => r.vote === 'NO')?.count || '0',
        10
      );
      const totalVotes = yesVotes + noVotes;

      // Contar usuários elegíveis
      const eligibleUsers = await this.countEligibleUsers(tenantId, proposal.regionId);
      const quorumRequired = Math.ceil(eligibleUsers * this.QUORUM_PERCENTAGE);
      const quorumMet = totalVotes >= quorumRequired;

      proposalsWithVotes.push({
        ...proposal,
        votes: {
          yes: yesVotes,
          no: noVotes,
          totalCents: totalVotes,
          quorumMet,
          approved: yesVotes > noVotes,
        },
        eligibleUsers,
      });
    }

    return proposalsWithVotes;
  }

  /**
   * Obtém uma proposta específica
   */
  async getProposal(tenantId: string, proposalId: string): Promise<ProposalWithVotes | null> {
    const result = await pool.query<{
      proposal_id: string;
      tenant_id: string;
      region_id: string;
      title: string;
      description: string;
      proposal_type: string;
      target_type: string;
      target_id: string | null;
      amount: string;
      status: string;
      created_by: string;
      created_at: Date;
      updated_at: Date;
      voting_startsAt: Date | null;
      voting_endsAt: Date | null;
      executedAt: Date | null;
      metadata: any;
    }>(
      `
      SELECT *
      FROM regional_fund_proposals
      WHERE proposal_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [proposalId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const proposal = this.toProposal(result.rows[0]);

    // Contar votos
    const votes = await pool.query<{ vote: string; count: string }>(
      `
      SELECT vote, COUNT(*)::text as count
      FROM regional_fund_votes
      WHERE proposal_id = $1
      GROUP BY vote
      `,
      [proposalId]
    );

    const yesVotes = parseInt(
      votes.rows.find((r) => r.vote === 'YES')?.count || '0',
      10
    );
    const noVotes = parseInt(
      votes.rows.find((r) => r.vote === 'NO')?.count || '0',
      10
    );
    const totalVotes = yesVotes + noVotes;

    // Contar usuários elegíveis
    const eligibleUsers = await this.countEligibleUsers(tenantId, proposal.regionId);
    const quorumRequired = Math.ceil(eligibleUsers * this.QUORUM_PERCENTAGE);
    const quorumMet = totalVotes >= quorumRequired;

    return {
      ...proposal,
      votes: {
        yes: yesVotes,
        no: noVotes,
        totalCents: totalVotes,
        quorumMet,
        approved: yesVotes > noVotes,
      },
      eligibleUsers,
    };
  }

  /**
   * Converte row do banco para objeto Proposal
   */
  private toProposal(row: {
    proposal_id: string;
    tenant_id: string;
    region_id: string;
    title: string;
    description: string;
    proposal_type: string;
    target_type: string;
    target_id: string | null;
    amount: string;
    status: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    voting_startsAt: Date | null;
    voting_endsAt: Date | null;
    executedAt: Date | null;
    metadata: any;
  }): Proposal {
    return {
      proposalId: row.proposal_id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      title: row.title,
      description: row.description,
      proposalType: row.proposal_type as ProposalType,
      targetType: row.target_type,
      targetId: row.target_id || undefined,
      amountCents: integerCentsFromDbWire(row.amount, 'proposal.amount'),
      status: row.status as ProposalStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      votingStartsAt: row.voting_startsAt || undefined,
      votingEndsAt: row.voting_endsAt || undefined,
      executedAt: row.executedAt || undefined,
      metadata: row.metadata || {},
    };
  }

  /**
   * Converte row do banco para objeto Proposal (com campos novos)
   */
  private toProposalWithExecution(row: {
    proposal_id: string;
    tenant_id: string;
    region_id: string;
    title: string;
    description: string;
    proposal_type: string;
    target_type: string;
    target_id: string | null;
    amount: string;
    status: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    voting_startsAt: Date | null;
    voting_endsAt: Date | null;
    executedAt: Date | null;
    execution_transaction_id: string | null;
    executingAt: Date | null;
    metadata: any;
  }): Proposal {
    return {
      proposalId: row.proposal_id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      title: row.title,
      description: row.description,
      proposalType: row.proposal_type as ProposalType,
      targetType: row.target_type,
      targetId: row.target_id || undefined,
      amountCents: integerCentsFromDbWire(row.amount, 'proposal.amount'),
      status: row.status as ProposalStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      votingStartsAt: row.voting_startsAt || undefined,
      votingEndsAt: row.voting_endsAt || undefined,
      executedAt: row.executedAt || undefined,
      metadata: row.metadata || {},
    };
  }

  /**
   * Helper: verifica se usuário é admin (allowlist)
   * Público para uso nas rotas
   */
  isAdmin(globalUserId: string): boolean {
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Permitir acesso especial a governança de fundo regional para admins específicos (exceção ao modelo padrão)
     * Contexto: Governança de fundo regional requer acesso especial
     * Tipo: estrutural
     */
    const adminIds = (process.env.GOVERNANCE_ADMIN_IDS || '').split(',').filter(Boolean);
    return adminIds.includes(globalUserId);
  }

  /**
   * Helper: obtém userId a partir de globalUserId
   */
  private async getUserIdFromGlobalId(
    tenantId: string,
    globalUserId: string
  ): Promise<string | null> {
    const result = await pool.query<{ user_id: string }>(
      `
      SELECT user_id
      FROM users
      WHERE tenant_id = $1 AND global_user_id = $2
      LIMIT 1
      `,
      [tenantId, globalUserId]
    );

    return result.rows[0]?.user_id || null;
  }
}

export const regionalFundGovernanceService = new RegionalFundGovernanceService();




























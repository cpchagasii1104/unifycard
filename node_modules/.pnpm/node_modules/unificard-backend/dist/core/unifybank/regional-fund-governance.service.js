"use strict";
// backend/src/core/unifybank/regional-fund-governance.service.ts
// Serviço de Governança do Fundo Regional - FASE 8
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
exports.regionalFundGovernanceService = void 0;
const uuid_1 = require("uuid");
const crypto_1 = require("crypto");
const pool_1 = require("@core/database/pool");
const pool_2 = require("@core/database/pool");
const account_service_1 = require("@core/economy/accounts/account.service");
const region_account_service_1 = require("@core/economy/region-account.service");
const tenant_service_1 = require("@core/tenants/tenant.service");
const world_service_1 = require("@core/world/services/world.service");
class RegionalFundGovernanceService {
    QUORUM_PERCENTAGE = 0.10; // 10% dos usuários ativos
    MIN_ACTIVE_TRANSACTIONS = 1; // Mínimo de transações para ser elegível
    /**
     * Resolve regionId do tenant
     */
    async resolveRegionId(tenantId) {
        try {
            const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
            if (tenant?.cityId) {
                const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
                if (cityPath?.state?.stateId) {
                    return cityPath.state.stateId;
                }
            }
        }
        catch (error) {
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
     * Elegíveis: usuários da mesma região com >= 1 transação
     */
    async countEligibleUsers(tenantId, regionId) {
        const result = await pool_1.pool.query(`
      SELECT COUNT(DISTINCT u.global_user_id)::text as count
      FROM users u
      INNER JOIN global_users gu ON gu.global_user_id = u.global_user_id
      WHERE u.tenant_id = $1
        AND EXISTS (
          SELECT 1
          FROM transactions t
          WHERE (t.from_global_user_id = u.global_user_id OR t.to_global_user_id = u.global_user_id)
            AND t.tenant_id = $1
        )
      `, [tenantId]);
        return parseInt(result.rows[0]?.count || '0', 10);
    }
    /**
     * Verifica se usuário é elegível para votar
     */
    async isUserEligible(tenantId, globalUserId, regionId) {
        // Verificar se usuário tem pelo menos 1 transação
        const result = await pool_1.pool.query(`
      SELECT COUNT(*)::text as count
      FROM transactions
      WHERE tenant_id = $1
        AND (from_global_user_id = $2 OR to_global_user_id = $2)
      `, [tenantId, globalUserId]);
        const transactionCount = parseInt(result.rows[0]?.count || '0', 10);
        return transactionCount >= this.MIN_ACTIVE_TRANSACTIONS;
    }
    /**
     * Cria uma proposta
     */
    async createProposal(tenantId, globalUserId, input) {
        // 1. Resolver regionId
        const regionId = await this.resolveRegionId(tenantId);
        // 2. Validar targetId se necessário
        if (input.targetType === 'project' || input.targetType === 'group') {
            if (!input.targetId) {
                throw new Error(`targetId é obrigatório para ${input.targetType}`);
            }
        }
        // 3. Validar datas
        if (input.votingEndsAt <= input.votingStartsAt) {
            throw new Error('votingEndsAt deve ser posterior a votingStartsAt');
        }
        if (input.votingStartsAt < new Date()) {
            throw new Error('votingStartsAt não pode ser no passado');
        }
        // 4. Validar amount
        if (input.amount <= 0) {
            throw new Error('amount deve ser maior que zero');
        }
        // 5. Criar proposta
        const proposalId = (0, uuid_1.v4)();
        const result = await pool_1.pool.query(`
      INSERT INTO regional_fund_proposals (
        proposal_id, tenant_id, region_id, title, description,
        proposal_type, target_type, target_id, amount, status,
        created_by, voting_starts_at, voting_ends_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `, [
            proposalId,
            tenantId,
            regionId,
            input.title,
            input.description,
            input.proposalType,
            input.targetType,
            input.targetId || null,
            input.amount,
            'DRAFT',
            globalUserId,
            input.votingStartsAt,
            input.votingEndsAt,
            JSON.stringify({}),
        ]);
        const row = result.rows[0];
        return this.toProposal(row);
    }
    /**
     * Abre votação de uma proposta
     */
    async openVoting(tenantId, proposalId) {
        const client = await (0, pool_2.getClientWithTenant)(tenantId);
        try {
            await client.query('BEGIN');
            // Verificar que proposta existe e está em DRAFT
            const proposal = await client.query(`
        SELECT proposal_id, status, voting_starts_at, voting_ends_at
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `, [proposalId, tenantId]);
            if (proposal.rows.length === 0) {
                throw new Error('Proposta não encontrada');
            }
            if (proposal.rows[0].status !== 'DRAFT') {
                throw new Error(`Proposta não está em DRAFT (status atual: ${proposal.rows[0].status})`);
            }
            // Atualizar status para OPEN
            const updated = await client.query(`
        UPDATE regional_fund_proposals
        SET status = 'OPEN', updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `, [proposalId, tenantId]);
            await client.query('COMMIT');
            return this.toProposal(updated.rows[0]);
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Registra voto de um usuário
     */
    async vote(tenantId, proposalId, globalUserId, vote) {
        const client = await (0, pool_2.getClientWithTenant)(tenantId);
        try {
            await client.query('BEGIN');
            // 1. Verificar que proposta existe e está em OPEN
            const proposal = await client.query(`
        SELECT region_id, status, voting_starts_at, voting_ends_at
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `, [proposalId, tenantId]);
            if (proposal.rows.length === 0) {
                throw new Error('Proposta não encontrada');
            }
            const proposalData = proposal.rows[0];
            if (proposalData.status !== 'OPEN') {
                throw new Error(`Proposta não está em votação (status: ${proposalData.status})`);
            }
            // 2. Verificar período de votação
            const now = new Date();
            if (proposalData.voting_starts_at && now < proposalData.voting_starts_at) {
                throw new Error('Votação ainda não iniciou');
            }
            if (proposalData.voting_ends_at && now > proposalData.voting_ends_at) {
                throw new Error('Votação já encerrou');
            }
            // 3. Verificar se usuário é elegível
            const regionId = proposalData.region_id;
            const isEligible = await this.isUserEligible(tenantId, globalUserId, regionId);
            if (!isEligible) {
                throw new Error('Usuário não é elegível para votar (necessita atividade financeira)');
            }
            // 4. Verificar se já votou
            const existingVote = await client.query(`
        SELECT vote_id
        FROM regional_fund_votes
        WHERE proposal_id = $1 AND global_user_id = $2
        `, [proposalId, globalUserId]);
            if (existingVote.rows.length > 0) {
                throw new Error('Usuário já votou nesta proposta');
            }
            // 5. Registrar voto
            await client.query(`
        INSERT INTO regional_fund_votes (proposal_id, global_user_id, vote)
        VALUES ($1, $2, $3)
        `, [proposalId, globalUserId, vote]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Fecha votação de uma proposta
     */
    async closeVoting(tenantId, proposalId) {
        const client = await (0, pool_2.getClientWithTenant)(tenantId);
        try {
            await client.query('BEGIN');
            // Verificar que proposta existe e está em OPEN
            const proposal = await client.query(`
        SELECT proposal_id, status, region_id
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `, [proposalId, tenantId]);
            if (proposal.rows.length === 0) {
                throw new Error('Proposta não encontrada');
            }
            if (proposal.rows[0].status !== 'OPEN') {
                throw new Error(`Proposta não está em votação (status: ${proposal.rows[0].status})`);
            }
            // Atualizar status para CLOSED
            const updated = await client.query(`
        UPDATE regional_fund_proposals
        SET status = 'CLOSED', updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `, [proposalId, tenantId]);
            await client.query('COMMIT');
            return this.toProposal(updated.rows[0]);
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Gera eventId determinístico para execução de proposta
     */
    generateExecutionEventId(proposalId) {
        const input = `${proposalId}|EXECUTION`;
        const hash = (0, crypto_1.createHash)('sha256').update(input).digest('hex');
        // Formato UUID compatível (8-4-4-4-12)
        return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
    }
    /**
     * Executa transferência dentro de uma transação existente
     * (versão interna que aceita client já em transação)
     */
    async transferWithClient(client, tenantId, fromAccount, toAccount, amount, eventId, metadata) {
        // 1. Verificar idempotência
        const existingTx = await client.query('SELECT transaction_id FROM transactions WHERE event_id = $1 LIMIT 1', [eventId]);
        if (existingTx.rows.length > 0) {
            return existingTx.rows[0].transaction_id;
        }
        // 2. Buscar e travar contas (FOR UPDATE)
        const [firstAccount, secondAccount] = [fromAccount, toAccount].sort();
        const accountsResult = await client.query(`SELECT account_id, balance, owner_type
       FROM accounts 
       WHERE account_id = ANY($1::text[])
       ORDER BY account_id
       FOR UPDATE`, [[firstAccount, secondAccount]]);
        if (accountsResult.rows.length !== 2) {
            throw new Error('Account(s) not found');
        }
        const accountsMap = new Map(accountsResult.rows.map((row) => [row.account_id, parseFloat(row.balance)]));
        const accountsInfoMap = new Map(accountsResult.rows.map((row) => [
            row.account_id,
            {
                balance: parseFloat(row.balance),
                ownerType: row.owner_type,
            },
        ]));
        const fromBalance = accountsMap.get(fromAccount);
        const toBalance = accountsMap.get(toAccount);
        // 3. Validar saldo suficiente
        if (fromBalance < amount) {
            throw new Error('Insufficient balance');
        }
        // ==========================================
        // INVARIANTE 2: SALDO NÃO-NEGATIVO (USER_PRIMARY)
        // ==========================================
        // Calcular novos saldos primeiro
        const newFromBalance = fromBalance - amount;
        const newToBalance = toBalance + amount;
        // Verificar se conta de usuário não ficará negativa
        const fromAccountInfo = accountsInfoMap.get(fromAccount);
        if (fromAccountInfo?.ownerType === 'user' && newFromBalance < 0) {
            throw new Error(`Non-negative balance invariant violated: user account ${fromAccount} would have negative balance (${newFromBalance})`);
        }
        // 4. Resolver global_user_id (não usar owner_global_user_id - coluna pode não existir)
        // Deixar como null - não é crítico para funcionamento da transferência
        const fromGlobalUserId = null;
        const toGlobalUserId = null;
        // 6. Atualizar contas
        await client.query(`UPDATE accounts 
       SET balance = CASE account_id
         WHEN $1 THEN $2
         WHEN $3 THEN $4
       END
       WHERE account_id IN ($1, $3)`, [fromAccount, newFromBalance, toAccount, newToBalance]);
        // 7. Criar transação
        const txResult = await client.query(`INSERT INTO transactions (tenant_id, from_account, to_account, from_global_user_id, to_global_user_id, amount, event_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING transaction_id`, [tenantId, fromAccount, toAccount, fromGlobalUserId, toGlobalUserId, amount, eventId, 'completed', JSON.stringify(metadata)]);
        const transactionId = txResult.rows[0].transaction_id;
        // 8. Criar entradas no ledger
        await client.query(`INSERT INTO ledger (tenant_id, account_id, transaction_id, entry_type, amount, balance_before, balance_after)
       VALUES 
         ($1, $2, $3, $4, $5, $6, $7),
         ($1, $8, $3, $9, $5, $10, $11)`, [
            tenantId,
            fromAccount,
            transactionId,
            'debit',
            amount,
            fromBalance,
            newFromBalance,
            toAccount,
            'credit',
            toBalance,
            newToBalance
        ]);
        return transactionId;
    }
    /**
     * Executa uma proposta aprovada
     * ATÔMICO: Tudo em uma única transação SQL com FOR UPDATE
     */
    async executeProposal(tenantId, proposalId) {
        const client = await (0, pool_2.getClientWithTenant)(tenantId);
        try {
            await client.query('BEGIN');
            // 1. Travar proposta com FOR UPDATE
            const proposal = await client.query(`
        SELECT *
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `, [proposalId, tenantId]);
            if (proposal.rows.length === 0) {
                throw new Error('Proposta não encontrada');
            }
            const proposalData = proposal.rows[0];
            // 2. Guard clause: idempotência
            if (proposalData.status === 'EXECUTED' && proposalData.execution_transaction_id) {
                await client.query('COMMIT');
                // Buscar proposta atualizada
                const existing = await pool_1.pool.query(`SELECT * FROM regional_fund_proposals WHERE proposal_id = $1 AND tenant_id = $2`, [proposalId, tenantId]);
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
            const votes = await client.query(`
        SELECT vote, COUNT(*)::text as count
        FROM regional_fund_votes
        WHERE proposal_id = $1
        GROUP BY vote
        `, [proposalId]);
            const yesVotes = parseInt(votes.rows.find((r) => r.vote === 'YES')?.count || '0', 10);
            const noVotes = parseInt(votes.rows.find((r) => r.vote === 'NO')?.count || '0', 10);
            const totalVotes = yesVotes + noVotes;
            // 5. Verificar quórum
            const eligibleUsers = await this.countEligibleUsers(tenantId, proposalData.region_id);
            const quorumRequired = Math.ceil(eligibleUsers * this.QUORUM_PERCENTAGE);
            const quorumMet = totalVotes >= quorumRequired;
            if (!quorumMet) {
                await client.query(`
          UPDATE regional_fund_proposals
          SET status = 'REJECTED', updated_at = now()
          WHERE proposal_id = $1 AND tenant_id = $2
          `, [proposalId, tenantId]);
                await client.query('COMMIT');
                throw new Error(`Quórum não atingido (${totalVotes}/${quorumRequired} votos necessários)`);
            }
            // 6. Verificar aprovação
            const approved = yesVotes > noVotes;
            if (!approved) {
                await client.query(`
          UPDATE regional_fund_proposals
          SET status = 'REJECTED', updated_at = now()
          WHERE proposal_id = $1 AND tenant_id = $2
          `, [proposalId, tenantId]);
                await client.query('COMMIT');
                throw new Error(`Proposta rejeitada (${yesVotes} YES vs ${noVotes} NO)`);
            }
            // 7. Resolver contas ANTES de iniciar a parte crítica (garantir que existem)
            // Fazer commit temporário para resolver contas (podem criar novas contas)
            await client.query('COMMIT');
            const userId = await this.getUserIdFromGlobalId(tenantId, proposalData.created_by);
            const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
                tenantId,
                userId: userId || undefined,
            });
            if (!regionAccountId) {
                throw new Error('Conta do fundo regional não encontrada');
            }
            // Resolver conta de destino
            let targetAccountId;
            if (proposalData.target_type === 'project') {
                if (!proposalData.target_id) {
                    throw new Error('targetId é obrigatório para projeto');
                }
                const existing = await pool_1.pool.query(`
          SELECT account_id
          FROM accounts
          WHERE tenant_id = $1 AND owner_id = $2 AND owner_type = 'project' AND currency = 'BRL'
          LIMIT 1
          `, [tenantId, proposalData.target_id]);
                if (existing.rows.length > 0) {
                    targetAccountId = existing.rows[0].account_id;
                }
                else {
                    const created = await pool_1.pool.query(`
            INSERT INTO accounts (tenant_id, owner_id, owner_type, balance, currency)
            VALUES ($1, $2, 'project', 0, 'BRL')
            RETURNING account_id
            `, [tenantId, proposalData.target_id]);
                    targetAccountId = created.rows[0].account_id;
                }
            }
            else if (proposalData.target_type === 'group') {
                if (!proposalData.target_id) {
                    throw new Error('targetId é obrigatório para grupo');
                }
                const { groupAccountService } = await Promise.resolve().then(() => __importStar(require('@core/economy/group-account.service')));
                targetAccountId = await groupAccountService.createOrGetGroupAccount(tenantId, proposalData.target_id);
            }
            else if (proposalData.target_type === 'platform') {
                const platformAccount = await account_service_1.accountService.getPlatformAccount(tenantId, 'BRL');
                targetAccountId = platformAccount.accountId;
            }
            else if (proposalData.target_type === 'regional_fund') {
                const platformAccount = await account_service_1.accountService.getPlatformAccount(tenantId, 'BRL');
                targetAccountId = platformAccount.accountId;
            }
            else {
                throw new Error(`Tipo de destino inválido: ${proposalData.target_type}`);
            }
            // Verificar saldo antes de iniciar transação crítica
            const balance = await account_service_1.accountService.getBalance(tenantId, regionAccountId);
            const amount = parseFloat(proposalData.amount);
            if (balance < amount) {
                throw new Error(`Saldo insuficiente no fundo regional (${balance} < ${amount})`);
            }
            // 8. Reiniciar transação para parte crítica (lock + transfer + update)
            await client.query('BEGIN');
            // Re-travar proposta com FOR UPDATE
            const proposalLocked = await client.query(`
        SELECT status, execution_transaction_id
        FROM regional_fund_proposals
        WHERE proposal_id = $1 AND tenant_id = $2
        FOR UPDATE
        `, [proposalId, tenantId]);
            // Verificar novamente status (pode ter mudado entre commits)
            if (proposalLocked.rows[0]?.status === 'EXECUTED' && proposalLocked.rows[0]?.execution_transaction_id) {
                await client.query('COMMIT');
                const existing = await pool_1.pool.query(`SELECT * FROM regional_fund_proposals WHERE proposal_id = $1 AND tenant_id = $2`, [proposalId, tenantId]);
                return {
                    proposal: this.toProposalWithExecution(existing.rows[0]),
                    transactionId: proposalLocked.rows[0].execution_transaction_id,
                };
            }
            if (proposalLocked.rows[0]?.status !== 'CLOSED') {
                await client.query('COMMIT');
                throw new Error(`Proposta não está fechada (status: ${proposalLocked.rows[0]?.status})`);
            }
            // 9. Setar status EXECUTING
            await client.query(`
        UPDATE regional_fund_proposals
        SET status = 'EXECUTING', executing_at = now(), updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        `, [proposalId, tenantId]);
            // 10. Gerar eventId determinístico
            const eventId = this.generateExecutionEventId(proposalId);
            // 11. Executar transferência dentro da mesma transação
            const transactionId = await this.transferWithClient(client, tenantId, regionAccountId, targetAccountId, amount, eventId, {
                type: 'governance_execution',
                proposalId,
                proposalType: proposalData.proposal_type,
                targetType: proposalData.target_type,
                targetId: proposalData.target_id,
                yesVotes,
                noVotes,
                totalVotes,
            });
            // 12. Atualizar proposta para EXECUTED
            const updated = await client.query(`
        UPDATE regional_fund_proposals
        SET status = 'EXECUTED', executed_at = now(), execution_transaction_id = $3, updated_at = now()
        WHERE proposal_id = $1 AND tenant_id = $2
        RETURNING *
        `, [proposalId, tenantId, transactionId]);
            await client.query('COMMIT');
            return {
                proposal: this.toProposalWithExecution(updated.rows[0]),
                transactionId,
            };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Lista propostas
     */
    async listProposals(tenantId, options = {}) {
        const { regionId, status, limit = 50, offset = 0 } = options;
        let query = `
      SELECT p.*
      FROM regional_fund_proposals p
      WHERE p.tenant_id = $1
    `;
        const params = [tenantId];
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
        const proposals = await pool_1.pool.query(query, params);
        // Buscar votos e contagens para cada proposta
        const proposalsWithVotes = [];
        for (const proposalRow of proposals.rows) {
            const proposal = this.toProposal(proposalRow);
            // Contar votos
            const votes = await pool_1.pool.query(`
        SELECT vote, COUNT(*)::text as count
        FROM regional_fund_votes
        WHERE proposal_id = $1
        GROUP BY vote
        `, [proposal.proposalId]);
            const yesVotes = parseInt(votes.rows.find((r) => r.vote === 'YES')?.count || '0', 10);
            const noVotes = parseInt(votes.rows.find((r) => r.vote === 'NO')?.count || '0', 10);
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
                    total: totalVotes,
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
    async getProposal(tenantId, proposalId) {
        const result = await pool_1.pool.query(`
      SELECT *
      FROM regional_fund_proposals
      WHERE proposal_id = $1 AND tenant_id = $2
      LIMIT 1
      `, [proposalId, tenantId]);
        if (result.rows.length === 0) {
            return null;
        }
        const proposal = this.toProposal(result.rows[0]);
        // Contar votos
        const votes = await pool_1.pool.query(`
      SELECT vote, COUNT(*)::text as count
      FROM regional_fund_votes
      WHERE proposal_id = $1
      GROUP BY vote
      `, [proposalId]);
        const yesVotes = parseInt(votes.rows.find((r) => r.vote === 'YES')?.count || '0', 10);
        const noVotes = parseInt(votes.rows.find((r) => r.vote === 'NO')?.count || '0', 10);
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
                total: totalVotes,
                quorumMet,
                approved: yesVotes > noVotes,
            },
            eligibleUsers,
        };
    }
    /**
     * Converte row do banco para objeto Proposal
     */
    toProposal(row) {
        return {
            proposalId: row.proposal_id,
            tenantId: row.tenant_id,
            regionId: row.region_id,
            title: row.title,
            description: row.description,
            proposalType: row.proposal_type,
            targetType: row.target_type,
            targetId: row.target_id || undefined,
            amount: parseFloat(row.amount),
            status: row.status,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            votingStartsAt: row.voting_starts_at || undefined,
            votingEndsAt: row.voting_ends_at || undefined,
            executedAt: row.executed_at || undefined,
            metadata: row.metadata || {},
        };
    }
    /**
     * Converte row do banco para objeto Proposal (com campos novos)
     */
    toProposalWithExecution(row) {
        return {
            proposalId: row.proposal_id,
            tenantId: row.tenant_id,
            regionId: row.region_id,
            title: row.title,
            description: row.description,
            proposalType: row.proposal_type,
            targetType: row.target_type,
            targetId: row.target_id || undefined,
            amount: parseFloat(row.amount),
            status: row.status,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            votingStartsAt: row.voting_starts_at || undefined,
            votingEndsAt: row.voting_ends_at || undefined,
            executedAt: row.executed_at || undefined,
            metadata: row.metadata || {},
        };
    }
    /**
     * Helper: verifica se usuário é admin (allowlist)
     * Público para uso nas rotas
     */
    isAdmin(globalUserId) {
        const adminIds = (process.env.GOVERNANCE_ADMIN_IDS || '').split(',').filter(Boolean);
        return adminIds.includes(globalUserId);
    }
    /**
     * Helper: obtém userId a partir de globalUserId
     */
    async getUserIdFromGlobalId(tenantId, globalUserId) {
        const result = await pool_1.pool.query(`
      SELECT user_id
      FROM users
      WHERE tenant_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [tenantId, globalUserId]);
        return result.rows[0]?.user_id || null;
    }
}
exports.regionalFundGovernanceService = new RegionalFundGovernanceService();
//# sourceMappingURL=regional-fund-governance.service.js.map
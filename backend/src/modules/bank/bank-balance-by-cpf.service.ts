// backend/src/modules/bank/bank-balance-by-cpf.service.ts
// READ-MODEL: Consolidação de Balanço Financeiro por CPF
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

import { runQueriesWithTenant } from '@core/database/pool';
import { bankLedgerRepository } from './bank-ledger.repository';
import { bankAccountRepository } from './bank-account.repository';
import type { BankAccount, BankAccountOwnerType } from './bank-account.types';

/**
 * Saldo de uma conta individual
 */
export interface AccountBalance {
  accountId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  currency: string;
  balanceCents: number;
}

/**
 * Consolidação de balanço por CPF (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Sempre calculado on-demand (nunca persistido)
 * - Nunca usado para decisões
 * - Nunca substitui o ledger
 * - Ledger é a única fonte da verdade
 * - Este é apenas um READ-MODEL para visualização administrativa
 * - NÃO cria conta consolidada por CPF
 * - NÃO mistura saldos contábeis
 * - NÃO altera ledger
 * - NÃO persiste saldo consolidado
 */
export interface BalanceByCpf {
  /**
   * CPF consultado (normalizado, só dígitos)
   */
  cpf: string;

  /**
   * Lista de actors vinculados ao CPF
   */
  actors: Array<{
    actorId: string;
    actorType: 'user' | 'page' | 'group' | 'channel';
    displayName: string;
    userId?: string;
    companyId?: string;
  }>;

  /**
   * Saldos individuais de cada conta (NÃO consolidado contabilmente)
   */
  accountBalances: AccountBalance[];

  /**
   * Soma total APENAS PARA VISUALIZAÇÃO (não é saldo contábil real)
   * NOTA: Esta soma é apenas informativa. Cada conta mantém seu saldo separado.
   */
  totalBalanceForDisplayCents: number;

  /**
   * Timestamp de cálculo (runtime only, não persistido)
   */
  calculatedAt: string; // ISO 8601
}

/**
 * Service para consolidação de balanço por CPF (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Sempre calcula on-demand (nunca persiste)
 * - Nunca usado para decisões
 * - Nunca substitui o ledger
 * - Ledger é a única fonte da verdade
 * - Este é apenas um READ-MODEL para visualização administrativa
 */
class BankBalanceByCpfService {
  /**
   * Obtém consolidação de balanço por CPF (READ-MODEL)
   * 
   * COMPORTAMENTO OBRIGATÓRIO:
   * 1) Buscar todos os Actors vinculados ao CPF
   * 2) Buscar todas as contas desses Actors
   * 3) Calcular saldo de cada conta via ledger
   * 4) Retornar saldos individuais + soma total APENAS PARA VISUALIZAÇÃO
   * 
   * PROIBIÇÕES:
   * - NÃO criar conta consolidada por CPF
   * - NÃO misturar saldos contábeis
   * - NÃO alterar ledger
   * - NÃO persistir saldo consolidado
   * 
   * @param tenantId - ID do tenant
   * @param cpf - CPF normalizado (só dígitos)
   * @returns Consolidação de balanço por CPF (READ-MODEL)
   */
  async getBalanceByCpf(
    tenantId: string,
    cpf: string
  ): Promise<BalanceByCpf> {
    // Normalizar CPF (remover formatação, manter só dígitos)
    const normalizedCpf = cpf.replace(/\D/g, '');

    if (normalizedCpf.length !== 11) {
      throw new Error('CPF inválido: deve conter 11 dígitos');
    }

    // 1. Buscar todos os Actors vinculados ao CPF
    // CPF de busca administrativa usa global_users.cpf como âncora de
    // cadastro/deduplicação, conforme DECISION-0062 D4 (commit 2b8fbd17).
    // users.cpf NÃO existe no schema vivo; resolução é via global_user_id.
    // Saldos continuam sendo lidos exclusivamente do Bank (ledger).
    const users = await runQueriesWithTenant<{
      user_id: string;
      email: string;
      full_name: string | null;
    }>(
      tenantId,
      `
      SELECT u.user_id, u.email, p.full_name
      FROM global_users gu
      JOIN users u ON u.global_user_id = gu.global_user_id
      LEFT JOIN profiles p ON u.user_id = p.user_id AND u.tenant_id = p.tenant_id
      WHERE u.tenant_id = $1
        AND gu.cpf = $2
      `,
      [tenantId, normalizedCpf]
    );

    if (users.length === 0) {
      throw new Error('Nenhum usuário encontrado com este CPF');
    }

    // 2. Buscar todos os Actors vinculados a esses usuários
    const userIds = users.map(u => u.user_id);
    const actors = await runQueriesWithTenant<{
      actor_id: string;
      actor_type: string;
      user_id: string | null;
      company_id: string | null;
      display_name: string;
    }>(
      tenantId,
      `
      SELECT actor_id, actor_type, user_id, company_id, display_name
      FROM actors
      WHERE tenant_id = $1
        AND (
          user_id = ANY($2::uuid[])
          -- DECISION-0042: membership consolidado em company_users (SSOT unico).
          -- company_users vincula global_user_id (nao user_id); resolver via JOIN.
          OR company_id IN (
            SELECT cu.company_id
            FROM company_users cu
            JOIN users u ON u.global_user_id = cu.global_user_id
            WHERE cu.tenant_id = $1
              AND u.user_id = ANY($2::uuid[])
              AND cu.role IN ('owner', 'admin')
              AND cu.member_status = 'active'
          )
        )
      `,
      [tenantId, userIds]
    );

    if (actors.length === 0) {
      throw new Error('Nenhum actor encontrado vinculado a este CPF');
    }

    // 3. Buscar todas as contas desses Actors
    // NOTA: owner_id em bank_accounts pode ser:
    // - user_id (se owner_type='user')
    // - company_id ou actor_id (se owner_type='company')
    // - system_id (se owner_type='system')
    // Para user: buscar contas onde owner_id = user_id e owner_type='user'
    // Para company: buscar contas onde owner_id = company_id ou actor_id e owner_type='company'
    const userIdsForAccounts = userIds;
    const companyIds = actors.filter(a => a.company_id).map(a => a.company_id!);
    const actorIdsForAccounts = actors.map(a => a.actor_id);

    // Construir query dinamicamente para lidar com arrays vazios
    const conditions: string[] = [];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (userIdsForAccounts.length > 0) {
      conditions.push(`(owner_type = 'user' AND owner_id = ANY($${paramIndex}::uuid[]))`);
      params.push(userIdsForAccounts);
      paramIndex++;
    }

    if (companyIds.length > 0 || actorIdsForAccounts.length > 0) {
      const companyConditions: string[] = [];
      if (companyIds.length > 0) {
        companyConditions.push(`owner_id = ANY($${paramIndex}::uuid[])`);
        params.push(companyIds);
        paramIndex++;
      }
      if (actorIdsForAccounts.length > 0) {
        companyConditions.push(`owner_id = ANY($${paramIndex}::uuid[])`);
        params.push(actorIdsForAccounts);
        paramIndex++;
      }
      if (companyConditions.length > 0) {
        conditions.push(`(owner_type = 'company' AND (${companyConditions.join(' OR ')}))`);
      }
    }

    if (conditions.length === 0) {
      // Se não há condições, retornar array vazio
      return {
        cpf: normalizedCpf,
        actors: actors.map(a => ({
          actorId: a.actor_id,
          actorType: a.actor_type as 'user' | 'page' | 'group' | 'channel',
          displayName: a.display_name,
          userId: a.user_id || undefined,
          companyId: a.company_id || undefined,
        })),
        accountBalances: [],
        totalBalanceForDisplayCents: 0,
        calculatedAt: new Date().toISOString(),
      };
    }

    const query = `
      SELECT account_id, owner_id, owner_type, currency
      FROM bank_accounts
      WHERE tenant_id = $1
        AND (${conditions.join(' OR ')})
    `;

    const accounts = await runQueriesWithTenant<{
      account_id: string;
      owner_id: string;
      owner_type: string;
      currency: string;
    }>(tenantId, query, params);

    // 4. Calcular saldo de cada conta via ledger (FONTE DA VERDADE)
    const accountBalances: AccountBalance[] = [];
    let totalBalanceForDisplayCents = 0;

    for (const account of accounts) {
      const balance = await bankLedgerRepository.calculateBalance(
        tenantId,
        account.account_id
      );

      accountBalances.push({
        accountId: account.account_id,
        ownerId: account.owner_id,
        ownerType: account.owner_type as BankAccountOwnerType,
        currency: account.currency,
        balanceCents: balance.balanceCents,
      });

      // Soma total APENAS PARA VISUALIZAÇÃO (não é saldo contábil real)
      totalBalanceForDisplayCents += balance.balanceCents;
    }

    // 5. Retornar estrutura consolidada (READ-MODEL)
    return {
      cpf: normalizedCpf,
      actors: actors.map(a => ({
        actorId: a.actor_id,
        actorType: a.actor_type as 'user' | 'page' | 'group' | 'channel',
        displayName: a.display_name,
        userId: a.user_id || undefined,
        companyId: a.company_id || undefined,
      })),
      accountBalances,
      totalBalanceForDisplayCents,
      calculatedAt: new Date().toISOString(),
    };
  }
}

export const bankBalanceByCpfService = new BankBalanceByCpfService();


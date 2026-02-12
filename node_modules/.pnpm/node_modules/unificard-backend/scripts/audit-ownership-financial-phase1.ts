#!/usr/bin/env ts-node
/**
 * FASE 1 — AUDITORIA E PREPARAÇÃO
 * MIGRAÇÃO CANÔNICA DE OWNERSHIP FINANCEIRO
 * 
 * ESCOPO: SOMENTE LEITURA — PROIBIDO ALTERAR DADOS OU SCHEMA
 * 
 * Este script executa auditoria completa de ownership financeiro:
 * - Auditoria de accounts
 * - Mapeamento owner → actor
 * - Auditoria de contas de sistema
 * - Auditoria de escrows
 * - Auditoria de group_balance
 * 
 * OUTPUT: Relatório estruturado em Markdown
 */

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import * as fs from 'fs';
import * as path from 'path';

interface AccountRow {
  account_id: string;
  tenant_id: string;
  owner_id: string;
  owner_type: string;
  currency: string;
  balance: string;
  created_at: Date;
  updated_at: Date;
}

interface ActorRow {
  actor_id: string;
  tenant_id: string;
  actor_type: string;
  user_id: string | null;
  company_id: string | null;
  group_id: string | null;
}

interface EscrowAccountRow {
  escrow_id: string;
  tenant_id: string;
  agreement_id: string;
  service_order_id: string | null;
  bundle_id: string | null;
}

interface GroupBalanceRow {
  group_id: string;
  tenant_id: string;
  current_balance: string;
}

interface AuditResult {
  accounts: {
    total: number;
    byOwnerType: Record<string, number>;
    byCurrency: Record<string, number>;
    byTenant: Record<string, number>;
    duplicates: Array<{
      tenant_id: string;
      owner_id: string;
      owner_type: string;
      currency: string;
      count: number;
    }>;
    nullOwners: number;
  };
  ownerToActor: {
    ok: number;
    blocked: number;
    ambiguous: number;
    details: Array<{
      account_id: string;
      owner_id: string;
      owner_type: string;
      status: 'OK' | 'BLOQUEIO' | 'AMBÍGUO';
      actor_ids: string[];
      reason: string;
    }>;
  };
  systemAccounts: {
    fee: number;
    regional_fund: number;
    reserve: number;
    escrow: number;
    other: number;
    withoutActor: Array<{
      account_id: string;
      owner_id: string;
      metadata: any;
    }>;
  };
  escrows: {
    total: number;
    withBankAccount: number;
    withoutBankAccount: number;
    inferredOwnership: Array<{
      escrow_id: string;
      agreement_id: string;
      reason: string;
    }>;
  };
  groupBalance: {
    total: number;
    classification: 'READ-MODEL' | 'VIOLAÇÃO DE CORE' | 'INDETERMINADO';
    reason: string;
  };
}

async function auditAccounts(tenantId: string): Promise<AuditResult['accounts']> {
  // Total de contas (defensivo: se não houver resultado, usar 0)
  const totalResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    'SELECT COUNT(*) as count FROM accounts WHERE tenant_id = $1',
    [tenantId]
  );
  const total = totalResult ? parseInt(totalResult.count ?? '0', 10) : 0;

  // Por owner_type (defensivo: se não houver resultados, array vazio)
  const byOwnerTypeResult = await runQueriesWithTenant<{ owner_type: string; count: string }>(
    tenantId,
    `SELECT owner_type, COUNT(*) as count 
     FROM accounts 
     WHERE tenant_id = $1 
     GROUP BY owner_type`,
    [tenantId]
  );
  const byOwnerType: Record<string, number> = {};
  if (byOwnerTypeResult && Array.isArray(byOwnerTypeResult)) {
    byOwnerTypeResult.forEach(row => {
      byOwnerType[row.owner_type] = parseInt(row.count ?? '0', 10);
    });
  }

  // Por currency (defensivo)
  const byCurrencyResult = await runQueriesWithTenant<{ currency: string; count: string }>(
    tenantId,
    `SELECT currency, COUNT(*) as count 
     FROM accounts 
     WHERE tenant_id = $1 
     GROUP BY currency`,
    [tenantId]
  );
  const byCurrency: Record<string, number> = {};
  if (byCurrencyResult && Array.isArray(byCurrencyResult)) {
    byCurrencyResult.forEach(row => {
      byCurrency[row.currency] = parseInt(row.count ?? '0', 10);
    });
  }

  // Por tenant (já filtrado, mas mantendo estrutura)
  const byTenant: Record<string, number> = { [tenantId]: total };

  // Duplicatas (violando UNIQUE constraint) (defensivo)
  const duplicatesResult = await runQueriesWithTenant<{
    tenant_id: string;
    owner_id: string;
    owner_type: string;
    currency: string;
    count: string;
  }>(
    tenantId,
    `SELECT tenant_id, owner_id, owner_type, currency, COUNT(*) as count
     FROM accounts
     WHERE tenant_id = $1
     GROUP BY tenant_id, owner_id, owner_type, currency
     HAVING COUNT(*) > 1`,
    [tenantId]
  );
  const duplicates = (duplicatesResult && Array.isArray(duplicatesResult))
    ? duplicatesResult.map(row => ({
        tenant_id: row.tenant_id,
        owner_id: row.owner_id,
        owner_type: row.owner_type,
        currency: row.currency,
        count: parseInt(row.count ?? '0', 10),
      }))
    : [];

  // Contas com owner_id NULL (não deveria existir por constraint) (defensivo)
  const nullOwnersResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    'SELECT COUNT(*) as count FROM accounts WHERE tenant_id = $1 AND owner_id IS NULL',
    [tenantId]
  );
  const nullOwners = nullOwnersResult ? parseInt(nullOwnersResult.count ?? '0', 10) : 0;

  return {
    total,
    byOwnerType,
    byCurrency,
    byTenant,
    duplicates,
    nullOwners,
  };
}

async function mapOwnerToActor(tenantId: string): Promise<AuditResult['ownerToActor']> {
  // Buscar todas as contas (defensivo)
  const accountsResult = await runQueriesWithTenant<AccountRow>(
    tenantId,
    'SELECT * FROM accounts WHERE tenant_id = $1',
    [tenantId]
  );

  const details: AuditResult['ownerToActor']['details'] = [];
  let ok = 0;
  let blocked = 0;
  let ambiguous = 0;

  // Se não houver contas, retornar vazio
  if (!accountsResult || !Array.isArray(accountsResult) || accountsResult.length === 0) {
    console.warn('⚠️  Nenhuma conta encontrada para mapeamento owner → actor');
    return { ok: 0, blocked: 0, ambiguous: 0, details: [] };
  }

  for (const account of accountsResult) {
      let actorIds: string[] = [];
      let status: 'OK' | 'BLOQUEIO' | 'AMBÍGUO' = 'BLOQUEIO';
      let reason = '';

    if (account.owner_type === 'user') {
      // Buscar actor tipo 'user' com user_id = owner_id (defensivo)
      const actorsResult = await runQueriesWithTenant<ActorRow>(
        tenantId,
        `SELECT actor_id FROM actors 
         WHERE tenant_id = $1 
           AND actor_type = 'user' 
           AND user_id = $2`,
        [tenantId, account.owner_id]
      );
      actorIds = (actorsResult && Array.isArray(actorsResult)) 
        ? actorsResult.map(r => r.actor_id)
        : [];
        
        if (actorIds.length === 0) {
          status = 'BLOQUEIO';
          reason = 'Nenhum actor tipo "user" encontrado com user_id = owner_id';
        } else if (actorIds.length === 1) {
          status = 'OK';
          reason = 'Actor encontrado';
        } else {
          status = 'AMBÍGUO';
          reason = `Múltiplos actors encontrados: ${actorIds.length}`;
        }
    } else if (account.owner_type === 'merchant' || account.owner_type === 'company') {
      // Buscar actor tipo 'page' com company_id = owner_id (defensivo)
      // Nota: accounts usa 'merchant', mas pode haver 'company' também
      const actorsResult = await runQueriesWithTenant<ActorRow>(
        tenantId,
        `SELECT actor_id FROM actors 
         WHERE tenant_id = $1 
           AND actor_type = 'page' 
           AND company_id = $2`,
        [tenantId, account.owner_id]
      );
      actorIds = (actorsResult && Array.isArray(actorsResult))
        ? actorsResult.map(r => r.actor_id)
        : [];
        
        if (actorIds.length === 0) {
          status = 'BLOQUEIO';
          reason = 'Nenhum actor tipo "page" encontrado com company_id = owner_id';
        } else if (actorIds.length === 1) {
          status = 'OK';
          reason = 'Actor encontrado';
        } else {
          status = 'AMBÍGUO';
          reason = `Múltiplos actors encontrados: ${actorIds.length}`;
        }
    } else if (account.owner_type === 'platform_ops') {
      // Contas platform_ops não requerem actor (são do sistema)
      status = 'OK';
      reason = 'Conta platform_ops (não requer actor)';
      actorIds = [];
    } else if (account.owner_type === 'group') {
      // Buscar actor tipo 'group' com group_id = owner_id (defensivo)
      const actorsResult = await runQueriesWithTenant<ActorRow>(
        tenantId,
        `SELECT actor_id FROM actors 
         WHERE tenant_id = $1 
           AND actor_type = 'group' 
           AND group_id = $2`,
        [tenantId, account.owner_id]
      );
      actorIds = (actorsResult && Array.isArray(actorsResult))
        ? actorsResult.map(r => r.actor_id)
        : [];
      
      if (actorIds.length === 0) {
        status = 'BLOQUEIO';
        reason = 'Nenhum actor tipo "group" encontrado com group_id = owner_id';
      } else if (actorIds.length === 1) {
        status = 'OK';
        reason = 'Actor encontrado';
      } else {
        status = 'AMBÍGUO';
        reason = `Múltiplos actors encontrados: ${actorIds.length}`;
      }
    } else {
      status = 'BLOQUEIO';
      reason = `owner_type desconhecido: ${account.owner_type}`;
    }

    details.push({
      account_id: account.account_id,
      owner_id: account.owner_id,
      owner_type: account.owner_type,
      status,
      actor_ids: actorIds,
      reason,
    });

    if (status === 'OK') ok++;
    else if (status === 'BLOQUEIO') blocked++;
    else if (status === 'AMBÍGUO') ambiguous++;
  }

  return { ok, blocked, ambiguous, details };
}

async function auditSystemAccounts(tenantId: string): Promise<AuditResult['systemAccounts']> {
  // Buscar todas as contas de sistema (defensivo)
  // Nota: accounts não tem owner_type='system', usa 'platform_ops' para contas do sistema
  const systemAccountsResult = await runQueriesWithTenant<AccountRow>(
    tenantId,
    `SELECT * FROM accounts 
     WHERE tenant_id = $1 AND owner_type = 'platform_ops'`,
    [tenantId]
  );

  const fee: string[] = [];
  const regional_fund: string[] = [];
  const reserve: string[] = [];
  const escrow: string[] = [];
  const other: string[] = [];
  const withoutActor: AuditResult['systemAccounts']['withoutActor'] = [];

  // Se não houver contas de sistema, retornar zeros
  if (!systemAccountsResult || !Array.isArray(systemAccountsResult) || systemAccountsResult.length === 0) {
    console.warn('⚠️  Nenhuma conta de sistema encontrada');
    return {
      fee: 0,
      regional_fund: 0,
      reserve: 0,
      escrow: 0,
      other: 0,
      withoutActor: [],
    };
  }

  for (const account of systemAccountsResult) {
    // accounts não tem metadata, então classificamos por owner_id ou assumimos 'other'
    // Para contas platform_ops, owner_id geralmente é o tenant_id

    // Como accounts não tem metadata.account_name, classificamos todas como 'other'
    // ou podemos inferir pelo owner_id (se houver padrão)
    // Por enquanto, todas platform_ops vão para 'other'
    other.push(account.account_id);

    // Contas platform_ops não têm actor (são do sistema)
    withoutActor.push({
      account_id: account.account_id,
      owner_id: account.owner_id,
      metadata: null, // accounts não tem metadata
    });
  }

  return {
    fee: fee.length,
    regional_fund: regional_fund.length,
    reserve: reserve.length,
    escrow: escrow.length,
    other: other.length,
    withoutActor,
  };
}

async function auditEscrows(tenantId: string): Promise<AuditResult['escrows']> {
  // Total de escrows (defensivo)
  const totalResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    'SELECT COUNT(*) as count FROM escrow_accounts WHERE tenant_id = $1',
    [tenantId]
  );
  const total = totalResult ? parseInt(totalResult.count ?? '0', 10) : 0;

  // Escrows com account (verificar via agreement → provider/requester → accounts)
  // Por enquanto, assumimos que todos são inferidos (não há FK direta)
  const inferredOwnership: AuditResult['escrows']['inferredOwnership'] = [];
  
  // Se não houver escrows, retornar vazio
  if (total === 0) {
    return {
      total: 0,
      withBankAccount: 0,
      withoutBankAccount: 0,
      inferredOwnership: [],
    };
  }

  const escrowsResult = await runQueriesWithTenant<EscrowAccountRow>(
    tenantId,
    'SELECT escrow_id, agreement_id, service_order_id, bundle_id FROM escrow_accounts WHERE tenant_id = $1',
    [tenantId]
  );

  if (escrowsResult && Array.isArray(escrowsResult)) {
    for (const escrow of escrowsResult) {
      inferredOwnership.push({
        escrow_id: escrow.escrow_id,
        agreement_id: escrow.agreement_id,
        reason: 'Ownership inferido via agreement_id → agreements → providerActorId/requesterActorId',
      });
    }
  }

  return {
    total,
    withBankAccount: 0, // Não há FK direta, então assumimos 0
    withoutBankAccount: total,
    inferredOwnership,
  };
}

async function auditGroupBalance(tenantId: string): Promise<AuditResult['groupBalance']> {
  // Total de group_balance (defensivo)
  const totalResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    'SELECT COUNT(*) as count FROM group_balance WHERE tenant_id = $1',
    [tenantId]
  );
  const total = totalResult ? parseInt(totalResult.count ?? '0', 10) : 0;

  // Verificar se group_balance passa pelo ledger canônico
  // Por enquanto, assumimos que não passa (é read-model)
  // TODO: Verificar se há transações no ledger relacionadas a groups

  let classification: 'READ-MODEL' | 'VIOLAÇÃO DE CORE' | 'INDETERMINADO' = 'INDETERMINADO';
  let reason = '';

  // Verificar se há entries no ledger com account_id relacionado a groups (defensivo)
  // Nota: Usando tabela canônica ledger que referencia accounts
  const ledgerCheckResult = await runQueryWithTenant<{ count: string }>(
    tenantId,
    `SELECT COUNT(*) as count 
     FROM ledger le
     JOIN accounts a ON le.account_id = a.account_id
     WHERE a.tenant_id = $1 
       AND a.owner_type = 'group'`,
    [tenantId]
  );
  const ledgerCount = ledgerCheckResult ? parseInt(ledgerCheckResult.count ?? '0', 10) : 0;

  if (total === 0) {
    classification = 'READ-MODEL';
    reason = 'Nenhum group_balance encontrado. Se existir, é read-model calculado de group_transactions.';
  } else if (ledgerCount === 0) {
    // Não há entries no ledger para groups
    classification = 'READ-MODEL';
    reason = 'group_balance não passa pelo ledger. É read-model calculado de group_transactions.';
  } else {
    // Há entries no ledger para groups
    classification = 'INDETERMINADO';
    reason = `Encontradas ${ledgerCount} entries no ledger relacionadas a groups. Verificar se group_balance é read-model ou violação.`;
  }

  return {
    total,
    classification,
    reason,
  };
}

async function generateReport(result: AuditResult, tenantId: string): Promise<string> {
  const lines: string[] = [];

  lines.push('# FASE 1 — AUDITORIA DE OWNERSHIP FINANCEIRO');
  lines.push('');
  lines.push(`**Data:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Tenant ID:** ${tenantId}`);
  lines.push(`**Tipo:** AUDITORIA (SOMENTE LEITURA)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. AUDITORIA DE ACCOUNTS
  lines.push('## 1. AUDITORIA DE ACCOUNTS');
  lines.push('');
  lines.push(`**Total de contas:** ${result.accounts.total}`);
  lines.push('');

  lines.push('### 1.1 Contas por owner_type');
  lines.push('');
  lines.push('| owner_type | Quantidade |');
  lines.push('|------------|------------|');
  if (Object.keys(result.accounts.byOwnerType).length === 0) {
    lines.push('| *Nenhuma conta encontrada* | 0 |');
  } else {
    for (const [type, count] of Object.entries(result.accounts.byOwnerType)) {
      lines.push(`| ${type} | ${count} |`);
    }
  }
  lines.push('');

  lines.push('### 1.2 Contas por currency');
  lines.push('');
  lines.push('| currency | Quantidade |');
  lines.push('|----------|------------|');
  if (Object.keys(result.accounts.byCurrency).length === 0) {
    lines.push('| *Nenhuma conta encontrada* | 0 |');
  } else {
    for (const [currency, count] of Object.entries(result.accounts.byCurrency)) {
      lines.push(`| ${currency} | ${count} |`);
    }
  }
  lines.push('');

  lines.push('### 1.3 Contas duplicadas');
  lines.push('');
  if (result.accounts.duplicates.length === 0) {
    lines.push('✅ **Nenhuma duplicata encontrada**');
  } else {
    lines.push('❌ **Duplicatas encontradas:**');
    lines.push('');
    lines.push('| tenant_id | owner_id | owner_type | currency | count |');
    lines.push('|-----------|----------|------------|----------|-------|');
    for (const dup of result.accounts.duplicates) {
      lines.push(`| ${dup.tenant_id} | ${dup.owner_id} | ${dup.owner_type} | ${dup.currency} | ${dup.count} |`);
    }
  }
  lines.push('');

  lines.push('### 1.4 Contas com owner_id NULL');
  lines.push('');
  if (result.accounts.nullOwners === 0) {
    lines.push('✅ **Nenhuma conta com owner_id NULL**');
  } else {
    lines.push(`❌ **${result.accounts.nullOwners} conta(s) com owner_id NULL**`);
  }
  lines.push('');

  // 2. MAPEAMENTO OWNER → ACTOR
  lines.push('## 2. MAPEAMENTO OWNER → ACTOR');
  lines.push('');
  lines.push(`**OK:** ${result.ownerToActor.ok}`);
  lines.push(`**BLOQUEIO:** ${result.ownerToActor.blocked}`);
  lines.push(`**AMBÍGUO:** ${result.ownerToActor.ambiguous}`);
  lines.push('');

  const blockedAccounts = result.ownerToActor.details.filter(d => d.status === 'BLOQUEIO');
  if (blockedAccounts.length > 0) {
    lines.push('### 2.1 Contas SEM Actor correspondente (BLOQUEIO)');
    lines.push('');
    lines.push('| account_id | owner_id | owner_type | reason |');
    lines.push('|------------|----------|------------|--------|');
    for (const acc of blockedAccounts) {
      lines.push(`| ${acc.account_id} | ${acc.owner_id} | ${acc.owner_type} | ${acc.reason} |`);
    }
    lines.push('');
  }

  const ambiguousAccounts = result.ownerToActor.details.filter(d => d.status === 'AMBÍGUO');
  if (ambiguousAccounts.length > 0) {
    lines.push('### 2.2 Contas com múltiplos Actors possíveis (AMBÍGUO)');
    lines.push('');
    lines.push('| account_id | owner_id | owner_type | actor_ids | reason |');
    lines.push('|------------|----------|------------|-----------|--------|');
    for (const acc of ambiguousAccounts) {
      lines.push(`| ${acc.account_id} | ${acc.owner_id} | ${acc.owner_type} | ${acc.actor_ids.join(', ')} | ${acc.reason} |`);
    }
    lines.push('');
  }

  // 3. AUDITORIA DE CONTAS DE SISTEMA
  lines.push('## 3. AUDITORIA DE CONTAS DE SISTEMA (FUNDOS)');
  lines.push('');
  lines.push('| Tipo | Quantidade |');
  lines.push('|------|------------|');
  lines.push(`| fee | ${result.systemAccounts.fee} |`);
  lines.push(`| regional_fund | ${result.systemAccounts.regional_fund} |`);
  lines.push(`| reserve | ${result.systemAccounts.reserve} |`);
  lines.push(`| escrow | ${result.systemAccounts.escrow} |`);
  lines.push(`| outro | ${result.systemAccounts.other} |`);
  lines.push('');

  if (result.systemAccounts.withoutActor.length > 0) {
    lines.push('### 3.1 Contas de sistema SEM Actor de sistema');
    lines.push('');
    lines.push('| account_id | owner_id | metadata |');
    lines.push('|------------|----------|---------|');
    for (const acc of result.systemAccounts.withoutActor) {
      lines.push(`| ${acc.account_id} | ${acc.owner_id} | ${JSON.stringify(acc.metadata)} |`);
    }
    lines.push('');
  }

  // 4. AUDITORIA DE ESCROWS
  lines.push('## 4. AUDITORIA DE ESCROWS');
  lines.push('');
  lines.push(`**Total de escrows:** ${result.escrows.total}`);
  lines.push(`**Com bank_account:** ${result.escrows.withBankAccount}`);
  lines.push(`**Sem bank_account:** ${result.escrows.withoutBankAccount}`);
  lines.push('');

  if (result.escrows.inferredOwnership.length > 0) {
    lines.push('### 4.1 Escrows com ownership inferido');
    lines.push('');
    lines.push('| escrow_id | agreement_id | reason |');
    lines.push('|-----------|--------------|--------|');
    for (const escrow of result.escrows.inferredOwnership) {
      lines.push(`| ${escrow.escrow_id} | ${escrow.agreement_id} | ${escrow.reason} |`);
    }
    lines.push('');
  }

  // 5. AUDITORIA DE GROUP_BALANCE
  lines.push('## 5. AUDITORIA DE GROUP_BALANCE');
  lines.push('');
  lines.push(`**Total de group_balance:** ${result.groupBalance.total}`);
  lines.push(`**Classificação:** ${result.groupBalance.classification}`);
  lines.push(`**Razão:** ${result.groupBalance.reason}`);
  lines.push('');

  // 6. RELATÓRIO FINAL
  lines.push('## 6. RELATÓRIO FINAL');
  lines.push('');

  const canProceed = 
    result.accounts.duplicates.length === 0 &&
    result.accounts.nullOwners === 0 &&
    result.ownerToActor.blocked === 0 &&
    result.ownerToActor.ambiguous === 0 &&
    result.escrows.inferredOwnership.length === 0;

  lines.push(`### 6.1 FASE 2 PODE PROSSEGUIR?`);
  lines.push('');
  if (canProceed) {
    lines.push('✅ **SIM**');
  } else {
    lines.push('❌ **NÃO**');
  }
  lines.push('');

  if (!canProceed) {
    lines.push('### 6.2 BLOQUEIOS para FASE 2');
    lines.push('');
    
    if (result.accounts.duplicates.length > 0) {
      lines.push(`- **${result.accounts.duplicates.length} conta(s) duplicada(s)** (viola UNIQUE constraint)`);
    }
    if (result.accounts.nullOwners > 0) {
      lines.push(`- **${result.accounts.nullOwners} conta(s) com owner_id NULL** (viola NOT NULL constraint)`);
    }
    if (result.ownerToActor.blocked > 0) {
      lines.push(`- **${result.ownerToActor.blocked} conta(s) SEM Actor correspondente**`);
    }
    if (result.ownerToActor.ambiguous > 0) {
      lines.push(`- **${result.ownerToActor.ambiguous} conta(s) com múltiplos Actors possíveis**`);
    }
    if (result.escrows.inferredOwnership.length > 0) {
      lines.push(`- **${result.escrows.inferredOwnership.length} escrow(s) com ownership inferido**`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**FIM DO RELATÓRIO**');

  return lines.join('\n');
}

async function main() {
  const tenantId = process.env.TENANT_ID || process.argv[2];
  
  if (!tenantId) {
    console.error('❌ Erro: TENANT_ID não fornecido');
    console.error('Uso: TENANT_ID=<uuid> ts-node audit-ownership-financial-phase1.ts');
    console.error('   ou: ts-node audit-ownership-financial-phase1.ts <tenant_id>');
    process.exit(1);
  }

  console.log(`🔍 Iniciando auditoria para tenant: ${tenantId}`);
  console.log('');

  try {
    // 1. Auditoria de accounts
    console.log('📊 1. Auditoria de accounts...');
    const accounts = await auditAccounts(tenantId);
    console.log(`   ✅ Total: ${accounts.total} contas`);

    // 2. Mapeamento owner → actor
    console.log('🔗 2. Mapeamento owner → actor...');
    const ownerToActor = await mapOwnerToActor(tenantId);
    console.log(`   ✅ OK: ${ownerToActor.ok}, BLOQUEIO: ${ownerToActor.blocked}, AMBÍGUO: ${ownerToActor.ambiguous}`);

    // 3. Auditoria de contas de sistema
    console.log('💰 3. Auditoria de contas de sistema...');
    const systemAccounts = await auditSystemAccounts(tenantId);
    console.log(`   ✅ Fee: ${systemAccounts.fee}, Regional: ${systemAccounts.regional_fund}, Reserve: ${systemAccounts.reserve}, Escrow: ${systemAccounts.escrow}, Outro: ${systemAccounts.other}`);

    // 4. Auditoria de escrows
    console.log('🔒 4. Auditoria de escrows...');
    const escrows = await auditEscrows(tenantId);
    console.log(`   ✅ Total: ${escrows.total}, Inferidos: ${escrows.inferredOwnership.length}`);

    // 5. Auditoria de group_balance
    console.log('👥 5. Auditoria de group_balance...');
    const groupBalance = await auditGroupBalance(tenantId);
    console.log(`   ✅ Total: ${groupBalance.total}, Classificação: ${groupBalance.classification}`);

    // Gerar relatório
    console.log('');
    console.log('📝 Gerando relatório...');
    const result: AuditResult = {
      accounts,
      ownerToActor,
      systemAccounts,
      escrows,
      groupBalance,
    };

    const report = await generateReport(result, tenantId);
    
    // Salvar relatório
    const reportPath = path.join(__dirname, `../audit-reports/ownership-financial-phase1-${tenantId}-${Date.now()}.md`);
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, report, 'utf8');
    
    console.log(`✅ Relatório salvo em: ${reportPath}`);
    console.log('');
    console.log(report);

  } catch (error: any) {
    console.error('❌ Erro durante auditoria:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    // Em caso de erro, tentar gerar relatório parcial se possível
    console.error('⚠️  Auditoria interrompida. Verifique os logs acima.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


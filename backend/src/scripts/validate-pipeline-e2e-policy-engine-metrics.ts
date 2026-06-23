/**
 * E2E PE-4-METRICS (2026-05-26) — Métricas sociais REAIS de destinos econômicos
 *
 * Cobre:
 *   T1 — fundo sem contribuições → métricas zeradas, sem throw
 *   T2 — 1 actor contribui 5x → 1 PF count (não 5)
 *   T3 — 2 actors do MESMO CPF contribuem → 1 PF count (dedupe por global_user_id)
 *   T4 — 1 actor PF + 1 actor PJ → PF e PJ separados
 *   T5 — actor SEM KYC contribui → conta em unverifiedContributors30d, não em PF/PJ
 *   T6 — contribuição há 31 dias não aparece em ativos 30d
 *   T7 — saldo bate com bankAccountService.getBalance
 *   T8 — payload NÃO contém tax_id / cpf / cnpj
 *   T9 — payload PÚBLICO NÃO contém actor_count (só método Internal)
 *
 * Setup: cria 1 regional_fund local + N actors com tax_ids distintos, contribui
 * via bank_splits diretamente (escrita controlada sob authorship system,
 * SEM passar por PE-3 — esse caminho seria invasivo). Dedupe é testada na
 * leitura, que é o ponto material.
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-policy-engine-metrics.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { economicMetricsService } from '../modules/economy/metrics/economic-metrics.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

type CheckResult = { ok: boolean; reason?: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (r.ok === false) {
    console.error(`  ❌ FALHOU: ${label}`);
    if (r.reason) console.error(`     Motivo: ${r.reason}`);
    if (r.detail !== undefined) console.error(JSON.stringify(r.detail, null, 2));
    process.exit(1);
  }
  console.log(`  ✅ ${label}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

/**
 * Cria identidade + actor de teste. Retorna ids.
 *
 * kycStatus controla se será dedupado como PF/PJ verificado ou cair em
 * unverified. taxIdType='cpf'/'cnpj'/null (null = actor sem identity).
 */
async function createTestActor(opts: {
  taxId?: string; // 11 dígitos CPF ou 14 CNPJ; omitir = sem identity (unverified)
  taxIdType?: 'cpf' | 'cnpj';
  kycStatus?: 'pending' | 'approved' | 'rejected';
  displayName: string;
}): Promise<{ actorId: string; globalUserId: string | null }> {
  let globalUserId: string | null = null;
  if (opts.taxId && opts.taxIdType) {
    // Tenta criar identity (idempotente por tax_id)
    const existing = await pool.query<{ global_user_id: string }>(
      `SELECT global_user_id::text FROM identities WHERE tax_id = $1 LIMIT 1`,
      [opts.taxId]
    );
    if (existing.rows[0]) {
      globalUserId = existing.rows[0].global_user_id;
    } else {
      // global_users primeiro (FK identities futura/genérica via global_users.cpf)
      globalUserId = uuidv4();
      await pool.query(
        `INSERT INTO global_users (global_user_id, cpf, full_name)
         VALUES ($1::uuid, $2, $3) ON CONFLICT (cpf) DO NOTHING`,
        [globalUserId, opts.taxId, opts.displayName]
      );
      // Pode ter colidido CPF de outro global_user — re-fetch
      const r2 = await pool.query<{ global_user_id: string }>(
        `SELECT global_user_id::text FROM global_users WHERE cpf = $1 LIMIT 1`,
        [opts.taxId]
      );
      globalUserId = r2.rows[0]!.global_user_id;
      // identities
      await pool.query(
        `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
         VALUES ($1::uuid, $2, $3, $4, 'basic')
         ON CONFLICT (global_user_id) DO NOTHING`,
        [globalUserId, opts.taxId, opts.taxIdType, opts.kycStatus ?? 'approved']
      );
    }
  }

  // actor
  const actorId = uuidv4();
  await pool.query(
    `INSERT INTO actors (id, tenant_id, actor_type, display_name, global_user_id)
     VALUES ($1::uuid, $2::uuid, 'user', $3, $4::uuid)`,
    [actorId, TENANT_ID, opts.displayName, globalUserId]
  );
  return { actorId, globalUserId };
}

/**
 * Cria conta Bank para o actor (origem do split) — escrow source.
 * Usa actor_wallet via ensureActorWalletAccount.
 */
async function ensureActorWallet(actorId: string): Promise<string> {
  const wallet = await bankAccountService.ensureActorWalletAccount(TENANT_ID, actorId, 'BRL');
  return wallet.accountId;
}

/**
 * Escreve contribuição DIRETO em bank_transactions + bank_splits + bank_ledger
 * via SQL controlado. Atalho EXCLUSIVO para E2E PE-4-METRICS (testa LEITURA das
 * métricas, não o caminho real de movimentação financeira — esse é provado em
 * E2E PE-3). Não usa transfer/createTransactionWithExplicitSplitLines porque
 * exigem saldo prévio no from (clearing/wallet) que esses fixtures sintéticos
 * não têm. Authorship='system'.
 *
 * Importante: este script NÃO valida invariantes do Bank (double-entry, lock,
 * etc.) — só insere o suficiente para que a query de métricas tenha o que ler.
 */
async function insertContributionDirect(opts: {
  sourceActorId: string;
  sourceAccountId: string;
  targetAccountId: string;
  amountCents: number;
  createdAt?: Date; // padrão NOW()
}): Promise<void> {
  const createdAt = (opts.createdAt ?? new Date()).toISOString();
  // 1 bank_transaction
  const txId = uuidv4();
  await pool.query(
    `INSERT INTO bank_transactions (
       id, tenant_id, actor_id, account_id, amount_cents, purpose,
       justification, reference_type, reference_id, concept_id,
       internal_completed_at, created_at
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution',
       'E2E PE-4-METRICS direct contribution', 'pe4_metrics_e2e_contribution',
       $6, (SELECT concept_id FROM concepts WHERE slug='ride-payment' LIMIT 1),
       $7::timestamptz, $7::timestamptz
     )`,
    [txId, TENANT_ID, opts.sourceActorId, opts.sourceAccountId, opts.amountCents, uuidv4(), createdAt]
  );
  // 1 bank_split apontando para targetAccountId
  await pool.query(
    `INSERT INTO bank_splits (
       id, tenant_id, transaction_id, source_actor_id, target_account_id,
       target_actor_id, amount_cents, split_type, percentage, created_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       (SELECT actor_id FROM bank_accounts WHERE id = $4::uuid LIMIT 1),
       $5, 'revenue_share', 100, $6::timestamptz
     )`,
    [TENANT_ID, txId, opts.sourceActorId, opts.targetAccountId, opts.amountCents, createdAt]
  );
  // bank_ledger: 1 credit no target (suficiente para getBalance retornar correto).
  // Skip debit do source — não validamos double-entry aqui (escrita de teste).
  // Schema canônico: direction (não entry_type) + purpose enum + justification.
  await pool.query(
    `INSERT INTO bank_ledger (
       id, tenant_id, account_id, transaction_id, direction,
       amount_cents, purpose, justification, created_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit',
       $4, 'execution', 'E2E PE-4-METRICS direct credit', $5::timestamptz
     )`,
    [TENANT_ID, opts.targetAccountId, txId, opts.amountCents, createdAt]
  );
  void opts.sourceActorId; // não usado neste INSERT direto
}

async function createRegionalFund(country: string, state: string, city: string): Promise<string> {
  const fundId = uuidv4();
  await pool.query(
    `INSERT INTO regional_funds (id, tenant_id, country, state, city)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5)
     ON CONFLICT (tenant_id, country, state, city) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [fundId, TENANT_ID, country, state, city]
  );
  // Caso conflito tenha retornado outro id, lookup
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM regional_funds WHERE tenant_id = $1::uuid
       AND country = $2 AND state = $3 AND city = $4 LIMIT 1`,
    [TENANT_ID, country, state, city]
  );
  return r.rows[0]!.id;
}

async function cleanupTestData(prefix: string): Promise<void> {
  // 🔴 SPLIT-01: bank_splits agora é APPEND-ONLY por trigger institucional
  // (prevent_bank_splits_modification), em simetria com bank_ledger
  // (prevent_bank_ledger_modification) e bank_transactions (FK do ledger).
  // NÃO deletar bank_splits — a trava física rejeita UPDATE/DELETE. As rows de
  // teste ficam como rastro inerte no DB dev (não vazam para produção;
  // reference_type 'pe4_metrics_e2e_*' nunca aparece em consulta legítima).
  void prefix;
}

async function main() {
  console.log('═══ E2E PE-4-METRICS — Métricas sociais reais ═══\n');
  await bootstrap();
  await cleanupTestData('e2e');

  // ============================================================
  // T1 — fundo sem contribuições → métricas zeradas
  // ============================================================
  console.log('=== T1 — fundo sem contribuições → métricas zeradas ===');
  const fund1 = await createRegionalFund('BR', 'PR', `T1-${uuidv4().slice(0, 8)}`);
  const m1 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund1);
  assertOk('T1.1 — balanceCents = 0 (ledger vazio)', {
    ok: m1.balanceCents === 0,
    reason: `esperava 0; recebi ${m1.balanceCents}`,
  });
  assertOk('T1.2 — todos os contadores = 0', {
    ok:
      m1.pfVerifiedParticipants === 0 &&
      m1.pjVerifiedParticipants === 0 &&
      m1.pfActiveContributors30d === 0 &&
      m1.pjActiveContributors30d === 0 &&
      m1.unverifiedContributors30d === 0 &&
      m1.contributionVolume30dCents === 0 &&
      m1.lastContributionAt === null,
    reason: 'contadores não zerados',
    detail: m1,
  });

  // ============================================================
  // T2 — 1 actor contribui 5x → 1 PF count (não 5)
  // ============================================================
  console.log('\n=== T2 — 1 actor contribui 5x → 1 PF count ===');
  const fund2 = await createRegionalFund('BR', 'PR', `T2-${uuidv4().slice(0, 8)}`);
  const fund2Acc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: 'BR', state: 'PR', city: `T2-fund` },
    'BRL'
  );
  // Lookup real do account do fund2 via row
  const fund2Row = await pool.query<{ country: string; state: string; city: string }>(
    `SELECT country, state, city FROM regional_funds WHERE id = $1::uuid`,
    [fund2]
  );
  const fund2RealAcc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: fund2Row.rows[0]!.country, state: fund2Row.rows[0]!.state, city: fund2Row.rows[0]!.city },
    'BRL'
  );
  void fund2Acc;
  const actorT2 = await createTestActor({
    taxId: '11122233344',
    taxIdType: 'cpf',
    kycStatus: 'approved',
    displayName: 'T2 actor PF',
  });
  const walletT2 = await ensureActorWallet(actorT2.actorId);
  for (let i = 0; i < 5; i++) {
    await insertContributionDirect({
      sourceActorId: actorT2.actorId,
      sourceAccountId: walletT2,
      targetAccountId: fund2RealAcc.accountId,
      amountCents: 1000,
    });
  }
  const m2 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund2);
  assertOk('T2.1 — pfVerifiedParticipants = 1 (não 5)', {
    ok: m2.pfVerifiedParticipants === 1,
    reason: `esperava 1; recebi ${m2.pfVerifiedParticipants}`,
    detail: m2,
  });
  assertOk('T2.2 — pfActiveContributors30d = 1', {
    ok: m2.pfActiveContributors30d === 1,
    reason: `esperava 1`,
    detail: m2,
  });
  assertOk('T2.3 — contributionVolume30dCents = 5000 (5 × 1000)', {
    ok: m2.contributionVolume30dCents === 5000,
    reason: `esperava 5000`,
    detail: m2,
  });

  // ============================================================
  // T3 — 2 actors do MESMO CPF → 1 PF count (dedupe via global_user_id)
  // ============================================================
  console.log('\n=== T3 — 2 actors do MESMO CPF → 1 PF count ===');
  const fund3 = await createRegionalFund('BR', 'PR', `T3-${uuidv4().slice(0, 8)}`);
  const fund3Row = await pool.query<{ country: string; state: string; city: string }>(
    `SELECT country, state, city FROM regional_funds WHERE id = $1::uuid`,
    [fund3]
  );
  const fund3Acc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: fund3Row.rows[0]!.country, state: fund3Row.rows[0]!.state, city: fund3Row.rows[0]!.city },
    'BRL'
  );
  const cpfT3 = '22233344455';
  const actorT3a = await createTestActor({
    taxId: cpfT3, taxIdType: 'cpf', kycStatus: 'approved', displayName: 'T3 motorista',
  });
  const actorT3b = await createTestActor({
    taxId: cpfT3, taxIdType: 'cpf', kycStatus: 'approved', displayName: 'T3 entregador',
  });
  assertOk('T3.0 — dois actors distintos compartilham global_user_id', {
    ok: actorT3a.globalUserId === actorT3b.globalUserId && actorT3a.actorId !== actorT3b.actorId,
    reason: 'dedupe quebrou',
    detail: { actorT3a, actorT3b },
  });
  const walletT3a = await ensureActorWallet(actorT3a.actorId);
  const walletT3b = await ensureActorWallet(actorT3b.actorId);
  await insertContributionDirect({ sourceActorId: actorT3a.actorId, sourceAccountId: walletT3a, targetAccountId: fund3Acc.accountId, amountCents: 500 });
  await insertContributionDirect({ sourceActorId: actorT3b.actorId, sourceAccountId: walletT3b, targetAccountId: fund3Acc.accountId, amountCents: 500 });
  const m3 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund3);
  assertOk('T3.1 — pfVerifiedParticipants = 1 (não 2 actors)', {
    ok: m3.pfVerifiedParticipants === 1,
    reason: `esperava 1; recebi ${m3.pfVerifiedParticipants}`,
    detail: m3,
  });

  // ============================================================
  // T4 — 1 PF + 1 PJ → separados
  // ============================================================
  console.log('\n=== T4 — 1 PF + 1 PJ → separados ===');
  const fund4 = await createRegionalFund('BR', 'PR', `T4-${uuidv4().slice(0, 8)}`);
  const fund4Row = await pool.query<{ country: string; state: string; city: string }>(
    `SELECT country, state, city FROM regional_funds WHERE id = $1::uuid`,
    [fund4]
  );
  const fund4Acc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: fund4Row.rows[0]!.country, state: fund4Row.rows[0]!.state, city: fund4Row.rows[0]!.city },
    'BRL'
  );
  const actorT4PF = await createTestActor({
    taxId: '33344455566', taxIdType: 'cpf', kycStatus: 'approved', displayName: 'T4 PF',
  });
  const actorT4PJ = await createTestActor({
    taxId: '11222333000144', taxIdType: 'cnpj', kycStatus: 'approved', displayName: 'T4 PJ',
  });
  const walletT4PF = await ensureActorWallet(actorT4PF.actorId);
  const walletT4PJ = await ensureActorWallet(actorT4PJ.actorId);
  await insertContributionDirect({ sourceActorId: actorT4PF.actorId, sourceAccountId: walletT4PF, targetAccountId: fund4Acc.accountId, amountCents: 1500 });
  await insertContributionDirect({ sourceActorId: actorT4PJ.actorId, sourceAccountId: walletT4PJ, targetAccountId: fund4Acc.accountId, amountCents: 2500 });
  const m4 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund4);
  assertOk('T4.1 — pfVerifiedParticipants = 1 + pjVerifiedParticipants = 1', {
    ok: m4.pfVerifiedParticipants === 1 && m4.pjVerifiedParticipants === 1,
    reason: 'PF/PJ não separados',
    detail: m4,
  });
  assertOk('T4.2 — contributionVolume30dCents = 4000', {
    ok: m4.contributionVolume30dCents === 4000,
    reason: `esperava 4000`,
    detail: m4,
  });

  // ============================================================
  // T5 — actor SEM KYC contribui → unverified, não PF/PJ
  // ============================================================
  console.log('\n=== T5 — actor sem KYC → unverified ===');
  const fund5 = await createRegionalFund('BR', 'PR', `T5-${uuidv4().slice(0, 8)}`);
  const fund5Row = await pool.query<{ country: string; state: string; city: string }>(
    `SELECT country, state, city FROM regional_funds WHERE id = $1::uuid`,
    [fund5]
  );
  const fund5Acc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: fund5Row.rows[0]!.country, state: fund5Row.rows[0]!.state, city: fund5Row.rows[0]!.city },
    'BRL'
  );
  const actorT5 = await createTestActor({ displayName: 'T5 unverified actor' });
  const walletT5 = await ensureActorWallet(actorT5.actorId);
  await insertContributionDirect({ sourceActorId: actorT5.actorId, sourceAccountId: walletT5, targetAccountId: fund5Acc.accountId, amountCents: 700 });
  const m5 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund5);
  assertOk('T5.1 — unverifiedContributors30d = 1', {
    ok: m5.unverifiedContributors30d === 1,
    reason: `esperava 1`, detail: m5,
  });
  assertOk('T5.2 — PF/PJ verified contadores = 0', {
    ok: m5.pfVerifiedParticipants === 0 && m5.pjVerifiedParticipants === 0,
    reason: 'unverified vazou para PF/PJ',
    detail: m5,
  });

  // ============================================================
  // T6 — contribuição há 31 dias não é ativo 30d
  // ============================================================
  console.log('\n=== T6 — contribuição há 31 dias não entra em 30d ===');
  const fund6 = await createRegionalFund('BR', 'PR', `T6-${uuidv4().slice(0, 8)}`);
  const fund6Row = await pool.query<{ country: string; state: string; city: string }>(
    `SELECT country, state, city FROM regional_funds WHERE id = $1::uuid`,
    [fund6]
  );
  const fund6Acc = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: fund6Row.rows[0]!.country, state: fund6Row.rows[0]!.state, city: fund6Row.rows[0]!.city },
    'BRL'
  );
  const actorT6 = await createTestActor({
    taxId: '44455566677', taxIdType: 'cpf', kycStatus: 'approved', displayName: 'T6 PF antigo',
  });
  const walletT6 = await ensureActorWallet(actorT6.actorId);
  const days31Ago = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  await insertContributionDirect({ sourceActorId: actorT6.actorId, sourceAccountId: walletT6, targetAccountId: fund6Acc.accountId, amountCents: 800, createdAt: days31Ago });
  const m6 = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund6);
  assertOk('T6.1 — pfVerifiedParticipants = 1 (histórico)', {
    ok: m6.pfVerifiedParticipants === 1, reason: 'histórico errado', detail: m6,
  });
  assertOk('T6.2 — pfActiveContributors30d = 0 (fora da janela)', {
    ok: m6.pfActiveContributors30d === 0,
    reason: `esperava 0; recebi ${m6.pfActiveContributors30d}`,
    detail: m6,
  });
  assertOk('T6.3 — contributionVolume30dCents = 0', {
    ok: m6.contributionVolume30dCents === 0,
    reason: 'volume 30d inclui contribuição antiga',
    detail: m6,
  });

  // ============================================================
  // T7 — saldo bate com bankAccountService.getBalance
  // ============================================================
  console.log('\n=== T7 — balanceCents bate com getBalance ===');
  const directBalance = await bankAccountService.getBalance(TENANT_ID, fund4Acc.accountId);
  const m4Again = await economicMetricsService.getRegionalFundMetrics(TENANT_ID, fund4);
  assertOk('T7.1 — balanceCents == bankAccountService.getBalance', {
    ok: m4Again.balanceCents === directBalance.balanceCents,
    reason: `serviço retornou ${m4Again.balanceCents}; ledger direto = ${directBalance.balanceCents}`,
    detail: { metricsBalance: m4Again.balanceCents, ledgerBalance: directBalance.balanceCents },
  });

  // ============================================================
  // T8 — payload NÃO contém tax_id / cpf / cnpj
  // ============================================================
  console.log('\n=== T8 — payload sem tax_id/cpf/cnpj ===');
  const payload8 = JSON.stringify(m4);
  assertOk('T8.1 — payload não contém "tax_id"', {
    ok: !/tax_id/i.test(payload8), reason: 'tax_id vazou em payload', detail: payload8,
  });
  assertOk('T8.2 — payload não contém "cpf"', {
    ok: !/\bcpf\b/i.test(payload8), reason: 'cpf vazou', detail: payload8,
  });
  assertOk('T8.3 — payload não contém "cnpj"', {
    ok: !/\bcnpj\b/i.test(payload8), reason: 'cnpj vazou', detail: payload8,
  });
  // Bonus: não contém os literais que seedei
  assertOk('T8.4 — payload não contém o literal CPF seedado (33344455566)', {
    ok: !payload8.includes('33344455566'), reason: 'CPF seedado vazou',
  });
  assertOk('T8.5 — payload não contém o literal CNPJ seedado (11222333000144)', {
    ok: !payload8.includes('11222333000144'), reason: 'CNPJ seedado vazou',
  });

  // ============================================================
  // T9 — payload público NÃO contém actor_count; método Internal SIM
  // ============================================================
  console.log('\n=== T9 — actor_count só no método Internal ===');
  assertOk('T9.1 — payload público NÃO contém actorCount30d', {
    ok: !('actorCount30d' in (m4 as any)),
    reason: 'actorCount30d apareceu em payload público',
    detail: Object.keys(m4),
  });
  const m4Internal = await economicMetricsService.getRegionalFundMetricsInternal(TENANT_ID, fund4);
  assertOk('T9.2 — método Internal expõe actorCount30d (admin only)', {
    ok: 'actorCount30d' in m4Internal && m4Internal.actorCount30d === 2,
    reason: `esperava actorCount30d = 2; recebi ${m4Internal.actorCount30d}`,
    detail: m4Internal,
  });
  assertOk('T9.3 — Internal expõe uniqueGlobalUsers30d = 2 (PF+PJ)', {
    ok: m4Internal.uniqueGlobalUsers30d === 2,
    reason: `esperava 2`, detail: m4Internal,
  });

  // ============================================================
  // Cleanup
  // ============================================================
  await cleanupTestData('e2e');

  console.log(
    '\n═══ E2E PE-4-METRICS :: PASS — 9 cenários T1-T9 verdes. Dedupe por identities.global_user_id funcional, PF/PJ separados, unverified isolado, ativo=30d, saldo do ledger, CPF/CNPJ não expostos, actor_count só interno. ═══'
  );
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});

/**
 * E2E TRANSVERSAL DE KYC + circuito monetário mínimo (Frente C completa)
 *
 * Encadeia ponta a ponta:
 *   1. Cadastro PF via authService.register (Fatia C1 cria identity pending/none)
 *   2. Gate ANTES: evaluateFinancialSensitiveAction → block KYC_PENDING_BLOCKS_FINANCIAL
 *   3. Submit: submitIdentityValidation → request pending
 *   4. Review approved: reviewIdentityValidation (transacional) → request approved +
 *      identities.kyc_status='approved' + kyc_level=target (timestamps coincidem)
 *   5. Gate DEPOIS: evaluateFinancialSensitiveAction (MESMO actor) → allow KYC_OK
 *   6. (Etapa 6 — adicionada após menor-E2E recomendado pelo mapa do circuito
 *      mínimo): TRANSFER REAL no MESMO actor aprovado. Conta PF criada,
 *      saldo mintado via SYSTEM, gate chamado dentro do transfer (passa
 *      KYC_OK), entries no bank_ledger persistidos, Σ(débitos)=Σ(créditos).
 *      Encerra a cadeia: KYC_PENDING → KYC_OK → AUTHORITY_ALLOW →
 *      TRANSFER_EXECUTED → LEDGER_PERSISTED, no MESMO actor.
 *
 * A PROVA DE OURO original (passo 2 BLOCK → passo 5 ALLOW) permanece.
 *
 * ESCOPO DA ETAPA 6 (travado): transfer puro entre conta de user (origem)
 * e conta de sistema (sink temporário). NÃO toca: split engine,
 * createExecution, RFQ/quote/booking, event_outbox SERVICE_PAYMENT_EXECUTED,
 * settlement, payout. Apenas o verbo bancário mínimo (transfer + ledger).
 *
 * Simétrico a validate-pipeline-e2e-company.ts (G2 Etapa 2 — E2E de empresa).
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { authService } from '../core/auth/auth.service';
import { authorityDecisionService } from '../core/compliance/authority-decision.service';
import { identityValidationService } from '../core/identity/identity-validation.service';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankAccountRepository } from '../modules/bank/bank-account.repository';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { bankLedgerRepository } from '../modules/bank/bank-ledger.repository';
import {
  buildFinancialAuthorshipFromRequest,
  buildSystemAuthorship,
} from '../modules/bank/financial-authorship.helper';

dotenv.config({ path: join(process.cwd(), '.env') });

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9): este E2E chama bankTransactionService.transfer
// DIRETO (testa o sink, não um caller com firewall próprio) — precisa ligar o novo gate default-off
// pra continuar exercitando o fluxo real que este arquivo sempre testou.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const ADMIN_USER_ID = process.env.E2E_ADMIN_USER_ID || 'beb7b5e4-2d22-4782-83c9-6e006da53713';

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

async function expectFail(
  label: string,
  fn: () => Promise<unknown>,
  expected?: RegExp,
): Promise<void> {
  try {
    await fn();
    console.error(`  ❌ SISTEMA ACEITOU VIOLACAO: ${label}`);
    process.exit(1);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (expected && !expected.test(msg)) {
      console.error(`  ❌ Rejeitou mas com mensagem inesperada [${label}]:`);
      console.error(`     Esperado match: ${expected}`);
      console.error(`     Recebido:        ${msg}`);
      process.exit(1);
    }
    console.log(`  ✅ Rejeitou corretamente [${label}]: ${msg}`);
  }
}

function generateValidCpf(seed: number): string {
  const base = String(seed).padStart(9, '0').slice(-9);
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += parseInt(base[i]!, 10) * (10 - i);
  let dv1 = 11 - (s1 % 11);
  if (dv1 >= 10) dv1 = 0;
  const ten = base + dv1;
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += parseInt(ten[i]!, 10) * (11 - i);
  let dv2 = 11 - (s2 % 11);
  if (dv2 >= 10) dv2 = 0;
  return ten + dv2;
}

const RUN_TAG = Date.now();
const E2E_EMAIL_1 = `e2e-kyc-${RUN_TAG}@e2e.internal`;
const E2E_EMAIL_2 = `e2e-kyc-${RUN_TAG}-b@e2e.internal`;
const E2E_PASSWORD = 'E2eKycTest!2026';
const E2E_CPF_1 = generateValidCpf(RUN_TAG % 1_000_000_000);
const E2E_CPF_2 = generateValidCpf((RUN_TAG + 13_579) % 1_000_000_000);

type CleanupState = {
  userIds: string[];
  globalUserIds: string[];
  /** IDs de bank_transactions criadas pela Etapa 6 (seed + transfer real). */
  bankTransactionIds: string[];
  /** IDs de bank_accounts criadas (ou reusadas) — pf account, sink temporário. */
  bankAccountIds: string[];
};

/**
 * resolveConceptUuid — copiado verbatim do validate-pipeline-e2e-transversal.ts
 * (concept_id é FK obrigatória em bank_transactions; resolvido por slug+domain
 * via concepts table).
 */
async function resolveConceptUuid(slug: string, domain: string): Promise<string> {
  const row = await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
    [domain, slug],
  );
  if (!row.rows[0]) throw new Error(`CONCEPT_NOT_FOUND: slug='${slug}' domain='${domain}'`);
  return row.rows[0].concept_id;
}

async function cleanup(state: CleanupState): Promise<void> {
  console.log('\n=== Limpeza ===');
  const { userIds, globalUserIds, bankTransactionIds, bankAccountIds } = state;
  // (A) BANK LEFTOVER ESPERADO E DOCUMENTADO:
  //     bank_ledger é APPEND-ONLY por design (triggers bank_ledger_no_delete +
  //     bank_ledger_no_update). bank_transactions e bank_accounts ficam órfãs
  //     porque o ledger as referencia (FK). Não há "delete" institucionalmente
  //     permitido para fixtures financeiras — característica imutável do SSOT
  //     monetário. Cleanup desta fatia NÃO tenta DELETE em bank_ledger /
  //     bank_transactions / bank_accounts; aceita leftover consistente com o
  //     E2E financeiro existente (validate-pipeline-e2e-transversal.ts) que
  //     também não limpa fixtures financeiras.
  if (bankAccountIds.length > 0 || bankTransactionIds.length > 0) {
    console.log(
      `  ℹ  bank leftover esperado (append-only): ` +
        `bank_accounts=${bankAccountIds.length}, bank_transactions=${bankTransactionIds.length}, ` +
        `ledger entries persistem.`,
    );
  }

  // (B) Frente C cleanup — DELETE individuais com try/catch por instrução
  //     (FK do bank impede cleanup do actor PF; identity-side e users-side
  //     podem ser limpos). Os erros são reportados mas não interrompem o
  //     restante das limpezas.
  const tryDelete = async (label: string, sql: string, params: unknown[]) => {
    try {
      const res = await pool.query(sql, params);
      console.log(`  ✓ ${label} (${res.rowCount ?? 0})`);
    } catch (e) {
      console.warn(`  ⚠  ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (globalUserIds.length > 0) {
    await tryDelete(
      'identity_validation_requests',
      `DELETE FROM identity_validation_requests WHERE global_user_id = ANY($1::uuid[])`,
      [globalUserIds],
    );
  }
  if (userIds.length > 0) {
    // actors do PF têm bank_account (FK bank_accounts.actor_id) — DELETE pode
    // falhar; relatamos e seguimos.
    await tryDelete(
      'actors (PF) — pode falhar se bank_account referencia',
      `DELETE FROM actors WHERE tenant_id = $1::uuid AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
      [TENANT_ID, userIds],
    );
    await tryDelete(
      'user_profiles',
      `DELETE FROM user_profiles WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
    await tryDelete(
      'profiles',
      `DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
    await tryDelete('users', `DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
  }
  if (globalUserIds.length > 0) {
    await tryDelete(
      'identities',
      `DELETE FROM identities WHERE global_user_id = ANY($1::uuid[])`,
      [globalUserIds],
    );
    await tryDelete(
      'global_users',
      `DELETE FROM global_users WHERE global_user_id = ANY($1::uuid[])`,
      [globalUserIds],
    );
  }
}

async function main(): Promise<void> {
  console.log('\n═══ E2E TRANSVERSAL DE KYC — 3 CAMADAS CONECTADAS ═══');
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Admin:    ${ADMIN_USER_ID}`);
  console.log(`Run tag:  ${RUN_TAG}`);
  console.log(`Email 1:  ${E2E_EMAIL_1}  CPF: ${E2E_CPF_1}`);
  console.log(`Email 2:  ${E2E_EMAIL_2}  CPF: ${E2E_CPF_2}\n`);

  // Bootstrap DI (mesmo padrão dos demais E2E).
  {
    const { socialPortsRegistry } = await import('../core/social/ports-registry');
    const {
      actorRepositoryAdapter,
      actorUtilsAdapter,
      socialRepositoryAdapter,
      socialServiceAdapter,
      eventFeedHandlersAdapter,
    } = await import('../modules/social/adapters');
    socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
    socialPortsRegistry.setActorUtils(actorUtilsAdapter);
    socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
    socialPortsRegistry.setSocialService(socialServiceAdapter);
    socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
  }

  const cleanupState: CleanupState = {
    userIds: [],
    globalUserIds: [],
    bankTransactionIds: [],
    bankAccountIds: [],
  };

  try {
    console.log('=== Modo A — Fluxo causal (3 camadas conectadas) ===');

    // ============================================================
    // ETAPA 1 — Cadastro PF (Fatia C1 cria identity pending/none)
    // ============================================================
    console.log('--- Etapa 1: Cadastro PF (authService.register; C1 cria identity pending/none) ---');
    const reg = await authService.register(
      TENANT_ID,
      E2E_EMAIL_1,
      E2E_PASSWORD,
      E2E_CPF_1,
      `E2E KYC Test ${RUN_TAG}`,
      undefined,
      undefined,
      undefined,
    );
    const userId = reg.user.userId;
    cleanupState.userIds.push(userId);

    // SELECT 1a: global_users + users + actors + identities (cadeia completa).
    const chain = await pool.query<{
      global_user_id: string;
      actor_id: string;
      kyc_status: string;
      kyc_level: string;
    }>(
      `SELECT u.global_user_id::text AS global_user_id,
              a.actor_id::text       AS actor_id,
              i.kyc_status, i.kyc_level
         FROM users u
         JOIN actors a ON a.user_id = u.id AND a.tenant_id = u.tenant_id AND a.actor_type = 'user'
         JOIN identities i ON i.global_user_id = u.global_user_id
        WHERE u.id = $1::uuid`,
      [userId],
    );
    assertOk(
      'A1: cadeia completa (global_user + actor PF + identity) criada pelo register; identity pending/none (Fatia C1)',
      {
        ok:
          !!chain.rows[0] &&
          chain.rows[0].kyc_status === 'pending' &&
          chain.rows[0].kyc_level === 'none',
        reason: 'cadeia incompleta ou identity em estado inesperado',
        detail: chain.rows[0],
      },
    );
    const globalUserId = chain.rows[0]!.global_user_id;
    const actorId = chain.rows[0]!.actor_id;
    cleanupState.globalUserIds.push(globalUserId);

    // ============================================================
    // ETAPA 2 — Gate ANTES (linha de base: deve bloquear)
    // ============================================================
    console.log('--- Etapa 2: Gate ANTES (identity pending — esperado BLOCK KYC_PENDING) ---');
    const gateBefore = await authorityDecisionService.evaluateFinancialSensitiveAction(TENANT_ID, {
      actorId,
      action: 'financial_transfer',
      amountCents: 100,
    });
    const gateBeforeDecision = (gateBefore as any).decision;
    const gateBeforeKycLayer = (gateBefore.layers || []).find((l) => l.layer === 'KYC');
    assertOk(
      'A2: Gate ANTES bloqueia (decision=block, KYC layer reason=KYC_PENDING)',
      {
        ok:
          gateBeforeDecision === 'block' &&
          gateBefore.reason === 'KYC_PENDING_BLOCKS_FINANCIAL' &&
          gateBeforeKycLayer?.outcome === 'block' &&
          gateBeforeKycLayer?.reason === 'KYC_PENDING',
        reason: 'gate ANTES não bloqueou como esperado',
        detail: { decision: gateBeforeDecision, reason: gateBefore.reason, layers: gateBefore.layers },
      },
    );

    // ============================================================
    // ETAPA 3 — Submit (workflow C2)
    // ============================================================
    console.log('--- Etapa 3: Submit (identityValidationService.submitIdentityValidation) ---');
    const submitResult = await identityValidationService.submitIdentityValidation(
      globalUserId,
      ADMIN_USER_ID,
      'complete',
      `E2E KYC ${RUN_TAG} — submit`,
    );
    const requestId = submitResult.id;

    const reqRow = await pool.query<{
      id: string;
      status: string;
      submitted_by_user_id: string;
      global_user_id: string;
      target_kyc_level: string;
    }>(
      `SELECT id, status, submitted_by_user_id::text, global_user_id::text, target_kyc_level
         FROM identity_validation_requests WHERE id = $1::uuid`,
      [requestId],
    );
    assertOk(
      'A3: request pending com submitted_by_user_id=admin, global_user_id=PF, target_kyc_level=complete',
      {
        ok:
          !!reqRow.rows[0] &&
          reqRow.rows[0].status === 'pending' &&
          reqRow.rows[0].submitted_by_user_id === ADMIN_USER_ID &&
          reqRow.rows[0].global_user_id === globalUserId &&
          reqRow.rows[0].target_kyc_level === 'complete',
        reason: 'request divergente',
        detail: reqRow.rows[0],
      },
    );

    // ============================================================
    // ETAPA 4 — Review approved (transacional)
    // ============================================================
    console.log('--- Etapa 4: Review approved (transacional: request + identities) ---');
    await identityValidationService.reviewIdentityValidation(
      requestId,
      'approved',
      'E2E KYC approved reason',
      ADMIN_USER_ID,
    );

    // SELECT 4a: request approved + reviewer + reason.
    const reqFinal = await pool.query<{
      status: string;
      reviewed_by_user_id: string;
      decision_reason: string;
      reviewed_at: Date;
    }>(
      `SELECT status, reviewed_by_user_id::text, decision_reason, reviewed_at
         FROM identity_validation_requests WHERE id = $1::uuid`,
      [requestId],
    );
    assertOk('A4a: request approved + reviewed_by=admin + decision_reason gravado', {
      ok:
        !!reqFinal.rows[0] &&
        reqFinal.rows[0].status === 'approved' &&
        reqFinal.rows[0].reviewed_by_user_id === ADMIN_USER_ID &&
        reqFinal.rows[0].decision_reason === 'E2E KYC approved reason',
      reason: 'request não atingiu approved corretamente',
      detail: reqFinal.rows[0],
    });
    const reqReviewedAt = reqFinal.rows[0]!.reviewed_at;

    // SELECT 4b: identities atualizada (kyc_status=approved + kyc_level=target).
    const idFinal = await pool.query<{
      kyc_status: string;
      kyc_level: string;
      updated_at: Date;
    }>(
      `SELECT kyc_status, kyc_level, updated_at FROM identities WHERE global_user_id = $1::uuid`,
      [globalUserId],
    );
    assertOk('A4b: identities kyc_status=approved + kyc_level=complete (target)', {
      ok:
        !!idFinal.rows[0] &&
        idFinal.rows[0].kyc_status === 'approved' &&
        idFinal.rows[0].kyc_level === 'complete',
      reason: 'identities não convergiu para approved/complete',
      detail: idFinal.rows[0],
    });
    const idUpdatedAt = idFinal.rows[0]!.updated_at;

    // SELECT 4c: atomicidade — timestamps coincidem (mesma transação).
    assertOk(
      'A4c: timestamps coincidem (request.reviewed_at = identities.updated_at) — atomicidade transacional confirmada',
      {
        ok: reqReviewedAt.toISOString() === idUpdatedAt.toISOString(),
        reason: 'timestamps divergem entre as 2 escritas — não foi a mesma transação',
        detail: { request: reqReviewedAt.toISOString(), identity: idUpdatedAt.toISOString() },
      },
    );

    // ============================================================
    // ETAPA 5 — Gate DEPOIS (a PROVA DE OURO: bloqueio destravou)
    // ============================================================
    console.log('--- Etapa 5: Gate DEPOIS (MESMO actor, gate intocado — esperado ALLOW KYC_OK) ---');
    const gateAfter = await authorityDecisionService.evaluateFinancialSensitiveAction(TENANT_ID, {
      actorId,
      action: 'financial_transfer',
      amountCents: 100,
    });
    const gateAfterDecision = (gateAfter as any).decision;
    const gateAfterKycLayer = (gateAfter.layers || []).find((l) => l.layer === 'KYC');
    assertOk(
      'A5: Gate DEPOIS libera (decision=allow, KYC layer outcome=pass reason=KYC_OK:approved)',
      {
        ok:
          gateAfterDecision === 'allow' &&
          gateAfterKycLayer?.outcome === 'pass' &&
          gateAfterKycLayer?.reason === 'KYC_OK:approved',
        reason: 'gate DEPOIS não liberou como esperado',
        detail: { decision: gateAfterDecision, reason: gateAfter.reason, layers: gateAfter.layers },
      },
    );

    // ============================================================
    // A PROVA DE OURO: bloqueio destravou (mesmo actor)
    // ============================================================
    assertOk(
      'A6 — PROVA DE OURO: block (passo 2) → allow (passo 5) no MESMO actor, sem mexer no gate. 3 camadas conectadas em runtime.',
      {
        ok: gateBeforeDecision === 'block' && gateAfterDecision === 'allow',
        reason: 'gate não transicionou de block para allow',
        detail: { before: gateBeforeDecision, after: gateAfterDecision, actorId },
      },
    );

    // ============================================================
    // ETAPA 6 — Circuito monetário mínimo: transfer REAL no MESMO actor aprovado
    // ============================================================
    // O MESMO actor que estava bloqueado em A2 (KYC_PENDING) e foi aprovado em
    // A4 agora executa uma transferência real. O gate é chamado DENTRO do
    // bankTransactionService.transfer (bank-transaction.service.ts L362-379)
    // ANTES dos INSERTs no ledger; deve passar (KYC_OK:approved).
    // Escopo travado: transfer puro PF→sink, sem split/outbox/createExecution/RFQ.
    console.log('\n=== Etapa 6 — Circuito monetário mínimo (transfer real após KYC) ===');

    // 6.1 Conta do PF aprovado (idempotente).
    console.log('--- 6.1: criar conta do PF aprovado ---');
    const pfAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
      ownerId: userId,
      ownerType: 'user',
      currency: 'BRL',
    });
    cleanupState.bankAccountIds.push(pfAccount.accountId);
    assertOk('A6.1: bank_account criada para PF (ownerType=user)', {
      ok: !!pfAccount.accountId && pfAccount.ownerType === 'user',
      reason: 'conta PF não criada corretamente',
      detail: pfAccount,
    });

    // 6.2 Garantir conta SYSTEM reserve (mesmo padrão do E2E financeiro
    //     L141-148). NÃO captura no cleanup — pode pré-existir do dia.
    console.log('--- 6.2: garantir system reserve account ---');
    let sysReserve = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve');
    if (!sysReserve) {
      await bankAccountRepository.createAccount(TENANT_ID, {
        ownerId: 'system:reserve:' + TENANT_ID,
        ownerType: 'system',
        accountType: 'credit',
        currency: 'BRL',
      });
      sysReserve = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve');
    }
    if (!sysReserve) {
      throw new Error('SYSTEM_RESERVE_ACCOUNT_NOT_FOUND');
    }

    // 6.2b Mint na system reserve para garantir capacidade
    //      (idempotente via eventId fixo — mesma estratégia do E2E financeiro
    //       L153-168). O caller usa concept slug 'system-reserve-credit'
    //       em 'financeiro-payout'.
    const conceptId = await resolveConceptUuid('system-reserve-credit', 'financeiro-payout');
    const mintEventId = '00000000-0000-0000-0000-000000000001';
    try {
      const mintResult = await bankTransactionService.createSimpleTransaction(TENANT_ID, {
        eventId: mintEventId,
        referenceType: 'e2e_kyc_unlock_mint',
        toAccountId: sysReserve.accountId,
        amountCents: 100_000_000, // R$ 1M (capacidade ampla; cleanup limpa)
        currency: 'BRL',
        transactionType: 'deposit',
        description: 'E2E KYC unlock — mint system reserve capacity',
        concept_id: conceptId,
        authorship: buildSystemAuthorship({
          actingForAccountId: sysReserve.accountId,
          actingForActorId: actorId,
        }),
      });
      cleanupState.bankTransactionIds.push(mintResult.transaction.transactionId);
    } catch (e: any) {
      if (!/duplicate|unique|already exists|event_id/i.test(String(e?.message || ''))) {
        throw e;
      }
      // Idempotência: mint já existia, segue.
    }

    // 6.3 Seed: SYSTEM → PF (skipRiskGate=true porque from=system; gate NÃO
    //     chamado aqui — esse é seed, não a prova de destrave). treasurySource
    //     obrigatório (treasury isolation).
    console.log('--- 6.3: seed saldo SYSTEM → PF (skipRiskGate, treasury:simulation) ---');
    const seedAmountCents = 100_000; // R$ 1.000 — saldo inicial do PF
    const seedEventId = uuidv4();
    const seedResult = await bankTransactionService.transfer(TENANT_ID, {
      eventId: seedEventId,
      fromAccountId: sysReserve.accountId,
      toAccountId: pfAccount.accountId,
      amountCents: seedAmountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      referenceType: 'e2e_kyc_unlock_seed',
      referenceId: userId,
      description: 'E2E KYC unlock — seed PF initial balance',
      treasurySource: 'treasury:simulation',
      concept_id: conceptId,
      authorship: buildSystemAuthorship({
        actingForAccountId: sysReserve.accountId,
        actingForActorId: actorId,
      }),
    });
    cleanupState.bankTransactionIds.push(seedResult.transactionId);

    // 6.4 Criar conta SINK temporária (system; aceita recepção sem treasury
    //     check, pois treasury isolation só aplica from=system).
    console.log('--- 6.4: criar conta SINK temporária ---');
    const sinkOwnerId = `system:e2e-kyc-sink:${RUN_TAG}`;
    const sinkAccount = await bankAccountRepository.createAccount(TENANT_ID, {
      ownerId: sinkOwnerId,
      ownerType: 'system',
      accountType: 'credit',
      currency: 'BRL',
    });
    cleanupState.bankAccountIds.push(sinkAccount.accountId);

    // 6.5 TRANSFER REAL — PF aprovado faz transfer (skipRiskGate=false porque
    //     from=user; gate `requireFinancialRiskClearance` é chamado dentro
    //     do transfer ANTES dos INSERTs, e deve passar KYC_OK:approved).
    console.log('--- 6.5: TRANSFER REAL — PF aprovado → SINK (gate chamado para PF) ---');
    const realAmountCents = 1000; // R$ 10
    const realEventId = uuidv4();
    const realReferenceId = uuidv4();
    const realDescription = 'E2E KYC unlock — PF aprovado executa transfer real';
    const transferResult = await bankTransactionService.transfer(TENANT_ID, {
      eventId: realEventId,
      fromAccountId: pfAccount.accountId,
      toAccountId: sinkAccount.accountId,
      amountCents: realAmountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      referenceType: 'e2e_kyc_unlock',
      referenceId: realReferenceId,
      description: realDescription,
      concept_id: conceptId,
      authorship: buildFinancialAuthorshipFromRequest({
        performedByUserId: userId,
        actingForActorId: actorId,
        actingForAccountId: pfAccount.accountId,
        authoritySource: 'ownership',
        permissionSnapshot: {
          permissionKey: 'ownership',
          allowed: true,
          actorId,
          userId,
          decidedAt: new Date().toISOString(),
        },
      }),
    });
    cleanupState.bankTransactionIds.push(transferResult.transactionId);
    assertOk('A6.5: transfer executado pelo PF aprovado, transactionId presente', {
      ok:
        !!transferResult.transactionId &&
        transferResult.amountCents === realAmountCents &&
        transferResult.fromAccountId === pfAccount.accountId &&
        transferResult.toAccountId === sinkAccount.accountId,
      reason: 'transferResult incompleto ou divergente',
      detail: transferResult,
    });

    // 6.6 SELECT bank_ledger entries — 2 rows (1 debit no PF + 1 credit no sink).
    console.log('--- 6.6: SELECT bank_ledger entries ---');
    const ledgerRows = await pool.query<{
      id: string;
      account_id: string;
      transaction_id: string;
      direction: string;
      amount_cents: string;
      created_at: Date;
    }>(
      `SELECT id::text, account_id::text, transaction_id::text, direction,
              amount_cents::text, created_at
         FROM bank_ledger
        WHERE transaction_id = $1::uuid
        ORDER BY direction DESC, created_at ASC`,
      [transferResult.transactionId],
    );
    const debitEntry = ledgerRows.rows.find((r) => r.direction === 'debit');
    const creditEntry = ledgerRows.rows.find((r) => r.direction === 'credit');
    assertOk(
      'A6.6: bank_ledger contém 2 entries (1 debit no PF + 1 credit no sink), amount_cents=1000 cada, sem órfãs',
      {
        ok:
          ledgerRows.rows.length === 2 &&
          !!debitEntry &&
          !!creditEntry &&
          debitEntry.account_id === pfAccount.accountId &&
          creditEntry.account_id === sinkAccount.accountId &&
          debitEntry.amount_cents === String(realAmountCents) &&
          creditEntry.amount_cents === String(realAmountCents) &&
          ledgerRows.rows.every((r) => r.transaction_id === transferResult.transactionId),
        reason: 'entries no ledger não correspondem ao esperado',
        detail: ledgerRows.rows,
      },
    );

    // 6.7 Σ(débitos) = Σ(créditos) no bank_ledger desta transação.
    console.log('--- 6.7: Σ(débitos) = Σ(créditos) (conservação de valor) ---');
    const sums = await pool.query<{ sum_debit: string; sum_credit: string }>(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE direction='debit'), 0)::text  AS sum_debit,
         COALESCE(SUM(amount_cents) FILTER (WHERE direction='credit'), 0)::text AS sum_credit
       FROM bank_ledger
       WHERE transaction_id = $1::uuid`,
      [transferResult.transactionId],
    );
    const sumDebit = sums.rows[0]?.sum_debit;
    const sumCredit = sums.rows[0]?.sum_credit;
    assertOk(
      'A6.7: Σ(débitos) = Σ(créditos) = amountCents desta transação (conservação de valor no ledger)',
      {
        ok: sumDebit === sumCredit && sumDebit === String(realAmountCents),
        reason: 'somatórias não batem',
        detail: { sumDebit, sumCredit, expected: realAmountCents },
      },
    );

    // 6.8 calculateBalance: PF (decresceu por 1000) e SINK (cresceu por 1000).
    console.log('--- 6.8: calculateBalance — PF reduziu, SINK aumentou ---');
    const pfBalanceAfter = await bankLedgerRepository.calculateBalance(TENANT_ID, pfAccount.accountId);
    const sinkBalanceAfter = await bankLedgerRepository.calculateBalance(TENANT_ID, sinkAccount.accountId);
    assertOk(
      'A6.8: PF balance = seed - transfer; SINK balance = +transfer (saldos coerentes com ledger)',
      {
        ok:
          pfBalanceAfter.balanceCents === seedAmountCents - realAmountCents &&
          sinkBalanceAfter.balanceCents === realAmountCents,
        reason: 'saldos divergem do esperado',
        detail: {
          pf: pfBalanceAfter.balanceCents,
          sink: sinkBalanceAfter.balanceCents,
          expected: {
            pf: seedAmountCents - realAmountCents,
            sink: realAmountCents,
          },
        },
      },
    );

    // 6.9 Cadeia causal completa.
    assertOk(
      'A6.9 — CADEIA CAUSAL COMPLETA: KYC_PENDING (A2) → KYC_OK (A5) → AUTHORITY_ALLOW → TRANSFER_EXECUTED → LEDGER_PERSISTED, MESMO actor',
      {
        ok:
          gateBeforeDecision === 'block' &&
          gateAfterDecision === 'allow' &&
          !!transferResult.transactionId &&
          ledgerRows.rows.length === 2 &&
          sumDebit === sumCredit,
        reason: 'cadeia causal incompleta',
        detail: {
          actorId,
          gate_a2: gateBeforeDecision,
          gate_a5: gateAfterDecision,
          transfer_id: transferResult.transactionId,
          ledger_entries: ledgerRows.rows.length,
          sum_debit: sumDebit,
          sum_credit: sumCredit,
        },
      },
    );

    // ============================================================
    // MODO B — falsificações
    // ============================================================
    console.log('\n=== Modo B — Falsificacao ativa ===');

    // B1: submit em identity já approved (mesma do passo 4).
    await expectFail(
      'B1: submit em identity já approved → IDENTITY_ALREADY_APPROVED',
      async () => {
        await identityValidationService.submitIdentityValidation(
          globalUserId,
          ADMIN_USER_ID,
          'basic',
          'tentativa em approved',
        );
      },
      /IDENTITY_ALREADY_APPROVED/,
    );

    // Setup para B2: novo PF com identity pending + 1 submit pendente.
    const reg2 = await authService.register(
      TENANT_ID,
      E2E_EMAIL_2,
      E2E_PASSWORD,
      E2E_CPF_2,
      `E2E KYC Test 2 ${RUN_TAG}`,
      undefined,
      undefined,
      undefined,
    );
    const userId2 = reg2.user.userId;
    cleanupState.userIds.push(userId2);
    const gu2Row = await pool.query<{ global_user_id: string }>(
      `SELECT u.global_user_id::text AS global_user_id FROM users u WHERE u.id = $1::uuid`,
      [userId2],
    );
    const globalUserId2 = gu2Row.rows[0]!.global_user_id;
    cleanupState.globalUserIds.push(globalUserId2);

    await identityValidationService.submitIdentityValidation(
      globalUserId2,
      ADMIN_USER_ID,
      'basic',
      'primeiro submit (setup para B2)',
    );

    // B2: segundo submit com pending existente.
    await expectFail(
      'B2: segundo submit com pending existente → IDENTITY_HAS_PENDING_VALIDATION',
      async () => {
        await identityValidationService.submitIdentityValidation(
          globalUserId2,
          ADMIN_USER_ID,
          'basic',
          'segundo submit',
        );
      },
      /IDENTITY_HAS_PENDING_VALIDATION/,
    );

    // B3: review de requestId inexistente.
    const fakeRequestId = '00000000-0000-0000-0000-000000000000';
    await expectFail(
      'B3: review de requestId inexistente → VALIDATION_REQUEST_NOT_REVIEWABLE',
      async () => {
        await identityValidationService.reviewIdentityValidation(
          fakeRequestId,
          'approved',
          'fake',
          ADMIN_USER_ID,
        );
      },
      /VALIDATION_REQUEST_NOT_REVIEWABLE/,
    );

    const divider = '======================================================';
    console.log(`\n${divider}`);
    console.log('E2E TRANSVERSAL KYC + CIRCUITO MONETARIO MINIMO :: PASS');
    console.log('  Modo A causal: 5 etapas + PROVA DE OURO + Etapa 6 (transfer real)');
    console.log('  Modo B falsificacoes: 3 rejeitadas');
    console.log('  Cadeia causal completa, MESMO actor:');
    console.log('    KYC_PENDING (A2) → KYC_OK (A5) → AUTHORITY_ALLOW');
    console.log('                    → TRANSFER_EXECUTED → LEDGER_PERSISTED (A6)');
    console.log('  Σ(débitos) = Σ(créditos) confirmado no bank_ledger.');
    console.log(`${divider}\n`);
  } finally {
    await cleanup(cleanupState);
    await pool.end();
  }
}

main().catch((e) => {
  console.error('\n❌ ERRO NAO CAPTURADO:', e);
  pool.end().finally(() => process.exit(1));
});

/**
 * E2E TRANSVERSAL DE KYC (Frente C — 3 camadas conectadas em sequência única)
 *
 * Encadeia ponta a ponta:
 *   1. Cadastro PF via authService.register (Fatia C1 cria identity pending/none)
 *   2. Gate ANTES: evaluateFinancialSensitiveAction → block KYC_PENDING_BLOCKS_FINANCIAL
 *   3. Submit: submitIdentityValidation → request pending
 *   4. Review approved: reviewIdentityValidation (transacional) → request approved +
 *      identities.kyc_status='approved' + kyc_level=target (timestamps coincidem)
 *   5. Gate DEPOIS: evaluateFinancialSensitiveAction (MESMO actor) → allow KYC_OK
 *
 * A PROVA DE OURO: passo 2 BLOCK → passo 5 ALLOW, mesmo actor, gate intocado.
 * Materializa "cadastro CRIA EXISTÊNCIA / KYC APROVA CAPACIDADE / authority
 * LIBERA EXECUÇÃO" das 3 camadas.
 *
 * ESCOPO LIMITADO ao fluxo de validação de pessoa. NÃO executa transfer real
 * (provar que o gate PASSA basta; transação financeira é outro pipeline já
 * coberto pelo validate-pipeline-e2e-transversal.ts financeiro).
 * Arquivo separado por disciplina (seeds ortogonais — KYC humano precisa só
 * de tenant + admin; financeiro precisa de bank accounts + mint + services).
 *
 * Simétrico a validate-pipeline-e2e-company.ts (G2 Etapa 2 — E2E de empresa).
 */
import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { authService } from '../core/auth/auth.service';
import { authorityDecisionService } from '../core/compliance/authority-decision.service';
import { identityValidationService } from '../core/identity/identity-validation.service';

dotenv.config({ path: join(process.cwd(), '.env') });

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
};

async function cleanup(state: CleanupState): Promise<void> {
  console.log('\n=== Limpeza ===');
  const { userIds, globalUserIds } = state;
  try {
    if (globalUserIds.length > 0) {
      await pool.query(
        `DELETE FROM identity_validation_requests WHERE global_user_id = ANY($1::uuid[])`,
        [globalUserIds],
      );
      console.log(`  ✓ identity_validation_requests por global_user_id (${globalUserIds.length})`);
    }
    if (userIds.length > 0) {
      await pool.query(
        `DELETE FROM actors WHERE tenant_id = $1::uuid AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
        [TENANT_ID, userIds],
      );
      await pool
        .query(`DELETE FROM user_profiles WHERE user_id = ANY($1::uuid[])`, [userIds])
        .catch(() => {});
      await pool.query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
      console.log(`  ✓ user + relations (${userIds.length})`);
    }
    if (globalUserIds.length > 0) {
      await pool.query(
        `DELETE FROM identities WHERE global_user_id = ANY($1::uuid[])`,
        [globalUserIds],
      );
      await pool.query(
        `DELETE FROM global_users WHERE global_user_id = ANY($1::uuid[])`,
        [globalUserIds],
      );
      console.log(`  ✓ identity + global_user (${globalUserIds.length})`);
    }
  } catch (e) {
    console.warn('  ⚠️  Cleanup parcial — erro:', e instanceof Error ? e.message : String(e));
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

  const cleanupState: CleanupState = { userIds: [], globalUserIds: [] };

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
    console.log('E2E TRANSVERSAL KYC :: PASS');
    console.log('  Modo A causal: 5 etapas + PROVA DE OURO (block → allow)');
    console.log('  Modo B falsificacoes: 3 rejeitadas');
    console.log('  As 3 camadas conectadas em runtime real:');
    console.log('    cadastro CRIOU      (C1: identity pending nasce)');
    console.log('    KYC      APROVOU    (C2: workflow → approved)');
    console.log('    authority LIBEROU   (gate intocado: block → allow)');
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

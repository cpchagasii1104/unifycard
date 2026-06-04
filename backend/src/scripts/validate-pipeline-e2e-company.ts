/**
 * G2 — VALIDATE PIPELINE E2E COMPANY (nascimento de empresa, pré-gate financeiro)
 *
 * Encadeia ponta a ponta: cadastro PF -> createCompany -> submitForValidation
 * -> reviewCompanyValidation. APROVAÇÃO legada DESABILITADA (DECISION-0090 Fase 2.4):
 * approved é recusado e NÃO verifica empresa; rejeição segue. Cada etapa com SELECT
 * confirmatório direto no banco. Modo A causal + Modo B falsificações.
 *
 * ESCOPO LIMITADO ao caminho de nascimento de empresa. NÃO estende para
 * pagamento/serviço (exigiria seed de identity/KYC — outro pipeline já
 * coberto por validate-pipeline-e2e-transversal.ts).
 *
 * Convergência das 4 fatias do dia 2026-05-25:
 *   ebd6054d Fatia 1 IDENTIDADE (§8 tenant explícito)
 *   33c49a46 Fatia A1 RBAC      (actor_has_any_role -> requireRole)
 *   dd8aebe9 Fatia A2 onboarding/validation em actors.metadata
 *   7bf451ef Frente B           (workflow company_validation_requests)
 */
import dotenv from 'dotenv';
import { join } from 'path';

import { pool } from '../core/database/pool';
import { authService } from '../core/auth/auth.service';
import { companiesService } from '../core/companies/companies.service';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';

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

// CPF válido pelo dígito verificador (algoritmo oficial).
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

// CNPJ válido pelo dígito verificador (algoritmo oficial). createCompany enforça DV desde
// F1/DECISION-0085 (validateCNPJ) — gerador sem DV quebrava a ETAPA 2 independentemente desta fatia.
function generateCnpjFormat(seed: number): string {
  const base = String(seed).padStart(12, '0').slice(-12);
  const calcDv = (nums: string, weights: number[]): number => {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += parseInt(nums[i]!, 10) * weights[i]!;
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const dv1 = calcDv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcDv(base + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + String(dv1) + String(dv2);
}

const RUN_TAG = Date.now();
const E2E_EMAIL = `e2e-company-${RUN_TAG}@e2e.internal`;
const E2E_PASSWORD = 'E2eCompanyTest!2026';
const E2E_CPF = generateValidCpf(RUN_TAG % 1_000_000_000);
const E2E_CNPJ_1 = generateCnpjFormat(RUN_TAG % 100_000_000_000_000);
const E2E_CNPJ_2 = generateCnpjFormat((RUN_TAG + 1) % 100_000_000_000_000);
const E2E_CNPJ_3 = generateCnpjFormat((RUN_TAG + 2) % 100_000_000_000_000);

type CleanupState = {
  userId?: string;
  globalUserId?: string;
  companyIds: string[];
};

async function cleanup(state: CleanupState): Promise<void> {
  console.log('\n=== Limpeza ===');
  const { userId, globalUserId, companyIds } = state;
  try {
    for (const cid of companyIds) {
      await pool.query(
        `DELETE FROM company_validation_requests WHERE company_id = $1::uuid`,
        [cid],
      );
      await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [cid]);
      await pool.query(`DELETE FROM company_users WHERE company_id = $1::uuid`, [cid]);
      await pool
        .query(`DELETE FROM company_domains WHERE company_id = $1::uuid`, [cid])
        .catch(() => {});
      await pool.query(`DELETE FROM companies WHERE company_id = $1::uuid`, [cid]);
      console.log(`  ✓ company ${cid} + relations`);
    }
    if (userId) {
      await pool.query(
        `DELETE FROM actors WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND actor_type = 'user'`,
        [TENANT_ID, userId],
      );
      await pool
        .query(`DELETE FROM user_profiles WHERE user_id = $1::uuid`, [userId])
        .catch(() => {});
      await pool.query(`DELETE FROM profiles WHERE user_id = $1::uuid`, [userId]).catch(() => {});
      await pool
        .query(`DELETE FROM referral_codes WHERE user_id = $1::uuid`, [userId])
        .catch(() => {});
      await pool.query(`DELETE FROM user_roles WHERE user_id = $1::uuid`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id = $1::uuid`, [userId]);
      console.log(`  ✓ user ${userId} + relations`);
    }
    if (globalUserId) {
      await pool.query(`DELETE FROM global_users WHERE global_user_id = $1::uuid`, [globalUserId]);
      console.log(`  ✓ global_user ${globalUserId}`);
    }
  } catch (e) {
    console.warn(
      '  ⚠️  Cleanup parcial — erro:',
      e instanceof Error ? e.message : String(e),
    );
  }
}

async function main(): Promise<void> {
  console.log('\n═══ G2 — VALIDATE PIPELINE E2E COMPANY ═══');
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Admin:    ${ADMIN_USER_ID}`);
  console.log(`Run tag:  ${RUN_TAG}`);
  console.log(`Email:    ${E2E_EMAIL}`);
  console.log(`CPF:      ${E2E_CPF}\n`);

  // Bootstrap DI (mesmo padrão do E2E financeiro existente).
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

  // Setup idempotente: garante tenant + RBAC. No-op se já existem (ex.: unificard_dev);
  // habilita rodar em DB efêmera sem tocar dev (DECISION-0090 Fase 2.4 — prova do approved desligado).
  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'E2E Company Tenant', slug: `e2e-company-${RUN_TAG}` });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const cleanupState: CleanupState = { companyIds: [] };

  try {
    console.log('=== Modo A — Fluxo causal ===');

    // ============================================================
    // ETAPA 1 — Cadastro PF via authService.register (caminho canônico)
    // ============================================================
    console.log('--- Etapa 1: Cadastro PF ---');
    const reg = await authService.register(
      TENANT_ID,
      E2E_EMAIL,
      E2E_PASSWORD,
      E2E_CPF,
      `E2E Company Test ${RUN_TAG}`,
      undefined,
      undefined,
      undefined,
    );
    cleanupState.userId = reg.user.userId;
    const userId = cleanupState.userId!;

    // SELECT 1a: global_users com CPF.
    const guRes = await pool.query<{ global_user_id: string; cpf: string }>(
      `SELECT global_user_id, cpf FROM global_users WHERE cpf = $1`,
      [E2E_CPF],
    );
    assertOk('A1a: global_users gravado com CPF', {
      ok: !!guRes.rows[0] && guRes.rows[0].cpf === E2E_CPF,
      reason: 'global_users nao encontrado ou CPF divergente',
      detail: guRes.rows[0],
    });
    cleanupState.globalUserId = guRes.rows[0]!.global_user_id;
    const globalUserId = cleanupState.globalUserId!;

    // SELECT 1b: users gravado no tenant, global_user_id ligado.
    const uRes = await pool.query<{
      id: string;
      tenant_id: string;
      global_user_id: string;
      email: string;
    }>(
      `SELECT id, tenant_id, global_user_id, email FROM users WHERE id = $1::uuid`,
      [userId],
    );
    assertOk('A1b: users com tenant_id + global_user_id + email canonicos', {
      ok:
        !!uRes.rows[0] &&
        uRes.rows[0].tenant_id === TENANT_ID &&
        uRes.rows[0].global_user_id === globalUserId &&
        uRes.rows[0].email === E2E_EMAIL,
      reason: 'users nao encontrado ou campos divergentes',
      detail: uRes.rows[0],
    });

    // SELECT 1c: actor PF criado (actor_type='user', user_id ligado).
    const uaRes = await pool.query<{
      actor_id: string;
      actor_type: string;
      user_id: string;
    }>(
      `SELECT actor_id, actor_type, user_id FROM actors
        WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND actor_type = 'user'`,
      [TENANT_ID, userId],
    );
    assertOk('A1c: actor PF criado (actor_type=user, user_id ligado) via ensureUserActor', {
      ok: !!uaRes.rows[0],
      reason: 'actor PF nao encontrado',
      detail: uaRes.rows[0],
    });
    const userActorId = uaRes.rows[0]!.actor_id;

    // ============================================================
    // ETAPA 2 — createCompany via companiesService
    // ============================================================
    console.log('--- Etapa 2: createCompany ---');
    const created = await companiesService.createCompany(
      globalUserId,
      {
        cnpj: E2E_CNPJ_1,
        companyName: `E2E Test Co ${RUN_TAG}`,
        role: 'owner',
        fetchFromRevenue: false,
      },
      TENANT_ID,
    );
    const companyId = created.company.companyId;
    cleanupState.companyIds.push(companyId);

    // SELECT 2a: companies PROVISIONAL.
    const cRes = await pool.query<{
      company_id: string;
      company_status: string;
    }>(
      `SELECT company_id, company_status FROM companies WHERE company_id = $1::uuid`,
      [companyId],
    );
    assertOk('A2a: companies criada PROVISIONAL (is_verified dropado 3.3-B2)', {
      ok:
        !!cRes.rows[0] &&
        cRes.rows[0].company_status === 'PROVISIONAL',
      reason: 'companies em estado inesperado',
      detail: cRes.rows[0],
    });

    // SELECT 2b: page actor com responsible_actor_id = actor PF do passo 1 (§4.8.2).
    const paRes = await pool.query<{
      actor_id: string;
      actor_type: string;
      company_id: string;
      responsible_actor_id: string;
    }>(
      `SELECT actor_id, actor_type, company_id, responsible_actor_id FROM actors
        WHERE tenant_id = $1::uuid AND company_id = $2::uuid AND actor_type = 'page'`,
      [TENANT_ID, companyId],
    );
    assertOk('A2b: page actor com responsible_actor_id = actor PF do cadastro (ancora humana §4.8.2)', {
      ok:
        !!paRes.rows[0] &&
        paRes.rows[0].actor_type === 'page' &&
        paRes.rows[0].company_id === companyId &&
        paRes.rows[0].responsible_actor_id === userActorId,
      reason: 'page actor ausente ou responsible_actor_id divergente',
      detail: paRes.rows[0],
    });
    const pageActorId = paRes.rows[0]!.actor_id;

    // ============================================================
    // ETAPA 3 — submitForValidation
    // ============================================================
    console.log('--- Etapa 3: submitForValidation ---');
    const submitResult = await companiesService.submitForValidation(
      companyId,
      TENANT_ID,
      userId,
      `E2E company test ${RUN_TAG}`,
    );
    const requestId = submitResult.id;

    // SELECT 3a: request pending com submitted_by_user_id = users.id do cadastro.
    const reqRes = await pool.query<{
      id: string;
      status: string;
      submitted_by_user_id: string;
      company_id: string;
      submission_notes: string | null;
    }>(
      `SELECT id, status, submitted_by_user_id, company_id, submission_notes
         FROM company_validation_requests WHERE id = $1::uuid`,
      [requestId],
    );
    assertOk(
      'A3a: request pending com submitted_by_user_id = users.id do cadastro (continuidade ponta a ponta)',
      {
        ok:
          !!reqRes.rows[0] &&
          reqRes.rows[0].status === 'pending' &&
          reqRes.rows[0].submitted_by_user_id === userId &&
          reqRes.rows[0].company_id === companyId,
        reason: 'request divergente',
        detail: reqRes.rows[0],
      },
    );

    // ============================================================
    // ETAPA 4 — reviewCompanyValidation approved DESABILITADO (DECISION-0090 Fase 2.4)
    // ============================================================
    console.log('--- Etapa 4: reviewCompanyValidation approved DESABILITADO ---');
    await expectFail(
      'A4: reviewCompanyValidation(approved) → PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED (aprovação legada desligada)',
      async () => {
        await companiesService.reviewCompanyValidation(
          requestId,
          'approved',
          'E2E approval reason',
          ADMIN_USER_ID,
          TENANT_ID,
        );
      },
      /PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED/,
    );

    // SELECT 4-prova-req: request continua 'pending' (approved lançou antes de qualquer escrita).
    const fr = await pool.query<{ status: string; reviewed_at: Date | null }>(
      `SELECT status, reviewed_at FROM company_validation_requests WHERE id = $1::uuid`,
      [requestId],
    );
    assertOk('A4-prova-req: request continua pending (approved nao escreveu)', {
      ok: !!fr.rows[0] && fr.rows[0].status === 'pending' && fr.rows[0].reviewed_at == null,
      reason: 'request transicionou indevidamente',
      detail: fr.rows[0],
    });

    // SELECT 4-prova-comp: companies continua PROVISIONAL (NÃO verificada; is_verified dropado 3.3-B2).
    const fc = await pool.query<{ company_status: string }>(
      `SELECT company_status FROM companies WHERE company_id = $1::uuid`,
      [companyId],
    );
    assertOk('A4-prova-comp: companies PROVISIONAL (nao verificada por fora do KYB)', {
      ok: !!fc.rows[0] && fc.rows[0].company_status === 'PROVISIONAL',
      reason: 'companies foi verificada indevidamente',
      detail: fc.rows[0],
    });

    // SELECT 4-prova-actor: page actor SEM audit metadata.validation (nenhuma aprovação gravada).
    const fa = await pool.query<{ validation: any }>(
      `SELECT metadata->'validation' AS validation FROM actors WHERE actor_id = $1::uuid`,
      [pageActorId],
    );
    assertOk('A4-prova-actor: page actor sem metadata.validation (sem audit de aprovacao)', {
      ok: fa.rows[0]?.validation == null,
      reason: 'audit de validacao foi gravado indevidamente',
      detail: fa.rows[0]?.validation,
    });

    // ============================================================
    // MODO B — Falsificações (runtime deve rejeitar)
    // ============================================================
    console.log('\n=== Modo B — Falsificacao ativa ===');

    // B1: company com pending existente (o request de ETAPA 3 segue pending — approved foi recusado).
    await expectFail(
      'B1: submit em company com pending existente → COMPANY_HAS_PENDING_VALIDATION',
      async () => {
        await companiesService.submitForValidation(
          companyId,
          TENANT_ID,
          userId,
          'tentativa com pending existente',
        );
      },
      /COMPANY_HAS_PENDING_VALIDATION/,
    );

    // Setup para B2: nova company PROVISIONAL com pending submetido.
    const created2 = await companiesService.createCompany(
      globalUserId,
      {
        cnpj: E2E_CNPJ_2,
        companyName: `E2E Test Co 2 ${RUN_TAG}`,
        role: 'owner',
        fetchFromRevenue: false,
      },
      TENANT_ID,
    );
    const companyId2 = created2.company.companyId;
    cleanupState.companyIds.push(companyId2);
    await companiesService.submitForValidation(
      companyId2,
      TENANT_ID,
      userId,
      'primeiro submit ok',
    );

    // B2: segundo submit com pending existente.
    await expectFail(
      'B2: segundo submit com pending existente → COMPANY_HAS_PENDING_VALIDATION',
      async () => {
        await companiesService.submitForValidation(
          companyId2,
          TENANT_ID,
          userId,
          'segundo submit',
        );
      },
      /COMPANY_HAS_PENDING_VALIDATION/,
    );

    // B3: review(rejected) de requestId inexistente → guard de request não-revisável.
    //     (approved é recusado ANTES do lookup pela neutralização Fase 2.4 — usa-se rejected p/ testar o guard.)
    const fakeRequestId = '00000000-0000-0000-0000-000000000000';
    await expectFail(
      'B3: review(rejected) de requestId inexistente → VALIDATION_REQUEST_NOT_REVIEWABLE',
      async () => {
        await companiesService.reviewCompanyValidation(
          fakeRequestId,
          'rejected',
          'fake',
          ADMIN_USER_ID,
          TENANT_ID,
        );
      },
      /VALIDATION_REQUEST_NOT_REVIEWABLE/,
    );

    // B4: approve em company SEM page actor -> recusado pela neutralização (Fase 2.4).
    const created3 = await companiesService.createCompany(
      globalUserId,
      {
        cnpj: E2E_CNPJ_3,
        companyName: `E2E Test Co 3 ${RUN_TAG}`,
        role: 'owner',
        fetchFromRevenue: false,
      },
      TENANT_ID,
    );
    const companyId3 = created3.company.companyId;
    cleanupState.companyIds.push(companyId3);
    const submitB4 = await companiesService.submitForValidation(
      companyId3,
      TENANT_ID,
      userId,
      'submit para B4',
    );
    // Remove o page actor (estado degradado). Mesmo assim, approved é recusado ANTES de qualquer
    // lógica de page actor (DECISION-0090 Fase 2.4) — prova que a recusa não depende do estado.
    await pool.query(
      `DELETE FROM actors WHERE tenant_id = $1::uuid AND company_id = $2::uuid AND actor_type = 'page'`,
      [TENANT_ID, companyId3],
    );
    await expectFail(
      'B4: approve (mesmo sem page actor) → PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED',
      async () => {
        await companiesService.reviewCompanyValidation(
          submitB4.id,
          'approved',
          'B4 disabled',
          ADMIN_USER_ID,
          TENANT_ID,
        );
      },
      /PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED/,
    );

    // SELECT B4-prova: approved recusado - request continua pending, companies continua PROVISIONAL.
    const b4req = await pool.query<{ status: string; reviewed_at: Date | null }>(
      `SELECT status, reviewed_at FROM company_validation_requests WHERE id = $1::uuid`,
      [submitB4.id],
    );
    const b4comp = await pool.query<{ company_status: string }>(
      `SELECT company_status FROM companies WHERE company_id = $1::uuid`,
      [companyId3],
    );
    assertOk(
      'B4-prova: approved recusado — request continua pending, companies continua PROVISIONAL',
      {
        ok:
          b4req.rows[0]?.status === 'pending' &&
          b4req.rows[0]?.reviewed_at == null &&
          b4comp.rows[0]?.company_status === 'PROVISIONAL',
        reason: 'ROLLBACK NAO foi efetivo — estado degradado',
        detail: { request: b4req.rows[0], company: b4comp.rows[0] },
      },
    );

    const divider = '======================================================';
    console.log(`\n${divider}`);
    console.log('G2 PIPELINE E2E COMPANY :: PASS');
    console.log('  Modo A causal: 4 etapas + SELECTs confirmatorios (approved legado DESLIGADO — DECISION-0090 Fase 2.4)');
    console.log('  Modo B falsificacoes: 4 rejeitadas');
    console.log(`${divider}\n`);
  } finally {
    await cleanup(cleanupState);
    await pool.end();
  }
}

main().catch((e) => {
  console.error('\n❌ ERRO NAO CAPTURADO:', e);
  // Tentar fechar o pool mesmo em erro não-capturado fora do try/finally.
  pool.end().finally(() => process.exit(1));
});

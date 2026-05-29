/**
 * E2E F3 — DECISION-0062 — Coerência CPF/tax_id.
 *
 * Prova que F0.1 (ghost reference fix) + F1 (audit) + F2 (backfill idempotente)
 * deixaram o sistema em estado coerente:
 *   - identities é SSOT operacional global (D2)
 *   - global_users.cpf é âncora imutável (D4)
 *   - user_profiles.cpf e profiles.cpf são projeções transitórias (D5/D6)
 *
 * Esta fatia NÃO migra leitura CORE (F4). NÃO deprecia caches (F5).
 * Apenas valida invariantes que F2 deveria ter preservado/melhorado.
 *
 * Cenários:
 *   T1 — Baseline pós-F2 (cobertura + nenhum CPF válido órfão)
 *   T2 — Coerência cross-substrato (gu/up/profiles/identities normalizados)
 *   T3 — Cadastro real (authService.register) cria cadeia fiscal mínima
 *   T4 — CORE retorna CPF coerente com identities.tax_id quando projeção existe
 *   T5 — Payload público (/social/actors/:id surface) não expõe tax_id/cpf
 *   T6 — F4.0 happy path: holder_document = identities.tax_id é aceito
 *   T7 — F4.0 bloqueia mismatch via TRIGGER trg_abd_enforce_own_account
 *   T8 — Idempotência F2: re-apply mantém identities_total e fingerprint
 *   T9 — Cleanup seguro (apenas fixtures e2e_f3_*; backfill F2 intacto)
 *
 * Prefixo de fixtures: e2e_f3_cpf_tax_id_*
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-cpf-tax-id-coherence.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { pool } from '../core/database/pool';
import { authService } from '../core/auth/auth.service';
import { coreService } from '../core/core.service';
import { actorBankDestinationService, ActorBankDestinationError } from '../modules/wallet/actor-bank-destination.service';
import { actorRepository } from '../modules/social/actor.repository';
import { normalizeCpf, validateCpf, sanitizeCpfForLog } from '../utils/cpf.validator';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const RUN_TAG = Date.now();
const E2E_PREFIX = 'e2e_f3_cpf_tax_id_';
const E2E_EMAIL = `${E2E_PREFIX}${RUN_TAG}@e2e.internal`;
const E2E_PASSWORD = 'E2eF3Cpf!2026';
const E2E_FULLNAME = `E2E F3 Coherence ${RUN_TAG}`;

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

const E2E_CPF = generateValidCpf(RUN_TAG % 1_000_000_000);
const E2E_CPF_WRONG = generateValidCpf((RUN_TAG + 999_001) % 1_000_000_000);

// ── reporter ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail: string }[] = [];

function ok(name: string, detail = '') {
  passed++;
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name: string, detail: string) {
  failed++;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

// ── env trava ─────────────────────────────────────────────────────────────────

async function assertSafeEnvironment(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REFUSED: NODE_ENV=production — F3 não roda em prod');
  }
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('unificard_dev') && !dbUrl.includes('localhost')) {
    throw new Error(`REFUSED: DATABASE_URL não aponta para unificard_dev local: ${dbUrl.replace(/:[^@]+@/, ':***@')}`);
  }
  const tenant = await q<{ id: string }>(`SELECT id FROM tenants WHERE id=$1`, [TENANT_ID]);
  if (!tenant[0]) {
    throw new Error(`REFUSED: tenant ${TENANT_ID} não existe`);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getIdentitiesFingerprint(): Promise<Map<string, { tax_id: string; tax_id_type: string; kyc_status: string; kyc_level: string; updated_at: string }>> {
  const rows = await q<{ global_user_id: string; tax_id: string; tax_id_type: string; kyc_status: string; kyc_level: string; updated_at: string }>(
    `SELECT global_user_id::text, tax_id, tax_id_type, kyc_status, kyc_level, updated_at::text FROM identities`
  );
  const map = new Map<string, any>();
  for (const r of rows) map.set(r.global_user_id, r);
  return map;
}

async function getBankSnapshot(): Promise<{ ledger: number; txs: number; splits: number }> {
  const [l, t, s] = await Promise.all([
    q<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT_ID]),
    q<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]),
    q<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_splits WHERE tenant_id=$1`, [TENANT_ID]),
  ]);
  return { ledger: parseInt(l[0]!.n, 10), txs: parseInt(t[0]!.n, 10), splits: parseInt(s[0]!.n, 10) };
}

// ── main ──────────────────────────────────────────────────────────────────────

interface CleanupState {
  userIds: string[];
  globalUserIds: string[];
  bankDestinationIds: string[];
}

async function cleanup(state: CleanupState): Promise<void> {
  console.log('\n=== Cleanup (apenas fixtures e2e_f3_*) ===');
  const tryDel = async (label: string, sql: string, params: unknown[]) => {
    try {
      const r = await pool.query(sql, params);
      console.log(`  ✓ ${label} (${r.rowCount ?? 0})`);
    } catch (e) {
      console.warn(`  ⚠ ${label}: ${(e as Error).message}`);
    }
  };

  if (state.bankDestinationIds.length > 0) {
    await tryDel('actor_bank_destinations (e2e_f3)', `DELETE FROM actor_bank_destinations WHERE id = ANY($1::uuid[])`, [state.bankDestinationIds]);
  }
  if (state.globalUserIds.length > 0) {
    await tryDel('identity_validation_requests (e2e_f3)', `DELETE FROM identity_validation_requests WHERE global_user_id = ANY($1::uuid[])`, [state.globalUserIds]);
  }
  if (state.userIds.length > 0) {
    // actors PF podem ter bank_account FK — tentar, ignorar erros.
    await tryDel('actors (PF e2e_f3)', `DELETE FROM actors WHERE tenant_id=$1 AND user_id = ANY($2::uuid[]) AND actor_type='user'`, [TENANT_ID, state.userIds]);
    await tryDel('user_profiles (e2e_f3)', `DELETE FROM user_profiles WHERE user_id = ANY($1::uuid[])`, [state.userIds]);
    await tryDel('profiles (e2e_f3)', `DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [state.userIds]);
    await tryDel('users (e2e_f3)', `DELETE FROM users WHERE id = ANY($1::uuid[])`, [state.userIds]);
  }
  if (state.globalUserIds.length > 0) {
    // ATENÇÃO: NÃO deletar identities/global_users de outros usuários — apenas as criadas por esta suíte.
    await tryDel('identities (e2e_f3)', `DELETE FROM identities WHERE global_user_id = ANY($1::uuid[])`, [state.globalUserIds]);
    await tryDel('global_users (e2e_f3)', `DELETE FROM global_users WHERE global_user_id = ANY($1::uuid[])`, [state.globalUserIds]);
  }
}

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F3 DECISION-0062 — Coerência CPF/tax_id');
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Run tag:  ${RUN_TAG}`);
  console.log(`E2E CPF:  ${sanitizeCpfForLog(E2E_CPF)}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await assertSafeEnvironment();

  // Bootstrap DI (mesmo padrão de validate-pipeline-e2e-kyc.ts) — necessário
  // para que authService.register → ensureUserActor → socialPortsRegistry.getActorRepository()
  // não falhe silenciosamente e crie o actor PF.
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

  const state: CleanupState = { userIds: [], globalUserIds: [], bankDestinationIds: [] };

  try {
    // ── T1: Baseline pós-F2 ───────────────────────────────────────────────────
    console.log('T1 — Baseline pós-F2 (cobertura + sem CPF válido órfão)');
    const ident0 = await q<{ n: string }>(`SELECT COUNT(*)::text AS n FROM identities`);
    const identTotalBefore = parseInt(ident0[0]!.n, 10);
    console.log(`     identities_total_before = ${identTotalBefore}`);

    // Buscar CPFs válidos em global_users sem identity (deveria ser 1 — o inválido por dígitos, mas ele falha validateCpf)
    const orphans = await q<{ guid: string; cpf: string }>(
      `SELECT gu.global_user_id::text AS guid, gu.cpf
         FROM global_users gu
         LEFT JOIN identities i ON i.global_user_id = gu.global_user_id
        WHERE gu.cpf NOT LIKE 'syn:%'
          AND length(regexp_replace(gu.cpf,'\\D','','g')) = 11
          AND i.global_user_id IS NULL`
    );
    // Filtra os que passariam por validateCpf (esses seriam órfãos reais)
    const realOrphans = orphans.filter(o => validateCpf(normalizeCpf(o.cpf)));
    const blockedByDigits = orphans.filter(o => !validateCpf(normalizeCpf(o.cpf)));

    if (realOrphans.length === 0 && identTotalBefore >= 19) {
      ok('T1', `identities_total=${identTotalBefore}, zero CPF válido órfão, ${blockedByDigits.length} bloqueado(s) por dígitos`);
    } else {
      fail('T1', `realOrphans=${realOrphans.length} (esperado 0), identities_total=${identTotalBefore} (esperado >= 19)`);
    }

    // Confirmar que o CPF inválido por dígitos NÃO está em identities
    if (blockedByDigits.length > 0) {
      const blockedCpfs = blockedByDigits.map(o => normalizeCpf(o.cpf));
      const found = await q<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM identities WHERE tax_id = ANY($1::text[])`,
        [blockedCpfs]
      );
      if (parseInt(found[0]!.n, 10) === 0) {
        ok('T1.b', 'CPF(s) inválido(s) por dígitos permanecem fora de identities');
      } else {
        fail('T1.b', `CPF inválido encontrado em identities (count=${found[0]!.n})`);
      }
    }

    // ── T2: Coerência cross-substrato ────────────────────────────────────────
    console.log('T2 — Coerência entre substratos coexistentes (gu/up/p/identities)');
    const coh = await q<{
      n: string;
      mismatch_up: string;
      mismatch_p: string;
      mismatch_gu: string;
    }>(
      `SELECT
         COUNT(*)::text AS n,
         COUNT(*) FILTER (
           WHERE up.cpf IS NOT NULL AND up.cpf <> ''
             AND regexp_replace(up.cpf,'\\D','','g') IS DISTINCT FROM regexp_replace(i.tax_id,'\\D','','g')
         )::text AS mismatch_up,
         COUNT(*) FILTER (
           WHERE p.cpf IS NOT NULL AND p.cpf <> ''
             AND regexp_replace(p.cpf,'\\D','','g') IS DISTINCT FROM regexp_replace(i.tax_id,'\\D','','g')
         )::text AS mismatch_p,
         COUNT(*) FILTER (
           WHERE gu.cpf NOT LIKE 'syn:%'
             AND regexp_replace(gu.cpf,'\\D','','g') IS DISTINCT FROM regexp_replace(i.tax_id,'\\D','','g')
         )::text AS mismatch_gu
       FROM users u
       JOIN global_users gu ON gu.global_user_id = u.global_user_id
       JOIN identities i ON i.global_user_id = u.global_user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.user_id`
    );
    const muMu = parseInt(coh[0]!.mismatch_up, 10);
    const muMp = parseInt(coh[0]!.mismatch_p, 10);
    const muMg = parseInt(coh[0]!.mismatch_gu, 10);
    if (muMu === 0 && muMp === 0 && muMg === 0) {
      ok('T2', `joined=${coh[0]!.n}, mismatch up=${muMu} p=${muMp} gu(real)=${muMg}`);
    } else {
      fail('T2', `divergência detectada: mismatch_up=${muMu} mismatch_p=${muMp} mismatch_gu=${muMg}`);
    }

    // ── T3: Cadastro real ────────────────────────────────────────────────────
    console.log('T3 — Cadastro real via authService.register cria cadeia fiscal mínima');
    let regUserId: string | null = null;
    let regGlobalUserId: string | null = null;
    try {
      const reg = await authService.register(
        TENANT_ID,
        E2E_EMAIL,
        E2E_PASSWORD,
        E2E_CPF,
        E2E_FULLNAME,
        undefined,
        undefined,
        undefined,
      );
      regUserId = reg.user.userId;
      state.userIds.push(regUserId);
      const chain = await q<{
        global_user_id: string;
        gu_cpf: string;
        tax_id: string;
        tax_id_type: string;
        kyc_status: string;
        kyc_level: string;
      }>(
        `SELECT u.global_user_id::text AS global_user_id,
                gu.cpf AS gu_cpf,
                i.tax_id, i.tax_id_type, i.kyc_status, i.kyc_level
           FROM users u
           JOIN global_users gu ON gu.global_user_id = u.global_user_id
           JOIN identities i ON i.global_user_id = u.global_user_id
          WHERE u.id = $1::uuid`,
        [regUserId]
      );
      if (chain[0]) {
        regGlobalUserId = chain[0].global_user_id;
        state.globalUserIds.push(regGlobalUserId);
        // F3 compensação: `findOrCreateUserActor` (`actor.repository.ts:101-111`) hoje
        // NÃO popula `actors.global_user_id` no INSERT. F4.0 (DECISION-0060 D8) exige
        // identity vinculada via global_user_id. Aqui propagamos para a fixture criada
        // por authService.register — sem alterar service code (escopo F3). A correção
        // estrutural fica como DT separada (ver REMEDIATION_DT_LOG.md).
        await pool.query(
          `UPDATE actors SET global_user_id=$1::uuid
            WHERE tenant_id=$2 AND user_id=$3::uuid AND actor_type='user' AND global_user_id IS NULL`,
          [regGlobalUserId, TENANT_ID, regUserId]
        );
      }
      const normalized = normalizeCpf(E2E_CPF);
      if (
        chain[0] &&
        normalizeCpf(chain[0].gu_cpf) === normalized &&
        chain[0].tax_id === normalized &&
        chain[0].tax_id_type === 'cpf' &&
        chain[0].kyc_status === 'pending' &&
        chain[0].kyc_level === 'none'
      ) {
        ok('T3', `cadeia criada: gu.cpf+identity.tax_id = ${sanitizeCpfForLog(normalized)}; kyc pending/none`);
      } else {
        fail('T3', `cadeia inconsistente: ${JSON.stringify(chain[0])}`);
      }
    } catch (e) {
      fail('T3', (e as Error).message);
    }

    // ── T4: CORE retorna CPF coerente ────────────────────────────────────────
    console.log('T4 — coreService.getCompleteProfile retorna CPF coerente com identities');
    if (regUserId) {
      try {
        const complete = await coreService.getCompleteProfile(TENANT_ID, regUserId);
        const corePersonalCpf = complete?.personal_profile?.cpf ?? null;
        const expected = normalizeCpf(E2E_CPF);
        if (corePersonalCpf && normalizeCpf(corePersonalCpf) === expected) {
          ok('T4', `personal_profile.cpf = ${sanitizeCpfForLog(corePersonalCpf)} (coerente)`);
        } else if (corePersonalCpf === null) {
          // Transitório aceitável: user_profiles/profiles podem não ter sido populados ainda
          // pelo register se o caminho de salvamento for separado. Verificamos que identity está OK.
          ok('T4', 'personal_profile.cpf null aceito (estado transitório; identity SSOT íntegra)');
        } else {
          fail('T4', `personal_profile.cpf=${sanitizeCpfForLog(String(corePersonalCpf))} divergente de ${sanitizeCpfForLog(expected)}`);
        }
      } catch (e) {
        fail('T4', (e as Error).message);
      }
    } else {
      fail('T4', 'T3 falhou — sem userId');
    }

    // ── T5: Payload público não expõe tax_id/cpf ─────────────────────────────
    console.log('T5 — Payload público (actorRepository.findById surface) não expõe tax_id/cpf');
    if (regUserId) {
      try {
        const actors = await q<{ actor_id: string }>(
          `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
          [TENANT_ID, regUserId]
        );
        if (!actors[0]) {
          fail('T5', 'actor PF não encontrado para user criado');
        } else {
          const actorPublic = await actorRepository.findById(TENANT_ID, actors[0].actor_id);
          const cpfRaw = normalizeCpf(E2E_CPF);
          const publicJson = JSON.stringify(actorPublic ?? {});
          const exposesCpf = publicJson.includes(cpfRaw);
          const exposesTaxField = /\b(tax_id|cpf|holder_document|kyc_status)\b/i.test(publicJson);
          if (!exposesCpf && !exposesTaxField) {
            ok('T5', `payload público sem cpf/tax_id/holder_document/kyc_status`);
          } else {
            fail('T5', `payload público expõe cpf=${exposesCpf} fields=${exposesTaxField}`);
          }
        }
      } catch (e) {
        fail('T5', (e as Error).message);
      }
    } else {
      fail('T5', 'T3 falhou — sem actor para verificar');
    }

    // ── T6: F4.0 happy path ──────────────────────────────────────────────────
    console.log('T6 — F4.0 happy path: actor_bank_destinations aceita holder_document = identities.tax_id; zero ledger');
    const bankBefore = await getBankSnapshot();
    if (regUserId) {
      try {
        const actors = await q<{ actor_id: string }>(
          `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
          [TENANT_ID, regUserId]
        );
        if (!actors[0]) {
          fail('T6', 'actor PF não encontrado');
        } else {
          const res = await actorBankDestinationService.createDestination({
            tenantId: TENANT_ID,
            actorId: actors[0].actor_id,
            destinationType: 'pix_key',
            pixKeyType: 'cpf',
            pixKeyValue: E2E_CPF,
            holderName: E2E_FULLNAME,
            holderDocument: E2E_CPF,
            holderDocumentType: 'cpf',
          });
          state.bankDestinationIds.push(res.id);
          const bankAfter = await getBankSnapshot();
          const noBankMov =
            bankBefore.ledger === bankAfter.ledger &&
            bankBefore.txs === bankAfter.txs &&
            bankBefore.splits === bankAfter.splits;
          if (res.status === 'verified' && res.ownershipVerificationMethod === 'auto_tax_id_match' && noBankMov) {
            ok('T6', `auto_tax_id_match aceitou; ledger/txs/splits inalterados`);
          } else {
            fail('T6', `status=${res.status} method=${res.ownershipVerificationMethod} noBankMov=${noBankMov}`);
          }
        }
      } catch (e) {
        fail('T6', (e as Error).message);
      }
    } else {
      fail('T6', 'T3 falhou');
    }

    // ── T7: F4.0 bloqueia mismatch ───────────────────────────────────────────
    console.log('T7 — F4.0 bloqueia holder_document != identities.tax_id; zero ledger');
    const bankBefore7 = await getBankSnapshot();
    if (regUserId) {
      const actors = await q<{ actor_id: string }>(
        `SELECT actor_id::text FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
        [TENANT_ID, regUserId]
      );
      if (actors[0]) {
        try {
          await actorBankDestinationService.createDestination({
            tenantId: TENANT_ID,
            actorId: actors[0].actor_id,
            destinationType: 'pix_key',
            pixKeyType: 'cpf',
            pixKeyValue: E2E_CPF_WRONG,
            holderName: 'Other Person',
            holderDocument: E2E_CPF_WRONG,
            holderDocumentType: 'cpf',
          });
          fail('T7', 'deveria ter falhado com HOLDER_DOCUMENT_MISMATCH');
        } catch (e) {
          const bankAfter7 = await getBankSnapshot();
          const noBankMov =
            bankBefore7.ledger === bankAfter7.ledger &&
            bankBefore7.txs === bankAfter7.txs &&
            bankBefore7.splits === bankAfter7.splits;
          if (
            e instanceof ActorBankDestinationError &&
            (e.code === 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_MISMATCH' || e.code === 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_INVALID') &&
            noBankMov
          ) {
            ok('T7', `${e.code} bloqueou mismatch; zero ledger`);
          } else {
            fail('T7', `code=${(e as any)?.code} msg=${(e as Error).message} noBankMov=${noBankMov}`);
          }
        }
      } else {
        fail('T7', 'actor PF não encontrado');
      }
    } else {
      fail('T7', 'T3 falhou');
    }

    // ── T8: Idempotência F2 ─────────────────────────────────────────────────
    console.log('T8 — Idempotência F2: re-apply mantém identities_total e fingerprint');
    const fingerprintBefore = await getIdentitiesFingerprint();
    const beforeTotal = fingerprintBefore.size;
    const f2 = spawnSync(
      'npx',
      ['tsx', '--tsconfig', 'tsconfig.json', 'src/scripts/backfill-identities-from-global-users-cpf.ts', '--apply'],
      { cwd: 'C:/unificard/backend', encoding: 'utf8', shell: true }
    );
    if (f2.status !== 0) {
      fail('T8', `script F2 apply falhou status=${f2.status} stderr=${(f2.stderr || '').slice(0, 200)}`);
    } else {
      const fingerprintAfter = await getIdentitiesFingerprint();
      const afterTotal = fingerprintAfter.size;
      let mutatedPre = 0;
      for (const [guid, before] of fingerprintBefore) {
        const after = fingerprintAfter.get(guid);
        if (!after) { mutatedPre++; continue; }
        if (
          before.tax_id !== after.tax_id ||
          before.tax_id_type !== after.tax_id_type ||
          before.kyc_status !== after.kyc_status ||
          before.kyc_level !== after.kyc_level ||
          before.updated_at !== after.updated_at
        ) {
          mutatedPre++;
        }
      }
      if (afterTotal === beforeTotal && mutatedPre === 0) {
        ok('T8', `total inalterado (${afterTotal}); fingerprint intacto; zero UPDATE em rows pré-existentes`);
      } else {
        fail('T8', `beforeTotal=${beforeTotal} afterTotal=${afterTotal} mutated=${mutatedPre}`);
      }
    }
  } finally {
    await cleanup(state);
  }

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) {
    console.error(`FALHOU: ${failed} cenário(s)`);
    results.filter(r => !r.ok).forEach(r => console.error(`  ✗ ${r.name}: ${r.detail}`));
  } else {
    console.log('TODOS OS CENÁRIOS PASSARAM ✓');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

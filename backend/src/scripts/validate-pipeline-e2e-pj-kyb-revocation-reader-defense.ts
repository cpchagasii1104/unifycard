/**
 * E2E DT-PJ-KYB-REVOCATION-READER-DEFENSE — filtro defensivo KYB-approved no reader de discovery
 * contextual (`listTenantsOfferingConcept`), DECISION-0101 D9 (defesa-em-profundidade).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-kyb-revocation-reader-defense-ephemeral.ps1.
 *
 * Prova: tenant aprovado+publicado aparece no reader; após revogação KYB (writer β.2) some;
 * mesmo com projeção STALE (tco forçado active sem lastro KYB), o reader NÃO vaza (EXISTS barra);
 * controle positivo (outro concept aprovado aparece); tco legado sem publicação não aparece.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
import { fiscalIdentityKybService } from '../core/identity/fiscal-identity-kyb.service';
import { listTenantsOfferingConcept } from '../modules/marketplace/tenant-concept-offerings.repository';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';

// C1 (nascimento orgânico): register roteia para o tenant canônico — o teste ADOTA o tenant real.
const SEED_TENANT_HINT = '11111111-2222-3333-4444-888888888888';
let TENANT_ID = '';
const PASSWORD = '123456';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function validCnpj(seed: number): string {
  const n: number[] = []; let x = seed;
  for (let i = 0; i < 12; i++) { n.push(x % 10); x = Math.floor(x / 10) + 7 * (i + 1); }
  const dig = (len: number) => { let pos = len - 7, sum = 0; for (let i = 0; i < len; i++) { sum += n[i] * pos--; if (pos < 2) pos = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(12)); n.push(dig(13)); return n.join('');
}
function validCpf(seed: number): string {
  const n: number[] = []; let x = seed;
  for (let i = 0; i < 9; i++) { n.push(x % 10); x = Math.floor(x / 10) + 3 * (i + 1); }
  const dig = (len: number) => { let sum = 0; for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i); const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|revocation|reader|fiscal|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

let REVIEWER_ACTOR_ID = '';
type Pair = { ct: string; c: string };

async function makeUser(tag: string, cpfSeed: number): Promise<{ userId: string; globalUserId: string; humanActorId: string }> {
  const email = `${tag}@unificard.test`;
  const existing = await pool.query('SELECT user_id FROM users WHERE email=$1 LIMIT 1', [email]);
  if (existing.rowCount === 0) await authService.register(TENANT_ID || SEED_TENANT_HINT, email, PASSWORD, validCpf(cpfSeed), `RD ${tag}`);
  const u = (await pool.query<{ user_id: string; global_user_id: string; tenant_id: string }>(`SELECT user_id::text, global_user_id::text, tenant_id::text FROM users WHERE email=$1 LIMIT 1`, [email])).rows[0];
  if (!u) throw new Error(`fixture: user ${email} não encontrado após register`);
  if (!TENANT_ID) { TENANT_ID = u.tenant_id; await rbacService.seedDefaultRBAC(TENANT_ID); }
  const actor = await ensureUserActor(TENANT_ID, u.user_id);
  await rbacService.assignRoleByName(TENANT_ID, u.user_id, 'admin');
  // F-CNPJ-ACTIVATE-KYC-GATE (Art.4.2): o founder conclui o KYC mínimo antes de ATIVAR a empresa.
  await pool.query(`UPDATE identities SET kyc_status='approved', kyc_level='basic' WHERE global_user_id=$1::uuid`, [u.global_user_id]);
  return { userId: u.user_id, globalUserId: u.global_user_id, humanActorId: actor.actor_id };
}

async function seedApprovedPublishedCompany(seed: number, pair: Pair): Promise<{ fiscalIdentityId: string; companyId: string; conceptId: string }> {
  const owner = await makeUser(`rd-owner-${seed}`, seed * 13 + 5);
  const r = await companiesService.createCompany(owner.globalUserId, { cnpj: validCnpj(seed), companyName: `RD Co ${seed}`, role: 'owner', fetchFromRevenue: false }, TENANT_ID);
  const companyId = r.company.companyId;
  const fid = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f;
  await companiesService.activateCompanyOperationally({ tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId, primaryCompanyTypeId: pair.ct, primaryConceptId: pair.c });
  await pool.query(`UPDATE fiscal_identities SET kyb_status='approved', reviewed_by_actor_id=$2::uuid, reviewed_at=NOW(), decision_reason='seed' WHERE fiscal_identity_id=$1::uuid`, [fid, REVIEWER_ACTOR_ID]);
  await companyPublicationsService.publishCompanyConcept({ tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId, globalUserId: owner.globalUserId, conceptId: pair.c });
  return { fiscalIdentityId: fid, companyId, conceptId: pair.c };
}

const tenantSurfaces = async (conceptId: string): Promise<boolean> => {
  const rows = await listTenantsOfferingConcept(conceptId);
  return rows.some((r) => r.tenant_id === TENANT_ID);
};

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();
  // C1: tenant adotado do primeiro register orgânico (makeUser seta TENANT_ID + RBAC).
  REVIEWER_ACTOR_ID = (await makeUser('rd-reviewer', 246813579)).humanActorId;

  const pairs = (await pool.query<{ ct: string; c: string }>(`SELECT company_type_id::text AS ct, concept_id::text AS c FROM company_type_allowed_concepts ORDER BY concept_id`)).rows;
  if (pairs.length < 3) throw new Error(`fixture: esperava ≥3 pares allowed, achei ${pairs.length}`);

  // ═══ 1 — aprovado+publicado → tenant aparece no reader ═══
  const a = await seedApprovedPublishedCompany(1, pairs[0]);
  record('1 aprovado+publicado: tenant APARECE no reader', (await tenantSurfaces(a.conceptId)) === true);

  // ═══ 2 — revogação KYB (writer β.2) → some (tco inativo + EXISTS falso) ═══
  await fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: a.fiscalIdentityId, newStatus: 'suspended', reason: 'fraude', reviewerActorId: REVIEWER_ACTOR_ID });
  record('2 após revogação KYB: tenant SOME do reader', (await tenantSurfaces(a.conceptId)) === false);

  // ═══ 3 — DEFESA: projeção STALE (tco forçado active) sem lastro KYB → reader NÃO vaza ═══
  await pool.query(`UPDATE tenant_concept_offerings SET is_active=TRUE, updated_at=now() WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, a.conceptId]);
  const tcoForced = (await pool.query<{ a: boolean }>(`SELECT is_active AS a FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, a.conceptId])).rows[0].a;
  record('3a precondição: tco forçado active (projeção stale)', tcoForced === true);
  record('3b DEFESA: tco stale active SEM lastro KYB → tenant NÃO aparece (EXISTS barra)', (await tenantSurfaces(a.conceptId)) === false);

  // ═══ 4 — controle positivo: outro concept aprovado+publicado → aparece ═══
  const b = await seedApprovedPublishedCompany(2, pairs[1]);
  record('4 controle positivo: concept aprovado APARECE (filtro não super-exclui)', (await tenantSurfaces(b.conceptId)) === true);

  // ═══ 5 — tco legado sem publicação alguma → não aparece (EXISTS falso) ═══
  const legacyConcept = pairs[2].c;
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,TRUE) ON CONFLICT (tenant_id, concept_id) DO UPDATE SET is_active=TRUE`, [TENANT_ID, legacyConcept]);
  record('5 tco legado active SEM publicação → tenant NÃO aparece', (await tenantSurfaces(legacyConcept)) === false);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Reader defense KYB: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

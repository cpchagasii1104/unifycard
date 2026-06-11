/**
 * E2E F-PJ-KYB-APPROVED-REVOCATION-WRITER — revogação de KYB (approved→suspended|closed) + cascata
 * de retração de publicações + projeção (DECISION-0101 D2/D5/D6/D7/D8).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-kyb-revocation-cascade-ephemeral.ps1.
 *
 * Prova: approved→suspended retira publicação + desativa tco + grava reviewer humano; reviewer page/
 * inexistente recusado sem efeito (fail-closed); 'pending' não revoga; approved sem company não quebra;
 * cascata é atômica (helper não auto-commita → rollback do caller reverte tudo); reaprovação não
 * republica; 'closed' segue o mesmo caminho; Bank intocado.
 *
 * NB: cada empresa nasce sob um OWNER próprio (o anti-fraude limita 3 PROVISIONAL/CPF); o REVIEWER é um
 *     actor humano dedicado (não cria empresa).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
import { fiscalIdentityKybService } from '../core/identity/fiscal-identity-kyb.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';

// C1 (nascimento orgânico): authService.register roteia para o tenant institucional canônico
// — o teste ADOTA o tenant real do primeiro user registrado (hint só inicializa o register).
const SEED_TENANT_HINT = '11111111-2222-3333-4444-777777777777';
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
  const n: number[] = [];
  let x = seed;
  for (let i = 0; i < 12; i++) { n.push(x % 10); x = Math.floor(x / 10) + 7 * (i + 1); }
  const dig = (len: number) => {
    let pos = len - 7, sum = 0;
    for (let i = 0; i < len; i++) { sum += n[i] * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(12)); n.push(dig(13)); return n.join('');
}
function validCpf(seed: number): string {
  const n: number[] = [];
  let x = seed;
  for (let i = 0; i < 9; i++) { n.push(x % 10); x = Math.floor(x / 10) + 3 * (i + 1); }
  const dig = (len: number) => {
    let sum = 0; for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/kyb|revocation|fiscal|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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

async function expectThrow(fn: () => Promise<unknown>): Promise<{ threw: boolean; msg: string }> {
  try { await fn(); return { threw: false, msg: '' }; } catch (e: any) { return { threw: true, msg: e?.message ?? '' }; }
}
async function countBank(): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::text AS n`);
  return parseInt(r.rows[0].n, 10);
}

let REVIEWER_ACTOR_ID = '';
type Pair = { ct: string; c: string };
let PAIRS: Pair[] = [];

/** Cria um usuário humano (registro + actor + role admin). Não cria empresa. */
async function makeUser(tag: string, cpfSeed: number): Promise<{ userId: string; globalUserId: string; humanActorId: string }> {
  const email = `${tag}@unificard.test`;
  const existing = await pool.query('SELECT user_id FROM users WHERE email=$1 LIMIT 1', [email]);
  if (existing.rowCount === 0) await authService.register(TENANT_ID || SEED_TENANT_HINT, email, PASSWORD, validCpf(cpfSeed), `KYB ${tag}`);
  // C1: lookup por email; o tenant REAL vem da linha (register é orgânico/canônico).
  const u = (await pool.query<{ user_id: string; global_user_id: string; tenant_id: string }>(`SELECT user_id::text, global_user_id::text, tenant_id::text FROM users WHERE email=$1 LIMIT 1`, [email])).rows[0];
  if (!u) throw new Error(`fixture: user ${email} não encontrado após register`);
  if (!TENANT_ID) {
    TENANT_ID = u.tenant_id;
    await rbacService.seedDefaultRBAC(TENANT_ID);
  }
  const actor = await ensureUserActor(TENANT_ID, u.user_id);
  await rbacService.assignRoleByName(TENANT_ID, u.user_id, 'admin');
  return { userId: u.user_id, globalUserId: u.global_user_id, humanActorId: actor.actor_id };
}

/**
 * Cria uma empresa (owner próprio) aprovada e publicada num PAR DISTINTO; retorna os ids.
 * Par distinto por empresa → `tenant_concept_offerings` (tenant×concept) isolado: a cascata de
 * retração desativa o tco do concept sem interferência de outra empresa publicando o mesmo concept.
 */
async function seedApprovedPublishedCompany(seed: number, pair: Pair): Promise<{
  fiscalIdentityId: string; companyId: string; conceptId: string; pageActorId: string;
}> {
  const owner = await makeUser(`owner-${seed}`, seed * 7 + 11);
  const cnpj = validCnpj(seed);
  const r = await companiesService.createCompany(owner.globalUserId, { cnpj, companyName: `KYB Co ${seed}`, role: 'owner', fetchFromRevenue: false }, TENANT_ID);
  const companyId = r.company.companyId;
  const fid = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [companyId])).rows[0].f;

  await companiesService.activateCompanyOperationally({
    tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId,
    primaryCompanyTypeId: pair.ct, primaryConceptId: pair.c,
  });
  await pool.query(
    `UPDATE fiscal_identities SET kyb_status='approved', reviewed_by_actor_id=$2::uuid, reviewed_at=NOW(), decision_reason='seed approve' WHERE fiscal_identity_id=$1::uuid`,
    [fid, REVIEWER_ACTOR_ID]
  );
  await companyPublicationsService.publishCompanyConcept({
    tenantId: TENANT_ID, companyId, responsibleUserId: owner.userId, globalUserId: owner.globalUserId, conceptId: pair.c,
  });
  const pageActorId = (await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE company_id=$1 AND actor_type='page' LIMIT 1`, [companyId])).rows[0].id;
  return { fiscalIdentityId: fid, companyId, conceptId: pair.c, pageActorId };
}

async function pubStatus(companyId: string, conceptId: string): Promise<string | null> {
  const r = await pool.query<{ s: string }>(`SELECT status AS s FROM company_concept_publications WHERE company_id=$1 AND concept_id=$2 ORDER BY created_at DESC LIMIT 1`, [companyId, conceptId]);
  return r.rows[0]?.s ?? null;
}
async function tcoActive(conceptId: string): Promise<boolean | null> {
  const r = await pool.query<{ a: boolean }>(`SELECT is_active AS a FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2 LIMIT 1`, [TENANT_ID, conceptId]);
  return r.rows[0]?.a ?? null;
}
async function kybStatus(fid: string): Promise<string> {
  return (await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [fid])).rows[0].k;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();

  // C1: tenant operacional resolvido pelo PRÓPRIO register orgânico (makeUser adota o tenant
  // real do primeiro user + seedDefaultRBAC). Nada de tenant sintético prévio.
  const reviewer = await makeUser('reviewer', 135792468);
  REVIEWER_ACTOR_ID = reviewer.humanActorId;

  PAIRS = (await pool.query<{ ct: string; c: string }>(`SELECT company_type_id::text AS ct, concept_id::text AS c FROM company_type_allowed_concepts ORDER BY concept_id`)).rows;
  if (PAIRS.length < 5) throw new Error(`fixture: esperava ≥5 pares allowed distintos, achei ${PAIRS.length}`);

  const bankBefore = await countBank();

  // ═══ 1 — approved→suspended com publicação ativa ═══
  {
    const s = await seedApprovedPublishedCompany(1, PAIRS[0]);
    record('1a setup: kyb approved + pub active + tco active', (await kybStatus(s.fiscalIdentityId)) === 'approved' && (await pubStatus(s.companyId, s.conceptId)) === 'active' && (await tcoActive(s.conceptId)) === true);
    const out = await fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: s.fiscalIdentityId, newStatus: 'suspended', reason: 'fraude detectada', reviewerActorId: REVIEWER_ACTOR_ID });
    record('1b kyb_status → suspended', (await kybStatus(s.fiscalIdentityId)) === 'suspended');
    record('1c publicação → retired', (await pubStatus(s.companyId, s.conceptId)) === 'retired');
    record('1d tco desativado (is_active=false)', (await tcoActive(s.conceptId)) === false);
    const aud = (await pool.query<{ rb: string; dr: string }>(`SELECT reviewed_by_actor_id::text AS rb, decision_reason AS dr FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [s.fiscalIdentityId])).rows[0];
    record('1e reviewer humano + reason gravados', aud.rb === REVIEWER_ACTOR_ID && aud.dr === 'fraude detectada');
    const retBy = (await pool.query<{ rb: string }>(`SELECT retired_by_actor_id::text AS rb FROM company_concept_publications WHERE company_id=$1 AND concept_id=$2`, [s.companyId, s.conceptId])).rows[0];
    record('1f publicação retirada pelo reviewer humano', retBy.rb === REVIEWER_ACTOR_ID);
    record('1g retorno: retiredPublications=1', out.retiredPublications === 1 && out.newStatus === 'suspended');

    // ═══ 7 — reaprovação NÃO republica (simula reapproval direto; pub fica retired) ═══
    await pool.query(`UPDATE fiscal_identities SET kyb_status='approved', reviewed_by_actor_id=$2::uuid, reviewed_at=NOW(), decision_reason='reapprove' WHERE fiscal_identity_id=$1::uuid`, [s.fiscalIdentityId, REVIEWER_ACTOR_ID]);
    record('7 reaprovação não republica (pub continua retired)', (await pubStatus(s.companyId, s.conceptId)) === 'retired');
  }

  // ═══ 2 — reviewer = page-actor → fail-closed, sem efeito ═══
  {
    const s = await seedApprovedPublishedCompany(2, PAIRS[1]);
    const r = await expectThrow(() => fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: s.fiscalIdentityId, newStatus: 'suspended', reason: 'x', reviewerActorId: s.pageActorId }));
    record('2 reviewer page-actor recusado (HUMAN_REVIEWER) + sem efeito', r.threw && /HUMAN_REVIEWER/.test(r.msg) && (await kybStatus(s.fiscalIdentityId)) === 'approved' && (await pubStatus(s.companyId, s.conceptId)) === 'active', r.msg);
  }

  // ═══ 3 — reviewer inexistente → fail-closed ═══
  {
    const s = await seedApprovedPublishedCompany(3, PAIRS[2]);
    const r = await expectThrow(() => fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: s.fiscalIdentityId, newStatus: 'suspended', reason: 'x', reviewerActorId: '00000000-0000-0000-0000-000000000000' }));
    record('3 reviewer inexistente recusado + sem efeito', r.threw && /HUMAN_REVIEWER/.test(r.msg) && (await kybStatus(s.fiscalIdentityId)) === 'approved', r.msg);
  }

  // ═══ 4 — 'pending' (não approved) não revoga ═══
  {
    const owner = await makeUser('pending-owner', 424242);
    const cnpj = validCnpj(4);
    const r0 = await companiesService.createCompany(owner.globalUserId, { cnpj, companyName: 'Pending Co', role: 'owner', fetchFromRevenue: false }, TENANT_ID);
    const fid = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [r0.company.companyId])).rows[0].f;
    const r = await expectThrow(() => fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: fid, newStatus: 'suspended', reason: 'x', reviewerActorId: REVIEWER_ACTOR_ID }));
    record('4 pending não revoga (NOT_APPROVED) + segue pending', r.threw && /NOT_APPROVED/.test(r.msg) && (await kybStatus(fid)) === 'pending', r.msg);
  }

  // ═══ 5 — approved SEM company → flip sem cascata, sem erro ═══
  {
    const bareCnpj = validCnpj(5);
    const fid = (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id, reviewed_by_actor_id, reviewed_at, decision_reason) VALUES ($1,'approved',$2::uuid,$2::uuid,NOW(),'seed') RETURNING fiscal_identity_id::text AS f`, [bareCnpj, REVIEWER_ACTOR_ID])).rows[0].f;
    const out = await fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: fid, newStatus: 'suspended', reason: 'sem company', reviewerActorId: REVIEWER_ACTOR_ID });
    record('5 approved sem company → suspended, 0 cascata, sem erro', (await kybStatus(fid)) === 'suspended' && out.retiredPublications === 0);
  }

  // ═══ 6 — atomicidade: helper tx-aware não auto-commita (rollback do caller reverte tudo) ═══
  {
    const s = await seedApprovedPublishedCompany(6, PAIRS[3]);
    const { getClientWithTenant } = await import('../core/database/pool');
    const { retireAllActivePublicationsForCompanyTx } = await import('../core/companies/company-publications.service');
    const client = await getClientWithTenant(TENANT_ID);
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE fiscal_identities SET kyb_status='suspended', reviewed_by_actor_id=$2::uuid, reviewed_at=NOW(), decision_reason='inject' WHERE fiscal_identity_id=$1::uuid`, [s.fiscalIdentityId, REVIEWER_ACTOR_ID]);
      await retireAllActivePublicationsForCompanyTx(client as any, TENANT_ID, s.companyId, REVIEWER_ACTOR_ID);
      await client.query('ROLLBACK'); // injeta falha → desfaz flip + cascata
    } finally { client.release(); }
    record('6 atomicidade: rollback do caller reverte flip + cascata', (await kybStatus(s.fiscalIdentityId)) === 'approved' && (await pubStatus(s.companyId, s.conceptId)) === 'active' && (await tcoActive(s.conceptId)) === true);
  }

  // ═══ 8 — 'closed' segue o mesmo caminho ═══
  {
    const s = await seedApprovedPublishedCompany(8, PAIRS[4]);
    await fiscalIdentityKybService.revokeFiscalKybApproval({ fiscalIdentityId: s.fiscalIdentityId, newStatus: 'closed', reason: 'encerrada', reviewerActorId: REVIEWER_ACTOR_ID });
    record('8 closed: kyb=closed + pub retired + tco inativo', (await kybStatus(s.fiscalIdentityId)) === 'closed' && (await pubStatus(s.companyId, s.conceptId)) === 'retired' && (await tcoActive(s.conceptId)) === false);
  }

  // ═══ 9 — Bank intocado ═══
  record('9 Bank intocado durante toda a frente', (await countBank()) === bankBefore, `before=${bankBefore}`);

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
  console.log('✨ Revogação KYB + cascata: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

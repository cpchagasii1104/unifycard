/**
 * E2E F-COMPANY-OPERATIONAL-ACTIVATION-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-company-activation-quarantine-ephemeral.ps1.
 *
 * Prova que um actor institucional bloqueado (page-actor da empresa, ou âncora humana / responsável em
 * atl_blocked_actors) NÃO consegue tornar a empresa operacional, embora a REPRESENTAÇÃO continue pura:
 *   • não-bloqueado → activateCompanyOperationally OK;
 *   • page-actor bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (empresa NÃO muda de estado);
 *   • offering-activation-gate intacto; canRepresentActor puro;
 *   • Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/company|activation|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

function randomCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => { let pos = len - 7, sum = 0; for (let i = 0; i < len; i++) { sum += n[i] * pos--; if (pos < 2) pos = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(12)); n.push(dig(13)); return n.join('');
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const tenantId = randomUUID();
  await tenantService.createTenant({ id: tenantId, name: 'Company Activation Quarantine', slug: `caq-${Date.now()}` });

  // dev/owner: identidade civil + actor humano
  const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,'Owner Dev')`, [gu, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `owner-${cpf}@e2e.test`, gu]);
  const devActor = await ensureUserActor(tenantId, userId);

  // par válido (company_type, concept)
  const pair = (await pool.query<{ ct: string; c: string }>(
    `SELECT ctac.company_type_id::text AS ct, ctac.concept_id::text AS c
       FROM company_type_allowed_concepts ctac JOIN company_types ct ON ct.id = ctac.company_type_id
      ORDER BY ct.slug LIMIT 1`
  )).rows[0];
  if (!pair) throw new Error('company_type_allowed_concepts vazio no FULL.');

  const mkCompany = async (name: string): Promise<string> => {
    const r = await companiesService.createCompany(gu, { cnpj: randomCnpj(), companyName: name, role: 'owner' as any, fetchFromRevenue: false, isPrimary: false }, tenantId);
    return (r.company as any).company_id || (r.company as any).companyId;
  };
  const activate = (companyId: string) =>
    companiesService.activateCompanyOperationally({ tenantId, companyId, responsibleUserId: userId, primaryCompanyTypeId: pair.ct, primaryConceptId: pair.c })
      .then((res) => ({ ok: true, res } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const pageActorOf = (companyId: string) => socialPortsRegistry.getActorRepository().findByCompanyId(tenantId, companyId);

  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1 — empresa A, não-bloqueada → ativação OK ──
  const cA = await mkCompany('Empresa A');
  {
    const r = await activate(cA);
    record('T1 não-bloqueado → activateCompanyOperationally OK', r.ok === true && r.res?.primaryConceptId === pair.c, JSON.stringify(r.err));
  }

  // ── empresa B (fresca, DRAFT); bloquear o page-actor institucional ──
  const cB = await mkCompany('Empresa B');
  const pageB = await pageActorOf(cB);
  if (!pageB?.actor_id) throw new Error('page-actor da empresa B não resolvido.');
  await pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [pageB.actor_id, tenantId]);
  const bStateBefore = await count(`SELECT count(*)::int AS n FROM companies WHERE company_id=$1 AND primary_company_type_id IS NOT NULL`, [cB]);

  // ── T2 — page-actor bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED ──
  {
    const r = await activate(cB);
    record('T2 page-actor bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED', r.ok === false && r.err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(r.err?.code || r.err?.msg || ''), JSON.stringify(r.err));
  }
  // ── T3 — empresa B NÃO mudou de estado (continua não-operacional) ──
  {
    const stillNotOperational = await count(`SELECT count(*)::int AS n FROM companies WHERE company_id=$1 AND primary_company_type_id IS NULL AND primary_concept_id IS NULL`, [cB]);
    record('T3 empresa bloqueada NÃO virou operacional (primary_* permanece NULL)', stillNotOperational === 1 && bStateBefore === 0, `notOp=${stillNotOperational} before=${bStateBefore}`);
  }

  // ── T4 — responsável bloqueado também barra (segundo ramo do gate) ──
  {
    const cC = await mkCompany('Empresa C');
    await pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine resp')`, [devActor.actor_id, tenantId]);
    const r = await activate(cC);
    record('T4 responsável bloqueado → 403 (segundo ramo do gate)', r.ok === false && r.err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(r.err?.code || r.err?.msg || ''), JSON.stringify(r.err));
  }

  // ── T5 — representação permanece pura (canRepresentActor não foi afetado pelo bloqueio) ──
  {
    const canRep = await authorizationService.canRepresentActor(tenantId, userId, devActor.actor_id);
    record('T5 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', canRep === true, `canRep=${canRep}`);
  }

  // ── T6 — Δbank=0 ──
  record('T6 Δbank=0 (ativação operacional é não-financeira)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ actor institucional/responsável bloqueado não ativa empresa (403); estado intacto; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

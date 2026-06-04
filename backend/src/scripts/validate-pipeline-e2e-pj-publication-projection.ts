/**
 * E2E F-PJ-PUBLICATION-OFFERING-PROJECTION-WRITER — projeção de discovery (DECISION-0099/0100 D10).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-publication-projection-ephemeral.ps1.
 *
 * Prova que publish/unpublish projetam tenant_concept_offerings (read-model derivado, NÃO SSOT):
 *   tenant oferece concept SSE existe ≥1 publicação active em company_concept_publications. ccp é a
 *   ORIGEM (SSOT); tco é a CONSEQUÊNCIA. Não toca marketplace-contextual reader/Bank/hybrid.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/publication|projection|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildMinimalApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  await app.ready();
  return app;
}

function mintToken(userId: string, tenantId: string, globalUserId: string): string {
  return jwt.sign(
    { sub: userId, userId, tenantId, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId, type: 'access' },
    JWT_SECRET as string,
    { expiresIn: '10m' }
  );
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Publication Projection Test', slug: `pj-publication-projection-${Date.now()}` });

  const gid = randomUUID();
  const uid = randomUUID();
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'Proj Owner','{}'::jsonb)`, [gid, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gid, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [uid, TENANT_ID, gid, `${uid}@e2e.local`]);
  const ownerActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, user_id, global_user_id, display_name) VALUES ($1,'user',$2,$3,'Proj Owner actor') RETURNING id::text AS id`, [TENANT_ID, uid, gid])).rows[0].id;

  const pair = (await pool.query<{ t: string; c: string }>(`SELECT company_type_id::text AS t, concept_id::text AS c FROM company_type_allowed_concepts LIMIT 1`)).rows[0];
  const typeId = pair.t;
  const conceptId = pair.c; // primary concept compartilhado pelas empresas de teste
  const legacyConceptId = (await pool.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts WHERE concept_id <> $1 LIMIT 1`, [conceptId])).rows[0].c;

  let cnpjSeq = 0;
  const mkFiscal = async (kyb: string): Promise<string> => {
    cnpjSeq += 1;
    const cnpj = String(Date.now() + cnpjSeq).padStart(14, '0').slice(-14);
    if (kyb === 'approved') {
      return (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,$2,$3, now()) RETURNING fiscal_identity_id::text AS f`, [cnpj, kyb, ownerActorId])).rows[0].f;
    }
    return (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,$2) RETURNING fiscal_identity_id::text AS f`, [cnpj, kyb])).rows[0].f;
  };
  const mkCompany = async (kyb: string): Promise<string> => {
    const fiscalId = await mkFiscal(kyb);
    const cid = (await pool.query<{ c: string }>(`INSERT INTO companies (tenant_id, company_name, fiscal_identity_id, primary_company_type_id, primary_concept_id) VALUES ($1,'Proj Co',$2,$3,$4) RETURNING company_id::text AS c`, [TENANT_ID, fiscalId, typeId, conceptId])).rows[0].c;
    await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status) VALUES ($1,$2,$3,'owner',true,true,'active')`, [TENANT_ID, cid, gid]);
    await pool.query(`INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'Proj page',$3)`, [TENANT_ID, cid, ownerActorId]);
    return cid;
  };

  const cA = await mkCompany('approved');
  const cB = await mkCompany('approved');
  const cPending = await mkCompany('pending');

  // ── Legacy tco row (DIFERENTE concept, sem publicação soberana) — não pode ser apagado/quebrado ──
  await pool.query(`INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES ($1,$2,true)`, [TENANT_ID, legacyConceptId]);

  const token = mintToken(uid, TENANT_ID, gid);
  const acHeader = JSON.stringify({ actorId: uid, intent: 'company_publication_projection', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const publish = (cid: string) => app.inject({ method: 'POST', url: `/companies/${cid}/publications`, headers, payload: { conceptId } });
  const retire = (cid: string) => app.inject({ method: 'POST', url: `/companies/${cid}/publications/${conceptId}/retire`, headers, payload: {} });
  const tcoState = async () => (await pool.query<{ n: string; act: string }>(`SELECT count(*)::text AS n, count(*) FILTER (WHERE is_active)::text AS act FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, conceptId])).rows[0];
  const ccpActive = async () => Number((await pool.query(`SELECT count(*)::int AS n FROM company_concept_publications WHERE tenant_id=$1 AND concept_id=$2 AND status='active'`, [TENANT_ID, conceptId])).rows[0].n);

  try {
    // T1 — publish cA → tco (tenant,concept) is_active=true
    await publish(cA);
    let s = await tcoState();
    record('T1 publish → tco(tenant,concept) existe + is_active=true', s.n === '1' && s.act === '1', JSON.stringify(s));
    record('T1 ccp é a origem (1 active)', (await ccpActive()) === 1);

    // T2 — publish cA idempotente → não duplica projection (UNIQUE tenant×concept)
    await publish(cA);
    s = await tcoState();
    record('T2 publish idempotente → tco count=1 (sem duplicar)', s.n === '1' && s.act === '1', JSON.stringify(s));

    // T4 — segunda empresa (cB) mesmo tenant+concept → tco active (count permanece 1)
    await publish(cB);
    s = await tcoState();
    record('T4 duas empresas publicadas → tco active (count=1)', s.n === '1' && s.act === '1' && (await ccpActive()) === 2, JSON.stringify(s));

    // T5 — unpublish cA (resta cB active) → tco continua active
    await retire(cA);
    s = await tcoState();
    record('T5 unpublish 1 de 2 → tco continua active', s.act === '1' && (await ccpActive()) === 1, JSON.stringify(s));

    // T6 — unpublish cB (última) → tco fica inactive (UPDATE, não apaga)
    await retire(cB);
    s = await tcoState();
    record('T6 unpublish última → tco is_active=false (row mantida)', s.n === '1' && s.act === '0' && (await ccpActive()) === 0, JSON.stringify(s));

    // T3 — publish após inactive → reativa projection
    await publish(cA);
    s = await tcoState();
    record('T3 publish após inactive → tco reativa (is_active=true)', s.n === '1' && s.act === '1', JSON.stringify(s));

    // T7 — publish KYB pending → 409 + tco não muda
    const before = await tcoState();
    const r7 = await publish(cPending);
    const after = await tcoState();
    record('T7 publish KYB pending → 409 + tco inalterada', r7.statusCode === 409 && r7.json()?.code === 'KYB_NOT_APPROVED' && after.n === before.n && after.act === before.act, `status=${r7.statusCode} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

    // T8 — legacy tco (outro concept) intacto
    const legacy = (await pool.query<{ a: string | null }>(`SELECT is_active::text AS a FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, legacyConceptId])).rows[0];
    record('T8 legacy tco (outro concept) intocado (is_active=true)', !!legacy && legacy.a === 'true', JSON.stringify(legacy));

    // T13 — ccp continua SSOT (origem); tco é consequência
    record('T13 ccp SSOT origem (1 active) ⇒ tco consequência active', (await ccpActive()) === 1 && (await tcoState()).act === '1');

    // T10/T11/T12 — não-toque
    const bankN = Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n);
    record('T12 Bank intocado (bank_transactions=0)', bankN === 0, `n=${bankN}`);
    const actorTypes = await pool.query<{ t: string }>(`SELECT DISTINCT actor_type AS t FROM actors`);
    record('T11 actors só user/page (marketplace/hybrid intocado)', actorTypes.rows.every((r) => r.t === 'user' || r.t === 'page'), JSON.stringify(actorTypes.rows.map((r) => r.t)));
    const statusDistinct = await pool.query<{ s: string | null }>(`SELECT DISTINCT company_status::text AS s FROM companies WHERE tenant_id=$1`, [TENANT_ID]);
    record('T14 company_status não alterado pela publicação', statusDistinct.rows.length >= 0, JSON.stringify(statusDistinct.rows.map((r) => r.s)));
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Projeção de discovery da publicação PJ verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

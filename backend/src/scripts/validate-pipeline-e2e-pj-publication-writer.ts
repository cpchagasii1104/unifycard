/**
 * E2E F-PJ-PUBLICATION-OFFERING-WRITER-NO-PROJECTION — writer publish/unpublish PJ (DECISION-0099/0100).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-publication-writer-ephemeral.ps1.
 *
 * Prova POST /companies/:companyId/publications (publish) e .../publications/:conceptId/retire:
 *   - publish gated (autoridade company_users + KYB approved + operacional + concept=primary);
 *   - idempotência; retire reversível/auditável; UNIQUE parcial; SEM tocar tenant_concept_offerings/
 *     marketplace/Bank/company_status.
 * App mínimo = stack do protectedScope via app.inject. NÃO há projeção de discovery nesta fatia.
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
  if (!/publication|writer|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'PJ Publication Writer Test', slug: `pj-publication-writer-${Date.now()}` });

  // ── Owner: chain identity + user-actor (humano de auditoria + responsible do page-actor) ──
  const gid = randomUUID();
  const uid = randomUUID();
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,'Pub Owner','{}'::jsonb)`, [gid, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [gid, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [uid, TENANT_ID, gid, `${uid}@e2e.local`]);
  const ownerActorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, user_id, global_user_id, display_name) VALUES ($1,'user',$2,$3,'Pub Owner actor') RETURNING id::text AS id`, [TENANT_ID, uid, gid])).rows[0].id;

  // ── Par allowed (typeId, conceptId) seedado por migration + concept distinto ──
  const pair = (await pool.query<{ t: string; c: string }>(`SELECT company_type_id::text AS t, concept_id::text AS c FROM company_type_allowed_concepts LIMIT 1`)).rows[0];
  const typeId = pair.t;
  const primaryConceptId = pair.c;
  const otherConceptId = (await pool.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts WHERE concept_id <> $1 LIMIT 1`, [primaryConceptId])).rows[0].c;

  let cnpjSeq = 0;
  const mkFiscal = async (kyb: string): Promise<string> => {
    cnpjSeq += 1;
    const cnpj = String(Date.now() + cnpjSeq).padStart(14, '0').slice(-14);
    // chk_fiscal_identities_approved_audit: approved exige reviewed_by_actor_id + reviewed_at.
    if (kyb === 'approved') {
      return (await pool.query<{ f: string }>(
        `INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,$2,$3, now()) RETURNING fiscal_identity_id::text AS f`,
        [cnpj, kyb, ownerActorId]
      )).rows[0].f;
    }
    return (await pool.query<{ f: string }>(`INSERT INTO fiscal_identities (cnpj, kyb_status) VALUES ($1,$2) RETURNING fiscal_identity_id::text AS f`, [cnpj, kyb])).rows[0].f;
  };
  const mkCompany = async (opts: { operational: boolean; kyb: string; membership: boolean; pageActor: boolean }): Promise<string> => {
    const fiscalId = await mkFiscal(opts.kyb);
    const cid = (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id, primary_company_type_id, primary_concept_id)
       VALUES ($1,'Pub Co',$2,$3,$4) RETURNING company_id::text AS c`,
      [TENANT_ID, fiscalId, opts.operational ? typeId : null, opts.operational ? primaryConceptId : null]
    )).rows[0].c;
    if (opts.membership) {
      await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status) VALUES ($1,$2,$3,'owner',true,true,'active')`, [TENANT_ID, cid, gid]);
    }
    if (opts.pageActor) {
      await pool.query(`INSERT INTO actors (tenant_id, actor_type, company_id, display_name, responsible_actor_id) VALUES ($1,'page',$2,'Pub page',$3)`, [TENANT_ID, cid, ownerActorId]);
    }
    return cid;
  };

  const cPub = await mkCompany({ operational: true, kyb: 'approved', membership: true, pageActor: true });
  const cPending = await mkCompany({ operational: true, kyb: 'pending', membership: true, pageActor: true });
  const cInert = await mkCompany({ operational: false, kyb: 'approved', membership: true, pageActor: true });
  const cNoAuth = await mkCompany({ operational: true, kyb: 'approved', membership: false, pageActor: true });
  const cNoPage = await mkCompany({ operational: true, kyb: 'approved', membership: true, pageActor: false });

  const tcoBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM tenant_concept_offerings`)).rows[0].n);
  const bankBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n);
  const statusBefore = (await pool.query<{ s: string | null }>(`SELECT company_status::text AS s FROM companies WHERE company_id=$1`, [cPub])).rows[0].s;

  const token = mintToken(uid, TENANT_ID, gid);
  const acHeader = JSON.stringify({ actorId: uid, intent: 'company_publication', source: 'e2e', scope: `tenant:${TENANT_ID}` });
  const headers = { authorization: `Bearer ${token}`, 'x-action-context': acHeader };

  const app = await buildMinimalApp();
  const publish = (cid: string, body: unknown) => app.inject({ method: 'POST', url: `/companies/${cid}/publications`, headers, payload: body as object });
  const retire = (cid: string, conceptId: string) => app.inject({ method: 'POST', url: `/companies/${cid}/publications/${conceptId}/retire`, headers, payload: {} });
  const activeCount = async (cid: string) => Number((await pool.query(`SELECT count(*)::int AS n FROM company_concept_publications WHERE company_id=$1 AND status='active'`, [cid])).rows[0].n);

  try {
    // T1 — publish válido → 200 + row active + audit
    const r1 = await publish(cPub, { conceptId: primaryConceptId });
    const b1 = r1.json();
    record('T1 publish válido → 200', r1.statusCode === 200, `status=${r1.statusCode} body=${JSON.stringify(b1)}`);
    record('T1 alreadyPublished=false + status active', b1?.data?.alreadyPublished === false && b1?.data?.status === 'active');
    const row1 = (await pool.query<{ pa: string; cb: string; cc: string }>(`SELECT page_actor_id::text AS pa, created_by_actor_id::text AS cb, concept_id::text AS cc FROM company_concept_publications WHERE company_id=$1 AND status='active'`, [cPub])).rows[0];
    record('T1 page_actor_id + created_by(actor humano) + concept=primary gravados', !!row1 && row1.cb === ownerActorId && row1.cc === primaryConceptId && row1.pa.length > 0, JSON.stringify(row1));

    // T2 — idempotente → 200 alreadyPublished=true, sem duplicar
    const r2 = await publish(cPub, { conceptId: primaryConceptId });
    record('T2 publish idempotente → 200 alreadyPublished=true', r2.statusCode === 200 && r2.json()?.data?.alreadyPublished === true, `status=${r2.statusCode}`);
    record('T2 não duplica active (count=1)', (await activeCount(cPub)) === 1);

    // T3 — KYB pending → 409
    const r3 = await publish(cPending, { conceptId: primaryConceptId });
    record('T3 KYB pending → 409 KYB_NOT_APPROVED', r3.statusCode === 409 && r3.json()?.code === 'KYB_NOT_APPROVED', `status=${r3.statusCode} body=${JSON.stringify(r3.json())}`);
    record('T3 não criou publication', (await activeCount(cPending)) === 0);

    // T4 — sem autoridade → 403
    const r4 = await publish(cNoAuth, { conceptId: primaryConceptId });
    record('T4 sem autoridade → 403 PUBLICATION_FORBIDDEN', r4.statusCode === 403 && r4.json()?.code === 'PUBLICATION_FORBIDDEN', `status=${r4.statusCode}`);

    // T5 — sem primary_* → 409
    const r5 = await publish(cInert, { conceptId: primaryConceptId });
    record('T5 não operacional → 409 COMPANY_NOT_OPERATIONAL', r5.statusCode === 409 && r5.json()?.code === 'COMPANY_NOT_OPERATIONAL', `status=${r5.statusCode} body=${JSON.stringify(r5.json())}`);

    // T6 — concept divergente → 400
    const r6 = await publish(cPub, { conceptId: otherConceptId });
    record('T6 concept divergente → 400 CONCEPT_NOT_ACTIVATED', r6.statusCode === 400 && r6.json()?.code === 'CONCEPT_NOT_ACTIVATED', `status=${r6.statusCode} body=${JSON.stringify(r6.json())}`);

    // T7 — sem page-actor → 409
    const r7 = await publish(cNoPage, { conceptId: primaryConceptId });
    record('T7 sem page-actor → 409 PAGE_ACTOR_MISSING', r7.statusCode === 409 && r7.json()?.code === 'PAGE_ACTOR_MISSING', `status=${r7.statusCode} body=${JSON.stringify(r7.json())}`);

    // T8 — retire active → 200 retired + audit
    const r8 = await retire(cPub, primaryConceptId);
    const b8 = r8.json();
    record('T8 retire active → 200 status retired', r8.statusCode === 200 && b8?.data?.status === 'retired' && b8?.data?.alreadyRetired === false, `status=${r8.statusCode} body=${JSON.stringify(b8)}`);
    const ret = (await pool.query<{ ra: string | null; rb: string | null }>(`SELECT retired_at::text AS ra, retired_by_actor_id::text AS rb FROM company_concept_publications WHERE company_id=$1 AND status='retired' ORDER BY updated_at DESC LIMIT 1`, [cPub])).rows[0];
    record('T8 retired_at + retired_by(actor humano) gravados', !!ret && ret.ra !== null && ret.rb === ownerActorId, JSON.stringify(ret));
    record('T8 zero active após retire', (await activeCount(cPub)) === 0);

    // T9 — retire idempotente → 200 alreadyRetired=true
    const r9 = await retire(cPub, primaryConceptId);
    record('T9 retire idempotente → 200 alreadyRetired=true', r9.statusCode === 200 && r9.json()?.data?.alreadyRetired === true, `status=${r9.statusCode}`);

    // T10 — re-publish após retire → 200 nova active; histórico (retired + active) coexiste
    const r10 = await publish(cPub, { conceptId: primaryConceptId });
    const total = Number((await pool.query(`SELECT count(*)::int AS n FROM company_concept_publications WHERE company_id=$1 AND concept_id=$2`, [cPub, primaryConceptId])).rows[0].n);
    record('T10 re-publish após retire → 200 + 1 active + histórico (≥2 linhas)', r10.statusCode === 200 && (await activeCount(cPub)) === 1 && total >= 2, `status=${r10.statusCode} total=${total}`);

    // T11/12/13/14 — projeção + não-toque
    // (Projeção F-PJ-PROJECTION-WRITER: publish/retire agora atualizam tco como read-model derivado.
    //  Após T10 (cPub re-publicada), tco(tenant, primaryConcept) deve refletir is_active=true.)
    const tcoRefl = (await pool.query<{ n: string; act: string }>(`SELECT count(*)::text AS n, count(*) FILTER (WHERE is_active)::text AS act FROM tenant_concept_offerings WHERE tenant_id=$1 AND concept_id=$2`, [TENANT_ID, primaryConceptId])).rows[0];
    record('T11 projeção: tco(tenant,primaryConcept) reflete publicação ativa (1 row, is_active=true)', tcoRefl.n === '1' && tcoRefl.act === '1', `tcoBefore=${tcoBefore} refl=${JSON.stringify(tcoRefl)}`);
    record('T12 Bank intocado (bank_transactions inalterado)', Number((await pool.query(`SELECT count(*)::int AS n FROM bank_transactions`)).rows[0].n) === bankBefore);
    const actorTypes = await pool.query<{ t: string }>(`SELECT DISTINCT actor_type AS t FROM actors`);
    record('T13 actors só user/page (marketplace/hybrid intocado)', actorTypes.rows.every((r) => r.t === 'user' || r.t === 'page'), JSON.stringify(actorTypes.rows.map((r) => r.t)));
    record('T14 company_status inalterado', (await pool.query<{ s: string | null }>(`SELECT company_status::text AS s FROM companies WHERE company_id=$1`, [cPub])).rows[0].s === statusBefore);
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
  console.log('✨ Writer de publicação PJ verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

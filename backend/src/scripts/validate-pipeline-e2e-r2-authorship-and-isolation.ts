/**
 * E2E — R2.2 FIX (ressalvas Yala 2026-07-06): autoria não-forjável + RLS + unique de par ativo.
 * 🔒 Roda SÓ em DB efêmera (run-r2-authorship-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova as 3 correções do range de fix:
 *   A · Q3 (HIGH) autoria não-forjável — via HTTP real (app.inject) na rota POST /companies/:id/members:
 *       A1 Alice (gerencia a empresa C) declarando actionContext.actorId = ACTOR DO BOB (terceiro) → 403
 *          DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE (spoof de autoria BLOQUEADO, mesmo com canManageCompany);
 *       A2 Alice declarando o SEU PRÓPRIO actor → passa o gate de autoria (não 403 de autoria);
 *   B · unique parcial de par ativo — 2ª delegação ativa do MESMO par (INSERT direto) → REJEITADA;
 *   C · RLS ENABLE+FORCE nas duas tabelas de autoridade (pg_class.relrowsecurity + relforcerowsecurity).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/r2|authorship|isolation|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);
}

async function main(): Promise<void> {
  await assertEphemeral();
  await bootstrapPorts();

  // ── Fixtures reais: tenant, Alice (user+identity+actor, gerencia C), Bob (actor terceiro), empresa C ──
  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'R2 Auth',$2)`, [T, `r2auth-${Date.now()}`]);

  // Alice: global_user + identity + user + actor (user_id=Alice → ownership em canRepresentActor).
  const aliceGu = randomUUID(); const aliceUserId = randomUUID(); const aliceTax = String(Date.now()).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [aliceGu, aliceTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [aliceGu, aliceTax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [aliceUserId, T, `alice-${Date.now()}@e2e.test`, aliceGu]);
  const aliceActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Alice',$2,$3) RETURNING id`, [T, aliceUserId, aliceGu])).rows[0].id;

  // Bob: user+identity+actor (terceiro — Alice NÃO representa).
  const bobGu = randomUUID(); const bobUserId = randomUUID(); const bobTax = String(Date.now() + 7).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [bobGu, bobTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [bobGu, bobTax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [bobUserId, T, `bob-${Date.now()}@e2e.test`, bobGu]);
  const bobActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Bob',$2,$3) RETURNING id`, [T, bobUserId, bobGu])).rows[0].id;

  // Empresa C: registro em companies + actor page ancorado + company_users(Alice, gestora).
  // canManageCompany exige is_active=true AND member_status='active' (verificado no schema real).
  const companyId = randomUUID();
  await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, status, company_status, created_at, updated_at) VALUES ($1,$2,'Empresa C','active','ACTIVE',NOW(),NOW())`, [companyId, T]);
  await pool.query(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page','C Page',$2,$3)`, [T, companyId, aliceActor]);
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status, created_at, updated_at) VALUES ($1,$2,$3,'owner',true,true,'active',NOW(),NOW())`, [T, companyId, aliceGu]);

  // Person alvo (o colaborador a ser adicionado) — user actor com cadeia users completa (createMember
  // resolve o member para global_user_id via actor_type='user' + user_id).
  const personGu = randomUUID(); const personUserId = randomUUID(); const personTax = String(Date.now() + 13).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [personGu, personTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [personGu, personTax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [personUserId, T, `colab-${Date.now()}@e2e.test`, personGu]);
  const personActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Colab',$2,$3) RETURNING id`, [T, personUserId, personGu])).rows[0].id;

  // ── App com a rota real de members + preHandler que injeta req.user/tenant/actionContext ──
  const Fastify = (await import('fastify')).default;
  const app: FastifyInstance = Fastify({ logger: false });
  let spoofActorId = bobActor; // controla o actionContext.actorId por teste
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: aliceUserId, userId: aliceUserId }; // principal = Alice (sempre)
    r.actionContext = { actorId: req.headers['x-acting-actor'] ? String(req.headers['x-acting-actor']) : spoofActorId };
  });
  const companyMembersRoutes = (await import('../core/companies/company-members.routes')).default;
  await app.register(companyMembersRoutes, { prefix: '/companies' });
  await app.ready();

  const post = (actingActor: string) => app.inject({
    method: 'POST', url: `/companies/${companyId}/members`,
    headers: { 'content-type': 'application/json', 'x-acting-actor': actingActor },
    payload: JSON.stringify({ actorId: personActor, role: 'staff', status: 'active' }),
  });

  // A1 · Alice gerencia C mas declara o ACTOR DO BOB como concedente → 403 autoria.
  const r1 = await post(bobActor);
  let code1: string | null = null; try { code1 = JSON.parse(r1.body)?.code ?? null; } catch { /* */ }
  rec('A1 spoof de autoria (Alice→granted_by=Bob) BLOQUEADO 403 DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE',
    r1.statusCode === 403 && code1 === 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE',
    `status=${r1.statusCode} code=${code1}`);

  // A2 · Alice declara o SEU PRÓPRIO actor → passa o gate de autoria (não 403 de autoria).
  const r2 = await post(aliceActor);
  let code2: string | null = null; try { code2 = JSON.parse(r2.body)?.code ?? null; } catch { /* */ }
  rec('A2 autoria legítima (Alice→granted_by=Alice) PASSA o gate de autoria (não 403 de autoria)',
    code2 !== 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE',
    `status=${r2.statusCode} code=${code2}`);

  // A2b · confirma que a delegação criada gravou granted_by = actor da Alice (autoria correta e real).
  let memberId: string | null = null;
  if (r2.statusCode === 201) {
    try { memberId = JSON.parse(r2.body)?.data?.memberId ?? null; } catch { /* */ }
    const gb = (await pool.query<{ gb: string | null; rt: string | null }>(
      `SELECT granted_by_actor_id AS gb, relationship_type AS rt FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND status='active' ORDER BY created_at DESC LIMIT 1`,
      [T, personActor]
    )).rows[0];
    rec('A2b delegação real gravou granted_by = actor da Alice + relationship_type=employee (staff)', gb?.gb === aliceActor && gb?.rt === 'employee', `granted_by=${gb?.gb === aliceActor} rt=${gb?.rt}`);
  } else {
    rec('A2b delegação criada (pré-condição p/ checar granted_by)', false, `status inesperado=${r2.statusCode} body=${r2.body.slice(0, 200)}`);
  }

  // ── R2.3: mudança de role RE-DERIVA a delegação (fecha DT-R2-DELEGATION-UPDATE-MEMBER-STALE) ──
  // D1 · PUT muda role staff→admin declarando o SEU PRÓPRIO actor → passa e re-deriva o vínculo.
  const put = (actingActor: string, role: string) => app.inject({
    method: 'PUT', url: `/companies/${companyId}/members/${memberId}`,
    headers: { 'content-type': 'application/json', 'x-acting-actor': actingActor },
    payload: JSON.stringify({ role }),
  });
  if (memberId) {
    // D0 · spoof na PUT (declara actor do Bob) → 403 (a rota PUT virou escritora de autoria em R2.3).
    const rd0 = await put(bobActor, 'admin');
    let cd0: string | null = null; try { cd0 = JSON.parse(rd0.body)?.code ?? null; } catch { /* */ }
    rec('D0 PUT com spoof de autoria (Alice→granted_by=Bob) BLOQUEADO 403 (rota PUT agora é escritora)',
      rd0.statusCode === 403 && cd0 === 'DELEGATION_AUTHORSHIP_NOT_REPRESENTABLE', `status=${rd0.statusCode} code=${cd0}`);

    const rd1 = await put(aliceActor, 'admin');
    const after = (await pool.query<{ rt: string | null; scopes: any; status: string }>(
      `SELECT relationship_type AS rt, scopes_json AS scopes, status FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND status='active' ORDER BY created_at DESC LIMIT 1`,
      [T, personActor]
    )).rows[0];
    // admin → relationship_type='administrator' + scopes ['*'] (getRelationshipTypeForRole/getScopesForRole).
    rec('D1 PUT role staff→admin RE-DERIVA delegação: relationship_type=administrator + scopes=[*]',
      rd1.statusCode === 200 && after?.rt === 'administrator' && Array.isArray(after?.scopes) && after.scopes.includes('*'),
      `status=${rd1.statusCode} rt=${after?.rt} scopes=${JSON.stringify(after?.scopes)}`);

    // D2 · a delegação ANTIGA (staff/employee) foi revogada COM evento 'revoked' (trilha completa, sem buraco).
    const revokedOld = Number((await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM actor_delegations d JOIN actor_delegation_events e ON e.delegation_id=d.delegation_id
        WHERE d.tenant_id=$1 AND d.user_actor_id=$2 AND d.status='revoked' AND d.relationship_type='employee' AND e.event_type='revoked'`,
      [T, personActor]
    )).rows[0].n);
    rec('D2 delegação antiga (employee) revogada COM evento revoked (trilha completa)', revokedOld >= 1, `revoked_com_evento=${revokedOld}`);

    // D3 · exatamente 1 delegação ATIVA do par (unique parcial respeitado no re-derive).
    const activeCount = Number((await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM actor_delegations WHERE tenant_id=$1 AND user_actor_id=$2 AND status='active'`,
      [T, personActor]
    )).rows[0].n);
    rec('D3 exatamente 1 delegação ativa do par após re-derive (unique parcial respeitado)', activeCount === 1, `ativas=${activeCount}`);
  } else {
    rec('D1 PUT re-deriva (pré-condição memberId)', false, 'memberId ausente');
  }

  // ── R2.3: projeção read-side surfa relationship_type (actor-capabilities.resolveForUser) ──
  // resolveForUser carrega o actor pela coluna actor_id (que fica NULL em fixtures crus) → populo = id.
  await pool.query(`UPDATE actors SET actor_id = id WHERE tenant_id=$1 AND actor_id IS NULL`, [T]);
  const { actorCapabilitiesService } = await import('../core/actor-capabilities/actor-capabilities.service');
  const caps = await actorCapabilitiesService.resolveForUser(T, personActor, personUserId).catch((e) => { console.log('   (resolveForUser erro:', e?.message, ')'); return null; });
  const projected = caps?.delegations?.[0];
  rec('P1 projeção actor-capabilities surfa relationshipType (=administrator após re-derive)',
    !!projected && (projected as any).relationshipType === 'administrator',
    `delegations[0].relationshipType=${(projected as any)?.relationshipType} (n=${caps?.delegations?.length})`);

  await app.close();

  // B · unique parcial: 2ª delegação ATIVA do mesmo par (INSERT direto) → rejeitada.
  const inst = (await pool.query<{ id: string }>(`SELECT id FROM actors WHERE tenant_id=$1 AND company_id=$2 AND actor_type='page' LIMIT 1`, [T, companyId])).rows[0].id;
  await pool.query(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status) VALUES ($1,$2,$3,'[]'::jsonb,'active')`, [T, bobActor, inst]);
  let dupRej = false;
  try { await pool.query(`INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status) VALUES ($1,$2,$3,'[]'::jsonb,'active')`, [T, bobActor, inst]); }
  catch (e: any) { dupRej = /uidx_actor_delegations_active_pair|duplicate key|unique/i.test(e.message); }
  rec('B unique parcial: 2ª delegação ATIVA do mesmo par REJEITADA', dupRej);

  // C · RLS ENABLE+FORCE nas duas tabelas.
  const rls = (await pool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('actor_delegations','actor_delegation_events') ORDER BY relname`
  )).rows;
  rec('C RLS ENABLE+FORCE em actor_delegations + actor_delegation_events',
    rls.length === 2 && rls.every((r) => r.relrowsecurity && r.relforcerowsecurity),
    JSON.stringify(rls));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

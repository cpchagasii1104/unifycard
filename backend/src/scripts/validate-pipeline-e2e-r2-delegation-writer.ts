/**
 * E2E — R2.2 (Lote L2): writer governado de delegação + trilha append-only atômica.
 * 🔒 Roda SÓ em DB efêmera (run-r2-delegation-writer-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o writer R2.2 (actorDelegationRepository estendido) através da camada de persistência real:
 *   1 grant governado: delegação grava relationship_type + granted_by + gera 1 evento 'granted'
 *     (snapshot de relationship_type + scopes);
 *   2 supersede: re-grant do MESMO par auto-revoga o anterior COM evento 'revoked' (superseded) +
 *     gera 'granted' novo — trilha completa, sem buraco;
 *   3 revoke governado: revoke(revokedBy) gera evento 'revoked' com autoria do revogador;
 *   4 listEvents devolve a trilha inteira em ordem cronológica;
 *   5 ATOMICIDADE (a invariante-chave): relationship_type inválido faz o grant FALHAR e NÃO deixa
 *     NEM delegação NEM evento órfão (ROLLBACK) — nunca delegação sem rastro, nem rastro sem delegação;
 *   6 invariante global: toda delegação ativa tem ≥1 evento 'granted';
 *   7 company-members mapping: role→relationship_type governado (admin→administrator, staff→employee,
 *     contractor→contractor) via getRelationshipTypeForRole real.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { actorDelegationRepository } from '../core/actor-delegation/actor-delegation.repository';
import { randomUUID } from 'crypto';

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
  if (!/r2|delegation|writer|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function eventCount(tenantId: string, delegationId: string, type: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM actor_delegation_events WHERE tenant_id=$1 AND delegation_id=$2 AND event_type=$3`,
    [tenantId, delegationId, type]
  );
  return Number(r.rows[0].n);
}

async function main(): Promise<void> {
  await assertEphemeral();

  // Fixtures: tenant + user actor (com identidade) + page actor (ancorado no humano) + granter actor.
  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'R2W T',$2)`, [T, `r2w-${Date.now()}`]);
  const gu = randomUUID();
  const tax = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  const person = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Pessoa',$2::uuid) RETURNING id`, [T, gu])).rows[0].id;
  const company = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, responsible_actor_id) VALUES ($1,'page','Empresa',$2) RETURNING id`, [T, person])).rows[0].id;
  const granter = person; // quem concede (na porta selada = o manager; aqui o actor concedente)

  // 1. Grant governado.
  const d1 = await actorDelegationRepository.create(T, {
    userActorId: person, institutionalActorId: company, scopes: ['dept:warehouse', 'publish_feed'],
    relationshipType: 'director', grantedByActorId: granter,
  });
  const d1grants = await eventCount(T, d1.delegationId, 'granted');
  const d1row = (await pool.query<{ rt: string; gb: string }>(`SELECT relationship_type AS rt, granted_by_actor_id AS gb FROM actor_delegations WHERE delegation_id=$1`, [d1.delegationId])).rows[0];
  rec('1 grant governado grava relationship_type+granted_by + 1 evento granted',
    d1row.rt === 'director' && d1row.gb === granter && d1grants === 1 && d1.relationshipType === 'director',
    `rt=${d1row.rt} gb=${d1row.gb === granter} grants=${d1grants}`);

  // Snapshot do evento (relationship_type + scopes no momento).
  const ev1 = await actorDelegationRepository.listEvents(T, d1.delegationId);
  rec('1b evento granted carrega snapshot (relationship_type=director, scopes com dept:warehouse)',
    ev1.length === 1 && ev1[0].eventType === 'granted' && ev1[0].relationshipType === 'director' && ev1[0].scopes.includes('dept:warehouse') && ev1[0].actorId === granter,
    JSON.stringify(ev1[0] ?? {}));

  // 2. Supersede: re-grant do MESMO par.
  const d2 = await actorDelegationRepository.create(T, {
    userActorId: person, institutionalActorId: company, scopes: ['*'],
    relationshipType: 'administrator', grantedByActorId: granter, previousLinkId: d1.delegationId,
  });
  const d1status = (await pool.query<{ s: string }>(`SELECT status AS s FROM actor_delegations WHERE delegation_id=$1`, [d1.delegationId])).rows[0].s;
  const d1revoked = await eventCount(T, d1.delegationId, 'revoked');
  const d2grants = await eventCount(T, d2.delegationId, 'granted');
  const d2prev = (await pool.query<{ p: string }>(`SELECT previous_link_id AS p FROM actor_delegations WHERE delegation_id=$1`, [d2.delegationId])).rows[0].p;
  rec('2 supersede: anterior revogado COM evento revoked + novo granted + cadeia previous_link_id',
    d1status === 'revoked' && d1revoked === 1 && d2grants === 1 && d2prev === d1.delegationId,
    `d1.status=${d1status} d1.revoked=${d1revoked} d2.grants=${d2grants} chain=${d2prev === d1.delegationId}`);

  // 3. Revoke governado com autoria.
  const ok = await actorDelegationRepository.revoke(T, d2.delegationId, granter);
  const d2revoked = await eventCount(T, d2.delegationId, 'revoked');
  const revEv = (await actorDelegationRepository.listEvents(T, d2.delegationId)).find((e) => e.eventType === 'revoked');
  rec('3 revoke governado gera evento revoked com autoria do revogador',
    ok && d2revoked === 1 && revEv?.actorId === granter,
    `ok=${ok} revoked=${d2revoked} actor=${revEv?.actorId === granter}`);

  // 4. Trilha completa em ordem.
  const trail1 = await actorDelegationRepository.listEvents(T, d1.delegationId);
  const trail2 = await actorDelegationRepository.listEvents(T, d2.delegationId);
  rec('4 listEvents: d1=[granted,revoked] · d2=[granted,revoked] em ordem cronológica',
    trail1.map((e) => e.eventType).join(',') === 'granted,revoked' &&
    trail2.map((e) => e.eventType).join(',') === 'granted,revoked',
    `d1=[${trail1.map((e) => e.eventType)}] d2=[${trail2.map((e) => e.eventType)}]`);

  // 5. ATOMICIDADE: relationship_type inválido → grant FALHA sem deixar delegação nem evento órfão.
  const beforeDeleg = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM actor_delegations WHERE tenant_id=$1`, [T])).rows[0].n);
  const beforeEv = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM actor_delegation_events WHERE tenant_id=$1`, [T])).rows[0].n);
  let threw = false;
  try {
    await actorDelegationRepository.create(T, {
      userActorId: person, institutionalActorId: company, scopes: ['x'],
      relationshipType: 'imperador_do_universo' as any, grantedByActorId: granter,
    });
  } catch { threw = true; }
  const afterDeleg = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM actor_delegations WHERE tenant_id=$1`, [T])).rows[0].n);
  const afterEv = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM actor_delegation_events WHERE tenant_id=$1`, [T])).rows[0].n);
  rec('5 ATOMICIDADE: relationship_type inválido → falha SEM delegação nem evento órfão (rollback)',
    threw && afterDeleg === beforeDeleg && afterEv === beforeEv,
    `threw=${threw} deleg ${beforeDeleg}→${afterDeleg} ev ${beforeEv}→${afterEv}`);

  // 6. Invariante global: toda delegação ativa tem ≥1 evento 'granted'.
  const orphans = Number((await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM actor_delegations d
      WHERE d.tenant_id=$1 AND d.status='active'
        AND NOT EXISTS (SELECT 1 FROM actor_delegation_events e WHERE e.delegation_id=d.delegation_id AND e.event_type='granted')`,
    [T]
  )).rows[0].n);
  rec('6 invariante: zero delegação ativa sem evento granted', orphans === 0, `orphans=${orphans}`);

  // 7. company-members mapping role→relationship_type (via a lógica real do service).
  const { companyMembersService } = await import('../core/companies/company-members.service');
  const map = (companyMembersService as any).getRelationshipTypeForRole.bind(companyMembersService);
  rec('7 role→relationship_type governado (admin→administrator, staff→employee, contractor→contractor)',
    map('admin') === 'administrator' && map('staff') === 'employee' && map('contractor') === 'contractor' && map('desconhecido') === null,
    `admin=${map('admin')} staff=${map('staff')} contractor=${map('contractor')}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

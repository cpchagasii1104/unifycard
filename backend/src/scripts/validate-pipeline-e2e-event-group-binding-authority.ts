/**
 * E2E — F-EVENT-ENGINE-COUPLING · F0-GRUPO: vínculo GOVERNADO evento↔grupo no writer format-first.
 * createEvent(group_id, actingUserId) roda ATÔMICO (§4.8): lazy-heal do group-actor
 * (findOrCreateGroupActor §4.8.1) → prova canRepresentActor(actingUserId, groupActorId, client)
 * ANTES do write (§4.9.5) → INSERT events + INSERT group_events (5 col reais) → COMMIT; fail-closed
 * 403 → ROLLBACK, NADA de evento. Bank-free. DB efêmera. NUNCA unificard_dev. Prova por API DIRETA
 * (service writer — a verdade nasce no backend).
 *
 *   (a) grupo NOVO (actor_id NULL, sem group-actor — como createGroup real) + principal que REPRESENTA
 *       o group-actor (owner) → materializa o group-actor + cria evento + grava group_events (1 linha);
 *   (b) principal SEM autoridade (não-owner) + group_id → 403 EVENT_GROUP_BINDING_NOT_REPRESENTED;
 *       ZERO evento novo, group_events INALTERADO (heal do group-actor pode ter ocorrido — idempotente/ok);
 *   (c) sem group_id → evento avulso criado, group_events INALTERADO;
 *   (d) Δbank = 0.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { eventService } from '../core/events/event.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/event|group|binding|authority|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 43).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `evgrp-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

// Grupo criado como o createGroup REAL: owner_actor_id setado, actor_id NULL, SEM group-actor.
async function seedRealGroup(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  const groupId = (
    await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
      [tenantId, name, `${name}-${seq}-${Date.now()}`.toLowerCase(), ownerActorId]
    )
  ).rows[0].id;
  return groupId;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event Group Binding Authority E2E', slug: `evgrp-${Date.now()}` });

  const owner = await mkUserActor(TENANT, 'Dono do Grupo');
  const attacker = await mkUserActor(TENANT, 'Atacante');
  const groupId = await seedRealGroup(TENANT, owner.actorId, 'Comunidade');

  const countGroupEvents = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM group_events WHERE group_id = $1`, [groupId])).rows[0].n);
  const countEvents = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM events WHERE tenant_id = $1`, [TENANT])).rows[0].n);
  const groupActorId = async (): Promise<string | null> =>
    (await pool.query<{ a: string | null }>(`SELECT actor_id::text AS a FROM groups WHERE id = $1`, [groupId])).rows[0]?.a ?? null;

  try {
    console.log('\n— event↔group governed binding (F0-grupo) —');
    const bankBefore = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;

    // pré-condição: grupo real sem group-actor
    const actorIdBefore = await groupActorId();
    record('pré: grupo criado como real (groups.actor_id NULL, sem group-actor)', actorIdBefore === null, `actor_id=${actorIdBefore}`);

    // (a) owner cria evento no grupo → materializa group-actor + grava group_events
    const geBefore = await countGroupEvents();
    const ev = await eventService.createEvent(TENANT, {
      actorId: owner.actorId, actorType: 'user' as any, title: 'Festa da Comunidade',
      group_id: groupId, actingUserId: owner.userId,
    } as any);
    const actorIdAfter = await groupActorId();
    const groupActorRow = (await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM actors WHERE tenant_id=$1 AND group_id=$2 AND actor_type='group'`, [TENANT, groupId])).rows[0].n;
    record('(a) owner cria evento no grupo → 201 + group_events +1 + group-actor materializado + groups.actor_id setado',
      !!ev.id && (await countGroupEvents()) === geBefore + 1 && actorIdAfter !== null && Number(groupActorRow) === 1,
      `ev=${ev.id} group_events=${await countGroupEvents()} actorId=${actorIdAfter} groupActors=${groupActorRow}`);

    // (b) atacante (não-owner) tenta criar evento no grupo → 403; ZERO evento novo, group_events inalterado
    const evBeforeHack = await countEvents();
    const geBeforeHack = await countGroupEvents();
    let denied = false; let code = '';
    try {
      await eventService.createEvent(TENANT, {
        actorId: attacker.actorId, actorType: 'user' as any, title: 'Invasao',
        group_id: groupId, actingUserId: attacker.userId,
      } as any);
    } catch (e: any) { denied = true; code = e?.message || ''; }
    record('(b) não-owner cria evento no grupo → 403 EVENT_GROUP_BINDING_NOT_REPRESENTED; ZERO evento, group_events inalterado (atomicidade)',
      denied && /EVENT_GROUP_BINDING_NOT_REPRESENTED/.test(code) && (await countEvents()) === evBeforeHack && (await countGroupEvents()) === geBeforeHack,
      `denied=${denied} code=${code.slice(0, 60)} events ${evBeforeHack}→${await countEvents()} ge ${geBeforeHack}→${await countGroupEvents()}`);

    // (c) sem group_id → evento avulso, group_events inalterado
    const geBeforeAvulso = await countGroupEvents();
    const evAvulso = await eventService.createEvent(TENANT, {
      actorId: owner.actorId, actorType: 'user' as any, title: 'Evento Avulso',
    } as any);
    record('(c) sem group_id → evento avulso criado; group_events inalterado',
      !!evAvulso.id && (await countGroupEvents()) === geBeforeAvulso,
      `ev=${evAvulso.id} ge ${geBeforeAvulso}→${await countGroupEvents()}`);

    // (d) Δbank = 0
    const bankAfter = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
    record('(d) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);
  } finally {
    // noop
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

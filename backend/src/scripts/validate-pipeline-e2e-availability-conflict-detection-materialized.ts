/**
 * E2E — F-AVAILABILITY-CONFLICT-DETECTION-STUB-FIX (DT-AVAILABILITY-CONFLICT-DETECTION-STUB).
 * NÃO MOVE DINHEIRO. Prova, via SQL function real + `createBooking` real, que:
 *
 *   A detect_availability_conflicts() detecta overlap real (antes: stub, sempre zero linhas)
 *   B o escopo é owner_type='user' + owner_id=actor (aviso PESSOAL) — outro owner_type/actor NÃO
 *      conta como conflito
 *   C sem overlap de horário → zero conflitos (mesmo owner, janelas não sobrepostas)
 *   D availability-alvo inexistente → RETURN vazio, honesto (não quebra, mesmo comportamento do
 *      stub para esse caso)
 *   E createBooking real: quando o REQUESTER tem outra janela pessoal que sobrepõe o horário
 *      reservado, AVAILABILITY_CONFLICT_DETECTED é emitido no event_outbox, alvo = o PRÓPRIO
 *      requester (aviso de "você já tem algo marcado", não é sobre o dono da janela reservada)
 *   F Δbank=0
 *
 * 🔒 DB EFÊMERA (run-availability-conflict-detection-materialized-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/conflict|detection|stub|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}

async function mkAvailability(tenantId: string, ownerActorId: string, start: Date, end: Date): Promise<string> {
  return (await pool.query<{ availability_id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, start_datetime, end_datetime, status, timezone)
     VALUES ($1::uuid,'user',$2::uuid,$3,$4,'active','America/Sao_Paulo') RETURNING availability_id`,
    [tenantId, ownerActorId, start, end]
  )).rows[0].availability_id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const TENANT = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Conflict Detection E2E',$2)`, [TENANT, `conflict-detect-e2e-${TENANT.slice(0, 8)}`]);

  const userA = await mkActor(TENANT, 'UserA');
  const userB = await mkActor(TENANT, 'UserB'); // requester
  const otherActor = await mkActor(TENANT, 'OtherActor');

  const t0 = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const overlapStart = new Date(t0.getTime() + 30 * 60 * 1000);
  const overlapEnd = new Date(t0.getTime() + 90 * 60 * 1000);
  const noOverlapStart = new Date(t0.getTime() + 5 * 3600 * 1000);
  const noOverlapEnd = new Date(t0.getTime() + 6 * 3600 * 1000);

  // Janela sendo RESERVADA (de UserA — quem tem a agenda que UserB quer reservar).
  const targetAvailabilityId = await mkAvailability(TENANT, userA.actorId, t0, new Date(t0.getTime() + 60 * 60 * 1000));

  // Janela PESSOAL de UserB (o REQUESTER) que SOBREPÕE o horário sendo reservado.
  await mkAvailability(TENANT, userB.actorId, overlapStart, overlapEnd);

  // Janela de OUTRO actor, também sobrepõe em horário — NÃO deve contar (owner_id diferente).
  await mkAvailability(TENANT, otherActor.actorId, overlapStart, overlapEnd);

  console.log('\n— A/B: detect_availability_conflicts() via SQL real —');
  const conflicts = (await pool.query<{ conflict_availability_id: string; conflict_owner_id: string }>(
    `SELECT * FROM detect_availability_conflicts($1::uuid, $2::uuid, $3::uuid)`,
    [TENANT, targetAvailabilityId, userB.actorId]
  )).rows;
  record('A detecta overlap real (antes: stub, sempre zero linhas)', conflicts.length === 1, `count=${conflicts.length}`);
  record('B conflito encontrado pertence a userB (owner_type=user, owner_id=actor pedido), não a otherActor', conflicts[0]?.conflict_owner_id === userB.actorId, `esperado=${userB.actorId} recebido=${conflicts[0]?.conflict_owner_id}`);

  console.log('\n— C: sem overlap → zero conflitos —');
  const noOverlapTargetId = await mkAvailability(TENANT, userA.actorId, noOverlapStart, noOverlapEnd);
  const noConflicts = (await pool.query(
    `SELECT * FROM detect_availability_conflicts($1::uuid, $2::uuid, $3::uuid)`,
    [TENANT, noOverlapTargetId, userB.actorId]
  )).rows;
  record('C janela sem overlap não gera conflito', noConflicts.length === 0, `count=${noConflicts.length}`);

  console.log('\n— D: availability-alvo inexistente → RETURN vazio honesto —');
  const missingConflicts = (await pool.query(
    `SELECT * FROM detect_availability_conflicts($1::uuid, $2::uuid, $3::uuid)`,
    [TENANT, randomUUID(), userB.actorId]
  )).rows;
  record('D availability inexistente não quebra, retorna vazio', missingConflicts.length === 0);

  console.log('\n— E: createBooking real emite AVAILABILITY_CONFLICT_DETECTED —');
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const booking = await unifiedAvailabilityService.createBooking(
    TENANT,
    { subjectUserId: userB.userId, requesterActorId: userB.actorId },
    { availabilityId: targetAvailabilityId, requesterActorId: userB.actorId }
  );
  record('(pré-condição) booking criado', !!booking.bookingId);

  const conflictEvent = (await pool.query<{ payload: any }>(
    `SELECT payload FROM event_outbox WHERE tenant_id = $1 AND event_type = 'AVAILABILITY_CONFLICT_DETECTED' ORDER BY created_at DESC LIMIT 1`,
    [TENANT]
  )).rows[0];
  record('E AVAILABILITY_CONFLICT_DETECTED emitido (antes: nunca disparava, stub sempre vazio)', !!conflictEvent);
  record('E alvo do aviso é o PRÓPRIO requester (userB), não o dono da janela reservada (userA)', conflictEvent?.payload?.actorId === userB.actorId, `esperado=${userB.actorId} recebido=${conflictEvent?.payload?.actorId}`);

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('F Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0; try { execSync('node scripts/audit-availability-conflict-detection-materialized.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
  record('G guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ detect_availability_conflicts() materializada, detecta overlap real escopado a owner_type=user; createBooking real emite AVAILABILITY_CONFLICT_DETECTED pro requester; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

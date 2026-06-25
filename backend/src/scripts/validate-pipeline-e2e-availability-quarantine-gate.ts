/**
 * E2E F-AVAILABILITY-WRITE-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-availability-quarantine-gate-ephemeral.ps1.
 *
 * Prova que um owner temporal cujo AUTHORITY ACTOR está efetivamente bloqueado não pode criar nem mutar
 * availability — por qualquer owner_type (resolução polimórfica; owner_id ≠ authorityActorId), embora a
 * REPRESENTAÇÃO continue pura:
 *   • não-bloqueado cria OK (owner=user e owner=group);
 *   • owner=user bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (nenhum INSERT);
 *   • owner=group bloqueado (authority = groups.owner_actor_id, NÃO o groupId) → 403 no create e no update;
 *   • canRepresentActor segue TRUE bloqueado;
 *   • schedules/schedule_slots sem write; Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { AvailabilityOwnerType } from '../core/availability/unified-availability.types';
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
  if (!/availability|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedUser(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + (seq += 233)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${cpf}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);
let h = 8;
const win = () => { const s = new Date(Date.UTC(2030, 0, 10, h++, 0, 0)); const e = new Date(s.getTime() + 30 * 60000); return { s, e }; };

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
  await tenantService.createTenant({ id: tenantId, name: 'Availability Quarantine', slug: `avq-${Date.now()}` });
  const A = await seedUser(tenantId, 'Owner A');
  const B = await seedUser(tenantId, 'Owner B');
  // grupo cujo authority = owner_actor_id = actorB (owner_id do availability = groupId ≠ authority)
  const groupId = (await pool.query<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1::uuid,'Grupo B',$2::uuid) RETURNING id::text AS id`,
    [tenantId, B.actorId]
  )).rows[0].id;

  const createAvail = (ownerType: AvailabilityOwnerType, ownerId: string, userId: string) => {
    const { s, e } = win();
    return unifiedAvailabilityService.createAvailability(tenantId, userId, { ownerType, ownerId, startDatetime: s, endDatetime: e })
      .then((a) => ({ ok: true, id: (a as any).availabilityId || (a as any).id } as any)).catch((er) => ({ ok: false, err: errOf(er) }));
  };
  const updateAvail = (availId: string, userId: string) =>
    unifiedAvailabilityService.updateAvailability(tenantId, availId, userId, { status: 'inactive' as any })
      .then(() => ({ ok: true } as any)).catch((er) => ({ ok: false, err: errOf(er) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1 — owner=user, não-bloqueado → cria OK ──
  record('T1 owner=user não-bloqueado → cria OK', (await createAvail(AvailabilityOwnerType.USER, A.actorId, A.userId)).ok === true);

  // ── T2 — owner=group, não-bloqueado → cria OK (availG p/ teste de update) ──
  let availG: string | undefined;
  { const r = await createAvail(AvailabilityOwnerType.GROUP, groupId, B.userId); availG = r.id; record('T2 owner=group não-bloqueado → cria OK (authority = owner_actor_id)', r.ok === true && !!r.id, JSON.stringify(r.err)); }

  // ── bloquear A (user) e B (authority do grupo) ──
  const availForA = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_id=$2`, [tenantId, A.actorId]);
  await block(tenantId, A.actorId);
  await block(tenantId, B.actorId);

  // ── T3 — owner=user bloqueado → 403 (create) ──
  { const r = await createAvail(AvailabilityOwnerType.USER, A.actorId, A.userId); record('T3 owner=user bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED', r.ok === false && r.err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(r.err?.code || r.err?.msg || ''), JSON.stringify(r.err)); }
  // ── T4 — nenhum INSERT quando bloqueado ──
  record('T4 bloqueado → nenhum INSERT em availability (contagem inalterada)', (await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_id=$2`, [tenantId, A.actorId])) === availForA, `before=${availForA}`);

  // ── T5 — owner=group bloqueado (authority=owner_actor_id) → 403 (create, polimórfico) ──
  { const r = await createAvail(AvailabilityOwnerType.GROUP, groupId, B.userId); record('T5 owner=group authority bloqueada → 403 (resolve owner_actor_id, não groupId cru)', r.ok === false && r.err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(r.err?.code || r.err?.msg || ''), JSON.stringify(r.err)); }

  // ── T6 — UPDATE de janela existente cujo authority está bloqueado → 403 ANTES do UPDATE ──
  {
    const before = await count(`SELECT count(*)::int AS n FROM availability WHERE availability_id=$1 AND status='active'`, [availG]);
    const r = await updateAvail(availG!, B.userId);
    const after = await count(`SELECT count(*)::int AS n FROM availability WHERE availability_id=$1 AND status='active'`, [availG]);
    record('T6 update com authority bloqueada → 403 e janela intacta (status não mudou)', r.ok === false && r.err?.status === 403 && before === 1 && after === 1, `${JSON.stringify(r.err)} before=${before} after=${after}`);
  }

  // ── T7 — representação pura (bloqueio não afeta canRepresentActor) ──
  record('T7 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId)) === true);

  // ── T8 — schedules/schedule_slots sem write ──
  {
    const sc = await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0);
    record('T8 schedules/schedule_slots sem write (0 linhas)', sc === 0, `n=${sc}`);
  }

  // ── T9 — Δbank=0 ──
  record('T9 Δbank=0 (availability é não-financeiro)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ owner quarentenado (qualquer owner_type, authorityActorId resolvido) não cria/muta availability; canRepresentActor puro; schedules vazio; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

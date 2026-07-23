/**
 * E2E — SLICE S1 (VAQUINHA RULES): regras DECLARADAS da vaquinha (all-or-nothing crowdfunding) na linha events.
 * Prova, POR API DIRETA (camada de serviço REAL — "a verdade vive no backend", nunca via frontend), que:
 *   (1) um evento contribuicao_opcional com min_attendees=50 + is_all_or_nothing=true + funding_deadline_at
 *       ANTES de datetime_start PERSISTE e é RELIDO (getEvent devolve as regras);
 *   (2) is_all_or_nothing=true SEM min_attendees → 400 (não há vaquinha tudo-ou-nada sem META);
 *   (3) funding_deadline_at DEPOIS de datetime_start → 400 (o prazo fecha AT/ANTES do início, ≠ datetime_end);
 *   (4) default: evento normal tem is_all_or_nothing=false e funding_deadline_at NULL (sem regressão);
 *   (5) acoplamento: is_all_or_nothing=true em evento NÃO-contribuicao_opcional (gratuito) → 400;
 *   (6) Δbank=0 em todos os caminhos (META = PESSOAS, NUNCA cents; dinheiro real = PORTA-01, FORA).
 * DB efêmera. NUNCA unificard_dev.
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
  if (!/vaquinha|funding|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 61).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `vaquinha-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

// Cria um draft com datas (start/end) e devolve o event id. Bank-free.
async function mkEvent(tenantId: string, actorId: string, startOffsetDays: number): Promise<string> {
  const start = new Date(Date.now() + startOffsetDays * 24 * 3600e3);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const ev = await eventService.createEvent(tenantId, {
    actorId, actorType: 'user', title: 'Show comunitário (vaquinha)',
    datetimeStart: start.toISOString(), datetimeEnd: end.toISOString(),
  });
  return ev.id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Vaquinha Funding E2E', slug: `vaquinha-${Date.now()}` });
  const org = await mkUserActor(TENANT, 'Organizador Vaquinha');

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  const errOf = async (fn: () => Promise<unknown>): Promise<{ status: number | null; msg: string }> => {
    try { await fn(); return { status: null, msg: 'NO_THROW' }; }
    catch (e: any) { return { status: e?.statusCode ?? null, msg: String(e?.message ?? e) }; }
  };

  console.log('\n— regras DECLARADAS da vaquinha (all-or-nothing) na linha events —');

  // (1) contribuicao_opcional + META 50 + all-or-nothing + prazo ANTES do início → persiste + relê.
  {
    const evId = await mkEvent(TENANT, org.actorId, 30);
    const startIso = (await eventService.getEvent(TENANT, evId))!.datetimeStart;
    const deadline = new Date(new Date(startIso).getTime() - 10 * 24 * 3600e3).toISOString(); // 10 dias ANTES
    await eventService.updateEvent(TENANT, evId, {
      eventAccessType: 'contribuicao_opcional', minAttendees: 50,
      isAllOrNothing: true, fundingDeadlineAt: deadline,
    } as any, org.actorId);
    const re = (await eventService.getEvent(TENANT, evId))!;
    const rowDl = (await pool.query<{ d: string | null; a: boolean }>(
      `SELECT funding_deadline_at::text AS d, is_all_or_nothing AS a FROM events WHERE id = $1::uuid`, [evId])).rows[0];
    record('(1) contribuicao_opcional + META 50 + all-or-nothing + prazo<inicio → persiste e relê',
      re.isAllOrNothing === true && re.minAttendees === 50 && !!re.fundingDeadlineAt &&
      new Date(re.fundingDeadlineAt).getTime() <= new Date(startIso).getTime() && rowDl.a === true && rowDl.d !== null,
      `isAoN=${re.isAllOrNothing} min=${re.minAttendees} dl=${re.fundingDeadlineAt} rowA=${rowDl.a}`);
  }

  // (2) all-or-nothing SEM min_attendees → 400.
  {
    const evId = await mkEvent(TENANT, org.actorId, 30);
    const r = await errOf(() => eventService.updateEvent(TENANT, evId, {
      eventAccessType: 'contribuicao_opcional', isAllOrNothing: true,
    } as any, org.actorId));
    record('(2) all-or-nothing SEM META (min_attendees) → 400',
      r.status === 400 && /VAQUINHA_ALL_OR_NOTHING_REQUIRES_GOAL/.test(r.msg), `status=${r.status} msg=${r.msg}`);
  }

  // (3) funding_deadline_at DEPOIS de datetime_start → 400.
  {
    const evId = await mkEvent(TENANT, org.actorId, 30);
    const startIso = (await eventService.getEvent(TENANT, evId))!.datetimeStart;
    const after = new Date(new Date(startIso).getTime() + 1 * 24 * 3600e3).toISOString(); // 1 dia DEPOIS
    const r = await errOf(() => eventService.updateEvent(TENANT, evId, {
      eventAccessType: 'contribuicao_opcional', minAttendees: 50,
      isAllOrNothing: true, fundingDeadlineAt: after,
    } as any, org.actorId));
    record('(3) prazo DEPOIS do início (funding_deadline_at > datetime_start) → 400',
      r.status === 400 && /VAQUINHA_DEADLINE_AFTER_START/.test(r.msg), `status=${r.status} msg=${r.msg}`);
  }

  // (4) default: evento normal → is_all_or_nothing=false, funding_deadline_at NULL (sem regressão).
  {
    const evId = await mkEvent(TENANT, org.actorId, 20);
    const re = (await eventService.getEvent(TENANT, evId))!;
    const row = (await pool.query<{ d: string | null; a: boolean }>(
      `SELECT funding_deadline_at::text AS d, is_all_or_nothing AS a FROM events WHERE id = $1::uuid`, [evId])).rows[0];
    record('(4) default: evento normal tem is_all_or_nothing=false e funding_deadline_at NULL (sem regressão)',
      re.isAllOrNothing === false && re.fundingDeadlineAt === null && row.a === false && row.d === null,
      `isAoN=${re.isAllOrNothing} dl=${re.fundingDeadlineAt} rowA=${row.a} rowD=${row.d}`);
  }

  // (5) acoplamento: all-or-nothing em evento NÃO-contribuicao_opcional (gratuito) → 400.
  {
    const evId = await mkEvent(TENANT, org.actorId, 30);
    const r = await errOf(() => eventService.updateEvent(TENANT, evId, {
      eventAccessType: 'gratuito', minAttendees: 50, isAllOrNothing: true,
    } as any, org.actorId));
    record('(5) acoplamento: all-or-nothing em evento gratuito (não contribuicao_opcional) → 400',
      r.status === 400 && /VAQUINHA_ACCESS_TYPE_MISMATCH/.test(r.msg), `status=${r.status} msg=${r.msg}`);
  }

  // (6) Δbank=0.
  const bankAfter = await bankSnap();
  record('(6) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado)', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) { console.error('❌ FALHAS:'); for (const f of failed) console.error(`   - ${f.label}${f.reason ? ` (${f.reason})` : ''}`); }
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

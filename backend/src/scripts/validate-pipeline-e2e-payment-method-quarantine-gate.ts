/**
 * E2E F-PAYMENT-METHOD-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-payment-method-quarantine-gate-ephemeral.ps1.
 *
 * Prova que um actor bloqueado não cria nem defaulta método de pagamento (instrumento DECLARATIVO, money-free):
 *   • scopeActor (dono) bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (o MEU gate é a 1ª linha de createMethod,
 *     ANTES de unsetDefaultForActor/INSERT);
 *   • acting/createdBy bloqueado, scope ativo → 403;
 *   • não-bloqueado → o gate DEIXA PASSAR → erro downstream ≠ gate (payment_methods é GHOST no schema vivo);
 *   • canRepresentActor puro; zero payment_intents/bank_*; schedules vazio; Δbank=0.
 * NOTA: payment_methods é GHOST no FULL (DDL só em migrations_archive) → a rota já estava contida acidentalmente
 * (42P01); o gate torna a contenção EXPLÍCITA (403 por quarentena) para o actor bloqueado. Money-free.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { paymentMethodService } from '../modules/marketplace/payment-method.service';
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
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payment|method|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 89).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const block = (tenantId: string, actorId: string) => pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [actorId, tenantId]);

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Payment Method Quarantine', slug: `pmq-${Date.now()}` });
  const oA = await seedActor(TENANT_ID, 'OwnerA');   // dono — será bloqueado
  const oB = await seedActor(TENANT_ID, 'OwnerB');   // dono — permanece ativo
  const x = await seedActor(TENANT_ID, 'ActingX');   // acting/createdBy — será bloqueado

  const create = (scopeActorId: string, createdByActorId: string, isDefault: boolean, createdByUserId?: string) =>
    paymentMethodService.createMethod(TENANT_ID, { actorId: scopeActorId, type: 'PIX' as any, isDefault } as any, createdByActorId, createdByUserId)
      .then((m) => ({ ok: true, id: (m as any).id } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const piSql = `SELECT COALESCE((SELECT count(*) FROM payment_intents),0)::int AS n`;
  const bankBefore = await count(bankSql);
  const piBefore = await count(piSql).catch(() => 0);

  // bloquear oA (dono) e x (acting); oB permanece ativo
  await block(TENANT_ID, oA.actorId);
  await block(TENANT_ID, x.actorId);

  // ── T1 — scopeActor bloqueado → 403 pelo MEU gate (1ª linha, antes de unsetDefault/INSERT/ghost) ──
  record('T1 scopeActor bloqueado → 403 ACTOR_EFFECTIVELY_BLOCKED (gate antes de unsetDefault+create)', isBlocked403((await create(oA.actorId, oA.actorId, false)).err));
  // ── T2 — isDefault=true bloqueado → 403 (a tábua do default não abre; gate antes do unsetDefaultForActor) ──
  record('T2 scopeActor bloqueado isDefault=true → 403 (gate antes da tábua do default)', isBlocked403((await create(oA.actorId, oA.actorId, true)).err));
  // ── T3 — acting/createdBy bloqueado, scope (oB) ATIVO → 403 ──
  record('T3 acting/createdBy bloqueado (scope ativo) → 403', isBlocked403((await create(oB.actorId, x.actorId, false)).err));
  // ── T4 — scope (oA) bloqueado, acting (oB) ATIVO → 403 ──
  record('T4 scopeActor bloqueado (acting ativo) → 403', isBlocked403((await create(oA.actorId, oB.actorId, false)).err));
  // ── T5 — não-bloqueado (oB/oB): gate DEIXA PASSAR → erro downstream ≠ gate (payment_methods GHOST) ──
  {
    const r = await create(oB.actorId, oB.actorId, false);
    record('T5 não-bloqueado → gate deixa passar (erro downstream ≠ ACTOR_EFFECTIVELY_BLOCKED; payment_methods ghost)', r.ok === false && !isBlocked403(r.err), JSON.stringify(r.err));
  }
  // ── T6 — payment_methods é GHOST no FULL (contenção explícita > acidental) ──
  record('T6 payment_methods ghost no schema vivo (gate = contenção EXPLÍCITA, não a acidental 42P01)', (await count(`SELECT (to_regclass('public.payment_methods') IS NOT NULL)::int AS n`)) === 0);

  // ── NÃO-REGRESSÃO / MONEY-FREE ──
  record('T7 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oA.userId, oA.actorId)) === true);
  record('T8 zero payment_intents (payment-method é declarativo, não executa)', (await count(piSql).catch(() => 0)) === piBefore, `before=${piBefore}`);
  record('T9 Δbank=0 (nenhum bank_* tocado)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);
  record('T10 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ actor bloqueado não cria/defaulta método (gate antes de unsetDefault+create); payment-method declarativo; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

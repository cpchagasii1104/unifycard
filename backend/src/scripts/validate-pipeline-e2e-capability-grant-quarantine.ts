/**
 * E2E F-CAPABILITY-GRANT-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-capability-grant-quarantine-ephemeral.ps1.
 *
 * Prova que um actor de escopo EFETIVAMENTE BLOQUEADO (atl_blocked_actors) não pode conceder nem revogar
 * capability grants, embora a REPRESENTAÇÃO continue pura:
 *   • não-bloqueado → grant OK · revoke OK;
 *   • bloqueado → grant 403 ACTOR_EFFECTIVELY_BLOCKED (nenhum grant nasce);
 *   • bloqueado → revoke 403 (grant existente NÃO muda);
 *   • canRepresentActor permanece TRUE mesmo bloqueado (representação ≠ autoridade-ativa);
 *   • Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { actorCapabilityGrantService } from '../modules/authority/actor-capability-grant.service';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { status?: number; msg: string } => ({ status: e?.statusCode, msg: e?.message || String(e) });

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/capability|grant|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedUser(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + (seq += 191)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${cpf}@e2e.test`, gu]);
  const a = await ensureUserActor(tenantId, userId);
  return { userId, actorId: a.actor_id };
}
const tryGrant = (tenantId: string, scope: { userId: string; actorId: string }, grantee: string) =>
  actorCapabilityGrantService.grant(tenantId, { granteeActorId: grantee, capabilityKey: 'services:create' as any, scopeActorId: scope.actorId, grantedByUserId: scope.userId, grantedByActorId: scope.actorId, eventReason: 'e2e quarantine' })
    .then((g) => ({ ok: true, id: g.grantId } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

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
  await tenantService.createTenant({ id: tenantId, name: 'Cap Grant Quarantine', slug: `cgq-${Date.now()}` });
  const A = await seedUser(tenantId, 'Scope A'); // concedente/escopo (auto-representável)
  const B = await seedUser(tenantId, 'Grantee B');
  const C = await seedUser(tenantId, 'Grantee C');

  const grantsSql = `SELECT count(*)::int AS n FROM actor_capability_grants WHERE tenant_id=$1 AND scope_actor_id=$2`;
  const bankSql = `SELECT ((SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1 — não-bloqueado: grant OK ──
  let grant1: string | undefined; let grant2: string | undefined;
  {
    const r = await tryGrant(tenantId, A, B.actorId);
    grant1 = r.id;
    record('T1 escopo não-bloqueado → grant OK', r.ok === true && !!r.id, JSON.stringify(r.err));
  }
  // ── T2 — não-bloqueado: revoke OK ──
  {
    let ok = false; let msg = '';
    try { await actorCapabilityGrantService.revoke(tenantId, grant1!, { userId: A.userId, actorId: A.actorId }, 'e2e quarantine revoke'); ok = true; } catch (e) { msg = errOf(e).msg; }
    record('T2 escopo não-bloqueado → revoke OK', ok, msg);
  }
  // grant2 (ativo) para o teste de revoke-bloqueado
  { const r = await tryGrant(tenantId, A, C.actorId); grant2 = r.id; }

  const grantsBeforeBlock = await count(grantsSql, [tenantId, A.actorId]);

  // ── bloquear o actor de escopo A ──
  await pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [A.actorId, tenantId]);

  // ── T3 — bloqueado: grant → 403 ACTOR_EFFECTIVELY_BLOCKED ──
  {
    const r = await tryGrant(tenantId, A, B.actorId);
    record('T3 escopo bloqueado → grant 403 ACTOR_EFFECTIVELY_BLOCKED', r.ok === false && r.err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(r.err?.msg || ''), JSON.stringify(r.err));
  }
  // ── T4 — bloqueado: nenhum grant novo nasceu ──
  record('T4 bloqueado → nenhum grant novo (contagem inalterada)', (await count(grantsSql, [tenantId, A.actorId])) === grantsBeforeBlock, `before=${grantsBeforeBlock}`);

  // ── T5 — bloqueado: revoke → 403 (grant existente NÃO muda) ──
  {
    const r = await actorCapabilityGrantService.revoke(tenantId, grant2!, { userId: A.userId, actorId: A.actorId }, 'e2e quarantine revoke').then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    const stillActive = await count(`SELECT count(*)::int AS n FROM actor_capability_grants WHERE grant_id=$1 AND revoked_at IS NULL`, [grant2]);
    record('T5 escopo bloqueado → revoke 403 e grant existente intacto (não revogado)', r.ok === false && r.err?.status === 403 && stillActive === 1, `${JSON.stringify(r.err)} active=${stillActive}`);
  }

  // ── T6 — representação permanece PURA (bloqueio não afeta canRepresentActor) ──
  {
    const canRep = await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId);
    record('T6 canRepresentActor segue TRUE mesmo bloqueado (representação ≠ autoridade-ativa)', canRep === true, `canRep=${canRep}`);
  }

  // ── T7 — Δbank=0 ──
  record('T7 Δbank=0 (capability grant é não-financeiro)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ escopo bloqueado não concede/revoga capability (403); grant existente intacto; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

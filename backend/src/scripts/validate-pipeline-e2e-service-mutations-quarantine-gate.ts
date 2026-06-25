/**
 * E2E F-SERVICE-MUTATIONS-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-service-mutations-quarantine-gate-ephemeral.ps1.
 *
 * Prova que capability/representação DECIDE permissão e quarentena DECIDE se o actor está ATIVO:
 *   • não-bloqueados criam/editam/pausam (owner E grantee-com-grant) → OK (composição capability preservada);
 *   • scopeActor (dono) bloqueado → 403 (mesmo com grant válido do operador);
 *   • grantee/operador bloqueado → 403 (grant antigo NÃO atravessa ATL);
 *   • owner bloqueado → 403; nenhuma escrita quando bloqueado;
 *   • required caps exatas preservadas (edit-only NÃO pausa);
 *   • canRepresentActor puro; schedules vazio; Δbank=0.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { professionalC1Repository } from '../core/profile/professional-c1/professional-c1.repository';
import { servicesService } from '../modules/services/services.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';
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
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
const isBlocked403 = (err: any): boolean => err?.status === 403 && /ACTOR_EFFECTIVELY_BLOCKED/.test(`${err?.code || ''} ${err?.msg || ''}`);
const SERVICOS_CATEGORY_ID = '11200000-0000-0000-0000-000000000103';

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/service|mutation|quarantine|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 71).padStart(11, '0').slice(-11);
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Service Mutations Quarantine', slug: `smq-${Date.now()}` });

  const conceptId = randomUUID();
  { const gc = await pool.connect(); try { await gc.query('BEGIN'); await gc.query(`SELECT set_config('app.concept_governance','true', true)`); await gc.query(`INSERT INTO concepts (concept_id, slug, domain) VALUES ($1::uuid,$2,'servicos')`, [conceptId, `smq-${conceptId.slice(0, 8)}`]); await gc.query('COMMIT'); } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); } }
  const canonicalId = randomUUID();
  await pool.query(`INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status) VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`, [canonicalId, TENANT_ID, conceptId, 'SMQ Canonical', `smq-canonical-${canonicalId.slice(0, 8)}`]);

  const oA = await seedActor(TENANT_ID, 'OwnerA');   // dono — grants full ao grantee
  const oB = await seedActor(TENANT_ID, 'OwnerB');   // dono — usado p/ scope-blocked com grantee ativo
  const g = await seedActor(TENANT_ID, 'GranteeOp'); // operador com grant
  const g2 = await seedActor(TENANT_ID, 'GranteeEditOnly'); // operador só com services:edit (composição)
  await professionalC1Repository.declareConcept(TENANT_ID, oA.actorId, { conceptId, skillLevel: 3 });
  await professionalC1Repository.declareConcept(TENANT_ID, oB.actorId, { conceptId, skillLevel: 3 });

  // grants (fase sem ninguém bloqueado): owner→grantee full; ownerB→grantee create; ownerA→grantee2 edit-only
  const grant = (granteeActorId: string, cap: string, scopeUser: { userId: string; actorId: string }) =>
    actorCapabilityGrantService.grant(TENANT_ID, { granteeActorId, capabilityKey: cap as any, scopeActorId: scopeUser.actorId, grantedByUserId: scopeUser.userId, grantedByActorId: scopeUser.actorId });
  for (const cap of ['services:create', 'services:edit', 'services:disable']) await grant(g.actorId, cap, oA);
  await grant(g.actorId, 'services:create', oB);
  await grant(g2.actorId, 'services:edit', oA);

  const mkCreate = (scope: string, asUser: string) =>
    servicesService.createService(TENANT_ID, asUser, { actorId: scope, name: `Svc-${seq++}`, categoryId: SERVICOS_CATEGORY_ID, canonicalServiceId: canonicalId, serviceType: ServiceType.SERVICE })
      .then((s) => ({ ok: true, id: s.serviceId } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
  const mkUpdate = (serviceId: string, asUser: string, input: any) =>
    servicesService.updateService(TENANT_ID, serviceId, asUser, input).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── FASE OK (ninguém bloqueado) ──
  const r1 = await mkCreate(oA.actorId, oA.userId); record('T1 owner não-bloqueado cria → OK', r1.ok === true && !!r1.id);
  const s1 = r1.id;
  const r2 = await mkCreate(oA.actorId, g.userId); record('T2 grantee com services:create (não-bloqueado) cria → OK', r2.ok === true && !!r2.id);
  const s2 = r2.id;
  record('T3 owner edita campo → OK', (await mkUpdate(s1, oA.userId, { name: 'Edit Owner' })).ok === true);
  record('T4 grantee services:edit edita campo → OK', (await mkUpdate(s2, g.userId, { name: 'Edit Grantee' })).ok === true);
  record('T5 grantee services:disable pausa → OK', (await mkUpdate(s2, g.userId, { status: ServiceStatus.PAUSED })).ok === true);
  record('T6 reativar paused→active = services:edit → OK', (await mkUpdate(s2, g.userId, { status: ServiceStatus.ACTIVE })).ok === true);
  // composição: grantee2 só com services:edit NÃO pode pausar (precisa services:disable)
  record('T7 grantee edit-only tenta pausar → 403 (required caps exatas; edit ≠ disable)', (await mkUpdate(s1, g2.userId, { status: ServiceStatus.PAUSED })).ok === false);

  // ── QUARENTENA ──
  // T8 scopeActor (oB) bloqueado, grantee ATIVO → 403
  await block(TENANT_ID, oB.actorId);
  record('T8 scopeActor bloqueado (grantee ativo, grant válido) → 403', isBlocked403((await mkCreate(oB.actorId, g.userId)).err));
  // T9 grantee bloqueado, scope (oA) ATIVO → 403 (grant antigo não atravessa ATL)
  await block(TENANT_ID, g.actorId);
  record('T9 grantee bloqueado (scope ativo) → 403 — grant antigo não atravessa quarentena', isBlocked403((await mkCreate(oA.actorId, g.userId)).err));
  record('T10 grantee bloqueado edita → 403', isBlocked403((await mkUpdate(s1, g.userId, { name: 'X' })).err));
  record('T11 grantee bloqueado pausa → 403', isBlocked403((await mkUpdate(s2, g.userId, { status: ServiceStatus.PAUSED })).err));
  // T12 owner (oA) bloqueado → 403 create e update
  const svcBefore = await count(`SELECT count(*)::int AS n FROM services WHERE tenant_id=$1 AND actor_id=$2`, [TENANT_ID, oA.actorId]);
  await block(TENANT_ID, oA.actorId);
  record('T12 owner bloqueado cria → 403', isBlocked403((await mkCreate(oA.actorId, oA.userId)).err));
  record('T13 owner bloqueado edita → 403', isBlocked403((await mkUpdate(s1, oA.userId, { name: 'Y' })).err));
  record('T14 bloqueado → nenhum service novo (contagem inalterada)', (await count(`SELECT count(*)::int AS n FROM services WHERE tenant_id=$1 AND actor_id=$2`, [TENANT_ID, oA.actorId])) === svcBefore, `before=${svcBefore}`);

  // ── NÃO-REGRESSÃO ──
  record('T15 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, oA.userId, oA.actorId)) === true);
  record('T16 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);
  record('T17 Δbank=0 (mutação de serviço é money-free)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ scopeActor/grantee bloqueado não cria/edita/pausa serviço (grant não atravessa ATL); composição capability preservada; canRepresentActor puro; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

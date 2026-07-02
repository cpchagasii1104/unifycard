/**
 * E2E — F-SERVICE-FEED-GETPOST-COLUMN-FIX (DT-SERVICE-FEED-BOOK-CTA-POST-ID-SCHEMA-MISMATCH).
 * NÃO MOVE DINHEIRO. Prova que `service-feed.plugin.ts::getPost` (WHERE post_id → WHERE id) revive o
 * caminho renderFeedItem/getAvailableActions SEM reabrir o drift owner_type='service' (DECISION-0156/A2c):
 * VIEW volta a renderizar para posts reais; BOOK permanece CONTIDO (fail-closed) para serviço
 * canônico-bound, mesmo com getPost corrigido — o predicado A2c não depende do bug do getPost, é
 * independente e continua mordendo.
 *
 *   A post com serviceId válido (canônico) → renderFeedItem retorna DTO (getPost funciona, VIEW possível)
 *   B getAvailableActions do mesmo post → [VIEW] apenas — BOOK CONTIDO mesmo com getPost corrigido (A2c)
 *   C post sem serviceId no metadata → renderFeedItem null, actions []
 *   D postId inexistente → getPost retorna null (WHERE id=$1 funciona, não trava/erra)
 *   E janela legada owner_type='service' ativa/futura NÃO habilita BOOK (drift 0156 continua fechado)
 *   F Δbank=0 · G guard estrutural verde (getpost-fix) · H guard A2c não regride
 *
 * 🔒 DB EFÊMERA (run-service-feed-getpost-column-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesFeedPlugin } from '../modules/services/service-feed.plugin';
import { FeedAction } from '../core/feed/feed-plugin.types';
import { ActorIntent } from '../modules/social/actor-intents.types';
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
  if (!/feed|getpost|column|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}
async function mkService(tenantId: string, ownerActorId: string, name: string, canonicalServiceId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`, canonicalServiceId])).rows[0].id;
}
async function mkPost(tenantId: string, actorId: string, metadata: Record<string, unknown>): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO posts (tenant_id, actor_id, content, intent, metadata) VALUES ($1::uuid,$2::uuid,'E2E post','service_offer',$3::jsonb) RETURNING id::text AS id`,
    [tenantId, actorId, JSON.stringify(metadata)]
  )).rows[0].id;
}
async function mkLegacyAvailability(tenantId: string, ownerId: string): Promise<void> {
  await pool.query(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'service',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb)`,
    [tenantId, ownerId, new Date('2026-12-08T12:00:00Z'), new Date('2026-12-08T13:00:00Z')]
  );
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
  await tenantService.createTenant({ id: TENANT, name: 'Service Feed GetPost Column Fix', slug: `sfgp-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero.');

  const alice = await mkUserActor(TENANT, 'Alice');
  const serviceId = await mkService(TENANT, alice.actorId, 'SvcAlice', canonicalServiceId);
  await mkLegacyAvailability(TENANT, serviceId); // janela legada ATIVA/FUTURA — não deve habilitar BOOK (A2c)

  const postWithService = await mkPost(TENANT, alice.actorId, { service_id: serviceId });
  const postWithoutService = await mkPost(TENANT, alice.actorId, {});
  const missingPostId = randomUUID();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  try {
    console.log('\n— getPost revivido (renderFeedItem/getAvailableActions) —');
    const dto = await servicesFeedPlugin.renderFeedItem(postWithService, 'post', ActorIntent.OFFER_SERVICE, { service_id: serviceId });
    record('A post com serviceId válido → renderFeedItem retorna DTO (getPost funciona)', !!dto && dto.id === postWithService, `dto=${JSON.stringify(dto)}`);

    const actions = await servicesFeedPlugin.getAvailableActions(postWithService, 'post', ActorIntent.OFFER_SERVICE);
    record('B getAvailableActions → [VIEW] apenas (BOOK CONTIDO mesmo com getPost corrigido — A2c independente)', actions.length === 1 && actions[0] === FeedAction.VIEW, `actions=${JSON.stringify(actions)}`);

    const dtoNoService = await servicesFeedPlugin.renderFeedItem(postWithoutService, 'post', ActorIntent.OFFER_SERVICE, {});
    const actionsNoService = await servicesFeedPlugin.getAvailableActions(postWithoutService, 'post', ActorIntent.OFFER_SERVICE);
    record('C post sem serviceId no metadata → renderFeedItem null, actions []', dtoNoService === null && actionsNoService.length === 0, `dto=${dtoNoService} actions=${JSON.stringify(actionsNoService)}`);

    const dtoMissing = await servicesFeedPlugin.renderFeedItem(missingPostId, 'post', ActorIntent.OFFER_SERVICE, { service_id: serviceId });
    record('D postId inexistente → getPost retorna null (WHERE id=$1 funciona, sem erro)', dtoMissing === null, `dto=${dtoMissing}`);

    console.log('\n— Drift 0156/A2c continua fechado —');
    const legacyCount = await count(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_type='service' AND owner_id=$2 AND status='active'`, [TENANT, serviceId]);
    record('E janela legada owner_type=service ATIVA existe no dado, mas NÃO aparece como BOOK (drift fechado)', legacyCount === 1 && actions.length === 1, `legacyCount=${legacyCount} actions=${JSON.stringify(actions)}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('F Δbank=0 (bank_ledger+transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g1 = 0; try { execSync('node scripts/audit-service-feed-getpost-column-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    record('G guard estrutural verde (getPost usa WHERE id=$1)', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-legacy-service-availability-feed-badge-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    record('H guard A2c não regride (BOOK fail-closed p/ canônico continua blindado)', g2 === 0);
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ getPost revivido (WHERE id=$1); VIEW renderiza; BOOK segue CONTIDO fail-closed pelo A2c (independente do fix); drift 0156 não reaberto; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

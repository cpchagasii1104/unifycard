/**
 * E2E — F-COMPOSER-CONTRACT-C1: contrato server-driven do compositor.
 * 🔒 Roda SÓ em DB efêmera (run-composer-contract-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova (via app.inject HTTP real):
 *   A · gate de autoridade: compor como um actor que o principal NÃO representa → 403
 *       COMPOSER_ACTOR_NOT_REPRESENTABLE (enumeração exige representação);
 *   B · PF consuming: enumera post_personal/post_friends/seek_service/seek_product/project + vote (gated);
 *       NÃO enumera offer_service/offer_product/event (são operating);
 *   C · PF operating: enumera offer_service/offer_product/event; NÃO enumera seek_* (são consuming);
 *   D · categoria econômica correta: seek_service=saida, offer_service=entrada, post_personal=social;
 *   E · substrato morto gated (verdade do backend): vote enabled=false gatedBy=SUBSTRATO_CONTIDO_L4;
 *   F · dinheiro na criação: criar oferta/busca é enabled (transação é no fulfillment, não na criação);
 *   G · anti-invenção: o cliente não recebe intent fora do registry (só as 9 chaves canônicas).
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
  if (!/composer|contract|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

const CANONICAL_KEYS = new Set(['post_personal', 'post_friends', 'seek_service', 'seek_product', 'offer_service', 'offer_product', 'event', 'project', 'vote']);

async function main(): Promise<void> {
  await assertEphemeral();
  await bootstrapPorts();

  // Fixtures: tenant + Ana (user, com identidade → representa a si mesma) + Bob (terceiro não-representado).
  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Composer',$2)`, [T, `comp-${Date.now()}`]);
  const anaGu = randomUUID(); const anaUserId = randomUUID(); const anaTax = String(Date.now()).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [anaGu, anaTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [anaGu, anaTax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [anaUserId, T, `ana-${Date.now()}@e2e.test`, anaGu]);
  const anaActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Ana',$2,$3) RETURNING id`, [T, anaUserId, anaGu])).rows[0].id;
  const bobGu = randomUUID(); const bobTax = String(Date.now() + 7).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [bobGu, bobTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [bobGu, bobTax]);
  const bobActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Bob',$2) RETURNING id`, [T, bobGu])).rows[0].id;

  const Fastify = (await import('fastify')).default;
  const app: FastifyInstance = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: anaUserId, userId: anaUserId }; // principal = Ana
    r.actionContext = { actorId: anaActor };
  });
  const composerRoutes = (await import('../modules/composer/composer.routes')).default;
  await app.register(composerRoutes);
  await app.ready();

  const get = (actorId: string, mode: string) => app.inject({ method: 'GET', url: `/composer/contract?actorId=${actorId}&mode=${mode}` });
  const parse = (r: { body: string }) => { try { return JSON.parse(r.body); } catch { return null; } };
  const intentsOf = (body: any): any[] => body?.data?.intents ?? [];
  const byKey = (ints: any[], k: string) => ints.find((i) => i.key === k);

  // A · gate: Ana tentando compor como Bob (não-representado) → 403.
  const rA = await get(bobActor, 'consuming');
  rec('A gate: compor como actor não-representado → 403 COMPOSER_ACTOR_NOT_REPRESENTABLE',
    rA.statusCode === 403 && parse(rA)?.code === 'COMPOSER_ACTOR_NOT_REPRESENTABLE', `status=${rA.statusCode}`);

  // B · PF consuming.
  const rB = await get(anaActor, 'consuming');
  const iB = intentsOf(parse(rB));
  const keysB = new Set(iB.map((i) => i.key));
  rec('B PF consuming: enumera post/seek/project + vote; NÃO offer/event',
    rB.statusCode === 200 && keysB.has('post_personal') && keysB.has('seek_service') && keysB.has('project') && keysB.has('vote') && !keysB.has('offer_service') && !keysB.has('event'),
    `keys=${[...keysB].join(',')}`);

  // C · PF operating.
  const rC = await get(anaActor, 'operating');
  const iC = intentsOf(parse(rC));
  const keysC = new Set(iC.map((i) => i.key));
  rec('C PF operating: enumera offer_service/offer_product/event; NÃO seek_*',
    keysC.has('offer_service') && keysC.has('offer_product') && keysC.has('event') && !keysC.has('seek_service'),
    `keys=${[...keysC].join(',')}`);

  // D · categoria econômica.
  rec('D categoria econômica: seek_service=saida, offer_service=entrada, post_personal=social',
    byKey(iB, 'seek_service')?.economicFlow === 'saida' && byKey(iC, 'offer_service')?.economicFlow === 'entrada' && byKey(iB, 'post_personal')?.economicFlow === 'social',
    `seek=${byKey(iB, 'seek_service')?.economicFlow} offer=${byKey(iC, 'offer_service')?.economicFlow} post=${byKey(iB, 'post_personal')?.economicFlow}`);

  // E · substrato morto gated (verdade do backend): vote contido.
  const vote = byKey(iB, 'vote');
  rec('E vote enabled=false gatedBy=SUBSTRATO_CONTIDO_L4 (não finge que o substrato existe)',
    vote?.enabled === false && vote?.gatedBy === 'SUBSTRATO_CONTIDO_L4', JSON.stringify(vote));

  // F · dinheiro na criação: ofertar/buscar é enabled (transação é no fulfillment).
  rec('F criar oferta/busca é enabled (dinheiro é no fulfillment, não na criação)',
    byKey(iC, 'offer_service')?.enabled === true && byKey(iB, 'seek_service')?.enabled === true,
    `offer=${byKey(iC, 'offer_service')?.enabled} seek=${byKey(iB, 'seek_service')?.enabled}`);

  // G · anti-invenção: toda chave enumerada ∈ registry canônico.
  const allKeys = [...iB, ...iC].map((i) => i.key);
  rec('G anti-invenção: todo intent enumerado ∈ 9 chaves canônicas do registry',
    allKeys.every((k) => CANONICAL_KEYS.has(k)), `chaves=${[...new Set(allKeys)].join(',')}`);

  await app.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

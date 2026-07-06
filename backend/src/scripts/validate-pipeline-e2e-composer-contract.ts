/**
 * E2E — F-COMPOSER-CONTRACT-C1: contrato server-driven do compositor, PROJETANDO o SSOT de intents.
 * 🔒 Roda SÓ em DB efêmera (run-composer-contract-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova (via app.inject HTTP real) que o compositor NÃO inventa vocabulário — projeta o governado:
 *   A · gate de autoridade: compor como actor não-representado → 403 COMPOSER_ACTOR_NOT_REPRESENTABLE;
 *   B · SSOT: toda chave enumerada ∈ enum ActorIntent (SHARE_CONTENT/OFFER_SERVICE/...), NUNCA
 *       chaves inventadas (post_personal/seek_service/economicFlow proibidos);
 *   C · consuming projeta SHARE_CONTENT/REQUEST_BOOKING/CREATE_PROJECT/START_VOTE; operating projeta
 *       OFFER_SERVICE/OFFER_PRODUCT/ANNOUNCE_EVENT;
 *   D · COERÊNCIA (Lei §5): o enabled do compositor == o veredito de actorIntentsService.validateIntent
 *       para o MESMO intent/actor (compositor e social respondem IGUAL — zero verdade paralela);
 *   E · sem economicFlow no payload (campo inventado removido).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { ActorIntent } from '../modules/social/actor-intents.types';

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

const INTENT_VALUES = new Set(Object.values(ActorIntent) as string[]);

async function main(): Promise<void> {
  await assertEphemeral();
  await bootstrapPorts();

  const T = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Composer',$2)`, [T, `comp-${Date.now()}`]);
  const anaGu = randomUUID(); const anaUserId = randomUUID(); const anaTax = String(Date.now()).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [anaGu, anaTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [anaGu, anaTax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [anaUserId, T, `ana-${Date.now()}@e2e.test`, anaGu]);
  const anaActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Ana',$2,$3) RETURNING id`, [T, anaUserId, anaGu])).rows[0].id;
  // actor_id populado (resolveForUser/validateIntent resolvem por id de actor).
  await pool.query(`UPDATE actors SET actor_id = id WHERE tenant_id=$1 AND actor_id IS NULL`, [T]);
  const bobGu = randomUUID(); const bobTax = String(Date.now() + 7).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [bobGu, bobTax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [bobGu, bobTax]);
  const bobActor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Bob',$2) RETURNING id`, [T, bobGu])).rows[0].id;
  await pool.query(`UPDATE actors SET actor_id = id WHERE tenant_id=$1 AND actor_id IS NULL`, [T]);

  const Fastify = (await import('fastify')).default;
  const app: FastifyInstance = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: anaUserId, userId: anaUserId };
    r.actionContext = { actorId: anaActor };
  });
  const composerRoutes = (await import('../modules/composer/composer.routes')).default;
  await app.register(composerRoutes);
  await app.ready();

  const get = (actorId: string, mode: string) => app.inject({ method: 'GET', url: `/composer/contract?actorId=${actorId}&mode=${mode}` });
  const parse = (r: { body: string }) => { try { return JSON.parse(r.body); } catch { return null; } };
  const intentsOf = (body: any): any[] => body?.data?.intents ?? [];

  // A · gate.
  const rA = await get(bobActor, 'consuming');
  rec('A gate: compor como actor não-representado → 403 COMPOSER_ACTOR_NOT_REPRESENTABLE',
    rA.statusCode === 403 && parse(rA)?.code === 'COMPOSER_ACTOR_NOT_REPRESENTABLE', `status=${rA.statusCode}`);

  const rCons = await get(anaActor, 'consuming');
  const iCons = intentsOf(parse(rCons));
  const rOper = await get(anaActor, 'operating');
  const iOper = intentsOf(parse(rOper));
  const keysCons = new Set(iCons.map((i) => i.intent));
  const keysOper = new Set(iOper.map((i) => i.intent));

  // B · SSOT: toda chave ∈ ActorIntent; nenhuma chave inventada.
  const allKeys = [...iCons, ...iOper].map((i) => i.intent);
  rec('B SSOT: toda chave enumerada ∈ enum ActorIntent (nenhuma inventada)',
    rCons.statusCode === 200 && allKeys.length > 0 && allKeys.every((k) => INTENT_VALUES.has(k)),
    `chaves=${[...new Set(allKeys)].join(',')}`);

  // C · conjuntos por modo, com as chaves GOVERNADAS.
  rec('C consuming projeta SHARE_CONTENT/REQUEST_BOOKING/CREATE_PROJECT/START_VOTE; operating OFFER_SERVICE/OFFER_PRODUCT/ANNOUNCE_EVENT',
    keysCons.has(ActorIntent.SHARE_CONTENT) && keysCons.has(ActorIntent.REQUEST_BOOKING) && keysCons.has(ActorIntent.CREATE_PROJECT) && keysCons.has(ActorIntent.START_VOTE) &&
    keysOper.has(ActorIntent.OFFER_SERVICE) && keysOper.has(ActorIntent.OFFER_PRODUCT) && keysOper.has(ActorIntent.ANNOUNCE_EVENT),
    `cons=${[...keysCons].join(',')} | oper=${[...keysOper].join(',')}`);

  // D · COERÊNCIA (Lei §5): enabled do compositor == veredito do validador central pro MESMO intent.
  const { actorIntentsService } = await import('../modules/social/actor-intents.service');
  let coherent = true; const mism: string[] = [];
  for (const it of [...iCons, ...iOper]) {
    const v = await actorIntentsService.validateIntent(T, anaActor, it.intent);
    if (v.valid !== it.enabled) { coherent = false; mism.push(`${it.intent}: composer=${it.enabled} vs validate=${v.valid}`); }
  }
  rec('D COERÊNCIA: enabled do compositor == validateIntent para cada intent (zero verdade paralela)',
    coherent, mism.join(' | '));

  // E · sem economicFlow no payload.
  rec('E payload NÃO carrega economicFlow (campo inventado removido)',
    [...iCons, ...iOper].every((i) => i.economicFlow === undefined),
    `tem_economicFlow=${[...iCons, ...iOper].some((i) => i.economicFlow !== undefined)}`);

  await app.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

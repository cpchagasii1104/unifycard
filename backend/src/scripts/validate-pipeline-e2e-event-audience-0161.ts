/**
 * E2E — DECISION-0161 (plateia de evento actor-adaptativa). 🔒 SÓ DB efêmera.
 *  A · contrato /events/audience-options: PF vê amigos/família; PAGE vê colaboradores/fornecedores;
 *  B · writer PATCH audience: organizer seta private+['familiar']; vocabulário inválido REJEITADO (CHECK);
 *  C · enforcement: viewer com aresta ACEITA 'familiar' VÊ; viewer com 'amigo' NÃO VÊ; sem aresta NÃO VÊ;
 *  D · public segue visível a todos (comportamento anterior preservado).
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string) => { results.push({ label: l, ok }); console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`); };

async function mkUser(T: string, nome: string) {
  const gu = randomUUID(); const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, `${nome}-${Date.now()}-${Math.floor(Math.random()*1e5)}@e2e.test`, gu]);
  const a = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user',$2,$3,$4) RETURNING id`, [T, nome, uid, gu])).rows[0].id;
  await pool.query(`UPDATE actors SET actor_id = id WHERE id = $1`, [a]);
  return { uid, actorId: a, gu };
}

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera: ${db}`);

  const T = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('T 0161','t-0161-${Date.now()}') RETURNING id`)).rows[0].id;
  const org = await mkUser(T, 'Organizadora');
  const irmao = await mkUser(T, 'Irmão');     // terá aresta 'familiar' aceita
  const amigo = await mkUser(T, 'Amigo');     // terá aresta 'amigo' aceita
  const estranho = await mkUser(T, 'Estranho'); // sem aresta

  // arestas aceitas no typed-edge (INSERT direto, status accepted)
  await pool.query(`INSERT INTO actor_relationships (tenant_id, from_actor_id, to_actor_id, status, requester_label, requested_at, responded_at, created_by_user_id) VALUES ($1,$2,$3,'accepted','familiar',NOW(),NOW(),$4)`, [T, irmao.actorId, org.actorId, irmao.uid]);
  await pool.query(`INSERT INTO actor_relationships (tenant_id, from_actor_id, to_actor_id, status, requester_label, requested_at, responded_at, created_by_user_id) VALUES ($1,$2,$3,'accepted','amigo',NOW(),NOW(),$4)`, [T, amigo.actorId, org.actorId, amigo.uid]);

  // app mínimo (padrão R2/follow): sessão injetada mutável + rotas de eventos
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const Fastify = (await import('fastify')).default;
  const app = Fastify({ logger: false });
  let sess = { uid: org.uid, actorId: org.actorId };
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: sess.uid, userId: sess.uid };
    r.actionContext = { actorId: sess.actorId };
  });
  const eventRoutes = (await import('../core/events/event.routes')).default;
  await app.register(eventRoutes, { prefix: '/events' });
  await app.ready();

  // A · contrato adaptativo (PF)
  const rA = await app.inject({ method: 'GET', url: '/events/audience-options' });
  const optsA = rA.statusCode === 200 ? JSON.parse(rA.body).data.options.map((o: any) => o.key) : [];
  rec('A contrato PF: amigos+família presentes, colaboradores AUSENTE',
    optsA.includes('friends') && optsA.includes('family') && !optsA.includes('collaborators'),
    `status=${rA.statusCode} keys=${optsA.join(',')}`);

  // evento da organizadora (INSERT direto mínimo, published)
  const evId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, datetime_start, timezone, currency, metadata, created_at, updated_at)
     VALUES ($1,$2,'user','SOCIAL','Festa da Família','published','public',NOW()+interval '7 day','America/Sao_Paulo','BRL','{}'::jsonb,NOW(),NOW()) RETURNING id`, [T, org.actorId]
  )).rows[0].id;

  // B · writer: organizer seta private+familiar; vocabulário inválido rejeitado
  const rB1 = await app.inject({ method: 'PATCH', url: `/events/${evId}/audience`, payload: { visibility: 'private', audienceRelationshipTypes: ['familiar'] } });
  const rB2 = await app.inject({ method: 'PATCH', url: `/events/${evId}/audience`, payload: { audienceRelationshipTypes: ['inventado'] } });
  const saved = (await pool.query<{ v: string; a: string[] }>(`SELECT visibility v, audience_relationship_types a FROM events WHERE id=$1`, [evId])).rows[0];
  rec('B writer: private+[familiar] gravado; tipo INVENTADO rejeitado pelo CHECK',
    rB1.statusCode === 200 && rB2.statusCode === 400 && saved.v === 'private' && saved.a?.[0] === 'familiar',
    `b1=${rB1.statusCode} b2=${rB2.statusCode} saved=${saved?.v}/${JSON.stringify(saved?.a)}`);

  // C · enforcement por relação (canViewEvent direto — unidade de decisão da leitura)
  const { canViewEvent } = await import('../core/events/event-visibility.service');
  const veIrmao = await canViewEvent(T, evId, irmao.uid);
  const veAmigo = await canViewEvent(T, evId, amigo.uid);
  const veEstranho = await canViewEvent(T, evId, estranho.uid);
  rec('C enforcement: familiar VÊ · amigo NÃO · estranho NÃO (fail-closed)',
    veIrmao === true && veAmigo === false && veEstranho === false,
    `familiar=${veIrmao} amigo=${veAmigo} estranho=${veEstranho}`);

  // D · public preservado
  await pool.query(`UPDATE events SET visibility='public', audience_relationship_types=NULL WHERE id=$1`, [evId]);
  rec('D public segue visível a todos (comportamento anterior)', await canViewEvent(T, evId, estranho.uid) === true);

  await app.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

/**
 * E2E — F-CULTURAL-CHECKIN-TARGET-AUTHORITY-BINDING-SLICE-A (DECISION-0113 residual · B1).
 * NÃO MOVE DINHEIRO. Prova que POST /cultural/events/:eventId/check-in NÃO grava presença em nome de actor
 * alheio declarado no body em AUTO/QR_CODE: self/representável passam pelo gate; alheio → 403 fail-closed
 * (CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE) ANTES de qualquer escrita; MANUAL preserva o gate de validador.
 *
 * CONTEXTO MATERIAL (achado do READ-FIRST): as tabelas `cultural_events`/`cultural_event_checkins` vivem em
 * migrations_archive — NÃO existem no dev nem no profile FULL. A rota é VIVA no código mas LATENTE (sem tabela).
 * Esta frente sela a autoridade PROATIVAMENTE (antes de a tabela voltar) — mesma doutrina do anti-revival.
 * O E2E cria SÓ a tabela-alvo `cultural_event_checkins` como SCAFFOLD descartável (DB efêmera, dropada) para
 * medir Δrows=0; o núcleo da prova é a FRONTEIRA DE AUTORIDADE (status+code), que o gate resolve ANTES do sink.
 *
 *   A AUTO sem target (self)               → NÃO é 403-target (passa o gate)
 *   B AUTO target=self                     → NÃO é 403-target
 *   C AUTO target=alheio não representável → 403 CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE
 *   D QR_CODE target=alheio não repr.      → 403 CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE
 *   E AUTO target=representável (delegação)→ NÃO é 403-target (passa o gate)
 *   F QR_CODE target=self                  → NÃO é 403-target
 *   G MANUAL target=alheio                 → NÃO é 403-target (MANUAL não cai no canRepresentActor; vai ao validador)
 *   H Δ cultural_event_checkins = 0        → nenhuma presença gravada em nenhum caso
 *   I Δbank=0 · J guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-cultural-checkin-target-authority-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/cultural|checkin|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT, name: 'Cultural Checkin Target Authority', slug: `ckta-${Date.now()}` });

  // SCAFFOLD descartável: só a tabela-alvo, para medir Δrows=0. (cultural_events é omitida de propósito —
  // a rota é latente; os casos que passam o gate falham DEPOIS, no getEvent ausente, com erro != 403-target.)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cultural_event_checkins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      event_id UUID NOT NULL,
      actor_id UUID NOT NULL,
      actor_type VARCHAR(20) NOT NULL,
      checked_in_by_actor_id UUID,
      checked_in_by_actor_type VARCHAR(20),
      check_in_method VARCHAR(20) NOT NULL,
      geo_lat DECIMAL(10,8), geo_lng DECIMAL(11,8),
      device_fingerprint VARCHAR(255), metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT cultural_event_checkins_unique UNIQUE (tenant_id, event_id, actor_id, actor_type)
    )`);

  const alice = await mkUserActor(TENANT, 'Alice');       // caller
  const stranger = await mkUserActor(TENANT, 'Stranger'); // alheio, NÃO representável
  const inst = await mkUserActor(TENANT, 'Inst');         // representável via delegação ativa

  // Delegação ativa alice → inst (canRepresentActor rule 5; sem checagem de escopo em canRepresentActor).
  await pool.query(
    `INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'[]'::jsonb,'active')`,
    [TENANT, alice.actorId, inst.actorId]
  );

  const EVENT_ID = randomUUID(); // evento inexistente (rota latente) — irrelevante p/ a fronteira de autoridade
  const ckCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM cultural_event_checkins`);
  const bankCount = (): Promise<number> => count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);
  const ckBefore = await ckCount();
  const bankBefore = await bankCount();

  const culturalRoutes = (await import('../modules/cultural/cultural.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    req.user = { id: uid, userId: uid, globalUserId: req.headers['x-test-gu'] };
    req.tenant = { id: TENANT };
  });
  await app.register(culturalRoutes);
  await app.ready();

  const post = (body: unknown) => app.inject({
    method: 'POST', url: `/events/${EVENT_ID}/check-in`,
    headers: { 'x-test-user-id': alice.userId, 'x-test-gu': alice.gu, 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
  const isTarget403 = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 403) return false;
    try { return JSON.parse(r.body)?.code === 'CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE'; } catch { return false; }
  };

  try {
    console.log('\n— Gate de autoridade AUTO/QR_CODE (target alheio bloqueado) —');
    const a = await post({ method: 'AUTO' });
    record('A AUTO sem target (self) → NÃO é 403-target (passa o gate)', !isTarget403(a), `status=${a.statusCode} body=${a.body.slice(0,120)}`);
    const b = await post({ method: 'AUTO', target_actor_id: alice.actorId });
    record('B AUTO target=self → NÃO é 403-target', !isTarget403(b), `status=${b.statusCode}`);
    const c = await post({ method: 'AUTO', target_actor_id: stranger.actorId });
    record('C AUTO target=alheio não representável → 403 CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE', isTarget403(c), `status=${c.statusCode} body=${c.body.slice(0,140)}`);
    const d = await post({ method: 'QR_CODE', qr_code: 'x', target_actor_id: stranger.actorId });
    record('D QR_CODE target=alheio não representável → 403 CULTURAL_CHECKIN_TARGET_NOT_REPRESENTABLE', isTarget403(d), `status=${d.statusCode} body=${d.body.slice(0,140)}`);
    const e = await post({ method: 'AUTO', target_actor_id: inst.actorId, target_actor_type: 'page' });
    record('E AUTO target=representável (delegação ativa) → NÃO é 403-target (passa o gate)', !isTarget403(e), `status=${e.statusCode} body=${e.body.slice(0,140)}`);
    const f = await post({ method: 'QR_CODE', qr_code: 'x', target_actor_id: alice.actorId });
    record('F QR_CODE target=self → NÃO é 403-target', !isTarget403(f), `status=${f.statusCode}`);

    console.log('\n— MANUAL preservado (não cai no gate de representação) —');
    const g = await post({ method: 'MANUAL', target_actor_id: stranger.actorId });
    record('G MANUAL target=alheio → NÃO é 403-target (vai ao validador canValidateCheckIn no service)', !isTarget403(g), `status=${g.statusCode} body=${g.body.slice(0,140)}`);

    console.log('\n— Invariantes —');
    record('H Δ cultural_event_checkins = 0 (nenhuma presença gravada em nenhum caso)', (await ckCount()) === ckBefore, `before=${ckBefore} after=${await ckCount()}`);
    record('I Δbank=0 (bank_ledger+transactions+splits inalterados)', (await bankCount()) === bankBefore, `before=${bankBefore} after=${await bankCount()}`);

    let guard = 0; try { execSync('node scripts/audit-cultural-checkin-target-authority.mjs', { cwd, encoding: 'utf8' }); } catch { guard = 1; }
    record('J guard estrutural verde (gate antes do sink; MANUAL preservado)', guard === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ check-in AUTO/QR_CODE: alheio não representável → 403 fail-closed antes do sink; self/representável passam o gate; MANUAL preservado; Δcheckins=0; Δbank=0. B1 selado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });

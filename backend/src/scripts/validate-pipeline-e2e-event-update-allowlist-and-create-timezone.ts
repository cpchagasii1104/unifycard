/**
 * E2E — DT-EVENT-PUBLISHED-UPDATE-ALLOWLIST-CASE-MISMATCH + DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC.
 * Money-free (Δbank=0). DB EFÊMERA (runner run-event-update-allowlist-and-create-timezone-ephemeral.ps1).
 * NUNCA unificard_dev.
 *
 * BUG A (allow-list case mismatch, event.service.ts#updateEvent): o allow-list de campos permitidos
 * num evento `published` comparava contra nomes em snake_case (`max_attendees`) enquanto
 * `Object.keys(input)` (UpdateEventInput) só produz camelCase (`maxAttendees`) — a comparação nunca
 * casava e TODO PATCH a um evento publicado era rejeitado, mesmo os 3 campos que o allow-list
 * pretendia permitir. Prova:
 *   A1 · DONO faz PATCH com os 3 campos do allow-list (description/max_attendees/metadata) num evento
 *        published → 200, e os 3 valores REALMENTE persistem (metadata é MERGE, não replace);
 *   A2 · DONO faz PATCH com um campo FORA do allow-list (visibility) no mesmo evento published →
 *        400 com a mensagem "não pode ter campos alterados", e o valor NÃO muda no banco.
 *
 * BUG B (timezone descartado, event.service.ts#createEvent): events.timezone tem DEFAULT 'UTC' mas o
 * INSERT nunca recebia o timezone do caller — todo evento nascia UTC mesmo quando o cliente informava
 * um fuso. Prova:
 *   B1 · POST /v2/create com event.timezone = 'America/Sao_Paulo' → evento persiste com esse fuso
 *        (antes do fix, persistiria 'UTC' silenciosamente);
 *   B2 · POST /v2/create SEM timezone → evento persiste 'UTC' (DEFAULT do banco preservado, zero
 *        regressão para quem nunca mandou nada).
 *
 *   C · Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/event|allowlist|timezone|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 31).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `evallowtz-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
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
  await tenantService.createTenant({ id: TENANT, name: 'Event Allowlist+Timezone E2E', slug: `evallowtz-${Date.now()}` });

  const owner = await mkUserActor(TENANT, 'Dono do Evento');

  const eventRoutes = (await import('../core/events/event.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(eventRoutes);
  await app.ready();

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  const eventTimezone = async (id: string) => (await pool.query<{ timezone: string }>(`SELECT timezone FROM events WHERE id=$1`, [id])).rows[0]?.timezone;
  const eventRow = async (id: string) => (await pool.query(`SELECT description, max_attendees, metadata, visibility FROM events WHERE id=$1`, [id])).rows[0];

  try {
    console.log('\n— event update-allowlist + create-timezone END-TO-END —');
    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // ── BUG B: timezone no create-path (POST /v2/create) ──

    // B1 · timezone explícito persiste (antes do fix, cairia em 'UTC' silenciosamente)
    const rCreateTz = await call('POST', '/v2/create', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: {
        event: {
          actor_id: owner.actorId,
          actor_type: 'user',
          title: 'Evento com fuso declarado',
          visibility: 'public',
          timezone: 'America/Sao_Paulo',
        },
      },
    });
    let createdIdTz = '';
    try { createdIdTz = JSON.parse(rCreateTz.body)?.event?.id; } catch { /* noop */ }
    const tzPersisted = createdIdTz ? await eventTimezone(createdIdTz) : undefined;
    record(
      'B1 POST /v2/create com timezone=America/Sao_Paulo → persiste America/Sao_Paulo (não UTC)',
      rCreateTz.statusCode === 200 && tzPersisted === 'America/Sao_Paulo',
      `status=${rCreateTz.statusCode} eventId=${createdIdTz} timezone=${tzPersisted}`
    );

    // B2 · omitindo timezone, o DEFAULT 'UTC' do banco continua valendo (zero regressão)
    const rCreateNoTz = await call('POST', '/v2/create', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: {
        event: {
          actor_id: owner.actorId,
          actor_type: 'user',
          title: 'Evento sem fuso declarado',
          visibility: 'public',
        },
      },
    });
    let createdIdNoTz = '';
    try { createdIdNoTz = JSON.parse(rCreateNoTz.body)?.event?.id; } catch { /* noop */ }
    const tzDefault = createdIdNoTz ? await eventTimezone(createdIdNoTz) : undefined;
    record(
      'B2 POST /v2/create SEM timezone → DEFAULT UTC preservado',
      rCreateNoTz.statusCode === 200 && tzDefault === 'UTC',
      `status=${rCreateNoTz.statusCode} eventId=${createdIdNoTz} timezone=${tzDefault}`
    );

    // ── BUG A: allow-list de PATCH em evento published ──

    // Evento published inserido direto (setup), com metadata prévia para provar MERGE (não replace).
    const publishedId1 = randomUUID();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, description, status, visibility, max_attendees, metadata, timezone, created_at, updated_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'user','social','Evento Publicado','Descrição original','published','public',100,'{"existing_key":"kept"}'::jsonb,'UTC',NOW(),NOW())`,
      [publishedId1, TENANT, owner.actorId]
    );

    // A1 · os 3 campos do allow-list (description/max_attendees/metadata) → 200 e persistem de verdade.
    // ANTES do fix: 400 (allowedFields snake_case nunca casava com as chaves camelCase de `input`).
    const rAccept = await call('PATCH', `/${publishedId1}`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: {
        description: 'Descrição atualizada pelo dono',
        max_attendees: 250,
        metadata: { note: 'campo novo' },
      },
    });
    const afterAccept = await eventRow(publishedId1);
    record(
      'A1 PATCH published com allow-list (description/max_attendees/metadata) → 200, persiste',
      rAccept.statusCode === 200
        && afterAccept?.description === 'Descrição atualizada pelo dono'
        && afterAccept?.max_attendees === 250
        && afterAccept?.metadata?.existing_key === 'kept' // MERGE preserva chave prévia
        && afterAccept?.metadata?.note === 'campo novo',   // MERGE inclui a chave nova
      `status=${rAccept.statusCode} row=${JSON.stringify(afterAccept)}`
    );

    // A2 · campo FORA do allow-list (visibility) no mesmo evento published → 400, valor inalterado.
    const rReject = await call('PATCH', `/${publishedId1}`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { visibility: 'connections' },
    });
    let rejectMsg = '';
    try { rejectMsg = JSON.parse(rReject.body)?.error?.message || JSON.parse(rReject.body)?.message || ''; } catch { /* noop */ }
    const afterReject = await eventRow(publishedId1);
    record(
      'A2 PATCH published com campo fora do allow-list (visibility) → 400, valor inalterado',
      rReject.statusCode === 400
        && /não pode ter campos alterados/.test(rejectMsg)
        && afterReject?.visibility === 'public',
      `status=${rReject.statusCode} msg="${rejectMsg}" visibility=${afterReject?.visibility}`
    );

    // ── Δbank = 0 ──
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('C Δbank=0', bankBefore.rows[0].n === bankAfter.rows[0].n, `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});

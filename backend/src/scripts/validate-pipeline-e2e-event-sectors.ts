/**
 * E2E — SLICE S3 (SETORES): setor SELF-CONTAINED (event_sectors) com pool COMPARTILHADO (capacity),
 * preço INTEIRA (cheio) e preço MEIA legalmente pisado. Prova, POR API DIRETA HTTP-real (app.inject na
 * rota REAL — "a verdade vive no backend"), que:
 *   (1) organizador cria evento (max_attendees=5000) e POSTA setor 1 (Arquibancada, cap 5000, quota 4000,
 *       inteira 70000, meia 35000) → 201; a linha persiste + teto de meia derivado = floor(5000*4000/10000)=2000;
 *   (2) meia_quota_bps=3000 (30%) → 400 SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR (piso legal: DB CHECK + espelho);
 *   (3) quota 4000 e 10000 (limites) → aceitos;
 *   (4) meia_price_cents > inteira_price_cents → 400 SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA;
 *   (5) segundo setor fazendo SUM(capacity) > max_attendees → 400 SECTOR_CAPACITY_EXCEEDS_EVENT;
 *   (6) preços são DECLARADOS — ZERO linha em ticket_sales / bank / orders;
 *   (7) não-dono → 403 EVENT_SECTOR_ACTOR_NOT_AUTHORIZED, ZERO escrita;
 *   (8) Δbank=0.
 * DB efêmera. NUNCA unificard_dev.
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
  if (!/sector|setor|event|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 47).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `sector-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function seedPublishedEvent(tenantId: string, organizerActorId: string, maxAttendees: number): Promise<string> {
  const row = (
    await pool.query<{ id: string }>(
      `INSERT INTO events (tenant_id, actor_id, actor_type, title, status, visibility, max_attendees)
       VALUES ($1::uuid, $2::uuid, 'user', 'Jogo no Estádio', 'published', 'public', $3) RETURNING id::text AS id`,
      [tenantId, organizerActorId, maxAttendees]
    )
  ).rows[0];
  return row.id;
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
  await tenantService.createTenant({ id: TENANT, name: 'Event Sectors E2E', slug: `sector-${Date.now()}` });

  const organizer = await mkUserActor(TENANT, 'Organizador Real');
  const attacker = await mkUserActor(TENANT, 'Atacante');

  // eventA: max_attendees=5000 (SSOT do teto) — testes de criação e reconciliação.
  const eventId = await seedPublishedEvent(TENANT, organizer.actorId, 5000);
  // eventB: max_attendees folgado (100000) — isola os testes de FAIXA (piso/limites/meia<=inteira) da
  // reconciliação (que reduziria o headroom): o setor 1 do eventA já consome os 5000, então os testes de
  // aceitação de limites precisam de um evento com folga. A reconciliação permanece ATIVA no eventB.
  const eventBId = await seedPublishedEvent(TENANT, organizer.actorId, 100000);

  const eventsSprint76Routes = (await import('../modules/events/events-sprint76.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` } : null;
  });
  await app.register(eventsSprint76Routes);
  await app.ready();

  const call = (method: 'POST' | 'GET', url: string, opts: { userId?: string; body?: unknown }) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as object,
    });

  const countSectors = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM event_sectors WHERE event_id = $1`, [eventId])).rows[0].n);
  const count = async (t: string): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n);
  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;

  try {
    console.log('\n— setor SELF-CONTAINED (event_sectors) com inteira/meia (piso legal 40%) —');
    const bankBefore = await bankSnap();
    const ticketSalesBefore = await count('ticket_sales');
    const ordersBefore = await count('orders');

    // (7) não-dono tenta criar setor → 403, ZERO escrita (rodado primeiro p/ provar contenção).
    {
      const cBefore = await countSectors();
      const r = await call('POST', `/events/${eventId}/sectors`, {
        userId: attacker.userId,
        body: { sectorNumber: 1, name: 'Arquibancada', capacity: 5000, meiaQuotaBps: 4000, inteiraPriceCents: 70000, meiaPriceCents: 35000 },
      });
      const b = JSON.parse(r.body || '{}');
      record('(7) não-dono cria setor → 403 EVENT_SECTOR_ACTOR_NOT_AUTHORIZED, ZERO escrita',
        r.statusCode === 403 && b?.code === 'EVENT_SECTOR_ACTOR_NOT_AUTHORIZED' && (await countSectors()) === cBefore,
        `status=${r.statusCode} code=${b?.code}`);
    }

    // (1) organizador cria setor 1 → 201, row persiste + teto de meia derivado = floor(5000*4000/10000)=2000.
    let sector1Id = '';
    {
      const r = await call('POST', `/events/${eventId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 1, name: 'Arquibancada', capacity: 5000, meiaQuotaBps: 4000, inteiraPriceCents: 70000, meiaPriceCents: 35000 },
      });
      const b = JSON.parse(r.body || '{}');
      sector1Id = b?.id ?? '';
      const row = sector1Id
        ? (await pool.query(`SELECT sector_number, name, capacity, meia_quota_bps, inteira_price_cents::bigint AS inteira, meia_price_cents::bigint AS meia FROM event_sectors WHERE id = $1`, [sector1Id])).rows[0]
        : null;
      // teto de meia derivado = floor(capacity * meia_quota_bps / 10000) — computado no assert (não é coluna).
      const derivedMeiaCeiling = row ? Math.floor(Number(row.capacity) * Number(row.meia_quota_bps) / 10000) : -1;
      record('(1) organizador cria setor 1 → 201 + row persiste + teto meia derivado floor(5000*4000/10000)=2000',
        r.statusCode === 201 && !!sector1Id && !!row &&
        row.sector_number === 1 && row.name === 'Arquibancada' && Number(row.capacity) === 5000 &&
        Number(row.meia_quota_bps) === 4000 && Number(row.inteira) === 70000 && Number(row.meia) === 35000 &&
        derivedMeiaCeiling === 2000,
        `status=${r.statusCode} row=${JSON.stringify(row)} derivedMeiaCeiling=${derivedMeiaCeiling}`);
    }

    const countSectorsB = async (): Promise<number> =>
      Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM event_sectors WHERE event_id = $1`, [eventBId])).rows[0].n);

    // (2) meia_quota_bps=3000 (30%) → 400 (piso legal: DB CHECK + espelho do writer). eventB (folga).
    {
      const cBefore = await countSectorsB();
      const r = await call('POST', `/events/${eventBId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 10, name: 'Gramado', capacity: 100, meiaQuotaBps: 3000, inteiraPriceCents: 50000, meiaPriceCents: 25000 },
      });
      const b = JSON.parse(r.body || '{}');
      record('(2) meia_quota_bps=3000 (30% < piso legal 40%) → 400 SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR, ZERO escrita',
        r.statusCode === 400 && b?.code === 'SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR' && (await countSectorsB()) === cBefore,
        `status=${r.statusCode} code=${b?.code}`);
    }

    // (3) quota nos limites 4000 e 10000 → aceitos (eventB tem folga de max_attendees; reconciliação ATIVA).
    {
      const r4000 = await call('POST', `/events/${eventBId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 1, name: 'Setor 4000', capacity: 10, meiaQuotaBps: 4000, inteiraPriceCents: 40000, meiaPriceCents: 20000 },
      });
      const r10000 = await call('POST', `/events/${eventBId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 2, name: 'Setor 10000', capacity: 10, meiaQuotaBps: 10000, inteiraPriceCents: 40000, meiaPriceCents: 40000 },
      });
      record('(3) meia_quota_bps 4000 e 10000 (limites da faixa legal) → aceitos (201)',
        r4000.statusCode === 201 && r10000.statusCode === 201,
        `status4000=${r4000.statusCode} status10000=${r10000.statusCode}`);
    }

    // (4) meia_price_cents > inteira_price_cents → 400. eventB (folga; falha antes da reconciliação).
    {
      const cBefore = await countSectorsB();
      const r = await call('POST', `/events/${eventBId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 3, name: 'Invertido', capacity: 10, meiaQuotaBps: 5000, inteiraPriceCents: 30000, meiaPriceCents: 40000 },
      });
      const b = JSON.parse(r.body || '{}');
      record('(4) meia_price_cents (40000) > inteira_price_cents (30000) → 400 SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA, ZERO escrita',
        r.statusCode === 400 && b?.code === 'SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA' && (await countSectorsB()) === cBefore,
        `status=${r.statusCode} code=${b?.code}`);
    }

    // (5) segundo setor fazendo SUM(capacity) > max_attendees (5000 já usado no setor 1) → 400.
    {
      const cBefore = await countSectors();
      const r = await call('POST', `/events/${eventId}/sectors`, {
        userId: organizer.userId,
        body: { sectorNumber: 6, name: 'Excede', capacity: 4000, meiaQuotaBps: 4000, inteiraPriceCents: 30000, meiaPriceCents: 15000 },
      });
      const b = JSON.parse(r.body || '{}');
      record('(5) SUM(capacity) > events.max_attendees (5000) → 400 SECTOR_CAPACITY_EXCEEDS_EVENT, ZERO escrita',
        r.statusCode === 400 && b?.code === 'SECTOR_CAPACITY_EXCEEDS_EVENT' && (await countSectors()) === cBefore,
        `status=${r.statusCode} code=${b?.code}`);
    }

    // (6) preços são DECLARADOS — ZERO linha em ticket_sales / orders.
    record('(6) preços DECLARADOS — ZERO linha em ticket_sales/orders (venda = PORTA-01, FORA)',
      (await count('ticket_sales')) === ticketSalesBefore && (await count('orders')) === ordersBefore,
      `ticket_sales ${ticketSalesBefore}→${await count('ticket_sales')} orders ${ordersBefore}→${await count('orders')}`);

    // (8) Δbank=0.
    const bankAfter = await bankSnap();
    record('(8) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado)', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);
  } finally {
    await app.close();
  }

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

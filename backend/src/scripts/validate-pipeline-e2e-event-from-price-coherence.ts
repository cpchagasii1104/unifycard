/**
 * E2E — F-EVENT-FROM-PRICE-COHERENCE (G0 · mandato 2026-08-01 v2). 🔒 SÓ DB efêmera.
 *
 * Prova que `eventService.getEvent().ticketPriceCents` (core/events/event.service.ts) deriva o
 * "a partir de" por IGUALDADE, não por teto ("<="). O defeito original (medido em unificard_dev,
 * evento 948b0278: ticket_price_cents=5000, setor mais barato=8000) PASSARIA num guard "<=" (5000
 * <= 8000) — esse é exatamente o teste que este script força: um evento com raw ENTRE zero e o
 * mínimo real do setor, para que qualquer implementação por teto/mínimo-de-dois erre.
 *
 *  A · COM setor, raw < setor mínimo (a mentira original) → deriva = setor mínimo (IGUALDADE)
 *  B · COM setor, raw = setor mínimo (já coerente) → NÃO regride, continua o mesmo valor
 *  C · SEM setor → mantém ticket_price_cents cru
 *  D · tipo do retorno é NUMBER nos 3 casos (não string) — regressão real encontrada e corrigida
 *      nesta mesma fatia (BIGINT do pg vem string; só o ramo com setor coagia, o ramo sem setor não)
 *  E · a coluna `ticket_price_cents` NUNCA é escrita por esta leitura (derivação, não persistência)
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (l: string, ok: boolean, r?: string) => {
  results.push({ label: l, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`);
};

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera: ${db}`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { ensureUserActor } = await import('../modules/identity/actor-writer.service');

  const T = (
    await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('T FROM-PRICE','t-fromprice-${Date.now()}') RETURNING id`
    )
  ).rows[0].id;

  const gu = randomUUID();
  const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, `dono-${Date.now()}@e2e.test`, gu]);
  const actor = await ensureUserActor(T, uid);
  const actorId = actor.actor_id;

  async function mkEvent(ticketPriceCents: number, title: string): Promise<string> {
    const id = (
      await pool.query<{ id: string }>(
        `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility,
           datetime_start, timezone, currency, ticket_price_cents, metadata, created_at, updated_at)
         VALUES ($1,$2,'user','SHOW',$3,'draft','public',NOW()+interval '5 day','America/Sao_Paulo','BRL',$4,'{}'::jsonb,NOW(),NOW())
         RETURNING id`,
        [T, actorId, title, ticketPriceCents]
      )
    ).rows[0].id;
    return id;
  }

  async function mkSector(eventId: string, inteiraPriceCents: number, num: number): Promise<void> {
    await pool.query(
      `INSERT INTO event_sectors (tenant_id, event_id, sector_number, name, capacity, meia_quota_bps, inteira_price_cents, meia_price_cents, created_at, updated_at)
       VALUES ($1,$2,$3,$4,100,4000,$5,$6,NOW(),NOW())`,
      [T, eventId, num, `Setor ${num}`, inteiraPriceCents, Math.floor(inteiraPriceCents / 2)]
    );
  }

  // A · a mentira original: raw=5000, setor mínimo=8000 (mesmos números do achado real em unificard_dev)
  const eventMente = await mkEvent(5000, 'Mente');
  await mkSector(eventMente, 8000, 1);

  // B · já coerente: raw=5000, setor=5000
  const eventCoerente = await mkEvent(5000, 'Coerente');
  await mkSector(eventCoerente, 5000, 1);

  // C · sem setor: raw=5000, nenhum setor
  const eventSemSetor = await mkEvent(5000, 'SemSetor');

  const { eventService } = await import('../core/events/event.service');

  const evA = await eventService.getEvent(T, eventMente);
  rec(
    'A · raw(5000) < setor(8000) → deriva = 8000 (IGUALDADE, não teto "<=" — 5000<=8000 passaria num "<=" errado)',
    evA?.ticketPriceCents === 8000,
    `obtido=${evA?.ticketPriceCents}`
  );

  const evB = await eventService.getEvent(T, eventCoerente);
  rec('B · não-regressão: já coerente (5000=5000) continua 5000', evB?.ticketPriceCents === 5000, `obtido=${evB?.ticketPriceCents}`);

  const evC = await eventService.getEvent(T, eventSemSetor);
  rec('C · sem setor: mantém ticket_price_cents cru (5000)', evC?.ticketPriceCents === 5000, `obtido=${evC?.ticketPriceCents}`);

  rec(
    'D · tipo NUMBER nos 3 casos (não string — BIGINT do pg vem string; achado e corrigido nesta fatia)',
    typeof evA?.ticketPriceCents === 'number' && typeof evB?.ticketPriceCents === 'number' && typeof evC?.ticketPriceCents === 'number',
    `typeofA=${typeof evA?.ticketPriceCents} typeofB=${typeof evB?.ticketPriceCents} typeofC=${typeof evC?.ticketPriceCents}`
  );

  const rawAfterRead = await pool.query<{ ticket_price_cents: string }>(
    'SELECT ticket_price_cents FROM events WHERE id = $1',
    [eventMente]
  );
  rec(
    'E · derivação NÃO persiste: coluna crua de "Mente" continua 5000 depois da leitura',
    Number(rawAfterRead.rows[0]?.ticket_price_cents) === 5000,
    `coluna=${rawAfterRead.rows[0]?.ticket_price_cents}`
  );

  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? '✅ TODOS OS TESTES PASSARAM' : '❌ FALHOU'} (${results.filter((r) => r.ok).length}/${results.length})`);
  process.exit(allOk ? 0 : 1);
}

main()
  .catch((err) => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
  })
  .finally(() => pool.end());

/**
 * E2E — SLICE S2 (VENUE ENRICHMENT): captura do LOCAL do evento (Nome do Local + logradouro) REUTILIZANDO
 * o vocabulário JÁ canônico, ZERO coluna/tabela/role/migration nova. Prova, POR API DIRETA (camada de
 * serviço REAL — "a verdade vive no backend", nunca via frontend), que:
 *   (1) PATCH com venueCityId + venueStreet + venueNumber + venueComplement + locationName cria UMA linha
 *       addresses com street/number/complement populados + city_id + source='UX_INPUT';
 *   (2) cria address_assignments(owner_type='event', role='OPERATIONAL', is_primary=true, valid_until_at NULL);
 *   (3) events.metadata->>'location_name' persiste a chave canônica (REUSO, não coluna nova);
 *   (4) events.max_attendees INALTERADO pelo PATCH de venue (capacidade continua sendo max_attendees);
 *   (5) RE-PATCH → o primário anterior é FECHADO (valid_until set, is_primary=false) e há EXATAMENTE UM
 *       primário vigente (o índice parcial uidx_address_assignments_primary segura);
 *   (6) Δbank=0 (endereço é territorial, não dinheiro; PORTA-01 FORA).
 * DB efêmera. NUNCA unificard_dev.
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { eventService } from '../core/events/event.service';
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
  if (!/venue|enrichment|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 61).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `venue-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

// Cidade GOVERNADA (cities.city_id) sob state/country reais — é o city_id que o writer de venue resolve (geo CTE).
async function mkGovernedCity(name: string): Promise<string> {
  const rl = (): string => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  let country: string | null = null;
  for (let attempt = 0; attempt < 40 && !country; attempt += 1) {
    try {
      country = (await pool.query<{ id: string }>(
        `INSERT INTO countries (iso_alpha2, name) VALUES ($1, $2) RETURNING country_id::text AS id`,
        [rl() + rl(), `País ${name}`]
      )).rows[0].id;
    } catch (e: any) {
      if (!/unique|duplicad/i.test(String(e?.message ?? e))) throw e;
    }
  }
  if (!country) throw new Error('mkGovernedCity: não achou iso_alpha2 livre.');
  const stateId = (await pool.query<{ id: string }>(
    `INSERT INTO states (country_id, name) VALUES ($1::uuid, $2) RETURNING state_id::text AS id`, [country, `Estado ${name}`]
  )).rows[0].id;
  return (await pool.query<{ id: string }>(
    `INSERT INTO cities (state_id, name) VALUES ($1::uuid, $2) RETURNING city_id::text AS id`, [stateId, name]
  )).rows[0].id;
}

async function mkEvent(tenantId: string, actorId: string): Promise<string> {
  const start = new Date(Date.now() + 30 * 24 * 3600e3);
  const end = new Date(start.getTime() + 3 * 3600e3);
  const ev = await eventService.createEvent(tenantId, {
    actorId, actorType: 'user', title: 'Show comunitário (venue)',
    datetimeStart: start.toISOString(), datetimeEnd: end.toISOString(),
  });
  return ev.id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Venue Enrichment E2E', slug: `venue-${Date.now()}` });
  const org = await mkUserActor(TENANT, 'Organizador Venue');
  const cityId = await mkGovernedCity('Curitiba-E2E');

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— captura do LOCAL do evento reutilizando o vocabulário canônico (Δbank=0) —');

  const evId = await mkEvent(TENANT, org.actorId);

  // baseline de CAPACIDADE: max_attendees = 100 ANTES do venue-patch (para provar que o venue não mexe nela).
  await eventService.updateEvent(TENANT, evId, { maxAttendees: 100 } as any, org.actorId);

  // (1)+(2)+(3)+(4): PATCH de venue enrichment.
  await eventService.updateEvent(TENANT, evId, {
    venueCityId: cityId,
    venueStreet: 'Rua das Flores',
    venueNumber: '100',
    venueComplement: 'Sala 2',
    locationName: 'Casa da Cultura',
  } as any, org.actorId);

  // (1) linha addresses com street/number/complement + city_id + source.
  {
    const a = (await pool.query<{ street: string | null; number: string | null; complement: string | null; city_id: string | null; source: string | null }>(
      `SELECT a.street, a.number, a.complement, a.city_id::text AS city_id, a.source
         FROM address_assignments aa JOIN addresses a ON a.address_id = aa.address_id
        WHERE aa.owner_type='event' AND aa.owner_id=$1::uuid AND aa.role='OPERATIONAL' AND aa.is_primary=true AND aa.valid_until_at IS NULL`,
      [evId])).rows[0];
    record('(1) addresses: street/number/complement populados + city_id + source=UX_INPUT (colunas EXISTENTES reutilizadas)',
      !!a && a.street === 'Rua das Flores' && a.number === '100' && a.complement === 'Sala 2' && a.city_id === cityId && a.source === 'UX_INPUT',
      `street=${a?.street} number=${a?.number} complement=${a?.complement} city=${a?.city_id === cityId} source=${a?.source}`);
  }

  // (2) address_assignments: event / OPERATIONAL / primary vigente.
  {
    const c = (await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM address_assignments
        WHERE owner_type='event' AND owner_id=$1::uuid AND role='OPERATIONAL' AND is_primary=true AND valid_until_at IS NULL`,
      [evId])).rows[0].n;
    record('(2) address_assignments(event, OPERATIONAL, is_primary=true, valid_until_at NULL) = 1 (role REUTILIZADO)',
      c === '1', `primários vigentes=${c}`);
  }

  // (3) events.metadata->>'location_name' = a chave canônica reutilizada (NÃO coluna nova).
  {
    const meta = (await pool.query<{ ln: string | null; hascol: boolean }>(
      `SELECT metadata->>'location_name' AS ln,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_name') AS hascol
         FROM events WHERE id=$1::uuid`, [evId])).rows[0];
    record('(3) events.metadata->>location_name persistido via chave canônica (SEM coluna events.location_name)',
      meta.ln === 'Casa da Cultura' && meta.hascol === false, `metadata.location_name=${meta.ln} coluna_location_name_existe=${meta.hascol}`);
  }

  // (4) capacidade INALTERADA: max_attendees continua 100 (venue não é verdade de capacidade).
  {
    const m = (await pool.query<{ m: number | null }>(`SELECT max_attendees AS m FROM events WHERE id=$1::uuid`, [evId])).rows[0].m;
    record('(4) events.max_attendees INALTERADO pelo venue-patch (capacidade = max_attendees, sem 2ª verdade)',
      m === 100, `max_attendees=${m}`);
  }

  // (5) RE-PATCH: prior primário FECHADO + EXATAMENTE UM primário vigente.
  {
    await eventService.updateEvent(TENANT, evId, {
      venueCityId: cityId, venueStreet: 'Avenida Nova', venueNumber: '999', locationName: 'Novo Local',
    } as any, org.actorId);
    const row = (await pool.query<{ vigentes: string; fechados: string; total: string; ln: string | null }>(
      `SELECT
         (SELECT COUNT(*) FROM address_assignments WHERE owner_type='event' AND owner_id=$1::uuid AND role='OPERATIONAL' AND is_primary=true AND valid_until_at IS NULL)::text AS vigentes,
         (SELECT COUNT(*) FROM address_assignments WHERE owner_type='event' AND owner_id=$1::uuid AND role='OPERATIONAL' AND is_primary=false AND valid_until_at IS NOT NULL)::text AS fechados,
         (SELECT COUNT(*) FROM address_assignments WHERE owner_type='event' AND owner_id=$1::uuid AND role='OPERATIONAL')::text AS total,
         (SELECT metadata->>'location_name' FROM events WHERE id=$1::uuid) AS ln`, [evId])).rows[0];
    record('(5) RE-PATCH: exatamente 1 primário vigente + 1 anterior FECHADO (índice parcial segura) + location_name atualizado',
      row.vigentes === '1' && row.fechados === '1' && row.total === '2' && row.ln === 'Novo Local',
      `vigentes=${row.vigentes} fechados=${row.fechados} total=${row.total} ln=${row.ln}`);
  }

  // (6) Δbank=0.
  const bankAfter = await bankSnap();
  record('(6) Bank-free: Δbank=0 (bank_ledger:bank_transactions inalterado; endereço é territorial, não dinheiro)',
    bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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

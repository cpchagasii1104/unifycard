// backend/src/scripts/validate-confirm-third-branch-stop.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/02_decisions/DECISION_0146_… §B-bis G10 (STOP_DECISION_REQUIRED)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-confirm-third-branch-stop-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F-CONFIRM-THIRD-BRANCH-STOP — prova de COMPORTAMENTO. O guard estático
// (audit-booking-provider-conflict) prova que o STOP está ESCRITO; isto prova que ele DISPARA,
// e que os ramos travados continuam confirmando (a trava nova não pode bloquear quem pode).
//
// 🔴 ABORTA se não achar o alvo — prova vermelha que não altera nada passa com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
const dbName = URL.slice(URL.lastIndexOf('/') + 1);

if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente — recusa fail-closed.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: DATABASE_URL aponta para "${dbName}", esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const c = new Client({ connectionString: URL });
let fails = 0;
const ok = (n: string, extra = '') => console.log(`  ✅ ${n}${extra ? ' — ' + extra : ''}`);
const bad = (n: string, extra = '') => { fails++; console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); };

/** CPF com dígitos verificadores REAIS — `register` valida na borda. */
function gerarCpf(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(-9);
  const dv = (nums: string): number => {
    const peso = nums.length + 1;
    const soma = Array.from(nums).reduce((acc, d, i) => acc + parseInt(d, 10) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

(async () => {
  await c.connect();
  console.log(`\nF-CONFIRM-THIRD-BRANCH-STOP · banco efêmero "${dbName}"\n`);

  // DI dos ports sociais (ambiente-script não passa pelo app.builder).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);

  // Fixture pelo CAMINHO REAL — nunca INSERT INTO actors (writer soberano, §4.8 / C5).
  const { authService } = await import('../core/auth/auth.service');
  const reg = await authService.register(
    undefined, `confirm-stop-${Date.now()}@teste.local`, 'SenhaTeste!234', gerarCpf(), 'Dono Agenda', '1985-03-15', undefined
  );
  const tenantId: string = reg.tenantId;
  const actorRow = await c.query(
    `SELECT id::text AS id FROM actors WHERE user_id = $1::uuid AND actor_type = 'user' LIMIT 1`,
    [reg.user.userId]
  );
  if (actorRow.rowCount === 0) { console.error('ABORT: actor humano não nasceu pelo caminho real.'); await c.end(); process.exit(2); }
  const actorId: string = actorRow.rows[0].id;

  // availability owner_type='user' — o DEFAULT de PUT /availability/weekly-template, e o ramo que
  // até 2026-08-06 confirmava sem trava nenhuma.
  const av = await c.query(
    `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status,
                               start_datetime, end_datetime, timezone)
     VALUES (gen_random_uuid(), $1, 'user', $2, 'fixed', 'active',
             '2026-10-01T10:00:00Z', '2026-10-01T18:00:00Z', 'America/Sao_Paulo')
     RETURNING availability_id::text AS id`,
    [tenantId, actorId]
  );
  const availabilityId: string = av.rows[0].id;

  const bk = await c.query(
    `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'requested', '{}'::jsonb, now(), now(), now())
     RETURNING booking_id::text AS id`,
    [tenantId, availabilityId, actorId]
  );
  const bookingId: string = bk.rows[0].id;
  ok('fixture', `availability owner_type='user' + booking 'requested'`);

  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const { UnifiedBookingStatus } = await import('../core/availability/unified-availability.types');

  // ── A · o STOP DISPARA ────────────────────────────────────────────────────────────────────────
  try {
    await unifiedAvailabilityService.updateBooking(tenantId, bookingId, reg.user.userId, {
      status: UnifiedBookingStatus.CONFIRMED,
    });
    bad('A1 confirm de owner_type=user', 'CONFIRMOU — o STOP não disparou (defeito de 2026-06-21 vivo)');
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    if (e?.statusCode === 501 && /BOOKING_CONFIRM_STOP_DECISION_REQUIRED/.test(msg)) {
      ok('A1 confirm de owner_type=user PAROU', '501 BOOKING_CONFIRM_STOP_DECISION_REQUIRED');
    } else {
      bad('A1 parou pelo motivo ERRADO', `status=${e?.statusCode} msg=${msg.slice(0, 160)}`);
    }
  }

  // ── B · e o booking NÃO foi movido (fail-closed de verdade, não meia-escrita) ─────────────────
  const after = await c.query(`SELECT status, confirmed_at FROM bookings WHERE booking_id = $1::uuid`, [bookingId]);
  if (after.rows[0]?.status === 'requested' && after.rows[0]?.confirmed_at === null) {
    ok('B1 booking permanece requested', 'nada foi gravado antes do STOP');
  } else {
    bad('B1 booking foi ALTERADO apesar do STOP', JSON.stringify(after.rows[0]));
  }

  // ── C · o ramo TRAVADO continua confirmando (a trava nova não pode bloquear quem pode) ────────
  const elig = await c.query(`SELECT concept_id FROM concept_asset_eligibilities LIMIT 1`);
  if (elig.rowCount === 0) {
    bad('C1 PULADO', 'nenhum concept elegível a ativo — NÃO conto como sucesso');
  } else {
    const asset = await c.query(
      `INSERT INTO actor_assets (id, tenant_id, owner_actor_id, concept_id, label, status)
       VALUES (gen_random_uuid(), $1, $2, $3, 'Tenda prova', 'active') RETURNING id::text AS id`,
      [tenantId, actorId, elig.rows[0].concept_id]
    );
    const assetId: string = asset.rows[0].id;
    await c.query(
      `INSERT INTO actor_asset_rental_terms (asset_id, resource_type, quantity) VALUES ($1, 'equipment', 1)`,
      [assetId]
    );
    const av2 = await c.query(
      `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status,
                                 start_datetime, end_datetime, timezone)
       VALUES (gen_random_uuid(), $1, 'actor_asset', $2, 'fixed', 'active',
               '2026-10-02T10:00:00Z', '2026-10-02T18:00:00Z', 'America/Sao_Paulo')
       RETURNING availability_id::text AS id`,
      [tenantId, assetId]
    );
    const bk2 = await c.query(
      `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'requested', '{}'::jsonb, now(), now(), now())
       RETURNING booking_id::text AS id`,
      [tenantId, av2.rows[0].id, actorId]
    );
    try {
      const res = await unifiedAvailabilityService.updateBooking(tenantId, bk2.rows[0].id, reg.user.userId, {
        status: UnifiedBookingStatus.CONFIRMED,
      });
      if (res.status === UnifiedBookingStatus.CONFIRMED) ok('C1 actor_asset CONTINUA confirmando', 'o STOP não bloqueia quem tem trava');
      else bad('C1 actor_asset não confirmou', `status=${res.status}`);
    } catch (e: any) {
      bad('C1 actor_asset REGREDIU', `${e?.statusCode} ${String(e?.message).slice(0, 160)}`);
    }
  }

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

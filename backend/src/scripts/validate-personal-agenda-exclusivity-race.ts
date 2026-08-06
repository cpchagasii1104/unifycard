// backend/src/scripts/validate-personal-agenda-exclusivity-race.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0196 §D.1 · DECISION_0146 §A.3 (rollup por provider) · §A.8/G7 (corrida)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-personal-agenda-exclusivity-race-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// 🔴 A PROVA QUE FALTAVA. A `DECISION-0146 §A.8` exige, literalmente: *"duas tentativas simultâneas
// p/ o mesmo provider_actor_id + intervalo sobreposto NÃO PODEM CONFIRMAR AMBAS. […] Cenário de
// concorrência deve ser PROVADO."* Toda a sessão de 2026-08-05/06 declarou "nenhuma corrida
// provocada" — aqui ela é provocada, porque esta fatia mexe na ÚNICA trava de exclusividade viva.
//
// Prova nos DOIS sentidos:
//   R  duas confirmações SIMULTÂNEAS, mesmo actor, janelas SOBREPOSTAS → exatamente UMA confirma
//   S  janelas do mesmo actor SEM sobreposição                        → AS DUAS confirmam
//   T  back-to-back (fim == início)                                   → AS DUAS confirmam (G8)
// S e T são a metade que não grita: trava nova bloqueia quem pode tão facilmente quanto libera
// quem não pode, e só a segunda falha aparece.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
const dbName = URL.slice(URL.lastIndexOf('/') + 1);
if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: banco "${dbName}" ≠ esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const c = new Client({ connectionString: URL });
let fails = 0;
const ok = (n: string, x = '') => console.log(`  ✅ ${n}${x ? ' — ' + x : ''}`);
const bad = (n: string, x = '') => { fails++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); };

function gerarCpf(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(-9);
  const dv = (n: string): number => {
    const peso = n.length + 1;
    const s = Array.from(n).reduce((a, d, i) => a + parseInt(d, 10) * (peso - i), 0);
    const r = (s * 10) % 11; return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

(async () => {
  await c.connect();
  console.log(`\nAGENDA PESSOAL · EXCLUSIVIDADE SOB CORRIDA · efêmera "${dbName}"\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const { UnifiedBookingStatus } = await import('../core/availability/unified-availability.types');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `race-${nome}-${Date.now()}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string };
  };
  const dono = await nasce('Dono Agenda');
  const cliente = await nasce('Cliente Teste');
  const tenantId = dono.tenantId;
  const userDoDono = (await c.query(`SELECT user_id::text AS u FROM actors WHERE id=$1::uuid`, [dono.actorId])).rows[0].u;

  // pré-condição: o ramo `user` EXISTE no confirm. Sem isso a corrida provaria outra coisa.
  const janelaProbe = await c.query(
    `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES (gen_random_uuid(), $1, 'user', $2, 'fixed', 'active', '2027-01-01T10:00:00Z','2027-01-01T12:00:00Z','America/Sao_Paulo')
     RETURNING availability_id::text AS id`, [tenantId, dono.actorId]);
  const bkProbe = await c.query(
    `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'requested', '{}'::jsonb, now(), now(), now()) RETURNING booking_id::text AS id`,
    [tenantId, janelaProbe.rows[0].id, cliente.actorId]);
  try {
    await unifiedAvailabilityService.updateBooking(tenantId, bkProbe.rows[0].id, userDoDono, { status: UnifiedBookingStatus.CONFIRMED });
    ok('pré-condição', 'o ramo owner_type=user CONFIRMA (0196 §D.1 destravada)');
  } catch (e: any) {
    console.error(`ABORT: o ramo user não confirma (${e?.statusCode} ${e?.message}) — alvo ausente, prova inválida.`);
    await c.end(); process.exit(2);
  }

  /** Cria N janelas do MESMO user + 1 booking `requested` em cada. */
  const cenario = async (janelas: Array<[string, string]>) => {
    const ids: string[] = [];
    for (const [ini, fim] of janelas) {
      const av = await c.query(
        `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
         VALUES (gen_random_uuid(), $1, 'user', $2, 'fixed', 'active', $3, $4, 'America/Sao_Paulo')
         RETURNING availability_id::text AS id`, [tenantId, dono.actorId, ini, fim]);
      const bk = await c.query(
        `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'requested', '{}'::jsonb, now(), now(), now()) RETURNING booking_id::text AS id`,
        [tenantId, av.rows[0].id, cliente.actorId]);
      ids.push(bk.rows[0].id);
    }
    return ids;
  };

  /** 🔴 SIMULTÂNEO de verdade: Promise.all, sem await entre eles. */
  const corrida = async (bookingIds: string[]) => {
    const r = await Promise.allSettled(bookingIds.map((id) =>
      unifiedAvailabilityService.updateBooking(tenantId, id, userDoDono, { status: UnifiedBookingStatus.CONFIRMED })));
    return {
      confirmados: r.filter((x) => x.status === 'fulfilled').length,
      recusas: r.filter((x): x is PromiseRejectedResult => x.status === 'rejected').map((x) => String((x.reason as any)?.message ?? '')),
    };
  };

  // ── R · SOBREPOSTAS: exatamente UMA confirma ─────────────────────────────────────────────────
  const sobrepostas = await cenario([
    ['2027-03-01T14:00:00Z', '2027-03-01T18:00:00Z'],
    ['2027-03-01T15:00:00Z', '2027-03-01T17:00:00Z'], // contida na primeira
  ]);
  const R = await corrida(sobrepostas);
  if (R.confirmados === 1) ok('R  duas confirmações SIMULTÂNEAS em janelas sobrepostas', 'exatamente UMA confirmou');
  else bad('R  double-booking da agenda pessoal', `${R.confirmados} confirmaram — a trava não serializou`);
  if (R.confirmados === 1 && !R.recusas.some((m) => /BOOKING_PROVIDER_TIME_CONFLICT/.test(m))) {
    bad('R  a recusa veio pelo motivo ERRADO', R.recusas.join(' | ').slice(0, 200));
  } else if (R.confirmados === 1) {
    ok('R  a recusa é NOMEADA', 'BOOKING_PROVIDER_TIME_CONFLICT');
  }
  const persistidos = await c.query(
    `SELECT count(*)::int AS n FROM bookings WHERE booking_id = ANY($1::uuid[]) AND status='confirmed'`, [sobrepostas]);
  persistidos.rows[0].n === 1
    ? ok('R  o BANCO tem exatamente 1 confirmado', 'sem meia-escrita')
    : bad('R  banco divergiu do retorno', `${persistidos.rows[0].n} confirmados persistidos`);

  // ── S · SEM sobreposição: AS DUAS confirmam (a metade que não grita) ─────────────────────────
  const separadas = await cenario([
    ['2027-04-01T09:00:00Z', '2027-04-01T11:00:00Z'],
    ['2027-04-01T14:00:00Z', '2027-04-01T16:00:00Z'],
  ]);
  const S = await corrida(separadas);
  S.confirmados === 2
    ? ok('S  janelas SEM sobreposição', 'as duas confirmaram — a trava não bloqueia quem pode')
    : bad('S  trava bloqueou compromisso legítimo', `${S.confirmados}/2 · ${S.recusas.join(' | ').slice(0, 160)}`);

  // ── T · BACK-TO-BACK (fim == início): NÃO é conflito (G8, intervalo meio-aberto) ─────────────
  const backToBack = await cenario([
    ['2027-05-01T09:00:00Z', '2027-05-01T12:00:00Z'],
    ['2027-05-01T12:00:00Z', '2027-05-01T15:00:00Z'],
  ]);
  const T = await corrida(backToBack);
  T.confirmados === 2
    ? ok('T  back-to-back (fim == início)', 'as duas confirmaram — [start,end) meio-aberto (G8)')
    : bad('T  back-to-back tratado como conflito', `${T.confirmados}/2 — o intervalo virou fechado`);

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

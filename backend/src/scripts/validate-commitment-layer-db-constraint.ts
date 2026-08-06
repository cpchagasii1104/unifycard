// backend/src/scripts/validate-commitment-layer-db-constraint.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0146 §A.7 (metade PRESCRITA) · §A.2/§A.8 · G8 · DECISION_0196 §D.1
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-commitment-layer-db-constraint-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT (GATE + GO Clayton 2026-08-06).
// A migration 20260806220000 pôs a trava forte na camada que a §A.7 PRESCREVE. Guard estático prova
// que ela está ESCRITA; isto prova que ela MORDE — e, o que quase nunca se escreve, que ela NÃO
// bloqueia quem pode.
//
// 🔴 A prova ABORTA (exit 2) se não achar o alvo: prova vermelha que não altera nada PASSA com cara
// de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
// ⚠️ `lastIndexOf` de propósito: o lint de vocabulário financeiro (DECISION-0158) conta o termo de
// partição de string como termo financeiro, em CÓDIGO e em COMENTÁRIO, e o teto só desce.
const dbName = URL.slice(URL.lastIndexOf('/') + 1);
if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente — recusa fail-closed.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: DATABASE_URL aponta para "${dbName}", esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const EXCL = 'bookings_commitment_no_overlap';
const CHK = 'chk_bookings_blocking_requires_interval';

const c = new Client({ connectionString: URL });
let fails = 0;
const ok = (n: string, x = '') => console.log(`  ✅ ${n}${x ? ' — ' + x : ''}`);
const bad = (n: string, x = '') => { fails++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); };
const nota = (n: string, x = '') => console.log(`  📌 ${n}${x ? ' — ' + x : ''}`);

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
  console.log(`\nDT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT · banco efêmero "${dbName}"\n`);

  // ══ PRÉ-CONDIÇÕES — alvo presente e com a SUBSTÂNCIA certa (nome não basta) ═══════════════════
  const excl = await c.query(
    `SELECT contype, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = $1 AND conrelid = 'bookings'::regclass`, [EXCL]);
  if (excl.rowCount === 0) { console.error(`ABORT: ${EXCL} não existe em bookings — alvo ausente.`); await c.end(); process.exit(2); }
  const def: string = excl.rows[0].def;
  if (excl.rows[0].contype !== 'x') { console.error(`ABORT: ${EXCL} não é EXCLUDE (contype=${excl.rows[0].contype}).`); await c.end(); process.exit(2); }
  for (const [rotulo, re] of [
    ['tenant_id no par de igualdade', /tenant_id WITH =/],
    ['recurso no par de igualdade', /commitment_resource_id WITH =/],
    ['intervalo meio-aberto sobre booked_*', /tstzrange\(booked_start_datetime, booked_end_datetime, '\[\)'/],
    ['conjunto bloqueante vivo no predicado', /'confirmed'[\s\S]{0,80}'checked_in'[\s\S]{0,80}'checked_out'/],
  ] as Array<[string, RegExp]>) {
    if (!re.test(def)) { console.error(`ABORT: ${EXCL} sem ${rotulo}. def=${def}`); await c.end(); process.exit(2); }
  }
  ok('pré-condição', `${EXCL} viva, com substância conferida no catálogo`);
  const chk = await c.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = 'bookings'::regclass`, [CHK]);
  if (chk.rowCount === 0) { console.error(`ABORT: ${CHK} não existe.`); await c.end(); process.exit(2); }
  ok('pré-condição', `${CHK} viva (anti range-ilimitado)`);

  // ══ FIXTURE PELO CAMINHO REAL (authService.register — writer soberano; §4.8 LEI_COERENCIA) ═════
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { unifiedAvailabilityService } = await import('../core/availability/unified-availability.service');
  const { UnifiedBookingStatus } = await import('../core/availability/unified-availability.types');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `commit-db-${nome}-${Date.now()}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id, user_id::text AS u FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string, userId: r.rows[0].u as string };
  };
  const dono = await nasce('Dono');
  const cliente = await nasce('Cliente');
  const tenantId = dono.tenantId;

  const cpt = await c.query(`SELECT concept_id FROM concept_asset_eligibilities LIMIT 1`);
  if (cpt.rowCount === 0) { console.error('ABORT: nenhum concept elegível a ativo.'); await c.end(); process.exit(2); }
  const conceptId = cpt.rows[0].concept_id;

  const novoAtivo = async (label: string, resourceType: string, quantity: number) => {
    const a = await c.query(
      `INSERT INTO actor_assets (id, tenant_id, owner_actor_id, concept_id, label, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active') RETURNING id::text AS id`,
      [tenantId, dono.actorId, conceptId, label]);
    await c.query(`INSERT INTO actor_asset_rental_terms (asset_id, resource_type, quantity) VALUES ($1,$2,$3)`,
      [a.rows[0].id, resourceType, quantity]);
    return a.rows[0].id as string;
  };

  const janela = async (ownerType: string, ownerId: string, s: string, e: string) => (await c.query(
    `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
     VALUES (gen_random_uuid(), $1, $2, $3, 'fixed', 'active', $4, $5, 'America/Sao_Paulo')
     RETURNING availability_id::text AS id`, [tenantId, ownerType, ownerId, s, e])).rows[0].id as string;

  const pedido = async (availabilityId: string, subS?: string, subE?: string) => (await c.query(
    `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at, booked_start_datetime, booked_end_datetime)
     VALUES (gen_random_uuid(), $1, $2, $3, 'requested', '{}'::jsonb, now(), now(), now(), $4, $5)
     RETURNING booking_id::text AS id`,
    [tenantId, availabilityId, cliente.actorId, subS ?? null, subE ?? null])).rows[0].id as string;

  /** Escrita CRUA em `bookings` — o caminho que o advisory lock NÃO alcança. */
  const cru = (t: string, avId: string, resId: string | null, st: string, s: string | null, e: string | null) =>
    c.query(
      `INSERT INTO bookings (booking_id, tenant_id, availability_id, requester_actor_id, status, metadata,
                             requested_at, created_at, updated_at, booked_start_datetime, booked_end_datetime, commitment_resource_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, '{}'::jsonb, now(), now(), now(), $5, $6, $7)`,
      [t, avId, cliente.actorId, st, s, e, resId]);

  const avBase = await janela('user', dono.actorId, '2027-01-01T08:00:00Z', '2027-12-31T23:00:00Z');
  const R1 = dono.actorId;

  // ══ (N) A TRAVA MORDE ONDE O LOCK NÃO ALCANÇA — escrita CRUA, sem passar pelo service ═════════
  console.log('\n(N) o BANCO recusa o que o lock de aplicação nunca veria:');
  await cru(tenantId, avBase, R1, 'confirmed', '2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z');
  try {
    await cru(tenantId, avBase, R1, 'confirmed', '2027-06-01T11:00:00Z', '2027-06-01T13:00:00Z');
    bad('N1 dois compromissos CRUS sobrepostos do mesmo recurso', 'PASSARAM — a trava de banco não morde');
  } catch (e: any) {
    e?.constraint === EXCL
      ? ok('N1 dois compromissos CRUS sobrepostos', `recusados por ${e.constraint} (SQLSTATE ${e.code})`)
      : bad('N1 recusado pelo motivo ERRADO', `${e?.constraint ?? e?.code}: ${e?.message}`);
  }
  try {
    await cru(tenantId, avBase, R1, 'confirmed', null, null);
    bad('N2 compromisso SEM intervalo materializado', 'PASSOU — o range ilimitado (,) travaria o recurso em TODA data');
  } catch (e: any) {
    e?.constraint === CHK
      ? ok('N2 compromisso sem intervalo', `recusado por ${e.constraint} — grita em vez de calar`)
      : bad('N2 recusado pelo motivo ERRADO', `${e?.constraint ?? e?.code}: ${e?.message}`);
  }

  // ══ (P) A TRAVA NÃO BLOQUEIA QUEM PODE — a metade que não grita ═══════════════════════════════
  console.log('\n(P) e LIBERA quem pode (a asserção que quase não se escreve):');
  const aceita = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); ok(label); } catch (e: any) { bad(label, `RECUSADO por ${e?.constraint ?? e?.code}: ${e?.message}`); }
  };
  await aceita('P1 back-to-back (fim == início) — G8, [start,end) meio-aberto',
    () => cru(tenantId, avBase, R1, 'confirmed', '2027-06-01T12:00:00Z', '2027-06-01T14:00:00Z'));
  await aceita('P2 mesmo intervalo, RECURSO diferente',
    () => cru(tenantId, avBase, cliente.actorId, 'confirmed', '2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'));
  await aceita('P3 mesmo intervalo e recurso, TENANT diferente',
    () => cru('00000000-0000-4000-8000-0000000000ff', avBase, R1, 'confirmed', '2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'));
  await aceita('P4 mesmo intervalo e recurso, status NÃO bloqueante',
    () => cru(tenantId, avBase, R1, 'requested', '2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z'));
  await aceita('P5 recurso NULO (fungível) sobreposto — fica FORA da trava, de propósito',
    async () => {
      await cru(tenantId, avBase, null, 'confirmed', '2027-07-01T10:00:00Z', '2027-07-01T12:00:00Z');
      await cru(tenantId, avBase, null, 'confirmed', '2027-07-01T10:30:00Z', '2027-07-01T11:30:00Z');
    });
  // P6 — a máquina de estados anda DENTRO do predicado: confirmed → checked_in → checked_out.
  const alvoEstado = (await c.query(
    `SELECT booking_id::text AS id FROM bookings
      WHERE tenant_id=$1 AND commitment_resource_id=$2 AND status='confirmed'
        AND booked_start_datetime = '2027-06-01T10:00:00Z' LIMIT 1`, [tenantId, R1])).rows[0]?.id;
  if (!alvoEstado) { console.error('ABORT: não achei o booking de P6 — prova inválida.'); await c.end(); process.exit(2); }
  await aceita('P6 confirmed → checked_in → checked_out (a linha não conflita consigo mesma)',
    async () => {
      await c.query(`UPDATE bookings SET status='checked_in', checked_in_at=now() WHERE booking_id=$1::uuid`, [alvoEstado]);
      await c.query(`UPDATE bookings SET status='checked_out', checked_out_at=now() WHERE booking_id=$1::uuid`, [alvoEstado]);
    });
  await aceita('P7 cancelar LIBERA o intervalo (sai do predicado parcial)',
    async () => {
      await c.query(`UPDATE bookings SET status='cancelled', cancelled_at=now() WHERE booking_id=$1::uuid`, [alvoEstado]);
      await cru(tenantId, avBase, R1, 'confirmed', '2027-06-01T10:00:00Z', '2027-06-01T12:00:00Z');
    });

  // ══ (F) O FUNGÍVEL CONTINUA FUNGÍVEL — pelo caminho REAL (service + advisory lock) ════════════
  console.log('\n(F) o equipamento fungível segue aceitando a 2ª das 10 unidades (caminho REAL):');
  const tenda = await novoAtivo('Tenda 10x', 'equipment', 10);
  const avTenda = await janela('actor_asset', tenda, '2027-08-01T00:00:00Z', '2027-08-31T00:00:00Z');
  const f1 = await pedido(avTenda, '2027-08-05T10:00:00Z', '2027-08-05T18:00:00Z');
  const f2 = await pedido(avTenda, '2027-08-05T12:00:00Z', '2027-08-05T20:00:00Z'); // SOBREPOSTO de propósito
  let fungOk = 0;
  for (const id of [f1, f2]) {
    try { await unifiedAvailabilityService.updateBooking(tenantId, id, dono.userId, { status: UnifiedBookingStatus.CONFIRMED }); fungOk++; }
    catch (e: any) { bad('F1 confirm de unidade fungível RECUSADO', `${e?.constraint ?? e?.code ?? e?.statusCode}: ${e?.message}`); }
  }
  fungOk === 2
    ? ok('F1 duas reservas SOBREPOSTAS do equipamento quantity=10', 'as duas confirmaram — a trava nova não expulsou o fungível')
    : bad('F1 fungível quebrado', `${fungOk}/2 confirmaram`);
  const fungNull = await c.query(
    `SELECT count(*)::int AS n FROM bookings WHERE booking_id = ANY($1::uuid[]) AND commitment_resource_id IS NULL`, [[f1, f2]]);
  fungNull.rows[0].n === 2
    ? ok('F2 os dois ficaram com commitment_resource_id NULL', 'fora da EXCLUDE, dentro do lock (DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE)')
    : bad('F2 fungível entrou na EXCLUDE', `${fungNull.rows[0].n}/2 com recurso NULO`);

  console.log('\n(F) o NÃO-fungível entra na trava, e a recusa continua NOMEADA pelo app:');
  const carro = await novoAtivo('Fiat Uno', 'vehicle', 1);
  const avCarro = await janela('actor_asset', carro, '2027-09-01T00:00:00Z', '2027-09-30T00:00:00Z');
  const v1 = await pedido(avCarro, '2027-09-05T10:00:00Z', '2027-09-05T18:00:00Z');
  const v2 = await pedido(avCarro, '2027-09-05T12:00:00Z', '2027-09-05T20:00:00Z');
  await unifiedAvailabilityService.updateBooking(tenantId, v1, dono.userId, { status: UnifiedBookingStatus.CONFIRMED });
  try {
    await unifiedAvailabilityService.updateBooking(tenantId, v2, dono.userId, { status: UnifiedBookingStatus.CONFIRMED });
    bad('F3 2ª reserva do veículo único', 'CONFIRMOU — double-booking');
  } catch (e: any) {
    /RENTAL_RESOURCE_TIME_CONFLICT/.test(String(e?.message))
      ? ok('F3 2ª reserva do veículo único recusada', 'pelo erro NOMEADO do app — a trava de banco é backstop, não a UX')
      : bad('F3 recusa veio pelo 23P01 cru (ou outro)', `${e?.constraint ?? e?.code}: ${String(e?.message).slice(0, 140)}`);
  }
  const carroRes = await c.query(`SELECT commitment_resource_id::text AS r FROM bookings WHERE booking_id=$1::uuid`, [v1]);
  carroRes.rows[0].r === carro
    ? ok('F4 o veículo ENTROU na trava de banco', 'exclusividade estrutural (CHECK vivo sobre resource_type)')
    : bad('F4 veículo ficou fora da trava', `commitment_resource_id=${carroRes.rows[0].r}`);

  // ══ (A) O RAMO PROVIDER MATERIALIZA O QUE COMPROMETEU ════════════════════════════════════════
  console.log('\n(A) o ramo provider materializa intervalo e recurso (era o vão do §B② do GATE):');
  const avUser = await janela('user', dono.actorId, '2028-02-01T14:00:00Z', '2028-02-01T18:00:00Z');
  const u1 = await pedido(avUser);
  await unifiedAvailabilityService.updateBooking(tenantId, u1, dono.userId, { status: UnifiedBookingStatus.CONFIRMED });
  const mat = await c.query(
    `SELECT booked_start_datetime IS NOT NULL AS s, booked_end_datetime IS NOT NULL AS e,
            commitment_resource_id::text AS r FROM bookings WHERE booking_id=$1::uuid`, [u1]);
  (mat.rows[0].s && mat.rows[0].e && mat.rows[0].r === dono.actorId)
    ? ok('A1 confirm de agenda pessoal materializou booked_* e commitment_resource_id')
    : bad('A1 confirm não materializou', JSON.stringify(mat.rows[0]));

  // ══ (D) O OBSTÁCULO ④ — dissolve inteiro, ou metade? MEDIÇÃO, não adjetivo ═══════════════════
  console.log('\n(D) editar a janela DEPOIS do compromisso — o que dissolveu e o que sobrou:');
  await c.query(
    `UPDATE availability SET start_datetime='2028-02-01T20:00:00Z', end_datetime='2028-02-01T23:00:00Z'
      WHERE availability_id=$1::uuid`, [avUser]);
  const avOutra = await janela('user', dono.actorId, '2028-02-01T15:00:00Z', '2028-02-01T17:00:00Z');
  const u2 = await pedido(avOutra);
  try {
    await unifiedAvailabilityService.updateBooking(tenantId, u2, dono.userId, { status: UnifiedBookingStatus.CONFIRMED });
    bad('D1 janela editada abriu double-booking', 'confirmou sobre o intervalo JÁ COMPROMETIDO (14-18)');
  } catch (e: any) {
    /BOOKING_PROVIDER_TIME_CONFLICT/.test(String(e?.message))
      ? ok('D1 editar a janela NÃO abre double-booking', 'o conflito passou a ler o intervalo COMPROMETIDO, não a janela')
      : bad('D1 recusa pelo motivo errado', String(e?.message).slice(0, 160));
  }
  const drift = await c.query(
    `SELECT (a.start_datetime <> b.booked_start_datetime) AS divergiu
       FROM bookings b JOIN availability a ON a.availability_id=b.availability_id
      WHERE b.booking_id=$1::uuid`, [u1]);
  drift.rows[0].divergiu
    ? nota('D2 a DECLARAÇÃO agora diz outra coisa que o COMPROMISSO', 'metade que NÃO dissolveu → DT-DECLARATION-DRIFTS-FROM-COMMITMENT (fatia própria)')
    : bad('D2 a medição de drift não achou o que devia', 'edição da janela não se refletiu — prova inconclusiva');

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

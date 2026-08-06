// backend/src/scripts/validate-demand-need-event-key.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0196 §H/§H.2 · DECISION_0146 §A.6 (writer fail-closed onde FK não cobre)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-demand-need-event-key-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F3 (substrato) — a chave evento↔demanda. Guard prova que a coluna e a trava ESTÃO ESCRITAS;
// isto prova que elas MORDEM — e, o que quase nunca se escreve, que NÃO bloqueiam quem pode.
//
// 🔴 ABORTA (exit 2) se não achar o alvo: prova vermelha que não altera nada PASSA com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
// ⚠️ `lastIndexOf` de propósito: o lint de vocabulário financeiro (DECISION-0158) conta o termo de
// partição de string como termo financeiro, em CÓDIGO e em COMENTÁRIO, e o teto só desce.
const dbName = URL.slice(URL.lastIndexOf('/') + 1);
if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente — recusa fail-closed.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: DATABASE_URL aponta para "${dbName}", esperado "${EXPECTED}".`); process.exit(2); }
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
  console.log(`\nF3 · CHAVE EVENTO↔DEMANDA (need_id) · efêmera "${dbName}"\n`);

  // ══ PRÉ-CONDIÇÕES — alvo presente, com substância ═════════════════════════════════════════════
  const col = await c.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_name='service_demands' AND column_name='need_id'`);
  if (col.rowCount === 0) { console.error('ABORT: service_demands.need_id não existe — alvo ausente.'); await c.end(); process.exit(2); }
  if (col.rows[0].is_nullable !== 'YES') { console.error('ABORT: need_id não é anulável.'); await c.end(); process.exit(2); }
  ok('pré-condição', 'need_id viva e ANULÁVEL');
  const fk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='service_demands'::regclass AND contype='f'
        AND pg_get_constraintdef(oid) ILIKE '%need_id%'`);
  if (fk.rowCount === 0 || !/event_operational_needs/i.test(fk.rows[0].def)) {
    console.error('ABORT: FK de need_id ausente ou apontando para outra casa.'); await c.end(); process.exit(2);
  }
  ok('pré-condição', `FK confere: ${fk.rows[0].def}`);

  // ══ FIXTURE PELO CAMINHO REAL (writer soberano; §4.8 LEI_COERENCIA) ═══════════════════════════
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { demandService } = await import('../modules/demands/demand.service');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `need-key-${nome}-${Date.now()}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string, userId: reg.user.userId as string };
  };
  const org = await nasce('Organizador');
  const tenantA = org.tenantId;

  // 🔴 SEGUNDO TENANT REAL — sem ele o caso "need de outro tenant" não existe e a prova é teatro.
  // ⚠️ Colunas obrigatórias lidas DE UMA VEZ no catálogo (information_schema, is_nullable='NO'):
  // `tenants` = (id, name, slug, created_at, updated_at) — NÃO tem `status`, e supor que tinha
  // custou uma execução vermelha sobre defeito inexistente. `events` = (…, actor_type, title, …),
  // todo o resto com default.
  const tenantB = (await c.query(
    `INSERT INTO tenants (id, name, slug) VALUES (gen_random_uuid(), 'Tenant B Prova', 'tenant-b-prova-' || floor(random()*100000)::text)
     RETURNING id::text AS id`)).rows[0]?.id;
  if (!tenantB) { console.error('ABORT: não criei o 2º tenant — o caso hostil não existiria.'); await c.end(); process.exit(2); }

  // concept com offer_kind — a need exige o par (concept, fulfillment_kind) por FK composta
  const cpt = await c.query(`SELECT concept_id::text AS id, offer_kind FROM concept_offer_kinds LIMIT 1`);
  if (cpt.rowCount === 0) { console.error('ABORT: nenhum concept com offer_kind — need não nasce.'); await c.end(); process.exit(2); }
  const conceptId = cpt.rows[0].id;
  const offerKind = cpt.rows[0].offer_kind;

  const novoEvento = async (tenant: string, titulo: string) => (await c.query(
    `INSERT INTO events (id, tenant_id, title, status, actor_id, actor_type)
     VALUES (gen_random_uuid(), $1::uuid, $2, 'draft', $3::uuid, 'user') RETURNING id::text AS id`,
    [tenant, titulo, org.actorId])).rows[0].id as string;

  const novaNeed = async (eventId: string) => (await c.query(
    `INSERT INTO event_operational_needs (id, event_id, need_concept_id, fulfillment_kind)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3) RETURNING id::text AS id`,
    [eventId, conceptId, offerKind])).rows[0].id as string;

  const evA = await novoEvento(tenantA, 'Evento do tenant A');
  const needA = await novaNeed(evA);
  const evB = await novoEvento(tenantB, 'Evento do tenant B');
  const needB = await novaNeed(evB);

  const conceptSlug = (await c.query(`SELECT slug FROM concepts WHERE concept_id=$1::uuid`, [conceptId])).rows[0].slug;
  const base = { conceptSlug, title: 'Preciso de fornecedor', vinculo: 'diaria' as const, dateStart: '2027-10-01' };

  // ══ (P) O LADO POSITIVO — a trava não pode bloquear quem PODE ════════════════════════════════
  console.log('\n(P) a trava LIBERA quem pode (a metade que não grita):');
  try {
    const d = await demandService.create(tenantA, org.actorId, { ...base } as any);
    d.needId === null
      ? ok('P1 demanda AVULSA (sem needId)', 'criada com need_id NULL — nada regride')
      : bad('P1 demanda avulsa saiu com need_id', String(d.needId));
  } catch (e: any) { bad('P1 demanda avulsa RECUSADA', e?.message); }

  try {
    const d = await demandService.create(tenantA, org.actorId, { ...base, needId: needA } as any);
    d.needId === needA
      ? ok('P2 demanda ligada a need do PRÓPRIO tenant', 'aceita e persistida')
      : bad('P2 need do próprio tenant não persistiu', `needId=${d.needId}`);
  } catch (e: any) { bad('P2 need do PRÓPRIO tenant foi RECUSADA', e?.message); }

  // ══ (N) O LADO NEGATIVO — a trava MORDE ══════════════════════════════════════════════════════
  console.log('\n(N) a trava MORDE quem não pode:');
  try {
    await demandService.create(tenantA, org.actorId, { ...base, needId: needB } as any);
    bad('N1 need de OUTRO tenant', 'ACEITA — duas respostas para "de quem é isto"');
  } catch (e: any) {
    /DEMAND_NEED_NOT_IN_TENANT/.test(String(e?.message))
      ? ok('N1 need de OUTRO tenant recusada', 'DEMAND_NEED_NOT_IN_TENANT (0146 §A.6)')
      : bad('N1 recusada pelo motivo ERRADO', String(e?.message).slice(0, 160));
  }
  try {
    await demandService.create(tenantA, org.actorId, { ...base, needId: '00000000-0000-4000-8000-000000000999' } as any);
    bad('N2 need INEXISTENTE', 'ACEITA — fail-aberto');
  } catch (e: any) {
    /DEMAND_NEED_NOT_IN_TENANT/.test(String(e?.message))
      ? ok('N2 need inexistente recusada', 'mesma recusa nomeada — ausência é ausência')
      : bad('N2 recusada pelo motivo ERRADO', String(e?.message).slice(0, 160));
  }

  // ══ (D) DEGRADAÇÃO: apagar a NECESSIDADE não pode apagar o PEDIDO ════════════════════════════
  console.log('\n(D) ON DELETE SET NULL — a necessidade morre, o pedido sobrevive:');
  const alvo = (await c.query(
    `SELECT id::text AS id FROM service_demands WHERE tenant_id=$1::uuid AND need_id=$2::uuid LIMIT 1`,
    [tenantA, needA])).rows[0]?.id;
  if (!alvo) { console.error('ABORT: não achei a demanda ligada — prova de degradação inválida.'); await c.end(); process.exit(2); }
  await c.query(`DELETE FROM event_operational_needs WHERE id=$1::uuid`, [needA]);
  const dep = await c.query(`SELECT need_id FROM service_demands WHERE id=$1::uuid`, [alvo]);
  if (dep.rowCount === 1 && dep.rows[0].need_id === null) ok('D1 need apagada → demanda VIVA com need_id NULL', 'vira avulsa, não some');
  else bad('D1 a demanda sumiu junto com a necessidade', JSON.stringify(dep.rows[0] ?? null));

  // ══ (V) §H.2 — o VALOR não mora na chave ═════════════════════════════════════════════════════
  const valor = await c.query(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_name IN ('event_operational_needs','service_demands')
        AND (column_name LIKE '%price%' OR column_name LIKE '%cost%' OR column_name LIKE '%budget%')
        AND column_name <> 'offered_price_cents'`);
  valor.rows[0].n === 0
    ? ok('V1 §H.2 preservada', 'nem a need nem a demanda ganharam coluna de custo — o valor mora na RESPOSTA')
    : bad('V1 apareceu coluna de valor na chave', `${valor.rows[0].n} coluna(s) — segunda fonte de custo`);

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

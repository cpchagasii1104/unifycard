// backend/src/scripts/validate-directed-demand.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0196 §G.1 (dois verbos) · §C/D4 (dirigido = MESMA entidade)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-directed-demand-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F4 — o PEDIDO DIRIGIDO. Prova que `target_actor_id` ESTREITA a plateia (o alvo vê e age; os
// outros não veem) e que broadcast segue exatamente como era. Estreitar é seguro; alargar vazaria.
//
// 🔴 ABORTA se não achar o alvo: prova vermelha que não altera nada PASSA com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
// ⚠️ `lastIndexOf` de propósito: o lint de vocabulário financeiro (DECISION-0158) conta o termo de
// partição de string como termo financeiro, em CÓDIGO e em COMENTÁRIO, e o teto só desce.
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
  console.log(`\nF4 · PEDIDO DIRIGIDO (target_actor_id) · efêmera "${dbName}"\n`);

  const col = await c.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_name='service_demands' AND column_name='target_actor_id'`);
  if (col.rowCount === 0 || col.rows[0].is_nullable !== 'YES') {
    console.error('ABORT: target_actor_id ausente ou não-anulável — alvo ausente.'); await c.end(); process.exit(2);
  }
  ok('pré-condição', 'target_actor_id viva e ANULÁVEL (nulo = broadcast)');

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { demandService } = await import('../modules/demands/demand.service');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `f4-${nome}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string };
  };
  const cliente = await nasce('Cliente');
  const alvo = await nasce('Alvo Do Pedido');
  const terceiro = await nasce('Terceiro Curioso');
  const tenantId = cliente.tenantId;

  const concept = await c.query(`SELECT slug FROM concepts LIMIT 1`);
  if (concept.rowCount === 0) { console.error('ABORT: sem concepts.'); await c.end(); process.exit(2); }
  const conceptSlug = concept.rows[0].slug;

  const cria = (over: Record<string, unknown> = {}) => demandService.create(tenantId, cliente.actorId, {
    conceptSlug, title: 'Pedido de teste', vinculo: 'diaria', dateStart: '2028-06-01',
    acceptanceMode: 'com_analise', pricingMode: 'orcamento', visibility: 'public', ...over,
  } as any);

  // ══ (A) DIRIGIDO: o ALVO vê e age; o TERCEIRO não vê ═════════════════════════════════════════
  console.log('\n(A) o pedido DIRIGIDO estreita a plateia:');
  const dir = await cria({ targetActorId: alvo.actorId });
  dir.targetActorId === alvo.actorId
    ? ok('A1 demanda nasceu DIRIGIDA', 'target_actor_id persistido e projetado')
    : bad('A1 target não persistiu', String(dir.targetActorId));

  const listaAlvo = await demandService.listOpportunities(tenantId, alvo.actorId, false);
  listaAlvo.some((d) => d.id === dir.id)
    ? ok('A2 o ALVO vê o pedido', 'mesmo sem conexão — é o ponto de "dirigido"')
    : bad('A2 o alvo NÃO vê o pedido dirigido a ele', 'a plateia estreitou demais');

  const listaTerceiro = await demandService.listOpportunities(tenantId, terceiro.actorId, false);
  !listaTerceiro.some((d) => d.id === dir.id)
    ? ok('A3 o TERCEIRO não vê', 'dirigido não é broadcast')
    : bad('A3 terceiro VÊ pedido dirigido a outro', 'a plateia não estreitou');

  try {
    await demandService.getWithResponses(tenantId, terceiro.actorId, dir.id);
    bad('A4 terceiro ABRIU o pedido dirigido', 'plateia furada na leitura direta');
  } catch (e: any) {
    /não encontrada/i.test(String(e?.message))
      ? ok('A4 terceiro não abre o pedido dirigido', '404 — a mesma resposta de "não existe para você"')
      : bad('A4 recusa pelo motivo errado', String(e?.message).slice(0, 120));
  }
  try {
    await demandService.respond(tenantId, terceiro.actorId, dir.id, { quoteCents: 5000 });
    bad('A5 terceiro RESPONDEU pedido dirigido a outro', 'mutação não-autorizada');
  } catch { ok('A5 terceiro não responde', 'AGIR também exige estar na plateia'); }

  // ══ (B) BROADCAST não regride — a metade que não grita ═══════════════════════════════════════
  console.log('\n(B) e o broadcast segue exatamente como era:');
  const bc = await cria({});
  bc.targetActorId === null ? ok('B1 sem alvo = broadcast', 'target_actor_id NULL') : bad('B1 broadcast ganhou alvo', String(bc.targetActorId));
  const bcAlvo = await demandService.listOpportunities(tenantId, alvo.actorId, false);
  const bcTerceiro = await demandService.listOpportunities(tenantId, terceiro.actorId, false);
  (bcAlvo.some((d) => d.id === bc.id) && bcTerceiro.some((d) => d.id === bc.id))
    ? ok('B2 os DOIS veem o broadcast', 'nada regrediu para quem já via')
    : bad('B2 broadcast sumiu para alguém', `alvo=${bcAlvo.some((d) => d.id === bc.id)} terceiro=${bcTerceiro.some((d) => d.id === bc.id)}`);

  // ══ (C) O WRITER recusa alvo ilegítimo ══════════════════════════════════════════════════════
  console.log('\n(C) o writer recusa alvo ilegítimo (0113: o body declara, o servidor prova):');
  try {
    await cria({ targetActorId: cliente.actorId });
    bad('C1 pedido a SI MESMO aceito', 'ninguém orça para si');
  } catch (e: any) {
    /DEMAND_TARGET_IS_SELF/.test(String(e?.message))
      ? ok('C1 pedido a si mesmo recusado', 'DEMAND_TARGET_IS_SELF')
      : bad('C1 recusa pelo motivo errado', String(e?.message).slice(0, 120));
  }
  try {
    await cria({ targetActorId: '00000000-0000-4000-8000-0000000009f4' });
    bad('C2 alvo INEXISTENTE aceito', 'fail-aberto');
  } catch (e: any) {
    /DEMAND_TARGET_NOT_IN_TENANT/.test(String(e?.message))
      ? ok('C2 alvo inexistente recusado', 'DEMAND_TARGET_NOT_IN_TENANT — ausência é ausência')
      : bad('C2 recusa pelo motivo errado', String(e?.message).slice(0, 120));
  }

  // ══ (D) MESMA ENTIDADE (§C/D4) — dirigido não criou tabela nem status novo ═══════════════════
  const tabelas = await c.query(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%directed%'`);
  tabelas.rows[0].n === 0
    ? ok('D1 nenhuma entidade paralela de "pedido dirigido"', 'mesma tabela, mesma entidade (§C/D4)')
    : bad('D1 nasceu entidade paralela', `${tabelas.rows[0].n} tabela(s)`);

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

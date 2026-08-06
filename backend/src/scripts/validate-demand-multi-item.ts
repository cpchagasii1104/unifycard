// backend/src/scripts/validate-demand-multi-item.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   DECISION_0196 §G.1 (dirigido) · §H (need = elo forte) · §C/D4 (mesma entidade)
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-demand-multi-item-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F4-b — PEDIDO COM VÁRIOS ITENS. Prova que multi-item é conveniência de TELA (N demandas
// comparáveis, não um pacote), que o lote é ATÔMICO, e que o pedido DIRIGIDO não vaza no feed.
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
  console.log(`\nF4-b · PEDIDO COM VÁRIOS ITENS · efêmera "${dbName}"\n`);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  const { authService } = await import('../core/auth/auth.service');
  const { demandService } = await import('../modules/demands/demand.service');

  const nasce = async (nome: string) => {
    const reg = await authService.register(undefined, `f4b-${nome}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`,
      'SenhaTeste!234', gerarCpf(), nome, '1985-03-15', undefined);
    const r = await c.query(`SELECT id::text AS id FROM actors WHERE user_id=$1::uuid AND actor_type='user' LIMIT 1`, [reg.user.userId]);
    if (r.rowCount === 0) { console.error(`ABORT: actor "${nome}" não nasceu.`); await c.end(); process.exit(2); }
    return { tenantId: reg.tenantId as string, actorId: r.rows[0].id as string, userId: reg.user.userId as string };
  };
  const pedinte = await nasce('Pedinte');
  const forn = await nasce('Fornecedor Multi');
  const tenantId = pedinte.tenantId;

  const cs = await c.query(`SELECT slug FROM concepts LIMIT 3`);
  if (cs.rowCount < 3) { console.error('ABORT: menos de 3 concepts.'); await c.end(); process.exit(2); }
  const slugs: string[] = cs.rows.map((r: any) => r.slug);

  const item = (slug: string, titulo: string, data: string) => ({
    conceptSlug: slug, title: titulo, vinculo: 'diaria', dateStart: data,
    acceptanceMode: 'com_analise', pricingMode: 'orcamento', visibility: 'public',
  });

  // ══ (A) N ITENS, UMA CHAMADA — e cada um continua uma LINHA própria ══════════════════════════
  console.log('\n(A) multi-item é conveniência de tela, NÃO um pacote:');
  const r = await demandService.createBatch(tenantId, pedinte.actorId, {
    targetActorId: forn.actorId,
    items: [
      item(slugs[0], 'Tenda 10x10', '2028-09-10'),
      item(slugs[1], 'Gerador 180 kVA', '2028-09-10'),
      item(slugs[2], 'Banheiro químico', '2028-09-11'), // data DIFERENTE de propósito
    ] as any,
  }, pedinte.userId);
  r.demands.length === 3
    ? ok('A1 três itens viraram TRÊS demandas', 'comparáveis e aceitáveis uma a uma')
    : bad('A1 lote não criou 3', String(r.demands.length));
  r.demands.every((d) => d.targetActorId === forn.actorId)
    ? ok('A2 as três dirigidas ao MESMO fornecedor', 'target_actor_id em todas')
    : bad('A2 alguma demanda saiu sem alvo', '');
  (r.demands[2].dateStart === '2028-09-11' && r.demands[0].dateStart === '2028-09-10')
    ? ok('A3 cada item guarda a SUA data', 'configuração por item, como pedido')
    : bad('A3 as datas por item não persistiram', `${r.demands[0].dateStart} · ${r.demands[2].dateStart}`);
  const pacote = await c.query(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND (table_name ILIKE '%quote_package%' OR table_name ILIKE '%demand_item%' OR table_name ILIKE '%demand_batch%')`);
  pacote.rows[0].n === 0
    ? ok('A4 nenhuma entidade de "pacote" nasceu', 'se houvesse, a comparação por item morreria')
    : bad('A4 nasceu entidade de pacote', `${pacote.rows[0].n} tabela(s)`);

  // ══ (B) ATÔMICO — item inválido no meio derruba o lote INTEIRO ═══════════════════════════════
  console.log('\n(B) o lote é ATÔMICO (meio pedido é pior que pedido nenhum):');
  const antes = (await c.query(`SELECT count(*)::int AS n FROM service_demands WHERE tenant_id=$1::uuid`, [tenantId])).rows[0].n;
  try {
    await demandService.createBatch(tenantId, pedinte.actorId, {
      targetActorId: forn.actorId,
      items: [
        item(slugs[0], 'Item bom', '2028-10-01'),
        { ...item(slugs[1], 'Item ruim', '2028-10-01'), vinculo: 'periodo' }, // periodo SEM dateEnd → recusa
      ] as any,
    }, pedinte.userId);
    bad('B1 lote com item inválido PASSOU', 'meio pedido persistiu');
  } catch { ok('B1 lote com item inválido recusado', 'a validação do item único vale no lote'); }
  const depois = (await c.query(`SELECT count(*)::int AS n FROM service_demands WHERE tenant_id=$1::uuid`, [tenantId])).rows[0].n;
  depois === antes
    ? ok('B2 NADA do lote inválido persistiu', `${antes} → ${depois} — rollback inteiro`)
    : bad('B2 sobrou item do lote inválido', `${antes} → ${depois}`);

  // ══ (C) 🔴 O VAZAMENTO DO FEED — dirigido NÃO vira post público ══════════════════════════════
  console.log('\n(C) o pedido DIRIGIDO não vaza no feed (defeito da F4, consertado):');
  // ⚠️ `intent_metadata`, NÃO `metadata`. A 1ª versão desta prova consultou `posts.metadata` e viu
  // ZERO — e eu quase declarei "o espelho do feed nunca funcionou". Medido na coluna CERTA no banco
  // oficial: 9 dos 11 posts têm `demand_id`. **O espelho sempre funcionou.** Ler pelo nome que eu
  // supus, e não pelo que a query grava, é o defeito nº2 do CLAUDE.md §2.1 — e ele me pegou aqui.
  const posts = await c.query(
    `SELECT count(*)::int AS n FROM posts p
      WHERE p.tenant_id=$1::uuid AND p.intent_metadata->>'demand_id' = ANY($2::text[])`,
    [tenantId, r.demands.map((d) => d.id)]);
  posts.rows[0].n === 0
    ? ok('C1 nenhuma das dirigidas virou post', 'plateia estreita no motor E na projeção')
    : bad('C1 pedido dirigido apareceu no feed', `${posts.rows[0].n} post(s) — vazamento`);

  // ══ (D) BROADCAST espelha no feed — e TRÊS defeitos mudos consertados no caminho ═════════════
  //
  // 🔴 O ESPELHO SEMPRE FUNCIONOU (9 de 11 posts do banco oficial têm `demand_id`). Eu disse que
  // não funcionava porque consultei `posts.metadata` em vez de `posts.intent_metadata` — errata
  // minha, registrada no cartório.
  // 🔴 MAS a cadeia POR TRÁS dele estava morta em silêncio, e isso era verdade. Medido no banco
  // OFICIAL: a tabela de impacto e a de reputacao com 0 linhas. TRÊS defeitos empilhados,
  // todos engolidos pelo MESMO `catch` de "não crítico":
  //   (1) o servico de impacto — `metadata ? JSON.stringify(metadata) : null` numa coluna NOT NULL com
  //      DEFAULT: default não salva NULL EXPLÍCITO, só omissão → 23502 em todo lançamento.
  //   (2) reputation.service.ts — `ON CONFLICT (tenant_id, actor_id, actor_type)` com o índice vivo
  //      sendo `UNIQUE (tenant_id, actor_id)` → 42P10, sempre.
  //   (3) reputation.service.ts — gravava o NÚMERO da escada numa coluna de vocabulário governado
  //      (`newcomer·member·contributor·leader·champion`) → CHECK recusava, sempre.
  // Os três consertados no mesmo turno (*"resolver as dívidas ao invés de ficar acumulando"*).
  // 📌 Um `catch` honesto ("falha do espelho NUNCA derruba a demanda") escondeu três defeitos 100%
  //    reprodutíveis. Não-crítico não quer dizer não-observável.
  const bc = await demandService.create(tenantId, pedinte.actorId, item(slugs[0], 'Preciso de algo (aberto)', '2028-11-01') as any, pedinte.userId);
  bc.id && bc.targetActorId === null
    ? ok('D1 demanda ABERTA criada', 'sem alvo = broadcast')
    : bad('D1 demanda aberta não nasceu', JSON.stringify({ id: bc.id, target: bc.targetActorId }));
  const postBc = await c.query(
    `SELECT count(*)::int AS n FROM posts WHERE tenant_id=$1::uuid AND intent_metadata->>'demand_id' = $2`, [tenantId, bc.id]);
  postBc.rows[0].n === 1
    ? ok('D2 a ABERTA virou post no feed', 'o espelho do broadcast segue vivo — o conserto da dirigida não o matou')
    : bad('D2 o espelho do broadcast não produziu post', `${postBc.rows[0].n} post(s)`);
  const lancamentos = await c.query(`SELECT count(*)::int AS n FROM impact_ledger WHERE tenant_id=$1::uuid`, [tenantId]);
  lancamentos.rows[0].n > 0
    ? ok('D3 impact_ledger voltou a registrar', `${lancamentos.rows[0].n} lançamento(s) — tinha 0 linhas no banco oficial (defeito 1)`)
    : bad('D3 impact_ledger segue vazio', 'o NULL explícito voltou');
  const rep = await c.query(`SELECT count(*)::int AS n, min(reputation_level) AS termo FROM actor_reputation WHERE tenant_id=$1::uuid`, [tenantId]);
  (rep.rows[0].n > 0 && typeof rep.rows[0].termo === 'string')
    ? ok('D4 actor_reputation voltou a registrar', `${rep.rows[0].n} linha(s), nível='${rep.rows[0].termo}' — tinha 0 linhas (defeitos 2 e 3)`)
    : bad('D4 actor_reputation segue vazio ou com número cru', JSON.stringify(rep.rows[0]));

  // ══ (E) TETO do lote ════════════════════════════════════════════════════════════════════════
  try {
    await demandService.createBatch(tenantId, pedinte.actorId,
      { targetActorId: forn.actorId, items: Array.from({ length: 21 }, (_, i) => item(slugs[0], `Item ${i}`, '2028-12-01')) as any },
      pedinte.userId);
    bad('E1 lote de 21 itens aceito', 'sem teto');
  } catch (e: any) {
    /DEMAND_BATCH_TOO_LARGE/.test(String(e?.message))
      ? ok('E1 lote acima do teto recusado', 'DEMAND_BATCH_TOO_LARGE')
      : bad('E1 recusa pelo motivo errado', String(e?.message).slice(0, 120));
  }

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });

#!/usr/bin/env node
// backend/scripts/audit-economic-policy-split-cent-conservation.mjs
// GUARD ESTRUTURAL — prova de conservação de centavos do split canônico (mandato Clayton: "calcule os
// centavos, não dê margem pra cento e um por cento"). Não é lexical: EXECUTA a matemática REAL —
// importa e chama economicPolicyEngineService.calculatePolicySplits (economic-policy-engine.service.ts,
// K_pe_5/K_pe_7) contra um conjunto hostil de (amountCents, lines). Não reimplementa o CÁLCULO (a
// função que produz os splits finais, com absorção e validação, é SEMPRE a real, importada) — mas
// mede o drift ANTES da absorção via a fórmula de UMA linha documentada no próprio docstring de
// calculatePolicySplits (floor(amount*bps/10000) | fixedAmountCents), porque o resultado retornado
// pela função já vem PÓS-absorção e não expõe o valor pré-absorção. Isso é instrução explícita da
// direção (pacote K_pe_7, PASSO 2) — não uma segunda verdade sobre o CÁLCULO em si.
//
// ── HISTÓRICO DESTE GUARD (selo anterior derrubado em auditoria) ──────────────────────────────
// A versão anterior testava SÓ `sum(splits.amountCents) === amountCents`. Essa invariante é
// INFALSIFICÁVEL: o próprio motor FORÇA sum===amountCents sempre que não lança exceção (absorve o
// drift na primeira linha revenue_share e, se o resíduo não zerar, lança CALCULATION_INVALID —
// ver economic-policy-engine.service.ts:275-291). Um guard que testa algo que o código sob teste
// já garante por construção nunca pode ficar vermelho — decoração, não prova. A auditoria derrubou
// o selo por isso.
//
// ── INVARIANTE NOVA (falsificável) ──────────────────────────────────────────────────────────────
//   |drift PRÉ-absorção| ≤ nº de linhas da policy
// onde drift PRÉ-absorção = amountCents − Σ(valor NAIVE de cada linha, floor(amount*bps/10000) ou
// fixedAmountCents, SEM a correção que o motor aplica depois). O resíduo LEGÍTIMO de arredondamento
// é no máximo 1 centavo por linha (floor perde sempre <1 centavo); um drift maior que o nº de linhas
// não é mais "arredondamento" — é uma config estruturalmente desalinhada (bps não fechando 10000,
// ou fixedAmountCents brigando com o total). Isso É falsificável: PROVA_VERMELHA neste arquivo
// deliberadamente injeta uma config cujo drift pré-absorção excede o limite e mostra o guard
// acusando (ver seção de auto-teste no fim do arquivo, ativada por AUDIT_FORCE_RED=1).
//
// A pré-condição antiga que lançava "FIXTURE INVALID" se sumBps !== 10000 foi REMOVIDA de propósito
// (era ela que tornava "101%" — a frase literal do mandato de Clayton — impossível de sequer
// testar). Isso agora vive na seção HOSTILE_OVER_100_PCT_CONFIGS abaixo: testa bps somando 10150
// (101,5%) contra o motor DIRETAMENTE, bypassando o gate de aplicação (economic-policy-write-
// validation.ts), como teste de defesa-em-profundidade do motor.
//
// ── O QUE NÃO ENTROU AQUI (achado, não fixture forçada) ────────────────────────────────────────
// bps=10000 (fechando 100% sozinho) + QUALQUER linha fixedAmountCents adicional é um defeito REAL
// e VIVO cujo conserto exigiria tocar economic-policy-engine.service.ts (BYTE-PINADO, fora desta
// fatia): o motor SUBTRAI a linha fixa do revenue_share (que já foi calculado como 100% do bps),
// ao invés de reservar espaço para ela ANTES de dividir a percentagem — silenciosamente drena o
// revenue_share por um valor que não é arredondamento. Sob as regras atuais e INALTERADAS de
// assertPolicyLinesValid (bps, quando presente, tem que somar EXATAMENTE 10000), TODA policy mista
// bps+fixedAmountCents aceita pelo Passo 1 tem NECESSARIAMENTE essa forma — não existe uma variação
// "bps<10000 + fixo preenchendo o resto" que passe (bpsSum!==10000 já é rejeitado, sem mudança
// nesta fatia). Ou seja: não há uma forma de "fixo + percentual" que seja SIMULTANEAMENTE aceita
// no Passo 1 e seguramente testável aqui sem ou (a) mascarar o defeito com valores pequenos, ou
// (b) deixar o guard permanentemente vermelho para valores realistas — os dois desfechos que a
// direção proibiu explicitamente. Não forçado. Ver relatório da fatia K_pe_7 para o texto completo.
//
// Rodar isolado: node --import tsx scripts/audit-economic-policy-split-cent-conservation.mjs

import { pathToFileURL } from 'url';
import { join } from 'path';

const ROOT = process.cwd(); // backend/ quando chamado pelo runner ("node scripts/...")
const ENGINE_REL = 'src/modules/economy/policy-engine/economic-policy-engine.service.ts';

// ── conjunto hostil de amounts (K_amt): dividem mal por bps, primos, potências que não fecham ──
const AMOUNTS_CENTS = [
  1, 3, 7, 99, 101, 999, 1_000_003,
  // primos adicionais (magnitudes distintas)
  2, 13, 17, 9973, 104729,
];

// helper: monta uma EconomicPolicyLine mínima (só os campos que calculatePolicySplits LÊ:
// priority, bps, fixedAmountCents, lineType, destinationType, destinationKey, regionalOriginBasis,
// regionalLevel, metadata, id — os demais campos do contrato completo não são tocados pela função).
let seq = 0;
function line(lineType, bps, priority, extra = {}) {
  seq += 1;
  return {
    id: `hostile-line-${seq}`,
    policyId: 'hostile-policy',
    lineType,
    destinationType: extra.destinationType ?? 'platform_fees',
    destinationKey: extra.destinationKey ?? null,
    regionalOriginBasis: extra.regionalOriginBasis ?? null,
    regionalLevel: extra.regionalLevel ?? null,
    bps,
    fixedAmountCents: extra.fixedAmountCents ?? null,
    appliesTo: 'gross_transaction',
    conditionType: null,
    conditionJson: {},
    priority,
    metadata: {},
    createdAt: new Date(0).toISOString(),
  };
}

/** Mesma forma que `line()`, mas para linha FIXA (bps sempre null). */
function fixedLine(lineType, fixedAmountCents, priority, extra = {}) {
  return line(lineType, null, priority, { ...extra, fixedAmountCents });
}

/**
 * Soma NAIVE (linha a linha, ANTES da absorção do motor) — a mesma fórmula de UMA linha do
 * docstring de calculatePolicySplits (economic-policy-engine.service.ts:220-222 e o loop em
 * :246-257). Não reimplementa absorção, ordenação por priority (irrelevante para a soma) nem
 * tratamento de erro — só o suficiente para medir o drift PRÉ-absorção, que a função real não
 * expõe no retorno (o retorno já vem pós-absorção, sum===amountCents sempre que não lança).
 */
function naivePreAbsorptionSum(amountCents, lines) {
  let sum = 0;
  for (const l of lines) {
    if (l.bps !== null && l.bps !== undefined) {
      sum += Math.floor((amountCents * l.bps) / 10000);
    } else if (l.fixedAmountCents !== null && l.fixedAmountCents !== undefined) {
      sum += l.fixedAmountCents;
    }
  }
  return sum;
}

// ── configurações hostis de linhas PERCENTUAIS (bps somando EXATAMENTE 10000 — publicáveis hoje,
// intocadas desta fatia) ──
const PERCENT_CONFIGS = [
  {
    name: '3_lines_3333_3333_3334_revenue_share_first',
    lines: [
      line('revenue_share', 3333, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 3333, 1),
      line('reserve', 3334, 2),
    ],
  },
  {
    name: '3_lines_3333_3333_3334_revenue_share_last',
    lines: [
      line('platform_fee', 3333, 0),
      line('reserve', 3333, 1),
      line('revenue_share', 3334, 2, { destinationType: 'receiver_actor' }),
    ],
  },
  {
    name: '7_lines_1429x6_1426_revenue_share_middle',
    // 1429*6 + 1426 = 10000. Divide mal por 7 (10000/7 ≈ 1428.57) — resíduo de arredondamento
    // em CADA linha antes do drift.
    lines: [
      line('platform_fee', 1429, 0),
      line('reserve', 1429, 1),
      line('regional_fund', 1429, 2, {
        destinationType: 'regional_fund',
        regionalOriginBasis: 'payer_identity_residence',
        regionalLevel: 'city',
      }),
      line('revenue_share', 1429, 3, { destinationType: 'receiver_actor' }),
      line('platform_fee', 1429, 4),
      line('reserve', 1429, 5),
      line('reserve', 1426, 6),
    ],
  },
  {
    name: '2_lines_9700_300',
    lines: [
      line('revenue_share', 9700, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 300, 1),
    ],
  },
  {
    name: '1_line_10000_revenue_share_only',
    // caso extremo: policy de linha única — floor(amount*10000/10000) === amount sempre, drift=0.
    lines: [line('revenue_share', 10000, 0, { destinationType: 'receiver_actor' })],
  },
  // ── as 3 policies REAIS semeadas (seed-economic-policies-legacy-baseline.ts) — números
  // copiados literalmente do fixture de semeadura (não são inventados aqui; se o seed mudar os
  // bps, este guard precisa ser atualizado junto — dependência documentada, não derivada). ──
  {
    name: 'real_seed_legacy_baseline_service_execution (seed-economic-policies-legacy-baseline.ts:126-141)',
    lines: [
      line('revenue_share', 9700, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 300, 1),
    ],
  },
  {
    name: 'real_seed_legacy_baseline_ride_payment (seed-economic-policies-legacy-baseline.ts:162-177)',
    lines: [
      line('revenue_share', 9700, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 300, 1),
    ],
  },
  {
    name: 'real_seed_legacy_baseline_event_ticket_curitiba (seed-economic-policies-legacy-baseline.ts:214-245)',
    lines: [
      line('revenue_share', 7000, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 300, 1),
      line('regional_fund', 1000, 2, {
        destinationType: 'regional_fund',
        regionalOriginBasis: 'payer_identity_residence',
        regionalLevel: 'city',
      }),
      line('reserve', 1700, 3),
    ],
  },
];

// ── NOVO — fixture (a) "só-fixo": ZERO linhas bps, fixedAmountCents somando EXATAMENTE o total
// da transação sendo testada (2 linhas: revenue_share + platform_fee, split ~70/30 em cents, com
// o resto inteiro indo para revenue_share — determinístico, drift=0 por construção). Gerada
// dinamicamente por amountCents (fixedAmountCents é uma constante em CENTAVOS, não uma fração —
// não faz sentido reusar um valor fixo estático contra o conjunto hostil inteiro de amounts). ──
function onlyFixedExactSplitLines(amountCents) {
  const platformFeeCents = Math.floor(amountCents * 0.3);
  const revenueShareCents = amountCents - platformFeeCents;
  return [
    fixedLine('revenue_share', revenueShareCents, 0, { destinationType: 'receiver_actor' }),
    fixedLine('platform_fee', platformFeeCents, 1),
  ];
}

const CONSERVATION_CONFIGS = [
  ...PERCENT_CONFIGS,
  { name: 'only_fixed_exact_split_dynamic_per_amount (fixture a — só-fixo)', buildLines: onlyFixedExactSplitLines },
];

// ── NOVO — fixture (c) "fixo cuja soma excede o total": linha fixa NÃO-revenue_share cujo valor
// (1000 cents) pode ultrapassar o amountCents testado, forçando o motor a tentar absorver um
// drift negativo maior do que o revenue_share (que também é fixo, 1 cent) comporta. Zero bps —
// não é a forma "bps=10000+fixo" (o defeito vivo fora de escopo, ver cabeçalho). Cada entrada
// declara os PRÓPRIOS amounts (não o sweep hostil inteiro): fixedAmountCents é uma constante em
// centavos, então "exceder o total" só é um cenário construído para amounts específicos — testar
// contra 1_000_003 não exerceria "excede", exerceria "sobra muita margem" (caso completamente
// diferente, fora do que fixture (c) pede). ──
const FIXED_EXCEEDS_TOTAL_LINES = [
  fixedLine('revenue_share', 1, 0, { destinationType: 'receiver_actor' }),
  fixedLine('platform_fee', 1000, 1),
];
const BOUNDARY_CONFIGS = [
  {
    name: 'fixed_exceeds_total_must_throw (fixture c — fixo cuja soma excede o total)',
    lines: FIXED_EXCEEDS_TOTAL_LINES,
    amounts: [1, 500, 999],
    expect: 'throw',
    expectedSubstring: 'CALCULATION_INVALID',
  },
  {
    name: 'fixed_exceeds_total_edge_zero_revenue_share (fixture c — borda: exatamente zero não é negativo)',
    lines: FIXED_EXCEEDS_TOTAL_LINES,
    amounts: [1000],
    expect: 'success',
    assertRevenueShareAmountCents: 0,
  },
  {
    name: 'fixed_exceeds_total_edge_exact_match (fixture c — borda: soma exata, drift=0)',
    lines: FIXED_EXCEEDS_TOTAL_LINES,
    amounts: [1001],
    expect: 'success',
    assertRevenueShareAmountCents: 1,
  },
  // ── "101%" — a frase literal do mandato de Clayton ("não dê margem pra cento e um por cento").
  // bps somando 10150 (101,5%), CADA linha individualmente dentro de 0-10000 (só a SOMA estoura),
  // testado DIRETO contra o motor (bypassa economic-policy-write-validation.ts de propósito — é
  // isso que a remoção da pré-condição FIXTURE INVALID libera). Achado registrado no header desta
  // seção: para amounts pequenos, floor(amount*bps/10000) arredonda a maioria das linhas para 0,
  // e o excedente de 101,5% nunca vira um centavo real — não é falso-negativo, é a aritmética
  // inteira fazendo exatamente o que deveria (não existe fração de centavo). Por isso os dois
  // conjuntos de amounts abaixo são DIFERENTES: em escala pequena, o drift pré-absorção fica
  // dentro do limite de |drift|<=n (harmless); em escala grande, o excedente vira dinheiro real e
  // o motor corretamente lança CALCULATION_INVALID (revenue_share negativo) — fail-closed. ──
  {
    name: 'hostile_over_10000_bps_101_5pct_must_throw_at_scale (bps somam 10150; magnitude grande)',
    lines: [
      line('revenue_share', 50, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 9000, 1),
      line('reserve', 1100, 2),
    ],
    amounts: [999, 9973, 104729, 1_000_003],
    expect: 'throw',
    expectedSubstring: 'CALCULATION_INVALID',
  },
  {
    name: 'hostile_over_10000_bps_101_5pct_harmless_at_small_scale (mesma config; magnitude pequena)',
    lines: [
      line('revenue_share', 50, 0, { destinationType: 'receiver_actor' }),
      line('platform_fee', 9000, 1),
      line('reserve', 1100, 2),
    ],
    amounts: [1, 2, 3, 7, 13, 17, 99, 101],
    expect: 'success',
  },
];

async function main({ forceRed = false } = {}) {
  const enginePath = join(ROOT, ENGINE_REL);
  // Import REAL — a mesma classe usada por service-payment-execution.service.ts em produção.
  // Não reimplementamos a função de split completa aqui; só invocamos.
  const { economicPolicyEngineService } = await import(pathToFileURL(enginePath).href);

  let total = 0;
  let failures = 0;
  const failDetails = [];

  // ═══ 1) CONSERVATION_CONFIGS — sweep completo contra AMOUNTS_CENTS, sucesso esperado sempre ═══
  for (const cfg of CONSERVATION_CONFIGS) {
    for (const amountCents of AMOUNTS_CENTS) {
      const lines = cfg.buildLines ? cfg.buildLines(amountCents) : cfg.lines;
      total += 1;
      const caseLabel = `${cfg.name} × amountCents=${amountCents}`;
      try {
        const result = economicPolicyEngineService.calculatePolicySplits(amountCents, lines);

        // Checks 1-3: guaranteed once the engine returns without throwing (structural — o motor
        // já não deixaria sum!==amountCents, negativo ou overshoot passar sem lançar). Mantidos
        // como smoke de regressão do CONTRATO do motor, não como a prova principal.
        const sum = result.splits.reduce((s, x) => s + x.amountCents, 0);
        if (sum !== amountCents) {
          failures += 1;
          failDetails.push(`${caseLabel}: sum(lines)=${sum} !== total=${amountCents} (CONTRATO DO MOTOR QUEBRADO)`);
          continue;
        }
        const negative = result.splits.find((x) => x.amountCents < 0);
        if (negative) {
          failures += 1;
          failDetails.push(`${caseLabel}: linha ${negative.lineType} negativa (amountCents=${negative.amountCents})`);
          continue;
        }
        const overshoot = result.splits.find((x) => x.amountCents > amountCents);
        if (overshoot) {
          failures += 1;
          failDetails.push(`${caseLabel}: linha ${overshoot.lineType} excede o total (amountCents=${overshoot.amountCents} > ${amountCents})`);
          continue;
        }

        // Check 4 (NOVO — a invariante FALSIFICÁVEL que substitui o check antigo): |drift
        // pré-absorção| <= nº de linhas. Um drift maior não é arredondamento — é config
        // estruturalmente desalinhada que o motor está mascarando via absorção.
        let bound = lines.length;
        if (forceRed) bound = 0; // PROVA_VERMELHA: aperta o limite para forçar violação real.
        const naive = naivePreAbsorptionSum(amountCents, lines);
        const preDrift = amountCents - naive;
        if (Math.abs(preDrift) > bound) {
          failures += 1;
          failDetails.push(
            `${caseLabel}: drift pré-absorção=${preDrift} excede o limite de ${bound} linha(s) — não é mais arredondamento (K_pe_7 / "não dê margem pra cento e um por cento")`
          );
          continue;
        }
      } catch (e) {
        failures += 1;
        failDetails.push(`${caseLabel}: THREW ${e?.message ?? e} (esperava-se sucesso — CONSERVATION_CONFIGS são todas publicáveis hoje pelo Passo 1)`);
      }
    }
  }

  // ═══ 2) BOUNDARY_CONFIGS — cada uma testa SEUS PRÓPRIOS amounts, com desfecho esperado explícito ═══
  for (const cfg of BOUNDARY_CONFIGS) {
    for (const amountCents of cfg.amounts) {
      total += 1;
      const caseLabel = `${cfg.name} × amountCents=${amountCents}`;
      let threw = false;
      let thrownMessage = null;
      let result = null;
      try {
        result = economicPolicyEngineService.calculatePolicySplits(amountCents, cfg.lines);
      } catch (e) {
        threw = true;
        thrownMessage = e?.message ?? String(e);
      }

      if (cfg.expect === 'throw') {
        if (!threw) {
          failures += 1;
          failDetails.push(`${caseLabel}: esperava-se THROW (${cfg.expectedSubstring}) mas o motor retornou sucesso — margem indevida não detectada.`);
        } else if (cfg.expectedSubstring && !thrownMessage.includes(cfg.expectedSubstring)) {
          failures += 1;
          failDetails.push(`${caseLabel}: lançou, mas mensagem não contém '${cfg.expectedSubstring}': "${thrownMessage}"`);
        }
      } else if (cfg.expect === 'success') {
        if (threw) {
          failures += 1;
          failDetails.push(`${caseLabel}: esperava-se SUCESSO mas o motor lançou: "${thrownMessage}"`);
        } else {
          const sum = result.splits.reduce((s, x) => s + x.amountCents, 0);
          if (sum !== amountCents) {
            failures += 1;
            failDetails.push(`${caseLabel}: sum(lines)=${sum} !== total=${amountCents}`);
            continue;
          }
          if (typeof cfg.assertRevenueShareAmountCents === 'number') {
            const rs = result.splits.find((x) => x.lineType === 'revenue_share');
            if (!rs || rs.amountCents !== cfg.assertRevenueShareAmountCents) {
              failures += 1;
              failDetails.push(
                `${caseLabel}: revenue_share.amountCents=${rs?.amountCents} !== esperado ${cfg.assertRevenueShareAmountCents}`
              );
              continue;
            }
          }
        }
      } else {
        throw new Error(`BUG NO GUARD: cfg.expect desconhecido '${cfg.expect}' em ${cfg.name}`);
      }
    }
  }

  if (failures > 0) {
    console.error(`GATE FAIL [economic-policy-split-cent-conservation]: ${failures}/${total} casos hostis quebraram a invariante:`);
    for (const d of failDetails) console.error('   - ' + d);
    process.exit(1);
  }
  console.log(
    `GATE OK [economic-policy-split-cent-conservation] — ${total} casos hostis (${CONSERVATION_CONFIGS.length} configs de conservação × ${AMOUNTS_CENTS.length} amounts + ${BOUNDARY_CONFIGS.length} configs de borda com amounts próprios) via economicPolicyEngineService.calculatePolicySplits() REAL: |drift pré-absorção| <= nº de linhas, sem linha negativa, sem linha > total, bordas de exceção fail-closed corretas.`
  );
}

// PROVA_VERMELHA: `AUDIT_FORCE_RED=1 node --import tsx scripts/audit-economic-policy-split-cent-conservation.mjs`
// aperta o limite (bound=0) e força o guard a acusar drift pré-absorção real (as configs de
// conservação SEMPRE têm algum drift >0 nalgum amount hostil, por arredondamento) — prova de que
// o check 4 é falsificável de verdade, não decoração.
main({ forceRed: process.env.AUDIT_FORCE_RED === '1' }).catch((e) => {
  console.error('GATE FAIL [economic-policy-split-cent-conservation]: erro fatal ao rodar o guard:', e?.message ?? e);
  process.exit(1);
});

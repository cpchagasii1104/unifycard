#!/usr/bin/env node
// backend/scripts/audit-economic-policy-split-cent-conservation.mjs
// GUARD ESTRUTURAL — prova de conservação de centavos do split canônico (mandato Clayton: "calcule os
// centavos, não dê margem pra cento e um por cento"). Não é lexical: EXECUTA a matemática REAL —
// importa e chama economicPolicyEngineService.calculatePolicySplits (economic-policy-engine.service.ts,
// K_pe_5/K_pe_7) contra um conjunto hostil de (amountCents, lines). Não reimplementa o cálculo — uma
// segunda verdade aritmética é exatamente o que este guard existe para impedir.
//
// Invariante testado, para CADA (amountCents, config) do produto hostil abaixo:
//   1. sum(splits.amountCents) === amountCents (conservação exata — nem sobra, nem falta)
//   2. nenhuma linha com amountCents < 0
//   3. nenhuma linha com amountCents > amountCents (total)
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
    fixedAmountCents: null,
    appliesTo: 'gross_transaction',
    conditionType: null,
    conditionJson: {},
    priority,
    metadata: {},
    createdAt: new Date(0).toISOString(),
  };
}

// ── configurações hostis de linhas (todas somam EXATAMENTE 10000 bps — pré-condição de escrita
// já enforced por assertPolicyLinesValid; este guard testa a 2ª metade: o CÁLCULO conserva?) ──
const CONFIGS = [
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

async function main() {
  const enginePath = join(ROOT, ENGINE_REL);
  // Import REAL — a mesma classe usada por service-payment-execution.service.ts em produção.
  // Não reimplementamos NENHUMA aritmética aqui; só invocamos.
  const { economicPolicyEngineService } = await import(pathToFileURL(enginePath).href);

  let total = 0;
  let failures = 0;
  const failDetails = [];

  for (const cfg of CONFIGS) {
    const sumBps = cfg.lines.reduce((s, l) => s + (l.bps ?? 0), 0);
    if (sumBps !== 10000) {
      // pré-condição do próprio fixture do guard — não é achado sobre o motor, é bug no guard.
      throw new Error(`FIXTURE INVALID: config '${cfg.name}' soma ${sumBps} bps, esperado 10000`);
    }
    for (const amountCents of AMOUNTS_CENTS) {
      total += 1;
      const caseLabel = `${cfg.name} × amountCents=${amountCents}`;
      try {
        const result = economicPolicyEngineService.calculatePolicySplits(amountCents, cfg.lines);
        const sum = result.splits.reduce((s, x) => s + x.amountCents, 0);
        if (sum !== amountCents) {
          failures += 1;
          failDetails.push(`${caseLabel}: sum(lines)=${sum} !== total=${amountCents} (CONSERVATION BROKEN)`);
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
      } catch (e) {
        failures += 1;
        failDetails.push(`${caseLabel}: THREW ${e?.message ?? e} (esperava-se sucesso — todas as configs somam 10000 bps e todo amountCents é inteiro positivo)`);
      }
    }
  }

  if (failures > 0) {
    console.error(`GATE FAIL [economic-policy-split-cent-conservation]: ${failures}/${total} casos hostis quebraram a conservação de centavos:`);
    for (const d of failDetails) console.error('   - ' + d);
    process.exit(1);
  }
  console.log(
    `GATE OK [economic-policy-split-cent-conservation] — ${total} casos hostis (${CONFIGS.length} configs × ${AMOUNTS_CENTS.length} amounts) via economicPolicyEngineService.calculatePolicySplits() REAL: conservação exata (sum===total), sem linha negativa, sem linha > total.`
  );
}

main().catch((e) => {
  console.error('GATE FAIL [economic-policy-split-cent-conservation]: erro fatal ao rodar o guard:', e?.message ?? e);
  process.exit(1);
});

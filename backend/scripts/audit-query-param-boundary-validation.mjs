#!/usr/bin/env node
// backend/scripts/audit-query-param-boundary-validation.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-07-31, GO Clayton)
// ║ NORMA:   F-QUERY-PARAM-BOUNDARY (cartório) — não é vocabulário×enum
// ║ NÃO:     cruzar vocabulário do banco × união TS (eixo provado ruído)
// ║ EM VEZ:  morder em `req.query.* as any` na FRONTEIRA de *.routes.ts
// ╚════════════════════════════════════════════════════════════════
//
// Origem: 4 membros da mesma família achados em 2 dias por instâncias
// diferentes (service_order_status, ServiceOrderDetailPage, alert_severity/
// alert_status, services.status) — a causa comum não era o vocabulário
// específico de cada um, era a fronteira: `req.query.X as any` remove toda
// checagem de tipo e deixa entrada de usuário crua alcançar o SQL. Varredura
// de 2026-07-31 (GO Clayton): 65 SÍTIOS de cast em `backend/src/**/*.routes.ts`
// (39 `req.query.X as any` / `(req.query as any).X` de propriedade única, 26
// `const V = req.query as any` de objeto inteiro). Os 26 de objeto inteiro
// expõem em média >5 campos cada um sem checagem nenhuma — expandidos por
// PROPRIEDADE realmente usada no mesmo handler, viram 181 símbolos. Allowlist
// abaixo é por arquivo:símbolo (181), não por sítio de cast (65) — ver nota
// na declaração da allowlist sobre por quê a granularidade mais fina importa.
//
// REGRA DO GUARD (o que decide se ele apodrece ou não):
//   - Sítio detectado e NÃO alistado  → FAIL ("item novo").
//   - Entrada alistada sem sítio correspondente no código → FAIL
//     ("allowlist não podada — remova a linha junto com o fix, ou o item
//     voltou disfarçado").
//   - `detected.size` OU `ALLOWLIST.size` MAIOR que `BASELINE_COUNT` → FAIL,
//     mesmo que os dois conjuntos batam ponto-a-ponto entre si. Sem este
//     teto, um `as any` novo + uma linha nova na allowlist no MESMO commit
//     passam nos dois laços de pertencimento acima (o par novo bate com o
//     par novo) e o guard fica verde com a contagem maior — foi achado real
//     (Clayton, 2026-07-31): a v1 deste arquivo tinha essa exata lacuna, e o
//     comentário aqui embaixo AFIRMAVA a garantia sem o código cumprir.
//   - Se `detected.size < BASELINE_COUNT` (alguém consertou e a contagem
//     caiu de verdade) mas `BASELINE_COUNT` (linha da constante) não foi
//     baixado no mesmo commit → FAIL, com o número novo já calculado na
//     mensagem. Sem isto, a primeira rota consertada trava o runner pra
//     sempre (baseline nunca acompanha) até alguém decidir desligar o guard
//     — o oposto do que "a contagem só pode descer" deveria significar.
//   - Só passa quando os dois conjuntos batem ponto-a-ponto E os dois
//     tamanhos são EXATAMENTE `BASELINE_COUNT`. `BASELINE_COUNT` é o teto
//     vivo, não um comentário: ele só desce, e só por edição humana deste
//     arquivo (revisável em code review), nunca sozinho.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_ROOT = path.join(__dirname, '../src');

// ============================================================================
// ALLOWLIST CONGELADA — 181 símbolos, gerados do disco vivo em 2026-07-31.
// Chave: "arquivo::símbolo::ordinal" (ordinal = enésima ocorrência do mesmo
// símbolo no mesmo arquivo, em ordem de leitura top-to-bottom — robusto a
// deslocamento de linha por edição não relacionada; NÃO robusto a
// reordenação de handlers, o que é uma mudança real que merece revisão).
// Granularidade POR PARÂMETRO (não por sítio de cast): um `const query =
// req.query as any` que expõe 9 campos conta como 9 entradas, porque um
// campo NOVO usado a partir do MESMO objeto já-castado é, na prática, o
// mesmo defeito nascendo de novo sem tocar a linha do cast — se a allowlist
// fosse por sítio de cast (só 65), esse campo novo passaria batido.
// ============================================================================
const ALLOWLIST = new Set([
  "core/calendar/unified-calendar.routes.ts::actorId::1", "core/calendar/unified-calendar.routes.ts::eventId::1",
  "core/calendar/unified-calendar.routes.ts::limit::1", "core/calendar/unified-calendar.routes.ts::offset::1",
  "core/calendar/unified-calendar.routes.ts::serviceId::1", "core/calendar/unified-calendar.routes.ts::source::1",
  "core/calendar/unified-calendar.routes.ts::startTimeFrom::1", "core/calendar/unified-calendar.routes.ts::startTimeTo::1",
  "core/calendar/unified-calendar.routes.ts::type::1", "core/feed/feed.routes.ts::limit::1",
  "core/matching/matching.routes.ts::limit::1", "core/opportunity/opportunity.routes.ts::limit::1",
  "core/pilot/pilot-events.routes.ts::eventType::1", "core/pilot/pilot-events.routes.ts::eventType::2",
  "core/pilot/pilot-invites.routes.ts::status::1", "core/unifybank/bank-balance-consolidation.routes.ts::currency::1",
  "core/unifybank/bank-balance-consolidation.routes.ts::currency::2", "core/unifybank/bank-balance-consolidation.routes.ts::currency::3",
  "core/unifybank/bank-balance-consolidation.routes.ts::endDate::1", "core/unifybank/bank-balance-consolidation.routes.ts::endDate::2",
  "core/unifybank/bank-balance-consolidation.routes.ts::limit::1", "core/unifybank/bank-balance-consolidation.routes.ts::limit::2",
  "core/unifybank/bank-balance-consolidation.routes.ts::offset::1", "core/unifybank/bank-balance-consolidation.routes.ts::offset::2",
  "core/unifybank/bank-balance-consolidation.routes.ts::query::1", "core/unifybank/bank-balance-consolidation.routes.ts::startDate::1",
  "core/unifybank/bank-balance-consolidation.routes.ts::startDate::2", "modules/agreements/agreement.routes.ts::contextType::1",
  "modules/agreements/agreement.routes.ts::status::1", "modules/business-audit/business-audit.routes.ts::action::1",
  "modules/business-audit/business-audit.routes.ts::contextType::1", "modules/dashboard/dashboard.routes.ts::actorId::1",
  "modules/dashboard/dashboard.routes.ts::actorId::2", "modules/dashboard/dashboard.routes.ts::actorId::3",
  "modules/dashboard/dashboard.routes.ts::actorId::4", "modules/dashboard/dashboard.routes.ts::channel::1",
  "modules/dashboard/dashboard.routes.ts::channel::2", "modules/dashboard/dashboard.routes.ts::channel::3",
  "modules/dashboard/dashboard.routes.ts::channel::4", "modules/dashboard/dashboard.routes.ts::consolidated::1",
  "modules/dashboard/dashboard.routes.ts::endDate::1", "modules/dashboard/dashboard.routes.ts::organizationUnitId::1",
  "modules/dashboard/dashboard.routes.ts::startDate::1", "modules/dashboard/dashboard.routes.ts::variantId::1",

  "modules/evidence/evidence.routes.ts::contextType::1", "modules/evidence/evidence.routes.ts::disputeStatus::1",
  "modules/invoicing/invoice.routes.ts::invoiceType::1", "modules/invoicing/invoice.routes.ts::status::1",
  "modules/ledger/ledger.routes.ts::contextType::1", "modules/ledger/ledger.routes.ts::entryType::1",
  "modules/marketplace/marketplace-categories.routes.ts::domain::1", "modules/marketplace/marketplace-categories.routes.ts::domain::2",
  "modules/marketplace/marketplace-categories.routes.ts::type::1", "modules/marketplace/marketplace-categories.routes.ts::type::2",
  "modules/marketplace/marketplace-categories.routes.ts::type::3", "modules/marketplace/marketplace-search.routes.ts::actorType::1",
  "modules/marketplace/marketplace-search.routes.ts::trustLevel::1", "modules/marketplace/payment-method.routes.ts::actorId::1",
  "modules/marketplace/payment-method.routes.ts::isDefault::1", "modules/marketplace/payment-method.routes.ts::limit::1",
  "modules/marketplace/payment-method.routes.ts::offset::1", "modules/marketplace/payment-method.routes.ts::provider::1",
  "modules/marketplace/payment-method.routes.ts::type::1", "modules/marketplace/purchase-order.routes.ts::limit::1",
  "modules/marketplace/purchase-order.routes.ts::offset::1", "modules/marketplace/purchase-order.routes.ts::orderDateFrom::1",
  "modules/marketplace/purchase-order.routes.ts::orderDateTo::1", "modules/marketplace/purchase-order.routes.ts::status::1",
  "modules/marketplace/purchase-order.routes.ts::supplierId::1", "modules/marketplace/settlement.routes.ts::sourceType::1",
  "modules/marketplace/settlement.routes.ts::status::1", "modules/marketplace/supplier.routes.ts::limit::1",
  "modules/marketplace/supplier.routes.ts::offset::1", "modules/marketplace/supplier.routes.ts::search::1",
  "modules/marketplace/supplier.routes.ts::status::1", "modules/marketplace/unifycard.routes.ts::actorId::1",
  "modules/marketplace/unifycard.routes.ts::limit::1", "modules/marketplace/unifycard.routes.ts::offset::1",
  "modules/marketplace/unifycard.routes.ts::paymentIntentId::1", "modules/marketplace/unifycard.routes.ts::status::1",
  "modules/marketplace/unifycard.routes.ts::transactionType::1",
  "modules/public-profiles/public-profile.routes.ts::profileType::1", "modules/relationships/actor-relationship.routes.ts::label::1",
  "modules/relationships/actor-relationship.routes.ts::status::1", "modules/reports/reports.routes.ts::actorId::1",
  "modules/reports/reports.routes.ts::actorId::2", "modules/reports/reports.routes.ts::actorId::3",
  "modules/reports/reports.routes.ts::actorId::4", "modules/reports/reports.routes.ts::actorId::5",
  "modules/reports/reports.routes.ts::actorId::6", "modules/reports/reports.routes.ts::actorId::7",
   "modules/reports/reports.routes.ts::channel::1",
  "modules/reports/reports.routes.ts::channel::2", "modules/reports/reports.routes.ts::channel::3",
  "modules/reports/reports.routes.ts::channel::4", "modules/reports/reports.routes.ts::consolidated::1",
  "modules/reports/reports.routes.ts::dailyHoldingRate::1", "modules/reports/reports.routes.ts::endDate::1",
  "modules/reports/reports.routes.ts::endDate::2",
  "modules/reports/reports.routes.ts::excessStockMultiplier::1", "modules/reports/reports.routes.ts::fromActorId::1",
  "modules/reports/reports.routes.ts::highAgingThreshold::1", "modules/reports/reports.routes.ts::highCostThreshold::1",
  "modules/reports/reports.routes.ts::holdingCostDailyRate::1", "modules/reports/reports.routes.ts::holdingCostDailyRate::2",
  "modules/reports/reports.routes.ts::holdingCostDailyRate::3", "modules/reports/reports.routes.ts::includeHoldingCost::1",
  "modules/reports/reports.routes.ts::includeHoldingCost::2", "modules/reports/reports.routes.ts::includeHoldingCost::3",
  "modules/reports/reports.routes.ts::limit::1", "modules/reports/reports.routes.ts::limit::2",
  "modules/reports/reports.routes.ts::limit::3", "modules/reports/reports.routes.ts::limit::4",
  "modules/reports/reports.routes.ts::limit::5", "modules/reports/reports.routes.ts::limit::6",
  "modules/reports/reports.routes.ts::lowCostThreshold::1", "modules/reports/reports.routes.ts::lowTurnoverThreshold::1",
  "modules/reports/reports.routes.ts::maxDaysInStock::1", "modules/reports/reports.routes.ts::maxDaysReceivingToReceived::1",
  "modules/reports/reports.routes.ts::maxDaysShippedToReceiving::1", "modules/reports/reports.routes.ts::mediumCostThreshold::1",
  "modules/reports/reports.routes.ts::minConfidence::1", "modules/reports/reports.routes.ts::minCost::1",
  "modules/reports/reports.routes.ts::minCostLevel::1", "modules/reports/reports.routes.ts::minDays::1",
  "modules/reports/reports.routes.ts::minDaysInStock::1", "modules/reports/reports.routes.ts::minDaysOfStock::1",
  "modules/reports/reports.routes.ts::offset::1", "modules/reports/reports.routes.ts::offset::2",
  "modules/reports/reports.routes.ts::offset::3", "modules/reports/reports.routes.ts::offset::4",
  "modules/reports/reports.routes.ts::offset::5", "modules/reports/reports.routes.ts::offset::6",
  "modules/reports/reports.routes.ts::onlyOverdue::1", "modules/reports/reports.routes.ts::organizationUnitId::1",
  "modules/reports/reports.routes.ts::periodEnd::1", "modules/reports/reports.routes.ts::periodEnd::2",
  "modules/reports/reports.routes.ts::periodEnd::3", "modules/reports/reports.routes.ts::periodStart::1",
  "modules/reports/reports.routes.ts::periodStart::2", "modules/reports/reports.routes.ts::periodStart::3",
  "modules/reports/reports.routes.ts::priceRangeSteps::1", "modules/reports/reports.routes.ts::productId::1",
  "modules/reports/reports.routes.ts::productVariantId::1", "modules/reports/reports.routes.ts::productVariantId::2",
  "modules/reports/reports.routes.ts::productVariantId::3", "modules/reports/reports.routes.ts::productVariantId::4",
  "modules/reports/reports.routes.ts::productVariantId::5", "modules/reports/reports.routes.ts::simulationPeriodDays::1",
  "modules/reports/reports.routes.ts::slaMaxDaysReceivingToReceived::1", "modules/reports/reports.routes.ts::slaMaxDaysShippedToReceiving::1",
  "modules/reports/reports.routes.ts::staleStockThreshold::1", "modules/reports/reports.routes.ts::startDate::1",
  "modules/reports/reports.routes.ts::startDate::2",
  "modules/reports/reports.routes.ts::status::1", "modules/reports/reports.routes.ts::stockoutRiskThreshold::1",
  "modules/reports/reports.routes.ts::suggestionType::1", "modules/reports/reports.routes.ts::toActorId::1",
  "modules/reports/reports.routes.ts::variantId::1", "modules/rides/zones/zones.routes.ts::cityId::1",
  "modules/risk-command-center/risk-dashboard.routes.ts::riskLevel::1", "modules/services/service-order.routes.ts::customerActorId::1",
  "modules/services/service-order.routes.ts::limit::1", "modules/services/service-order.routes.ts::offset::1",
  "modules/services/service-order.routes.ts::scheduledStartFrom::1", "modules/services/service-order.routes.ts::scheduledStartTo::1",
  "modules/services/service-order.routes.ts::serviceId::1", "modules/services/service-order.routes.ts::status::1",
  "modules/services/service-order.routes.ts::workerActorId::1", "modules/services/services.routes.ts::status::1",
  "modules/services/services.routes.ts::status::2", "modules/trust/trust.routes.ts::contextType::1",
  "modules/trust/trust.routes.ts::eventType::1", "modules/trust/trust.routes.ts::riskLevel::1",
  "modules/trust/trust.routes.ts::severity::1",
]);
// RATCHET DOWN 181→180 (2026-08-01, F-PAYOUT-READER-CONTAINMENT): a contenção dos readers de
// payout em 503 removeu `req.query.status as any` de payout.routes.ts. Não foi conserto planejado
// deste teto — foi ganho de carona, e o guard exigiu que a allowlist encolhesse no MESMO commit.
const BASELINE_COUNT = 175; // 177→175 em 2026-08-02: aposentadoria do escrow (f4) removeu os 2 casts das rotas aposentadas.

// ============================================================================
// VARREDURA — mesma lógica de detecção usada para gerar a allowlist acima.
// ============================================================================
function getAllRouteFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.spec', '.test', '__tests__'].some((s) => entry.name.includes(s))) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.routes.ts')) {
        files.push(path.join(dir, entry.name));
      }
    }
  };
  walk(SRC_ROOT);
  return files;
}

function findEnclosingHandlerRange(lines, lineIdx) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i > lineIdx) break;
    if (/fastify\.(get|post|put|patch|delete)\s*[<(]/.test(lines[i])) start = i;
  }
  if (start === -1) return null;
  let depth = 0;
  let started = false;
  for (let j = start; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; }
    }
    if (started && depth <= 0) return { start, end: j };
  }
  return { start, end: lines.length - 1 };
}

function scanFile(absPath, relPath) {
  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  const found = []; // { file, line, symbol, kind }

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    let m;

    const p1 = /req\.query\.([A-Za-z_][A-Za-z0-9_]*)\s+as\s+any/g;
    while ((m = p1.exec(lineText)) !== null) {
      found.push({ file: relPath, line: lineNum, symbol: m[1], kind: 'single-prop-cast' });
    }

    const p2 = /\(req\.query as any\)\.([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = p2.exec(lineText)) !== null) {
      found.push({ file: relPath, line: lineNum, symbol: m[1], kind: 'inline-object-cast' });
    }

    const p3 = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*req\.query\s+as\s+any/;
    const m3 = lineText.match(p3);
    if (m3) {
      const varName = m3[1];
      const range = findEnclosingHandlerRange(lines, idx);
      const propsUsed = new Set();
      const propRegex = new RegExp(`\\b${varName}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g');
      const scanEnd = range ? range.end : Math.min(lines.length - 1, idx + 60);
      for (let j = idx; j <= scanEnd; j++) {
        let mm;
        while ((mm = propRegex.exec(lines[j])) !== null) propsUsed.add(mm[1]);
      }
      if (propsUsed.size === 0) {
        // cast existe mas nenhuma prop identificada como usada — ainda assim é
        // uma fronteira `as any`; registra pela variável em si.
        found.push({ file: relPath, line: lineNum, symbol: varName, kind: 'whole-object-cast' });
      } else {
        for (const prop of propsUsed) {
          found.push({ file: relPath, line: lineNum, symbol: prop, kind: 'whole-object-cast' });
        }
      }
    }
  });

  return found;
}

const routeFiles = getAllRouteFiles();
let allFound = [];
for (const abs of routeFiles) {
  const rel = path.relative(SRC_ROOT, abs).replace(/\\/g, '/');
  allFound = allFound.concat(scanFile(abs, rel));
}

// ordinal por (file, symbol), em ordem de leitura (arquivos processados em
// ordem de diretório; para determinismo, ordena por file, depois por linha).
allFound.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const ordinalCounter = {};
const detected = new Map(); // key -> { file, line, symbol, kind }
for (const f of allFound) {
  const base = `${f.file}::${f.symbol}`;
  ordinalCounter[base] = (ordinalCounter[base] || 0) + 1;
  const key = `${base}::${ordinalCounter[base]}`;
  detected.set(key, f);
}

// ============================================================================
// COMPARAÇÃO — allowlist × código vivo
// ============================================================================
const errors = [];

for (const [key, site] of detected) {
  if (!ALLOWLIST.has(key)) {
    errors.push(`❌ ITEM NOVO (não alistado): ${key} — ${site.file}:${site.line} (${site.kind}). Se é fronteira legítima de query param sem tipo, componha do vocabulário GOVERNADO (Record<Tipo, true> + 400, padrão service-order.routes.ts:25-37) — NÃO adicione à allowlist sem consertar.`);
  }
}

for (const key of ALLOWLIST) {
  if (!detected.has(key)) {
    errors.push(`❌ ALLOWLIST DESATUALIZADA: ${key} está na allowlist mas não foi encontrado no código — se a rota foi corrigida, remova esta linha da allowlist no mesmo commit; se a rota mudou de forma (renomeou variável, moveu handler), confirme que não é o mesmo defeito voltando disfarçado.`);
  }
}

// ============================================================================
// TETO — os dois tamanhos não podem passar de BASELINE_COUNT, mesmo que os
// dois laços acima não tenham achado nada (par novo detectado + par novo
// alistado no mesmo commit bate ponto-a-ponto e escaparia dos dois laços
// sozinho). Travar só um dos dois lados deixa o outro furar: só o detectado
// deixa a allowlist inchar sem código correspondente; só a allowlist deixa
// o código crescer atrás de uma allowlist que não acompanhou.
// ============================================================================
if (detected.size > BASELINE_COUNT) {
  errors.push(`❌ CONTAGEM CRESCEU: ${detected.size} sítios detectados > baseline congelado ${BASELINE_COUNT}. A contagem só pode descer — conserte o(s) item(ns) novo(s) (Record<Tipo,true> + 400, padrão service-order.routes.ts:25-37); NÃO alistar para "resolver" o vermelho.`);
}
if (ALLOWLIST.size > BASELINE_COUNT) {
  errors.push(`❌ ALLOWLIST CRESCEU: ${ALLOWLIST.size} entradas > baseline congelado ${BASELINE_COUNT}. Adicionar linha na allowlist para abafar um item novo é o mesmo defeito de allowlist podre já visto noutros gates deste repositório — não faça isso; conserte a rota.`);
}

// ============================================================================
// RATCHET PARA BAIXO — se ninguém falhou acima e a contagem real caiu abaixo
// do teto congelado, é porque uma rota foi consertada e BASELINE_COUNT (:149)
// não foi atualizado no mesmo commit. FAIL com o número novo já calculado —
// sem isto, a primeira queima trava o runner pra sempre até alguém desligar
// o guard (o oposto do objetivo).
// ============================================================================
if (errors.length === 0 && (detected.size < BASELINE_COUNT || ALLOWLIST.size < BASELINE_COUNT)) {
  const novoTeto = Math.min(detected.size, ALLOWLIST.size);
  errors.push(`❌ BASELINE DESATUALIZADO: a contagem real caiu (detectados=${detected.size}, allowlist=${ALLOWLIST.size}) mas BASELINE_COUNT (declarado no topo do arquivo) ainda diz ${BASELINE_COUNT}. Você consertou algo — ótimo. Atualize \`const BASELINE_COUNT = ${BASELINE_COUNT};\` para \`const BASELINE_COUNT = ${novoTeto};\` no MESMO commit que removeu a(s) linha(s) da allowlist.`);
}

// ============================================================================
// Output
// ============================================================================
if (errors.length > 0) {
  console.error('='.repeat(80));
  console.error('❌ GATE — FRONTEIRA req.query.* as any EM *.routes.ts: FALHOU');
  console.error('='.repeat(80));
  errors.forEach((e) => console.error(e));
  console.error('');
  console.error(`Detectados hoje: ${detected.size} · Allowlist: ${ALLOWLIST.size} · Baseline congelado: ${BASELINE_COUNT}`);
  process.exit(1);
} else {
  console.log('='.repeat(80));
  console.log('✅ GATE — FRONTEIRA req.query.* as any EM *.routes.ts: PASSOU');
  console.log('='.repeat(80));
  console.log(`📋 Sítios detectados: ${detected.size} · Allowlist: ${ALLOWLIST.size} (baseline congelado 2026-07-31: ${BASELINE_COUNT})`);
  console.log('✅ Nenhum item novo · allowlist sem entrada órfã · a contagem só pode descer daqui.');
  console.log('');
  process.exit(0);
}

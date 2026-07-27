#!/usr/bin/env node
// audit-economic-v2-containment.mjs — Guard da F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT (DECISION-0190,
// SELADA · VEREDITO A · SELO COMPLETO DOCS-ONLY em 2026-07-20; material desta fatia é a execução
// autorizada da frente §9, com novo GO material explícito).
//
// DECISION-0190 §4 define a família institucionalmente contida (8 operações, todas POST):
//   custody · split · payment/authorize · payment/execute · payment/revoke · refund · chargeback ·
//   chargeback/resolve
// com código canônico de borda: 501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED, ANTES de
// qualquer novo estado/side-effect (§4, §9 "zero chamada aos services contidos").
//
// FORA da família enumerada em §4 (não contidas por este guard, MAPA explícito e intencional):
//   - POST /:eventId/economic/v2/advance — handoff de fase (event_outbox apenas; ZERO Bank/custódia/
//     split/autorização — verificado em event-economic-phase.service.ts); não citado em §4.
//   - GET  /:eventId/economic/v2/custody — leitura (listCustodiesByEvent); §5 exige que estados
//     existentes permaneçam "disponíveis para auditoria" — leitura precisa continuar viva.
//   - GET  /:eventId/economic/v2/split — leitura (listSplitsByEvent); mesmo racional do GET custody.
//
// MORDE (regressão da contenção) se, para qualquer uma das 8 rotas mandatadas:
//   (a) o código de contenção 501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED sumir da região
//       do handler (ANTES do sink real do service) — writer/service voltaria a ser alcançável;
//   (b) a contenção deixar de ser a PRIMEIRA instrução do handler — qualquer `await` aparecendo ANTES
//       dela na região (ex.: leitura de evento, chamada a serviço) reabriria a janela de side-effect
//       pré-contenção que a DECISION-0190 exige fechada (§4: "ANTES de criar novos estados... ou chamar
//       seus services");
//   (c) a citação de base normativa (DECISION-0190) for removida do comentário do guard de contenção
//       (perda de rastreabilidade da autoridade da contenção);
//   (d) o universo de sub-rotas da família (path literal '/:eventId/economic/v2/') divergir de 11
//       (8 contidas + 3 fora-do-mapa) — sinal de rota nova/removida sem reclassificação neste guard;
//   (e) qualquer uma das 3 rotas FORA do mapa (advance, GET custody, GET split) ganhar a contenção 501
//       antes do próprio sink — sinal de over-broadening não autorizado pela DECISION-0190 §4 (o
//       escopo da contenção é exatamente as 8, não "toda rota que comece com /economic/v2").
//
// Região-ancorado: para cada sink (chamada real ao service, literal única no arquivo), a região do
// handler é [ÚLTIMO 'async (req, reply) => {' ANTES do sink, sink). Comment/literal-aware via strip de
// comentários TS (mesmo helper das outras guards do módulo events). Fail-closed. NÃO altera runtime.
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE_FILE = 'src/core/events/event.routes.ts';

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const fails = [];
const note = (m) => fails.push(m);

const abs = resolve(ROOT, ROUTE_FILE);
if (!existsSync(abs)) {
  note(`arquivo material ausente: ${ROUTE_FILE}`);
  console.error('GATE FAIL [economic-v2-containment]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
const raw = readFileSync(abs, 'utf8');

const CONTAINMENT_CODE = 'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED';
const DECISION_MARKER = 'DECISION-0190';
const HANDLER_MARKER = 'async (req, reply) => {';

// (d) anti-drift do universo: exatamente 11 registros de path sob a família (8 contidas + 3 fora-do-mapa).
// Checado no RAW (o path literal não vive em comentário, então strip não muda a contagem).
const FAMILY_PATH_NEEDLE = "'/:eventId/economic/v2/";
const familyPathCount = raw.split(FAMILY_PATH_NEEDLE).length - 1;
if (familyPathCount !== 11) {
  note(
    `universo de rotas da família economic/v2 mudou: ${familyPathCount} registros de path encontrados (esperado 11 = 8 contidas + 3 fora-do-mapa: advance, GET custody, GET split). ` +
    `Rota nova/removida precisa de reclassificação explícita neste guard (§4 da DECISION-0190 antes de estender a contenção).`
  );
}

// Região = [ÚLTIMO handler-marker ANTES do sink, sink), fatiada do RAW (preserva comentários — a
// citação DECISION-0190 vive em comentário). `regionStripped` é a MESMA região com comentários
// removidos, usada para os checks ESTRUTURAIS (containment/await) — decoy em comentário não conta
// como contenção real nem como await real.
function regionForSink(sinkNeedle, label) {
  const sinkIdx = raw.indexOf(sinkNeedle);
  if (sinkIdx < 0) {
    note(`sink '${sinkNeedle}' (rota ${label}) não encontrado — rota removida/renomeada sem atualizar este guard.`);
    return null;
  }
  const before = raw.slice(0, sinkIdx);
  const hStart = before.lastIndexOf(HANDLER_MARKER);
  if (hStart < 0) {
    note(`handler '${HANDLER_MARKER}' não encontrado antes do sink '${sinkNeedle}' (rota ${label}).`);
    return null;
  }
  const region = raw.slice(hStart, sinkIdx);
  return { region, regionStripped: stripTs(region), sinkIdx, hStart };
}

// As 8 rotas MANDATADAS pela DECISION-0190 §4 (sink real de cada service, literal única no arquivo).
const MANDATED = [
  ['custody (POST)', 'eventCustodyService.createCustody('],
  ['split (POST)', 'eventSplitDeclarativeService.calculateSplit('],
  ['payment/authorize (POST)', 'eventPaymentPreparedService.authorizePayment('],
  ['payment/revoke (POST)', 'eventPaymentPreparedService.revokeAuthorization('],
  ['payment/execute (POST)', 'eventPaymentExecutionService.executePayment('],
  ['refund (POST)', 'eventRefundChargebackService.requestRefund('],
  ['chargeback (POST)', 'eventRefundChargebackService.initiateChargeback('],
  ['chargeback/resolve (POST)', 'eventRefundChargebackService.resolveChargeback('],
];

for (const [label, sinkNeedle] of MANDATED) {
  const found = regionForSink(sinkNeedle, label);
  if (!found) continue;
  const { region, regionStripped } = found;

  // (a) contenção FUNCIONAL presente na região (regionStripped — decoy em comentário não conta).
  const containIdx = regionStripped.indexOf(CONTAINMENT_CODE);
  if (containIdx < 0) {
    note(`rota ${label}: contenção 501 ${CONTAINMENT_CODE} AUSENTE (fora de comentário) antes do sink '${sinkNeedle}' — writer real alcançável (regressão da DECISION-0190 §4).`);
    continue;
  }

  // (b) a contenção é a PRIMEIRA instrução — nenhum `await` na região (código real) antes dela.
  const beforeContain = regionStripped.slice(0, containIdx);
  if (/\bawait\b/.test(beforeContain)) {
    note(`rota ${label}: existe 'await' ANTES da contenção 501 na região do handler — a contenção deixou de ser a PRIMEIRA instrução (janela de side-effect pré-contenção reaberta, viola DECISION-0190 §4).`);
  }

  // (c) citação de base normativa preservada (vive em comentário — checado no RAW da região).
  if (!region.includes(DECISION_MARKER)) {
    note(`rota ${label}: citação de base normativa (${DECISION_MARKER}) ausente do comentário de contenção — perda de rastreabilidade da autoridade da contenção.`);
  }
}

// (e) as 3 rotas FORA do mapa NÃO devem ter ganho a contenção (over-broadening não autorizado).
const OUT_OF_MAP = [
  ['advance (POST, fora do mapa — handoff de fase, event_outbox apenas)', 'eventEconomicPhaseService.advanceToEconomicPhase('],
  ['custody (GET, fora do mapa — leitura, §5 auditoria)', 'eventCustodyService.listCustodiesByEvent('],
  ['split (GET, fora do mapa — leitura, §5 auditoria)', 'eventSplitDeclarativeService.listSplitsByEvent('],
];
for (const [label, sinkNeedle] of OUT_OF_MAP) {
  const found = regionForSink(sinkNeedle, label);
  if (!found) continue;
  if (found.regionStripped.includes(CONTAINMENT_CODE)) {
    note(`rota ${label}: ganhou a contenção 501 ${CONTAINMENT_CODE} — over-broadening não autorizado pela DECISION-0190 §4 (o escopo da contenção é exatamente as 8 rotas mandatadas, não toda rota economic/v2).`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [economic-v2-containment]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  'GATE OK [economic-v2-containment] — DECISION-0190 §4: as 8 rotas mandatadas (custody, split, ' +
  'payment/authorize, payment/execute, payment/revoke, refund, chargeback, chargeback/resolve) 501 ' +
  'EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED como PRIMEIRA instrução do handler, ANTES de ' +
  'qualquer service/side-effect. Citação DECISION-0190 preservada em cada uma. As 3 rotas fora do mapa ' +
  '(advance, GET custody, GET split) permanecem vivas e sem over-broadening. Universo de rotas da ' +
  'família = 11 (sem drift).'
);

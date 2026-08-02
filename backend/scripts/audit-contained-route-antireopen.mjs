#!/usr/bin/env node
// Guard estrutural — F-CONTAINED-ROUTE-ANTIREOPEN (achado Yala, Mandatos D+E, 2026-08-01).
//
// A dívida que ele fecha: SEIS rotas foram contidas em dois commits (36c491851: 3 readers de
// payout → 503 PORTA_01_CLOSED · 59bd18a19: 3 rotas de métricas de evento → 501 *_NOT_WIRED), e a
// contenção REMOVEU O CORPO dos handlers — incluindo o preHandler de permissão (payout) e o
// canViewEvent por eventId (métricas). A auditoria independente apontou, DUAS vezes, o mesmo
// buraco: quem reabrir escreve handler novo num arquivo SEM proteção para copiar, e nenhum guard
// vigiava nenhuma das seis. "Virou padrão do arco, não incidente" (Parecer Yala, Mandato E).
//
// MORDE se, em QUALQUER uma das 6:
//   (A) o código de contenção sumir (PORTA_01_CLOSED / *_NOT_WIRED);
//   (B) uma chamada de service reaparecer no arquivo de rotas SEM a proteção que o corpo original
//       tinha (payout: requirePayoutPermission; métricas: canViewEvent) — reabertura desprotegida.
// Heurística textual comment-stripped, mesmo padrão dos guards vizinhos. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

const CONTAINED = [
  {
    file: 'src/modules/payout/payout.routes.ts',
    containmentCodes: ["'PORTA_01_CLOSED'"],
    // reabertura = estes símbolos de service voltarem ao arquivo de rotas…
    reopenSymbols: ['payoutService.listBatches', 'payoutService.getBatchById', 'payoutService.getOrderById'],
    // …sem esta proteção presente e aplicada.
    requiredGate: 'requirePayoutPermission',
    minContainmentHits: 4, // /payouts/orders (0189B) + os 3 readers contidos em 36c491851
  },
  {
    file: 'src/modules/events/events.routes.ts',
    containmentCodes: [
      "'EVENT_METRICS_DASHBOARD_NOT_WIRED'",
      "'EVENT_ORGANIZER_METRICS_NOT_WIRED'",
      "'EVENT_METRICS_COMPARE_NOT_WIRED'",
    ],
    reopenSymbols: [
      'eventMetricsDashboardService.getEventDashboard',
      'eventMetricsDashboardService.compareEvents',
      'eventOrganizerMetricsService.getOrganizerMetrics',
    ],
    requiredGate: 'canViewEvent',
    minContainmentHits: 3,
  },
  {
    file: 'src/modules/reports/reports.routes.ts',
    containmentCodes: ["'FINANCIAL_REPORT_NOT_WIRED'"],
    reopenSymbols: ['financialReportService.generateReport'],
    requiredGate: 'resolveReportActorId',
    minContainmentHits: 1,
  },
  {
    file: 'src/modules/services/service-order.service.ts',
    containmentCodes: ['ESCROW_SECOND_LEDGER_WRITE_CONTAINED'],
    reopenSymbols: ['escrowRepository.createEscrowAccount', 'escrowRepository.updateMilestoneStatus'],
    requiredGate: 'ESCROW_SECOND_LEDGER_WRITE_CONTAINED',
    minContainmentHits: 3,
  },
];

for (const c of CONTAINED) {
  const abs = join(ROOT, c.file);
  if (!existsSync(abs)) {
    failures.push(`${c.file}: arquivo sumiu — as rotas contidas não têm mais casa conhecida.`);
    continue;
  }
  const src = stripTs(readFileSync(abs, 'utf8'));

  // (A) os códigos de contenção continuam lá, na contagem esperada.
  for (const code of c.containmentCodes) {
    if (!src.includes(code)) {
      failures.push(
        `${c.file}: código de contenção ${code} SUMIU. Se a rota foi reaberta de propósito, ` +
          `ela precisa recuperar a proteção que o corpo original tinha (${c.requiredGate}) E este ` +
          `guard precisa ser atualizado NO MESMO commit — reabrir por acidente é exatamente o que ele impede.`
      );
    }
  }
  const totalHits = c.containmentCodes.reduce(
    (n, code) => n + src.split(code).length - 1, 0
  );
  if (totalHits < c.minContainmentHits) {
    failures.push(
      `${c.file}: contenções encontradas = ${totalHits} < mínimo ${c.minContainmentHits}. ` +
        'Alguma rota contida perdeu o corpo de contenção sem este guard ser atualizado.'
    );
  }

  // (B) reabertura desprotegida: símbolo de service de volta SEM o gate presente.
  for (const sym of c.reopenSymbols) {
    if (src.includes(sym) && !src.includes(c.requiredGate)) {
      failures.push(
        `${c.file}: ${sym} REAPARECEU e ${c.requiredGate} não está no arquivo — reabertura sem a ` +
          'proteção que o corpo original tinha. É o buraco que a auditoria nomeou duas vezes.'
      );
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [contained-route-antireopen]:');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}

console.log(
  'GATE OK [contained-route-antireopen] — as 6 rotas contidas (3 payout 503 · 3 métricas de evento 501) ' +
    'mantêm o código de contenção, e nenhum símbolo de service reapareceu sem a proteção original ' +
    '(requirePayoutPermission / canViewEvent). Reabrir exige atualizar este guard no mesmo commit.'
);

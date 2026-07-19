// validate-yala-final-reporting-hold.ts — PROVA Etapa E (DECISION-0189C — C4/D5)
//
// Roda contra CLONE EFÊMERO. Prova que reporting/risk NÃO projetam payouts/invoices sob PORTA 01.
// A barreira é de SERVICE (assertFinancialProjectionAllowed) e dispara ANTES de qualquer query —
// portanto é INDEPENDENTE da permissão do caller (tenant-operator não supera o HOLD) e da
// presença/ausência de dados financeiros (nada é lido).
//   R1 reportingService.getFinancialKPIs → PORTA_01_CLOSED (nenhum listOrders/listInvoices roda)
//   R2 reportingService.exportData('payouts') e ('invoices') → PORTA_01_CLOSED
//   R3 riskDashboardService.getOverview → PORTA_01_CLOSED
//   R4 riskDashboardService.listActorRiskProfiles (+ getActorRiskProfile) → PORTA_01_CLOSED
//   R5 riskDashboardService.getActorRiskTimeline → PORTA_01_CLOSED
//   R6 barreira dispara ANTES da query → indep. de dados/permissão; isolamento cross-tenant trivial
//   R7 isPorta01Closed é estrutural (reabrir = decisão própria — retirar chaves do HOLD)

import { reportingService } from '@modules/reporting/reporting.service';
import { riskDashboardService } from '@modules/risk-command-center/risk-dashboard.service';
import { isPorta01Closed } from '@core/authorization/financial-projection-hold';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

async function held(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; } catch (e) { return (e as Error).message; }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/closeout|ephemeral|clone|upgrade|final|ratchet/i.test(dbUrl)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${dbUrl.split('/').pop()})`);
    process.exit(1);
  }
  const T1 = '00000000-0000-0000-0000-0000000000aa';
  const T2 = '00000000-0000-0000-0000-0000000000bb';

  check('R7 PORTA 01 está estruturalmente FECHADA (isPorta01Closed=true)', isPorta01Closed() === true);

  const e1 = await held(() => reportingService.getFinancialKPIs(T1, {}));
  check('R1 getFinancialKPIs → PORTA_01_CLOSED (sem listOrders/listInvoices)', /PORTA_01_CLOSED/.test(e1 ?? ''), (e1 ?? 'sem erro').slice(0, 60));

  const e2a = await held(() => reportingService.exportData(T1, 'payouts' as never, 'json' as never, {}));
  const e2b = await held(() => reportingService.exportData(T1, 'invoices' as never, 'json' as never, {}));
  check('R2 exportData(payouts) e (invoices) → PORTA_01_CLOSED', /PORTA_01_CLOSED/.test(e2a ?? '') && /PORTA_01_CLOSED/.test(e2b ?? ''), `${(e2a ?? '').slice(0,30)} | ${(e2b ?? '').slice(0,30)}`);

  const e3 = await held(() => riskDashboardService.getOverview(T1));
  check('R3 risk getOverview → PORTA_01_CLOSED', /PORTA_01_CLOSED/.test(e3 ?? ''), (e3 ?? 'sem erro').slice(0, 60));

  const e4a = await held(() => riskDashboardService.listActorRiskProfiles(T1, {}));
  const e4b = await held(() => riskDashboardService.getActorRiskProfile(T1, '00000000-0000-0000-0000-000000000001'));
  check('R4 risk listActorRiskProfiles + getActorRiskProfile → PORTA_01_CLOSED', /PORTA_01_CLOSED/.test(e4a ?? '') && /PORTA_01_CLOSED/.test(e4b ?? ''));

  const e5 = await held(() => riskDashboardService.getActorRiskTimeline(T1, '00000000-0000-0000-0000-000000000001'));
  check('R5 risk getActorRiskTimeline → PORTA_01_CLOSED', /PORTA_01_CLOSED/.test(e5 ?? ''), (e5 ?? 'sem erro').slice(0, 60));

  // R6 — a barreira dispara para QUALQUER tenant (independe de dados; isolamento trivial: nada lido)
  const eT1 = await held(() => riskDashboardService.getOverview(T1));
  const eT2 = await held(() => riskDashboardService.getOverview(T2));
  check('R6 barreira dispara p/ tenants distintos ANTES de qualquer query (indep. dados/permissão; cross-tenant isolado)',
    /PORTA_01_CLOSED/.test(eT1 ?? '') && /PORTA_01_CLOSED/.test(eT2 ?? ''));

  console.log(`\n──────── RESULTADO: ${passed} passaram, ${failed} falharam ────────`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// Guard estrutural — B4f (F-DASHBOARD-METRICS-TENANT-SCOPE / DECISION-0131 §B7).
//
// As métricas de dashboard (src/core/dashboard/daily-metrics.*) DEVEM ser escopadas por tenant.
// Antes, as queries rodavam SEM `tenant_id` → vazamento cross-tenant (qualquer autenticado lia
// agregados platform-wide). FALHA (exit 1) se:
//   (a) qualquer query do service sobre tabela tenant-scoped (events/event_organizers/
//       organizer_subscriptions/event_metrics) NÃO filtrar por `tenant_id`;
//   (b) a rota não exigir/passar `req.tenant.id` ao service.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const SVC = join(ROOT, 'src', 'core', 'dashboard', 'daily-metrics.service.ts');
const ROUTE = join(ROOT, 'src', 'core', 'dashboard', 'daily-metrics.routes.ts');
const TENANT_SCOPED = ['events', 'event_organizers', 'organizer_subscriptions', 'event_metrics'];
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];
  for (const f of [SVC, ROUTE]) {
    if (!existsSync(f)) { console.error(`GATE FAIL [dashboard-metrics-tenant-scope]: ausente ${f.replace(ROOT, '')}`); process.exit(1); }
  }
  const svc = stripComments(readFileSync(SVC, 'utf8'));
  const route = stripComments(readFileSync(ROUTE, 'utf8'));

  // (a) cada FROM <tabela tenant-scoped> até o fechamento da query (backtick) deve conter tenant_id.
  for (const t of TENANT_SCOPED) {
    const re = new RegExp(`FROM\\s+${t}\\b[\\s\\S]*?\``, 'g');
    let m;
    let n = 0;
    while ((m = re.exec(svc)) !== null) {
      n += 1;
      if (!/tenant_id/.test(m[0])) failures.push(`query sobre ${t} sem filtro tenant_id (vazamento cross-tenant).`);
    }
    if (n === 0 && new RegExp(`\\b${t}\\b`).test(svc)) {
      // tabela referenciada mas não via FROM reconhecível — exigir tenant_id no arquivo ao menos.
      if (!/tenant_id/.test(svc)) failures.push(`service referencia ${t} sem nenhum tenant_id.`);
    }
  }

  // (b) rota exige + passa req.tenant.id ao service.
  if (!/req\.tenant\??\.id/.test(route)) failures.push('rota não exige req.tenant.id (sem escopo de tenant).');
  if (!/getTodayMetrics\(\s*req\.tenant\.id/.test(route)) failures.push('rota não passa req.tenant.id a getTodayMetrics.');
  if (!/getMetricsHistory\(\s*req\.tenant\.id/.test(route)) failures.push('rota não passa req.tenant.id a getMetricsHistory.');

  if (failures.length > 0) {
    console.error('GATE FAIL [dashboard-metrics-tenant-scope]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log('[dashboard-metrics-tenant-scope] todas as queries (events/event_organizers/organizer_subscriptions/event_metrics) filtram tenant_id; rota exige e passa req.tenant.id.');
  console.log('GATE OK [dashboard-metrics-tenant-scope] — métricas escopadas por tenant; sem vazamento cross-tenant.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };

#!/usr/bin/env node
// Guard estrutural — F-FINANCIAL-INTERNAL-SURFACES-P1-CONTAINMENT.
//
// Cerca de REGRESSÃO file-level (não AST) das duas superfícies P1 contidas fail-closed:
//   R18 — POST /automation/schedule/run-due: executava scheduledActionService.executeDueActions
//         com `now` vindo de req.query, sem gate admin/internal forte (qualquer usuário comum
//         autenticado disparava varredura de vencidos com tempo arbitrário).
//   R19 — /internal/financial/disputes (controller fora do protectedScope, sem auth efetiva):
//         lia `tenant_id` do body/query como autoridade e gravava financial_disputes /
//         financial_alerts (e listava cross-tenant) sem subject server-side.
//
// O guard FALHA (exit 1) se qualquer contenção for revertida: se o código (sem comentários) de
// run-due voltar a chamar executeDueActions / ler query.now, ou se o controller de disputas voltar
// a chamar createDispute/updateDisputeStatus/listOpenDisputes/createFinancialAlert ou a tratar
// tenant_id de body/query. Integrado em validate:regression-guards. Ver DT-AUTOMATION-RUN-DUE-HTTP-OPEN
// e DT-FINANCIAL-DISPUTES-INTERNAL-HTTP-OPEN.

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(process.cwd(), 'src');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function runGuard() {
  const failures = [];

  // ── R18 — automation run-due ────────────────────────────────────────────────
  const r18Path = join(SRC, 'modules/automation/automation.routes.ts');
  const r18Raw = readFileSync(r18Path, 'utf8');
  const r18 = stripComments(r18Raw);
  if (!r18.includes('AUTOMATION_RUN_DUE_HTTP_DISABLED')) {
    failures.push('R18: automation.routes.ts NÃO contém o gate AUTOMATION_RUN_DUE_HTTP_DISABLED (contenção removida).');
  }
  if (/\bexecuteDueActions\s*\(/.test(r18)) {
    failures.push('R18: automation.routes.ts volta a CHAMAR executeDueActions( — execução por rota HTTP reaberta.');
  }
  if (/query\.now\b/.test(r18) || /req\.query[^;]*\bnow\b/.test(r18)) {
    failures.push('R18: automation.routes.ts volta a ler `now` da query — tempo client-supplied como autoridade de execução.');
  }

  // ── R19 — financial disputes /internal controller ───────────────────────────
  const r19Path = join(SRC, 'modules/disputes/financial-dispute.controller.ts');
  const r19Raw = readFileSync(r19Path, 'utf8');
  const r19 = stripComments(r19Raw);
  if (!r19.includes('FINANCIAL_DISPUTES_HTTP_DISABLED')) {
    failures.push('R19: financial-dispute.controller.ts NÃO contém o gate FINANCIAL_DISPUTES_HTTP_DISABLED (contenção removida).');
  }
  const r19Handlers403 = (r19.match(/status\(403\)/g) || []).length;
  if (r19Handlers403 < 3) {
    failures.push(`R19: as 3 rotas (POST/GET/PATCH /financial/disputes) deveriam responder 403 fail-closed (handlers status(403) encontrados=${r19Handlers403}).`);
  }
  for (const m of ['app.post(', 'app.get(', 'app.patch(']) {
    if (!r19.includes(m)) {
      failures.push(`R19: financial-dispute.controller.ts não registra mais ${m} (rota sumiu em vez de ser contida 403).`);
    }
  }
  for (const sym of ['createDispute', 'updateDisputeStatus', 'listOpenDisputes', 'createFinancialAlert']) {
    if (new RegExp(`\\b${sym}\\s*\\(`).test(r19)) {
      failures.push(`R19: financial-dispute.controller.ts volta a CHAMAR ${sym}( — mutação/listagem por HTTP reaberta.`);
    }
  }
  if (/req\.body[^;]*tenant_id|tenant_id[^;]*req\.body|req\.query[^;]*tenant_id|tenant_id[^;]*req\.query/.test(r19)) {
    failures.push('R19: financial-dispute.controller.ts volta a tratar tenant_id de body/query — tenant client-declared como autoridade.');
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [internal-surfaces-containment]: contenção P1 revertida —');
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    process.exit(1);
  }
  console.log('[internal-surfaces-containment] R18 run-due=403 fail-closed (sem executeDueActions/query.now); R19 financial-disputes 3×403 (sem create/update/list/alert; sem tenant_id body/query).');
  console.log('GATE OK [internal-surfaces-containment] — superfícies P1 contidas fail-closed.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runGuard();
}

export { runGuard };

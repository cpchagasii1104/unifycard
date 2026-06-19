#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z3-SAFE-SUBJECT-FORM-C-DEDICATED-GUARDS (higiene W3 do sweep 0113; DECISION-0125/0126).
//
// business-audit, policy-engine e risk-command-center são reconhecidos pelo detector central
// (audit-actor-authority-boundary.mjs) via safeSubjectProof Forma C/D (canUserPerformCompanyCapability /
// canUserPerformTenantCapability + subject server-side req.user). Eram materialmente seguros e re-flagáveis, mas
// sem guard DEDICADO. Este guard torna a prova explícita por superfície. NÃO altera runtime; é higiene.
// MORDE, por superfície, se: sumir o primitivo de capability (Forma C/D); o subject deixar de vir de req.user;
// sumir o fail-closed (401 sem user / 403 sem permissão); o actor client-declared (actionContext.actorId/
// params.actorId) for passado como ARGUMENTO ao service de dados (autoridade, não alvo); ou aparecer bank_*.
// Comment-stripped. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Por superfície: arquivo, nome do service de dados (cujas chamadas NÃO podem receber ator client-declared como arg).
const SURFACES = [
  { rel: 'src/modules/business-audit/business-audit.routes.ts', svc: 'businessAuditLogService' },
  { rel: 'src/modules/policy-engine/policy.routes.ts', svc: 'policyEngineService' },
  { rel: 'src/modules/risk-command-center/risk-dashboard.routes.ts', svc: 'riskDashboardService' },
];

const failures = [];

for (const { rel, svc } of SURFACES) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${rel}`); continue; }
  const code = stripTs(readFileSync(p, 'utf-8'));

  // 1) primitivo de capability Forma C e/ou D presente.
  const hasFormC = /canUserPerformCompanyCapability\s*\(/.test(code);
  const hasFormD = /canUserPerformTenantCapability\s*\(/.test(code);
  if (!hasFormC && !hasFormD) {
    failures.push(`${rel}: perdeu o primitivo de capability (canUserPerformCompanyCapability/canUserPerformTenantCapability) — Forma C/D.`);
  }
  // 2) subject server-side de req.user (id ou userId).
  if (!/req\.user\?\.\s*(id|userId)|req\.user\.\s*(id|userId)/.test(code)) {
    failures.push(`${rel}: subject deve vir de req.user (id/userId) server-side.`);
  }
  // 3) fail-closed: 401 sem user + 403 sem permissão.
  if (!/status\(\s*401\s*\)/.test(code)) failures.push(`${rel}: perdeu o 401 fail-closed (sem subject autenticado).`);
  if (!/status\(\s*403\s*\)/.test(code)) failures.push(`${rel}: perdeu o 403 fail-closed (sem permissão/capability).`);
  // 4) actor client-declared NÃO pode ser passado como ARGUMENTO ao service de dados (autoridade), só alvo via params/filtros.
  const svcCallWithClientActor = new RegExp(svc + '\\s*\\.\\s*\\w+\\([^)]*(actionContext\\s*\\.\\s*actorId|req\\.actionContext)');
  if (svcCallWithClientActor.test(code)) {
    failures.push(`${rel}: ${svc} recebe actionContext.actorId como argumento — ator client-declared não pode governar a leitura (é audit/alvo, não autoridade).`);
  }
  // 5) zero bank_*.
  if (/bank_ledger|bank_transactions|bank_splits/.test(code)) {
    failures.push(`${rel}: referencia bank_ledger/transactions/splits — superfície read-only de risco/auditoria/política, sem money.`);
  }
  // 6) requireRole não pode ser o ÚNICO gate (broad substitute sem resource binding): exige o primitivo Forma C/D acima.
  //    (coberto por (1): se trocarem capability por requireRole amplo, o primitivo some e (1) falha.)
}

if (failures.length > 0) {
  console.error('GATE FAIL [safe-subject-form-c-dedicated-guards]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [safe-subject-form-c-dedicated-guards] — business-audit/policy-engine/risk-command-center: subject=req.user server-side + canUserPerformCompanyCapability/canUserPerformTenantCapability (Forma C/D) + fail-closed 401/403; ator client-declared não governa o service de dados; zero bank_*. Higiene W3 guard-backed.');

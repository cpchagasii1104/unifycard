#!/usr/bin/env node
// Guard estrutural — F-COMPANY-GETCOMPANY-RESPONSE-UNWRAP-FIX. `getCompany(companyId)` (frontend
// api/companies.ts) devolvia o WRAPPER inteiro do backend (`{ ok: true, data: Company }`) em vez de
// `.data`, tipado incorretamente como `Company` — `company.companyId` era SEMPRE undefined para
// QUALQUER caller (CompanyOnboardingPage.tsx, CompanyDashboard.tsx). Efeito em cascata real
// confirmado: wizard de onboarding recebia companyId=undefined como prop, quebrando KYB upload
// ("companyId inválido") e a resolução do page-actor da agenda (F-COMPANY-AGENDA-REAL-WIRING).
// Reproduzido empiricamente via curl contra o dev server real antes do fix.
//
// MORDE: getCompany voltar a fazer `return response.json();` sem desembrulhar `.data`.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FILE = join(ROOT, '..', 'frontend', 'src', 'api', 'companies.ts');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf-8'));
  const fnIdx = src.indexOf('async function getCompany(');
  if (fnIdx < 0) {
    failures.push(`getCompany não encontrado (renomeado/removido?).`);
  } else {
    const body = src.slice(fnIdx, fnIdx + 400);
    if (!/result\?\.\s*data\s*\?\?\s*result/.test(body)) {
      failures.push(`getCompany não desembrulha mais .data — companyId (e demais campos) voltaria a ser undefined para todo caller.`);
    }
    if (/return\s+response\.json\(\);/.test(body)) {
      failures.push(`getCompany voltou a fazer "return response.json();" cru (regressão exata do bug original).`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [getcompany-response-unwrap-fix]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [getcompany-response-unwrap-fix] — getCompany desembrulha .data corretamente; companyId (e demais campos) chega definido a todo caller. F-COMPANY-GETCOMPANY-RESPONSE-UNWRAP-FIX blindada.');

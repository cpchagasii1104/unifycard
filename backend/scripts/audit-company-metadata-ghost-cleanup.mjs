#!/usr/bin/env node
// Guard estrutural — F-COMPANY-METADATA-GHOST-CLEANUP. `updateCompany` (companies.service.ts)
// montava `UPDATE companies SET metadata = ...` numa coluna que NUNCA existiu em `companies`
// (confirmado via information_schema.columns) — 42703 real, reproduzido: o wizard de onboarding de
// empresa NUNCA conseguia concluir "Finalizar Configuração" (updateCompany(companyId, {metadata:...})
// sempre quebrava). Mesma classe de ghost já tratada para `activity` (DECISION-0103 D12).
//
// MORDE: o bloco `input.metadata` voltar a montar um UPDATE físico em `companies.metadata`
// (regressão exata do bug reproduzido — 42703 latente reintroduzido).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'companies', 'companies.service.ts');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf-8'));
  const fnIdx = src.indexOf('async updateCompany(');
  if (fnIdx < 0) {
    failures.push(`updateCompany não encontrado (renomeado/removido?).`);
  } else {
    const returnIdx = src.indexOf('return updated;', fnIdx);
    const body = returnIdx > fnIdx ? src.slice(fnIdx, returnIdx) : src.slice(fnIdx, fnIdx + 4000);
    // Proíbe qualquer push físico de "metadata = $" no builder de UPDATE.
    if (/updates\.push\(`metadata = \$/.test(body)) {
      failures.push(`updateCompany: bloco input.metadata voltou a montar UPDATE companies SET metadata = ... — coluna inexistente, 42703 latente reintroduzido.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [company-metadata-ghost-cleanup]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [company-metadata-ghost-cleanup] — updateCompany não tenta mais escrever companies.metadata (coluna inexistente); wizard de onboarding consegue concluir "Finalizar Configuração". F-COMPANY-METADATA-GHOST-CLEANUP blindada.');

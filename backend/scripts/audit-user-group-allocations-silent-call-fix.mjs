#!/usr/bin/env node
// Guard estrutural — F-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP (Onda 1 de zeragem de DT,
// 2026-07-05). `findByUserId` engolia QUALQUER erro (tabela ausente, DB caído, permissão negada
// — indistinguíveis) num catch mudo que retornava `[]` sempre, mascarando falhas reais em
// substrato financeiro (bank-split-engine.service.ts). MORDE se:
//   (a) o probe explícito to_regclass('public.user_group_allocations') sumir;
//   (b) o catch-all silencioso reaparecer ao redor da query real (erro real deve propagar, não
//       ser engolido — só a AUSÊNCIA DE TABELA, já checada pelo probe, retorna [] deliberadamente).
// Em validate:regression-guards. Heurística textual comment-stripped. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'src', 'core', 'user-group-allocation', 'user-group-allocation.repository.ts');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
if (!existsSync(FILE)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(FILE, 'utf8'));

  if (!/to_regclass\('public\.user_group_allocations'\)/.test(src)) {
    failures.push(`${FILE}: probe to_regclass('public.user_group_allocations') ausente — findByUserId não distingue mais tabela-ausente de erro real.`);
  }

  const idx = src.indexOf('async findByUserId(');
  if (idx < 0) {
    failures.push(`${FILE}: findByUserId não encontrado.`);
  } else {
    // Corpo completo do método (até o próximo método público no mesmo nível de indentação).
    const body = src.slice(idx, idx + 2200);
    if (!/isUserGroupAllocationsTableAvailable\(\)/.test(body)) {
      failures.push(`${FILE}: findByUserId não chama o probe de disponibilidade da tabela — voltou a depender só do catch.`);
    }
    if (/catch\s*\(\s*\w*\s*\)\s*\{[^}]*return\s*\[\s*\]/s.test(body)) {
      failures.push(`${FILE}: findByUserId voltou a ter um catch silencioso que retorna [] — reabre DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP (erro real deve propagar).`);
    }
  }
}

if (failures.length) {
  console.error('GATE FAIL [user-group-allocations-silent-call-fix]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('GATE OK [user-group-allocations-silent-call-fix] — findByUserId distingue tabela-ausente (probe explícito, log uma vez) de erro real (propaga); catch-all silencioso não reapareceu.');

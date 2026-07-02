#!/usr/bin/env node
// Guard estrutural — F-ACTOR-AVAILABLE-GROUP-COVERAGE. `findAvailableActors` (modules/social/
// actor.repository.ts) só listava actor pessoal + empresas OPERACIONAIS — grupos NUNCA foram
// incluídos (lacuna, não decisão: diferente de empresa, grupo não tem gate de "momento" análogo).
// Corrigido: 3ª seção espelhando o padrão de empresa (tenant-scoped, membership real via
// group_members, status='active').
//
// MORDE:
//   (A) a seção de grupos sumir (query ausente);
//   (B) faltar o filtro `a.actor_type = 'group'` (listaria tipos errados);
//   (C) faltar tenant-scoping em QUALQUER join (g.tenant_id/gm.tenant_id ausentes — vazamento
//       cross-tenant, mesma classe de risco do B3 desta sessão);
//   (D) faltar o filtro `g.status = 'active'` (grupo arquivado/suspenso voltaria a aparecer);
//   (E) faltar o filtro de membership real (`gm.user_id = $2` — sem isso, qualquer usuário veria
//       qualquer grupo do tenant, quebrando a mesma doutrina do B3: subject sempre o próprio).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = 'src/modules/social/actor.repository.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, FILE);
if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const raw = readFileSync(p, 'utf-8');
  const src = stripTs(raw);

  const fnIdx = src.indexOf('async findAvailableActors');
  if (fnIdx < 0) {
    failures.push(`${FILE}: findAvailableActors não encontrado (renomeado/removido?).`);
  } else {
    // Escopo: do início do método até o próximo método público (heurística: próxima linha
    // "  async " no mesmo nível de indentação, ou "return actors;" seguido de "}").
    const returnIdx = src.indexOf('return actors;', fnIdx);
    const body = returnIdx > fnIdx ? src.slice(fnIdx, returnIdx) : src.slice(fnIdx, fnIdx + 6000);

    // (A) seção de grupos presente.
    const groupQueryIdx = body.indexOf("actor_type = 'group'");
    if (groupQueryIdx < 0) {
      failures.push(`${FILE}: seção de grupos ausente (actor_type = 'group' não encontrado dentro de findAvailableActors) — grupos voltariam a não aparecer no seletor.`);
    } else {
      const groupBlock = body.slice(Math.max(0, groupQueryIdx - 400), groupQueryIdx + 400);
      // (C) tenant-scoping em groups E group_members.
      if (!/groups g ON a\.group_id = g\.id AND g\.tenant_id/.test(groupBlock)) {
        failures.push(`${FILE}: JOIN groups sem tenant_id explícito — risco de vazamento cross-tenant.`);
      }
      if (!/group_members gm ON gm\.group_id = g\.id AND gm\.tenant_id/.test(groupBlock)) {
        failures.push(`${FILE}: JOIN group_members sem tenant_id explícito — risco de vazamento cross-tenant.`);
      }
      // (D) status active.
      if (!/g\.status\s*=\s*'active'/.test(groupBlock)) {
        failures.push(`${FILE}: filtro g.status = 'active' ausente — grupo arquivado/suspenso voltaria a aparecer.`);
      }
      // (E) membership real do subject.
      if (!/gm\.user_id\s*=\s*\$2/.test(groupBlock)) {
        failures.push(`${FILE}: filtro gm.user_id = $2 (membership do subject autenticado) ausente — qualquer usuário veria qualquer grupo do tenant.`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [actor-available-group-coverage]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [actor-available-group-coverage] — findAvailableActors lista grupos com membership real, tenant-scoped, status=active. F-ACTOR-AVAILABLE-GROUP-COVERAGE blindada.');

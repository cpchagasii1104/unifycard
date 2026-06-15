#!/usr/bin/env node
// Guard estrutural — F3 / BATCH 3 (F-RBAC-ROLE-AS-AUTHORITY-CONTAINMENT / DECISION-0131 §B7 · AUTHORITY_LAW Art.17).
//
// `rbacService.userHasAnyRole` lê `user_roles` (RBAC legado) como autoridade; `actorHasAnyRole` é o
// primitivo V2 do rbac.plugin. Esta cerca CONTÉM o uso vivo de role-como-autoridade: toda chamada de
// `userHasAnyRole`/`actorHasAnyRole` FORA do Core RBAC (rbac.service/rbac.plugin) deve estar no REGISTRO
// de classificação abaixo (READ-FIRST 2026-06-15). FALHA (exit 1) se:
//   (a) surgir um NOVO arquivo caller não classificado (role-como-autoridade sem classificação explícita);
//   (b) o duplicata morto services/events/event-lifecycle.routes.ts reaparecer.
// NÃO ativa/troca RBAC, NÃO corrige callers (correção = sub-frentes por DT). É bloqueio de regressão +
// trilha de classificação. (O lock do stub actor_has_permission=RETURN FALSE vive em audit-rbac-stub-and-tombstones.)
// Integrado em validate:regression-guards.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(process.cwd(), 'src');
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Definições do primitivo (não são callers) — fora do escopo.
const PRIMITIVE_FILES = new Set(['core/rbac/rbac.service.ts', 'plugins/rbac.plugin.ts']);

// REGISTRO DE CLASSIFICAÇÃO (READ-FIRST 1ª mão). rel(src/) → { class, nota }.
// CANONICAL = role é fallback APÓS primitivo canônico (owner/self/company). DIVERGENT = role decide sozinha
// superfície sensível → DT de correção (sub-frente). Não há correção neste guard (frente grande, Art.17).
const CLASSIFIED = {
  'modules/social/social-work.routes.ts':            'CANONICAL (post owner OR admin) — validatePostAccess',
  'modules/events/event-lifecycle.routes.ts':        'CANONICAL (event owner / company-admin OR admin)',
  'modules/work/work-insights.routes.ts':            'CANONICAL (self OR admin)',
  'modules/work-instant/worker-status.routes.ts':    'CANONICAL (self OR admin)',
  'modules/social/social-work-payment.routes.ts':    'DIVERGENT-MONEY → DT-ROLE-AS-AUTHORITY-DIVERGENT (GET payments role-sole; entangled com requirePermission RBAC-V2)',
  'modules/social/social-work-apply.routes.ts':      'DIVERGENT → DT-ROLE-AS-AUTHORITY-DIVERGENT (GET applicants role-sole)',
  'modules/social/social-work-schedule.routes.ts':   'DIVERGENT → DT-ROLE-AS-AUTHORITY-DIVERGENT (GET schedules role-sole)',
  'core/categories/categories.service.ts':           'DIVERGENT-CONFIG → DT-ROLE-AS-AUTHORITY-DIVERGENT (createCategory active role-sole)',
};
const DEAD_DUP = 'services/events/event-lifecycle.routes.ts';

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) { if (e !== 'node_modules') walk(full, files); }
    else if (extname(full) === '.ts') files.push(full);
  }
  return files;
}

function runGuard() {
  const failures = [];
  const callers = [];
  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    if (PRIMITIVE_FILES.has(rel) || rel.startsWith('scripts/')) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    if (/\b(userHasAnyRole|actorHasAnyRole)\s*\(/.test(code)) {
      callers.push(rel);
      if (rel === DEAD_DUP) {
        failures.push(`duplicata morta ${DEAD_DUP} reapareceu — deve permanecer removida.`);
      } else if (!(rel in CLASSIFIED)) {
        failures.push(`NOVO caller não classificado de role-como-autoridade: ${rel} — classifique (READ-FIRST) antes de usar userHasAnyRole/actorHasAnyRole.`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('GATE FAIL [role-as-authority-containment]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  const divergent = Object.entries(CLASSIFIED).filter(([, v]) => v.startsWith('DIVERGENT')).length;
  console.log(`[role-as-authority-containment] ${callers.length} caller(s) de role classificados; ${divergent} DIVERGENT em DT (correção = sub-frente); duplicata morta removida; nenhum caller novo não-classificado.`);
  console.log('GATE OK [role-as-authority-containment] — uso vivo de role-como-autoridade contido e classificado (Art.17); novos usos sem classificação são bloqueados.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };

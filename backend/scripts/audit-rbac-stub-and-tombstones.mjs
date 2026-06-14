#!/usr/bin/env node
// Guard estrutural — F1+F2 (tombstone/stub locks; DECISION-0131 §B7).
//
// F1 — `actor_has_permission` é o STUB FAIL-CLOSED (`RETURN FALSE`, FASE 6 dormente). O risco NÃO é a
//      tabela existir — é LIGAR a FASE 6 (trocar o stub por implementação que lê 8 roles/76 perms legados
//      como autoridade viva). Este guard TRAVA O SWAP: toda definição de `actor_has_permission` nas
//      migrations DEVE conter `RETURN FALSE`.
// F2 — `organization_members` e `user_identity_links` são TOMBSTONES (tabelas AUSENTES no schema vivo;
//      to_regclass NULL). O risco é RESSUSCITAR a tabela. Este guard FALHA se qualquer migration CRIAR
//      essas tabelas (CREATE TABLE [IF NOT EXISTS]).
// Heurística estática sobre migrations/*.sql. Integrado em validate:regression-guards.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const MIG = join(ROOT, 'migrations');
const TOMBSTONE_TABLES = ['organization_members', 'user_identity_links'];

function runGuard() {
  const failures = [];
  if (!existsSync(MIG)) { console.error('GATE FAIL [rbac-stub-and-tombstones]: migrations/ ausente.'); process.exit(1); }
  const files = readdirSync(MIG).filter((f) => f.endsWith('.sql'));

  // F1 — a definição EFETIVA (migration de maior timestamp que define actor_has_permission) deve ser
  // fail-closed: contém RETURN FALSE e NÃO contém RETURN TRUE. Defs históricas (superadas) são ignoradas —
  // só a última aplicada vale. Um swap = nova migration redefinindo p/ conceder → vira a efetiva → morde.
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?actor_has_permission\b[\s\S]*?\$\$\s*;/gi;
  let effectiveFile = null;
  let effectiveBody = null;
  for (const f of files.slice().sort()) {
    const sql = readFileSync(join(MIG, f), 'utf8');
    let m;
    let last = null;
    while ((m = re.exec(sql)) !== null) last = m[0];
    re.lastIndex = 0;
    if (last) { effectiveFile = f; effectiveBody = last; } // files iterados em ordem → último vence

    // F2 — nenhuma migration pode (re)criar as tabelas tombstone.
    for (const t of TOMBSTONE_TABLES) {
      const reT = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${t}\\b`, 'i');
      if (reT.test(sql)) {
        failures.push(`F2: ${f} CRIA a tabela tombstone '${t}' — ressurreição proibida (tabela AUSENTE no schema vivo; 08 §10.2 / 0130 D1/D11).`);
      }
    }
  }

  if (!effectiveBody) {
    failures.push('F1: nenhuma definição de actor_has_permission nas migrations — stub fail-closed sumiu.');
  } else if (!/RETURN\s+FALSE/i.test(effectiveBody) || /RETURN\s+TRUE/i.test(effectiveBody)) {
    failures.push(`F1: definição efetiva (${effectiveFile}) de actor_has_permission NÃO é fail-closed (esperado RETURN FALSE, sem RETURN TRUE) — swap do stub FASE 6 proibido sem DECISION própria (PORTA-2).`);
  }
  const stubDefs = effectiveBody ? 1 : 0;

  if (failures.length > 0) {
    console.error('GATE FAIL [rbac-stub-and-tombstones]:');
    failures.forEach((x) => console.error(`  ❌ ${x}`));
    process.exit(1);
  }
  console.log(`[rbac-stub-and-tombstones] actor_has_permission = RETURN FALSE em ${stubDefs} definição(ões) (swap travado); organization_members/user_identity_links não recriados.`);
  console.log('GATE OK [rbac-stub-and-tombstones] — stub RBAC fail-closed travado; tombstones não ressuscitam.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };

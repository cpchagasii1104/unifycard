// audit-delegation-scope-containment.mjs
// Guard do SCOPE-CONTAINMENT FIX (DT-AUTHORITY-LATENTS-PASSO-3 ①; ratifica DECISION-0125 §escopo).
// canRepresentActor (vestir o actor) só é concedido por delegação FULL (scopes inclui '*'); uma
// delegação ESCOPADA NÃO concede representação em branco. Congela:
//   1 · a rule 5 (delegação) de canRepresentActor exige scopes.includes('*') antes de return true;
//   2 · NÃO existe mais `if (await this.findActiveDelegation(...)) return true` incondicional.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };

const svc = read('src/core/authorization/authorization.service.ts');
// isola o corpo de canRepresentActor. Janela ampla (o fix tem comentário longo) + strip de comentários
// ANTES de fatiar, para o comentário não consumir o orçamento antes de alcançar o código da delegação.
const svcCode = svc.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const i = svcCode.indexOf('async canRepresentActor');
const bodyCode = i >= 0 ? svcCode.slice(i, i + 2500) : '';

check('canRepresentActor existe', i >= 0);
check("delegação só concede representação se scopes inclui '*' (FULL)",
  /findActiveDelegation\([\s\S]{0,200}scopes\.includes\('\*'\)/.test(bodyCode) ||
  /delegation\s*&&[\s\S]{0,80}scopes\.includes\('\*'\)/.test(bodyCode));
check('NÃO existe mais grant incondicional de delegação (if (await ...findActiveDelegation...)) return true)',
  !/if\s*\(\s*await\s+this\.findActiveDelegation\([^)]*\)\s*\)\s*\{?\s*return true/.test(bodyCode));

if (fails.length) {
  console.error(`\nDELEGATION-SCOPE-CONTAINMENT: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nDELEGATION-SCOPE-CONTAINMENT: OK — representação por delegação exige escopo FULL (*).');

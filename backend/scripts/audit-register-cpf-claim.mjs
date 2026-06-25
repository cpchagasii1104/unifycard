#!/usr/bin/env node
// Gate estrutural — F-REGISTER-CPF-CLAIM-DEDUP (DECISION-0062: 1 CPF = 1 identidade global).
// Trava o claim-check de CPF no register: cadastro NOVO com CPF já reclamado deve FALHAR FECHADO ANTES de
// criar users/profile/actor — sem depender de `profiles.cpf` (não tem unique) nem do handler 23505 (morto).
//   - register checa `SELECT … FROM users WHERE global_user_id …` ANTES de `INSERT INTO users`;
//   - lança CPF_ALREADY_REGISTERED (409) sem PII (full_name/birthdate/global_user_id) no erro;
//   - o claim-check vem ANTES do ensureUserActorTx (não nasce 2º actor no mesmo global_user_id);
//   - não confia só em profiles.cpf 23505 como defesa.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/core/auth/auth.service.ts');
const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const raw = read(SVC);
if (!raw) {
  failures.push('REGISTER_CPF_REGRESSION: auth.service.ts ausente.');
} else {
  const code = stripTs(raw);
  const m = code.match(/async register\([\s\S]*?(?=\n {2}(async|private) )/);
  const body = m ? m[0] : '';
  if (!body) {
    failures.push('REGISTER_CPF_REGRESSION: método register não localizado.');
  } else {
    checked++;
    const iClaim = body.search(/SELECT\s+1\s+FROM\s+users\s+WHERE\s+global_user_id/i);
    const iInsertUser = body.search(/INSERT\s+INTO\s+users\b/i);
    const iActor = body.search(/ensureUserActorTx\s*\(/);
    const iError = body.search(/CPF_ALREADY_REGISTERED/);

    if (iClaim < 0) {
      failures.push('REGISTER_CPF_REGRESSION: register NÃO faz claim-check (SELECT 1 FROM users WHERE global_user_id) — dedup de CPF ausente/regrediu.');
    }
    if (iError < 0) {
      failures.push('REGISTER_CPF_REGRESSION: code CPF_ALREADY_REGISTERED ausente — bloqueio de CPF reclamado não é honesto/estável.');
    }
    if (iClaim >= 0 && iInsertUser >= 0 && iClaim > iInsertUser) {
      failures.push('REGISTER_CPF_REGRESSION: claim-check de CPF vem DEPOIS de INSERT INTO users — deve vir ANTES (senão o user já nasceu).');
    }
    if (iClaim >= 0 && iActor >= 0 && iClaim > iActor) {
      failures.push('REGISTER_CPF_REGRESSION: claim-check de CPF vem DEPOIS de ensureUserActorTx — 2º actor nasceria no mesmo global_user_id.');
    }
    // o erro de CPF reclamado NÃO pode vazar PII da identidade existente — checa a CONSTRUÇÃO do erro
    // (janela ANTES do code), não o código que vem depois do throw.
    if (iError >= 0) {
      const errCtx = body.slice(Math.max(0, iError - 200), iError + 30);
      if (/\$\{[^}]*(full_name|fullName|birthdate|globalUserId|global_user_id|user_id|cpf)/i.test(errCtx) ||
          /new Error\([^)]*(full_name|fullName|birthdate|globalUserId|user_id)/i.test(errCtx)) {
        failures.push('REGISTER_CPF_REGRESSION: erro de CPF reclamado interpola PII (full_name/birthdate/global_user_id/user_id) na mensagem.');
      }
    }
    // não confiar APENAS no 23505 de profiles.cpf (claim-check explícito deve existir — já coberto por iClaim).
    if (iClaim < 0 && /profiles[\s\S]{0,120}?23505/.test(body)) {
      failures.push('REGISTER_CPF_REGRESSION: dedup de CPF depende SÓ do 23505 de profiles.cpf (constraint inexistente → código morto).');
    }
  }
}

console.log(`[register-cpf-claim] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [register-cpf-claim]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [register-cpf-claim] — register recusa CPF já reclamado ANTES de users/profile/actor; 409 CPF_ALREADY_REGISTERED sem PII; não depende de profiles.cpf/23505.');

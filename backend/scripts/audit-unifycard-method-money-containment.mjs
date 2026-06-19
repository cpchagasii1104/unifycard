#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8Q-UNIFYCARD-METHOD-M5-MONEY-AWARE-CONTAINMENT (DECISION-0113 / Z2; §4.8).
//
// O trilho unifycard-method é MONEY-DEFERRED + SCHEMA-GHOST (unifycard_payment_methods/unifycard_method_type só
// em migrations_archive; NULL no schema vivo) + defeito de unidade de fee não decidido. As 3 rotas foram contidas:
// 501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED antes de qualquer service/sink. MORDE se: alguma rota voltar a
// chamar o service (unifyCardMethodService.); ler actionContext.actorId; perder o code de contenção; tocar bank_*;
// OU se a contenção tentar corrigir fee / mexer em payment-execution / settlement / unifycard.service / regional-fee
// (essas alterações são DECISION financeira própria, fora desta frente). Comment-stripped. Em regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };

const failures = [];

// ── rotas contidas ──
const REL = 'src/modules/marketplace/unifycard-method.routes.ts';
const rawRoutes = read(REL);
if (rawRoutes === null) { failures.push(`arquivo ausente: ${REL}`); }
else {
  const code = stripTs(rawRoutes);
  if (!/UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED/.test(code)) {
    failures.push(`${REL}: perdeu o code de contenção UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED.`);
  }
  const contained = (code.match(/reply\.status\(\s*501\s*\)\.send\(\s*UNIFYCARD_METHOD_GHOST_BODY\s*\)/g) || []).length;
  if (contained < 3) failures.push(`${REL}: esperado >= 3 rotas contidas (501 UNIFYCARD_METHOD_GHOST_BODY), achadas ${contained}.`);
  const routeRegs = (code.match(/fastify\.(get|post|put|patch|delete)\b/g) || []).length;
  if (routeRegs < 3) failures.push(`${REL}: esperado >= 3 rotas registradas, achadas ${routeRegs} — não remover rotas.`);
  if (/unifyCardMethodService\s*\./.test(code)) failures.push(`${REL}: voltou a chamar unifyCardMethodService — money-deferred/schema-ghost deve ficar contido (501) antes do service.`);
  if (/actionContext\s*\.\s*actorId/.test(code)) failures.push(`${REL}: voltou a referenciar actionContext.actorId — handler contido não lê ator do cliente.`);
  if (/bank_ledger|bank_transactions|bank_splits/.test(code)) failures.push(`${REL}: referencia bank_* — proibido.`);
  if (/createMethod|listMethods|getMethodByType|resolveFee/.test(code)) failures.push(`${REL}: voltou a referenciar sink do service (createMethod/listMethods/getMethodByType/resolveFee).`);
}

// ── escopo proibido INTOCADO (money fix / settlement / consumers): hash textual leve ──
// O guard NÃO pode "ver" o git diff, mas pode garantir que o defeito /100 e o consumer NÃO foram movidos para a
// rota (única superfície desta frente). A não-alteração de payment-execution/unifycard.service/settlement/
// regional-fee é responsabilidade do commit específico (git add) + Yala; aqui garantimos que a ROTA não os importa.
if (rawRoutes && /(payment-execution|unifycard\.service|settlement\.service|regional-fee)/.test(stripTs(rawRoutes))) {
  failures.push(`${REL}: a rota contida não pode importar/referenciar payment-execution/unifycard.service/settlement/regional-fee.`);
}

// ── migration viva NÃO cria a tabela (continua archive) ──
const migDir = join(ROOT, 'migrations');
if (existsSync(migDir)) {
  for (const f of readdirSync(migDir)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(join(migDir, f), 'utf-8');
    if (/CREATE\s+TABLE[^;]*unifycard_payment_methods/i.test(sql) || /CREATE\s+TYPE[^;]*unifycard_method_type/i.test(sql)) {
      failures.push(`migrations/${f}: cria unifycard_payment_methods/unifycard_method_type — materialização de schema ghost proibida nesta frente (DECISION própria).`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [unifycard-method-money-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [unifycard-method-money-containment] — 3 rotas unifycard-method contidas (501 UNIFYCARD_METHOD_MONEY_DEFERRED_CONTAINED) antes de service/sink; zero unifyCardMethodService/actionContext.actorId/bank_*/sink na rota; schema permanece ghost (sem migration viva). Money-deferred blindado; fee-unit bps = DECISION futura.');

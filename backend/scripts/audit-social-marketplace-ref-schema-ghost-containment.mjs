#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8D-SOCIAL-MARKETPLACE-REF-BIND-OR-CONTAIN (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// A tabela `social_marketplace_refs` é SCHEMA-GHOST (CREATE TABLE só em migrations_archive/0759; ausente do
// schema canônico e de unificard_dev). As rotas eram dead-at-db + canal-1 (actionContext.actorId — breadcrumb de
// auditoria; o write nunca recebia o actor). DECISÃO: CONTER fail-closed (501 nomeado), NÃO religar/migrar/redesenhar.
// Este gate trava a contenção: TODAS as rotas devem retornar 501 SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED e
// NENHUMA pode voltar a chamar service/repository/DB nem a usar actionContext.actorId. MORDE se a contenção
// regredir. Heurística textual comment-stripped (não AST). Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REL = 'src/modules/social/social-marketplace-ref.routes.ts';
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const p = join(ROOT, REL);
if (!existsSync(p)) {
  console.error(`GATE FAIL [social-marketplace-ref-schema-ghost-containment]: arquivo ausente: ${REL}.`);
  process.exit(1);
}
const code = stripTs(readFileSync(p, 'utf-8'));

// 1) Código de contenção nomeado presente.
if (!/SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED/.test(code)) {
  failures.push(`${REL} perdeu o código de contenção SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED.`);
}

// 2) As 3 superfícies devem estar registradas e contidas (501 CONTAINED).
const routeRegs = (code.match(/fastify\.(get|post)\b/g) || []).length;
if (routeRegs < 3) {
  failures.push(`${REL}: esperado >= 3 rotas registradas (POST /marketplace-ref · GET /:postId · GET /details/:refId), encontradas ${routeRegs} — não remover rotas.`);
}
const contained501 = (code.match(/reply\.status\(\s*501\s*\)\.send\(\s*CONTAINED\s*\)/g) || []).length;
if (contained501 < 3) {
  failures.push(`${REL}: esperado >= 3 rotas contidas (501 CONTAINED), encontradas ${contained501}.`);
}

// 3) PROIBIDO: qualquer chamada ao service / repository (rota contida não pode tocar o substrato ghost).
for (const re of [/socialMarketplaceRefService\./, /socialMarketplaceRefRepository\./, /\.createRef\(/, /\.getRefsByPost\(/, /\.getRefById\(/, /\.getRefWithDetails\(/, /\.removeRef\(/]) {
  if (re.test(code)) failures.push(`${REL}: voltou a chamar o service/repository (${re}) — religação exige frente própria (schema + binding canônico).`);
}

// 4) PROIBIDO: tocar a tabela ghost diretamente.
if (/social_marketplace_refs/.test(code)) {
  failures.push(`${REL}: referencia a tabela social_marketplace_refs (schema-ghost) — proibido na rota contida.`);
}

// 5) PROIBIDO: canal client-declared (actionContext.actorId) na rota contida.
if (/actionContext\s*\.\s*actorId/.test(code)) {
  failures.push(`${REL}: voltou a referenciar actionContext.actorId — a rota contida não lê ator do cliente (era breadcrumb de auditoria).`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [social-marketplace-ref-schema-ghost-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [social-marketplace-ref-schema-ghost-containment] — 3 rotas contidas fail-closed (501 SOCIAL_MARKETPLACE_REF_SCHEMA_GHOST_CONTAINED); zero service/repository/DB; sem actionContext.actorId; tabela ghost não tocada.');

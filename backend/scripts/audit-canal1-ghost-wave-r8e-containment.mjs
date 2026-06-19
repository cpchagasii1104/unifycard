#!/usr/bin/env node
// Guard estrutural — F-AUTHORITY-Z2-R8E-REMAINING-CANAL1-TRIAGE-WAVE (DECISION-0113 / DECISION-0131 §B7 / Z2).
//
// Onda controlada: contenção de 2 superfícies canal-1 SCHEMA-GHOST (tabelas só em migrations_archive/, ausentes
// do schema canônico e de unificard_dev) — business-segment (business_segments) e tax-profile (tax_profiles).
// Ambas eram dead-at-db + canal-1 (POST/PATCH liam actionContext.actorId). CONTIDAS fail-closed (501 nomeado).
// Este gate trava a contenção das 2: cada arquivo deve retornar 501 com seu code nomeado e NENHUM pode voltar a
// chamar service/repository/DB nem a usar actionContext.actorId. MORDE se a contenção regredir. Em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const SURFACES = [
  {
    rel: 'src/modules/marketplace/business-segment.routes.ts',
    code: 'BUSINESS_SEGMENT_SCHEMA_GHOST_CONTAINED',
    forbidServices: [/businessSegmentService\./, /businessSegmentRepository\./, /business_segments/],
  },
  {
    rel: 'src/modules/marketplace/tax-profile.routes.ts',
    code: 'TAX_PROFILE_SCHEMA_GHOST_CONTAINED',
    forbidServices: [/taxProfileService\./, /taxProfileRepository\./, /tax_profiles/],
  },
];

const failures = [];

for (const s of SURFACES) {
  const p = join(ROOT, s.rel);
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${s.rel}`); continue; }
  const code = stripTs(readFileSync(p, 'utf-8'));

  if (!new RegExp(s.code).test(code)) {
    failures.push(`${s.rel}: perdeu o código de contenção ${s.code}.`);
  }
  const routeRegs = (code.match(/fastify\.(get|post|patch|put|delete)\b/g) || []).length;
  if (routeRegs < 3) {
    failures.push(`${s.rel}: esperado >= 3 rotas registradas (POST/GET/PATCH), encontradas ${routeRegs} — não remover rotas.`);
  }
  const contained501 = (code.match(/reply\.status\(\s*501\s*\)\.send\(\s*CONTAINED\s*\)/g) || []).length;
  if (contained501 < 3) {
    failures.push(`${s.rel}: esperado >= 3 rotas contidas (501 CONTAINED), encontradas ${contained501}.`);
  }
  for (const re of s.forbidServices) {
    if (re.test(code)) failures.push(`${s.rel}: voltou a referenciar service/repository/tabela ghost (${re}) — religação exige frente própria (schema + binding canônico).`);
  }
  if (/actionContext\s*\.\s*actorId/.test(code)) {
    failures.push(`${s.rel}: voltou a referenciar actionContext.actorId — a rota contida não lê ator do cliente.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [canal1-ghost-wave-r8e-containment]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [canal1-ghost-wave-r8e-containment] — business-segment + tax-profile contidas fail-closed (501 nomeado); zero service/repository/DB; sem actionContext.actorId; tabelas ghost não tocadas.');

#!/usr/bin/env node
// Gate estrutural — F-ORGANIZATION-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-ORGANIZATION-SCHEMA-GHOST).
// O módulo `organization` está MONTADO mas suas tabelas (organization_invites/members/units/roles) são
// schema ghost (zero migration canônica; organization_members é tombstone). Todas as 13 rotas (5 writes +
// 8 reads) batiam no service/repository → 42P01. Decisão IA Diretora: CONTER fail-closed (501 nomeado,
// blanket), NÃO religar / NÃO ressuscitar organization_members. Este gate trava a contenção: nenhuma rota
// pode voltar a chamar service/repository, usar actionContext.actorId/body.actorId cru, ou fazer binding
// (canRepresentActor) sobre a superfície morta. Integrado em validate:regression-guards.
// Heurística textual comment-stripped, não AST — falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ROUTES_REL = 'modules/organization/organization.routes.ts';

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let checked = 0;

const p = join(SRC, ROUTES_REL);
if (!existsSync(p)) {
  failures.push(`FORBIDDEN_REGRESSION: rota de organization desapareceu: ${ROUTES_REL}`);
} else {
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Código de contenção nomeado + handler 501.
  if (!/ORGANIZATION_SCHEMA_GHOST_CONTAINED/.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} perdeu o código ORGANIZATION_SCHEMA_GHOST_CONTAINED.`);
  }
  if (!/reply\.status\(501\)\.send\(ORGANIZATION_SCHEMA_GHOST_CONTAINED\)/.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} contenção não retorna 501 nomeado.`);
  }

  // 2) As 13 rotas (5 writes + 8 reads) devem usar o handler contido. Conta `, contained)`.
  const containedRegs = (code.match(/,\s*contained\)/g) || []).length;
  if (containedRegs < 13) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} esperado >= 13 rotas contidas (, contained)), encontradas ${containedRegs}.`);
  }

  // 3) PROIBIDO: qualquer chamada ao service/repository (rota contida não acessa service/DB).
  for (const m of [
    /organizationInviteService\./,
    /organizationMemberService\./,
    /organizationUnitService\./,
    /organizationRoleService\./,
    /Repository\./,
  ]) {
    if (m.test(code)) {
      failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a chamar service/repository (${m}) — religação exige frente própria (DT-ORGANIZATION-SCHEMA-GHOST).`);
    }
  }

  // 4) PROIBIDO: actionContext.actorId cru (era autoria spoofável dos writes).
  if (/actionContext\.actorId/.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a usar actionContext.actorId cru (autoria latente — proibido sem religação+binding).`);
  }

  // 5) PROIBIDO: body.actorId como autoridade (accept usava req.body.actorId).
  if (/req\.body|\.body\.actorId/.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} voltou a ler req.body/body.actorId (autoridade cliente-declarada — proibido na superfície contida).`);
  }

  // 6) PROIBIDO: canRepresentActor — não se faz binding sobre rota morta/ghost.
  if (/canRepresentActor/.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} introduziu canRepresentActor numa rota contida — binding sobre superfície morta é proibido (DT-ORGANIZATION-AUTHORITY-BINDING-LATENT).`);
  }

  // 7) PROIBIDO: ressuscitar a tombstone — nenhum CREATE TABLE / referência a materializar organization_members aqui.
  if (/CREATE TABLE[^;]*organization_members/i.test(code)) {
    failures.push(`ORGANIZATION_CONTAINMENT_REGRESSION: ${ROUTES_REL} tenta CREATE TABLE organization_members (tombstone — ressurreição proibida).`);
  }
}

console.log(`[organization-schema-ghost-containment] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [organization-schema-ghost-containment]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [organization-schema-ghost-containment] — 13 rotas contidas fail-closed (501 nomeado); zero service/DB; sem actionContext.actorId/body.actorId/canRepresentActor; tombstone não ressuscitada.');

#!/usr/bin/env node
// Guard estrutural — F-OFFER-2B (DECISION-0144 §A.4/5/6): o eligibility gate de createService.
//
// createService só cria `service` descobrível se houver declaração (PF) / publicação (PJ) ACTIVE do
// MESMO concept_id (resolvido do canonical, EXATO). MORDE se: o gate sair de createService; o método
// de elegibilidade sumir; o check PF (actor_professional_concepts.is_active=true) ou PJ
// (company_concept_publications.status='active') enfraquecer; o concept deixar de vir do canonical; os
// códigos 403 sumirem; aparecer fallback semântico (domain/category/slug/relação) no eligibility; ou
// actionContext.actorId virar autoridade. Estático (lê services.service.ts, comment-stripped). Em regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const FILE = 'src/modules/services/services.service.ts';
const p = join(ROOT, FILE);
const failures = [];

if (!existsSync(p)) {
  failures.push(`arquivo ausente: ${FILE}`);
} else {
  const src = stripTs(readFileSync(p, 'utf-8'));

  if (!/this\.assertDeclarationEligibility\s*\(/.test(src))
    failures.push('createService NÃO chama this.assertDeclarationEligibility( — eligibility gate não wired.');
  if (!/assertDeclarationEligibility\s*\(/.test(src))
    failures.push('método assertDeclarationEligibility ausente.');
  if (!/canonical\.conceptId/.test(src))
    failures.push('eligibility não usa canonical.conceptId — concept deve vir EXATO do canonical_service.');
  if (!/actor_professional_concepts[\s\S]{0,220}is_active\s*=\s*true/.test(src))
    failures.push('check PF ausente/enfraquecido (actor_professional_concepts ... is_active = true).');
  if (!/company_concept_publications[\s\S]{0,220}status\s*=\s*'active'/.test(src))
    failures.push("check PJ ausente/enfraquecido (company_concept_publications ... status = 'active').");
  if (!/SERVICE_ELIGIBILITY_DECLARATION_REQUIRED/.test(src))
    failures.push('falta código 403 SERVICE_ELIGIBILITY_DECLARATION_REQUIRED (PF).');
  if (!/SERVICE_ELIGIBILITY_PUBLICATION_REQUIRED/.test(src))
    failures.push('falta código 403 SERVICE_ELIGIBILITY_PUBLICATION_REQUIRED (PJ).');
  if (/actionContext\s*\.\s*actorId/.test(src))
    failures.push('services.service.ts referencia actionContext.actorId — não é autoridade (G6).');

  // Fallback semântico PROIBIDO no corpo do eligibility (G5): só concept_id exato.
  const m = src.match(/assertDeclarationEligibility[\s\S]*?\n {2}\}/);
  const body = m ? m[0] : '';
  if (!body) {
    failures.push('não consegui isolar o corpo de assertDeclarationEligibility para checar fallback.');
  } else if (/\b(domain|category|category_id|slug|related_to|requires|part_of|substitutes)\b/i.test(body)) {
    failures.push('eligibility usa fallback semântico (domain/category/slug/relação) — PROIBIDO (G5): só concept_id exato.');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [createservice-eligibility]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [createservice-eligibility] — createService exige declaração/publicação ACTIVE do mesmo concept_id (PF actor_professional_concepts.is_active / PJ company_concept_publications.status='active'), concept EXATO do canonical, 403 controlado, sem fallback semântico, actionContext.actorId não é autoridade. Ponte declaração→service blindada (DECISION-0144).");

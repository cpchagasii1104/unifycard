#!/usr/bin/env node
// Guard anti-hardcode — F-GUARD-ANTI-HARDCODE-EVENT-ORCHESTRATION (2026-07-08).
// Impede que a orquestração de evento nasça sobre um frontend que cria SEMÂNTICA local por lista
// hardcoded. SSOT semântico = CONCEPT (concepts.concept_id); TREE/N0/N1/N2/category = navegação, não
// identidade; frontend PROJETA, não cria verdade. Cartório = REMEDIATION_DT_LOG.md.
//
// Cobre: (1) Step0 protegido (backend-driven, sem lista local de formato/tema/categoria/subtipo);
// (2) nenhum arquivo NOVO cria lista local de autoridade (needs/papéis/formato/tema/categoria) — os 2
// legados conhecidos ficam allowlisted como PENDENTE FASE B, não podem crescer nem virar 3º; (3) 🟡 valores
// governados espelhados no front (location_mode/access) NÃO podem divergir do vocabulário do backend.
// Mutation: injetar `const FORMATS=[...]` no Step0, ou criar arquivo novo com `const ROLES=[...]`, ou um
// valor local fora do governado → GATE FAIL. Em validate:regression-guards (runner).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FE = join(ROOT, '..', 'frontend', 'src');
const failures = [];
const stripComments = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// ---- Fonte de verdade governada (lida do backend, NÃO reescrita aqui) ----
function parseArrayConst(code, name) {
  const m = code.match(new RegExp(name + "\\s*=\\s*\\[([^\\]]+)\\]"));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
const evTypes = existsSync(join(ROOT, 'src/core/events/event.types.ts')) ? readFileSync(join(ROOT, 'src/core/events/event.types.ts'), 'utf-8') : '';
const GOV_LOCATION = parseArrayConst(evTypes, 'EVENT_LOCATION_MODES') || [];
const GOV_ACCESS = parseArrayConst(evTypes, 'EVENT_ACCESS_TYPES') || [];
if (!GOV_LOCATION.length || !GOV_ACCESS.length) failures.push('backend: não consegui ler EVENT_LOCATION_MODES/EVENT_ACCESS_TYPES governados (fonte da comparação 🟡).');

// ---- (1) Step0 protegido ----
const STEP0 = 'components/events/guided-flow/Step0EventType.tsx';
const s0p = join(FE, STEP0);
if (!existsSync(s0p)) {
  failures.push(`${STEP0}: ausente — Step0 backend-driven não encontrado.`);
} else {
  const s0 = stripComments(readFileSync(s0p, 'utf-8'));
  if (!/getEventTaxonomy/.test(s0) || !/searchEventThemes/.test(s0)) {
    failures.push(`${STEP0}: perdeu getEventTaxonomy/searchEventThemes — formato/tema deixaram de vir do backend.`);
  }
  if (/const\s+[A-Z_]*(FORMAT|THEME|CATEGOR|SUBTYPE|EVENT_TYPE)[A-Z_]*\s*(?::[^=]+)?=\s*[[{]/.test(s0)) {
    failures.push(`${STEP0}: reintroduziu lista LOCAL de formato/tema/categoria/subtipo como autoridade — proibido (deve vir do backend).`);
  }
}

// ---- (2) Nenhuma lista NOVA de autoridade em guided-flow/ (+ EventNeedsWizard) ----
// Allowlist = LEGADO conhecido PENDENTE FASE B (contenção registrada, não perdão; não pode crescer nem virar 3º).
const LEGACY_ALLOW = new Set([
  // Step5OperationalRoles SAIU da allowlist (F-EVENT-ORCHESTRATION-PHASE-B-WRITE): agora lê sugestões
  // governadas do backend e grava por needConceptId — não pode voltar a hardcode (guard passa a morder).
  'components/events/EventNeedsWizard.tsx',                   // NEEDS_CATEGORIES_BY_EVENT_TYPE — RFQ-adjacent, fatia própria (não tocada)
]);
const AUTHORITY_CONST = /const\s+[A-Za-z_]*(NEED|ROLE|FORMAT|THEME|CATEGOR|SUBTYPE|EVENT_TYPE)[A-Za-z_]*\s*(?::[^=]+)?=\s*[[{]/;
const scanFiles = [];
const gfDir = join(FE, 'components/events/guided-flow');
if (existsSync(gfDir)) for (const f of readdirSync(gfDir)) if (f.endsWith('.tsx')) scanFiles.push('components/events/guided-flow/' + f);
for (const extra of ['components/events/EventNeedsWizard.tsx', 'components/events/EventCreationGuidedFlow.tsx']) if (existsSync(join(FE, extra))) scanFiles.push(extra);
for (const rel of scanFiles) {
  if (LEGACY_ALLOW.has(rel)) continue;
  const code = stripComments(readFileSync(join(FE, rel), 'utf-8'));
  if (AUTHORITY_CONST.test(code)) {
    failures.push(`${rel}: cria lista LOCAL de necessidade/papel/formato/tema/categoria como autoridade (NÃO allowlisted). Deve vir do backend; legado só via DT + allowlist explícita.`);
  }
}

// ---- (3) 🟡 valores governados espelhados não podem DIVERGIR (Opção A: tolera cópia, veta divergência) ----
function localValues(rel, re) {
  const p = join(FE, rel);
  if (!existsSync(p)) return [];
  return [...readFileSync(p, 'utf-8').matchAll(re)].map((m) => m[1]);
}
const locVals = localValues('components/events/guided-flow/Step4SpaceRequirements.tsx', /key:\s*'([a-z_]+)'/g);
for (const v of locVals) if (!GOV_LOCATION.includes(v)) failures.push(`Step4SpaceRequirements: location_mode local '${v}' NÃO está no vocabulário governado EVENT_LOCATION_MODES [${GOV_LOCATION.join(',')}] — vocabulário paralelo.`);
const accVals = localValues('components/events/guided-flow/Step2Description.tsx', /eventAccessType:\s*'([a-z_]+)'/g);
for (const v of accVals) if (!GOV_ACCESS.includes(v)) failures.push(`Step2Description: access_type local '${v}' NÃO está em EVENT_ACCESS_TYPES [${GOV_ACCESS.join(',')}] — vocabulário paralelo.`);

if (failures.length > 0) {
  console.error('GATE FAIL [anti-hardcode-event-orchestration]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`GATE OK [anti-hardcode-event-orchestration] — Step0 backend-driven; sem lista de autoridade nova (2 legados allowlisted PENDENTE FASE B); location_mode/access locais ⊆ governado. SSOT = concepts.concept_id.`);
process.exit(0);

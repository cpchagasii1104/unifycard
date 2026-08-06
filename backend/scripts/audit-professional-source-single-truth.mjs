#!/usr/bin/env node
// backend/scripts/audit-professional-source-single-truth.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (auditoria "de onde vêm os profissionais", GO Clayton 2026-08-06)
// ║ NORMA:   DECISION-0144 · DECISION-0147 Q2/Q3 (gate de publicação, DUAS metades)
// ║ NÃO:     criar terceira porta de "quem faz o quê", nem ler só METADE do gate no matching
// ║ EM VEZ:  PF → actor_professional_concepts · PJ → company_concept_publications (via oferta)
// ╚════════════════════════════════════════════════════════════════
//
// ── A PERGUNTA QUE ESTE GUARD MANTÉM COM UMA RESPOSTA SÓ ────────────────────────────────────────
// "De onde vem o profissional que atende o motor de eventos?" — a resposta promulgada tem DUAS
// metades e nenhuma terceira: PF declara profissão (aba do C1) · PJ publica concept da empresa.
// Tudo o mais (`service_offerings`, `services`, `actor_assets`, discovery de evento) é DOWNSTREAM.
//
// ① MATCHING DE DEMANDA lê a UNIÃO das duas metades. Medido em 2026-08-06: lendo só a metade PF,
//    as 8 páginas com 14 ofertas ativas NUNCA casavam com demanda nenhuma — o filtro dizia
//    "oportunidades para mim" e respondia "para quem preencheu a aba do C1".
//    ⚠️ O motor de EVENTO **não** entra nesta união e não deve: contratar exige OFERTA publicada.
// ② SEED NÃO AFIRMA `active` — CONSULTA o gate. O seed escrevia `status='active'` cru e produziu
//    15 ofertas ativas que o gate recusaria (0 publicações, 7/8 empresas sem tipo, 0 KYB).
// ③ O PREDICADO DO GATE segue ÚNICO e COMPARTILHADO (gate + readiness bebem da mesma fonte).
//
// Estático, comment-stripped. Em validate:regression-guards (comando direto).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const DEMAND_REPO = 'src/modules/demands/demand.repository.ts';
const SEED = 'src/scripts/seed-demo-event-supply.ts';
const GATE = 'src/modules/services/services-offering-activation-gate.ts';
const CANON = 'src/core/catalog/canonical/canonical-service.service.ts';

const failures = [];

// ══ ① O MATCHING LÊ AS DUAS METADES ═══════════════════════════════════════════════════════════
const repo = read(DEMAND_REPO);
if (repo === null) failures.push(`arquivo ausente: ${DEMAND_REPO}`);
else {
  const i = repo.indexOf('async listOpportunities');
  const j = repo.indexOf('\n  async ', i + 1);
  const bloco = i >= 0 ? repo.slice(i, j > i ? j : repo.length) : '';
  if (!bloco) failures.push(`${DEMAND_REPO}: listOpportunities sumiu.`);
  else {
    if (!/actor_professional_concepts/.test(bloco))
      failures.push(`${DEMAND_REPO}: o matching perdeu a metade PF (actor_professional_concepts) — quem declarou profissão deixa de ver oportunidade.`);
    if (!/service_offerings/.test(bloco) || !/canonical_services/.test(bloco))
      failures.push(`${DEMAND_REPO}: o matching perdeu a metade PJ (oferta ativa → canonical_service → concept). Lendo só a metade PF, EMPRESA COM OFERTA nunca casa com demanda — foi o defeito medido em 2026-08-06 (8 páginas, 14 ofertas, 0 matches).`);
    if (!/apc\.is_active = true/.test(bloco))
      failures.push(`${DEMAND_REPO}: a metade PF deixou de exigir declaração ATIVA — profissão aposentada voltaria a casar.`);
    if (!/so\.status = 'active'/.test(bloco))
      failures.push(`${DEMAND_REPO}: a metade PJ deixou de exigir oferta ATIVA — oferta draft/suspensa voltaria a casar.`);
  }
}

// ══ ② O SEED CONSULTA O GATE, NÃO AFIRMA ══════════════════════════════════════════════════════
const seed = read(SEED);
if (seed === null) failures.push(`arquivo ausente: ${SEED}`);
else {
  if (!/evaluateOfferingActivationEligibility/.test(seed))
    failures.push(`${SEED}: o seed deixou de CONSULTAR o gate (evaluateOfferingActivationEligibility) — voltou a AFIRMAR elegibilidade que não tem.`);
  if (/INSERT INTO service_offerings[\s\S]{0,400}?'active'/.test(seed))
    failures.push(`${SEED}: voltou a escrever service_offerings com 'active' LITERAL. Isso produz vitrine que o gate recusaria — dado que não obedece a regra faz a próxima instância concluir que a regra não existe.`);
}

// ══ ③ O PREDICADO SEGUE ÚNICO E ESPELHADO ═════════════════════════════════════════════════════
const gate = read(GATE);
if (gate === null) failures.push(`arquivo ausente: ${GATE}`);
else {
  if (!/export async function evaluateOfferingActivationEligibility/.test(gate))
    failures.push(`${GATE}: o predicado ÚNICO sumiu — gate e projeção de readiness passariam a ter regras separadas (segunda verdade sobre "pode ativar").`);
  if (!/company_concept_publications/.test(gate) || !/actor_professional_concepts/.test(gate))
    failures.push(`${GATE}: o gate perdeu uma das DUAS metades (PJ: company_concept_publications · PF: actor_professional_concepts).`);
}
const canon = read(CANON);
if (canon && (!/company_concept_publications/.test(canon) || !/actor_professional_concepts/.test(canon)))
  failures.push(`${CANON}: searchOfferable deixou de espelhar as duas metades do gate — a lista publicável divergiria do que o gate aceita.`);

if (failures.length) {
  console.log('GATE FAIL [professional-source-single-truth]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    '\n→ "Quem faz o quê" tem DUAS metades e nenhuma terceira (DECISION-0144/0147):' +
    '\n  PF: actor_professional_concepts (aba profissional do C1) · PJ: company_concept_publications.' +
    '\n→ service_offerings/services/actor_assets e a descoberta de fornecedor do evento são DOWNSTREAM.' +
    '\n→ O matching de DEMANDA lê a UNIÃO; o motor de EVENTO lê a OFERTA (contratar exige oferta).');
  process.exit(1);
}

console.log(
  'GATE OK [professional-source-single-truth] — a origem do profissional segue com DUAS metades e ' +
  'nenhuma terceira: PF declara (actor_professional_concepts), PJ publica (company_concept_publications), ' +
  'e o predicado do gate é ÚNICO e espelhado em searchOfferable. O matching de demanda lê a UNIÃO das ' +
  'duas; o motor de evento segue lendo OFERTA publicada. O seed CONSULTA o gate em vez de afirmar ativo.'
);

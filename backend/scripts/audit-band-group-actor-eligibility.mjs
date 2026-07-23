#!/usr/bin/env node
// audit-band-group-actor-eligibility.mjs — Guard da FATIA 1 do arco fundação eventos:
// BANDA NASCE COMO GRUPO-ACTOR PROVIDER (classe COLETIVO — extensão de DECISION-0144 / DECISION-0147 Q2,
// GO Clayton 2026-07-23). Morde se:
//  (a) o ramo COLETIVO de assertDeclarationEligibility perder o check REAL de declaração
//      (actor_professional_concepts is_active) ou passar a aceitar tipos não-group;
//  (b) o ramo group do gate de ativação perder a ÂNCORA CIVIL (JOIN responsible_actor_id → actor humano →
//      global_users CPF/nome + identities) — i.e., aceitar grupo sem âncora humana com CPF/identity;
//  (c) os comentários de base decisória de qualquer um dos dois fixes forem removidos.
// Region-anchored: extrai as funções pelo par assinatura-início/assinatura-seguinte; ausência da região = FAIL.
// Comment-aware nos checks de código (stripTs); os checks (c) leem o RAW (comentários incluídos). Fail-closed.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

const SVC_PATH = 'src/modules/services/services.service.ts';
const GATE_PATH = 'src/modules/services/services-offering-activation-gate.ts';
const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
const GATE_RAW = readOrFail(GATE_PATH, 'FILE');

// Região delimitada por [startRe, endRe) sobre o RAW; devolve { raw, code } ou null (FAIL do caller).
function region(raw, startRe, endRe, label) {
  const s = raw.search(startRe);
  if (s < 0) { note('REGION', `${label}: âncora de início não encontrada (${startRe})`); return null; }
  const rest = raw.slice(s);
  const e = rest.search(endRe);
  const slice = e < 0 ? rest : rest.slice(0, e);
  return { raw: slice, code: stripTs(slice) };
}

// ══ (a) ramo COLETIVO em assertDeclarationEligibility ══
{
  const reg = region(
    SVC_RAW,
    /private async assertDeclarationEligibility/,
    /\n\s*async createService\(/,
    'assertDeclarationEligibility'
  );
  if (reg) {
    const { raw, code } = reg;
    // predicado EXATO de igualdade com 'group' — sem alternância que aceite outros tipos.
    const predRe = /if\s*\(\s*actor\.actor_type\s*===\s*'group'\s*\)/;
    if (!predRe.test(code)) {
      note('COLETIVO-BRANCH', `ramo COLETIVO ausente ou predicado alterado (esperado if (actor.actor_type === 'group')) em ${SVC_PATH}`);
    } else {
      // corpo do ramo: do predicado até o primeiro `return;` — deve conter o check REAL de declaração.
      const start = code.search(predRe);
      const body = code.slice(start, code.indexOf('return;', start) + 7 || undefined);
      if (!/actor_professional_concepts/.test(body)) note('COLETIVO-CHECK', 'ramo COLETIVO sem consulta a actor_professional_concepts');
      if (!/is_active\s*=\s*true/.test(body)) note('COLETIVO-CHECK', 'ramo COLETIVO sem predicado is_active = true (declaração VIVA)');
      if (!/actor\.actor_id/.test(body)) note('COLETIVO-CHECK', 'ramo COLETIVO não usa actor.actor_id (sujeito = o PRÓPRIO grupo-actor)');
      if (!/SERVICE_ELIGIBILITY_DECLARATION_REQUIRED/.test(body)) note('COLETIVO-CHECK', 'ramo COLETIVO sem throw SERVICE_ELIGIBILITY_DECLARATION_REQUIRED (declaração ausente deve NEGAR)');
      // alternância no predicado (ex.: === 'group' || === 'x') mataria a exclusividade do tipo.
      const predLine = code.slice(start, code.indexOf(')', start) + 1);
      if (/\|\|/.test(predLine)) note('COLETIVO-BRANCH', `predicado do ramo COLETIVO com alternância (aceitaria tipo não-group): ${predLine.trim()}`);
    }
    // default fail-closed preservado DEPOIS do ramo: G3 SUBJECT_UNSUPPORTED continua existindo.
    if (!/SERVICE_ELIGIBILITY_SUBJECT_UNSUPPORTED/.test(raw)) {
      note('FAIL-CLOSED', `throw G3 SERVICE_ELIGIBILITY_SUBJECT_UNSUPPORTED sumiu de assertDeclarationEligibility (${SVC_PATH})`);
    }
  }
}

// ══ (b) ramo group do gate de ativação — ÂNCORA CIVIL obrigatória ══
{
  const reg = region(
    GATE_RAW,
    /export async function evaluateOfferingActivationEligibility/,
    /\nexport async function assertOfferingActivationEligibility/,
    'evaluateOfferingActivationEligibility'
  );
  if (reg) {
    const { code } = reg;
    const grpPredRe = /actor_type\s*===\s*'group'/;
    if (!grpPredRe.test(code)) {
      note('GROUP-CIVIL', `ramo group ausente do gate de ativação (${GATE_PATH}) — grupo-actor voltaria a cair no check PF e falhar sempre, OU pior, a passar sem âncora`);
    } else {
      const start = code.search(grpPredRe);
      // corpo do ramo group até o fim do else-if (próximo `}` de fechamento do bloco é impreciso;
      // usar a janela até o push de CIVIL_MINIMUM, que vem depois do bloco de consultas).
      const windowEnd = code.indexOf('OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED', start);
      const body = code.slice(start, windowEnd > start ? windowEnd : undefined);
      for (const [re, what] of [
        [/responsible_actor_id/, 'JOIN/uso de responsible_actor_id (âncora civil do grupo-actor)'],
        [/anc\.id\s*=\s*g\.responsible_actor_id/, 'JOIN actors anc ON anc.id = g.responsible_actor_id'],
        [/JOIN\s+global_users\s+gu\s+ON\s+gu\.global_user_id\s*=\s*anc\.global_user_id/i, 'JOIN global_users pela âncora (anc.global_user_id)'],
        [/JOIN\s+identities\s+idt\s+ON\s+idt\.global_user_id\s*=\s*anc\.global_user_id/i, 'JOIN identities pela âncora'],
        [/g\.actor_type\s*=\s*'group'/, "predicado g.actor_type = 'group' no SQL"],
        [/responsible_actor_id\s+IS\s+NOT\s+NULL/i, 'responsible_actor_id IS NOT NULL (grupo sem âncora → nega)'],
        [/anc\.actor_type\s*=\s*'user'/, "âncora humana (anc.actor_type = 'user')"],
        [/gu\.cpf\s+IS\s+NOT\s+NULL/i, 'gu.cpf IS NOT NULL (CPF da âncora obrigatório)'],
        [/gu\.full_name\s+IS\s+NOT\s+NULL/i, 'gu.full_name IS NOT NULL (nome civil da âncora obrigatório)'],
      ]) {
        if (!re.test(body)) note('GROUP-CIVIL', `ramo group do gate perdeu: ${what}`);
      }
    }
    // fail-closed estrutural: civil nasce null e o reason continua existindo (tipo não coberto → nega).
    if (!/let\s+civil\s*:[^=]*=\s*null/.test(code)) {
      note('FAIL-CLOSED', 'gate: `let civil ... = null` sumiu — tipo de provider não coberto deve continuar negando (civil=null)');
    }
    if (!/OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED/.test(code)) {
      note('FAIL-CLOSED', 'gate: reason OFFERING_ACTIVATION_CIVIL_MINIMUM_REQUIRED sumiu do predicado');
    }
    // check PF preservado (o ramo user segue exigindo o PRÓPRIO vínculo civil).
    if (!/a\.actor_type\s*=\s*'user'/.test(code)) {
      note('PF-PRESERVED', "gate: predicado PF a.actor_type = 'user' sumiu do ramo user");
    }
  }
}

// ══ (c) comentários de base decisória ══
{
  const svcLower = SVC_RAW.toLowerCase();
  for (const frag of ['classe coletivo (banda=grupo-actor)', 'decision-0144', 'go clayton 2026-07-23', 'canrepresentactor']) {
    if (!svcLower.includes(frag)) note('DECISION-BASIS', `comentário de base decisória do fix COLETIVO sem o fragmento "${frag}" (${SVC_PATH})`);
  }
  const gateLower = GATE_RAW.toLowerCase();
  for (const frag of ['decision-0147 q2 estendida a coletivo', 'go clayton 2026-07-23', 'âncora civil']) {
    if (!gateLower.includes(frag)) note('DECISION-BASIS', `comentário de base decisória do fix do gate sem o fragmento "${frag}" (${GATE_PATH})`);
  }
}

if (fails.length) {
  console.error('❌ audit-band-group-actor-eligibility FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-band-group-actor-eligibility OK — ramo COLETIVO (DECISION-0144 estendida) + âncora civil no gate (DECISION-0147 Q2 estendida) + base decisória preservados.');

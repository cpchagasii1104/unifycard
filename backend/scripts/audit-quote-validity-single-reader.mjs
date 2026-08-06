#!/usr/bin/env node
// backend/scripts/audit-quote-validity-single-reader.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (criado 2026-08-06, DECISION-0196)
// ║ NORMA:   DECISION_0196 §C/D1 (validade) · §C/D2 (vencido morre) · organizacaoevento.md §4⑥
// ║ NÃO:     NÃO comparar `expires_at`/`expiresAt` com "agora" fora do módulo canônico
// ║ EM VEZ:  importar `isQuoteExpired` / `assertQuoteUsable` de `modules/demands/quote-validity`
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O QUE ELE TRAVA, E POR QUE ═══
// O plano do orçamento escreveu a exigência em letra: *"UMA função responde 'este orçamento ainda
// vale', e todos importam dela. Derivação copiada em N telas diverge — é o defeito `free-time`
// consertado em 2026-08-05."* Este guard é o que faz a letra morder.
//
// A divergência aqui não é cosmética: uma tela que deriva errado mostra vencido como vivo, o
// cliente aceita, e o compromisso nasce de um preço que já não vale.
//
// ═══ DUAS METADES, E O GUARD EXIGE AS DUAS ═══
// (1) DERIVAR na leitura — sem gravar `expirado` (não há status `expired` no CHECK vivo, e não deve
//     haver: exigiria worker, e worker que não roda produz vencido que o sistema jura estar vivo);
// (2) IMPOR no aceite — derivar sem impor deixa a tela honesta e o motor permissivo.
//
// MORDE se:
//   1. o módulo canônico sumir ou perder qualquer das duas exportações;
//   2. o módulo passar a ESCREVER (ele RESPONDE; não persiste, não decide, não emite);
//   3. aparecer comparação de validade FORA dele (segunda derivação);
//   4. o aceite (`choose`) deixar de IMPOR (`assertQuoteUsable`) — a metade que não grita;
//   5. nascer um status `expired` no vocabulário (a expiração voltaria a ser gravada).
//
// Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const CANON = 'src/modules/demands/quote-validity.ts';
const failures = [];

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf-8') : null; };

// ── 1 · o módulo canônico existe e exporta as DUAS metades ────────────────────────────────────
const canonRaw = read(CANON);
if (canonRaw === null) {
  failures.push(`${CANON} ausente — o leitor único de validade do orçamento sumiu.`);
} else {
  const canon = stripTs(canonRaw);
  if (!/export function isQuoteExpired\s*\(/.test(canon)) failures.push(`${CANON}: sem \`isQuoteExpired\` — a metade DERIVAR.`);
  if (!/export function assertQuoteUsable\s*\(/.test(canon)) failures.push(`${CANON}: sem \`assertQuoteUsable\` — a metade IMPOR.`);
  // 2 · read-only: responde, não persiste
  if (/\b(INSERT|UPDATE|DELETE)\b/i.test(canon) || /runQueryWithTenant|runQueriesWithTenant|getClientWithTenant/.test(canon)) {
    failures.push(`${CANON}: o leitor único NÃO pode escrever nem consultar o banco — ele RESPONDE (read-only).`);
  }
}

// ── 3 · nenhuma SEGUNDA derivação fora do módulo ──────────────────────────────────────────────
// SUBSTÂNCIA: comparação entre um valor de validade e "agora", em qualquer forma viva —
// TS (`expiresAt < new Date()`, `Date.now() > …`) ou SQL (`expires_at < now()`).
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : (/\.ts$/.test(n) && out.push(p));
  }
  return out;
}
const SEGUNDA_DERIVACAO = [
  /expires_at\s*[<>]=?\s*now\(\)/i,                       // SQL
  /now\(\)\s*[<>]=?\s*expires_at/i,
  /expiresAt[^\n;]{0,40}[<>]=?\s*(new Date\(\)|Date\.now\(\))/,  // TS
  /(new Date\(\)|Date\.now\(\))[^\n;]{0,40}[<>]=?\s*[^\n;]{0,20}expiresAt/,
];
const canonAbs = join(ROOT, CANON).replace(/\\/g, '/');
// 🔴 ESCOPO POR DOMÍNIO, não por nome de coluna. `expires_at` é nome COMUM no schema
// (`actor_delegations`, `live_presence`, `actor_active_location`, `group_invites`, passes…), e cada
// um tem a sua regra. A v1 deste guard mordeu `seed-smoke-p3.ts` por causa de
// `actor_delegations.expires_at > NOW()` — que não tem nada a ver com orçamento.
// A regra do leitor único é sobre a validade DO ORÇAMENTO: só conta quem toca o substrato dele.
const DOMINIO_DO_ORCAMENTO = /service_demand_responses|DemandResponse|modules\/demands/;
for (const abs of walk(SRC)) {
  if (abs.replace(/\\/g, '/') === canonAbs) continue;           // o próprio módulo pode
  const src = stripTs(readFileSync(abs, 'utf-8'));
  if (!/expiresAt|expires_at/.test(src)) continue;
  if (!DOMINIO_DO_ORCAMENTO.test(src)) continue;                 // outro domínio, outra regra
  const hit = SEGUNDA_DERIVACAO.find((re) => re.test(src));
  if (hit) {
    failures.push(
      `${relative(ROOT, abs).replace(/\\/g, '/')}: SEGUNDA derivação de validade do orçamento. ` +
      `A pergunta "este orçamento ainda vale" tem UM dono (${CANON}) — importe \`isQuoteExpired\`. ` +
      `Cópia é grátis hoje e cara no dia em que uma for corrigida e a outra não (lição de free-time, 2026-08-05).`
    );
  }
}

// ── 4 · o ACEITE impõe (a metade que não grita) ────────────────────────────────────────────────
const SVC = 'src/modules/demands/demand.service.ts';
const svcRaw = read(SVC);
if (svcRaw === null) failures.push(`arquivo ausente: ${SVC}`);
else {
  const svc = stripTs(svcRaw);
  if (!/assertQuoteUsable\s*\(/.test(svc)) {
    failures.push(`${SVC}: o aceite NÃO impõe a validade (\`assertQuoteUsable\` ausente). Derivar na leitura sem impor no aceite deixa a tela honesta e o motor permissivo — aceita-se por uma aba velha.`);
  }
  // a imposição tem de estar DENTRO do `choose` (o aceite), não em qualquer lugar do arquivo.
  const i = svc.indexOf('async choose(');
  const j = svc.indexOf('async withdraw(');
  const bloco = (i >= 0 && j > i) ? svc.slice(i, j) : '';
  if (!bloco) failures.push(`${SVC}: bloco \`choose\` não localizado para auditar a imposição.`);
  else if (!/assertQuoteUsable\s*\(/.test(bloco)) {
    failures.push(`${SVC}: \`assertQuoteUsable\` existe no arquivo mas NÃO dentro de \`choose\` — o aceite segue permissivo.`);
  }
}

// ── 5 · a expiração NÃO pode voltar a ser gravada ──────────────────────────────────────────────
const TYPES = 'src/modules/demands/demand.types.ts';
const typesRaw = read(TYPES);
if (typesRaw === null) failures.push(`arquivo ausente: ${TYPES}`);
else if (/DEMAND_RESPONSE_STATUSES[\s\S]{0,200}'expired'/.test(stripTs(typesRaw))) {
  failures.push(`${TYPES}: nasceu status \`expired\` no vocabulário — a expiração voltaria a ser GRAVADA, e gravar exige worker. Ela é DERIVADA na leitura e IMPOSTA no aceite (DECISION-0196 §C/D1).`);
}

if (failures.length) {
  console.log('GATE FAIL [quote-validity-single-reader]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(`\n→ UMA função responde "este orçamento ainda vale": ${CANON}. Todos importam dela.`);
  console.log('→ Expiração é PREGUIÇOSA: derivada na leitura, imposta no aceite, sem worker (precedente: group_invites).');
  process.exit(1);
}

console.log(
  `GATE OK [quote-validity-single-reader] — a pergunta "este orçamento ainda vale" tem UM dono ` +
  `(${CANON}, read-only, com as duas metades: isQuoteExpired DERIVA e assertQuoteUsable IMPÕE); ` +
  `zero segunda derivação em src/ (varredura por SUBSTÂNCIA: comparação com now()/new Date(), em TS e em SQL); ` +
  `o aceite (choose) impõe; e não existe status 'expired' no vocabulário — expiração é derivada, nunca gravada.`
);

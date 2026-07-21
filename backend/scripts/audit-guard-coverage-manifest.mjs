#!/usr/bin/env node
// audit-guard-coverage-manifest.mjs
// F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT (ROOT-003 R2 · material remediation).
//
// PROPOSITO: tornar VISIVEL a cobertura efetiva dos guards e FALHAR quando um guard continuo
// novo nascer sem wiring (anti-drift). NAO executa nenhum guard; NAO e um segundo runner; NAO e
// fonte de qualidade dos guards (isso vive no AUDIT-002). DERIVA o alcance das 3 fontes de wiring
// reais (CMDS[] do runner, arrays dos 2 agregadores, package.json+workflow do actor-writer); a
// UNICA declaracao nova de alcance e guard-coverage-declarations.json, e so para PAPEIS
// nao-deriviveis (agregador / harness one-shot / ferramenta nao-guard).
//
// DOIS EIXOS INDEPENDENTES por arquivo audit-*.mjs|ts do disco:
//   Eixo alcance: CI_DIRECT | CI_AGGREGATED | CI_OTHER_COMMAND | NOT_CI_REQUIRED
//   Eixo papel:   CONTINUOUS_GUARD | AGGREGATOR | ONE_SHOT_HARNESS | NON_GUARD_TOOL
//
// FAIL-CLOSED: arquivo sem alcance, sem papel, com papel/alcance duplo indevido, declaracao
// fantasma, one-shot na CI, non-guard-tool na CI, continuous em NOT_CI_REQUIRED, agregador sem
// entrada direta, sub-guard inexistente, actor-writer sem npm-script/workflow, ou guard novo sem
// wiring e sem declaracao -> exit 1.
//
// Le todas as fontes como DADOS (readFileSync); NUNCA importa/executa runner ou agregadores.
// Extracao ESTRUTURAL (quote-aware + bracket-balanced), nunca janela fixa como prova.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = join(SCRIPTS_DIR, '..');
const REPO_DIR = join(BACKEND_DIR, '..');

const failures = [];
const fail = (msg) => failures.push(msg);

function readOrDie(p, label) {
  if (!existsSync(p)) {
    fail(`fonte ausente (${label}): ${p} — impossivel derivar cobertura fail-closed.`);
    return null;
  }
  try {
    return readFileSync(p, 'utf8');
  } catch (e) {
    fail(`falha ao ler ${label}: ${p} — ${e.message}`);
    return null;
  }
}

// ─── Extrator estrutural: encontra `const <name> = [` e devolve os literais de string do array,
//     respeitando aspas ('/"/`), escapes e comentarios // (que ficam FORA de string). Balanceia
//     colchetes internos. Falha fechada se o array nao puder ser interpretado. ──────────────────
function extractArrayStringLiterals(source, arrayDeclRegex, label) {
  const m = source.match(arrayDeclRegex);
  if (!m) {
    fail(`nao foi possivel localizar a declaracao do array em ${label} (formato inesperado) — fail-closed.`);
    return null;
  }
  let i = source.indexOf('[', m.index);
  if (i < 0) {
    fail(`array em ${label}: '[' nao encontrado apos a declaracao — fail-closed.`);
    return null;
  }
  i += 1; // depois do '['
  let depth = 1;
  const literals = [];
  const n = source.length;
  while (i < n && depth > 0) {
    const ch = source[i];
    // comentario de linha (fora de string): ignora ate o fim da linha
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    // comentario de bloco
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === '[' || ch === '{' || ch === '(') { depth += 1; i += 1; continue; }
    if (ch === ']' || ch === '}' || ch === ')') { depth -= 1; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      let buf = '';
      while (i < n) {
        const c = source[i];
        if (c === '\\') { buf += source[i + 1] ?? ''; i += 2; continue; }
        if (c === quote) { i += 1; break; }
        buf += c;
        i += 1;
      }
      literals.push(buf);
      continue;
    }
    i += 1;
  }
  if (depth !== 0) {
    fail(`array em ${label}: colchetes nao balanceados (fim inesperado) — fail-closed.`);
    return null;
  }
  return literals;
}

// filename audit-*.(mjs|ts|js) a partir de um comando/entrada
function auditFileFromToken(token) {
  const m = token.match(/(audit-[A-Za-z0-9_.-]+\.(?:mjs|ts|js))/);
  return m ? m[1] : null;
}

// ─── 1. UNIVERSO: todo audit-*.mjs|ts no diretorio scripts ──────────────────────────────────────
const universe = readdirSync(SCRIPTS_DIR)
  .filter((f) => /^audit-.+\.(mjs|ts)$/.test(f))
  .sort();

// ─── 2. Fonte CI_DIRECT: CMDS[] do runner (lido como dado) ──────────────────────────────────────
const RUNNER = join(SCRIPTS_DIR, 'run-regression-guards.mjs');
const runnerSrc = readOrDie(RUNNER, 'runner');
let directSet = new Set();
let runnerCmdCount = 0;
if (runnerSrc) {
  const cmds = extractArrayStringLiterals(runnerSrc, /const\s+CMDS\s*=\s*\[/, 'runner CMDS');
  if (cmds) {
    runnerCmdCount = cmds.length;
    for (const c of cmds) {
      const f = auditFileFromToken(c);
      if (f && /\.(mjs|ts)$/.test(f)) directSet.add(f);
    }
  }
}

// ─── 3. Fonte CI_AGGREGATED: arrays reais dos 2 agregadores declarados ──────────────────────────
const DECL_PATH = join(SCRIPTS_DIR, 'guard-coverage-declarations.json');
const declRaw = readOrDie(DECL_PATH, 'declaracoes');
let decl = null;
if (declRaw) {
  try { decl = JSON.parse(declRaw); } catch (e) { fail(`guard-coverage-declarations.json invalido: ${e.message}`); }
}
const declaredAggregators = new Set(decl?.aggregators ?? []);
const declaredHarness = new Set(decl?.one_shot_harness ?? []);
const declaredTool = new Set(decl?.non_guard_tool ?? []);

const aggregatedSet = new Set(); // sub-guards executados por agregador
const aggregatorSubMap = new Map(); // agregador -> [subguards]
for (const agg of declaredAggregators) {
  const aggPath = join(SCRIPTS_DIR, agg);
  if (!existsSync(aggPath)) { fail(`agregador declarado inexistente: ${agg}`); continue; }
  // regra 9: agregador declarado precisa estar alcancado diretamente (no CMDS)
  if (!directSet.has(agg)) fail(`agregador ${agg} declarado mas NAO esta no CMDS[] do runner (regra 9).`);
  const aggSrc = readOrDie(aggPath, `agregador ${agg}`);
  if (!aggSrc) continue;
  const subs = extractArrayStringLiterals(aggSrc, /const\s+guards\s*=\s*\[/, `agregador ${agg}`);
  if (!subs) continue;
  const list = [];
  for (const s of subs) {
    const f = auditFileFromToken(s) || (/^audit-.+\.(mjs|ts)$/.test(s) ? s : null);
    if (!f) continue;
    // regra 10: sub-guard listado precisa existir no disco
    if (!existsSync(join(SCRIPTS_DIR, f))) fail(`agregador ${agg}: sub-guard listado inexistente no disco: ${f} (regra 10).`);
    aggregatedSet.add(f);
    list.push(f);
  }
  aggregatorSubMap.set(agg, list);
}

// ─── 4. Fonte CI_OTHER_COMMAND: package.json -> validate:actor-writer-boundaries -> workflow ────
const otherSet = new Set();
const PKG = join(BACKEND_DIR, 'package.json');
const pkgSrc = readOrDie(PKG, 'package.json');
const WF = join(REPO_DIR, '.github', 'workflows', 'backend-ci.yml');
const wfSrc = readOrDie(WF, 'backend-ci.yml');
if (pkgSrc && wfSrc) {
  let pkg = null;
  try { pkg = JSON.parse(pkgSrc); } catch (e) { fail(`package.json invalido: ${e.message}`); }
  const awScript = pkg?.scripts?.['validate:actor-writer-boundaries'];
  const awFile = awScript ? auditFileFromToken(awScript) : null;
  const wfCalls = /validate:actor-writer-boundaries/.test(wfSrc);
  if (!awScript || !awFile) fail(`regra 11: npm-script validate:actor-writer-boundaries ausente ou sem audit-* (chain CI_OTHER_COMMAND quebrada).`);
  else if (!wfCalls) fail(`regra 11: workflow backend-ci.yml nao chama validate:actor-writer-boundaries (chain CI_OTHER_COMMAND quebrada).`);
  else otherSet.add(awFile);
}

// ─── 5. Duplo-run direto+agregado: detectar, listar, NAO falhar (observacao explicita) ──────────
const doubleRun = [...aggregatedSet].filter((f) => directSet.has(f)).sort();
// alcance canonico: se esta no CMDS direto, o alcance e CI_DIRECT (o agregado vira observacao)
const aggregatedExclusive = new Set([...aggregatedSet].filter((f) => !directSet.has(f)));

// ─── 6. Classificar cada arquivo do universo em (alcance, papel), fail-closed ───────────────────
const rows = [];
for (const f of universe) {
  const isDirect = directSet.has(f);
  const isAgg = aggregatedExclusive.has(f);
  const isOther = otherSet.has(f);
  const isAggregatorRole = declaredAggregators.has(f);
  const isHarness = declaredHarness.has(f);
  const isTool = declaredTool.has(f);

  // ── alcance ──
  const reaches = [];
  if (isDirect) reaches.push('CI_DIRECT');
  if (isAgg) reaches.push('CI_AGGREGATED');
  if (isOther) reaches.push('CI_OTHER_COMMAND');
  const declaredNotCi = isHarness || isTool;
  if (declaredNotCi) reaches.push('NOT_CI_REQUIRED');

  let reach = null;
  if (reaches.length === 0) {
    fail(`SEM ALCANCE: ${f} — nao esta em CMDS, nem em agregador, nem em CI_OTHER_COMMAND, nem declarado NOT_CI_REQUIRED (regra 1/12: guard novo sem wiring/declaracao).`);
  } else if (reaches.length > 1) {
    // unica excecao permitida: CI_DIRECT + (o agregado ja foi excluido) — aqui nunca ha 2 CI reais
    // porque aggregatedExclusive exclui os diretos. Qualquer 2 alcances = conflito real.
    fail(`ALCANCE DUPLO: ${f} -> ${reaches.join(' + ')} (regra 2). NOT_CI_REQUIRED nao coexiste com CI.`);
    reach = reaches[0];
  } else {
    reach = reaches[0];
  }

  // ── papel ──
  const roles = [];
  if (isAggregatorRole) roles.push('AGGREGATOR');
  if (isHarness) roles.push('ONE_SHOT_HARNESS');
  if (isTool) roles.push('NON_GUARD_TOOL');
  let role = null;
  if (roles.length > 1) {
    fail(`PAPEL DUPLO: ${f} -> ${roles.join(' + ')} (regra 4).`);
    role = roles[0];
  } else if (roles.length === 1) {
    role = roles[0];
  } else {
    // nao declarado -> papel derivado: se tem alcance CI, e guard continuo
    if (reach === 'CI_DIRECT' || reach === 'CI_AGGREGATED' || reach === 'CI_OTHER_COMMAND') {
      role = 'CONTINUOUS_GUARD';
    } else {
      fail(`SEM PAPEL: ${f} — sem alcance de CI e sem papel declarado (regra 3).`);
    }
  }

  // ── coerencia entre eixos ──
  if (role === 'ONE_SHOT_HARNESS' && reach !== 'NOT_CI_REQUIRED') fail(`ONE_SHOT_HARNESS em CI: ${f} (alcance ${reach}) (regra 6).`);
  if (role === 'NON_GUARD_TOOL' && reach !== 'NOT_CI_REQUIRED') fail(`NON_GUARD_TOOL em CI continua: ${f} (alcance ${reach}) (regra 7).`);
  if (role === 'CONTINUOUS_GUARD' && reach === 'NOT_CI_REQUIRED') fail(`CONTINUOUS_GUARD em NOT_CI_REQUIRED: ${f} (regra 8).`);
  if (role === 'AGGREGATOR' && reach !== 'CI_DIRECT') fail(`AGGREGATOR fora de CI_DIRECT: ${f} (alcance ${reach}) (regra 9).`);

  rows.push({ file: f, reach, role });
}

// declaracao fantasma (regra 5): arquivo declarado que nao existe no universo/disco
for (const d of [...declaredAggregators, ...declaredHarness, ...declaredTool]) {
  if (!existsSync(join(SCRIPTS_DIR, d))) fail(`DECLARACAO FANTASMA: ${d} declarado mas inexistente no disco (regra 5).`);
}

// ─── 7. Numeros dinamicos ───────────────────────────────────────────────────────────────────────
const tally = { CI_DIRECT: 0, CI_AGGREGATED: 0, CI_OTHER_COMMAND: 0, NOT_CI_REQUIRED: 0 };
for (const r of rows) if (r.reach && tally[r.reach] !== undefined) tally[r.reach] += 1;
const roleTally = { CONTINUOUS_GUARD: 0, AGGREGATOR: 0, ONE_SHOT_HARNESS: 0, NON_GUARD_TOOL: 0 };
for (const r of rows) if (r.role && roleTally[r.role] !== undefined) roleTally[r.role] += 1;

const universeN = universe.length;
const continuousCovered = tally.CI_DIRECT + tally.CI_AGGREGATED + tally.CI_OTHER_COMMAND;
const noReach = rows.filter((r) => !r.reach).length;

console.log('── GUARD COVERAGE MANIFEST (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT · ROOT-003 R2) ──');
console.log(`  universo (audit-*.mjs|ts no disco) : ${universeN}`);
console.log(`  comandos no runner (CMDS.length)   : ${runnerCmdCount}  (inclui nao-audit; != guards efetivos)`);
console.log(`  CI_DIRECT                          : ${tally.CI_DIRECT}`);
console.log(`  CI_AGGREGATED (exclusivos)         : ${tally.CI_AGGREGATED}`);
console.log(`  CI_OTHER_COMMAND                   : ${tally.CI_OTHER_COMMAND}`);
console.log(`  NOT_CI_REQUIRED                    : ${tally.NOT_CI_REQUIRED}`);
console.log(`  ── papel: CONTINUOUS_GUARD=${roleTally.CONTINUOUS_GUARD} · AGGREGATOR=${roleTally.AGGREGATOR} · ONE_SHOT_HARNESS=${roleTally.ONE_SHOT_HARNESS} · NON_GUARD_TOOL=${roleTally.NON_GUARD_TOOL}`);
console.log(`  guards continuos efetivamente cobertos : ${continuousCovered}`);
console.log(`  arquivos SEM alcance (drift)       : ${noReach}`);
console.log(`  fechamento: ${tally.CI_DIRECT} + ${tally.CI_AGGREGATED} + ${tally.CI_OTHER_COMMAND} + ${tally.NOT_CI_REQUIRED} = ${tally.CI_DIRECT + tally.CI_AGGREGATED + tally.CI_OTHER_COMMAND + tally.NOT_CI_REQUIRED} (universo ${universeN})`);
if (doubleRun.length) {
  console.log(`  DUPLO-RUN direto+agregado (observacao, nao-falha): ${doubleRun.length}`);
  for (const d of doubleRun) console.log(`     · ${d}`);
}
for (const [agg, subs] of aggregatorSubMap) console.log(`  agregador ${agg}: ${subs.length} sub-guards`);

// fechamento aritmetico deve bater com o universo
if (tally.CI_DIRECT + tally.CI_AGGREGATED + tally.CI_OTHER_COMMAND + tally.NOT_CI_REQUIRED !== universeN) {
  fail(`fechamento aritmetico nao bate: soma dos alcances != universo (${universeN}).`);
}

if (failures.length) {
  console.error('\nGATE FAIL [guard-coverage-manifest]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\nGATE OK [guard-coverage-manifest] — todo audit-* tem exatamente um alcance e um papel; zero drift; ACTIVE_NOT_ENFORCED equivalente = 0 (nenhum CONTINUOUS_GUARD ficou fora de CI).');

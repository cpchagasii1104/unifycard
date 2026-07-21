#!/usr/bin/env node
// audit-guard-coverage-manifest.mjs
// F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT (ROOT-003 R2 · material · remediado pos-Yala B: R1+R2+R4).
//
// PROPOSITO: tornar VISIVEL a cobertura efetiva dos guards e FALHAR fechado em drift (guard novo
// sem wiring). NAO executa nenhum guard; NAO e um segundo runner; NAO e fonte de qualidade dos
// guards (isso vive no AUDIT-002). DERIVA o alcance das fontes de wiring reais (CMDS[] do runner,
// arrays dos 2 agregadores, e o contrato externo do actor-writer via package.json + workflows).
// A UNICA declaracao nova de alcance e guard-coverage-declarations.json, so para papeis
// nao-deriviveis (agregador / harness one-shot / ferramenta / comando externo).
//
// DOIS EIXOS INDEPENDENTES por arquivo audit-*.mjs|ts do disco:
//   Eixo alcance: CI_DIRECT | CI_AGGREGATED | CI_OTHER_COMMAND | NOT_CI_REQUIRED
//   Eixo papel:   CONTINUOUS_GUARD | AGGREGATOR | ONE_SHOT_HARNESS | NON_GUARD_TOOL
//
// R1 (honestidade): "audit files continuously reached" (todos com alcance CI) e reportado SEPARADO
//   de "continuous guards" (papel CONTINUOUS_GUARD). 276 reached != 274 continuous guards.
// R2 (CI_OTHER_COMMAND = ALL_THREE_REQUIRED): o actor-writer so conta se npm-script existir E os 3
//   workflows obrigatorios tiverem step ATIVO que roda o script (parser YAML estreito fail-closed).
// R4 (localizador estrutural): a declaracao de array e achada em CODIGO (mascara comentarios/strings);
//   zero ou ambigua => FAIL; decoy em comentario/string nao desvia.
//
// Le tudo como DADOS (readFileSync); NUNCA importa/executa runner, agregadores ou workflows.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = join(SCRIPTS_DIR, '..');
const REPO_DIR = join(BACKEND_DIR, '..');
const WF_DIR = join(REPO_DIR, '.github', 'workflows');

const failures = [];
const fail = (msg) => failures.push(msg);

function readOrDie(p, label) {
  if (!existsSync(p)) { fail(`fonte ausente (${label}): ${p} — fail-closed.`); return null; }
  try { return readFileSync(p, 'utf8'); } catch (e) { fail(`falha ao ler ${label}: ${p} — ${e.message}`); return null; }
}

// ─── R4: mascara comentarios (linha/bloco) e strings ('/"/`) com espacos, preservando indices. ──
function maskCode(src) {
  let out = ''; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { out += '  '; i += 2; while (i < n && src[i] !== '\n') { out += ' '; i += 1; } continue; }
    if (c === '/' && src[i + 1] === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1; }
      out += '  '; i += 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; out += ' '; i += 1;
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        if (src[i] === q) { out += ' '; i += 1; break; }
        out += src[i] === '\n' ? '\n' : ' '; i += 1;
      }
      continue;
    }
    out += c; i += 1;
  }
  return out;
}

// R4: encontra EXATAMENTE uma declaracao `const <name> = [` em codigo real; 0 ou >1 => FAIL.
function findSingleDeclBracket(source, name, label) {
  const masked = maskCode(source);
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[`, 'g');
  const idxs = [];
  let m;
  while ((m = re.exec(masked)) !== null) idxs.push(m.index);
  if (idxs.length === 0) { fail(`${label}: 'const ${name} = [' nao encontrado em CODIGO (R4: zero declaracoes) — fail-closed.`); return -1; }
  if (idxs.length > 1) { fail(`${label}: ${idxs.length} declaracoes de 'const ${name} = [' em codigo (R4: ambiguo) — fail-closed.`); return -1; }
  const bracket = source.indexOf('[', idxs[0]);
  if (bracket < 0) { fail(`${label}: '[' nao localizado apos a declaracao — fail-closed.`); return -1; }
  return bracket;
}

// Extrai literais de string do array a partir do indice do '[' (quote-aware + bracket-balanced).
function extractLiteralsFromBracket(source, bracketIdx, label) {
  let i = bracketIdx + 1; let depth = 1; const literals = []; const n = source.length;
  while (i < n && depth > 0) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (ch === '/' && source[i + 1] === '*') { i += 2; while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1; i += 2; continue; }
    if (ch === '[' || ch === '{' || ch === '(') { depth += 1; i += 1; continue; }
    if (ch === ']' || ch === '}' || ch === ')') { depth -= 1; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; i += 1; let buf = '';
      while (i < n) {
        const c = source[i];
        if (c === '\\') { buf += source[i + 1] ?? ''; i += 2; continue; }
        if (c === q) { i += 1; break; }
        buf += c; i += 1;
      }
      literals.push(buf); continue;
    }
    i += 1;
  }
  if (depth !== 0) { fail(`${label}: colchetes nao balanceados — fail-closed.`); return null; }
  return literals;
}

function arrayLiterals(source, name, label) {
  const b = findSingleDeclBracket(source, name, label);
  if (b < 0) return null;
  return extractLiteralsFromBracket(source, b, label);
}

function auditFileFromToken(token) {
  const m = token.match(/(audit-[A-Za-z0-9_.-]+\.(?:mjs|ts|js))/);
  return m ? m[1] : null;
}

// ─── R2: parser YAML estreito, indent-aware, fail-closed, para steps de GitHub Actions ──────────
function stripYamlComments(text) {
  return text.split('\n').map((line) => {
    let inS = false, inD = false, out = '';
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === "'" && !inD) inS = !inS;
      else if (c === '"' && !inS) inD = !inD;
      if (c === '#' && !inS && !inD) break;
      out += c;
    }
    return out;
  }).join('\n');
}
const indentOf = (line) => (line.match(/^(\s*)/)[1].length);
function hasOnTrigger(text) {
  return stripYamlComments(text).split('\n').some((l) => /^on:\s*(\S.*)?$/.test(l) || /^on:\s*$/.test(l));
}
function extractSteps(lines) {
  const steps = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)steps:\s*$/);
    if (!m) continue;
    const sIndent = m[1].length;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j += 1;
    const im = j < lines.length ? lines[j].match(/^(\s*)-\s/) : null;
    if (!im || im[1].length <= sIndent) continue;
    const itemIndent = im[1].length;
    let k = j; let cur = null;
    while (k < lines.length) {
      const line = lines[k];
      if (line.trim() !== '') {
        const ind = indentOf(line);
        if (ind <= sIndent) break;
        if (/^(\s*)-\s/.test(line) && ind === itemIndent) { if (cur) steps.push(cur); cur = { lines: [] }; }
        if (cur) cur.lines.push(line);
      }
      k += 1;
    }
    if (cur) steps.push(cur);
    i = k - 1;
  }
  return steps;
}
function stepFields(step) {
  const f = { run: [], coe: null, if: null };
  let inRun = false, runInd = null;
  for (let idx = 0; idx < step.lines.length; idx += 1) {
    let line = step.lines[idx];
    if (idx === 0) line = line.replace(/^(\s*)-\s/, (mm, sp) => sp + '  ');
    const ind = indentOf(line); const t = line.trim();
    if (inRun) { if (t !== '' && ind <= runInd) inRun = false; else { f.run.push(t); continue; } }
    const kv = t.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!kv) continue;
    const key = kv[1]; const val = kv[2];
    if (key === 'run') { if (['|', '>', '|-', '>-', '|+', '>+'].includes(val.trim())) { inRun = true; runInd = ind; } else f.run.push(val); }
    else if (key === 'continue-on-error') f.coe = val.trim();
    else if (key === 'if') f.if = val.trim();
  }
  return f;
}
function workflowActivelyRuns(text, npmScript, wfLabel) {
  if (!hasOnTrigger(text)) return { ok: false, reason: `${wfLabel}: sem gatilho 'on:' reconhecivel (fail-closed).` };
  const lines = stripYamlComments(text).split('\n');
  const steps = extractSteps(lines);
  if (steps.length === 0) return { ok: false, reason: `${wfLabel}: nenhum step reconhecido (fail-closed).` };
  const tokenRe = new RegExp('(^|\\s)' + npmScript.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$|&|;|"|\')');
  for (const s of steps) {
    const f = stepFields(s);
    const runText = f.run.join(' ');
    if (!tokenRe.test(runText)) continue;      // so conta em run:, nunca em name:/comentario
    if (f.coe === 'true') continue;            // continue-on-error: true invalida
    if (f.if !== null) { const ic = f.if.replace(/\s/g, ''); if (ic === 'false' || ic === '${{false}}') continue; } // if literalmente falso
    return { ok: true };
  }
  return { ok: false, reason: `${wfLabel}: nenhum step ATIVO executa '${npmScript}'.` };
}

// ─── 1. UNIVERSO ────────────────────────────────────────────────────────────────────────────────
const universe = readdirSync(SCRIPTS_DIR).filter((f) => /^audit-.+\.(mjs|ts)$/.test(f)).sort();

// ─── 2. Declaracoes (papeis nao-deriviveis + contrato de comandos externos) ─────────────────────
const declRaw = readOrDie(join(SCRIPTS_DIR, 'guard-coverage-declarations.json'), 'declaracoes');
let decl = null;
if (declRaw) { try { decl = JSON.parse(declRaw); } catch (e) { fail(`guard-coverage-declarations.json invalido: ${e.message}`); } }
const declaredAggregators = new Set(decl?.aggregators ?? []);
const declaredHarness = new Set(decl?.one_shot_harness ?? []);
const declaredTool = new Set(decl?.non_guard_tool ?? []);
const externalCommands = Array.isArray(decl?.external_commands) ? decl.external_commands : [];

// ─── 3. CI_DIRECT: CMDS[] do runner ─────────────────────────────────────────────────────────────
const runnerSrc = readOrDie(join(SCRIPTS_DIR, 'run-regression-guards.mjs'), 'runner');
const directSet = new Set();
let runnerCmdCount = 0;
if (runnerSrc) {
  const cmds = arrayLiterals(runnerSrc, 'CMDS', 'runner CMDS');
  if (cmds) {
    runnerCmdCount = cmds.length;
    for (const c of cmds) { const f = auditFileFromToken(c); if (f && /\.(mjs|ts)$/.test(f)) directSet.add(f); }
  }
}

// ─── 4. CI_AGGREGATED: arrays reais dos agregadores declarados ──────────────────────────────────
const aggregatedSet = new Set();
const aggregatorSubMap = new Map();
for (const agg of declaredAggregators) {
  const aggPath = join(SCRIPTS_DIR, agg);
  if (!existsSync(aggPath)) { fail(`agregador declarado inexistente: ${agg} (R5).`); continue; }
  if (!directSet.has(agg)) fail(`agregador ${agg} declarado mas NAO esta no CMDS[] (regra 9).`);
  const aggSrc = readOrDie(aggPath, `agregador ${agg}`);
  if (!aggSrc) continue;
  const subs = arrayLiterals(aggSrc, 'guards', `agregador ${agg}`);
  if (!subs) continue;
  const list = [];
  for (const s of subs) {
    const f = auditFileFromToken(s) || (/^audit-.+\.(mjs|ts)$/.test(s) ? s : null);
    if (!f) continue;
    if (!existsSync(join(SCRIPTS_DIR, f))) fail(`agregador ${agg}: sub-guard inexistente: ${f} (regra 10).`);
    aggregatedSet.add(f); list.push(f);
  }
  aggregatorSubMap.set(agg, list);
}

// ─── 5. CI_OTHER_COMMAND: contrato ALL_THREE_REQUIRED via external_commands ─────────────────────
const otherSet = new Set();
const pkgSrc = readOrDie(join(BACKEND_DIR, 'package.json'), 'package.json');
let pkg = null;
if (pkgSrc) { try { pkg = JSON.parse(pkgSrc); } catch (e) { fail(`package.json invalido: ${e.message}`); } }
for (const ext of externalCommands) {
  const auditFile = ext.audit_file; const npmScript = ext.npm_script; const reqWfs = ext.required_workflows ?? [];
  if (!auditFile || !npmScript || reqWfs.length === 0) { fail(`external_commands: entrada incompleta ${JSON.stringify(ext)} (fail-closed).`); continue; }
  const scriptVal = pkg?.scripts?.[npmScript];
  if (!scriptVal) { fail(`regra 10: npm-script '${npmScript}' ausente em package.json (CI_OTHER_COMMAND quebrado).`); continue; }
  if (!scriptVal.includes(auditFile)) { fail(`external_commands: npm-script '${npmScript}' nao executa ${auditFile} (aponta: ${scriptVal}).`); continue; }
  let allOk = true;
  for (const wf of reqWfs) {
    const wfPath = join(WF_DIR, wf);
    if (!existsSync(wfPath)) { fail(`workflow obrigatorio ausente: ${wf} (fail-closed).`); allOk = false; continue; }
    const wfSrc = readOrDie(wfPath, `workflow ${wf}`);
    if (!wfSrc) { allOk = false; continue; }
    const res = workflowActivelyRuns(wfSrc, npmScript, wf);
    if (!res.ok) { fail(res.reason); allOk = false; }
  }
  if (allOk) otherSet.add(auditFile);
}

// ─── 6. Duplo-run direto+agregado: observacao (nao-falha) ───────────────────────────────────────
const doubleRun = [...aggregatedSet].filter((f) => directSet.has(f)).sort();
const aggregatedExclusive = new Set([...aggregatedSet].filter((f) => !directSet.has(f)));

// ─── 7. Classificar cada arquivo (alcance, papel), fail-closed ──────────────────────────────────
const rows = [];
for (const f of universe) {
  const isDirect = directSet.has(f);
  const isAgg = aggregatedExclusive.has(f);
  const isOther = otherSet.has(f);
  const isAggRole = declaredAggregators.has(f);
  const isHarness = declaredHarness.has(f);
  const isTool = declaredTool.has(f);

  const reaches = [];
  if (isDirect) reaches.push('CI_DIRECT');
  if (isAgg) reaches.push('CI_AGGREGATED');
  if (isOther) reaches.push('CI_OTHER_COMMAND');
  if (isHarness || isTool) reaches.push('NOT_CI_REQUIRED');

  let reach = null;
  if (reaches.length === 0) fail(`SEM ALCANCE: ${f} — sem wiring e sem declaracao NOT_CI_REQUIRED (regra 1/12).`);
  else if (reaches.length > 1) { fail(`ALCANCE DUPLO: ${f} -> ${reaches.join(' + ')} (regra 2). NOT_CI_REQUIRED nao coexiste com CI; CI_DIRECT+CI_OTHER nao permitido.`); reach = reaches[0]; }
  else reach = reaches[0];

  const roles = [];
  if (isAggRole) roles.push('AGGREGATOR');
  if (isHarness) roles.push('ONE_SHOT_HARNESS');
  if (isTool) roles.push('NON_GUARD_TOOL');
  let role = null;
  if (roles.length > 1) { fail(`PAPEL DUPLO: ${f} -> ${roles.join(' + ')} (regra 4).`); role = roles[0]; }
  else if (roles.length === 1) role = roles[0];
  else if (reach === 'CI_DIRECT' || reach === 'CI_AGGREGATED' || reach === 'CI_OTHER_COMMAND') role = 'CONTINUOUS_GUARD';
  else fail(`SEM PAPEL: ${f} — sem alcance CI e sem papel declarado (regra 3).`);

  if (role === 'ONE_SHOT_HARNESS' && reach !== 'NOT_CI_REQUIRED') fail(`ONE_SHOT_HARNESS em CI: ${f} (${reach}) (regra 6).`);
  if (role === 'NON_GUARD_TOOL' && reach !== 'NOT_CI_REQUIRED') fail(`NON_GUARD_TOOL em CI: ${f} (${reach}) (regra 7).`);
  if (role === 'CONTINUOUS_GUARD' && reach === 'NOT_CI_REQUIRED') fail(`CONTINUOUS_GUARD em NOT_CI_REQUIRED: ${f} (regra 8).`);
  if (role === 'AGGREGATOR' && reach !== 'CI_DIRECT') fail(`AGGREGATOR fora de CI_DIRECT: ${f} (${reach}) (regra 9).`);

  rows.push({ file: f, reach, role });
}
for (const d of [...declaredAggregators, ...declaredHarness, ...declaredTool]) {
  if (!existsSync(join(SCRIPTS_DIR, d))) fail(`DECLARACAO FANTASMA: ${d} declarado mas inexistente (regra 5).`);
}

// ─── 8. Numeros dinamicos (R1: reached != continuous guards) ────────────────────────────────────
const reach = { CI_DIRECT: 0, CI_AGGREGATED: 0, CI_OTHER_COMMAND: 0, NOT_CI_REQUIRED: 0 };
const roleT = { CONTINUOUS_GUARD: 0, AGGREGATOR: 0, ONE_SHOT_HARNESS: 0, NON_GUARD_TOOL: 0 };
for (const r of rows) { if (r.reach && reach[r.reach] !== undefined) reach[r.reach] += 1; if (r.role && roleT[r.role] !== undefined) roleT[r.role] += 1; }
const universeN = universe.length;
const continuouslyReached = reach.CI_DIRECT + reach.CI_AGGREGATED + reach.CI_OTHER_COMMAND;
const noReach = rows.filter((r) => !r.reach).length;

console.log('── GUARD COVERAGE MANIFEST (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT · ROOT-003 R2) ──');
console.log(`  UNIVERSE (audit-*.mjs|ts no disco)   : ${universeN}`);
console.log(`  RUNNER COMMANDS (CMDS.length)        : ${runnerCmdCount}  (inclui nao-audit + agregadores; != guards)`);
console.log(`  AUDIT FILES CONTINUOUSLY REACHED     : ${continuouslyReached}   (CI_DIRECT+CI_AGGREGATED+CI_OTHER_COMMAND)`);
console.log(`  CONTINUOUS GUARDS                    : ${roleT.CONTINUOUS_GUARD}   (papel CONTINUOUS_GUARD)`);
console.log(`  AGGREGATORS                          : ${roleT.AGGREGATOR}`);
console.log(`  ONE-SHOT HARNESSES                   : ${roleT.ONE_SHOT_HARNESS}`);
console.log(`  NON-GUARD TOOLS                      : ${roleT.NON_GUARD_TOOL}`);
console.log(`  NOT CI REQUIRED                      : ${reach.NOT_CI_REQUIRED}`);
console.log(`  SEM ALCANCE (drift)                  : ${noReach}`);
console.log(`  ── alcance: CI_DIRECT=${reach.CI_DIRECT} · CI_AGGREGATED=${reach.CI_AGGREGATED} · CI_OTHER_COMMAND=${reach.CI_OTHER_COMMAND} · NOT_CI_REQUIRED=${reach.NOT_CI_REQUIRED}`);
console.log(`  fechamento alcance: ${reach.CI_DIRECT}+${reach.CI_AGGREGATED}+${reach.CI_OTHER_COMMAND}+${reach.NOT_CI_REQUIRED}=${reach.CI_DIRECT + reach.CI_AGGREGATED + reach.CI_OTHER_COMMAND + reach.NOT_CI_REQUIRED} (universo ${universeN})`);
console.log(`  fechamento papel: ${roleT.CONTINUOUS_GUARD}+${roleT.AGGREGATOR}+${roleT.ONE_SHOT_HARNESS}+${roleT.NON_GUARD_TOOL}=${roleT.CONTINUOUS_GUARD + roleT.AGGREGATOR + roleT.ONE_SHOT_HARNESS + roleT.NON_GUARD_TOOL} (universo ${universeN})`);
console.log(`  reached = continuous guards + aggregators: ${roleT.CONTINUOUS_GUARD}+${roleT.AGGREGATOR}=${roleT.CONTINUOUS_GUARD + roleT.AGGREGATOR} (== ${continuouslyReached} reached)`);
if (doubleRun.length) { console.log(`  DUPLO-RUN direto+agregado (observacao, nao-falha): ${doubleRun.length}`); for (const d of doubleRun) console.log(`     · ${d}`); }
for (const [agg, subs] of aggregatorSubMap) console.log(`  agregador ${agg}: ${subs.length} sub-guards`);

if (reach.CI_DIRECT + reach.CI_AGGREGATED + reach.CI_OTHER_COMMAND + reach.NOT_CI_REQUIRED !== universeN) fail(`fechamento de alcance != universo (${universeN}).`);
if (roleT.CONTINUOUS_GUARD + roleT.AGGREGATOR + roleT.ONE_SHOT_HARNESS + roleT.NON_GUARD_TOOL !== universeN) fail(`fechamento de papel != universo (${universeN}).`);
if (roleT.CONTINUOUS_GUARD + roleT.AGGREGATOR !== continuouslyReached) fail(`reached (${continuouslyReached}) != continuous guards + aggregators (${roleT.CONTINUOUS_GUARD + roleT.AGGREGATOR}).`);

if (failures.length) {
  console.error('\nGATE FAIL [guard-coverage-manifest]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\nGATE OK [guard-coverage-manifest] — todo audit-* tem exatamente um alcance e um papel; zero drift; nenhum CONTINUOUS_GUARD fora de CI (ACTIVE_NOT_ENFORCED equivalente = 0).');

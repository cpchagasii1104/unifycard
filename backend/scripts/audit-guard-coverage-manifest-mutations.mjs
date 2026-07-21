#!/usr/bin/env node
// audit-guard-coverage-manifest-mutations.mjs
// HARNESS ONE-SHOT (ONE_SHOT_HARNESS · NOT_CI_REQUIRED) — prova que audit-guard-coverage-manifest.mjs
// MORDE os vetores de drift/honestidade/self-wiring/parser. NAO e guard continuo; NAO entra no runner;
// e declarado no guard-coverage-declarations.json. NAO altera nenhum arquivo tracked real: monta
// scaffolds minimos em diretorio temporario descartavel e roda o meta-guard/runner COPIADOS.
//
// Cenarios: M1-M7 (drift/papel), M8 (rotulos honestos R1), M9a-c (workflow obrigatorio R2),
// M10 (comentario R2), M11 (continue-on-error R2), M12 (self-wiring R3 = Y1), M13 (decoy parser R4),
// M14 (ambiguidade R4), M15 (benigno), Y1/Y2/Y3 (self-wiring runner + meta-guard direto).

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const META = join(SELF_DIR, 'audit-guard-coverage-manifest.mjs');
const RUNNER = join(SELF_DIR, 'run-regression-guards.mjs');

const results = [];
const record = (name, expected, got, note) => {
  const ok = expected === got;
  results.push({ name, ok });
  console.log(`  ${ok ? 'OK ' : 'FAIL'} ${name}: esperado=${expected} obtido=${got}${note ? ' · ' + note : ''}`);
};

// ── scaffold do META-GUARD (com workflows + external_commands) ──────────────────────────────────
const WF_OK = 'on:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - name: aw\n        run: pnpm run validate:aw\n';
function buildMeta(ov = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gcov-'));
  const backend = join(root, 'backend'); const scripts = join(backend, 'scripts');
  const wfDir = join(root, '.github', 'workflows');
  mkdirSync(scripts, { recursive: true }); mkdirSync(wfDir, { recursive: true });
  if (ov.metaAsStub) writeFileSync(join(scripts, 'audit-guard-coverage-manifest.mjs'), 'process.exit(0);\n');
  else copyFileSync(META, join(scripts, 'audit-guard-coverage-manifest.mjs'));

  const cmds = ov.cmds ?? ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'];
  const runnerText = ov.runnerText ?? ('const CMDS = [\n' + cmds.map((c) => `  "${c}",`).join('\n') + '\n];\n');
  writeFileSync(join(scripts, 'run-regression-guards.mjs'), runnerText);

  const aggSubs = ov.aggSubs ?? ['audit-beta.mjs'];
  writeFileSync(join(scripts, 'audit-agg.mjs'), 'const guards = [\n' + aggSubs.map((s) => `  '${s}',`).join('\n') + '\n];\n');

  const decl = ov.decl ?? {
    aggregators: ['audit-agg.mjs'],
    one_shot_harness: ['audit-hh-mutations.mjs'],
    non_guard_tool: ['audit-tool.ts'],
    external_commands: [{ audit_file: 'audit-aw.mjs', npm_script: 'validate:aw', required_workflows: ['wf1.yml', 'wf2.yml', 'wf3.yml'] }],
  };
  writeFileSync(join(scripts, 'guard-coverage-declarations.json'), JSON.stringify(decl, null, 2));

  const diskFiles = ov.diskFiles ?? ['audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs', 'audit-aw.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts'];
  for (const f of diskFiles) { if (f === 'audit-agg.mjs') continue; writeFileSync(join(scripts, f), '// stub\n'); }

  const pkg = ov.pkg ?? { scripts: { 'validate:aw': 'node scripts/audit-aw.mjs' } };
  writeFileSync(join(backend, 'package.json'), JSON.stringify(pkg, null, 2));

  const wf = ov.workflows ?? { 'wf1.yml': WF_OK, 'wf2.yml': WF_OK, 'wf3.yml': WF_OK };
  for (const [name, body] of Object.entries(wf)) writeFileSync(join(wfDir, name), body);

  return { root, scripts };
}
function runMeta(scripts) {
  const r = spawnSync(process.execPath, [join(scripts, 'audit-guard-coverage-manifest.mjs')], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '' };
}
function metaScenario(name, expectExit, ov) {
  const { root, scripts } = buildMeta(ov);
  try { const r = runMeta(scripts); record(name, expectExit === 0 ? 'PASS' : 'FAIL', r.status === 0 ? 'PASS' : 'FAIL'); return r; }
  finally { rmSync(root, { recursive: true, force: true }); }
}

// ── scaffold do RUNNER (self-wiring) ────────────────────────────────────────────────────────────
function buildRunner(ov = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gcovr-'));
  const backend = join(root, 'backend'); const scripts = join(backend, 'scripts');
  mkdirSync(scripts, { recursive: true });
  writeFileSync(join(scripts, 'audit-stub.mjs'), 'process.exit(0);\n');
  if (ov.metaPresent !== false) writeFileSync(join(scripts, 'audit-guard-coverage-manifest.mjs'), 'process.exit(0);\n');
  const cmds = ov.cmds ?? ['node scripts/audit-stub.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'];
  const text = 'import { spawnSync } from "child_process";\n'
    + 'const CMDS = [\n' + cmds.map((c) => `  "${c}",`).join('\n') + '\n];\n'
    + 'const COVERAGE_GUARD_CMD = "scripts/audit-guard-coverage-manifest.mjs";\n'
    + 'const coverageWiring = CMDS.filter((c) => c.includes(COVERAGE_GUARD_CMD)).length;\n'
    + 'if (coverageWiring !== 1) { console.error("self-wiring FAIL " + coverageWiring); process.exit(1); }\n'
    + 'for (const c of CMDS) { const [bin, ...args] = c.split(/\\s+/); const r = spawnSync(bin, args, { stdio: "inherit", shell: true }); if (r.status !== 0) { process.exit(r.status || 1); } }\n'
    + 'console.log("RUNNER OK");\n';
  writeFileSync(join(scripts, 'run-regression-guards.mjs'), text);
  return { root, backend, scripts };
}
function runRunner(backend, scripts) {
  const r = spawnSync(process.execPath, [join(scripts, 'run-regression-guards.mjs')], { encoding: 'utf8', cwd: backend });
  return r.status;
}
function runnerScenario(name, expectExit, ov) {
  const { root, backend, scripts } = buildRunner(ov);
  try { const code = runRunner(backend, scripts); record(name, expectExit === 0 ? 'PASS' : 'FAIL', code === 0 ? 'PASS' : 'FAIL'); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

console.log('── audit-guard-coverage-manifest-mutations (harness one-shot, temp scaffold) ──');

// ── M1-M7 (drift / papel) ──
metaScenario('M7 controle benigno (guard novo corretamente ligado)', 0, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-newguard.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'],
  diskFiles: ['audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs', 'audit-newguard.mjs', 'audit-aw.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts'],
});
metaScenario('M1 guard novo invisivel (sem wiring)', 1, {
  diskFiles: ['audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs', 'audit-fake-unwired.mjs', 'audit-aw.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts'],
});
metaScenario('M2 declaracao fantasma (arquivo inexistente)', 1, {
  decl: { aggregators: ['audit-agg.mjs'], one_shot_harness: ['audit-hh-mutations.mjs', 'audit-ghost.mjs'], non_guard_tool: ['audit-tool.ts'], external_commands: [{ audit_file: 'audit-aw.mjs', npm_script: 'validate:aw', required_workflows: ['wf1.yml', 'wf2.yml', 'wf3.yml'] }] },
});
metaScenario('M3 one-shot no runner', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-hh-mutations.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'],
});
metaScenario('M4 sub-guard removido do agregador (fica sem alcance)', 1, { aggSubs: [] });
metaScenario('M5 non-guard tool na CI continua', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-tool.ts', 'node scripts/audit-guard-coverage-manifest.mjs'],
});
metaScenario('M6 agregador sem entrada direta no runner', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'],
});

// ── M8 rotulos honestos (R1) ──
{
  const { root, scripts } = buildMeta({});
  try {
    const r = runMeta(scripts);
    const cg = (r.stdout.match(/CONTINUOUS GUARDS\s+:\s+(\d+)/) || [])[1];
    const ag = (r.stdout.match(/AGGREGATORS\s+:\s+(\d+)/) || [])[1];
    const reached = (r.stdout.match(/AUDIT FILES CONTINUOUSLY REACHED\s+:\s+(\d+)/) || [])[1];
    const identityOk = cg && ag && reached && (Number(cg) + Number(ag) === Number(reached));
    const notMislabeled = !/CONTINUOUS GUARDS\s+:\s+/.test('') && r.stdout.includes('AUDIT FILES CONTINUOUSLY REACHED') && r.stdout.includes('CONTINUOUS GUARDS');
    record('M8 rotulos honestos (reached != continuous guards; identidade fecha)', 'OK', (r.status === 0 && identityOk && notMislabeled && cg !== reached) ? 'OK' : 'BAD',
      `continuous=${cg} aggregators=${ag} reached=${reached}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ── M9a-c workflow obrigatorio: step nao roda o script em wfX -> FAIL ──
const WF_NO = 'on:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - name: aw\n        run: pnpm run typecheck\n';
metaScenario('M9a workflow wf1 sem step ativo do script', 1, { workflows: { 'wf1.yml': WF_NO, 'wf2.yml': WF_OK, 'wf3.yml': WF_OK } });
metaScenario('M9b workflow wf2 sem step ativo do script', 1, { workflows: { 'wf1.yml': WF_OK, 'wf2.yml': WF_NO, 'wf3.yml': WF_OK } });
metaScenario('M9c workflow wf3 sem step ativo do script', 1, { workflows: { 'wf1.yml': WF_OK, 'wf2.yml': WF_OK, 'wf3.yml': WF_NO } });

// ── M10 ocorrencia so em comentario -> FAIL ──
const WF_COMMENT = 'on:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - name: aw\n        # run: pnpm run validate:aw\n        run: pnpm run typecheck\n';
metaScenario('M10 script so em comentario (nao conta)', 1, { workflows: { 'wf1.yml': WF_COMMENT, 'wf2.yml': WF_OK, 'wf3.yml': WF_OK } });

// ── M11 continue-on-error: true invalida o step -> FAIL ──
const WF_COE = 'on:\n  push:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - name: aw\n        continue-on-error: true\n        run: pnpm run validate:aw\n';
metaScenario('M11 continue-on-error true invalida', 1, { workflows: { 'wf1.yml': WF_COE, 'wf2.yml': WF_OK, 'wf3.yml': WF_OK } });

// ── M12 self-wiring (= Y1): remover entrada do meta-guard no runner -> FAIL ──
runnerScenario('M12 self-wiring: entrada do meta-guard removida', 1, { cmds: ['node scripts/audit-stub.mjs'] });

// ── M13 decoy de parser: falso "const CMDS = [" em comentario/string/template -> ainda acha o real ──
{
  const decoyRunner =
    '// const CMDS = [ "node scripts/audit-DECOY.mjs" ]\n' +
    'const s = "const CMDS = [ decoy ]";\n' +
    'const t = `const CMDS = [ decoy2 ]`;\n' +
    'const CMDS = [\n  "node scripts/audit-alpha.mjs",\n  "node scripts/audit-agg.mjs",\n  "node scripts/audit-guard-coverage-manifest.mjs",\n];\n';
  metaScenario('M13 decoy de parser (comentario/string/template)', 0, { runnerText: decoyRunner });
}

// ── M14 ambiguidade real: duas declaracoes estruturais de CMDS -> FAIL ──
{
  const ambigRunner =
    'const CMDS = [\n  "node scripts/audit-alpha.mjs",\n  "node scripts/audit-guard-coverage-manifest.mjs",\n];\n' +
    'const CMDS = [\n  "node scripts/audit-agg.mjs",\n];\n';
  metaScenario('M14 ambiguidade (duas declaracoes reais de CMDS)', 1, { runnerText: ambigRunner });
}

// ── M15 controle benigno: whitespace, virgula final, comentarios entre itens -> PASS ──
{
  const benignRunner =
    'const CMDS = [\n' +
    '   "node scripts/audit-alpha.mjs" ,  // guard alpha\n' +
    '\n' +
    '  "node scripts/audit-agg.mjs",\n' +
    '  /* bloco */ "node scripts/audit-guard-coverage-manifest.mjs" ,\n' +
    '];\n';
  metaScenario('M15 benigno (whitespace/virgula final/comentarios)', 0, { runnerText: benignRunner });
}

// ── Y1 (runner): remover so a entrada do meta-guard -> FAIL (self-wiring) ──
runnerScenario('Y1 runner: so a entrada do meta-guard removida', 1, { cmds: ['node scripts/audit-stub.mjs'] });
// ── Y2 (runner): entrada presente, arquivo fisico removido -> FAIL (loop nao spawna) ──
runnerScenario('Y2 runner: entrada presente, arquivo do meta-guard ausente', 1, { metaPresent: false });
// ── Y3 (meta-guard direto): entrada removida do CMDS, meta-guard nao se ve alcancado -> FAIL ──
metaScenario('Y3 meta-guard direto: sem propria entrada no CMDS', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs'],
});
// ── controle benigno do runner: tudo certo -> PASS ──
runnerScenario('R-benigno runner: entrada presente + arquivo presente', 0, {});

const allOk = results.every((r) => r.ok);
console.log(`\n${allOk ? 'HARNESS OK' : 'HARNESS FAIL'} — ${results.filter((r) => r.ok).length}/${results.length} cenarios como esperado.`);
process.exit(allOk ? 0 : 1);

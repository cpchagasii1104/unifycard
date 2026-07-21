#!/usr/bin/env node
// audit-guard-coverage-manifest-mutations.mjs
// HARNESS ONE-SHOT (ONE_SHOT_HARNESS · NOT_CI_REQUIRED) — prova que audit-guard-coverage-manifest.mjs
// MORDE os vetores de drift. NAO e um guard continuo; NAO entra no runner; e declarado no
// guard-coverage-declarations.json. NAO altera nenhum arquivo tracked do working tree real: monta um
// scaffold minimo num diretorio temporario descartavel e roda o meta-guard COPIADO contra ele.
//
// Prova M1..M7 (ver GO F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT).

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const META = join(SELF_DIR, 'audit-guard-coverage-manifest.mjs');

const results = [];
const record = (name, expected, got) => {
  const ok = expected === got;
  results.push({ name, expected, got, ok });
  console.log(`  ${ok ? 'OK ' : 'FAIL'} ${name}: esperado=${expected} obtido=${got}`);
};

// Monta um scaffold minimo temp/backend/scripts + temp/backend/package.json + temp/.github/workflows.
// `overrides` permite mutar cada peca por cenario.
function buildScaffold(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gcov-'));
  const backend = join(root, 'backend');
  const scripts = join(backend, 'scripts');
  const wfDir = join(root, '.github', 'workflows');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(wfDir, { recursive: true });

  // meta-guard real (copiado)
  copyFileSync(META, join(scripts, 'audit-guard-coverage-manifest.mjs'));

  // conjunto base coerente. NOTA: audit-actor-writer-boundaries.mjs NAO entra no CMDS — ele e
  // CI_OTHER_COMMAND (derivado de package.json + workflow), nunca entrada direta do runner. Coloca-lo
  // no CMDS seria alcance-duplo (CI_DIRECT + CI_OTHER_COMMAND), que o meta-guard corretamente rejeita.
  const cmds = overrides.cmds ?? [
    'node scripts/audit-alpha.mjs',
    'node scripts/audit-agg.mjs',
    'node scripts/audit-guard-coverage-manifest.mjs',
  ];
  const aggSubs = overrides.aggSubs ?? ['audit-beta.mjs'];
  const decl = overrides.decl ?? {
    aggregators: ['audit-agg.mjs'],
    one_shot_harness: ['audit-hh-mutations.mjs'],
    non_guard_tool: ['audit-tool.ts'],
  };
  const diskFiles = overrides.diskFiles ?? [
    'audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs',
    'audit-actor-writer-boundaries.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts',
  ];
  const pkgHasScript = overrides.pkgHasScript ?? true;
  const wfHasCall = overrides.wfHasCall ?? true;

  // runner fake
  writeFileSync(join(scripts, 'run-regression-guards.mjs'),
    'const CMDS = [\n' + cmds.map((c) => `  "${c}",`).join('\n') + '\n];\n');
  // agregador fake
  writeFileSync(join(scripts, 'audit-agg.mjs'),
    'const guards = [\n' + aggSubs.map((s) => `  '${s}',`).join('\n') + '\n];\n');
  // declaracoes
  writeFileSync(join(scripts, 'guard-coverage-declarations.json'), JSON.stringify(decl, null, 2));
  // stubs no disco (exceto agg e meta que ja existem)
  for (const f of diskFiles) {
    if (f === 'audit-agg.mjs') continue;
    writeFileSync(join(scripts, f), '// stub\n');
  }
  // package.json
  const pkg = { scripts: {} };
  if (pkgHasScript) pkg.scripts['validate:actor-writer-boundaries'] = 'node scripts/audit-actor-writer-boundaries.mjs';
  writeFileSync(join(backend, 'package.json'), JSON.stringify(pkg, null, 2));
  // workflow
  writeFileSync(join(wfDir, 'backend-ci.yml'),
    wfHasCall ? 'steps:\n  - run: pnpm run validate:actor-writer-boundaries\n' : 'steps:\n  - run: pnpm run typecheck\n');

  return { root, scripts };
}

function runMeta(scripts) {
  const r = spawnSync(process.execPath, [join(scripts, 'audit-guard-coverage-manifest.mjs')],
    { encoding: 'utf8' });
  return r.status;
}

function scenario(name, expectedExit, overrides) {
  const { root, scripts } = buildScaffold(overrides);
  try {
    const code = runMeta(scripts);
    record(name, expectedExit === 0 ? 'PASS' : 'FAIL', code === 0 ? 'PASS' : 'FAIL');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log('── audit-guard-coverage-manifest-mutations (harness one-shot, temp scaffold) ──');

// M7 — controle benigno: guard novo adicionado corretamente ao runner + disco -> PASS
scenario('M7 controle benigno (guard novo corretamente ligado)', 0, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-newguard.mjs',
         'node scripts/audit-guard-coverage-manifest.mjs'],
  diskFiles: ['audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs', 'audit-newguard.mjs',
              'audit-actor-writer-boundaries.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts'],
});

// M1 — guard novo invisivel: no disco mas sem wiring/declaracao -> FAIL
scenario('M1 guard novo invisivel (sem wiring)', 1, {
  diskFiles: ['audit-alpha.mjs', 'audit-agg.mjs', 'audit-beta.mjs', 'audit-fake-unwired.mjs',
              'audit-actor-writer-boundaries.mjs', 'audit-hh-mutations.mjs', 'audit-tool.ts'],
});

// M2 — declaracao fantasma: declara arquivo inexistente -> FAIL
scenario('M2 declaracao fantasma (arquivo inexistente)', 1, {
  decl: { aggregators: ['audit-agg.mjs'], one_shot_harness: ['audit-hh-mutations.mjs', 'audit-ghost.mjs'], non_guard_tool: ['audit-tool.ts'] },
});

// M3 — one-shot no runner: harness declarado tambem no CMDS -> FAIL
scenario('M3 one-shot no runner', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-hh-mutations.mjs',
         'node scripts/audit-guard-coverage-manifest.mjs'],
});

// M4 — sub-guard removido do agregador: audit-beta fica sem alcance -> FAIL
scenario('M4 sub-guard removido do agregador (fica sem alcance)', 1, {
  aggSubs: [], // agregador vazio; audit-beta.mjs continua no disco sem reach
});

// M5 — non-guard tool na CI: audit-tool.ts no runner -> FAIL
scenario('M5 non-guard tool na CI continua', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-agg.mjs', 'node scripts/audit-tool.ts',
         'node scripts/audit-guard-coverage-manifest.mjs'],
});

// M6 — agregador sem alcance direto: removido do CMDS mas mantido como papel declarado -> FAIL
scenario('M6 agregador sem entrada direta no runner', 1, {
  cmds: ['node scripts/audit-alpha.mjs', 'node scripts/audit-guard-coverage-manifest.mjs'],
});

const allOk = results.every((r) => r.ok);
console.log(`\n${allOk ? 'HARNESS OK' : 'HARNESS FAIL'} — ${results.filter((r) => r.ok).length}/${results.length} cenarios como esperado.`);
process.exit(allOk ? 0 : 1);

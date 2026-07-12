#!/usr/bin/env node
// Testes da ferramenta de segurança worktree-safety.mjs — F-REPOSITORY-DEPENDENCY-HYGIENE.
// Fixtures em diretório temporário FORA do repositório, integralmente removido ao final.
// Prova: audit rejeita link externo; clean remove node_modules; remoção NÃO segue o alvo
// do link (a sentinela externa sobrevive); dry-run não altera nada; recusa raiz sem .git.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worktree-safety.mjs');
let pass = 0, fail = 0;
const results = [];
function check(name, cond) { if (cond) { pass++; results.push('  OK  ' + name); } else { fail++; results.push('  XX  ' + name); } }
function run(args, cwd) { return spawnSync('node', [TOOL, ...args], { encoding: 'utf8', cwd }); }
function mkjunction(target, link) { fs.symlinkSync(target, link, 'junction'); }

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-safety-'));
const external = path.join(base, 'EXTERNAL');
try {
  // sentinela externa que JAMAIS pode ser tocada
  fs.mkdirSync(external, { recursive: true });
  fs.writeFileSync(path.join(external, 'SENTINEL.txt'), 'não me apague');

  // ---- Fixture A: "repo" com .git, node_modules real + junction interna ----
  const repoA = path.join(base, 'repoA');
  fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
  fs.mkdirSync(path.join(repoA, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoA, 'src', 'keep.ts'), 'export const x = 1;');
  const nmA = path.join(repoA, 'node_modules');
  fs.mkdirSync(path.join(nmA, '.pnpm', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(nmA, '.pnpm', 'pkg', 'index.js'), '//pkg');
  // junction INTERNA (node_modules/dep -> node_modules/.pnpm/pkg)
  mkjunction(path.join(nmA, '.pnpm', 'pkg'), path.join(nmA, 'dep'));
  // nested workspace node_modules
  fs.mkdirSync(path.join(repoA, 'packages', 'contracts', 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(repoA, 'packages', 'contracts', 'src.ts'), 'export const y = 2;');

  // audit da raiz repoA deve PASSAR (todos os links internos)
  const aAudit = run(['audit', repoA]);
  check('audit passa quando todos os links são internos', aAudit.status === 0);

  // clean dry-run lista os node_modules e remove nada
  const aDry = run(['clean-node-modules', repoA]);
  check('clean dry-run exit 0', aDry.status === 0);
  check('clean dry-run acha 2 node_modules (raiz + contracts)', /node_modules encontrados: 2/.test(aDry.stdout));
  check('clean dry-run NÃO remove (node_modules ainda existe)', fs.existsSync(nmA));
  check('clean dry-run preserva fonte', fs.existsSync(path.join(repoA, 'src', 'keep.ts')));

  // clean --apply remove os node_modules
  const aApply = run(['clean-node-modules', repoA, '--apply']);
  check('clean --apply exit 0', aApply.status === 0);
  check('clean --apply removeu node_modules da raiz', !fs.existsSync(nmA));
  check('clean --apply removeu node_modules de contracts', !fs.existsSync(path.join(repoA, 'packages', 'contracts', 'node_modules')));
  check('clean --apply preservou fonte src', fs.existsSync(path.join(repoA, 'src', 'keep.ts')));
  check('clean --apply preservou fonte contracts', fs.existsSync(path.join(repoA, 'packages', 'contracts', 'src.ts')));
  check('clean --apply NÃO seguiu junction: sentinela externa intacta', fs.existsSync(path.join(external, 'SENTINEL.txt')));

  // ---- Fixture B: node_modules com junction para FORA -> remoção NÃO segue o alvo ----
  const repoB = path.join(base, 'repoB');
  fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
  const nmB = path.join(repoB, 'node_modules');
  fs.mkdirSync(nmB, { recursive: true });
  mkjunction(external, path.join(nmB, 'evil-link')); // node_modules/evil-link -> EXTERNAL
  const bApply = run(['clean-node-modules', repoB, '--apply']);
  check('clean --apply exit 0 (com link externo dentro de node_modules)', bApply.status === 0);
  check('clean --apply removeu node_modules', !fs.existsSync(nmB));
  check('remoção NÃO seguiu o link externo: EXTERNAL/SENTINEL sobrevive', fs.existsSync(path.join(external, 'SENTINEL.txt')));

  // ---- Fixture C: audit deve FALHAR quando há link para fora da raiz ----
  const repoC = path.join(base, 'repoC');
  fs.mkdirSync(path.join(repoC, 'node_modules'), { recursive: true });
  mkjunction(external, path.join(repoC, 'node_modules', 'out')); // aponta p/ fora de repoC
  const cAudit = run(['audit', repoC]);
  check('audit FALHA (exit 1) com link externo', cAudit.status === 1);
  check('audit reporta EXTERNO', /EXTERNO/.test(cAudit.stdout + cAudit.stderr));
  check('audit não tocou a sentinela externa', fs.existsSync(path.join(external, 'SENTINEL.txt')));

  // ---- Fixture D: clean recusa raiz sem .git ----
  const noGit = path.join(base, 'nogit');
  fs.mkdirSync(path.join(noGit, 'node_modules'), { recursive: true });
  const dRun = run(['clean-node-modules', noGit, '--apply']);
  check('clean recusa raiz sem .git (exit 1)', dRun.status === 1);
  check('clean recusa: node_modules intacto', fs.existsSync(path.join(noGit, 'node_modules')));

} finally {
  try { fs.rmSync(base, { recursive: true, force: true }); } catch {}
}

console.log(results.join('\n'));
console.log(`\ntest-worktree-safety: ${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

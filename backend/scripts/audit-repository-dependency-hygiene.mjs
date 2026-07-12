#!/usr/bin/env node
// Guard estrutural — F-REPOSITORY-DEPENDENCY-HYGIENE.
// Pergunta própria: "nenhum node_modules (nem .pnpm/.bin de dependência) voltou a ser
// versionado; o .gitignore cobre node_modules na raiz e em cada workspace; a fonte
// legítima packages/contracts (src+dist+package.json) permanece versionada; a ferramenta
// de segurança de worktree existe; e os fluxos de CI que instalavam dependências continuam
// instalando (não passaram a pressupor node_modules versionado)?"
// Baseado em PATHS tracked e comportamento real (git ls-files/check-ignore), nunca na
// STRING "node_modules" em conteúdo — docs/fixtures/mensagens são permitidas. Parse fail = FAIL.

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const failures = [];
const note = (m) => failures.push(m);

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30, ...opts }).trim();
}

let ROOT;
try {
  ROOT = git(['rev-parse', '--show-toplevel']);
} catch (e) {
  console.error('GATE FAIL [repository-dependency-hygiene] — não foi possível resolver o repo root: ' + e.message);
  process.exit(1);
}

// ---- INV1: zero paths tracked com segmento node_modules (em qualquer profundidade) ----
try {
  const tracked = git(['-C', ROOT, 'ls-files']).split('\n').filter(Boolean);
  const nm = tracked.filter((p) => /(^|\/)node_modules(\/|$)/.test(p));
  if (nm.length) note(`INV1: ${nm.length} path(s) node_modules voltaram a ser tracked (ex.: ${nm.slice(0, 3).join(', ')})`);
  // INV2 (subconjunto explícito): .pnpm e .bin de dependência (dentro de node_modules) não podem ser tracked
  const pnpm = nm.filter((p) => /(^|\/)\.pnpm(\/|$)/.test(p));
  if (pnpm.length) note(`INV2a: ${pnpm.length} path(s) .pnpm tracked`);
  const bin = nm.filter((p) => /(^|\/)\.bin(\/|$)/.test(p));
  if (bin.length) note(`INV2b: ${bin.length} path(s) node_modules/.bin tracked`);
} catch (e) {
  note('INV1: falha ao listar tracked: ' + e.message);
}

// ---- INV3: .gitignore cobre node_modules na raiz e em cada workspace ----
// Prova comportamental: git check-ignore deve marcar cada probe como ignorado (exit 0).
const probes = [
  'node_modules/.probe',
  'backend/node_modules/.probe',
  'frontend/node_modules/.probe',
  'packages/contracts/node_modules/.probe',
];
for (const probe of probes) {
  try {
    git(['-C', ROOT, 'check-ignore', '-q', '--', probe]); // exit 0 = ignorado
  } catch {
    note(`INV3: .gitignore NÃO cobre ${probe} (check-ignore não o considerou ignorado)`);
  }
}

// ---- INV4: fonte legítima packages/contracts permanece versionada ----
for (const p of ['packages/contracts/package.json', 'packages/contracts/src', 'packages/contracts/dist']) {
  try {
    const out = git(['-C', ROOT, 'ls-files', '--', p]);
    if (!out) note(`INV4: packages/contracts fonte/artefato ausente do tracking: ${p}`);
  } catch {
    note(`INV4: falha ao verificar tracking de ${p}`);
  }
}

// ---- INV5: a ferramenta de segurança de worktree existe ----
if (!existsSync(join(ROOT, 'backend', 'scripts', 'worktree-safety.mjs'))) {
  note('INV5: backend/scripts/worktree-safety.mjs ausente (ferramenta de preflight de reparse points)');
}

// ---- INV6: os workflows de CI que instalavam dependências continuam instalando ----
// Anti-regressão do C03 (CI deixa de instalar após desversionar node_modules).
const CI_INSTALLERS = [
  '.github/workflows/backend-ci.yml',
  '.github/workflows/canonical-gates.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/production-deploy.yml',
  '.github/workflows/system-gates.yml',
];
for (const wf of CI_INSTALLERS) {
  const abs = join(ROOT, wf);
  if (!existsSync(abs)) { note(`INV6: workflow de CI ausente: ${wf}`); continue; }
  const txt = readFileSync(abs, 'utf8');
  if (!/pnpm\s+install|npm\s+ci|npm\s+install|pnpm\s+i\b/.test(txt)) {
    note(`INV6: CI ${wf} não instala mais dependências (pressupõe node_modules versionado?)`);
  }
}

finish();

function finish() {
  if (failures.length) {
    console.error('GATE FAIL [repository-dependency-hygiene]\n' + failures.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
  console.log('GATE OK [repository-dependency-hygiene] — zero node_modules/.pnpm/.bin de dependência versionado (git ls-files); .gitignore cobre node_modules na raiz e em backend/frontend/packages-contracts (check-ignore); packages/contracts (src+dist+package.json) permanece fonte versionada; ferramenta de preflight de reparse points presente; CI ainda instala dependências. (Baseado em paths tracked e comportamento real, não em conteúdo textual.)');
}

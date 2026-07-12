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
import { existsSync, readFileSync, readdirSync } from 'fs';
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

// ---- INV7: integridade do artefato @unificard/contracts/dist ----
// Impede o defeito que quebrou auth.routes.ts: dist parcial/stale (faltando vocabulary/marketplace)
// faz GENDER_VALUES/Gender degradarem para any e require() lançar MODULE_NOT_FOUND.
// Prova COMPLETUDE (src↔dist), RESOLUÇÃO (re-exports apontam para arquivos existentes; require funciona)
// e comportamento — não só existência de nome.
(() => {
  const CROOT = join(ROOT, 'packages', 'contracts');
  const SRC = join(CROOT, 'src');
  const DIST = join(CROOT, 'dist');
  if (!existsSync(SRC) || !existsSync(DIST)) { note('INV7: packages/contracts/src ou dist ausente'); return; }

  // A. COMPLETUDE: todo módulo público de src (basename) tem dist .js E .d.ts
  const srcModules = readdirSync(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts')).map((f) => f.replace(/\.ts$/, ''));
  for (const m of srcModules) {
    if (!existsSync(join(DIST, `${m}.js`))) note(`INV7a: dist runtime ausente para módulo src '${m}': dist/${m}.js`);
    if (!existsSync(join(DIST, `${m}.d.ts`))) note(`INV7a: dist declaração ausente para módulo src '${m}': dist/${m}.d.ts`);
  }

  // B. RESOLUÇÃO: nenhum require/re-export de dist/index.{js,d.ts} aponta para módulo inexistente
  const refsOf = (file, re) => {
    if (!existsSync(file)) { note(`INV7b: ${file} ausente`); return []; }
    const t = readFileSync(file, 'utf8'); const out = []; let mm;
    while ((mm = re.exec(t))) out.push(mm[1]);
    return out;
  };
  for (const ref of refsOf(join(DIST, 'index.js'), /require\(["']\.\/([A-Za-z0-9_-]+)["']\)/g)) {
    if (!existsSync(join(DIST, `${ref}.js`))) note(`INV7b: dist/index.js requer './${ref}' mas dist/${ref}.js não existe (dist parcial → MODULE_NOT_FOUND em runtime)`);
  }
  for (const ref of refsOf(join(DIST, 'index.d.ts'), /from ["']\.\/([A-Za-z0-9_-]+)["']/g)) {
    if (!existsSync(join(DIST, `${ref}.d.ts`))) note(`INV7b: dist/index.d.ts reexporta de './${ref}' mas dist/${ref}.d.ts não existe (símbolos degradam para any)`);
  }

  // C. NÃO-REVIVAL: os 2 módulos que causaram o incidente têm de existir em runtime E tipos
  for (const crit of ['vocabulary', 'marketplace']) {
    for (const ext of ['js', 'd.ts']) {
      if (!existsSync(join(DIST, `${crit}.${ext}`))) note(`INV7c: módulo crítico ausente: dist/${crit}.${ext}`);
    }
  }

  // D. RESOLUÇÃO RUNTIME: require('@unificard/contracts') funciona e exports críticos existem
  try {
    const out = execFileSync('node', ['-e', "const c=require('@unificard/contracts'); if(!Array.isArray(c.GENDER_VALUES)||!c.GENDER_VALUES.length) throw new Error('GENDER_VALUES vazio/ausente'); if(!Array.isArray(c.MARKETPLACE_DOMAIN_VALUES)||!c.MARKETPLACE_DOMAIN_VALUES.length) throw new Error('MARKETPLACE_DOMAIN_VALUES vazio/ausente'); if(typeof c.isGender!=='function') throw new Error('isGender ausente'); process.stdout.write('OK');"], { cwd: join(ROOT, 'backend'), encoding: 'utf8' });
    if (!/OK/.test(out)) note('INV7d: require(@unificard/contracts) não confirmou exports críticos');
  } catch (e) {
    note('INV7d: require(@unificard/contracts) FALHA em runtime: ' + String(e.message).split('\n')[0]);
  }
})();

finish();

function finish() {
  if (failures.length) {
    console.error('GATE FAIL [repository-dependency-hygiene]\n' + failures.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
  console.log('GATE OK [repository-dependency-hygiene] — zero node_modules/.pnpm/.bin de dependência versionado (git ls-files); .gitignore cobre node_modules na raiz e em backend/frontend/packages-contracts (check-ignore); packages/contracts (src+dist+package.json) permanece fonte versionada; ferramenta de preflight de reparse points presente; CI ainda instala dependências; @unificard/contracts/dist COMPLETO (todo módulo src tem .js+.d.ts; index não referencia módulo inexistente; vocabulary+marketplace presentes; require() resolve com GENDER_VALUES/MARKETPLACE_DOMAIN_VALUES). (Baseado em paths tracked, resolução e comportamento real, não em conteúdo textual.)');
}

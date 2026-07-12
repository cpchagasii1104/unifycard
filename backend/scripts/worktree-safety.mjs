#!/usr/bin/env node
// Ferramenta de segurança versionada — F-REPOSITORY-DEPENDENCY-HYGIENE.
// Existe porque a remoção de um worktree seguiu uma junction/symlink pnpm que apontava
// para o main tree e APAGOU o alvo real (esvaziou node_modules + packages/contracts).
// Duas responsabilidades, ambas fail-closed, NUNCA seguindo o alvo de um link:
//
//   audit <root>
//     Percorre <root> com lstat (sem seguir links). Lista todo symlink/junction/reparse
//     point e o alvo resolvido (só p/ diagnóstico). FALHA (exit 1) se qualquer alvo
//     resolver para FORA de <root> — exatamente a condição que tornou a remoção do
//     worktree destrutiva. Não altera nada.
//
//   clean-node-modules <repoRoot> [--apply]
//     Encontra diretórios cujo basename EXATO seja "node_modules" (poda: não desce dentro
//     deles nem dentro de .git) e os remove com segurança: desmonta cada link como link
//     (unlink/rmdir), nunca atravessa/segue o alvo, recursão só em diretórios reais.
//     Recusa qualquer path fora de <repoRoot>, recusa .git, recusa qualquer basename que
//     não seja "node_modules". DRY-RUN é o padrão; só remove com --apply explícito.
//
// A ferramenta JAMAIS executa git reset/clean/restore/checkout, pnpm install, remoção de
// worktree, nem altera o index. Só audita links e remove com segurança node_modules gerados.

import fs from 'fs';
import path from 'path';

function fail(msg) {
  console.error('SAFETY-FAIL: ' + msg);
  process.exit(1);
}

// Um path é "link" se for symlink OU junction (ambos reparse points no Windows).
// lstat.isSymbolicLink() cobre os dois no libuv moderno; readlink é o diagnóstico do alvo.
function linkInfo(p) {
  let st;
  try { st = fs.lstatSync(p); } catch { return null; }
  if (!st.isSymbolicLink()) return null;
  let target = null;
  try { target = fs.readlinkSync(p); } catch { target = '(alvo ilegível)'; }
  return { target };
}

function resolveTarget(linkPath, rawTarget) {
  if (!rawTarget || rawTarget === '(alvo ilegível)') return null;
  return path.resolve(path.dirname(linkPath), rawTarget);
}

function isInside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// ---------- AUDIT ----------
// Percorre sem seguir links; poda ao encontrar um link (registra, não desce nele).
function audit(rootArg) {
  const root = path.resolve(rootArg);
  if (!fs.existsSync(root)) fail('raiz inexistente: ' + root);
  const links = [];
  const external = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const info = linkInfo(full);
        const resolved = info ? resolveTarget(full, info.target) : null;
        const outside = resolved ? !isInside(root, resolved) : true; // alvo ilegível = trata como suspeito
        const rec = { path: full, target: info ? info.target : '(?)', resolved, outside };
        links.push(rec);
        if (outside) external.push(rec);
        // NÃO desce dentro do link.
        continue;
      }
      if (ent.name === '.git') continue;
      if (ent.isDirectory()) stack.push(full);
    }
  }
  console.log(`[audit] raiz=${root}`);
  console.log(`[audit] links encontrados: ${links.length}`);
  console.log(`[audit] links com alvo EXTERNO à raiz: ${external.length}`);
  for (const e of external.slice(0, 50)) {
    console.log(`  EXTERNO: ${e.path} -> ${e.target} (${e.resolved || 'ilegível'})`);
  }
  if (external.length) fail(`${external.length} link(s) resolvem para fora da raiz auditada — remoção PROIBIDA sem desmontar os links primeiro.`);
  console.log('[audit] OK — nenhum link resolve para fora da raiz.');
}

// ---------- CLEAN NODE_MODULES ----------
// Remoção segura que nunca segue o alvo de um link.
function safeRemove(p) {
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink()) {
    // desmonta o link como link (nunca segue o alvo)
    try { fs.unlinkSync(p); } catch { fs.rmdirSync(p); }
    return;
  }
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) safeRemove(path.join(p, name));
    fs.rmdirSync(p);
    return;
  }
  fs.unlinkSync(p);
}

// Encontra dirs "node_modules" sem descer neles nem em .git.
function findNodeModulesDirs(root) {
  const found = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.isSymbolicLink()) continue;
      const full = path.join(dir, ent.name);
      if (ent.name === '.git') continue;
      if (ent.name === 'node_modules') { found.push(full); continue; } // poda: não desce
      stack.push(full);
    }
  }
  return found;
}

function cleanNodeModules(repoArg, apply) {
  const repo = path.resolve(repoArg);
  if (!fs.existsSync(repo)) fail('repo inexistente: ' + repo);
  if (!fs.existsSync(path.join(repo, '.git'))) fail('raiz sem .git — recuso operar fora de um repositório: ' + repo);
  const dirs = findNodeModulesDirs(repo);
  console.log(`[clean] repo=${repo}`);
  console.log(`[clean] diretórios node_modules encontrados: ${dirs.length}`);
  for (const d of dirs) {
    // guardas fail-closed por diretório
    if (path.basename(d) !== 'node_modules') fail('basename != node_modules: ' + d);
    if (!isInside(repo, d)) fail('fora do repo: ' + d);
    if (d.split(path.sep).includes('.git')) fail('atinge .git: ' + d);
    console.log(`  ${apply ? 'REMOVER' : 'dry-run'}: ${d}`);
  }
  if (!apply) {
    console.log('[clean] DRY-RUN — nada removido. Use --apply para aplicar.');
    return;
  }
  for (const d of dirs) safeRemove(d);
  console.log(`[clean] APLICADO — ${dirs.length} diretório(s) node_modules removidos (links desmontados sem seguir alvo).`);
}

// ---------- CLI ----------
const [cmd, arg1, ...rest] = process.argv.slice(2);
if (cmd === 'audit') {
  if (!arg1) fail('uso: audit <root>');
  audit(arg1);
} else if (cmd === 'clean-node-modules') {
  if (!arg1) fail('uso: clean-node-modules <repoRoot> [--apply]');
  cleanNodeModules(arg1, rest.includes('--apply'));
} else {
  console.error('uso: node worktree-safety.mjs <audit|clean-node-modules> <root> [--apply]');
  process.exit(2);
}

#!/usr/bin/env node
/**
 * Invariante: nenhum `fetch(` direto em frontend/src exceto em api/client.ts
 * (implementação de apiFetch / apiFetchPublic).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'frontend', 'src');
const allowedFile = path.join(srcDir, 'api', 'client.ts');

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(name.name)) files.push(p);
  }
  return files;
}

const hasDirectFetch = (text) => /\bfetch\s*\(/.test(text);
let failed = false;

for (const file of walk(srcDir)) {
  if (path.resolve(file) === path.resolve(allowedFile)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (hasDirectFetch(text)) {
    console.error(`[Invariant] fetch() direto não permitido: ${path.relative(root, file)}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nUse apiFetch ou apiFetchPublic de frontend/src/api/client.ts.');
  process.exit(1);
}
console.log('[Invariant] Nenhum fetch direto fora de frontend/src/api/client.ts.');

#!/usr/bin/env node
/**
 * C66: validate-concept-id-uuid-shape
 *
 * Bloqueia novos slugs literais em call sites de concept_id.
 * Compara repo atual contra allowlist congelada.
 *
 * Falha quando:
 *   - Novo slug encontrado (não está na allowlist)
 *   - Slug aparece em arquivo não-listado
 *   - Contagem por arquivo diverge (mais ou menos ocorrências)
 *   - Contagem total por slug diverge
 *
 * Allowlist: scripts/concept-id-uuid-shape-allowlist.json
 * Formato: { "<slug>": { "count": N, "files": { "<path>": N } } }
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const SRC_ROOT = join(REPO_ROOT, 'backend', 'src');
const ALLOWLIST_PATH = join(__dirname, 'concept-id-uuid-shape-allowlist.json');

const SLUG_PATTERN = /concept_id:\s*['"]([a-z][a-z0-9-]+)['"]/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      yield* walk(full);
    } else if (entry.endsWith('.ts')) {
      yield full;
    }
  }
}

function scanRepo() {
  const found = {};
  for (const file of walk(SRC_ROOT)) {
    const rel = relative(REPO_ROOT, file).split(sep).join('/');
    const content = readFileSync(file, 'utf8');
    let m;
    SLUG_PATTERN.lastIndex = 0;
    while ((m = SLUG_PATTERN.exec(content)) !== null) {
      const slug = m[1];
      if (!found[slug]) found[slug] = { count: 0, files: {} };
      found[slug].count++;
      found[slug].files[rel] = (found[slug].files[rel] ?? 0) + 1;
    }
  }
  return found;
}

function compare(allowed, found) {
  const errors = [];
  const allSlugs = new Set([...Object.keys(allowed), ...Object.keys(found)]);

  for (const slug of [...allSlugs].sort()) {
    const a = allowed[slug];
    const f = found[slug];
    if (!a) {
      const filesList = Object.entries(f.files).map(([p, c]) => `  ${p} (${c}x)`).join('\n');
      errors.push(`NEW_SLUG: '${slug}' (count=${f.count})\n${filesList}`);
      continue;
    }
    if (!f) {
      errors.push(`SLUG_REMOVED: '${slug}' presente na allowlist mas ausente no repo (atualize allowlist)`);
      continue;
    }
    if (a.count !== f.count) {
      errors.push(`COUNT_DRIFT: '${slug}' allowlist=${a.count}, repo=${f.count}`);
    }
    const allFiles = new Set([...Object.keys(a.files), ...Object.keys(f.files)]);
    for (const file of [...allFiles].sort()) {
      const ac = a.files[file];
      const fc = f.files[file];
      if (ac == null) {
        errors.push(`NEW_FILE: '${slug}' aparece em arquivo nao-listado: ${file} (${fc}x)`);
      } else if (fc == null) {
        errors.push(`FILE_REMOVED: '${slug}' nao mais em ${file} (allowlist=${ac}; atualize allowlist)`);
      } else if (ac !== fc) {
        errors.push(`FILE_COUNT_DRIFT: '${slug}' em ${file} allowlist=${ac}, repo=${fc}`);
      }
    }
  }
  return errors;
}

function main() {
  const allowed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  const found = scanRepo();
  const errors = compare(allowed, found);

  if (errors.length === 0) {
    const totalSlugs = Object.keys(found).length;
    const totalOcc = Object.values(found).reduce((s, e) => s + e.count, 0);
    console.log(`GATE OK [concept-id-uuid-shape] slugs=${totalSlugs} ocorrencias=${totalOcc}`);
    process.exit(0);
  }

  console.error('GATE FAIL [concept-id-uuid-shape]: drift detectado');
  console.error('');
  for (const e of errors) console.error(e);
  console.error('');
  console.error(`Total: ${errors.length} violacao(oes)`);
  console.error('Para regularizar: corrigir o codigo OU atualizar scripts/concept-id-uuid-shape-allowlist.json');
  process.exit(1);
}

main();
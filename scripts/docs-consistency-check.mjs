#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const PATHS = {
  plan: path.join(ROOT, 'PLANO_CORRECAO_NOMENCLATURA.md'),
  canonical: path.join(ROOT, 'docs', '01_normative', '07_NOMENCLATURA_CANONICA.md'),
  index: path.join(ROOT, 'docs', '01_normative', '00_INDEX.md'),
  registryCanonical: path.join(ROOT, 'docs', '01_normative', 'SSOT_REGISTRY_UNIFICARD.md'),
  docsRoot: path.join(ROOT, 'docs'),
};

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function check(condition, label, details = '') {
  if (condition) {
    console.log(`PASS ${label}`);
    return true;
  }
  console.error(`FAIL ${label}${details ? ` :: ${details}` : ''}`);
  return false;
}

function extractCanonicalVersion(canonicalText) {
  const m = canonicalText.match(/\*\*Vers[aã]o:\*\*\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m ? m[1] : null;
}

function extractPlanVersion(planText) {
  const m = planText.match(/07_NOMENCLATURA_CANONICA\.md`\s*v([0-9]+(?:\.[0-9]+)*)/i);
  return m ? m[1] : null;
}

function walkFiles(dir, fileFilter, bucket = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileFilter, bucket);
      continue;
    }
    if (fileFilter(fullPath)) {
      bucket.push(fullPath);
    }
  }
  return bucket;
}

function hardBlockAliases() {
  // Hard-block apenas para alias explicitamente proibido e com canonical definido.
  return new Map([
    ['SSOT_REGISTRY.md', 'SSOT_REGISTRY_UNIFICARD.md'],
  ]);
}

function findInDocsIgnoringCode(filePath, termsToExpected) {
  const hits = [];
  const lines = readText(filePath).split(/\r?\n/);
  let inFence = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const raw = lines[idx];
    const trimmed = raw.trimStart();

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const scrubbed = raw.replace(/`[^`]*`/g, '');
    for (const [term, expected] of termsToExpected.entries()) {
      if (scrubbed.includes(term)) {
        hits.push({ filePath, line: idx + 1, found: term, expected });
      }
    }
  }

  return hits;
}

function main() {
  let ok = true;

  ok = check(fs.existsSync(PATHS.plan), 'Plano de correcao existe', PATHS.plan) && ok;
  ok = check(fs.existsSync(PATHS.canonical), '07_NOMENCLATURA_CANONICA existe', PATHS.canonical) && ok;
  ok = check(fs.existsSync(PATHS.index), '00_INDEX existe', PATHS.index) && ok;
  ok = check(fs.existsSync(PATHS.registryCanonical), 'SSOT_REGISTRY_UNIFICARD existe', PATHS.registryCanonical) && ok;

  if (!ok) {
    process.exit(1);
  }

  const planText = readText(PATHS.plan);
  const canonicalText = readText(PATHS.canonical);
  const indexText = readText(PATHS.index);

  const canonicalVersion = extractCanonicalVersion(canonicalText);
  const planVersion = extractPlanVersion(planText);

  ok = check(Boolean(canonicalVersion), 'Versao canonica detectada') && ok;
  ok = check(Boolean(planVersion), 'Versao referenciada no plano detectada') && ok;

  if (canonicalVersion && planVersion) {
    ok = check(
      canonicalVersion === planVersion,
      'Plano referencia mesma versao do canonico',
      `plan=${planVersion}, canonico=${canonicalVersion}`,
    ) && ok;
  }

  ok = check(
    !canonicalText.includes('`SSOT_REGISTRY.md`'),
    '07 nao usa alias SSOT_REGISTRY.md',
  ) && ok;

  ok = check(
    canonicalText.includes('`SSOT_REGISTRY_UNIFICARD.md`'),
    '07 referencia SSOT_REGISTRY_UNIFICARD.md',
  ) && ok;

  ok = check(
    indexText.includes('SSOT_REGISTRY_UNIFICARD.md'),
    '00_INDEX referencia SSOT_REGISTRY_UNIFICARD.md',
  ) && ok;

  const aliases = hardBlockAliases();
  const docsFiles = walkFiles(PATHS.docsRoot, (p) => p.endsWith('.md'));
  const docsHits = docsFiles.flatMap((filePath) => findInDocsIgnoringCode(filePath, aliases));

  ok = check(
    docsHits.length === 0,
    'Varredura global docs sem aliases nao canonicos',
    docsHits.length ? `ocorrencias=${docsHits.length}` : '',
  ) && ok;

  if (docsHits.length > 0) {
    console.error('');
    for (const hit of docsHits.slice(0, 100)) {
      const rel = path.relative(ROOT, hit.filePath).replace(/\\/g, '/');
      console.error(`FAIL ALIAS :: file=${rel} line=${hit.line} found=${hit.found} expected=${hit.expected}`);
    }
    if (docsHits.length > 100) {
      console.error(`FAIL ALIAS :: ... ${docsHits.length - 100} ocorrencias adicionais omitidas`);
    }
  }

  if (ok) {
    console.log('');
    console.log('SUMMARY PASS :: docs consistency check');
    process.exit(0);
  }

  console.error('');
  console.error('SUMMARY FAIL :: docs consistency check');
  process.exit(1);
}

main();

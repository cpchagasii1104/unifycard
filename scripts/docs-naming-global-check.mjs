#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CANONICAL_PATH = path.join(ROOT, 'docs', '01_normative', '07_NOMENCLATURA_CANONICA.md');

const HARD_BLOCK = new Map([
  ['SSOT_REGISTRY.md', 'SSOT_REGISTRY_UNIFICARD.md'],
]);

const SOFT_WARN = new Map([
  ['password_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['cpf_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['card_number_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['pin_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['ip_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['device_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['payload_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['immutable_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['total_balance_cents', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['current_balance_cents', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['reconciliation_balance_cents', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['text_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
  ['audio_hash', 'revisar se o termo segue nomenclatura canonica vigente'],
]);

function walkFiles(dir, fileFilter, bucket = []) {
  if (!fs.existsSync(dir)) return bucket;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileFilter, bucket);
      continue;
    }
    if (fileFilter(fullPath)) bucket.push(fullPath);
  }
  return bucket;
}

function scanFile(filePath, terms, options = { ignoreCodeInMarkdown: false }) {
  const hits = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    let line = raw;

    if (options.ignoreCodeInMarkdown) {
      const trimmed = raw.trimStart();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      line = raw.replace(/`[^`]*`/g, '');
    }

    for (const [term, expected] of terms.entries()) {
      if (term.startsWith('REGEX:')) {
        const re = new RegExp(term.slice(6));
        const match = line.match(re);
        if (match) {
          hits.push({ filePath, line: i + 1, found: match[0], expected });
        }
        continue;
      }

      if (line.includes(term)) {
        hits.push({ filePath, line: i + 1, found: term, expected });
      }
    }
  }

  return hits;
}

function printHits(hits) {
  if (hits.length === 0) return;
  console.error('❌ Non-canonical naming detected');
  console.error('');
  for (const hit of hits) {
    const rel = path.relative(ROOT, hit.filePath).replace(/\\/g, '/');
    console.error(`File: ${rel}`);
    console.error(`Line: ${hit.line}`);
    console.error(`Found: ${hit.found}`);
    console.error(`Expected: ${hit.expected}`);
    console.error('');
  }
}

function main() {
  if (!fs.existsSync(CANONICAL_PATH)) {
    console.error(`FAIL missing canonical file: ${CANONICAL_PATH}`);
    process.exit(1);
  }

  const canonicalText = fs.readFileSync(CANONICAL_PATH, 'utf8');
  // Mantemos WARN explícito e controlado para evitar ruído estrutural.
  const softWarn = SOFT_WARN;

  const docsFiles = walkFiles(path.join(ROOT, 'docs'), (p) => p.endsWith('.md'));
  const tsFiles = walkFiles(path.join(ROOT, 'backend'), (p) => p.endsWith('.ts'));
  const sqlFiles = walkFiles(path.join(ROOT, 'backend'), (p) => p.endsWith('.sql'));

  const docsHardHits = docsFiles.flatMap((f) => scanFile(f, HARD_BLOCK, { ignoreCodeInMarkdown: true }));
  const tsHardHits = tsFiles.flatMap((f) => scanFile(f, HARD_BLOCK));
  const sqlHardHits = sqlFiles.flatMap((f) => scanFile(f, HARD_BLOCK));

  const docsWarnHits = docsFiles.flatMap((f) => scanFile(f, softWarn, { ignoreCodeInMarkdown: true }));
  const tsWarnHits = tsFiles.flatMap((f) => scanFile(f, softWarn));
  const sqlWarnHits = sqlFiles.flatMap((f) => scanFile(f, softWarn));

  const hardHits = [...docsHardHits, ...tsHardHits, ...sqlHardHits];
  const warnHits = [...docsWarnHits, ...tsWarnHits, ...sqlWarnHits];

  if (warnHits.length > 0) {
    console.warn(`⚠️ WARN Non-canonical naming candidates: ${warnHits.length}`);
    for (const hit of warnHits.slice(0, 50)) {
      const rel = path.relative(ROOT, hit.filePath).replace(/\\/g, '/');
      console.warn(`WARN :: file=${rel} line=${hit.line} found=${hit.found}`);
    }
    if (warnHits.length > 50) {
      console.warn(`WARN :: ... ${warnHits.length - 50} ocorrencias adicionais omitidas`);
    }
    console.warn('');
  }

  if (hardHits.length > 0) {
    printHits(hardHits);
    process.exit(1);
  }

  console.log('PASS Naming Consistency (Global)');
  console.log(`Scanned docs=${docsFiles.length} ts=${tsFiles.length} sql=${sqlFiles.length}`);
  process.exit(0);
}

main();

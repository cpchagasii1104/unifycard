#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const METRICS_DIR = path.join(ROOT, 'docs', '.metrics');
const SNAPSHOT_PATH = path.join(METRICS_DIR, 'warn-snapshot.json');

const DOMAIN_MAP = {
  auth: ['password_hash', 'cpf_hash', 'pin_hash'],
  bank: ['total_balance_cents', 'current_balance_cents'],
  reconciliation: ['reconciliation_balance_cents'],
  infra: ['ip_hash', 'device_hash', 'payload_hash', 'immutable_hash'],
};

// Padrões adicionais suspeitos que continuam em WARN; sem mapeamento explícito vão para unknown.
const EXTRA_WARN_TERMS = ['card_number_hash', 'text_hash', 'audio_hash'];

function walkFiles(dir, filter, bucket = []) {
  if (!fs.existsSync(dir)) return bucket;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, filter, bucket);
      continue;
    }
    if (filter(full)) bucket.push(full);
  }
  return bucket;
}

function buildTermToDomain() {
  const termToDomain = new Map();
  for (const [domain, terms] of Object.entries(DOMAIN_MAP)) {
    for (const term of terms) termToDomain.set(term, domain);
  }
  for (const term of EXTRA_WARN_TERMS) {
    if (!termToDomain.has(term)) termToDomain.set(term, 'unknown');
  }
  return termToDomain;
}

function scanFile(filePath, terms, options = { ignoreMarkdownCode: false }) {
  const hits = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    let line = raw;

    if (options.ignoreMarkdownCode) {
      const trimmed = raw.trimStart();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      line = raw.replace(/`[^`]*`/g, '');
    }

    for (const term of terms) {
      if (line.includes(term)) {
        hits.push({ filePath, line: i + 1, term });
      }
    }
  }

  return hits;
}

function topNFromMap(map, n = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function loadPreviousSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSnapshot(domains, perDomainTotal, total) {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    domains: Object.fromEntries(domains.map((d) => [d, perDomainTotal.get(d) || 0])),
    total,
  };

  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return snapshot;
}

function formatDelta(current, previous) {
  if (previous === null || previous === undefined) return '=';
  const diff = current - previous;
  if (diff === 0) return '=';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function main() {
  const termToDomain = buildTermToDomain();
  const terms = [...termToDomain.keys()];

  const docsFiles = walkFiles(path.join(ROOT, 'docs'), (p) => p.endsWith('.md'));
  const tsFiles = walkFiles(path.join(ROOT, 'backend'), (p) => p.endsWith('.ts'));
  const sqlFiles = walkFiles(path.join(ROOT, 'backend'), (p) => p.endsWith('.sql'));

  const docsHits = docsFiles.flatMap((f) => scanFile(f, terms, { ignoreMarkdownCode: true }));
  const tsHits = tsFiles.flatMap((f) => scanFile(f, terms));
  const sqlHits = sqlFiles.flatMap((f) => scanFile(f, terms));
  const allHits = [...docsHits, ...tsHits, ...sqlHits];

  const domains = ['auth', 'bank', 'reconciliation', 'infra', 'unknown'];
  const perDomainTotal = new Map(domains.map((d) => [d, 0]));
  const perDomainPatterns = new Map(domains.map((d) => [d, new Map()]));
  const perDomainFiles = new Map(domains.map((d) => [d, new Map()]));

  for (const hit of allHits) {
    const domain = termToDomain.get(hit.term) || 'unknown';
    const rel = path.relative(ROOT, hit.filePath).replace(/\\/g, '/');
    perDomainTotal.set(domain, (perDomainTotal.get(domain) || 0) + 1);
    addCount(perDomainPatterns.get(domain), hit.term);
    addCount(perDomainFiles.get(domain), rel);
  }

  console.log('=== WARN CLASSIFICATION REPORT ===');
  console.log('');

  const previousSnapshot = loadPreviousSnapshot();

  for (const domain of domains) {
    const total = perDomainTotal.get(domain) || 0;
    console.log(`[${domain.toUpperCase()}] (${total})`);

    const topPatterns = topNFromMap(perDomainPatterns.get(domain), 5);
    console.log('Top patterns:');
    if (topPatterns.length === 0) {
      console.log('- (none)');
    } else {
      for (const [pattern, count] of topPatterns) {
        console.log(`- ${pattern} (${count})`);
      }
    }

    const topFiles = topNFromMap(perDomainFiles.get(domain), 5);
    console.log('Top files:');
    if (topFiles.length === 0) {
      console.log('- (none)');
    } else {
      for (const [file, count] of topFiles) {
        console.log(`- ${file} (${count})`);
      }
    }

    console.log('');
  }

  console.log(`TOTAL WARN: ${allHits.length}`);
  console.log(`Scanned docs=${docsFiles.length} ts=${tsFiles.length} sql=${sqlFiles.length}`);

  console.log('');
  console.log('=== WARN TREND ===');
  for (const domain of domains) {
    const current = perDomainTotal.get(domain) || 0;
    const previous = previousSnapshot?.domains?.[domain];
    const delta = formatDelta(current, previous);
    console.log(`${domain.toUpperCase()}: ${current} (${delta})`);
  }
  const totalDelta = formatDelta(allHits.length, previousSnapshot?.total);
  console.log(`TOTAL: ${allHits.length} (${totalDelta})`);

  const snapshot = saveSnapshot(domains, perDomainTotal, allHits.length);
  console.log(`Snapshot: ${path.relative(ROOT, SNAPSHOT_PATH).replace(/\\/g, '/')}`);
  console.log(`Snapshot timestamp: ${snapshot.timestamp}`);

  const unknownCount = perDomainTotal.get('unknown') || 0;
  if (unknownCount > 0) {
    console.warn('⚠️ UNKNOWN domain requires classification');
    console.warn(`UNKNOWN COUNT: ${unknownCount}`);
  }

  // Relatório informativo: nunca bloqueia pipeline.
  process.exit(0);
}

main();

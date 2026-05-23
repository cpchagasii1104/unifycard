#!/usr/bin/env node
// Guard: INSERT/UPDATE em bank_* so dentro de modules/bank/ ou modulos explicitamente autorizados
// Ref: LEI_DE_COERENCIA_SISTEMICA §4.6

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(process.cwd(), 'src');
const ALLOWED_DIRS = ['modules/bank/', 'modules/bank-settlement/'];
const TEST_PATTERNS = ['.spec.', '.test.', '__tests__', 'scripts/'];
const VIOLATION_PATTERN = /INSERT\s+INTO\s+bank_|UPDATE\s+bank_/i;

function walkSync(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walkSync(full, files);
    } else if (extname(full) === '.ts') {
      files.push(full);
    }
  }
  return files;
}

const violations = [];
for (const file of walkSync(ROOT)) {
  const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
  if (ALLOWED_DIRS.some((d) => rel.includes(d))) continue;
  if (TEST_PATTERNS.some((p) => rel.includes(p))) continue;
  const content = readFileSync(file, 'utf-8');
  if (VIOLATION_PATTERN.test(content)) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (VIOLATION_PATTERN.test(line)) {
        violations.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('GATE FAIL [bank-ledger §4.6]: escritas bank_* fora de modules/bank/:');
  violations.forEach((v) => console.error(' ', v));
  process.exit(1);
}
console.log('GATE OK [bank-ledger §4.6]');

#!/usr/bin/env node
// Guard: verificar SQL proibido em migrations
// Ref: PLANO_MARKETPLACE_REFATOR_ARQUITETURAL Gate 2

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), '..', 'migrations');

const FORBIDDEN = [
  { pattern: /SELECT\s+\*\s+FROM/i, message: 'SELECT * em migration' },
];

let violations = 0;

function walkSync(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (entry.endsWith('.sql')) files.push(full);
  }
  return files;
}

for (const file of walkSync(MIGRATIONS_DIR)) {
  const content = readFileSync(file, 'utf-8');
  for (const check of FORBIDDEN) {
    if (check.pattern.test(content)) {
      console.error(`❌ ${check.message}: ${file}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`❌ GATE FAIL: ${violations} violação(ões) em migrations`);
  process.exit(1);
}
console.log('✅ GATE OK [sql-regression-lint]');

#!/usr/bin/env node
// Guard: verificar padroes de regressao financeira no src
// Ref: PLANO_MARKETPLACE_REFATOR_ARQUITETURAL §GATE2

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(process.cwd(), 'src');
const TEST_PATTERNS = ['.spec.', '.test.', '__tests__'];

// Padroes proibidos fora de modulos autorizados
const CHECKS = [
  {
    pattern: /INSERT\s+INTO\s+unifycard_transactions/i,
    message: 'INSERT em unifycard_transactions - tabela NON-SSOT (so log)',
    allowedDirs: [],
  },
];

function walkSync(dir, files: string[] = []): string[] {
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

let totalViolations = 0;
for (const file of walkSync(ROOT)) {
  const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
  if (TEST_PATTERNS.some((p) => rel.includes(p))) continue;
  const content = readFileSync(file, 'utf-8');
  for (const check of CHECKS) {
    if (check.allowedDirs.some((d) => rel.includes(d))) continue;
    if (check.pattern.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (check.pattern.test(line)) {
          console.error(`FAIL ${check.message}`);
          console.error(`   ${rel}:${i + 1}: ${line.trim()}`);
          totalViolations++;
        }
      });
    }
  }
}

if (totalViolations > 0) {
  console.error(`\nGATE FAIL: ${totalViolations} regressao(oes) financeira(s) detectada(s)`);
  process.exit(1);
}
console.log('GATE OK [financial-regression]');

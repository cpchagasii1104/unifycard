#!/usr/bin/env node
// Guard: nenhum modulo de produto deve chamar actorRepository.findOrCreate* diretamente
// Deve usar actor-writer.service (ensureUserActor / ensurePageActor)
// Ref: LEI_DE_COERENCIA_SISTEMICA §4.8.1

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(process.cwd(), 'src');
const ALLOWLIST = [
  'actor.repository.ts',
  'actor-writer.service.ts',
  'actor-repository.adapter.ts',
  'actor.helpers.ts',
  'actor.utils.ts',
  'ports-registry',
  'identity.service.ts',
  'scripts/',
  '__tests__',
  '.spec.',
  '.test.',
];
const VIOLATION_PATTERN = /actorRepository\.(findOrCreateUserActor|findOrCreatePageActor)/;

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
  if (ALLOWLIST.some((a) => rel.includes(a))) continue;
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
  console.error('GATE FAIL [actor-writer §4.8.1]: chamadas diretas ao repo fora do writer canonico:');
  violations.forEach((v) => console.error(' ', v));
  process.exit(1);
}
console.log('GATE OK [actor-writer §4.8.1]');

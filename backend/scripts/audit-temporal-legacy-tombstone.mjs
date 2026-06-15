#!/usr/bin/env node
// Guard estrutural — E2 (TEMPORAL TOMBSTONE / LEGACY WRITE-PATH REGRESSION LOCK).
// DECISION-0014 / C63: `schedules` e `schedule_slots` NÃO são o SSOT temporal canônico.
// SSOT vivo = unified_availability + unified_bookings (core/availability/). Os trilhos legados
// estão MORTOS (tabelas 0 linhas; REVOKE INSERT,UPDATE FROM PUBLIC em
// 20260428200000_schedules_revoke_write.sql; serviços SlotGenerator/EventScheduleService/
// EmployeeService = tombstones que SÓ lançam *LegacyError). Este guard CONGELA o estado e FALHA se:
//   (a) qualquer código de runtime (fora de scripts/tests) ESCREVER (INSERT/UPDATE/DELETE) em
//       schedules/schedule_slots — ressuscitação de write-path legado;
//   (b) a migration de REVOKE/tombstone sumir ou perder o REVOKE de schedules/schedule_slots;
//   (c) um dos 3 serviços-tombstone deixar de ser tombstone (perder o throw *LegacyError).
// NÃO bloqueia LEITURA histórica (SELECT/FROM) nem menção em comentário/doc/migration/teste.
// Integrado em validate:regression-guards. NÃO altera runtime. Mesma família do audit-bank-ledger-boundaries.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const MIGRATIONS = join(ROOT, 'migrations');
const REVOKE_MIGRATION = join(MIGRATIONS, '20260428200000_schedules_revoke_write.sql');
const TOMBSTONE_SERVICES = [
  'src/services/schedule/SlotGenerator.ts',
  'src/services/events/EventScheduleService.ts',
  'src/services/employee/EmployeeService.ts',
];
const TEST_PATTERNS = ['.spec.', '.test.', '__tests__', '/scripts/', '\\scripts\\'];

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// WRITE contra os trilhos legados (raw SQL — estilo do projeto). LEITURA (SELECT/FROM) NÃO casa.
const WRITE_LEGACY = /(INSERT\s+INTO\s+(schedules|schedule_slots)\b|UPDATE\s+(schedules|schedule_slots)\b|DELETE\s+FROM\s+(schedules|schedule_slots)\b)/i;

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (extname(full) === '.ts') {
      files.push(full);
    }
  }
  return files;
}

function runGuard() {
  const failures = [];
  let closed = 0;

  // (a) ZERO writer de runtime contra schedules/schedule_slots (fora de scripts/tests).
  let writers = 0;
  for (const file of walk(SRC)) {
    const rel = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
    if (TEST_PATTERNS.some((p) => rel.includes(p.replace(/\\/g, '/')))) continue;
    const code = stripComments(readFileSync(file, 'utf-8'));
    if (WRITE_LEGACY.test(code)) {
      writers++;
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (WRITE_LEGACY.test(line)) {
          failures.push(`LEGACY_TEMPORAL_WRITER_RESSUSCITADO: ${rel}:${i + 1}: ${line.trim()} — schedules/schedule_slots são tombstone (DECISION-0014/C63); escreva em unified_availability (core/availability/).`);
        }
      });
    }
  }
  if (writers === 0) closed++;

  // (b) migration de REVOKE/tombstone presente + revogando schedules E schedule_slots de PUBLIC.
  if (!existsSync(REVOKE_MIGRATION)) {
    failures.push('TOMBSTONE_REVOKE_AUSENTE: migrations/20260428200000_schedules_revoke_write.sql sumiu — REVOKE de write legado removido (DECISION-0014/C63).');
  } else {
    const mig = readFileSync(REVOKE_MIGRATION, 'utf-8');
    const ok = /REVOKE\s+INSERT\s*,\s*UPDATE\s+ON\s+schedules\s+FROM\s+PUBLIC/i.test(mig) &&
               /REVOKE\s+INSERT\s*,\s*UPDATE\s+ON\s+schedule_slots\s+FROM\s+PUBLIC/i.test(mig);
    if (!ok) failures.push('TOMBSTONE_REVOKE_ENFRAQUECIDO: 20260428200000_schedules_revoke_write.sql perdeu o REVOKE INSERT,UPDATE ON schedules/schedule_slots FROM PUBLIC.');
    else closed++;
  }

  // (c) os 3 serviços-tombstone continuam tombstone (lançam *LegacyError; sem corpo vivo).
  for (const rel of TOMBSTONE_SERVICES) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) {
      failures.push(`TOMBSTONE_SERVICE_AUSENTE: ${rel} sumiu — tombstone C63 esperado.`);
      continue;
    }
    const code = stripComments(readFileSync(p, 'utf-8'));
    if (!/throw\s+new\s+\w*LegacyError\b/.test(code)) {
      failures.push(`TOMBSTONE_SERVICE_RESSUSCITADO: ${rel} deixou de lançar *LegacyError — serviço temporal legado ganhou corpo vivo (DECISION-0014/C63).`);
    } else {
      closed++;
    }
  }

  console.log(`[temporal-legacy-tombstone] CLOSED=${closed} writers=${writers} FAILURES=${failures.length}`);
  if (failures.length > 0) {
    console.error('GATE FAIL [temporal-legacy-tombstone]:');
    failures.forEach((f) => console.error('  ', f));
    process.exit(1);
  }
  console.log('GATE OK [temporal-legacy-tombstone] — schedules/schedule_slots seguem mortos: zero writer de runtime, REVOKE FROM PUBLIC pinado, 3 serviços-tombstone lançando *LegacyError. SSOT temporal = unified_availability (DECISION-0014/C63).');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) runGuard();

export { runGuard };

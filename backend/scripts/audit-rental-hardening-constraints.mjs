#!/usr/bin/env node
// Guard estrutural — Trava 3: HARDENING DE BANCO de Locações (GO Clayton 2026-07-08).
// Garante que as 2 constraints de banco permaneçam materializadas e NÃO sejam removidas por migration
// posterior. Estático (padrão do repo — não conecta ao banco): confere a migration de hardening + varre
// todas as migrations por DROP dessas constraints.
//
// MORDE se:
//   1. a migration de hardening sumir / perder a EXCLUDE de overlap (availability_rental_no_overlap);
//   2. perder o CHECK de quantity (rentable_quantity_single_unless_equipment);
//   3. QUALQUER migration fizer DROP CONSTRAINT de uma delas (remoção do hardening).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIG = join(ROOT, 'migrations');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const OVERLAP = 'availability_rental_no_overlap';
const QUANTITY = 'rentable_quantity_single_unless_equipment';
const failures = [];

const files = existsSync(MIG) ? readdirSync(MIG).filter((n) => n.endsWith('.sql')) : [];

// (1)(2) a migration de hardening existe e materializa as duas constraints com a semântica correta.
const hardening = files.find((n) => /trava3_availability_overlap_quantity_hardening\.sql$/.test(n));
if (!hardening) {
  failures.push('migration *_trava3_availability_overlap_quantity_hardening.sql ausente — hardening de banco não materializado.');
} else {
  const sql = stripSql(readFileSync(join(MIG, hardening), 'utf-8'));
  // A — EXCLUDE de overlap por recurso, ativo, com range temporal.
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${OVERLAP}[\\s\\S]{0,400}?EXCLUDE\\s+USING\\s+gist`, 'i').test(sql))
    failures.push(`migration: constraint ${OVERLAP} não é EXCLUDE USING gist.`);
  if (!/tstzrange\(\s*start_datetime\s*,\s*end_datetime[\s\S]{0,40}?&&/i.test(sql))
    failures.push('migration: EXCLUDE de overlap sem tstzrange(start_datetime,end_datetime) WITH &&.');
  if (!/owner_type\s*=\s*'rentable_resource'[\s\S]{0,60}?status\s*=\s*'active'/i.test(sql))
    failures.push('migration: EXCLUDE de overlap sem partial WHERE (owner_type=rentable_resource AND status=active) — afetaria outros domínios/janelas pausadas.');
  if (!/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+btree_gist/i.test(sql))
    failures.push('migration: btree_gist não garantido (EXCLUDE com = em uuid + && em range exige).');
  // B — CHECK quantity por tipo.
  if (!new RegExp(`ADD\\s+CONSTRAINT\\s+${QUANTITY}[\\s\\S]{0,200}?CHECK`, 'i').test(sql))
    failures.push(`migration: constraint ${QUANTITY} não é CHECK.`);
  if (!/resource_type\s*=\s*'equipment'\s+OR\s+quantity\s*=\s*1/i.test(sql))
    failures.push('migration: CHECK de quantity não é (resource_type=equipment OR quantity=1).');
}

// (3) nenhuma migration remove as constraints (anti-regressão do hardening).
for (const n of files) {
  const sql = stripSql(readFileSync(join(MIG, n), 'utf-8'));
  for (const c of [OVERLAP, QUANTITY]) {
    if (new RegExp(`DROP\\s+CONSTRAINT\\s+(IF\\s+EXISTS\\s+)?${c}\\b`, 'i').test(sql))
      failures.push(`${n}: DROP CONSTRAINT ${c} — remoção do hardening de banco (proibido).`);
  }
}

if (failures.length) {
  console.log('GATE FAIL [rental-hardening-constraints]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log('\n→ Hardening de banco de Locações (overlap + quantity) quebrado. Não remova as constraints; o service protege ANTES, mas o banco é a última linha.');
  process.exit(1);
}
console.log('GATE OK [rental-hardening-constraints] — banco blinda overlap de janelas macro (EXCLUDE gist, partial rentable_resource/active) + quantity>1 só p/ equipment (CHECK); nenhuma migration remove as constraints.');

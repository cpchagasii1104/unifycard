// audit-suppliers-identity-boundary.mjs — F-SUPPLIERS-IDENTITY-BOUNDARY (2026-07-07)
// Blinda a fronteira de IDENTIDADE de suppliers ANTES de nascer dado real (sistema virgem).
// Regra (Clayton + 2ª IA):
//  1. actor_relationships (typed-edge) = fonte única de "é meu cliente/fornecedor/parceiro".
//  2. Actor/Identity = fonte única de "quem é essa pessoa/empresa".
//  3. suppliers NÃO pode virar fonte PARALELA de identidade:
//     A) supplier COM actor_id → identidade vem do actor; name/tax_id são snapshot NÃO-autoritativo.
//     B) supplier SEM actor_id → registro externo operacional; NÃO é actor (sem plateia/autoridade/
//        dinheiro interno/relação tipada até onboarding).
// Guard PREVENTIVO: nenhum módulo de identidade/autoridade/plateia/dinheiro pode LER suppliers.
// {name,tax_id,email} como fonte de verdade. O off-platform (actor_id NULL) é preservado (não removido).
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
let fail = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  OK ' : '  ❌ '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail++;
};
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1) A ponte typed-edge existe (actor_id nullable — off-platform legítimo, NÃO removido sem RFC).
const mig = read(join(root, 'migrations/20260704120000_actor_relationships_typed_edge.sql'));
check('ponte suppliers.actor_id (nullable) existe', /ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES actors\(id\) ON DELETE SET NULL/.test(mig));

// 2) Reconciliação: writer valida que actor_id aponta pra actor real (não aceita lixo).
const svc = strip(read(join(SRC, 'modules/marketplace/supplier.service.ts')));
check('writer valida actor_id contra actors (assertActorExists)', /assertActorExists/.test(svc));

// 3) ANTI-REGRESSÃO (o coração): módulos de identidade/autoridade/plateia/dinheiro NÃO leem
//    suppliers.{name,tax_id,email} como fonte. Se aparecer, é identidade paralela nascendo.
const SENSITIVE_DIRS = [
  'core/audience', 'core/authorization', 'core/identity', 'modules/identity',
  'modules/authority', 'modules/relationships', 'modules/risk-identity', 'modules/bank',
];
const IDENTITY_FROM_SUPPLIER = /suppliers?\.(tax_id|taxId|name|email|registration_number)/i;
let offenders = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else if (extname(full) === '.ts') {
      const code = strip(read(full));
      if (IDENTITY_FROM_SUPPLIER.test(code)) offenders.push(full.replace(SRC, '').replace(/\\/g, '/'));
    }
  }
};
for (const d of SENSITIVE_DIRS) walk(join(SRC, d));
check('nenhum módulo identidade/autoridade/plateia/dinheiro lê suppliers.{name,tax_id,email}',
  offenders.length === 0, offenders.join(', '));

// 4) Writer único: suppliers só é ESCRITO por supplier.repository (CRUD legítimo do CRM).
const writers = [];
const walkWriters = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walkWriters(full);
    else if (extname(full) === '.ts') {
      const code = strip(read(full));
      if (/(INSERT\s+INTO\s+suppliers|UPDATE\s+suppliers)\b/i.test(code)) {
        const rel = full.replace(SRC, '').replace(/\\/g, '/');
        // supplier.repository = writer de produto; scripts/ = seeds de teste E2E (legítimos, não runtime)
        if (!/supplier\.repository\.ts$/.test(rel) && !rel.startsWith('/scripts/')) writers.push(rel);
      }
    }
  }
};
walkWriters(SRC);
check('writer único de suppliers (só supplier.repository)', writers.length === 0, writers.join(', '));

if (fail) { console.log(`\nSUPPLIERS-IDENTITY-BOUNDARY: FAIL (${fail})`); process.exit(1); }
console.log('\nSUPPLIERS-IDENTITY-BOUNDARY: OK');

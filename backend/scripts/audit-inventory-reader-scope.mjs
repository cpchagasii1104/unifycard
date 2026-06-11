#!/usr/bin/env node
// Gate G1 — F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL
// Inventário ESTRUTURAL e HONESTO dos readers de `inventory_movements`.
//
// Objetivo (DECISION-0116 ACTOR_PRIVATE / DT-SHARED-TENANT-RESOURCE-VISIBILITY):
//   - todo reader vivo de inventory_movements deve estar CLASSIFICADO no manifesto;
//   - reader novo não-classificado => FALHA (NEW_UNCLASSIFIED);
//   - as 2 folhas corrigidas nesta fatia não podem regredir (FORBIDDEN_REGRESSION);
//   - readers ainda abertos ficam como DÍVIDA EXPLÍCITA (KNOWN_OPEN), nunca "seguros".
//
// Este gate é ESPECÍFICO de inventory (não é linter genérico). NÃO imprime
// "inventory isolation fully safe": o galho permanece PARCIAL/OPEN enquanto houver KNOWN_OPEN.
//
// Categorias:
//   SCOPED_APPROVED     — leitura escopada por actor_id / company_actors, ou interna não-exposta.
//   KNOWN_OPEN          — reader tenant-wide real ainda pendente (com DT própria). Dívida, não aprovação.
//   FORBIDDEN_REGRESSION — checagens de rota: as 2 folhas corrigidas não podem voltar.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(process.cwd(), 'src');

// Detecta leitura de inventory_movements em contexto SQL (FROM/JOIN).
const READER_PATTERN = /\b(FROM|JOIN)\s+inventory_movements\b/i;

// Arquivos excluídos do inventário de readers (não são superfícies de produto):
const EXCLUDE = ['__tests__', '.spec.', '.test.', '/scripts/', '\\scripts\\'];

// ── MANIFESTO: todo arquivo que lê inventory_movements DEVE estar aqui. ──────────────
// chave = caminho relativo a src/ (com '/'); valor = { category, reason }.
const MANIFEST = {
  // SCOPED_APPROVED — leitura escopada por actor/company, ou interna não-exposta via HTTP.
  'modules/marketplace/inventory-movement.repository.ts': {
    category: 'SCOPED_APPROVED',
    reason: 'Repo: by-actor (calculateBalanceByActor) + consolidado empresarial (calculateConsolidatedBalanceByCompany) escopados; métodos tenant-wide (calculateBalance/getMovementsByVariant) não são mais expostos por rota (balance=501; movements exige actorId — ver FORBIDDEN_REGRESSION).',
  },
  'modules/marketplace/inventory-reservation.service.ts': {
    category: 'SCOPED_APPROVED',
    reason: 'Interna: balanceOnClient só em tx de reserva; não exposta via rota HTTP.',
  },
  // KNOWN_OPEN — readers tenant-wide reais, FORA do escopo desta fatia, com DT própria.
  'modules/marketplace/product-visibility.service.ts': {
    category: 'KNOWN_OPEN',
    reason: 'GET /marketplace/products/visible (auth-only) retorna availableQuantity = SUM tenant-wide cross-actor. DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION (OPEN; decisão merchant/oferta).',
  },
  'core/reconciliation/reconciliation.service.ts': {
    category: 'KNOWN_OPEN',
    reason: 'GET /admin/metrics/reconciliation/summary+drift (auth-only, tenantId client-supplied/nullable). DT-INVENTORY-RECONCILIATION-METRICS-INSTITUTIONAL-AUTHORITY-MISSING (OPEN).',
  },
  'modules/reports/inventory-report.service.ts': {
    category: 'KNOWN_OPEN',
    reason: 'GET /reports/inventory (gate fastify.requirePermission → actor_has_permission STUB FALSE = stub-dead). Reactivation-trap FASE 6 — escopar antes de ligar RBAC. DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP.',
  },
  'modules/marketplace/inventory-sla.service.ts': {
    category: 'KNOWN_OPEN',
    reason: 'GET /reports/inventory/aging|holding-costs|suggestions (gate stub-dead FASE 6; getStockAging ignora actorId). Reactivation-trap. DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP.',
  },
};

function walk(dir, files = []) {
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

function rel(file) {
  return file.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\/src\//, '').replace(/^src\//, '');
}

const failures = [];
let newUnclassified = 0;
let knownOpen = 0;

// 1) Inventário de readers vivos.
const readerFiles = new Set();
for (const file of walk(ROOT)) {
  const r = file.replace(process.cwd(), '').replace(/\\/g, '/');
  if (EXCLUDE.some((e) => r.includes(e))) continue;
  const content = readFileSync(file, 'utf-8');
  if (READER_PATTERN.test(content)) {
    readerFiles.add(rel(file));
  }
}

for (const r of readerFiles) {
  const entry = MANIFEST[r];
  if (!entry) {
    newUnclassified++;
    failures.push(`NEW_UNCLASSIFIED reader of inventory_movements (classifique no manifesto + abra DT): ${r}`);
  } else if (entry.category === 'KNOWN_OPEN') {
    knownOpen++;
  }
}

// 2) Readers do manifesto que SUMIRAM do código (mudaram de arquivo/função e escaparam do inventário).
for (const k of Object.keys(MANIFEST)) {
  if (!readerFiles.has(k)) {
    failures.push(`MANIFEST reader desapareceu do inventário (mudou de arquivo/função?): ${k} — re-verifique antes de remover do baseline.`);
  }
}

// 3) FORBIDDEN_REGRESSION — as 2 folhas corrigidas nesta fatia.
let fixedRegression = 0;
const routesPath = join(ROOT, 'modules/marketplace/routes/marketplace-inventory.routes.ts');
const routesSrc = readFileSync(routesPath, 'utf-8');

// 3a) balance tenant-wide deve ser tombstone 501 — NÃO pode chamar getCurrentBalance/calculateBalance.
const balanceBlock = routesSrc.split("'/inventory/balance/by-actor'")[0]; // só o trecho do balance simples
if (/INVENTORY_TENANT_WIDE_BALANCE_DISABLED/.test(balanceBlock) && !/getCurrentBalance\(/.test(balanceBlock)) {
  fixedRegression++;
} else {
  failures.push('FORBIDDEN_REGRESSION: GET /inventory/balance voltou a executar saldo tenant-wide (deve ser 501 INVENTORY_TENANT_WIDE_BALANCE_DISABLED, sem getCurrentBalance).');
}

// 3b) movements deve exigir actorId — INVENTORY_ACTOR_ID_REQUIRED presente.
if (/INVENTORY_ACTOR_ID_REQUIRED/.test(routesSrc)) {
  fixedRegression++;
} else {
  failures.push('FORBIDDEN_REGRESSION: GET /inventory/movements deixou de exigir actorId (falta INVENTORY_ACTOR_ID_REQUIRED → leak tenant-wide itemizado).');
}

// ── Saída honesta ───────────────────────────────────────────────────────────────────
console.log('[inventory-reader-scope] inventário de readers de inventory_movements:');
for (const r of [...readerFiles].sort()) {
  const e = MANIFEST[r];
  console.log(`  - ${r}: ${e ? e.category : 'NEW_UNCLASSIFIED'}`);
}
console.log(`KNOWN_OPEN=${knownOpen}`);
console.log(`NEW_UNCLASSIFIED=${newUnclassified}`);
console.log(`FIXED_REGRESSION=${fixedRegression}`);
console.log('[inventory-reader-scope] galho de isolamento de inventory permanece PARCIAL/OPEN enquanto KNOWN_OPEN > 0.');

if (failures.length > 0) {
  console.error('GATE FAIL [inventory-reader-scope]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [inventory-reader-scope] — 2 folhas (balance tenant-wide / movements sem actorId) fechadas; readers KNOWN_OPEN seguem como dívida explícita (não aprovada).');

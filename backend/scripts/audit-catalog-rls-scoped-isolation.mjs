#!/usr/bin/env node
// Guard estrutural — F-CATALOG-RLS-SCOPED-ISOLATION (DT-CATALOG-RLS-SCOPED-NO-ISOLATION).
// canonical_services/canonical_catalog_events ficaram fora do hardening de RLS de 20260620120000.
// Corrigido: migration aplica RLS+FORCE nas 2 tabelas (canonical_services leitura+escrita;
// canonical_catalog_events só leitura, escrita permanece permissiva — fluxo de produto fora de
// escopo). canonical-service.service.ts refatorado para NUNCA usar pool.query cru nesta tabela —
// todo acesso passa por getClientWithTenant (tenant) ou getClientWithPlatformAdmin (curadoria
// cross-tenant, admin-only).
//
// MORDE:
//   (A) migration de RLS sumir ou perder ENABLE+FORCE em qualquer uma das 2 tabelas;
//   (B) canonical-service.service.ts voltar a usar `pool.query` diretamente em `canonical_services`
//       (regressão exata do bug: RLS sem contexto = tabela para de responder, OU pior, alguém
//       reverte a RLS pra "resolver" o erro);
//   (C) getClientWithPlatformAdmin sumir de pool.ts;
//   (D) catalog-curation.service.ts::listPending voltar a usar pool.query cru na query de
//       canonical_services (perderia o admin-bypass, quebraria a fila cross-tenant).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const failures = [];

// (A) migration de RLS.
const MIGRATION = join(ROOT, 'migrations', '20260702130000_catalog_rls_scoped_isolation.sql');
if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — DT-CATALOG-RLS-SCOPED-NO-ISOLATION reaberta.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  for (const tbl of ['canonical_services', 'canonical_catalog_events']) {
    if (!new RegExp(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`).test(sql)) {
      failures.push(`${MIGRATION}: ENABLE ROW LEVEL SECURITY ausente para ${tbl}.`);
    }
    if (!new RegExp(`ALTER TABLE ${tbl} FORCE ROW LEVEL SECURITY`).test(sql)) {
      failures.push(`${MIGRATION}: FORCE ROW LEVEL SECURITY ausente para ${tbl}.`);
    }
  }
  if (!/app\.is_platform_admin/.test(sql)) {
    failures.push(`${MIGRATION}: bypass de admin (app.is_platform_admin) ausente — quebraria curadoria cross-tenant.`);
  }
}

// (C) getClientWithPlatformAdmin existe em pool.ts.
const POOL_FILE = join(ROOT, 'src', 'core', 'database', 'pool.ts');
if (!existsSync(POOL_FILE)) {
  failures.push(`arquivo ausente: ${POOL_FILE}`);
} else {
  const src = stripTs(readFileSync(POOL_FILE, 'utf-8'));
  if (!/export async function getClientWithPlatformAdmin/.test(src)) {
    failures.push(`${POOL_FILE}: getClientWithPlatformAdmin ausente.`);
  }
}

// (B) canonical-service.service.ts não usa pool.query em canonical_services.
const CS_SERVICE = join(ROOT, 'src', 'core', 'catalog', 'canonical', 'canonical-service.service.ts');
if (!existsSync(CS_SERVICE)) {
  failures.push(`arquivo ausente: ${CS_SERVICE}`);
} else {
  const src = stripTs(readFileSync(CS_SERVICE, 'utf-8'));
  // pool.query só pode aparecer para a tabela `concepts` (lookup auxiliar em suggest()), nunca
  // diretamente contra canonical_services — todo acesso a canonical_services deve passar por
  // withCtx/client (getClientWithTenant ou getClientWithPlatformAdmin).
  const poolQueryCalls = src.match(/pool\.query[\s\S]{0,200}/g) || [];
  const touchesCanonicalServices = poolQueryCalls.filter((call) => /canonical_services/.test(call));
  if (touchesCanonicalServices.length > 0) {
    failures.push(`${CS_SERVICE}: pool.query cru voltou a tocar canonical_services (regressão — RLS sem contexto quebra ou é bypassada incorretamente).`);
  }
  if (!/getClientWithTenant|getClientWithPlatformAdmin/.test(src)) {
    failures.push(`${CS_SERVICE}: nenhum uso de getClientWithTenant/getClientWithPlatformAdmin — contexto de RLS não estabelecido.`);
  }
}

// (D) catalog-curation.service.ts::listPending usa admin-bypass na query de canonical_services.
const CURATION_SERVICE = join(ROOT, 'src', 'core', 'catalog', 'curation', 'catalog-curation.service.ts');
if (!existsSync(CURATION_SERVICE)) {
  failures.push(`arquivo ausente: ${CURATION_SERVICE}`);
} else {
  const src = stripTs(readFileSync(CURATION_SERVICE, 'utf-8'));
  const listPendingIdx = src.indexOf('async listPending(');
  const nextMethodIdx = src.indexOf('async approveProduct(');
  const listPendingBody = listPendingIdx >= 0 && nextMethodIdx > listPendingIdx ? src.slice(listPendingIdx, nextMethodIdx) : '';
  if (!/getClientWithPlatformAdmin/.test(listPendingBody)) {
    failures.push(`${CURATION_SERVICE}: listPending() não usa getClientWithPlatformAdmin — fila de curadoria cross-tenant quebraria sob RLS.`);
  }
  if (/pool\.query[\s\S]{0,200}canonical_services/.test(listPendingBody)) {
    failures.push(`${CURATION_SERVICE}: listPending() ainda usa pool.query cru em canonical_services.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [catalog-rls-scoped-isolation]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [catalog-rls-scoped-isolation] — RLS+FORCE em canonical_services (leitura+escrita) e canonical_catalog_events (leitura); admin-bypass explícito para curadoria cross-tenant; nenhum pool.query cru toca canonical_services. DT-CATALOG-RLS-SCOPED-NO-ISOLATION blindada.');

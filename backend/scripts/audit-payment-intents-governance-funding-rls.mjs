#!/usr/bin/env node
// Guard estrutural — F-PAYMENT-INTENTS-GOVERNANCE-FUNDING-RLS (achado B3 do auditoria.md).
//
// payment_intents e governance_funding_commitments são tenant_id NOT NULL e ficaram fora do
// hardening de RLS de 20260620120000. Com unificard_app NOBYPASSRLS vivo, um tenant conseguia
// SELECT/UPDATE linhas de OUTRO tenant nessas 2 tabelas — sem isolamento algum.
//
// MORDE: a migration sumir; a policy sumir; FORCE RLS ser removido.
// Heurística textual + leitura de migration. Prova de isolamento REAL é feita pelo E2E
// (validate-pipeline-e2e-payment-intents-governance-funding-rls.ts, SET ROLE unificard_app).
// Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const failures = [];
const MIGRATION = join(ROOT, 'migrations', '20260702150000_payment_intents_governance_funding_commitments_rls.sql');

if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — achado B3 (payment_intents/governance_funding_commitments RLS) reaberto.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  for (const tbl of ['payment_intents', 'governance_funding_commitments']) {
    if (!new RegExp(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY`).test(sql)) {
      failures.push(`${MIGRATION}: ENABLE ROW LEVEL SECURITY ausente para ${tbl}.`);
    }
    if (!new RegExp(`ALTER TABLE ${tbl} FORCE ROW LEVEL SECURITY`).test(sql)) {
      failures.push(`${MIGRATION}: FORCE ROW LEVEL SECURITY ausente para ${tbl}.`);
    }
    if (!new RegExp(`CREATE POLICY ${tbl}_rls ON ${tbl}`).test(sql)) {
      failures.push(`${MIGRATION}: policy de isolamento por tenant ausente para ${tbl}.`);
    }
    if (!sql.includes(`current_setting('app.current_tenant', true)`)) {
      failures.push(`${MIGRATION}: policy não referencia app.current_tenant — não parece escopar por tenant.`);
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [payment-intents-governance-funding-rls]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [payment-intents-governance-funding-rls] — RLS+FORCE em payment_intents e governance_funding_commitments (policy tenant + infra_bypass). Achado B3 do auditoria.md blindado (parcial — governance_funding e treasury_accounts ficam de fora, precisam de redesenho próprio).');

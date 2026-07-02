#!/usr/bin/env node
// Guard estrutural — F-GROUP-A-FINANCIAL-TABLES-RLS (varredura colateral do achado B3 do
// auditoria.md). RLS+FORCE em 15 tabelas financeiras "Grupo A" (dormentes/request-driven,
// confirmadas individualmente seguras: worker default-off, ou sem worker/caller algum).
//
// MORDE: a migration sumir; alguma das 15 tabelas perder ENABLE/FORCE ROW LEVEL SECURITY ou a
// policy de isolamento por tenant.
// Heurística textual + leitura de migration. Prova de isolamento REAL é feita pelo E2E
// (validate-pipeline-e2e-group-a-financial-tables-rls.ts, SET ROLE unificard_app, 15 tabelas).
// Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripSql = (s) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const TABLES = [
  'bank_settlements', 'financial_alerts', 'financial_risk_events', 'financial_sla_events',
  'financial_audit_trail', 'escrow_accounts', 'escrow_transactions', 'payment_milestones',
  'financial_circuit_breakers', 'financial_disputes', 'financial_freezes', 'financial_rate_limits',
  'payout_requests', 'actor_bank_destinations', 'event_financial_execution',
];

const failures = [];
const MIGRATION = join(ROOT, 'migrations', '20260702160000_group_a_financial_tables_rls.sql');

if (!existsSync(MIGRATION)) {
  failures.push(`migration ausente: ${MIGRATION} — RLS do Grupo A (15 tabelas financeiras) reaberto.`);
} else {
  const sql = stripSql(readFileSync(MIGRATION, 'utf-8'));
  for (const tbl of TABLES) {
    if (!sql.includes(`'${tbl}'`)) {
      failures.push(`${MIGRATION}: tabela ${tbl} ausente do array de RLS em lote.`);
    }
  }
  if (!sql.includes('ENABLE ROW LEVEL SECURITY')) failures.push(`${MIGRATION}: ENABLE ROW LEVEL SECURITY ausente.`);
  if (!sql.includes('FORCE ROW LEVEL SECURITY')) failures.push(`${MIGRATION}: FORCE ROW LEVEL SECURITY ausente.`);
  if (!sql.includes(`app.current_tenant`)) {
    failures.push(`${MIGRATION}: policy não referencia app.current_tenant.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [group-a-financial-tables-rls]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [group-a-financial-tables-rls] — RLS+FORCE em ${TABLES.length} tabelas financeiras do Grupo A (bank_settlements, financial_alerts/risk_events/sla_events/audit_trail/circuit_breakers/disputes/freezes/rate_limits, escrow_accounts/transactions, payment_milestones, payout_requests, actor_bank_destinations, event_financial_execution). Grupo B (governance_funding, governance_financial_actions, treasury_distributions/split_config/split_executions, treasury_accounts) fica de fora -- workers ativos, exige redesenho próprio.`);

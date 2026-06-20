// backend/src/core/database/db-role-rls-preflight.ts
//
// F-DB-ROLE-AND-RLS-HARDENING — pre-flight FAIL-CLOSED da role de banco do runtime.
//
// O Decision Pack constatou "RLS theatre": a app conectava como postgres/superuser, que BYPASSA
// RLS mesmo em tabelas FORCE. Este pre-flight torna o estado inseguro EXPLÍCITO e bloqueante:
//   - em produção (NODE_ENV=production): LANÇA erro fail-closed se a role do runtime for superuser,
//     tiver BYPASSRLS, ou se as tabelas financeiras não tiverem RLS+FORCE+policy;
//   - fora de produção: emite um AVISO ALTO (não bloqueia o boot dev, que ainda usa postgres até a
//     ops trocar para unificard_app), mas a insegurança fica visível e auditável.
//
// NÃO move dinheiro. NÃO abre payout. NÃO liga worker. Apenas inspeciona pg_roles/pg_class/pg_policies.

import { pool } from './pool';
import type { Pool, PoolClient } from 'pg';

// Tabelas payout/approval/recovery que DEVEM estar RLS+FORCE+policy para money runtime ser seguro.
// NOTA: as tabelas SSOT bancárias (ledger/transactions/accounts/splits) já são RLS+FORCE desde
// 20260516100000 e protegidas pelo bank-ledger-boundary guard — NÃO são re-listadas aqui para não
// violar NO_DIRECT_BANK_TABLE_ACCESS (referência direta a tabela bancária fora do domínio autorizado).
export const RLS_REQUIRED_FINANCIAL_TABLES = [
  'actor_wallet_payout_requests',
  'financial_approval_policies',
  'financial_approval_authorities',
  'financial_approval_policy_events',
  'approval_requests',
  'actor_wallet_recovery_obligations',
  'actor_wallet_recovery_obligation_entries',
] as const;

export type DbRoleRlsUnsafeCode =
  | 'DB_ROLE_IS_SUPERUSER'
  | 'DB_ROLE_BYPASSRLS'
  | 'RLS_REQUIRED_TABLE_DISABLED'
  | 'RLS_REQUIRED_POLICY_MISSING'
  | 'DB_ROLE_RLS_UNSAFE';

export class DbRoleRlsUnsafeError extends Error {
  constructor(public readonly code: DbRoleRlsUnsafeCode, message: string, public readonly reasons: string[] = []) {
    super(message);
    this.name = 'DbRoleRlsUnsafeError';
  }
}

export interface DbRoleRlsReport {
  currentUser: string;
  isSuperuser: boolean;
  bypassRls: boolean;
  tables: Array<{ table: string; exists: boolean; rls: boolean; force: boolean; hasPolicy: boolean }>;
  unsafeReasons: string[];
  safe: boolean;
}

type Queryable = Pick<Pool, 'query'> | PoolClient;

/** Inspeção READ-ONLY do estado de segurança da role/RLS. Não lança; retorna o relatório. */
export async function inspectDbRoleSecurity(client?: Queryable): Promise<DbRoleRlsReport> {
  const db: Queryable = client ?? pool;

  const roleRow = (await db.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    `SELECT rolname, rolsuper, rolbypassrls
       FROM pg_roles
      WHERE rolname = current_user`
  )).rows[0];

  const currentUser = roleRow?.rolname ?? 'unknown';
  const isSuperuser = Boolean(roleRow?.rolsuper);
  const bypassRls = Boolean(roleRow?.rolbypassrls);

  const tableState = (await db.query<{
    relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; policy_count: number;
  }>(
    `SELECT c.relname,
            c.relrowsecurity,
            c.relforcerowsecurity,
            (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename = c.relname)::int AS policy_count
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1::text[])`,
    [RLS_REQUIRED_FINANCIAL_TABLES as unknown as string[]]
  )).rows;

  const byName = new Map(tableState.map((r) => [r.relname, r]));
  const tables = RLS_REQUIRED_FINANCIAL_TABLES.map((t) => {
    const row = byName.get(t);
    return {
      table: t,
      exists: Boolean(row),
      rls: Boolean(row?.relrowsecurity),
      force: Boolean(row?.relforcerowsecurity),
      hasPolicy: (row?.policy_count ?? 0) > 0,
    };
  });

  const unsafeReasons: string[] = [];
  if (isSuperuser) unsafeReasons.push(`DB_ROLE_IS_SUPERUSER: runtime role "${currentUser}" é superuser (bypassa RLS).`);
  if (bypassRls) unsafeReasons.push(`DB_ROLE_BYPASSRLS: runtime role "${currentUser}" tem BYPASSRLS (ignora policies).`);
  for (const t of tables) {
    if (!t.exists) continue; // tabela ausente (perfil de migração parcial) não é foco deste pre-flight
    if (!t.rls || !t.force) unsafeReasons.push(`RLS_REQUIRED_TABLE_DISABLED: ${t.table} sem ENABLE/FORCE RLS (rls=${t.rls} force=${t.force}).`);
    else if (!t.hasPolicy) unsafeReasons.push(`RLS_REQUIRED_POLICY_MISSING: ${t.table} sem policy.`);
  }

  return { currentUser, isSuperuser, bypassRls, tables, unsafeReasons, safe: unsafeReasons.length === 0 };
}

/**
 * FAIL-CLOSED: lança DbRoleRlsUnsafeError se o money runtime estiver inseguro.
 * Use no caminho de money runtime real (boot em produção / antes de armar payout/worker).
 */
export async function assertSecureDbRoleForMoneyRuntime(client?: Queryable): Promise<DbRoleRlsReport> {
  const report = await inspectDbRoleSecurity(client);
  if (!report.safe) {
    // código primário = o primeiro motivo mais grave (superuser > bypassrls > tabela > policy)
    const primary: DbRoleRlsUnsafeCode = report.isSuperuser
      ? 'DB_ROLE_IS_SUPERUSER'
      : report.bypassRls
      ? 'DB_ROLE_BYPASSRLS'
      : report.unsafeReasons.some((r) => r.startsWith('RLS_REQUIRED_TABLE_DISABLED'))
      ? 'RLS_REQUIRED_TABLE_DISABLED'
      : report.unsafeReasons.some((r) => r.startsWith('RLS_REQUIRED_POLICY_MISSING'))
      ? 'RLS_REQUIRED_POLICY_MISSING'
      : 'DB_ROLE_RLS_UNSAFE';
    throw new DbRoleRlsUnsafeError(
      primary,
      `DB_ROLE_RLS_UNSAFE: money runtime recusado — role/RLS inseguros (${report.currentUser}). ` +
        report.unsafeReasons.join(' '),
      report.unsafeReasons
    );
  }
  return report;
}

/**
 * Pre-flight de BOOT. Em produção: fail-closed (lança). Fora de produção: aviso ALTO não-bloqueante
 * (o dev ainda roda como postgres até a ops trocar para unificard_app). Sempre observável.
 */
export async function runDbRoleRlsPreflight(): Promise<DbRoleRlsReport> {
  const isProduction = process.env.NODE_ENV === 'production';
  let report: DbRoleRlsReport;
  try {
    report = await inspectDbRoleSecurity();
  } catch (err) {
    // Falha de inspeção em produção é fail-closed; fora de produção, avisa e segue.
    if (isProduction) throw new DbRoleRlsUnsafeError('DB_ROLE_RLS_UNSAFE', `DB role/RLS pre-flight não pôde inspecionar o banco: ${err instanceof Error ? err.message : String(err)}`);
    console.warn('⚠️ [DB-ROLE-RLS-PREFLIGHT] inspeção falhou (não-bloqueante fora de produção):', err);
    return { currentUser: 'unknown', isSuperuser: false, bypassRls: false, tables: [], unsafeReasons: ['inspect_failed'], safe: false };
  }

  if (report.safe) {
    console.log(`✅ [DB-ROLE-RLS-PREFLIGHT] role="${report.currentUser}" NOSUPERUSER/NOBYPASSRLS; RLS+FORCE+policy OK nas tabelas financeiras.`);
    return report;
  }

  const banner = [
    '='.repeat(60),
    '🔒 [DB-ROLE-RLS-PREFLIGHT] DB ROLE/RLS INSEGURO PARA MONEY RUNTIME',
    '='.repeat(60),
    `role do runtime: ${report.currentUser}`,
    ...report.unsafeReasons.map((r) => `  - ${r}`),
    'Ação: rodar como unificard_app (NOSUPERUSER/NOBYPASSRLS) e garantir RLS+FORCE+policy.',
    '='.repeat(60),
  ].join('\n');

  if (isProduction) {
    console.error(banner);
    throw new DbRoleRlsUnsafeError(
      report.isSuperuser ? 'DB_ROLE_IS_SUPERUSER' : report.bypassRls ? 'DB_ROLE_BYPASSRLS' : 'DB_ROLE_RLS_UNSAFE',
      'DB_ROLE_RLS_UNSAFE: boot de produção recusado — role/RLS inseguros. ' + report.unsafeReasons.join(' '),
      report.unsafeReasons
    );
  }

  // Não-produção: aviso alto, boot continua (dev ainda usa postgres até a troca operacional).
  console.warn(banner);
  console.warn('⚠️ [DB-ROLE-RLS-PREFLIGHT] prosseguindo SOMENTE por ser ambiente não-produção. Money runtime real exige correção.');
  return report;
}

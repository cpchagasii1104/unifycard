/**
 * F2 — DECISION-0062: backfill idempotente de `identities` a partir de
 * `global_users.cpf`, para `global_user_id` distintos que ainda não possuem
 * identity row.
 *
 * Hipótese A (DECISION-0062) gradual: F2 é a fase de backfill audit-driven
 * antes de F3 (E2E coerência) → F4 (migrar leitura CORE) → F5 (deprecar
 * `user_profiles.cpf` e `profiles.cpf`).
 *
 * Pré-requisitos:
 *   - DECISION-0062 vigente (commit 2b8fbd17)
 *   - F0.1 concluída: `bank-balance-by-cpf.service.ts` já lê `global_users.cpf`
 *   - F1 audit confirmou 11 global_user_id distintos elegíveis (HEAD 6d4fbcb2)
 *
 * Regras canonizadas:
 *   - `identities.tax_id` é SSOT operacional global (D2).
 *   - `global_users.cpf` é âncora canônica, imutável após criação (D4).
 *   - Esta fase **insere apenas** rows novas com `ON CONFLICT (global_user_id)
 *     DO NOTHING`. NUNCA UPDATE em identity existente. NUNCA sobrescreve
 *     `tax_id`. NUNCA toca `global_users.cpf` / `user_profiles.cpf` /
 *     `profiles.cpf`.
 *   - Default = dry-run. Apply só com `--apply` explícito.
 *
 * Bloqueios materiais (rejeitados antes do INSERT):
 *   - CPF sintético (`syn:%`)
 *   - CPF formato != 11 dígitos (inclui CNPJ na coluna cpf)
 *   - CPF inválido por dígito verificador (`validateCpf` do helper canônico)
 *   - `users.global_user_id` NULL (user sem âncora)
 *   - identity já existente para esse `global_user_id`
 *
 * Logging LGPD-safe: CPFs nunca aparecem em log cru; apenas via
 * `sanitizeCpfForLog` (mascarado).
 *
 * Uso:
 *   pnpm --dir C:/unificard/backend exec tsx \
 *     src/scripts/backfill-identities-from-global-users-cpf.ts
 *   pnpm --dir C:/unificard/backend exec tsx \
 *     src/scripts/backfill-identities-from-global-users-cpf.ts --apply
 */

import dotenv from 'dotenv';
import { join } from 'path';
import type { PoolClient } from 'pg';
import { pool } from '../core/database/pool';
import { normalizeCpf, validateCpf, sanitizeCpfForLog } from '../utils/cpf.validator';

dotenv.config({ path: join(process.cwd(), '.env') });

interface CandidateRow {
  global_user_id: string;
  cpf_raw: string;
  user_rows: number;
}

interface ClassifiedCandidate {
  global_user_id: string;
  cpf_normalized: string;
  cpf_masked: string;
  status:
    | 'VALID_FOR_INSERT'
    | 'BLOCKED_SYNTHETIC'
    | 'BLOCKED_INVALID_LENGTH'
    | 'BLOCKED_INVALID_DIGITS';
  reason?: string;
}

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes('--apply') };
}

async function fetchCandidates(): Promise<CandidateRow[]> {
  // Critério estrito de F1 audit:
  //   - users.global_user_id IS NOT NULL
  //   - global_users.cpf NÃO sintético
  //   - global_users.cpf 11 dígitos normalizados
  //   - identities row ausente
  // A validação de dígitos verificadores é feita em TypeScript com
  // validateCpf (helper canônico).
  const result = await pool.query<CandidateRow>(
    `
    SELECT
      gu.global_user_id::text AS global_user_id,
      gu.cpf AS cpf_raw,
      COUNT(u.id)::int AS user_rows
    FROM global_users gu
    JOIN users u ON u.global_user_id = gu.global_user_id
    LEFT JOIN identities i ON i.global_user_id = gu.global_user_id
    WHERE u.global_user_id IS NOT NULL
      AND gu.cpf IS NOT NULL
      AND gu.cpf NOT LIKE 'syn:%'
      AND length(regexp_replace(gu.cpf, '\\D', '', 'g')) = 11
      AND i.global_user_id IS NULL
    GROUP BY gu.global_user_id, gu.cpf
    ORDER BY gu.global_user_id
    `
  );
  return result.rows;
}

function classifyCandidate(row: CandidateRow): ClassifiedCandidate {
  const cpfRaw = row.cpf_raw ?? '';

  if (cpfRaw.startsWith('syn:')) {
    return {
      global_user_id: row.global_user_id,
      cpf_normalized: '',
      cpf_masked: 'syn:***',
      status: 'BLOCKED_SYNTHETIC',
      reason: 'global_users.cpf is synthetic placeholder',
    };
  }

  const normalized = normalizeCpf(cpfRaw);
  const masked = sanitizeCpfForLog(normalized);

  if (normalized.length !== 11) {
    return {
      global_user_id: row.global_user_id,
      cpf_normalized: normalized,
      cpf_masked: masked,
      status: 'BLOCKED_INVALID_LENGTH',
      reason: `normalized length=${normalized.length} (expected 11 for cpf)`,
    };
  }

  if (!validateCpf(normalized)) {
    return {
      global_user_id: row.global_user_id,
      cpf_normalized: normalized,
      cpf_masked: masked,
      status: 'BLOCKED_INVALID_DIGITS',
      reason: 'CPF check digits invalid',
    };
  }

  return {
    global_user_id: row.global_user_id,
    cpf_normalized: normalized,
    cpf_masked: masked,
    status: 'VALID_FOR_INSERT',
  };
}

async function insertIdentity(
  client: PoolClient,
  global_user_id: string,
  tax_id: string
): Promise<{ inserted: boolean; existed_pre_insert: boolean }> {
  const result = await client.query<{ global_user_id: string }>(
    `
    INSERT INTO identities (
      global_user_id,
      tax_id,
      tax_id_type,
      kyc_status,
      kyc_level
    )
    VALUES ($1::uuid, $2, 'cpf', 'pending', 'none')
    ON CONFLICT (global_user_id) DO NOTHING
    RETURNING global_user_id
    `,
    [global_user_id, tax_id]
  );
  // RETURNING vem vazio quando ON CONFLICT pula a inserção.
  const inserted = result.rowCount === 1;
  return { inserted, existed_pre_insert: !inserted };
}

async function main(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));
  const mode = apply ? 'APPLY' : 'DRY-RUN';

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`F2 DECISION-0062 — Backfill identities from global_users.cpf`);
  console.log(`Mode: ${mode}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log();

  // Snapshot pré-backfill
  const pre = await pool.query<{ identities_total: string }>(
    `SELECT COUNT(*)::text AS identities_total FROM identities`
  );
  const preCount = parseInt(pre.rows[0]!.identities_total, 10);
  console.log(`[pre] identities total: ${preCount}`);

  const candidates = await fetchCandidates();
  console.log(`[scan] candidates from SQL filter: ${candidates.length}`);

  const classified = candidates.map(classifyCandidate);
  const validForInsert = classified.filter((c) => c.status === 'VALID_FOR_INSERT');
  const blockedSynthetic = classified.filter((c) => c.status === 'BLOCKED_SYNTHETIC');
  const blockedLength = classified.filter((c) => c.status === 'BLOCKED_INVALID_LENGTH');
  const blockedDigits = classified.filter((c) => c.status === 'BLOCKED_INVALID_DIGITS');

  console.log();
  console.log('--- classification ---');
  console.log(`VALID_FOR_INSERT:        ${validForInsert.length}`);
  console.log(`BLOCKED_SYNTHETIC:       ${blockedSynthetic.length}`);
  console.log(`BLOCKED_INVALID_LENGTH:  ${blockedLength.length}`);
  console.log(`BLOCKED_INVALID_DIGITS:  ${blockedDigits.length}`);
  console.log();

  if (validForInsert.length > 0) {
    console.log('--- VALID_FOR_INSERT (will be inserted on apply) ---');
    for (const c of validForInsert) {
      console.log(`  guid=${c.global_user_id.slice(0, 8)}... cpf=${c.cpf_masked}`);
    }
    console.log();
  }

  if (blockedSynthetic.length + blockedLength.length + blockedDigits.length > 0) {
    console.log('--- BLOCKED (not inserted) ---');
    for (const c of [...blockedSynthetic, ...blockedLength, ...blockedDigits]) {
      console.log(
        `  guid=${c.global_user_id.slice(0, 8)}... status=${c.status} cpf=${c.cpf_masked} reason=${c.reason}`
      );
    }
    console.log();
  }

  if (!apply) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('DRY-RUN — no rows inserted. Re-run with --apply to commit.');
    console.log('═══════════════════════════════════════════════════════════');
    await pool.end();
    return;
  }

  // APPLY mode: insert dentro de transação única
  const client = await pool.connect();
  let inserted = 0;
  let skippedOnConflict = 0;
  const insertedGuids: string[] = [];

  try {
    await client.query('BEGIN');

    for (const c of validForInsert) {
      const result = await insertIdentity(client, c.global_user_id, c.cpf_normalized);
      if (result.inserted) {
        inserted++;
        insertedGuids.push(c.global_user_id);
      } else {
        // ON CONFLICT — identity criada por outra rota entre scan e insert.
        skippedOnConflict++;
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Snapshot pós-backfill
  const post = await pool.query<{ identities_total: string }>(
    `SELECT COUNT(*)::text AS identities_total FROM identities`
  );
  const postCount = parseInt(post.rows[0]!.identities_total, 10);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('APPLY RESULT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Inserts ok:           ${inserted}`);
  console.log(`Skipped on conflict:  ${skippedOnConflict}`);
  console.log(`Blocked total:        ${blockedSynthetic.length + blockedLength.length + blockedDigits.length}`);
  console.log(`identities pre:       ${preCount}`);
  console.log(`identities post:      ${postCount}`);
  console.log(`delta:                ${postCount - preCount}`);
  console.log();
  if (insertedGuids.length > 0) {
    console.log('Inserted global_user_ids:');
    for (const guid of insertedGuids) {
      console.log(`  ${guid}`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

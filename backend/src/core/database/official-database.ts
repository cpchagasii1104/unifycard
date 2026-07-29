// src/core/database/official-database.ts
//
// Nome do banco oficial do UnifiCard (decisão de Clayton, 2026-07-29): unificard_dev.
// unificard_local existiu enquanto o dev não tinha o schema do motor de eventos —
// motivo que expirou quando os dois bancos convergiram (547 migrations / 334 tabelas
// em ambos). A partir daqui, unificard_local é aposentado; qualquer conexão que não
// seja explicitamente contra um alvo efêmero declarado deve recair sobre este nome.
//
// REGRA ÚNICA (aplicada em migrate.ts e no boot da aplicação, sempre contra
// current_database(), nunca contra a string da URL):
//   - EXPECTED_DATABASE_NAME definida  → vence (isolamento dos harnesses efêmeros).
//   - EXPECTED_DATABASE_NAME ausente   → cai em OFFICIAL_DATABASE_NAME. Ausência
//     deixa de ser permissão; é recusa quando o banco conectado não é o oficial.
import type { Pool } from 'pg';

export const OFFICIAL_DATABASE_NAME = 'unificard_dev';

export function resolveExpectedDatabaseName(): string {
  return process.env.EXPECTED_DATABASE_NAME || OFFICIAL_DATABASE_NAME;
}

export async function assertOfficialDatabaseOrDie(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const current = rows[0]!.db;
  const expected = resolveExpectedDatabaseName();
  const source = process.env.EXPECTED_DATABASE_NAME ? 'EXPECTED_DATABASE_NAME' : 'OFFICIAL_DATABASE_NAME (fallback fail-closed)';

  if (current !== expected) {
    console.error(
      `❌ Alvo divergente: current_database='${current}' ≠ esperado='${expected}' (via ${source}) — abortado antes de qualquer operação.`
    );
    process.exit(2);
  }

  console.log(`✅ Alvo confere: current_database='${current}' (via ${source})`);
}

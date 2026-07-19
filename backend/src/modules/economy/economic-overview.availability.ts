// src/modules/economy/economic-overview.availability.ts
// DECISION-0189B D6 — disponibilidade das dependências + resposta sanitizada.
//
// O overview econômico agrega bank_transactions/bank_splits/bank_accounts (SSOT). Antes da
// consulta, verificamos que as relações existem; quando indisponíveis (ou em qualquer erro de
// infra durante a consulta/audit), a rota responde 503 CONTROLADO e SANITIZADO — NUNCA vaza
// error.message, SQLSTATE, SQL ou nome de tabela. O detalhe interno vai só para o log com o
// request/correlation id.

import { pool } from '@core/database/pool';

export const OVERVIEW_REQUIRED_RELATIONS = ['bank_transactions', 'bank_splits', 'bank_accounts'] as const;

/** Verifica a existência das relações-dependência (to_regclass). Não consulta dados. */
export async function overviewDependenciesAvailable(): Promise<{ available: boolean; missing: string[] }> {
  const missing: string[] = [];
  for (const rel of OVERVIEW_REQUIRED_RELATIONS) {
    const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    if (!r.rows[0]?.reg) missing.push(rel);
  }
  return { available: missing.length === 0, missing };
}

/**
 * Corpo 503 SANITIZADO — código estável, sem qualquer detalhe interno. Nunca inclui
 * error.message/SQLSTATE/SQL/nome de tabela. Use SEMPRE que o overview não puder ser servido
 * por indisponibilidade de dependência, erro de infra na consulta ou falha de audit.
 */
export const OVERVIEW_UNAVAILABLE_BODY = { ok: false, code: 'ECONOMIC_OVERVIEW_UNAVAILABLE' } as const;

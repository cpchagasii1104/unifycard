// backend/src/core/unifybank/regional-fund-governance-feature.guard.ts
// F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (achado colateral da Fatia 9
// passo 3, DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST).
//
// 🔴 CONTENÇÃO FAIL-CLOSED de schema ghost. As tabelas `regional_fund_proposals` e
//    `regional_fund_votes` NÃO existem no schema vivo (to_regclass = NULL pras duas). A rota
//    `regional-fund-governance.routes.ts` estava VIVA e REGISTRADA (unifybank.module.ts →
//    app.builder.ts) exigindo só `req.user` — qualquer autenticado alcançava
//    `regionalFundGovernanceService`, que faz INSERT/SELECT em `regional_fund_proposals`/
//    `regional_fund_votes` → 42P01 / 500 cru. Este guard intercepta ANTES do service e devolve
//    falha HONESTA e controlada (501 REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED).
//
// 🔴 NÃO é gênese do schema. NÃO cria tabela, migration, owner, ou dado fake. A gênese de
//    `regional_fund_proposals`/`regional_fund_votes` é frente própria (F-REGIONAL-FUND-
//    GOVERNANCE-SCHEMA-GENESIS) — quando as tabelas existirem, o probe passa a retornar
//    verdadeiro e a feature destrava sozinha (a frente de gênese remove/ajusta este guard).
//
// 🔴 A LÓGICA DE VOTAÇÃO/PROPOSTA (regional-fund-governance.service.ts) NÃO foi tocada nem
//    removida — permanece intacta, pronta para religar quando o schema nascer. Esta contenção é
//    só na BORDA (rota), mesmo padrão de contact.routes.ts.

import { pool } from '@core/database/pool';
import { AppError } from '@core/errors';

export const REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CODE = 'REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED';

// Cache APENAS do positivo: uma tabela não desaparece após criada. Enquanto ausente, re-checa
// (caminho de erro, baixa frequência) — assim a gênese futura é detectada sem exigir restart.
let schemaPresent = false;

/** Probe read-only: as tabelas `regional_fund_proposals`/`regional_fund_votes` existem? */
export async function isRegionalFundGovernanceFeatureAvailable(): Promise<boolean> {
  if (schemaPresent) return true;
  const r = await pool.query<{ proposals: string | null; votes: string | null }>(
    `SELECT to_regclass('public.regional_fund_proposals') AS proposals,
            to_regclass('public.regional_fund_votes') AS votes`
  );
  schemaPresent = r.rows[0]?.proposals != null && r.rows[0]?.votes != null;
  return schemaPresent;
}

/**
 * Fail-closed: lança 501 REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED quando o schema está
 * ausente. Não é chamado hoje (a contenção vive na BORDA da rota, mesmo padrão de contact.*) —
 * existe para uso futuro caso algum service interno precise do mesmo probe.
 */
export async function assertRegionalFundGovernanceFeatureAvailable(): Promise<void> {
  if (await isRegionalFundGovernanceFeatureAvailable()) return;
  throw new AppError(
    501,
    'REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED: a feature de Governança do Fundo Regional não está ' +
      'disponível (tabelas `regional_fund_proposals`/`regional_fund_votes` ausentes no schema vivo). ' +
      'A gênese desse schema é frente própria — esta superfície está contida fail-closed.',
    REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CODE
  );
}

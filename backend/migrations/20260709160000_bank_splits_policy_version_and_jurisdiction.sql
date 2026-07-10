-- 20260709160000_bank_splits_policy_version_and_jurisdiction.sql
-- DECISION-0166 D5 (herda DECISION-0165 D6) — Fase 1 / F1-c da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- Cada split passa a saber QUAL VERSÃO de policy o decidiu e (contrato futuro) QUAL JURISDIÇÃO foi
-- resolvida no momento da transação:
--   policy_version_id     — FK para economic_policies(id). Cada versão de policy É uma linha própria
--                           (UNIQUE tenant+code+version), então o id identifica exatamente a versão.
--                           Com F1-a/F1-b (versão ativa/deprecated congelada + DELETE bloqueado), a
--                           FK aponta para um registro IMUTÁVEL — a explicação do split não muda depois.
--   jurisdiction_snapshot — JSONB imutável (bank_splits já é append-only, 20260623120000) com a
--                           jurisdição resolvida (IDs territoriais canônicos + basis usado). NASCE COMO
--                           CONTRATO NULLABLE: só será preenchido quando as Fases 2-3 criarem o resolver
--                           regional por FK (regional_fund_accounts + regional_level). Nenhum código
--                           preenche nesta fatia — sem snapshot fabricado.
-- NULLABLE + SEM BACKFILL (ordem explícita): splits sem policy canônica (ex.: group_contribution legado
-- em HOLD) ficam NULL — honesto. Aditiva, forward-only, idempotente; não toca dados nem dinheiro; não
-- altera os triggers append-only (ALTER TABLE não é UPDATE de linha).

BEGIN;

ALTER TABLE bank_splits
  ADD COLUMN IF NOT EXISTS policy_version_id UUID NULL REFERENCES economic_policies(id);

ALTER TABLE bank_splits
  ADD COLUMN IF NOT EXISTS jurisdiction_snapshot JSONB NULL;

COMMENT ON COLUMN bank_splits.policy_version_id IS
  'DECISION-0166 D5 / DECISION-0165 D6. FK para a VERSÃO exata de economic_policies que decidiu este split (cada versão = linha própria, congelada pelos triggers de imutabilidade F1-a/F1-b). NULL = split fora do pipeline de policy canônico (legado/HOLD).';

COMMENT ON COLUMN bank_splits.jurisdiction_snapshot IS
  'DECISION-0166 D5. Snapshot imutável da jurisdição resolvida no momento da transação (IDs territoriais canônicos + regional_origin_basis usado). Contrato nullable — preenchido a partir das Fases 2-3 (resolver regional por FK). NUNCA texto livre de geografia.';

-- Índice parcial para auditoria/reconciliação por versão de policy (barato; só linhas com policy).
CREATE INDEX IF NOT EXISTS idx_bank_splits_policy_version
  ON bank_splits(tenant_id, policy_version_id)
  WHERE policy_version_id IS NOT NULL;

COMMIT;

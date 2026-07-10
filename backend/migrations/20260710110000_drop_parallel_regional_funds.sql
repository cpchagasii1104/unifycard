-- 20260710110000_drop_parallel_regional_funds.sql
-- DECISION-0166 D3 + doutrina DECISION-0165 (sistema virgem = EXCISÃO) — Fase 2 / fatia 2d.
--
-- EXCISÃO do trilho paralelo de fundo regional do marketplace legado:
--   regional_funds             — geografia por STRING (country/state/city TEXT) E saldo em coluna
--                                (total_balance_cents) FORA do bank_ledger = dupla verdade paralela.
--   regional_fund_allocations  — irmã do mesmo trilho (alocações fora do Bank).
--
-- PROVAS pré-excisão (registradas no cartório):
--   - regional_funds = 0 rows · regional_fund_allocations = 0 rows (sistema virgem);
--   - NENHUM writer alcançável de rota montada (completeCompanyOnboarding/activatePaymentTerminal/
--     recordRegionalFundCredit sem rota; marketplace-terminal/fund/revenue services sem importador vivo);
--   - leitor residual identificado (economic-metrics.getRegionalFundMetrics, chamado só por script e2e)
--     e CONVERTIDO para o canônico regional_fund_accounts na mesma fatia.
-- Substituto canônico: regional_fund_accounts (FK Location Core, 20260710100000) + bank_ledger (saldo).
-- Nenhum saldo migrado (não há o que migrar e não se preserva coluna de saldo paralela — ordem explícita).
-- Forward-only, idempotente.

BEGIN;

DROP TABLE IF EXISTS regional_fund_allocations;
DROP TABLE IF EXISTS regional_funds;

COMMIT;

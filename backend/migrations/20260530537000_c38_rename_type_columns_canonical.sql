-- C38 Sub-frente 2 — Renomeação de colunas `type` genérico para nome canônico (§3.4)
--
-- Conformidade §3.4 (07_NOMENCLATURA_CANONICA): proibido `type` isolado em
-- contratos públicos / colunas de banco. Exige contexto (entity_type,
-- transaction_type, etc.). Esta migration aplica renomeação mecânica em 4
-- tabelas onde a coluna `type` operava como discriminator local sem nome
-- canônico.
--
-- Diferença vs DECISION-0033: aquela ratificou `canonical_products.type` como
-- exceção formal restrita (discriminator estrutural ontológico). Esta migra
-- as 4 tabelas mecânicas que NÃO se qualificam pelos critérios das 3
-- Restrições de DECISION-0033 — são discriminators operacionais que pedem
-- nome canônico com contexto.
--
-- ALTER TABLE RENAME COLUMN preserva automaticamente CHECK constraints, FKs
-- e índices que referenciem a coluna (PostgreSQL atualiza o texto interno
-- das definições). Logo: enforcement permanece intacto, apenas referenciado
-- pelo novo nome.
--
-- Refs:
-- - 07_NOMENCLATURA_CANONICA §3.4
-- - executei_9.md (mapeamento material)
-- - DECISION-0033 (subcaso ratificado canonical_products)
-- - SYSTEM_REMEDIATION_STATUS C38 OPEN-PARCIAL
-- - Diretiva mestre §1 (convergência ao 07) + §2 (autonomia mecânica)

BEGIN;

-- 1. payment_execution_lock.type → lock_type
--    Coluna sem CHECK; valor único em uso ('settlement') já lowercase.
ALTER TABLE payment_execution_lock RENAME COLUMN type TO lock_type;

-- 2. promotions.type → promotion_type
--    CHECK promotions_type_check: ('percentage'|'fixed') — preservado.
--    CHECK chk_promotions_discount_shape: referencia `type` no shape — preservado.
ALTER TABLE promotions RENAME COLUMN type TO promotion_type;

-- 3. reconciliation_discrepancies.type → discrepancy_type
--    CHECK reconciliation_discrepancies_type_check: ('gateway'|'bank'|'settlement') — preservado.
ALTER TABLE reconciliation_discrepancies RENAME COLUMN type TO discrepancy_type;

-- 4. reconciliation_ledger_discrepancies.type → discrepancy_type
--    CHECK reconciliation_ledger_discrepancies_type_check: 4 valores lowercase — preservado.
ALTER TABLE reconciliation_ledger_discrepancies RENAME COLUMN type TO discrepancy_type;

-- Registro institucional na tabela de migrations.
INSERT INTO schema_migrations (filename) VALUES ('20260530537000_c38_rename_type_columns_canonical.sql')
  ON CONFLICT DO NOTHING;

COMMIT;

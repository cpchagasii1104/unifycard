-- ============================================================
-- F3-S6b — Adiciona created_by_tenant_id em addresses (DECISION-0021)
-- ============================================================
-- Remete a: DECISION-0021 (REMEDIATION_DECISIONS_LOG.md)
-- Frente: F3 — Domain Foundations: Location Core Materialization
-- Contexto: Migration corretiva pós-F3-S6. Adiciona soft-audit de origem
--   em addresses sem alterar comportamento operacional (catálogo global).
--
-- Modelo: Opção A refinada — global compartilhado com auditoria.
-- addresses permanece sem RLS, sem filtro de tenant em queries de runtime.
-- created_by_tenant_id permite rastreabilidade LGPD ("quem criou este dado?")
-- sem overhead de runtime (coluna nunca usada em WHERE/JOIN de negócio).
--
-- Pré-requisito de: F3-S8 (companies.primary_address_id), F3-S9 (LocationRepository)
-- ============================================================

BEGIN;

-- ============================================================
-- ADD COLUMN created_by_tenant_id (soft-audit, NULL permitido)
-- ============================================================
-- NULL preserva histórico onde tenant origem é desconhecido.
-- Preenchido apenas em novas criações via LocationRepository.
-- Nunca usado em filtros de runtime (só auditoria/relatórios).
-- ============================================================

ALTER TABLE addresses
  ADD COLUMN created_by_tenant_id UUID;

-- ============================================================
-- INDEX parcial para auditoria (não para queries de runtime)
-- ============================================================
-- Otimiza queries tipo "mostre endereços criados por tenant X".
-- Parcial (WHERE NOT NULL) economiza espaço em registros legacy/migrados.
-- ============================================================

CREATE INDEX idx_addresses_created_by_tenant
  ON addresses(created_by_tenant_id)
  WHERE created_by_tenant_id IS NOT NULL;

-- ============================================================
-- COMMENT explícito (DECISION-0021)
-- ============================================================

COMMENT ON COLUMN addresses.created_by_tenant_id IS
  'Tenant que criou este endereço. SOFT-AUDIT — apenas rastreabilidade.
   addresses é catálogo geográfico global; leitura/escrita NÃO filtra por tenant.
   Usado para compliance LGPD e queries de auditoria/origem.
   Nunca usado em WHERE/JOIN de queries de runtime de negócio.
   NULL = origem desconhecida (registros legacy ou migrados).
   Remete a: DECISION-0021 (Opção A refinada — global compartilhado com auditoria).';

COMMIT;

-- ============================================================
-- VALIDAÇÃO PÓS-APLICAÇÃO (rodar manualmente após COMMIT)
-- ============================================================
-- Esperado:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='addresses' AND column_name='created_by_tenant_id';
--   -> 1 linha: created_by_tenant_id | uuid | YES
--
--   SELECT indexname FROM pg_indexes
--   WHERE tablename='addresses' AND indexname='idx_addresses_created_by_tenant';
--   -> 1 linha
--
--   SELECT COUNT(*) FROM addresses WHERE created_by_tenant_id IS NOT NULL;
--   -> 0 (banco vazio, sem dados populados ainda)
-- ============================================================

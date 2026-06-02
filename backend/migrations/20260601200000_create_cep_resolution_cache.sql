-- ============================================================
-- F-GEO-1b (DECISION-0078) — cache persistente de resolução de CEP
-- ============================================================
-- Cache técnico (NÃO SSOT) das resoluções de CEP → UF/cidade/IBGE/bairro/logradouro, para evitar re-hit do
-- provider externo (CEP é estável → TTL longo). O SSOT do endereço continua sendo `addresses` + FK
-- (`state_id`/`city_id` por `external_code` IBGE) — este cache é apenas insumo de resolução.
--
-- Vetos (DECISION-0078 §3): SEM raw_response completo (apenas campos úteis + `raw_response_hash` opcional);
-- SEM coordenada precisa de residência (não há colunas lat/lng aqui); SEM JSONB de payload externo; cache
-- NÃO é fonte da verdade de endereço. Migration forward-only/idempotente; NÃO chama internet.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cep_resolution_cache (
  cep_resolution_cache_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_code              TEXT NOT NULL UNIQUE,          -- 8 dígitos normalizados (chave de lookup)
  provider                 TEXT NOT NULL,                 -- 'BRASIL_API' | 'VIA_CEP' | 'MOCK'
  state_code               TEXT,                          -- UF
  city_name                TEXT,
  city_external_code       TEXT,                          -- IBGE (quando o provider trouxer)
  neighborhood_name        TEXT,                          -- texto (NÃO vira FK)
  street                   TEXT,
  source                   TEXT NOT NULL,                 -- 'CEP_RESOLVED' (procedência da resolução)
  resolved_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ,                   -- TTL controlado (NULL = sem expiração)
  raw_response_hash        TEXT,                          -- OPCIONAL: hash de conteúdo (NUNCA payload bruto)
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cep_resolution_cache_postal_code_format
    CHECK (postal_code ~ '^[0-9]{8}$')
);

CREATE INDEX IF NOT EXISTS idx_cep_resolution_cache_external_code
  ON cep_resolution_cache(city_external_code) WHERE city_external_code IS NOT NULL;

COMMENT ON TABLE cep_resolution_cache IS
  'F-GEO-1b/DECISION-0078: cache tecnico de resolucao de CEP (insumo, NAO SSOT). Sem raw payload, sem lat/lng.';

-- VERIFICACAO POS: tabela existe.
DO $$
BEGIN
  IF to_regclass('public.cep_resolution_cache') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: cep_resolution_cache nao foi criada';
  END IF;
END $$;

COMMIT;

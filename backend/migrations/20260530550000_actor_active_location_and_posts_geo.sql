-- ============================================================
-- DECISION-0030 — Localização contextual de actor como entidade
--                 temporal-operacional soberana
-- ============================================================
-- Frente: Feed com raio geográfico (F1 do plano
--         PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md)
-- Contexto: implementar pilar Localização contextual ATIVA do user
--           (separada de localização fiscal soberana — DECISION-0020/0021)
--
-- Mudanças:
--   1. CREATE FUNCTION haversine_distance_km — pattern canônico SQL (Sub-decisão A)
--   2. CREATE TABLE actor_active_location — contexto espacial temporal do actor
--   3. ALTER TABLE posts ADD COLUMN address_id — opt-in geo em posts
--   4. Indexes parciais (otimizam queries de proximidade sem inflar para NULL rows)
--   5. RLS + policy em actor_active_location (LGPD: localização ativa é dado privado)
--
-- Reversibilidade: ALTA
--   - DROP FUNCTION haversine_distance_km
--   - ALTER TABLE posts DROP COLUMN address_id (preserva rows; NULL = sem geo)
--   - DROP TABLE actor_active_location CASCADE
--
-- Blast: BAIXO (tabela nova + coluna nova nullable; nenhum caller existente quebra)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Function haversine_distance_km — pattern canônico (Sub-decisão A de DECISION-0030)
-- ============================================================
-- Calcula distância em km entre dois pontos (lat, lng) via fórmula Haversine.
-- Raio da Terra = 6371 km.
-- Reusável em queries de proximidade (feed + futuros módulos que respeitem
-- pattern canônico decidido em DECISION-0030).
--
-- NÃO usar para módulos operacionais (rides/delivery) sem cruzar com DECISION-0030
-- anti-padrão #1 (cada projeção tem service próprio).
CREATE OR REPLACE FUNCTION haversine_distance_km(
  lat1 NUMERIC,
  lng1 NUMERIC,
  lat2 NUMERIC,
  lng2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  earth_radius_km CONSTANT NUMERIC := 6371;
  d_lat NUMERIC;
  d_lng NUMERIC;
  a NUMERIC;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  d_lat := radians(lat2 - lat1);
  d_lng := radians(lng2 - lng1);
  a := sin(d_lat / 2) * sin(d_lat / 2)
       + cos(radians(lat1)) * cos(radians(lat2))
       * sin(d_lng / 2) * sin(d_lng / 2);
  RETURN earth_radius_km * 2 * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION haversine_distance_km(NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
'DECISION-0030 Sub-decisão A: pattern canônico de cálculo de distância para feed-proximity. NÃO usar em rides/delivery/marketplace sem cruzar com DECISION-0030 anti-padrão #1.';

-- ============================================================
-- 2. Tabela actor_active_location — contexto espacial temporal soberano
-- ============================================================
-- DECISION-0030: localização contextual ATIVA do actor.
-- Separada de address_assignments (DECISION-0020) — role daquela é fiscal/logístico
-- estável; esta é contextual temporal dinâmica.
CREATE TABLE IF NOT EXISTS actor_active_location (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,

  -- Coexistem (Sub-decisão B): ≥1 obrigatório via CHECK
  address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),

  source TEXT NOT NULL CHECK (source IN (
    'USER_INPUT_CITY',
    'BROWSER_GEOLOCATION',
    'IP_ESTIMATE',
    'EXPLICIT_TRAVEL_MODE'
  )),

  scope_level TEXT CHECK (scope_level IN (
    'NEIGHBORHOOD', 'CITY', 'STATE', 'COUNTRY'
  )),

  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sub-decisão B: ao menos uma forma de localização presente
  CONSTRAINT actor_active_location_has_location
    CHECK (address_id IS NOT NULL OR (lat IS NOT NULL AND lng IS NOT NULL))
);

-- Apenas 1 localização ativa por (tenant, actor) — princípio "lente operacional principal"
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_actor_location
  ON actor_active_location (tenant_id, actor_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_actor_active_location_actor
  ON actor_active_location (tenant_id, actor_id, is_active);

CREATE INDEX IF NOT EXISTS idx_actor_active_location_geo
  ON actor_active_location (tenant_id, lat, lng)
  WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL;

-- RLS — localização ativa é dado privado (LGPD)
ALTER TABLE actor_active_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_active_location FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_location_rls ON actor_active_location;
CREATE POLICY active_location_rls ON actor_active_location
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE actor_active_location IS
'DECISION-0030: localização contextual ATIVA do actor (temporal-operacional). Separada de address_assignments (fiscal/logístico estável). LGPD: dado privado, queries server-side only, RLS por tenant.';

COMMENT ON COLUMN actor_active_location.address_id IS
'Referência a hierarquia administrativa canônica (DECISION-0020). Opcional — coexiste com lat/lng.';

COMMENT ON COLUMN actor_active_location.expires_at IS
'TTL opcional. NULL = explicit clear (default). Service layer pode aplicar default operacional.';

COMMENT ON COLUMN actor_active_location.source IS
'Origem da localização. USER_INPUT_CITY = dropdown cidade. BROWSER_GEOLOCATION = W3C API. IP_ESTIMATE = inferência IP. EXPLICIT_TRAVEL_MODE = "estou viajando em X".';

-- ============================================================
-- 3. Adição em posts — opt-in geo
-- ============================================================
-- DECISION-0030 §default-4: post novo opt-in (não auto-marca). LGPD trap evitada.
-- NULL = post global (sem geo); NOT NULL = post com origem geográfica.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'address_id'
  ) THEN
    ALTER TABLE posts
      ADD COLUMN address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_address
  ON posts (tenant_id, address_id)
  WHERE address_id IS NOT NULL;

COMMENT ON COLUMN posts.address_id IS
'DECISION-0030: opt-in geo. NULL = post global (sem filtro). NOT NULL = post com origem geográfica (user marcou local no momento da postagem). ON DELETE SET NULL preserva post se address for apagado.';

COMMIT;

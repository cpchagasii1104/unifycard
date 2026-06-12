-- 20260611160000_media_assets_canonical.sql
-- DECISION-0117 C — mídia canônica CONTENT-ADDRESSED + complemento empresarial.
--
-- media_assets: identidade do CONTEÚDO (sha-256 UNIQUE — reenvio do mesmo
-- arquivo NUNCA cria novo blob), com MIME, tamanho, referência opaca de
-- storage, origem, autoria, licença, versão e estado de moderação.
-- Relações canônicas (produto/variante/serviço ↔ asset) são reutilizáveis;
-- mídia EMPRESARIAL (business_media) é complemento isolado por actor/empresa
-- e NÃO substitui a canônica. `canonical_products.images` JSONB DEIXA DE SER
-- SSOT (permanece apenas como projeção transitória de leitura do seed).
--
-- Aditiva, forward-only, idempotente. Zero Bank. Provider de produção FORA.

BEGIN;

CREATE TABLE IF NOT EXISTS media_assets (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_hash         text NOT NULL,
  mime_type            text NOT NULL,
  size_bytes           bigint NOT NULL CHECK (size_bytes > 0),
  storage_reference    text NOT NULL,
  source               text NOT NULL DEFAULT 'company_suggestion'
                         CHECK (source IN ('company_suggestion','curated','seed')),
  origin_note          text,
  license              text,
  version              integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  moderation_status    text NOT NULL DEFAULT 'pending'
                         CHECK (moderation_status IN ('pending','approved','rejected')),
  created_by_actor_id  uuid REFERENCES actors(id) ON DELETE SET NULL,
  origin_tenant_id     uuid REFERENCES tenants(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Content-addressing absoluto: mesmo conteúdo = mesma identidade de mídia.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_assets_content_hash
  ON media_assets (content_hash);
CREATE INDEX IF NOT EXISTS idx_media_assets_moderation
  ON media_assets (moderation_status) WHERE moderation_status = 'pending';

-- ── Relações CANÔNICAS (reutilizáveis; attach é ato curatorial) ──────────────
CREATE TABLE IF NOT EXISTS canonical_product_media (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id  uuid NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  media_asset_id        uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  media_role            text NOT NULL DEFAULT 'gallery' CHECK (media_role IN ('primary','gallery')),
  position              integer NOT NULL DEFAULT 0,
  created_by_actor_id   uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_product_id, media_asset_id)
);

CREATE TABLE IF NOT EXISTS canonical_variant_media (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_variant_id  uuid NOT NULL REFERENCES canonical_variants(id) ON DELETE CASCADE,
  media_asset_id        uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  media_role            text NOT NULL DEFAULT 'gallery' CHECK (media_role IN ('primary','gallery')),
  position              integer NOT NULL DEFAULT 0,
  created_by_actor_id   uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_variant_id, media_asset_id)
);

CREATE TABLE IF NOT EXISTS canonical_service_media (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_service_id  uuid NOT NULL REFERENCES canonical_services(id) ON DELETE CASCADE,
  media_asset_id        uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  media_role            text NOT NULL DEFAULT 'gallery' CHECK (media_role IN ('primary','gallery')),
  position              integer NOT NULL DEFAULT 0,
  created_by_actor_id   uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_service_id, media_asset_id)
);

-- ── Mídia EMPRESARIAL complementar (isolada por actor; nunca substitui a canônica) ──
CREATE TABLE IF NOT EXISTS business_media (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_actor_id    uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  attached_to_type  text NOT NULL CHECK (attached_to_type IN ('product_offer','service_offering','company','establishment')),
  attached_to_id    uuid NOT NULL,
  media_asset_id    uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  caption           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attached_to_type, attached_to_id, media_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_business_media_owner
  ON business_media (tenant_id, owner_actor_id);
CREATE INDEX IF NOT EXISTS idx_business_media_target
  ON business_media (attached_to_type, attached_to_id);

COMMIT;

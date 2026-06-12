-- 20260612100000_media_asset_contextual_identity.sql
-- DECISION-0118 D1 — F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE.
--
-- CAUSA-RAIZ (reseal Yala, [B1] DT-CANONICAL-MEDIA-LOGICAL-CONTEXT-COLLAPSE):
-- a identidade do asset lógico era só (blob, tenant, actor) — licença/source/
-- finalidade/contexto divergentes colapsavam em silêncio no asset anterior.
--
-- MODELO: asset lógico = DECLARAÇÃO CONTEXTUAL. Identidade = blob + tenant +
-- actor declarante + context_type + context_owner + source + purpose + licença
-- normalizada + provenance normalizada — materializada em COLUNAS REAIS +
-- context_fingerprint (md5 V1) UNIQUE. Moderação fica FORA da identidade.
-- Idempotency key explícita por (tenant, actor) com conflito observável.
--
-- Aditiva, forward-only, idempotente, backfill fail-closed (dev vivo: 0 linhas).
-- media_blobs INTOCADA (dedup física global preservada). Zero Bank.

BEGIN;

-- ── 1. Dimensões contextuais da declaração ───────────────────────────────────
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS context_type text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS context_owner_id uuid;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS context_fingerprint text;

-- ── 2. Backfill dos registros existentes (declarações legadas) ───────────────
-- Uploads históricos passaram pelo fluxo de sugestão canônica empresarial
-- (source='company_suggestion'); curated/seed são contexto de plataforma.
UPDATE media_assets
   SET context_type = CASE WHEN source = 'company_suggestion' THEN 'canonical_suggestion' ELSE 'platform' END
 WHERE context_type IS NULL;
UPDATE media_assets
   SET purpose = CASE WHEN source = 'company_suggestion' THEN 'canonical_catalog' ELSE 'platform_curation' END
 WHERE purpose IS NULL;

-- Fingerprint V1 — fórmula ESPELHADA em computeMediaContextFingerprintV1
-- (backend/src/core/media-assets/media-context-identity.ts): md5 de
-- blob|tenant|actor|context_type|context_owner|source|purpose|license_norm|provenance_norm
-- com NULL→'' e licença/provenance lower(btrim(·)).
UPDATE media_assets
   SET context_fingerprint = md5(
         media_blob_id::text || '|' ||
         COALESCE(origin_tenant_id::text, '') || '|' ||
         COALESCE(created_by_actor_id::text, '') || '|' ||
         context_type || '|' ||
         COALESCE(context_owner_id::text, '') || '|' ||
         source || '|' ||
         purpose || '|' ||
         lower(btrim(COALESCE(license, ''))) || '|' ||
         lower(btrim(COALESCE(origin_note, '')))
       )
 WHERE context_fingerprint IS NULL;

-- Fail-closed: nenhuma declaração pode ficar sem contexto/fingerprint.
DO $$
DECLARE missing integer;
BEGIN
  SELECT count(*) INTO missing FROM media_assets
   WHERE context_type IS NULL OR purpose IS NULL OR context_fingerprint IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'media_asset_contextual_identity: % assets sem contexto após backfill — abortando.', missing;
  END IF;
END $$;

ALTER TABLE media_assets ALTER COLUMN context_type SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN purpose SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN context_fingerprint SET NOT NULL;

-- ── 3. Vocabulário fail-closed do contexto ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_assets_context_type') THEN
    ALTER TABLE media_assets ADD CONSTRAINT chk_media_assets_context_type
      CHECK (context_type IN ('company', 'canonical_suggestion', 'platform'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_assets_purpose') THEN
    ALTER TABLE media_assets ADD CONSTRAINT chk_media_assets_purpose
      CHECK (purpose IN ('business_media', 'canonical_catalog', 'platform_curation'));
  END IF;
  -- Uso EMPRESARIAL exige a empresa dona do contexto (ownership real ≠ autor genérico).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_assets_company_owner') THEN
    ALTER TABLE media_assets ADD CONSTRAINT chk_media_assets_company_owner
      CHECK (context_type <> 'company' OR context_owner_id IS NOT NULL);
  END IF;
END $$;

-- ── 4. Identidade contextual ÚNICA (substitui blob+tenant+actor) ─────────────
DROP INDEX IF EXISTS uidx_media_assets_blob_context;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_assets_context_fingerprint
  ON media_assets (context_fingerprint);

-- Idempotency key explícita: única por (tenant, actor declarante).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_assets_idempotency_key
  ON media_assets (origin_tenant_id, created_by_actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_context_owner
  ON media_assets (origin_tenant_id, context_type, context_owner_id);

COMMIT;

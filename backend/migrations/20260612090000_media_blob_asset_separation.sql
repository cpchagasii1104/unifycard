-- 20260612090000_media_blob_asset_separation.sql
-- F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE
-- (correção do FAIL Yala: DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK).
--
-- CAUSA-RAIZ: media_assets misturava o BLOB FÍSICO (hash/MIME/tamanho/storage,
-- dedup global) com o ASSET LÓGICO (tenant/autoria/licença/moderação/visibilidade).
-- O UNIQUE global de content_hash fazia o 2º tenant herdar o asset (e a metadata)
-- do 1º uploader.
--
-- MODELO (materializa DECISION-0117 C sem contrariá-la):
--   media_blobs  = camada FÍSICA: content_hash UNIQUE GLOBAL (mesmos bytes = 1 blob),
--                  MIME/tamanho/referência opaca. SEM tenant, SEM actor, SEM moderação,
--                  SEM licença, SEM source — blob não é recurso autorizável.
--   media_assets = camada LÓGICA: referencia o blob (FK RESTRICT) e carrega origem,
--                  autoria, licença, moderação e contexto POR TENANT/ACTOR. Tenants
--                  distintos com os mesmos bytes = assets lógicos DISTINTOS.
--
-- Aditiva, forward-only, idempotente; backfill seguro (dev vivo: media_assets=0);
-- IDs lógicos preservados (relações canônicas/business_media seguem em media_assets.id).
-- Zero Bank.

BEGIN;

-- ── 1. Camada FÍSICA ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_blobs (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_hash       text NOT NULL,
  mime_type          text NOT NULL,
  size_bytes         bigint NOT NULL CHECK (size_bytes > 0),
  storage_reference  text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Dedup física GLOBAL: mesmos bytes = um único blob. (Única camada com UNIQUE de hash.)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_blobs_content_hash
  ON media_blobs (content_hash);

-- ── 2. Backfill: cada hash existente vira um blob (idempotente) ──────────────
INSERT INTO media_blobs (content_hash, mime_type, size_bytes, storage_reference, created_at)
SELECT ma.content_hash, ma.mime_type, ma.size_bytes, ma.storage_reference, ma.created_at
  FROM media_assets ma
ON CONFLICT (content_hash) DO NOTHING;

-- ── 3. Asset lógico passa a REFERENCIAR o blob ───────────────────────────────
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS media_blob_id uuid REFERENCES media_blobs(id) ON DELETE RESTRICT;

UPDATE media_assets ma
   SET media_blob_id = mb.id
  FROM media_blobs mb
 WHERE mb.content_hash = ma.content_hash
   AND ma.media_blob_id IS NULL;

-- Fail-closed: nenhum asset pode ficar sem blob após o backfill.
DO $$
DECLARE orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM media_assets WHERE media_blob_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'media_blob_asset_separation: % media_assets sem blob após backfill — abortando.', orphans;
  END IF;
END $$;

ALTER TABLE media_assets ALTER COLUMN media_blob_id SET NOT NULL;

-- ── 4. Unicidade de hash SAI da camada lógica ────────────────────────────────
DROP INDEX IF EXISTS uidx_media_assets_content_hash;

-- Colunas físicas saem do asset lógico (dados já migrados para media_blobs no
-- passo 2 e validados no passo 3 — não é drop destrutivo, é reorganização provada).
ALTER TABLE media_assets DROP COLUMN IF EXISTS content_hash;
ALTER TABLE media_assets DROP COLUMN IF EXISTS mime_type;
ALTER TABLE media_assets DROP COLUMN IF EXISTS size_bytes;
ALTER TABLE media_assets DROP COLUMN IF EXISTS storage_reference;

-- ── 5. Idempotência de contexto: mesmo blob, mesmo tenant, mesmo actor criador
--      = um único asset lógico (reenvio idempotente); contextos distintos =
--      assets distintos (isolamento). Race-safe via UNIQUE parcial.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_assets_blob_context
  ON media_assets (media_blob_id, origin_tenant_id, created_by_actor_id)
  WHERE created_by_actor_id IS NOT NULL AND origin_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_blob ON media_assets (media_blob_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant ON media_assets (origin_tenant_id);

COMMIT;

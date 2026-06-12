-- 20260612120000_media_context_identity_v2.sql
-- DECISION-0118 D1 (implementação V2) — F-CANONICAL-MEDIA-CONTEXT-IDENTITY-V2-COLLISION-SAFE-CLOSURE.
-- Fecha DT-MEDIA-CONTEXT-FINGERPRINT-SERIALIZATION-AMBIGUITY (achado re-reseal Yala):
-- o fingerprint V1 era md5 de um join '|' — campos LIVRES adjacentes (licença,
-- provenance) permitiam PREIMAGES idênticos para contextos diferentes
-- (license='a' + provenance='b|c'  ==  license='a|b' + provenance='c'),
-- e o serviço devolvia o asset anterior DESCARTANDO a nova licença em silêncio.
--
-- IDENTIDADE V2 (quatro propriedades simultâneas):
--   1. SERIALIZAÇÃO INEQUÍVOCA — encoding versionado, campo NOMEADO, marcador
--      explícito de NULL ('N') e tamanho em BYTES UTF-8 (length-prefix): "a|b"
--      num campo JAMAIS se confunde com dois campos; delimitador no conteúdo é inerte.
--   2. VERSIONAMENTO — context_identity_version = 2 persistido por declaração.
--   3. HASH FORTE — sha256 (md5 sai da identidade viva; V1 vira arqueologia).
--   4. FONTE ÚNICA DO ENCODER — as funções SQL abaixo são a ÚNICA fórmula:
--      usadas pelo backfill desta migration E pelo runtime TypeScript
--      (computeMediaContextFingerprintV2 chama media_context_fingerprint_v2).
--      Hash NUNCA é prova de igualdade: o serviço recompara TODAS as dimensões
--      materiais em qualquer match (materiallyEqualMediaContext).
--
-- SEMÂNTICA NORMADA das dimensões livres (licença/provenance):
--   trim de whitespace ASCII + string vazia ⇒ NULL (NULL ≡ '' por DECISÃO via
--   normalização — nunca por ambiguidade de encoding) + lower (case-insensitive,
--   DECISION-0118 D1). Persistência preserva o case declarado; a IDENTIDADE usa
--   a forma normalizada. Unicode é byte-exato (NFC ≠ NFD = declarações distintas).
--
-- FAIL-CLOSED: aborta se source fora do vocabulário (classificação de contexto
-- teria sido inventada), se sugestão/uso empresarial não tiver tenant+actor
-- declarante (contexto não inferível), se restar linha sem fingerprint/versão,
-- ou se duas linhas resultarem no MESMO fingerprint V2 (nada é mesclado,
-- apagado ou escolhido — decisão humana).
--
-- Forward-only; NÃO edita 374/375; preserva ids/blobs/relações/moderação/licença/
-- source/provenance/tenant/actor; media_blobs INTOCADA; TIMESTAMPTZ; zero Bank.

BEGIN;

-- ── 1. Encoder canônico V2 (FONTE ÚNICA — runtime TS chama estas funções) ────
CREATE OR REPLACE FUNCTION media_context_dimension_norm(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  -- Espelho EXATO da canonicalização TS (charset ASCII explícito, não \s):
  -- trim de [espaço \t \n \r \f] + vazio ⇒ NULL + lower.
  SELECT lower(nullif(btrim(v, E' \t\n\r\f'), ''))
$fn$;

CREATE OR REPLACE FUNCTION media_context_preimage_field_v2(field_name text, v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  -- ';' nome ':' + ('N' para NULL | 'S' <bytes-utf8> ':' conteúdo).
  -- Length-prefix em BYTES torna o preimage inequivocamente parseável.
  SELECT ';' || field_name || ':' ||
         CASE WHEN v IS NULL THEN 'N'
              ELSE 'S' || octet_length(convert_to(v, 'UTF8'))::text || ':' || v
         END
$fn$;

CREATE OR REPLACE FUNCTION media_context_preimage_v2(
  p_media_blob_id uuid,
  p_origin_tenant_id uuid,
  p_created_by_actor_id uuid,
  p_context_type text,
  p_context_owner_id uuid,
  p_source text,
  p_purpose text,
  p_license text,
  p_origin_note text
) RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT 'MEDIA_CTX_V2'
      || media_context_preimage_field_v2('BLOB', p_media_blob_id::text)
      || media_context_preimage_field_v2('TENANT', p_origin_tenant_id::text)
      || media_context_preimage_field_v2('ACTOR', p_created_by_actor_id::text)
      || media_context_preimage_field_v2('CTYPE', p_context_type)
      || media_context_preimage_field_v2('COWNER', p_context_owner_id::text)
      || media_context_preimage_field_v2('SOURCE', p_source)
      || media_context_preimage_field_v2('PURPOSE', p_purpose)
      || media_context_preimage_field_v2('LICENSE', media_context_dimension_norm(p_license))
      || media_context_preimage_field_v2('PROVENANCE', media_context_dimension_norm(p_origin_note))
$fn$;

CREATE OR REPLACE FUNCTION media_context_fingerprint_v2(
  p_media_blob_id uuid,
  p_origin_tenant_id uuid,
  p_created_by_actor_id uuid,
  p_context_type text,
  p_context_owner_id uuid,
  p_source text,
  p_purpose text,
  p_license text,
  p_origin_note text
) RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT encode(sha256(convert_to(media_context_preimage_v2(
           p_media_blob_id, p_origin_tenant_id, p_created_by_actor_id,
           p_context_type, p_context_owner_id, p_source, p_purpose,
           p_license, p_origin_note), 'UTF8')), 'hex')
$fn$;

-- ── 2. Versão da identidade + arqueologia do V1 ──────────────────────────────
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS context_identity_version integer;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS context_fingerprint_v1 text;

-- ── 3. Fail-closed ANTES do recálculo ────────────────────────────────────────
-- 3a. Classificação de contexto deriva de source; source fora do vocabulário =
--     contexto NÃO inferível ⇒ decisão humana (nenhuma classificação é inventada).
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM media_assets
   WHERE source IS NULL OR source NOT IN ('company_suggestion', 'curated', 'seed');
  IF bad > 0 THEN
    RAISE EXCEPTION 'media_context_identity_v2: % assets com source fora do vocabulário (company_suggestion/curated/seed) — contexto não inferível; classificar manualmente antes de migrar.', bad;
  END IF;
END $$;

-- 3b. Sugestão canônica / uso empresarial SEM tenant e actor declarante =
--     declaração sem sujeito ⇒ contexto não inferível ⇒ ABORT (sem inferência
--     silenciosa). Contextos de plataforma (curated/seed) podem ser globais.
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM media_assets
   WHERE context_type IN ('company', 'canonical_suggestion')
     AND (origin_tenant_id IS NULL OR created_by_actor_id IS NULL);
  IF bad > 0 THEN
    RAISE EXCEPTION 'media_context_identity_v2: % declarações empresariais/sugestões sem tenant/actor declarante — contexto não inferível; decisão humana exigida (nada foi descartado).', bad;
  END IF;
END $$;

-- 3c. Dupla guarda (não deveria existir pós-374): contexto incompleto.
DO $$
DECLARE missing integer;
BEGIN
  SELECT count(*) INTO missing FROM media_assets
   WHERE context_type IS NULL OR purpose IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'media_context_identity_v2: % assets sem contexto — abortando.', missing;
  END IF;
END $$;

-- ── 4. Arqueologia V1 + recálculo V2 de TODAS as declarações ─────────────────
UPDATE media_assets
   SET context_fingerprint_v1 = context_fingerprint
 WHERE context_identity_version IS NULL
   AND context_fingerprint_v1 IS NULL;

UPDATE media_assets
   SET context_fingerprint = media_context_fingerprint_v2(
         media_blob_id, origin_tenant_id, created_by_actor_id, context_type,
         context_owner_id, source, purpose, license, origin_note),
       context_identity_version = 2
 WHERE context_identity_version IS NULL;

-- ── 5. Fail-closed DEPOIS do recálculo ───────────────────────────────────────
DO $$
DECLARE missing integer;
BEGIN
  SELECT count(*) INTO missing FROM media_assets
   WHERE context_fingerprint IS NULL OR context_identity_version IS DISTINCT FROM 2;
  IF missing > 0 THEN
    RAISE EXCEPTION 'media_context_identity_v2: % assets sem fingerprint V2/versão após recálculo — abortando.', missing;
  END IF;
END $$;

-- Colisão V2: duas linhas com o mesmo fingerprint ⇒ ABORT. NÃO escolher uma
-- linha, NÃO mesclar, NÃO apagar — decisão humana.
DO $$
DECLARE dup record;
BEGIN
  SELECT context_fingerprint AS fp, count(*) AS n INTO dup
    FROM media_assets
   GROUP BY context_fingerprint
  HAVING count(*) > 1
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'media_context_identity_v2: colisão de fingerprint V2 (%) em % linhas — decisão humana exigida; nada foi mesclado/apagado.', dup.fp, dup.n;
  END IF;
END $$;

ALTER TABLE media_assets ALTER COLUMN context_identity_version SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_assets_context_identity_version') THEN
    ALTER TABLE media_assets ADD CONSTRAINT chk_media_assets_context_identity_version
      CHECK (context_identity_version = 2);
  END IF;
END $$;

-- ── 6. Unicidade: identidade V2 soberana; índice da fórmula V1 retirado ──────
DROP INDEX IF EXISTS uidx_media_assets_context_fingerprint;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_media_assets_context_fingerprint_v2
  ON media_assets (context_fingerprint);

COMMIT;

-- ============================================================
-- MIGRATION: marca as âncoras N1-root de canonical_products como CATALOG_SCAFFOLD
-- Arquivo: 20260703140000_mark_n1_root_scaffold_canonical_products.sql
-- Frente: F-GLOBAL-SEARCH-OMNI (ruído de scaffold na busca de produtos)
--
-- CONTEXTO: a migration de data-repair 20260518120000 (bloco3) criou 1 canonical_product
-- sintético por categoria N1 raiz ("Catálogo global (N1 raiz) — <slug>", INDUSTRIAL,
-- concept 'bloco3-root-<slug>' confirmado) como ÂNCORA estrutural do catálogo — não como
-- produto vendável. Sem marcador, essas âncoras passam no gate de prontidão operacional
-- (sqlCanonicalIndustrialOperationalReady) e POLUEM as duas superfícies de busca
-- (GET /catalog/items/search do marketplace e o omnibox GET /search?q=).
--
-- FIX (data-repair da mesma natureza do seed original): marca attributes.catalog_scaffold=true
-- nas âncoras — identificadas por DUPLO predicado estrutural (nome de âncora + concept
-- sintético bloco3-root), nunca só por string de nome. O reader compartilhado
-- (canonical-item-search.service) passa a excluir scaffolds da DESCOBERTA; as âncoras
-- permanecem intactas para o papel estrutural que exercem no catálogo.
--
-- Forward-only idempotente (re-rodar não duplica marca). Δbank=0 (catálogo, não dinheiro).
-- ============================================================

BEGIN;

UPDATE canonical_products cp
   SET attributes = COALESCE(cp.attributes, '{}'::jsonb) || '{"catalog_scaffold": true}'::jsonb,
       updated_at = now()
 WHERE cp.name LIKE 'Catálogo global (N1 raiz) — %'
   AND EXISTS (
     SELECT 1 FROM concepts con
      WHERE con.concept_id = cp.concept_id
        AND con.slug LIKE 'bloco3-root-%'
   )
   AND COALESCE(cp.attributes->>'catalog_scaffold', '') <> 'true';

-- gate pós-marcação: nenhuma âncora N1-root pode ter ficado sem marca
DO $$
DECLARE unmarked INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmarked
    FROM canonical_products cp
   WHERE cp.name LIKE 'Catálogo global (N1 raiz) — %'
     AND EXISTS (SELECT 1 FROM concepts con WHERE con.concept_id = cp.concept_id AND con.slug LIKE 'bloco3-root-%')
     AND COALESCE(cp.attributes->>'catalog_scaffold', '') <> 'true';
  IF unmarked > 0 THEN
    RAISE EXCEPTION 'ABORT [catalog-scaffold-mark]: % âncora(s) N1-root sem marca catalog_scaffold após o UPDATE.', unmarked;
  END IF;
END $$;

COMMIT;

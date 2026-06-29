-- ============================================================
-- 20260629150000: SEED service_search_aliases — BELEZA-ONLY, curado (Slice-A)
-- Frente: F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A
-- Carimbo soberano: Clayton ("Pode mandar") + termos mínimos sugeridos no GO material.
-- ============================================================
-- 16 TERMOS de ocupação/linguagem comum → CONCEPT(s) JÁ existentes e triplo-selados (Slice-A/B
--   + ponte masculino). Cada linha aponta para um concept que TEM de existir; se faltar, a
--   migration FALHA ALTO (guard-pré). NÃO cria concept/canonical/categoria — só insere ponte.
--
-- DOUTRINA (cerca elétrica): alias ajuda busca · alias não cria significado · texto digitado não
--   vira concept · CONCEPT soberano (Lei 7) · publicação gated segue DECISION-0144. Lado-valor =
--   concept_id (FK). review_status='approved' + is_active=true → servível em runtime (curado pelo
--   soberano nesta leva). source/catalog_version = auditabilidade.
--
-- MAPA (termo → concepts):
--   cabeleireiro/cabeleireira → corte-de-cabelo-feminino, escova, coloracao-total, retoque-de-raiz,
--       mechas, luzes-capilares, tonalizante, progressiva, alisamento-capilar, selagem, botox-capilar
--   salao-de-beleza → TODOS os 16 concepts de beleza (venue: faz tudo)
--   barbeiro/barbearia → barba, corte-de-cabelo-masculino
--   manicure → manicure · pedicure → pedicure · designer-de-sobrancelhas → design-de-sobrancelhas
--   escovista → escova · colorista → coloracao-total, retoque-de-raiz, mechas, luzes-capilares, tonalizante
--   mechas → mechas · luzes → luzes-capilares · progressiva → progressiva
--   alisamento → alisamento-capilar, progressiva · selagem → selagem · botox-capilar → botox-capilar
--
-- IDEMPOTENTE: ON CONFLICT (normalized_term, concept_id) DO NOTHING. Re-execução = no-op seguro.
-- NÃO usa set_config('app.concept_governance') — NÃO cria concept (proibido nesta frente).
-- ============================================================

BEGIN;

-- ── GUARD-PRÉ (fail-closed): os 16 concepts de beleza alvo TÊM de existir. Não criar aqui.
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(s, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'corte-de-cabelo-feminino','corte-de-cabelo-masculino','barba','manicure','pedicure',
    'design-de-sobrancelhas','escova','coloracao-total','retoque-de-raiz','mechas',
    'luzes-capilares','tonalizante','progressiva','alisamento-capilar','selagem','botox-capilar'
  ]) AS s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.concepts c WHERE c.domain = 'servicos' AND c.slug = s
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ALIAS SEED STOP: concept(s) servicos alvo ausente(s): % — alias não cria concept; abortar.', v_missing;
  END IF;
END $$;

-- ── INSERT das pontes (INNER JOIN a concepts: FK + guard-pré garantem resolução).
INSERT INTO public.service_search_aliases
  (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
SELECT
  p.alias_term, p.normalized_term, c.concept_id,
  'high', 'approved', true,
  'F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A', 'beauty-v1'
FROM (VALUES
  -- cabeleireiro (11)
  ('Cabeleireiro','cabeleireiro','corte-de-cabelo-feminino'),
  ('Cabeleireiro','cabeleireiro','escova'),
  ('Cabeleireiro','cabeleireiro','coloracao-total'),
  ('Cabeleireiro','cabeleireiro','retoque-de-raiz'),
  ('Cabeleireiro','cabeleireiro','mechas'),
  ('Cabeleireiro','cabeleireiro','luzes-capilares'),
  ('Cabeleireiro','cabeleireiro','tonalizante'),
  ('Cabeleireiro','cabeleireiro','progressiva'),
  ('Cabeleireiro','cabeleireiro','alisamento-capilar'),
  ('Cabeleireiro','cabeleireiro','selagem'),
  ('Cabeleireiro','cabeleireiro','botox-capilar'),
  -- cabeleireira (11)
  ('Cabeleireira','cabeleireira','corte-de-cabelo-feminino'),
  ('Cabeleireira','cabeleireira','escova'),
  ('Cabeleireira','cabeleireira','coloracao-total'),
  ('Cabeleireira','cabeleireira','retoque-de-raiz'),
  ('Cabeleireira','cabeleireira','mechas'),
  ('Cabeleireira','cabeleireira','luzes-capilares'),
  ('Cabeleireira','cabeleireira','tonalizante'),
  ('Cabeleireira','cabeleireira','progressiva'),
  ('Cabeleireira','cabeleireira','alisamento-capilar'),
  ('Cabeleireira','cabeleireira','selagem'),
  ('Cabeleireira','cabeleireira','botox-capilar'),
  -- salao-de-beleza (16 — venue: faz tudo)
  ('Salão de beleza','salao-de-beleza','corte-de-cabelo-feminino'),
  ('Salão de beleza','salao-de-beleza','corte-de-cabelo-masculino'),
  ('Salão de beleza','salao-de-beleza','barba'),
  ('Salão de beleza','salao-de-beleza','manicure'),
  ('Salão de beleza','salao-de-beleza','pedicure'),
  ('Salão de beleza','salao-de-beleza','design-de-sobrancelhas'),
  ('Salão de beleza','salao-de-beleza','escova'),
  ('Salão de beleza','salao-de-beleza','coloracao-total'),
  ('Salão de beleza','salao-de-beleza','retoque-de-raiz'),
  ('Salão de beleza','salao-de-beleza','mechas'),
  ('Salão de beleza','salao-de-beleza','luzes-capilares'),
  ('Salão de beleza','salao-de-beleza','tonalizante'),
  ('Salão de beleza','salao-de-beleza','progressiva'),
  ('Salão de beleza','salao-de-beleza','alisamento-capilar'),
  ('Salão de beleza','salao-de-beleza','selagem'),
  ('Salão de beleza','salao-de-beleza','botox-capilar'),
  -- barbeiro (2)
  ('Barbeiro','barbeiro','barba'),
  ('Barbeiro','barbeiro','corte-de-cabelo-masculino'),
  -- barbearia (2)
  ('Barbearia','barbearia','barba'),
  ('Barbearia','barbearia','corte-de-cabelo-masculino'),
  -- manicure (1)
  ('Manicure','manicure','manicure'),
  -- pedicure (1)
  ('Pedicure','pedicure','pedicure'),
  -- designer-de-sobrancelhas (1)
  ('Designer de sobrancelhas','designer-de-sobrancelhas','design-de-sobrancelhas'),
  -- escovista (1)
  ('Escovista','escovista','escova'),
  -- colorista (5)
  ('Colorista','colorista','coloracao-total'),
  ('Colorista','colorista','retoque-de-raiz'),
  ('Colorista','colorista','mechas'),
  ('Colorista','colorista','luzes-capilares'),
  ('Colorista','colorista','tonalizante'),
  -- mechas (1)
  ('Mechas','mechas','mechas'),
  -- luzes (1)
  ('Luzes','luzes','luzes-capilares'),
  -- progressiva (1)
  ('Progressiva','progressiva','progressiva'),
  -- alisamento (2)
  ('Alisamento','alisamento','alisamento-capilar'),
  ('Alisamento','alisamento','progressiva'),
  -- selagem (1)
  ('Selagem','selagem','selagem'),
  -- botox-capilar (1)
  ('Botox capilar','botox-capilar','botox-capilar')
) AS p(alias_term, normalized_term, concept_slug)
INNER JOIN public.concepts c ON c.domain = 'servicos' AND c.slug = p.concept_slug
ON CONFLICT (normalized_term, concept_id) DO NOTHING;

-- ── PÓS-ASSERÇÃO (fail-closed): massa e sanidade do mapa curado.
DO $$
DECLARE
  v_total  integer;
  v_terms  integer;
  v_orphan integer;
  bad      record;
BEGIN
  SELECT count(*), count(DISTINCT normalized_term)
    INTO v_total, v_terms
    FROM public.service_search_aliases
    WHERE source = 'F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A';

  IF v_total < 58 THEN
    RAISE EXCEPTION 'ALIAS SEED STOP: esperado >=58 linhas-alias beleza, achou % (join vazio / concept faltando).', v_total;
  END IF;
  IF v_terms <> 16 THEN
    RAISE EXCEPTION 'ALIAS SEED STOP: esperado 16 termos normalizados distintos, achou %.', v_terms;
  END IF;

  -- nenhum alias desta leva aponta para concept fora de domínio servicos (FK + join já garantem; defesa extra).
  SELECT count(*) INTO v_orphan
    FROM public.service_search_aliases a
    JOIN public.concepts c ON c.concept_id = a.concept_id
    WHERE a.source = 'F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A' AND c.domain <> 'servicos';
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'ALIAS SEED STOP: % alias(es) apontando para concept fora de domínio servicos.', v_orphan;
  END IF;

  -- contagem por termo crítico (fan-out esperado).
  SELECT normalized_term, n INTO bad FROM (
    SELECT normalized_term, count(*) AS n
      FROM public.service_search_aliases
      WHERE source = 'F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A'
      GROUP BY normalized_term
  ) t
  WHERE (normalized_term = 'cabeleireiro'    AND n <> 11)
     OR (normalized_term = 'cabeleireira'    AND n <> 11)
     OR (normalized_term = 'salao-de-beleza' AND n <> 16)
     OR (normalized_term = 'barbeiro'        AND n <> 2)
     OR (normalized_term = 'colorista'       AND n <> 5)
     OR (normalized_term = 'manicure'        AND n <> 1)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ALIAS SEED STOP: fan-out do termo "%" divergente (n=%).', bad.normalized_term, bad.n;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- F-SERVICE-CATALOG-LABEL-BACKFILL-SLICE (DECISION-0107)
-- Backfill pt-BR CURADO dos 16 labels primários dos GRÃOS OFERTÁVEIS de beleza já vivos.
-- Apresentação governada — NÃO identidade. Endireita a placa que degradava para slug em 16/16 grãos.
-- ------------------------------------------------------------
-- READ-FIRST 2026-07-01: 16/16 canonical_services de beleza (domain='servicos') estavam SEM label pt-BR
-- primária. Os 2 labels existentes em domain='servicos' (servicos-pessoais-beleza, alimentacao-servico-preparado)
-- são UMBRELLAS não-ofertáveis — não resolvem o catálogo vivo e NÃO são tocados aqui.
-- Curadoria = canonical_services.name (JÁ pt-BR curado; honra DECISION-0107 D7 "preferir curado", NÃO de-kebab do slug).
-- Resolução por SLUG (NÃO hardcode de UUID). locale='pt-BR', context_key='default', is_primary=true,
-- source='clayton_curated_beauty_backfill_2026_07_01'. Idempotente via ON CONFLICT no índice parcial
-- uq_concept_labels_one_primary (atualiza label/short_label/source/updated_at).
-- Fail-closed: gate COUNT=16 (se algum slug não resolver, aborta — sem seed parcial). NÃO altera `concepts`
-- (segue seco). NÃO toca alias/canonical/categoria/gate/dinheiro. Label nunca é identidade.
-- Forward-only / transacional / idempotente.
-- ============================================================

BEGIN;

INSERT INTO concept_labels (concept_id, locale, context_key, label, short_label, is_primary, source)
SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, 'clayton_curated_beauty_backfill_2026_07_01'
FROM (VALUES
  ('alisamento-capilar',        'Alisamento capilar',        'Alisamento'),
  ('barba',                     'Barba',                     'Barba'),
  ('botox-capilar',             'Botox capilar',             'Botox'),
  ('coloracao-total',           'Coloração total',           'Coloração'),
  ('corte-de-cabelo-feminino',  'Corte de cabelo feminino',  'Corte feminino'),
  ('corte-de-cabelo-masculino', 'Corte de cabelo masculino', 'Corte masculino'),
  ('design-de-sobrancelhas',    'Design de sobrancelhas',    'Sobrancelhas'),
  ('escova',                    'Escova',                    'Escova'),
  ('luzes-capilares',           'Luzes capilares',           'Luzes'),
  ('manicure',                  'Manicure',                  'Manicure'),
  ('mechas',                    'Mechas',                    'Mechas'),
  ('pedicure',                  'Pedicure',                  'Pedicure'),
  ('progressiva',               'Progressiva',               'Progressiva'),
  ('retoque-de-raiz',           'Retoque de raiz',           'Retoque'),
  ('selagem',                   'Selagem',                   'Selagem'),
  ('tonalizante',               'Tonalizante',               'Tonalizante')
) AS v(concept_slug, label, short_label)
JOIN concepts c ON c.slug = v.concept_slug
ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true
DO UPDATE SET
  label       = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  source      = EXCLUDED.source,
  updated_at  = now();

-- GATE fail-closed A: os 16 slugs curados DEVEM resolver exatamente 16 concepts (sem seed parcial).
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM concepts c
   WHERE c.slug IN (
     'alisamento-capilar','barba','botox-capilar','coloracao-total','corte-de-cabelo-feminino',
     'corte-de-cabelo-masculino','design-de-sobrancelhas','escova','luzes-capilares','manicure',
     'mechas','pedicure','progressiva','retoque-de-raiz','selagem','tonalizante'
   );
  IF n <> 16 THEN
    RAISE EXCEPTION 'SEED_BEAUTY_LABELS_ABORT: esperado 16 concepts resolvidos por slug, encontrado %.', n;
  END IF;
END $$;

-- GATE fail-closed B: após o seed DEVEM existir exatamente 16 labels primárias pt-BR/default desta fonte.
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM concept_labels
   WHERE source = 'clayton_curated_beauty_backfill_2026_07_01'
     AND locale = 'pt-BR' AND context_key = 'default' AND is_primary = true;
  IF n <> 16 THEN
    RAISE EXCEPTION 'SEED_BEAUTY_LABELS_ABORT: esperado 16 labels primárias, encontrado %.', n;
  END IF;
END $$;

COMMIT;

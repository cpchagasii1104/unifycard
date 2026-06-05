-- ============================================================
-- F-PJ-CONCEPT-LABELS-SEED-MVP (DECISION-0107 D10)
-- Seed pt-BR CURADO dos 7 labels primários das verticais MVP. Apresentação governada — NÃO identidade.
-- ------------------------------------------------------------
-- Tabela curada por Clayton (2026-06-05). Resolução por SLUG (NÃO hardcode de UUID). locale='pt-BR',
-- context_key='default', is_primary=true, source='clayton_curated_mvp_2026_06_05'. Idempotente via
-- ON CONFLICT no índice parcial uq_concept_labels_one_primary (atualiza label/short_label/source/updated_at).
-- Fail-closed: gate COUNT=7 (se algum slug não resolver, aborta — sem seed parcial). NÃO altera `concepts`
-- (segue seco). NÃO cria endpoint/frontend. NÃO deriva label do slug automaticamente. Label nunca é identidade.
-- Forward-only / transacional / idempotente.
-- ============================================================

BEGIN;

INSERT INTO concept_labels (concept_id, locale, context_key, label, short_label, is_primary, source)
SELECT c.concept_id, 'pt-BR', 'default', v.label, v.short_label, true, 'clayton_curated_mvp_2026_06_05'
FROM (VALUES
  ('varejo-alimentar-integrado',                'Supermercado',                 'Supermercado'),
  ('varejo-alimentar-especializado-hortifruti', 'Hortifruti',                   'Hortifruti'),
  ('varejo-alimentar-especializado-carnes',     'Açougue / Varejo de Carnes',   'Açougue'),
  ('varejo-alimentar-especializado-padaria',    'Padaria',                      'Padaria'),
  ('saude-varejo-farmaceutico',                 'Farmácia',                     'Farmácia'),
  ('servicos-pessoais-beleza',                  'Salão de Beleza / Estética',   'Beleza'),
  ('alimentacao-servico-preparado',             'Restaurante',                  'Restaurante')
) AS v(concept_slug, label, short_label)
JOIN concepts c ON c.slug = v.concept_slug
ON CONFLICT (concept_id, locale, context_key) WHERE is_primary = true
DO UPDATE SET
  label       = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  source      = EXCLUDED.source,
  updated_at  = now();

-- GATE fail-closed: as 7 labels primárias curadas DEVEM existir. Se algum slug não resolveu, abortar.
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM concept_labels
   WHERE source = 'clayton_curated_mvp_2026_06_05'
     AND locale = 'pt-BR' AND context_key = 'default' AND is_primary = true;
  IF n <> 7 THEN
    RAISE EXCEPTION 'SEED_CONCEPT_LABELS_ABORT: esperado 7 labels primárias, encontrado %. Slug não resolvido.', n;
  END IF;
END $$;

COMMIT;

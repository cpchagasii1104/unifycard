-- ============================================================
-- 0093: add N1 for pessoas-e-identidades
-- ============================================================
-- Escopo:
-- - Inserir 5 slugs de N1 no dominio `pessoas-e-identidades`
-- - Sem alterar domains, categories, concepts ou schemas
-- - Respeitar governanca de escrita em n1_nodes/n1_localized_names
-- ============================================================

BEGIN;

-- Escrita autorizada para triggers de governanca N1.
SELECT set_config('app.n1_governance', 'true', true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM domains
    WHERE domain_key = 'pessoas-e-identidades'
  ) THEN
    RAISE EXCEPTION 'n1 bootstrap aborted: domain_key inexistente em domains: pessoas-e-identidades';
  END IF;
END $$;

-- Regra adicional de seguranca: nao duplicar slug existente em qualquer dominio.
DO $$
DECLARE
  _conflicts text;
BEGIN
  SELECT string_agg(n.slug, ', ' ORDER BY n.slug)
    INTO _conflicts
  FROM n1_nodes n
  WHERE n.slug IN ('perfil', 'profissoes', 'educacao', 'interesses', 'relacoes');

  IF _conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'n1 bootstrap aborted: slug(s) ja existente(s) em n1_nodes: %', _conflicts;
  END IF;
END $$;

WITH inserted AS (
  INSERT INTO n1_nodes (slug, domain_key, sort_order)
  VALUES
    ('perfil', 'pessoas-e-identidades', 1),
    ('profissoes', 'pessoas-e-identidades', 2),
    ('educacao', 'pessoas-e-identidades', 3),
    ('interesses', 'pessoas-e-identidades', 4),
    ('relacoes', 'pessoas-e-identidades', 5)
  RETURNING n1_id, slug, domain_key
)
INSERT INTO n1_localized_names (n1_id, locale, display_name)
SELECT
  i.n1_id,
  'pt-BR',
  CASE i.slug
    WHEN 'perfil' THEN 'Perfil'
    WHEN 'profissoes' THEN 'Profissoes'
    WHEN 'educacao' THEN 'Educacao'
    WHEN 'interesses' THEN 'Interesses'
    WHEN 'relacoes' THEN 'Relacoes'
  END
FROM inserted i;

COMMIT;


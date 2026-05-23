-- ============================================================
-- 0083: Bebidas — remover alcoolicas; alinhar sort_order (varejo/bar)
-- ============================================================
-- Dados apenas; escrita com app.n2_governance (0080).
-- Novos links varejo (cervejas/vinhos/destilados): seed-n2-governed.ts
-- ============================================================

BEGIN;

SELECT set_config('app.n2_governance', 'true', true);

DELETE FROM n2_nodes
WHERE n2_id IN (
  SELECT n2.n2_id
  FROM n2_nodes n2
  INNER JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
  WHERE n1.slug = 'bebidas'
    AND n1.domain_key = 'produtos-e-comercio'
    AND n2.slug = 'alcoolicas'
);

UPDATE n2_nodes n2
SET sort_order = v.ord
FROM n1_nodes n1,
  (
    VALUES
      ('cervejas'::text, 1),
      ('vinhos', 2),
      ('destilados', 3),
      ('drinks', 4),
      ('nao-alcoolicas', 5)
  ) AS v (slug, ord)
WHERE n1.n1_id = n2.n1_id
  AND n1.slug = 'bebidas'
  AND n1.domain_key = 'produtos-e-comercio'
  AND n2.slug = v.slug;

UPDATE context_n2_mapping m
SET sort_order = sub.new_ord
FROM (
  SELECT
    m2.id,
    CASE n2.slug
      WHEN 'cervejas' THEN 1
      WHEN 'vinhos' THEN 2
      WHEN 'destilados' THEN 3
      WHEN 'drinks' THEN 4
      WHEN 'nao-alcoolicas' THEN 5
    END AS new_ord
  FROM context_n2_mapping m2
  INNER JOIN n2_nodes n2 ON n2.n2_id = m2.n2_id
  INNER JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
  INNER JOIN context_nodes cn ON cn.context_id = m2.context_id
  WHERE n1.slug = 'bebidas'
    AND n1.domain_key = 'produtos-e-comercio'
    AND cn.context_slug = 'bar'
) sub
WHERE m.id = sub.id
  AND sub.new_ord IS NOT NULL;

UPDATE context_n2_mapping m
SET sort_order = sub.new_ord
FROM (
  SELECT
    m2.id,
    CASE n2.slug
      WHEN 'cervejas' THEN 1
      WHEN 'vinhos' THEN 2
      WHEN 'destilados' THEN 3
      WHEN 'nao-alcoolicas' THEN 4
    END AS new_ord
  FROM context_n2_mapping m2
  INNER JOIN n2_nodes n2 ON n2.n2_id = m2.n2_id
  INNER JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
  INNER JOIN context_nodes cn ON cn.context_id = m2.context_id
  WHERE n1.slug = 'bebidas'
    AND n1.domain_key = 'produtos-e-comercio'
    AND cn.context_slug = 'varejo'
) sub
WHERE m.id = sub.id
  AND sub.new_ord IS NOT NULL;

COMMIT;

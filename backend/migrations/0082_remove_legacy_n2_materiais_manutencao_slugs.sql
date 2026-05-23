-- ============================================================
-- 0082: Remover N2 legados (materiais / manutenção) — só dados
-- ============================================================
-- Substituição de slugs (UX); novos slugs via seed-n2-governed.ts.
-- Escrita exige app.n2_governance (0080).
-- ============================================================

BEGIN;

SELECT set_config('app.n2_governance', 'true', true);

DELETE FROM n2_nodes
WHERE n2_id IN (
  SELECT n2.n2_id
  FROM n2_nodes n2
  INNER JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
  WHERE (
      n1.slug = 'materiais-de-construcao'
      AND n1.domain_key = 'produtos-e-comercio'
      AND n2.slug IN (
        'materiais-para-cozinha',
        'materiais-para-banheiro',
        'materiais-para-quarto',
        'materiais-para-sala',
        'materiais-para-area-externa'
      )
    )
    OR (
      n1.slug = 'manutencao-e-reformas'
      AND n1.domain_key = 'servicos'
      AND n2.slug IN (
        'reforma-de-cozinha',
        'reforma-de-banheiro',
        'reforma-de-quarto',
        'reforma-de-sala',
        'reforma-de-area-externa'
      )
    )
);

COMMIT;

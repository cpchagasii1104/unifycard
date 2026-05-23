-- ============================================================
-- Fix: 4 categorias profissionais com path desalinhado a level
-- ============================================================
-- Contexto: categorias criadas em abr/2026 (seed 20260418100000) como N0/global
-- com path=[]. Operação de promoção (UPDATE em lote 2026-05-16T00:47Z, sem
-- registro versionado encontrado) reparenteou para N1 sob 'profissoes' (level=1,
-- scope=professional) mas NÃO atualizou path. Resultado: contrato
-- categories.model.ts:91 (path.length == level) violado em runtime; UI da aba
-- profissional quebra em getCategoryTree.
--
-- Contrato canônico (0094:14-15, 0096): path = ancestrais apenas; level == array_length(path,1).
-- ============================================================

BEGIN;

UPDATE categories
SET path = ARRAY['profissoes']::text[]
WHERE slug IN (
  'servicos-estetica-bem-estar',
  'servicos-manutencao-reformas',
  'servicos-para-o-lar',
  'servicos-tecnicos-gerais'
)
  AND level = 1
  AND scope = 'professional'
  AND COALESCE(array_length(path, 1), 0) = 0;

COMMIT;

-- ============================================================
-- 20260707040000: Semente MÍNIMA de categoria de grupo (scope='group')
-- ============================================================
-- Achado Clayton 2026-07-07: o wizard de grupo lê a árvore canônica única
-- (categories, filtro canônico scope='group' OR NULL) e NÃO EXISTE nenhuma
-- linha scope='group' no banco — dropdown vazio, criação impossível.
-- Esta semente cria UM nó genérico ('Comunidade') para destravar o fluxo de
-- teste SEM inventar taxonomia: a árvore REAL de categorias de grupo é
-- decisão de vocabulário (decision pack próprio, como o catálogo de serviços)
-- — DT-GROUP-CATEGORY-TAXONOMY-DECISION-PENDING no cartório.
-- Respeita: árvore ÚNICA (categories, §13 do protocolo), scope como VISÃO,
-- level 1, status approved; concept_id NULL é lícito fora do fluxo
-- profissional (§14: concept_id obrigatório SÓ em scope='professional').
-- ============================================================

BEGIN;

INSERT INTO categories (name, slug, description, level, scope, status, is_active)
SELECT 'Comunidade', 'grupo-comunidade',
       'Categoria genérica de grupos (semente mínima — taxonomia real de grupos aguarda decision pack)',
       1, 'group', 'approved', true
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE slug = 'grupo-comunidade' AND scope = 'group'
);

COMMIT;

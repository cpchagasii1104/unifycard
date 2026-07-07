-- 20260707100000: CORREÇÃO ESTRUTURAL — categorias de grupo sem raiz/path
-- Invariante da árvore única: path = slugs dos ancestrais; path.length = level.
-- Cria raiz 'grupos' (level 0) e pendura as 26 categorias nela (path=['grupos']).
BEGIN;
INSERT INTO categories (name, slug, description, level, path, scope, status, is_active)
SELECT 'Grupos', 'grupos', 'Raiz da árvore de categorias de grupos', 0, '{}', 'group', 'active', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'grupos' AND scope = 'group');

UPDATE categories c
SET parent_id = r.category_id, path = ARRAY['grupos']
FROM categories r
WHERE r.slug = 'grupos' AND r.scope = 'group'
  AND c.scope = 'group' AND c.level = 1
  AND (c.path IS NULL OR array_length(c.path, 1) IS NULL);
COMMIT;

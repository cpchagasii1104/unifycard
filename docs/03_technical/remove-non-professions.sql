-- ================================================
-- Remover categorias que NÃO são profissões
-- Data: 2025-12-18T05:27:35.762Z
-- Total: 39 categorias
-- ================================================

BEGIN;

-- Arquivar categorias não-profissionais
-- Gêneros de Filme (generos-filme) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = '7000a406-2f57-40a8-94fe-b80cc629b78d';

-- Gêneros Literários (generos-literarios) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = '5f9c5e5e-731b-4d3f-86c1-057b664e5720';

-- Gêneros Musicais (generos-musicais) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = 'd19c1489-03de-46b0-93f0-218df55a98dd';

-- Jogos de Mesa (jogos-mesa) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = '5eb623e0-cf61-43d1-a39c-0d36b43a1b29';

-- Mangás e Quadrinhos (mangas-quadrinhos) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = '5dfc42f3-b20a-47ff-901b-6d66a7403789';

-- Séries (series) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = 'a6961601-1586-45e2-af90-a6f66aae63b5';

-- Videogames (videogames) - Level 1
UPDATE categories SET status = 'archived' WHERE category_id = 'ba9ef23e-46b9-4403-bc28-a5cafdc34a84';

-- Ação (acao-filme) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '7b102fdf-98f0-4ba0-b5d5-d1d0824c5280';

-- Ação (acao) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '3733bf3d-b4f0-428d-aa61-6d95631352af';

-- Animação (animacao) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'ef35ef88-fb51-45f3-8e2c-d3cf3fcb1630';

-- Aventura (aventura) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '6b85dc0f-035d-40da-b144-02ab29dcbfb9';

-- Biografia (biografia) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '7fd49d63-4f05-4c36-901b-c3349f4578b3';

-- Clássica (classica) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '1da17384-3bfa-464e-b3e4-bbc7fd95ae1b';

-- Comédia (comedia-serie) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '24ba9d64-d5df-4e41-af93-17b2093d7897';

-- Comédia (comedia) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '7dd6b970-6e49-445f-8516-f0f967ac5f0c';

-- Documentário (documentario) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'b0dc801c-4cb1-4691-8ba2-464d178d567e';

-- Drama (drama) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '4130b49e-6de2-4c24-a0b5-563304032e0a';

-- Drama (drama-serie) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '86b21adf-c92c-4ed2-93ce-64ed1c393dfd';

-- Eletrônica (eletronica) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '72d92550-4c2f-444c-8f04-cfe2a185c8af';

-- Estratégia (estrategia) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '0a0a5a14-64e9-43be-968a-9d02d786b57f';

-- Fantasia (fantasia-serie) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '9333c386-f5b3-46d1-ab41-39800cfbdd4b';

-- Fantasia (fantasia) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '66007fc4-2e56-41c9-9c76-c1d949bf5002';

-- Ficção Científica (ficcao-cientifica) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '9585d0e8-a8a3-481b-b279-aae9a53b3892';

-- Ficção Científica (ficcao-cientifica-filme) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '87163499-9a92-4fbf-91cd-4cef400bf203';

-- Ficção Científica (ficcao-cientifica-serie) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'e98f9611-b020-4d78-9943-f22d0b5e83a8';

-- Funk (funk) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '377cb7ea-6efc-4901-b761-1d87c688ad32';

-- Hip Hop (hip-hop) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '01bba2be-5cb7-4db4-a535-d7d288778ba6';

-- Jazz (jazz) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '15050f44-a93b-47ae-8149-63b9c01b2973';

-- Pop (pop) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '8a1c687c-baf6-40a3-b6b3-68c46c3fb63f';

-- Rock (rock) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '829ef8bd-7bfe-4a3d-9d8d-8ed326f5d297';

-- Romance (romance-filme) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '3cd753c7-1f25-4560-bf95-1a8086f1effd';

-- Romance (romance) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '75f1857a-64be-4775-8b6f-ebebf3e812f8';

-- RPG (rpg) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'a571a38e-4e54-4132-863d-178983e5ce08';

-- Sertanejo (sertanejo) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '60515a7b-c134-4f89-a5d8-847a1931f473';

-- Simulação (simulacao) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'a032dd8a-4ba8-4de6-aa96-84f0ee3b2aa4';

-- Suspense (suspense) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'a345825b-e045-4f33-a2dd-b4586937f635';

-- Suspense (suspense-serie) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = '6b194587-91e3-4325-9b83-46745c2ada49';

-- Terror (terror-filme) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'b012ea05-6cfa-4076-b80c-f451b1e54a96';

-- Terror (terror) - Level 2
UPDATE categories SET status = 'archived' WHERE category_id = 'b66bbab3-f1c9-4408-b79f-7cc9e708fbd4';

COMMIT;

-- Verificar resultado
SELECT 
  level,
  status,
  COUNT(*) as total
FROM categories
WHERE status = 'archived'
GROUP BY level, status
ORDER BY level, status;

-- Profissões ativas restantes
SELECT COUNT(*) as profissoes_ativas
FROM categories
WHERE level = 2 
  AND (SELECT COUNT(*) FROM categories WHERE parent_id = categories.category_id) = 0
  AND (status = 'active' OR status = 'auto_active');

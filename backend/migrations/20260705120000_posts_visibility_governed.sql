-- ============================================================
-- MIGRATION: substrato de plateia do post — posts.visibility governado (Fatia 5)
-- Arquivo: 20260705120000_posts_visibility_governed.sql
-- Frente: F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (GUIA_MESTRE §5.5; DESENHO_PAGINA_DO_ACTOR
--         §2.4c/§5 SELADO; fecha DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ)
--
-- ACHADO (read-first): a tabela `posts` VIVA nunca teve coluna de visibilidade. O tipo
-- `PostVisibility='PUBLIC'|'PRIVATE'|'FRIENDS'|'GROUP'` citado pela DT é do repository LEGADO
-- (`social.repository.ts`), que referencia um schema fantasma inteiro (post_id/global_user_id/
-- type/visibility/confidence/categories/suggested_actions/event_id) — nenhuma dessas colunas
-- existe em `posts`. Este fantasma NÃO é ressuscitado aqui.
--
-- A FONTE da plateia (DESENHO §2.4c SELADO, Clayton 2026-07-04): "Seletor de plateia = as
-- PLATEIAS da relação tipada (§5)" — ou seja, `actor_relationships` (Fatia 1), NÃO `follows`
-- (que é o degrau mais leve "seguir", sem aceite). Vocabulário GOVERNADO por CHECK (Lei §8):
--   'public'      — qualquer um vê (default; == comportamento de hoje, migração não-destrutiva);
--   'connections' — só o autor e quem tem uma aresta `actor_relationships` ACEITA com o autor
--                   (qualquer label — "conexões-de-tipo-X" fica para refinamento futuro nomeado);
--   'only_me'     — só o autor.
-- 'group' e 'friends'/'private' (nomes antigos) NÃO entram no vocabulário novo — group-scoping
-- de post é a DT IRMÃ `DT-PRESSURE-GROUPS-VISIBILITY-FANTASMA` (groups.visibility também não é
-- coluna materializada), fora de escopo desta fatia, não tocada aqui.
--
-- Default 'public' em toda a tabela existente preserva o comportamento ATUAL (broadcast
-- tenant-wide, DECISION-0115 D1) — esta migration só ABRE a possibilidade de plateia mais
-- estreita; a Fatia 5 (código) é quem passa a OBEDECER a coluna na leitura.
-- Forward-only, aditiva, Δbank=0.
-- ============================================================

BEGIN;

ALTER TABLE posts
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CONSTRAINT chk_posts_visibility CHECK (visibility IN ('public', 'connections', 'only_me'));

CREATE INDEX idx_posts_visibility ON posts (tenant_id, visibility) WHERE visibility <> 'public';

COMMIT;

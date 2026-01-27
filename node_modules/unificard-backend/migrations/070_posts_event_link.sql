-- ============================================================
-- UNIFICARD — MIGRATION 070
-- Arquivo: 070_posts_event_link.sql
-- Tipo: PATCH ADITIVO (Social + Events)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Permite vincular posts a eventos, suportando:
-- • anúncios de eventos
-- • atualizações
-- • lembretes
--
-- RELAÇÃO COM MIGRATIONS ANTERIORES
-- • NÃO substitui posts.intent (migration 054)
-- • NÃO substitui actors (migration 050)
--
-- MODELO CONCEITUAL
-- • intent  → propósito lógico do post (ex: event, booking, project)
-- • type    → formato/contexto visual/editorial do post
-- • event_id → vínculo estrutural com events
--
-- REGRAS DE USO (APLICAÇÃO)
-- • Posts EVENT_* DEVEM ter event_id
-- • Posts com event_id PODEM ter outros types (ex: IMAGE)
-- • A validação forte é feita no serviço (não 100% no banco)
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- DEPENDÊNCIAS
-- • posts
-- • events
--
-- OBSERVAÇÕES
-- • Esta migration NÃO altera comportamento de posts existentes
-- • event_id é opcional para manter compatibilidade retroativa
--
-- ============================================================


-- ============================================================
-- 1) EVENT LINK
-- ============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS event_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_posts_event'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT fk_posts_event
      FOREIGN KEY (event_id)
      REFERENCES events(id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- 2) POST TYPE (EDITORIAL / CONTEXTO)
-- ============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'TEXT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_type_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_type_check CHECK (
        type IN (
          'TEXT',
          'IMAGE',
          'VIDEO',
          'EVENT_ANNOUNCEMENT',
          'EVENT_UPDATE',
          'EVENT_REMINDER'
        )
      );
  END IF;
END $$;


-- ============================================================
-- 3) VISIBILITY
-- ============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'PUBLIC';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_visibility_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_visibility_check CHECK (
        visibility IN ('PUBLIC', 'PRIVATE', 'FRIENDS', 'GROUP')
      );
  END IF;
END $$;


-- ============================================================
-- 4) ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_event
  ON posts(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_event_visibility
  ON posts(event_id, visibility)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_type
  ON posts(type)
  WHERE type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_visibility
  ON posts(visibility);


-- ============================================================
-- 5) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN posts.event_id IS
  'Evento vinculado ao post (1 evento pode ter múltiplos posts)';

COMMENT ON COLUMN posts.type IS
  'Tipo editorial do post: TEXT, IMAGE, VIDEO ou variantes EVENT_*';

COMMENT ON COLUMN posts.visibility IS
  'Controle de visibilidade do post: PUBLIC, PRIVATE, FRIENDS ou GROUP';


-- ============================================================
-- FIM 070_posts_event_link.sql
-- ============================================================














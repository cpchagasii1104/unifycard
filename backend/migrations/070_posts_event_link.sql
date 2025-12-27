-- ================================================
-- UNIFICARD - MIGRATION 070
-- Posts Event Link (FASE 1.1)
-- Estender tabela posts para vincular eventos
-- ================================================

-- Adicionar coluna event_id
ALTER TABLE posts ADD COLUMN IF NOT EXISTS event_id UUID NULL;

-- Adicionar constraint de foreign key (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_posts_event'
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT fk_posts_event 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar coluna type (tipo de post)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'TEXT';
ALTER TABLE posts ADD CONSTRAINT check_post_type CHECK (
  type IN ('TEXT', 'IMAGE', 'VIDEO', 'EVENT_ANNOUNCEMENT', 'EVENT_UPDATE', 'EVENT_REMINDER')
);

-- Adicionar coluna visibility (visibilidade do post)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'PUBLIC';
ALTER TABLE posts ADD CONSTRAINT check_post_visibility CHECK (
  visibility IN ('PUBLIC', 'PRIVATE', 'FRIENDS', 'GROUP')
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_posts_event 
  ON posts(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_event_visibility
  ON posts(event_id, visibility) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_type 
  ON posts(type) WHERE type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_visibility 
  ON posts(visibility);

-- Comentários
COMMENT ON COLUMN posts.event_id IS 'Evento vinculado ao post (1 evento pode ter N posts)';
COMMENT ON COLUMN posts.type IS 'Tipo de post: TEXT, IMAGE, VIDEO, EVENT_ANNOUNCEMENT, EVENT_UPDATE, EVENT_REMINDER';
COMMENT ON COLUMN posts.visibility IS 'Visibilidade: PUBLIC, PRIVATE, FRIENDS, GROUP';
















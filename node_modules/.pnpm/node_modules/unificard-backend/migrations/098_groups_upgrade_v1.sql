-- ============================================================
-- UNIFICARD - MIGRATION 098
-- Groups Upgrade v1 — CONTRATO_GRUPOS_V1
-- ============================================================
--
-- OBJETIVO:
-- Evoluir o schema de grupos de forma compatível,
-- sem aplicar regras de domínio no banco.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena estado declarado dos grupos
--   • mantém contadores técnicos (member_count)
--   • garante integridade estrutural e isolamento por tenant
-- - A APLICAÇÃO:
--   • decide status do grupo
--   • decide qualificação econômica (can_sell)
--   • atualiza last_activity_at
--   • aplica políticas do CONTRATO_GRUPOS_V1
--
-- DECISÕES IMPORTANTES:
-- - Nenhum ENUM ou CHECK rígido de domínio
-- - Nenhuma trigger decide status ou qualificação
-- - Nenhum UPDATE retroativo automático
--
-- ============================================================


-- ============================================================
-- FASE 1: UPGRADE TABELA GROUPS
-- ============================================================

ALTER TABLE groups ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_slug
  ON groups (tenant_id, slug)
  WHERE slug IS NOT NULL;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subtype VARCHAR(100);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';

ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_type VARCHAR(20) DEFAULT 'open';

ALTER TABLE groups ADD COLUMN IF NOT EXISTS max_members INTEGER;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS account_id UUID
  REFERENCES accounts(account_id);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS can_sell BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;


-- ============================================================
-- FASE 2: GROUP_MEMBERS
-- ============================================================

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;


-- ============================================================
-- FASE 3: USER_ACTIVE_GROUPS (MULTI-TENANT)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_active_groups (
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  user_id UUID NOT NULL,
  group_id UUID NOT NULL
    REFERENCES groups(group_id) ON DELETE CASCADE,

  priority INTEGER NOT NULL,

  activated_at TIMESTAMPTZ DEFAULT now(),
  can_change_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (tenant_id, user_id, group_id),
  UNIQUE (tenant_id, user_id, priority)
);

ALTER TABLE user_active_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_active_groups_rls ON user_active_groups;
CREATE POLICY user_active_groups_rls ON user_active_groups
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_user_active_groups_user
  ON user_active_groups (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_active_groups_group
  ON user_active_groups (tenant_id, group_id);


-- ============================================================
-- FASE 4: SPLIT_CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS split_configuration (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  config_key VARCHAR(50) NOT NULL,

  provider_percent NUMERIC(5,2) DEFAULT 70.00 CHECK (provider_percent >= 0),
  city_percent NUMERIC(5,2) DEFAULT 15.00 CHECK (city_percent >= 0),
  region_percent NUMERIC(5,2) DEFAULT 10.00 CHECK (region_percent >= 0),
  community_percent NUMERIC(5,2) DEFAULT 5.00 CHECK (community_percent >= 0),

  per_group_percent NUMERIC(5,2) DEFAULT 1.00 CHECK (per_group_percent >= 0),
  max_groups_per_user INTEGER DEFAULT 3,
  regional_fund_minimum_percent NUMERIC(5,2) DEFAULT 2.00 CHECK (regional_fund_minimum_percent >= 0),

  referral_percent NUMERIC(5,2) DEFAULT 0.00 CHECK (referral_percent >= 0),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (tenant_id, config_key)
);

ALTER TABLE split_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS split_configuration_rls ON split_configuration;
CREATE POLICY split_configuration_rls ON split_configuration
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- Inserir config default (sem lógica de negócio)
INSERT INTO split_configuration (tenant_id, config_key)
SELECT tenant_id, 'default'
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM split_configuration sc
  WHERE sc.tenant_id = tenants.tenant_id
    AND sc.config_key = 'default'
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- FASE 5: INTEGRAÇÃO COM ACTORS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE actors
      ADD COLUMN group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE;
  END IF;

  -- Criar index idempotente (fora do IF acima para garantir que sempre tenta criar)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'actors'
      AND indexname = 'idx_actors_group'
  ) THEN
    CREATE INDEX idx_actors_group
      ON actors (group_id)
      WHERE group_id IS NOT NULL;
  END IF;
END $$;


-- ============================================================
-- FASE 6: TRIGGER TÉCNICA (CONTAGEM DE MEMBROS)
-- ============================================================

CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups
      SET member_count = member_count + 1
      WHERE group_id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE groups
      SET member_count = GREATEST(member_count - 1, 0)
      WHERE group_id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_group_member_count ON group_members;
CREATE TRIGGER trg_update_group_member_count
  AFTER INSERT OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION update_group_member_count();


-- ============================================================
-- FASE 7: ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_groups_status
  ON groups (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_groups_category
  ON groups (tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_groups_can_sell
  ON groups (tenant_id, can_sell)
  WHERE can_sell = true;

CREATE INDEX IF NOT EXISTS idx_groups_last_activity
  ON groups (tenant_id, last_activity_at);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE user_active_groups IS
  'Grupos ativos do usuário para cálculo de split. Política definida na aplicação.';

COMMENT ON TABLE split_configuration IS
  'Configurações declarativas do Split Engine por tenant.';

COMMENT ON COLUMN groups.status IS
  'Status declarado do grupo (ex: draft, informal, verified). Regras na aplicação.';

COMMENT ON COLUMN groups.can_sell IS
  'Indica se o grupo está qualificado economicamente. Decisão da aplicação.';

COMMENT ON COLUMN groups.last_activity_at IS
  'Última atividade registrada do grupo. Atualizado pela aplicação.';

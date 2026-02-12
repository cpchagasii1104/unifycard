-- ============================================================
-- UNIFICARD - MIGRATION 094
-- Event Participants (Contrato v1.3)
-- Prestadores, artistas, staff, colaboradores
-- FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de participantes/prestadores de eventos
-- (events) e check-ins individuais auditáveis.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena participantes e check-ins como registros declarativos
--   • garante integridade estrutural e isolamento por tenant
-- - A APLICAÇÃO:
--   • controla lifecycle (status, roles, políticas)
--   • valida taxonomias (role, payment_type, check_in_method)
--   • dispara impactos, penalidades e liquidações via escrow/ledger
--
-- DECISÕES IMPORTANTES:
-- - Sem CHECKs rígidos de domínio (role/status/payment_type/method)
--   para permitir evolução sem migrations traumáticas.
-- - CHECKs são usados apenas para integridade física (valores, faixas).
-- - RISCO/CONFLITO: já existe uma tabela 'event_participants' criada
--   no bloco cultural (migration 084). Para não quebrar execução:
--     • se 'event_participants' NÃO existir: cria canônica com esse nome
--     • se 'event_participants' JÁ existir: cria 'event_participants_v13'
--       e 'event_check_ins_v13' (canônicas) para evitar colisão.
--
-- DEPENDÊNCIAS:
-- - tenants
-- - events (tabela canônica)
-- - actors
--
-- IMPACTO:
-- - Cria tabelas novas (ou versões _v13 se houver colisão)
-- - Nenhuma lógica de domínio é executada no banco
-- ============================================================


-- ============================================================
-- CREATE TABLES (COM ANTI-COLISÃO)
-- ============================================================
DO $$
DECLARE
  participants_table_name TEXT;
  checkins_table_name TEXT;
BEGIN
  IF to_regclass('public.event_participants') IS NULL THEN
    participants_table_name := 'event_participants';
    checkins_table_name := 'event_check_ins';
  ELSE
    participants_table_name := 'event_participants_v13';
    checkins_table_name := 'event_check_ins_v13';
  END IF;

  -- ----------------------------
  -- PARTICIPANTES DE EVENTO
  -- ----------------------------
  EXECUTE format($SQL$
    CREATE TABLE IF NOT EXISTS %I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

      event_id UUID NOT NULL
        REFERENCES events(id) ON DELETE CASCADE,

      -- Actor
      actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,

      actor_type VARCHAR(10) NOT NULL,

      -- Função (domínio valida)
      role VARCHAR(50) NOT NULL,

      -- Responsabilidade (domínio valida; aqui só integridade básica opcional)
      responsibility_level INTEGER NOT NULL DEFAULT 2
        CHECK (responsibility_level >= 1 AND responsibility_level <= 3),

      -- Economia (integridade física)
      agreed_amount_cents INTEGER NOT NULL DEFAULT 0
        CHECK (agreed_amount_cents >= 0),

      payment_type VARCHAR(20) NOT NULL DEFAULT 'fixed',

      -- Check-in / entrega
      expected_headcount INTEGER NOT NULL DEFAULT 1
        CHECK (expected_headcount > 0),

      check_in_required BOOLEAN NOT NULL DEFAULT true,

      minimum_check_in_rate NUMERIC(3,2) DEFAULT 0.80
        CHECK (minimum_check_in_rate >= 0 AND minimum_check_in_rate <= 1),

      -- Status (domínio valida)
      status VARCHAR(20) NOT NULL DEFAULT 'INVITED',

      -- Timestamps
      invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      confirmed_at TIMESTAMPTZ,
      checked_in_at TIMESTAMPTZ,

      -- Metadata
      metadata JSONB DEFAULT '{}'::jsonb,

      CONSTRAINT %I UNIQUE (event_id, actor_id)
    );
  $SQL$, participants_table_name, participants_table_name || '_unique');

  -- ----------------------------
  -- CHECK-INS INDIVIDUAIS
  -- ----------------------------
  EXECUTE format($SQL$
    CREATE TABLE IF NOT EXISTS %I (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

      event_id UUID NOT NULL
        REFERENCES events(id) ON DELETE CASCADE,

      participant_id UUID
        REFERENCES %I(id) ON DELETE CASCADE,

      -- Quem fez check-in
      actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,

      actor_type VARCHAR(10) NOT NULL,

      -- Validação (domínio valida)
      check_in_method VARCHAR(20) NOT NULL,

      validated_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,

      -- Localização (integridade física opcional)
      latitude NUMERIC(10,7)
        CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),

      longitude NUMERIC(10,7)
        CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),

      checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      metadata JSONB DEFAULT '{}'::jsonb
    );
  $SQL$, checkins_table_name, participants_table_name);

  -- ----------------------------
  -- ÍNDICES (multi-tenant úteis)
  -- ----------------------------
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, event_id);',
                 'idx_'||participants_table_name||'_tenant_event', participants_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, actor_id);',
                 'idx_'||participants_table_name||'_tenant_actor', participants_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, status);',
                 'idx_'||participants_table_name||'_tenant_status', participants_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, role);',
                 'idx_'||participants_table_name||'_tenant_role', participants_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, responsibility_level);',
                 'idx_'||participants_table_name||'_tenant_responsibility', participants_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, event_id);',
                 'idx_'||checkins_table_name||'_tenant_event', checkins_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, participant_id) WHERE participant_id IS NOT NULL;',
                 'idx_'||checkins_table_name||'_tenant_participant', checkins_table_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, actor_id);',
                 'idx_'||checkins_table_name||'_tenant_actor', checkins_table_name);

  -- ----------------------------
  -- RLS (padronizado)
  -- ----------------------------
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', participants_table_name);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', checkins_table_name);

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;',
                 participants_table_name||'_rls', participants_table_name);

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I;',
                 checkins_table_name||'_rls', checkins_table_name);

  EXECUTE format($POL$
    CREATE POLICY %I ON %I
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
  $POL$, participants_table_name||'_rls', participants_table_name);

  EXECUTE format($POL$
    CREATE POLICY %I ON %I
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
  $POL$, checkins_table_name||'_rls', checkins_table_name);

  -- ----------------------------
  -- COMENTÁRIOS
  -- ----------------------------
  EXECUTE format($C$
    COMMENT ON TABLE %I IS
      'Prestadores e participantes do evento (Contrato v1.3). Registro declarativo; regras de domínio na aplicação.';
  $C$, participants_table_name);

  EXECUTE format($C$
    COMMENT ON TABLE %I IS
      'Registros de check-in individuais (Contrato v1.3). Confirmação de presença/entrega no mundo real.';
  $C$, checkins_table_name);

  EXECUTE format($C$
    COMMENT ON COLUMN %I.responsibility_level IS
      'Nível de responsabilidade (1..3). Interpretação e regras são da aplicação.';
  $C$, participants_table_name);

  EXECUTE format($C$
    COMMENT ON COLUMN %I.minimum_check_in_rate IS
      'Taxa mínima (0..1) esperada para check-ins quando aplicável. Regra de enforcement é da aplicação.';
  $C$, participants_table_name);

  EXECUTE format($C$
    COMMENT ON COLUMN %I.check_in_method IS
      'Método de check-in (ex: QR, MANUAL, GEO, AUTO). Taxonomia validada na aplicação.';
  $C$, checkins_table_name);

END $$;














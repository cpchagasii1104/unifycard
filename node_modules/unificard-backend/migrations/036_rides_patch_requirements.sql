-- ============================================================
-- UNIFICARD — MIGRATION 036
-- Arquivo: 036_rides_patch_requirements.sql
-- Tipo: PATCH ADITIVO (schema + funções)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration implementa requisitos operacionais críticos
-- do módulo de corridas (rides), com foco em:
--
-- • Controle legal de jornada do motorista (limite de 12 horas)
-- • Cálculo de ganhos em tempo real (por hora e por km)
-- • Registro de paradas intermediárias por corrida
-- • Preparação de dados para incentivos e métricas operacionais
--
-- ESCOPO DO PATCH
-- ✔ Adiciona colunas em rides_driver_sessions
-- ✔ Cria tabela rides_ride_stops com RLS, índices e constraints
-- ✔ Cria funções VOLATILE com efeitos colaterais explícitos
-- ✔ Cria índice parcial para sessões ativas
-- ✔ Adiciona constraint única correta para isolamento multi-tenant
--
-- ❌ NÃO remove colunas
-- ❌ NÃO altera dados históricos existentes
-- ❌ NÃO renomeia tabelas, funções ou constraints antigas
--
-- DEPENDÊNCIAS OBRIGATÓRIAS
-- Extensões:
-- • uuid-ossp
-- • postgis
--
-- Tabelas pré-existentes:
-- • rides_driver_sessions
-- • rides_rides
-- • rides_zone_demand_pressure
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • Funções que fazem INSERT/UPDATE são VOLATILE
-- • Todas as leituras e escritas são tenant-scoped
-- • alerts_sent é JSONB do tipo OBJETO (não array)
-- • Distâncias usam NUMERIC(8,3)
--
-- EFEITOS COLATERAIS IMPORTANTES
-- ⚠ rides_check_driving_limit
--   • Pode alterar estado da sessão (forced_break)
--   • Pode bloquear novas corridas por regra legal
--
-- ⚠ rides_calculate_realtime_earnings
--   • Atualiza métricas agregadas da sessão em tempo real
--
-- SEGURANÇA
-- • rides_ride_stops possui RLS baseada em tenant_id
-- • Todas as funções exigem tenant_id explícito como parâmetro
--
-- IDMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS
-- • Pode ser executada múltiplas vezes sem efeitos colaterais
--
-- COMPATIBILIDADE
-- • Compatível com migrations anteriores do módulo rides
-- • Não depende de ordem específica além das tabelas base
--
-- HISTÓRICO
-- • Criada para atender requisitos operacionais do Clayton
-- • Revisada em auditoria final para consistência e segurança
--
-- ============================================================


-- ============================================
-- 1) CAMPOS FALTANTES EM rides_driver_sessions
-- ============================================

ALTER TABLE rides_driver_sessions 
ADD COLUMN IF NOT EXISTS current_earnings_per_hour NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_earnings_per_km NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings_session NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_distance_km_session NUMERIC(8,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rides_session INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS alerts_sent JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS vehicle_id UUID,
ADD COLUMN IF NOT EXISTS city_id UUID;

-- ============================================
-- 2) TABELA rides_ride_stops
-- ============================================

CREATE TABLE IF NOT EXISTS rides_ride_stops (
  stop_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  ride_id UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  stop_order INTEGER NOT NULL,

  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  location GEOGRAPHY(POINT),
  address TEXT,

  notes TEXT,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(30),

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  driver_arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,

  wait_time_seconds INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_ride_stop_order UNIQUE (ride_id, stop_order),
  CONSTRAINT chk_rides_ride_stops_status CHECK (
    status IN ('pending','arriving','arrived','completed','skipped')
  )
);

CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_ride
  ON rides_ride_stops(ride_id);

CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_status
  ON rides_ride_stops(ride_id, status);

ALTER TABLE rides_ride_stops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rides_ride_stops'
      AND policyname = 'rides_ride_stops_rls'
  ) THEN
    CREATE POLICY rides_ride_stops_rls
      ON rides_ride_stops
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_rides_ride_stops_updated_at'
  ) THEN
    CREATE TRIGGER trg_rides_ride_stops_updated_at
      BEFORE UPDATE ON rides_ride_stops
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 3) FUNÇÃO: rides_check_driving_limit
-- ============================================

CREATE OR REPLACE FUNCTION rides_check_driving_limit(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_session RECORD;
  v_driving_minutes INTEGER;
  v_max_minutes INTEGER := 720;
  v_minutes_remaining INTEGER;
  v_forced_break_until TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_session
  FROM rides_driver_sessions
  WHERE tenant_id = p_tenant_id
    AND driver_id = p_driver_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'can_drive', true,
      'driving_minutes', 0,
      'minutes_remaining', v_max_minutes
    );
  END IF;

  IF v_session.is_forced_break
     AND v_session.forced_break_until > now() THEN
    RETURN jsonb_build_object(
      'can_drive', false,
      'driving_minutes', v_session.driving_time_minutes,
      'minutes_remaining', 0,
      'forced_break_until', v_session.forced_break_until
    );
  END IF;

  v_driving_minutes := COALESCE(v_session.driving_time_minutes, 0);
  v_minutes_remaining := v_max_minutes - v_driving_minutes;

  IF v_driving_minutes >= v_max_minutes THEN
    v_forced_break_until := now() + interval '8 hours';

    UPDATE rides_driver_sessions
    SET is_forced_break = true,
        forced_break_until = v_forced_break_until
    WHERE session_id = v_session.session_id;

    RETURN jsonb_build_object(
      'can_drive', false,
      'driving_minutes', v_driving_minutes,
      'minutes_remaining', 0,
      'forced_break_until', v_forced_break_until
    );
  END IF;

  RETURN jsonb_build_object(
    'can_drive', true,
    'driving_minutes', v_driving_minutes,
    'minutes_remaining', v_minutes_remaining
  );
END;
$$;

-- ============================================
-- 4) FUNÇÃO: rides_calculate_realtime_earnings
-- ============================================

CREATE OR REPLACE FUNCTION rides_calculate_realtime_earnings(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_session RECORD;
  v_total_earnings NUMERIC(12,2);
  v_total_distance NUMERIC(8,3);
  v_total_rides INTEGER;
  v_online_minutes NUMERIC;
BEGIN
  SELECT *
  INTO v_session
  FROM rides_driver_sessions
  WHERE tenant_id = p_tenant_id
    AND driver_id = p_driver_id
    AND ended_at IS NULL
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('has_session', false);
  END IF;

  SELECT
    COALESCE(SUM(r.final_price * 0.85),0),
    COALESCE(SUM(r.total_distance_km),0),
    COUNT(*)
  INTO v_total_earnings, v_total_distance, v_total_rides
  FROM rides_rides r
  WHERE r.tenant_id = p_tenant_id
    AND r.driver_id = p_driver_id
    AND r.status = 'completed'
    AND r.completed_at >= v_session.started_at;

  v_online_minutes :=
    EXTRACT(EPOCH FROM (now() - v_session.started_at)) / 60;

  UPDATE rides_driver_sessions
  SET total_earnings_session = v_total_earnings,
      total_distance_km_session = v_total_distance,
      total_rides_session = v_total_rides,
      current_earnings_per_hour =
        CASE WHEN v_online_minutes > 0
             THEN (v_total_earnings / v_online_minutes) * 60
        END,
      current_earnings_per_km =
        CASE WHEN v_total_distance > 0
             THEN v_total_earnings / v_total_distance
        END
  WHERE session_id = v_session.session_id;

  RETURN jsonb_build_object(
    'has_session', true,
    'total_earnings', v_total_earnings,
    'total_distance_km', v_total_distance,
    'total_rides', v_total_rides,
    'online_minutes', ROUND(v_online_minutes)
  );
END;
$$;

-- ============================================
-- 5) ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rides_driver_sessions_active
  ON rides_driver_sessions(tenant_id, driver_id)
  WHERE ended_at IS NULL;

-- ============================================
-- 6) CONSTRAINT CORRETA DE PRESSÃO POR TENANT
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rides_zone_demand_pressure_tenant_zone_unique'
  ) THEN
    ALTER TABLE rides_zone_demand_pressure
      ADD CONSTRAINT rides_zone_demand_pressure_tenant_zone_unique
      UNIQUE (tenant_id, zone_id);
  END IF;
END $$;

-- ============================================
-- FIM 036_rides_patch_requirements.sql
-- ============================================

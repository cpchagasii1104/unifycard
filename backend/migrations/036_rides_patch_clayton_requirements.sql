-- ============================================
-- 016_rides_patch_clayton_requirements.sql
-- PATCH CIRÚRGICO: Adiciona campos e funções
-- para atender os 5 requisitos do Clayton
-- ============================================
-- Compatível com migrations 009-015 existentes
-- NÃO sobrescreve nada, apenas ADICIONA
-- ============================================

-- ============================================
-- 1) CAMPOS FALTANTES EM rides_driver_sessions
-- Requisito: Ganho por hora e por km em tempo real
-- ============================================

ALTER TABLE rides_driver_sessions 
ADD COLUMN IF NOT EXISTS current_earnings_per_hour NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_earnings_per_km NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings_session NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_distance_km_session NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_rides_session INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS alerts_sent JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS vehicle_id UUID,
ADD COLUMN IF NOT EXISTS city_id UUID;

-- ============================================
-- 2) TABELA rides_ride_stops
-- Requisito: Paradas detalhadas da corrida
-- ============================================

CREATE TABLE IF NOT EXISTS rides_ride_stops (
  stop_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  ride_id            UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,
  
  -- Ordem da parada (1, 2, 3...)
  stop_order         INTEGER NOT NULL,
  
  -- Localização
  lat                NUMERIC(10,7) NOT NULL,
  lng                NUMERIC(10,7) NOT NULL,
  location           GEOGRAPHY(POINT),
  address            TEXT,
  
  -- Informações adicionais
  notes              TEXT,
  contact_name       VARCHAR(100),
  contact_phone      VARCHAR(30),
  
  -- Status da parada
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | arriving | arrived | completed | skipped
  
  -- Timestamps
  driver_arrived_at  TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  skipped_at         TIMESTAMPTZ,
  
  -- Tempo de espera
  wait_time_seconds  INTEGER DEFAULT 0,
  
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_ride_stop_order UNIQUE(ride_id, stop_order)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_ride ON rides_ride_stops(ride_id);
CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_status ON rides_ride_stops(ride_id, status);

-- RLS
ALTER TABLE rides_ride_stops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rides_ride_stops' AND policyname = 'rides_ride_stops_rls') THEN
    CREATE POLICY rides_ride_stops_rls ON rides_ride_stops
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_ride_stops_updated_at') THEN
    CREATE TRIGGER trg_rides_ride_stops_updated_at
      BEFORE UPDATE ON rides_ride_stops
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 3) FUNÇÃO: rides_check_driving_limit
-- Requisito: Limite de 12 horas dirigindo
-- ============================================

CREATE OR REPLACE FUNCTION rides_check_driving_limit(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_driving_minutes INTEGER;
  v_max_minutes INTEGER := 720; -- 12 horas
  v_warning_10h INTEGER := 600;
  v_warning_11h INTEGER := 660;
  v_warning_11h30 INTEGER := 690;
  v_can_drive BOOLEAN := true;
  v_reason TEXT := null;
  v_warning TEXT := null;
  v_minutes_remaining INTEGER;
  v_forced_break_until TIMESTAMPTZ := null;
  v_recovery_hours INTEGER := 8;
BEGIN
  -- Buscar sessão ativa
  SELECT * INTO v_session
  FROM rides_driver_sessions
  WHERE tenant_id = p_tenant_id
    AND driver_id = p_driver_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  -- Se não tem sessão ativa, pode dirigir
  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'can_drive', true,
      'driving_minutes', 0,
      'minutes_remaining', v_max_minutes,
      'warning', null,
      'reason', null
    );
  END IF;
  
  -- Verificar se está em pausa forçada
  IF v_session.is_forced_break = true AND v_session.forced_break_until > now() THEN
    RETURN jsonb_build_object(
      'can_drive', false,
      'driving_minutes', v_session.driving_time_minutes,
      'minutes_remaining', 0,
      'warning', 'forced_break',
      'reason', 'Pausa obrigatória até ' || to_char(v_session.forced_break_until, 'HH24:MI'),
      'forced_break_until', v_session.forced_break_until
    );
  END IF;
  
  -- Se pausa forçada expirou, resetar
  IF v_session.is_forced_break = true AND v_session.forced_break_until <= now() THEN
    UPDATE rides_driver_sessions
    SET is_forced_break = false,
        forced_break_until = null,
        driving_time_minutes = 0,
        alerts_sent = '[]'::jsonb
    WHERE session_id = v_session.session_id;
    
    RETURN jsonb_build_object(
      'can_drive', true,
      'driving_minutes', 0,
      'minutes_remaining', v_max_minutes,
      'warning', 'break_completed',
      'reason', 'Período de descanso concluído. Você pode voltar a dirigir.'
    );
  END IF;
  
  v_driving_minutes := COALESCE(v_session.driving_time_minutes, 0);
  v_minutes_remaining := v_max_minutes - v_driving_minutes;
  
  -- Verificar limite atingido
  IF v_driving_minutes >= v_max_minutes THEN
    v_forced_break_until := now() + (v_recovery_hours || ' hours')::interval;
    
    -- Forçar pausa
    UPDATE rides_driver_sessions
    SET is_forced_break = true,
        forced_break_until = v_forced_break_until
    WHERE session_id = v_session.session_id;
    
    RETURN jsonb_build_object(
      'can_drive', false,
      'driving_minutes', v_driving_minutes,
      'minutes_remaining', 0,
      'warning', 'limit_reached',
      'reason', 'Limite de 12 horas atingido. Descanso obrigatório de 8 horas.',
      'forced_break_until', v_forced_break_until
    );
  END IF;
  
  -- Verificar avisos progressivos
  IF v_driving_minutes >= v_warning_11h30 THEN
    v_warning := '11h30_warning';
  ELSIF v_driving_minutes >= v_warning_11h THEN
    v_warning := '11h_warning';
  ELSIF v_driving_minutes >= v_warning_10h THEN
    v_warning := '10h_warning';
  END IF;
  
  -- Registrar alerta se novo
  IF v_warning IS NOT NULL THEN
    IF NOT (v_session.alerts_sent ? v_warning) THEN
      UPDATE rides_driver_sessions
      SET alerts_sent = alerts_sent || jsonb_build_object(v_warning, now())
      WHERE session_id = v_session.session_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'can_drive', true,
    'driving_minutes', v_driving_minutes,
    'minutes_remaining', v_minutes_remaining,
    'warning', v_warning,
    'reason', CASE 
      WHEN v_warning = '11h30_warning' THEN 'Atenção: Restam apenas 30 minutos de direção'
      WHEN v_warning = '11h_warning' THEN 'Atenção: Restam 1 hora de direção'
      WHEN v_warning = '10h_warning' THEN 'Você está dirigindo há 10 horas'
      ELSE null
    END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4) FUNÇÃO: rides_calculate_realtime_earnings
-- Requisito: Ganho por hora e por km em tempo real
-- ============================================

CREATE OR REPLACE FUNCTION rides_calculate_realtime_earnings(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_total_earnings NUMERIC(12,2) := 0;
  v_total_distance NUMERIC(10,2) := 0;
  v_total_rides INTEGER := 0;
  v_online_minutes NUMERIC(10,2) := 0;
  v_earnings_per_hour NUMERIC(10,2) := 0;
  v_earnings_per_km NUMERIC(10,2) := 0;
BEGIN
  -- Buscar sessão ativa
  SELECT * INTO v_session
  FROM rides_driver_sessions
  WHERE tenant_id = p_tenant_id
    AND driver_id = p_driver_id
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object(
      'has_session', false,
      'earnings_per_hour', 0,
      'earnings_per_km', 0,
      'total_earnings', 0,
      'total_distance_km', 0,
      'total_rides', 0,
      'online_minutes', 0
    );
  END IF;
  
  -- Calcular ganhos da sessão atual
  SELECT 
    COALESCE(SUM(r.final_price * 0.85), 0), -- 85% para motorista (exemplo)
    COALESCE(SUM(r.total_distance_km), 0),
    COUNT(*)
  INTO v_total_earnings, v_total_distance, v_total_rides
  FROM rides_rides r
  WHERE r.tenant_id = p_tenant_id
    AND r.driver_id = p_driver_id
    AND r.status = 'completed'
    AND r.completed_at >= v_session.started_at
    AND r.completed_at <= COALESCE(v_session.ended_at, now());
  
  -- Calcular tempo online
  v_online_minutes := EXTRACT(EPOCH FROM (now() - v_session.started_at)) / 60;
  
  -- Calcular métricas
  IF v_online_minutes > 0 THEN
    v_earnings_per_hour := (v_total_earnings / v_online_minutes) * 60;
  END IF;
  
  IF v_total_distance > 0 THEN
    v_earnings_per_km := v_total_earnings / v_total_distance;
  END IF;
  
  -- Atualizar sessão com valores calculados
  UPDATE rides_driver_sessions
  SET current_earnings_per_hour = v_earnings_per_hour,
      current_earnings_per_km = v_earnings_per_km,
      total_earnings_session = v_total_earnings,
      total_distance_km_session = v_total_distance,
      total_rides_session = v_total_rides
  WHERE session_id = v_session.session_id;
  
  RETURN jsonb_build_object(
    'has_session', true,
    'session_id', v_session.session_id,
    'earnings_per_hour', ROUND(v_earnings_per_hour, 2),
    'earnings_per_km', ROUND(v_earnings_per_km, 2),
    'total_earnings', ROUND(v_total_earnings, 2),
    'total_distance_km', ROUND(v_total_distance, 2),
    'total_rides', v_total_rides,
    'online_minutes', ROUND(v_online_minutes, 0),
    'started_at', v_session.started_at
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5) FUNÇÃO: rides_calculate_zone_pressure
-- Base para incentivos automáticos
-- ============================================

CREATE OR REPLACE FUNCTION rides_calculate_zone_pressure(
  p_tenant_id UUID,
  p_zone_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_active_requests INTEGER;
  v_available_drivers INTEGER;
  v_pressure NUMERIC(5,2);
  v_level VARCHAR(20);
BEGIN
  -- Contar requests pendentes na zona (últimos 10 min)
  SELECT COUNT(*) INTO v_active_requests
  FROM rides_ride_requests rr
  INNER JOIN rides_zones z ON ST_Contains(z.polygon::geometry, rr.origin::geometry)
  WHERE rr.tenant_id = p_tenant_id
    AND z.zone_id = p_zone_id
    AND rr.status IN ('pending', 'searching')
    AND rr.created_at > now() - interval '10 minutes';
  
  -- Contar motoristas online na zona
  SELECT COUNT(*) INTO v_available_drivers
  FROM rides_driver_availability da
  INNER JOIN rides_driver_locations dl ON dl.driver_id = da.driver_id AND dl.tenant_id = da.tenant_id
  INNER JOIN rides_zones z ON ST_Contains(z.polygon::geometry, dl.location::geometry)
  WHERE da.tenant_id = p_tenant_id
    AND z.zone_id = p_zone_id
    AND da.is_online = true
    AND dl.updated_at > now() - interval '5 minutes';
  
  -- Calcular pressão
  IF v_available_drivers = 0 THEN
    v_pressure := CASE WHEN v_active_requests > 0 THEN 10.0 ELSE 0.0 END;
  ELSE
    v_pressure := v_active_requests::NUMERIC / v_available_drivers::NUMERIC;
  END IF;
  
  -- Determinar nível
  v_level := CASE 
    WHEN v_pressure < 0.5 THEN 'low'
    WHEN v_pressure < 1.0 THEN 'normal'
    WHEN v_pressure < 2.0 THEN 'high'
    WHEN v_pressure < 3.0 THEN 'critical'
    ELSE 'emergency'
  END;
  
  -- Atualizar tabela de pressão
  INSERT INTO rides_zone_demand_pressure (
    tenant_id, zone_id, active_requests, available_drivers, pressure, calculated_at
  )
  VALUES (
    p_tenant_id, p_zone_id, v_active_requests, v_available_drivers, v_pressure, now()
  )
  ON CONFLICT (zone_id) DO UPDATE SET
    active_requests = v_active_requests,
    available_drivers = v_available_drivers,
    pressure = v_pressure,
    calculated_at = now();
  
  -- Se pressão alta, criar incentivo automático
  IF v_pressure >= 1.5 THEN
    PERFORM rides_create_auto_zone_incentive(p_tenant_id, p_zone_id, v_level);
  END IF;
  
  RETURN jsonb_build_object(
    'zone_id', p_zone_id,
    'active_requests', v_active_requests,
    'available_drivers', v_available_drivers,
    'pressure', v_pressure,
    'level', v_level,
    'incentive_created', v_pressure >= 1.5
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6) FUNÇÃO: rides_create_auto_zone_incentive
-- Requisito: Criar incentivo automático por zona
-- ============================================

CREATE OR REPLACE FUNCTION rides_create_auto_zone_incentive(
  p_tenant_id UUID,
  p_zone_id UUID,
  p_reason TEXT DEFAULT 'high_demand'
)
RETURNS UUID AS $$
DECLARE
  v_incentive_id UUID;
  v_existing UUID;
  v_incentive_value NUMERIC(10,2);
  v_pressure NUMERIC(5,2);
BEGIN
  -- Verificar pressão atual
  SELECT pressure INTO v_pressure
  FROM rides_zone_demand_pressure
  WHERE tenant_id = p_tenant_id AND zone_id = p_zone_id;
  
  -- Calcular valor do incentivo baseado na pressão
  -- pressure 1.5 = R$ 0.50/km extra
  -- pressure 2.0 = R$ 1.00/km extra
  -- pressure 3.0+ = R$ 2.00/km extra
  v_incentive_value := CASE
    WHEN v_pressure >= 3.0 THEN 2.00
    WHEN v_pressure >= 2.0 THEN 1.00
    WHEN v_pressure >= 1.5 THEN 0.50
    ELSE 0
  END;
  
  IF v_incentive_value = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se já existe incentivo ativo para esta zona
  SELECT incentive_id INTO v_existing
  FROM rides_zone_incentives
  WHERE tenant_id = p_tenant_id
    AND zone_id = p_zone_id
    AND is_active = true
    AND expires_at > now();
  
  IF v_existing IS NOT NULL THEN
    -- Atualizar incentivo existente (estender tempo e ajustar valor se maior)
    UPDATE rides_zone_incentives
    SET incentive_value = GREATEST(incentive_value, v_incentive_value),
        expires_at = GREATEST(expires_at, now() + interval '30 minutes'),
        reason = p_reason
    WHERE incentive_id = v_existing;
    
    RETURN v_existing;
  END IF;
  
  -- Criar novo incentivo
  INSERT INTO rides_zone_incentives (
    tenant_id,
    zone_id,
    incentive_type,
    incentive_value,
    reason,
    starts_at,
    expires_at,
    is_active
  )
  VALUES (
    p_tenant_id,
    p_zone_id,
    'per_km',
    v_incentive_value,
    p_reason,
    now(),
    now() + interval '30 minutes',
    true
  )
  RETURNING incentive_id INTO v_incentive_id;
  
  RETURN v_incentive_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7) FUNÇÃO AUXILIAR: rides_find_nearby_drivers
-- Buscar motoristas próximos (verificando limite 12h)
-- ============================================

CREATE OR REPLACE FUNCTION rides_find_nearby_drivers(
  p_tenant_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_radius_km NUMERIC DEFAULT 5,
  p_service_type_id UUID DEFAULT NULL,
  p_min_capacity INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  driver_id UUID,
  user_id UUID,
  distance_km NUMERIC,
  rating_avg NUMERIC,
  vehicle_capacity INTEGER,
  can_drive BOOLEAN,
  driving_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.driver_id,
    d.user_id,
    ROUND((ST_Distance(
      dl.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000)::numeric, 2) as distance_km,
    d.rating_avg,
    v.capacity as vehicle_capacity,
    (rides_check_driving_limit(p_tenant_id, d.driver_id)->>'can_drive')::boolean as can_drive,
    (rides_check_driving_limit(p_tenant_id, d.driver_id)->>'driving_minutes')::integer as driving_minutes
  FROM rides_drivers d
  INNER JOIN rides_driver_availability da ON da.driver_id = d.driver_id AND da.tenant_id = d.tenant_id
  INNER JOIN rides_driver_locations dl ON dl.driver_id = d.driver_id AND dl.tenant_id = d.tenant_id
  LEFT JOIN rides_vehicles v ON v.driver_id = d.driver_id AND v.tenant_id = d.tenant_id AND v.is_active = true
  WHERE d.tenant_id = p_tenant_id
    AND d.is_active = true
    AND da.is_online = true
    AND dl.updated_at > now() - interval '5 minutes'
    AND ST_DWithin(
      dl.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
    AND (p_service_type_id IS NULL OR EXISTS (
      SELECT 1 FROM rides_driver_services ds 
      WHERE ds.driver_id = d.driver_id 
        AND ds.service_type_id = p_service_type_id 
        AND ds.is_enabled = true
    ))
    AND (v.capacity IS NULL OR v.capacity >= p_min_capacity)
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 8) ÍNDICES AUXILIARES
-- ============================================

-- Índice para buscar zona por ponto geográfico
CREATE INDEX IF NOT EXISTS idx_rides_zones_polygon_gist 
  ON rides_zones USING GIST(polygon);

-- Índice para buscar motoristas por localização
CREATE INDEX IF NOT EXISTS idx_rides_driver_locations_gist 
  ON rides_driver_locations USING GIST(location);

-- Índice para sessões ativas
CREATE INDEX IF NOT EXISTS idx_rides_driver_sessions_active 
  ON rides_driver_sessions(driver_id, ended_at) 
  WHERE ended_at IS NULL;

-- Índice para requests pendentes
CREATE INDEX IF NOT EXISTS idx_rides_requests_pending 
  ON rides_ride_requests(tenant_id, status, created_at) 
  WHERE status IN ('pending', 'searching');

-- ============================================
-- 9) ADICIONAR CONSTRAINT ÚNICA NA PRESSÃO
-- (se não existir)
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_zone_demand_pressure_zone_unique'
  ) THEN
    ALTER TABLE rides_zone_demand_pressure 
    ADD CONSTRAINT rides_zone_demand_pressure_zone_unique UNIQUE(zone_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON FUNCTION rides_check_driving_limit IS 
  'Verifica limite de 12h de direção com avisos progressivos (10h, 11h, 11h30) e pausa forçada de 8h';

COMMENT ON FUNCTION rides_calculate_realtime_earnings IS 
  'Calcula ganhos por hora e por km em tempo real para o motorista';

COMMENT ON FUNCTION rides_calculate_zone_pressure IS 
  'Calcula pressão de demanda na zona e cria incentivos automáticos';

COMMENT ON FUNCTION rides_create_auto_zone_incentive IS 
  'Cria incentivo automático por km quando zona tem alta demanda';

COMMENT ON FUNCTION rides_find_nearby_drivers IS 
  'Busca motoristas próximos verificando capacidade e limite de 12h';

COMMENT ON TABLE rides_ride_stops IS 
  'Paradas intermediárias detalhadas de cada corrida';

-- ============================================
-- FIM 016_rides_patch_clayton_requirements.sql
-- ============================================

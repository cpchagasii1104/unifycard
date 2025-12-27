-- ============================================
-- 016_rides_patch_clayton_requirements.sql
-- PATCH CIRÚRGICO: Adiciona campos e funções
-- para atender os 5 requisitos críticos:
-- 1. Ganhos/hora e ganhos/km
-- 2. Paradas detalhadas na corrida
-- 3. Limite de 12h dirigindo
-- 4. Pressão de demanda por zona (surge)
-- 5. Incentivos automáticos por zona
--
-- Compatível com migrations 009–015
-- NÃO sobrescreve nada, apenas adiciona
-- ============================================


-- ============================================
-- 1) CAMPOS EM rides_driver_sessions
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
-- 2) TABELA: rides_ride_stops
-- ============================================

CREATE TABLE IF NOT EXISTS rides_ride_stops (
  stop_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  ride_id            UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  stop_order         INTEGER NOT NULL,

  lat                NUMERIC(10,7) NOT NULL,
  lng                NUMERIC(10,7) NOT NULL,
  location           GEOGRAPHY(POINT),
  address            TEXT,

  notes              TEXT,
  contact_name       VARCHAR(100),
  contact_phone      VARCHAR(30),

  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | arriving | arrived | completed | skipped

  driver_arrived_at  TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  skipped_at         TIMESTAMPTZ,

  wait_time_seconds  INTEGER DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_ride_stop_order UNIQUE(ride_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_ride ON rides_ride_stops(ride_id);
CREATE INDEX IF NOT EXISTS idx_rides_ride_stops_status ON rides_ride_stops(status);

ALTER TABLE rides_ride_stops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rides_ride_stops' 
      AND policyname = 'rides_ride_stops_rls'
  ) THEN
    CREATE POLICY rides_ride_stops_rls ON rides_ride_stops
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_ride_stops_updated_at'
  ) THEN
    CREATE TRIGGER trg_rides_ride_stops_updated_at
      BEFORE UPDATE ON rides_ride_stops
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================
-- 3) FUNÇÃO: rides_check_driving_limit
-- Limite de 12 horas dirigindo
-- ============================================

CREATE OR REPLACE FUNCTION rides_check_driving_limit(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_driving_minutes INTEGER;
  v_max_minutes INTEGER := 720; -- 12h
  v_warning_10h  INTEGER := 600;
  v_warning_11h  INTEGER := 660;
  v_warning_11h30 INTEGER := 690;

  v_minutes_remaining INTEGER;
  v_warning TEXT := null;

  v_forced_break_until TIMESTAMPTZ := null;
  v_recovery_hours INTEGER := 8;

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

  -- pausa forçada ativa
  IF v_session.is_forced_break = true AND v_session.forced_break_until > now() THEN
    RETURN jsonb_build_object(
      'can_drive', false,
      'driving_minutes', v_session.driving_time_minutes,
      'minutes_remaining', 0,
      'warning', 'forced_break',
      'forced_break_until', v_session.forced_break_until
    );
  END IF;

  -- pausa forçada finalizada → reset
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
      'minutes_remaining', v_max_minutes
    );
  END IF;

  v_driving_minutes := COALESCE(v_session.driving_time_minutes, 0);
  v_minutes_remaining := v_max_minutes - v_driving_minutes;

  -- limite atingido
  IF v_driving_minutes >= v_max_minutes THEN
    v_forced_break_until := now() + (v_recovery_hours || ' hours')::interval;

    UPDATE rides_driver_sessions
    SET is_forced_break = true,
        forced_break_until = v_forced_break_until
    WHERE session_id = v_session.session_id;

    RETURN jsonb_build_object(
      'can_drive', false,
      'warning', 'limit_reached',
      'forced_break_until', v_forced_break_until
    );
  END IF;

  -- avisos progressivos
  IF v_driving_minutes >= v_warning_11h30 THEN
    v_warning := '11h30_warning';
  ELSIF v_driving_minutes >= v_warning_11h THEN
    v_warning := '11h_warning';
  ELSIF v_driving_minutes >= v_warning_10h THEN
    v_warning := '10h_warning';
  END IF;

  -- registrar alerta no JSON
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
    'warning', v_warning
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 4) FUNÇÃO: rides_calculate_realtime_earnings
-- ============================================

CREATE OR REPLACE FUNCTION rides_calculate_realtime_earnings(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_total NUMERIC(12,2) := 0;
  v_dist NUMERIC(10,2) := 0;
  v_rides INTEGER := 0;
  v_online_minutes NUMERIC := 0;
  v_epk NUMERIC := 0;
  v_eph NUMERIC := 0;
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
    RETURN jsonb_build_object('has_session', false);
  END IF;

  SELECT
    COALESCE(SUM(r.final_price * 0.85), 0),
    COALESCE(SUM(r.total_distance_km), 0),
    COUNT(*)
  INTO v_total, v_dist, v_rides
  FROM rides_rides r
  WHERE r.tenant_id = p_tenant_id
    AND r.driver_id = p_driver_id
    AND r.status = 'completed'
    AND r.completed_at >= v_session.started_at;

  v_online_minutes :=
    EXTRACT(EPOCH FROM (now() - v_session.started_at)) / 60;

  IF v_online_minutes > 0 THEN
    v_eph := (v_total / v_online_minutes) * 60;
  END IF;

  IF v_dist > 0 THEN
    v_epk := v_total / v_dist;
  END IF;

  UPDATE rides_driver_sessions
  SET current_earnings_per_hour = v_eph,
      current_earnings_per_km = v_epk,
      total_earnings_session = v_total,
      total_distance_km_session = v_dist,
      total_rides_session = v_rides
  WHERE session_id = v_session.session_id;

  RETURN jsonb_build_object(
    'has_session', true,
    'session_id', v_session.session_id,
    'earnings_per_hour', ROUND(v_eph, 2),
    'earnings_per_km', ROUND(v_epk, 2),
    'total_earnings', ROUND(v_total, 2),
    'total_distance_km', ROUND(v_dist, 2),
    'total_rides', v_rides,
    'online_minutes', ROUND(v_online_minutes, 0)
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 5) FUNÇÃO: rides_calculate_zone_pressure
-- ============================================

CREATE OR REPLACE FUNCTION rides_calculate_zone_pressure(
  p_tenant_id UUID,
  p_zone_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_req INTEGER;
  v_drivers INTEGER;
  v_pressure NUMERIC(5,2);
  v_level VARCHAR(20);
BEGIN
  SELECT COUNT(*)
  INTO v_req
  FROM rides_ride_requests rr
  INNER JOIN rides_zones z ON ST_Contains(z.polygon::geometry, rr.origin::geometry)
  WHERE rr.tenant_id = p_tenant_id
    AND z.zone_id = p_zone_id
    AND rr.status IN ('pending','searching')
    AND rr.created_at > now() - interval '10 minutes';

  SELECT COUNT(*)
  INTO v_drivers
  FROM rides_driver_availability da
  INNER JOIN rides_driver_locations dl USING (driver_id, tenant_id)
  INNER JOIN rides_zones z ON ST_Contains(z.polygon::geometry, dl.location::geometry)
  WHERE da.tenant_id = p_tenant_id
    AND z.zone_id = p_zone_id
    AND da.is_online = true
    AND dl.updated_at > now() - interval '5 minutes';

  IF v_drivers = 0 THEN
    v_pressure := CASE WHEN v_req > 0 THEN 10 ELSE 0 END;
  ELSE
    v_pressure := v_req::NUMERIC / v_drivers::NUMERIC;
  END IF;

  v_level := CASE
    WHEN v_pressure < 0.5 THEN 'low'
    WHEN v_pressure < 1.0 THEN 'normal'
    WHEN v_pressure < 2.0 THEN 'high'
    WHEN v_pressure < 3.0 THEN 'critical'
    ELSE 'emergency'
  END;

  INSERT INTO rides_zone_demand_pressure (
    tenant_id, zone_id, active_requests, available_drivers, pressure, calculated_at
  )
  VALUES (
    p_tenant_id, p_zone_id, v_req, v_drivers, v_pressure, now()
  )
  ON CONFLICT (zone_id)
  DO UPDATE SET
    active_requests = v_req,
    available_drivers = v_drivers,
    pressure = v_pressure,
    calculated_at = now();

  IF v_pressure >= 1.5 THEN
    PERFORM rides_create_auto_zone_incentive(p_tenant_id, p_zone_id, v_level);
  END IF;

  RETURN jsonb_build_object(
    'zone_id', p_zone_id,
    'active_requests', v_req,
    'available_drivers', v_drivers,
    'pressure', v_pressure,
    'level', v_level,
    'incentive_created', v_pressure >= 1.5
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 6) FUNÇÃO: rides_create_auto_zone_incentive
-- ============================================

CREATE OR REPLACE FUNCTION rides_create_auto_zone_incentive(
  p_tenant_id UUID,
  p_zone_id UUID,
  p_reason TEXT DEFAULT 'high_demand'
)
RETURNS UUID AS $$
DECLARE
  v_pressure NUMERIC(5,2);
  v_value NUMERIC(10,2);
  v_existing UUID;
  v_new UUID;
BEGIN
  SELECT pressure INTO v_pressure
  FROM rides_zone_demand_pressure
  WHERE tenant_id = p_tenant_id AND zone_id = p_zone_id;

  v_value := CASE
    WHEN v_pressure >= 3.0 THEN 2.00
    WHEN v_pressure >= 2.0 THEN 1.00
    WHEN v_pressure >= 1.5 THEN 0.50
    ELSE 0
  END;

  IF v_value = 0 THEN
    RETURN NULL;
  END IF;

  SELECT incentive_id INTO v_existing
  FROM rides_zone_incentives
  WHERE tenant_id = p_tenant_id
    AND zone_id = p_zone_id
    AND is_active = true
    AND expires_at > now();

  IF v_existing IS NOT NULL THEN
    UPDATE rides_zone_incentives
    SET incentive_value = GREATEST(incentive_value, v_value),
        expires_at = GREATEST(expires_at, now() + interval '30 minutes'),
        reason = p_reason
    WHERE incentive_id = v_existing;

    RETURN v_existing;
  END IF;

  INSERT INTO rides_zone_incentives (
    tenant_id, zone_id, incentive_type, incentive_value,
    reason, starts_at, expires_at, is_active
  )
  VALUES (
    p_tenant_id, p_zone_id, 'per_km', v_value,
    p_reason, now(), now() + interval '30 minutes', true
  )
  RETURNING incentive_id INTO v_new;

  RETURN v_new;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- 7) FUNÇÃO: rides_find_nearby_drivers
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
    ROUND((
      ST_Distance(
        dl.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000
    )::numeric, 2) AS distance_km,
    d.rating_avg,
    v.capacity,
    (rides_check_driving_limit(p_tenant_id, d.driver_id)->>'can_drive')::boolean,
    (rides_check_driving_limit(p_tenant_id, d.driver_id)->>'driving_minutes')::integer
  FROM rides_drivers d
  INNER JOIN rides_driver_availability da USING (driver_id, tenant_id)
  INNER JOIN rides_driver_locations dl USING (driver_id, tenant_id)
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
    AND (
      p_service_type_id IS NULL OR 
      EXISTS (
        SELECT 1 FROM rides_driver_services ds
        WHERE ds.driver_id = d.driver_id
          AND ds.service_type_id = p_service_type_id
          AND ds.is_enabled = true
      )
    )
    AND (v.capacity IS NULL OR v.capacity >= p_min_capacity)
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- 8) ÍNDICES AUXILIARES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rides_zones_polygon_gist 
  ON rides_zones USING GIST(polygon);

CREATE INDEX IF NOT EXISTS idx_rides_driver_locations_gist 
  ON rides_driver_locations USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_rides_driver_sessions_active 
  ON rides_driver_sessions(driver_id, ended_at)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rides_requests_pending 
  ON rides_ride_requests(tenant_id, status, created_at)
  WHERE status IN ('pending','searching');


-- ============================================
-- 9) UNIQUE CONSTRAINT PARA rides_zone_demand_pressure
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rides_zone_demand_pressure_zone_unique'
  ) THEN
    ALTER TABLE rides_zone_demand_pressure 
    ADD CONSTRAINT rides_zone_demand_pressure_zone_unique UNIQUE (zone_id);
  END IF;
END $$;


-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON FUNCTION rides_check_driving_limit IS 
  'Verifica limite de 12h com avisos progressivos e pausa forçada de 8h.';

COMMENT ON FUNCTION rides_calculate_realtime_earnings IS 
  'Calcula ganhos por hora e por km em tempo real.';

COMMENT ON FUNCTION rides_calculate_zone_pressure IS 
  'Calcula pressão da zona e cria incentivos automáticos.';

COMMENT ON FUNCTION rides_create_auto_zone_incentive IS 
  'Cria incentivos por km em zonas com pressão alta.';

COMMENT ON FUNCTION rides_find_nearby_drivers IS 
  'Busca motoristas próximos e verifica limite de 12h.';

COMMENT ON TABLE rides_ride_stops IS 
  'Tabela de paradas intermediárias detalhadas da corrida.';


-- ============================================
-- FIM DO PATCH 016
-- ============================================

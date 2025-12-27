-- ============================================
-- 017_rides_driver_vehicle_compliance.sql
-- Documentos, Classificação de Veículos, Compliance
-- ============================================
-- Requisitos:
-- 1. CNH com EAR, data de vencimento
-- 2. Documentos do veículo (CRLV, fotos, seguro)
-- 3. Classificação automática (economy/comfort/premium)
-- 4. Bloqueio automático se documento vencido
-- 5. Sistema de revalidação
-- ============================================

-- ============================================
-- 1) CAMPOS EXTRAS EM rides_drivers
-- ============================================

ALTER TABLE rides_drivers
ADD COLUMN IF NOT EXISTS license_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS license_category VARCHAR(10), -- A, B, AB, C, D, E
ADD COLUMN IF NOT EXISTS license_expires_at DATE,
ADD COLUMN IF NOT EXISTS license_first_issue_at DATE, -- data primeira habilitação
ADD COLUMN IF NOT EXISTS has_ear BOOLEAN DEFAULT false, -- Exerce Atividade Remunerada
ADD COLUMN IF NOT EXISTS ear_expires_at DATE,
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS rg VARCHAR(20),
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending',
-- pending | documents_pending | under_review | approved | rejected | suspended | blocked
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS primary_city_id UUID,
ADD COLUMN IF NOT EXISTS background_check_status VARCHAR(20) DEFAULT 'pending',
-- pending | passed | failed | expired
ADD COLUMN IF NOT EXISTS background_check_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS background_check_expires_at DATE,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS training_completed_at TIMESTAMPTZ;

-- ============================================
-- 2) CAMPOS EXTRAS EM rides_vehicles
-- ============================================

ALTER TABLE rides_vehicles
ADD COLUMN IF NOT EXISTS make VARCHAR(50), -- marca (se não tiver brand)
ADD COLUMN IF NOT EXISTS renavam VARCHAR(20),
ADD COLUMN IF NOT EXISTS chassis VARCHAR(30),
ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20), -- gasolina, etanol, flex, diesel, eletrico, hibrido
ADD COLUMN IF NOT EXISTS transmission VARCHAR(20), -- manual, automatico
ADD COLUMN IF NOT EXISTS doors INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS air_conditioning BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS registration_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS registration_state VARCHAR(2),
ADD COLUMN IF NOT EXISTS registration_expires_at DATE, -- CRLV
ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_policy VARCHAR(50),
ADD COLUMN IF NOT EXISTS insurance_expires_at DATE,
ADD COLUMN IF NOT EXISTS has_app_insurance BOOLEAN DEFAULT false, -- seguro do app
ADD COLUMN IF NOT EXISTS category_id UUID, -- FK para rides_vehicle_categories
ADD COLUMN IF NOT EXISTS category_key VARCHAR(30), -- economy, comfort, premium, black
ADD COLUMN IF NOT EXISTS category_assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending',
-- pending | documents_pending | under_review | approved | rejected | suspended
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '{}',
-- {"frontal": "url", "traseira": "url", "lateral_esq": "url", "lateral_dir": "url", "interna": "url", "placa": "url"}
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}',
-- {"wifi": true, "carregador": true, "agua": true, "cadeirinha": false}
ADD COLUMN IF NOT EXISTS last_inspection_at DATE,
ADD COLUMN IF NOT EXISTS next_inspection_due DATE;

-- ============================================
-- 3) TABELA: rides_vehicle_categories
-- Categorias de veículos (UberX, Comfort, Black style)
-- ============================================

CREATE TABLE IF NOT EXISTS rides_vehicle_categories (
  category_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  
  key                VARCHAR(30) NOT NULL, -- economy, comfort, premium, black, pool
  name               VARCHAR(50) NOT NULL, -- "Econômico", "Conforto", "Premium"
  description        TEXT,
  icon_url           TEXT,
  
  -- Requisitos do veículo
  min_year           INTEGER NOT NULL DEFAULT 2015,
  max_year           INTEGER, -- null = sem limite
  min_seats          INTEGER NOT NULL DEFAULT 4,
  max_seats          INTEGER DEFAULT 7,
  
  -- Marcas/modelos permitidos (JSONB array)
  allowed_makes      JSONB DEFAULT '[]', -- ["Toyota", "Honda", "Volkswagen"]
  allowed_models     JSONB DEFAULT '[]', -- se vazio, todos permitidos
  blocked_models     JSONB DEFAULT '[]', -- modelos explicitamente bloqueados
  
  -- Requisitos obrigatórios
  requires_air_conditioning BOOLEAN DEFAULT true,
  requires_4_doors   BOOLEAN DEFAULT true,
  requires_automatic BOOLEAN DEFAULT false,
  
  -- Requisitos do motorista
  min_driver_rating  NUMERIC(3,2) DEFAULT 4.5,
  min_driver_trips   INTEGER DEFAULT 0,
  
  -- Pricing
  base_fare_multiplier NUMERIC(4,2) DEFAULT 1.00, -- 1.0 = padrão, 1.5 = 50% mais caro
  per_km_multiplier  NUMERIC(4,2) DEFAULT 1.00,
  per_min_multiplier NUMERIC(4,2) DEFAULT 1.00,
  
  -- Status
  is_active          BOOLEAN NOT NULL DEFAULT true,
  display_order      INTEGER DEFAULT 0,
  
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, key)
);

-- RLS
ALTER TABLE rides_vehicle_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rides_vehicle_categories' AND policyname = 'rides_vehicle_categories_rls') THEN
    CREATE POLICY rides_vehicle_categories_rls ON rides_vehicle_categories
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_vehicle_categories_updated_at') THEN
    CREATE TRIGGER trg_rides_vehicle_categories_updated_at
      BEFORE UPDATE ON rides_vehicle_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 4) TABELA: rides_driver_documents
-- Documentos do motorista
-- ============================================

CREATE TABLE IF NOT EXISTS rides_driver_documents (
  document_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  driver_id          UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,
  
  document_type      VARCHAR(30) NOT NULL,
  -- cnh | cnh_frente | cnh_verso | ear | selfie | selfie_cnh | 
  -- antecedentes | comprovante_residencia | foto_perfil
  
  file_url           TEXT NOT NULL,
  file_name          VARCHAR(255),
  file_size_bytes    INTEGER,
  file_mime_type     VARCHAR(50),
  
  -- Dados extraídos (OCR ou manual)
  extracted_data     JSONB DEFAULT '{}',
  -- {"numero": "123456", "categoria": "B", "validade": "2025-12-31"}
  
  -- Vencimento
  expires_at         DATE,
  expiration_notified_at TIMESTAMPTZ, -- quando notificou sobre vencimento
  
  -- Verificação
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | under_review | approved | rejected | expired
  
  verified_at        TIMESTAMPTZ,
  verified_by        UUID,
  rejected_reason    TEXT,
  rejection_code     VARCHAR(30),
  -- invalid_document | unreadable | expired | wrong_type | fraud_suspected
  
  -- Controle
  version            INTEGER DEFAULT 1, -- versão do documento (reenvios)
  replaced_by        UUID, -- se foi substituído por novo upload
  is_current         BOOLEAN DEFAULT true,
  
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rides_driver_docs_driver ON rides_driver_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_docs_type ON rides_driver_documents(driver_id, document_type, is_current);
CREATE INDEX IF NOT EXISTS idx_rides_driver_docs_status ON rides_driver_documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_docs_expiring ON rides_driver_documents(tenant_id, expires_at) 
  WHERE status = 'approved' AND expires_at IS NOT NULL;

-- RLS
ALTER TABLE rides_driver_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rides_driver_documents' AND policyname = 'rides_driver_documents_rls') THEN
    CREATE POLICY rides_driver_documents_rls ON rides_driver_documents
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_driver_documents_updated_at') THEN
    CREATE TRIGGER trg_rides_driver_documents_updated_at
      BEFORE UPDATE ON rides_driver_documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 5) TABELA: rides_vehicle_documents
-- Documentos do veículo
-- ============================================

CREATE TABLE IF NOT EXISTS rides_vehicle_documents (
  document_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  vehicle_id         UUID NOT NULL REFERENCES rides_vehicles(vehicle_id) ON DELETE CASCADE,
  
  document_type      VARCHAR(30) NOT NULL,
  -- crlv | crlv_frente | crlv_verso | 
  -- foto_frontal | foto_traseira | foto_lateral_esq | foto_lateral_dir | foto_interna | foto_placa |
  -- seguro | autorizacao_antt | laudo_vistoria
  
  file_url           TEXT NOT NULL,
  file_name          VARCHAR(255),
  file_size_bytes    INTEGER,
  file_mime_type     VARCHAR(50),
  
  -- Dados extraídos
  extracted_data     JSONB DEFAULT '{}',
  
  -- Vencimento
  expires_at         DATE,
  expiration_notified_at TIMESTAMPTZ,
  
  -- Verificação
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | under_review | approved | rejected | expired
  
  verified_at        TIMESTAMPTZ,
  verified_by        UUID,
  rejected_reason    TEXT,
  rejection_code     VARCHAR(30),
  
  -- Controle
  version            INTEGER DEFAULT 1,
  replaced_by        UUID,
  is_current         BOOLEAN DEFAULT true,
  
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_docs_vehicle ON rides_vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_docs_type ON rides_vehicle_documents(vehicle_id, document_type, is_current);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_docs_status ON rides_vehicle_documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_vehicle_docs_expiring ON rides_vehicle_documents(tenant_id, expires_at)
  WHERE status = 'approved' AND expires_at IS NOT NULL;

-- RLS
ALTER TABLE rides_vehicle_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rides_vehicle_documents' AND policyname = 'rides_vehicle_documents_rls') THEN
    CREATE POLICY rides_vehicle_documents_rls ON rides_vehicle_documents
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rides_vehicle_documents_updated_at') THEN
    CREATE TRIGGER trg_rides_vehicle_documents_updated_at
      BEFORE UPDATE ON rides_vehicle_documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 6) TABELA: rides_document_requirements
-- Documentos obrigatórios por cidade/serviço
-- ============================================

CREATE TABLE IF NOT EXISTS rides_document_requirements (
  requirement_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  city_id            UUID REFERENCES rides_cities(city_id),
  service_type_id    UUID,
  category_id        UUID REFERENCES rides_vehicle_categories(category_id),
  
  entity_type        VARCHAR(20) NOT NULL, -- driver | vehicle
  document_type      VARCHAR(30) NOT NULL,
  
  is_required        BOOLEAN NOT NULL DEFAULT true,
  has_expiration     BOOLEAN NOT NULL DEFAULT false,
  
  description        TEXT,
  instructions       TEXT,
  example_url        TEXT,
  
  is_active          BOOLEAN NOT NULL DEFAULT true,
  
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE rides_document_requirements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rides_document_requirements' AND policyname = 'rides_document_requirements_rls') THEN
    CREATE POLICY rides_document_requirements_rls ON rides_document_requirements
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================
-- 7) FUNÇÃO: rides_classify_vehicle
-- Classifica veículo automaticamente na categoria
-- ============================================

CREATE OR REPLACE FUNCTION rides_classify_vehicle(
  p_tenant_id UUID,
  p_vehicle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_vehicle RECORD;
  v_category RECORD;
  v_driver RECORD;
  v_matched_category_id UUID := NULL;
  v_matched_category_key VARCHAR(30) := NULL;
  v_reason TEXT := NULL;
BEGIN
  -- Buscar veículo
  SELECT * INTO v_vehicle
  FROM rides_vehicles
  WHERE tenant_id = p_tenant_id AND vehicle_id = p_vehicle_id;
  
  IF v_vehicle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Veículo não encontrado');
  END IF;
  
  -- Buscar motorista para verificar rating
  SELECT * INTO v_driver
  FROM rides_drivers
  WHERE tenant_id = p_tenant_id AND driver_id = v_vehicle.driver_id;
  
  -- Tentar classificar da categoria mais alta para a mais baixa
  FOR v_category IN 
    SELECT * FROM rides_vehicle_categories
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY base_fare_multiplier DESC, display_order ASC
  LOOP
    -- Verificar ano mínimo
    IF v_vehicle.year < v_category.min_year THEN
      CONTINUE;
    END IF;
    
    -- Verificar ano máximo (se definido)
    IF v_category.max_year IS NOT NULL AND v_vehicle.year > v_category.max_year THEN
      CONTINUE;
    END IF;
    
    -- Verificar assentos
    IF v_vehicle.capacity < v_category.min_seats THEN
      CONTINUE;
    END IF;
    
    IF v_category.max_seats IS NOT NULL AND v_vehicle.capacity > v_category.max_seats THEN
      CONTINUE;
    END IF;
    
    -- Verificar ar condicionado
    IF v_category.requires_air_conditioning AND NOT COALESCE(v_vehicle.air_conditioning, false) THEN
      CONTINUE;
    END IF;
    
    -- Verificar 4 portas
    IF v_category.requires_4_doors AND COALESCE(v_vehicle.doors, 4) < 4 THEN
      CONTINUE;
    END IF;
    
    -- Verificar câmbio automático
    IF v_category.requires_automatic AND v_vehicle.transmission != 'automatico' THEN
      CONTINUE;
    END IF;
    
    -- Verificar rating do motorista
    IF v_driver IS NOT NULL AND v_category.min_driver_rating IS NOT NULL THEN
      IF COALESCE(v_driver.rating_avg, 5.0) < v_category.min_driver_rating THEN
        CONTINUE;
      END IF;
    END IF;
    
    -- Verificar viagens mínimas do motorista
    IF v_driver IS NOT NULL AND v_category.min_driver_trips IS NOT NULL THEN
      IF COALESCE(v_driver.total_trips_completed, 0) < v_category.min_driver_trips THEN
        CONTINUE;
      END IF;
    END IF;
    
    -- Verificar marcas permitidas (se definidas)
    IF jsonb_array_length(v_category.allowed_makes) > 0 THEN
      IF NOT (v_category.allowed_makes ? COALESCE(v_vehicle.make, v_vehicle.brand)) THEN
        CONTINUE;
      END IF;
    END IF;
    
    -- Verificar modelos bloqueados
    IF jsonb_array_length(v_category.blocked_models) > 0 THEN
      IF v_category.blocked_models ? v_vehicle.model THEN
        CONTINUE;
      END IF;
    END IF;
    
    -- Se chegou aqui, o veículo atende esta categoria!
    v_matched_category_id := v_category.category_id;
    v_matched_category_key := v_category.key;
    EXIT; -- Para no primeiro match (mais alto)
  END LOOP;
  
  -- Se não encontrou categoria, usar economy como fallback
  IF v_matched_category_id IS NULL THEN
    SELECT category_id, key INTO v_matched_category_id, v_matched_category_key
    FROM rides_vehicle_categories
    WHERE tenant_id = p_tenant_id AND key = 'economy' AND is_active = true
    LIMIT 1;
    
    IF v_matched_category_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Nenhuma categoria encontrada para este veículo'
      );
    END IF;
    
    v_reason := 'Classificado como economy (padrão)';
  END IF;
  
  -- Atualizar veículo
  UPDATE rides_vehicles
  SET category_id = v_matched_category_id,
      category_key = v_matched_category_key,
      category_assigned_at = now()
  WHERE vehicle_id = p_vehicle_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'vehicle_id', p_vehicle_id,
    'category_id', v_matched_category_id,
    'category_key', v_matched_category_key,
    'reason', v_reason
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8) FUNÇÃO: rides_check_driver_compliance
-- Verifica se motorista pode ficar online
-- ============================================

CREATE OR REPLACE FUNCTION rides_check_driver_compliance(
  p_tenant_id UUID,
  p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_driver RECORD;
  v_vehicle RECORD;
  v_issues JSONB := '[]'::jsonb;
  v_can_go_online BOOLEAN := true;
  v_doc RECORD;
  v_days_to_expire INTEGER;
BEGIN
  -- Buscar motorista
  SELECT * INTO v_driver
  FROM rides_drivers
  WHERE tenant_id = p_tenant_id AND driver_id = p_driver_id;
  
  IF v_driver IS NULL THEN
    RETURN jsonb_build_object(
      'can_go_online', false,
      'issues', jsonb_build_array(jsonb_build_object('code', 'driver_not_found', 'message', 'Motorista não encontrado'))
    );
  END IF;
  
  -- Verificar status do motorista
  IF v_driver.verification_status != 'approved' THEN
    v_can_go_online := false;
    v_issues := v_issues || jsonb_build_object(
      'code', 'driver_not_approved',
      'message', 'Cadastro do motorista não está aprovado',
      'status', v_driver.verification_status
    );
  END IF;
  
  -- Verificar se motorista está bloqueado
  IF v_driver.blocked_at IS NOT NULL THEN
    v_can_go_online := false;
    v_issues := v_issues || jsonb_build_object(
      'code', 'driver_blocked',
      'message', 'Motorista bloqueado: ' || COALESCE(v_driver.blocked_reason, 'Motivo não informado')
    );
  END IF;
  
  -- Verificar CNH
  IF v_driver.license_expires_at IS NOT NULL THEN
    v_days_to_expire := v_driver.license_expires_at - CURRENT_DATE;
    
    IF v_days_to_expire < 0 THEN
      v_can_go_online := false;
      v_issues := v_issues || jsonb_build_object(
        'code', 'cnh_expired',
        'message', 'CNH vencida',
        'expired_at', v_driver.license_expires_at
      );
    ELSIF v_days_to_expire <= 30 THEN
      v_issues := v_issues || jsonb_build_object(
        'code', 'cnh_expiring_soon',
        'message', 'CNH vence em ' || v_days_to_expire || ' dias',
        'expires_at', v_driver.license_expires_at,
        'severity', 'warning'
      );
    END IF;
  END IF;
  
  -- Verificar EAR
  IF NOT COALESCE(v_driver.has_ear, false) THEN
    v_can_go_online := false;
    v_issues := v_issues || jsonb_build_object(
      'code', 'ear_missing',
      'message', 'EAR (Exerce Atividade Remunerada) não cadastrado'
    );
  ELSIF v_driver.ear_expires_at IS NOT NULL THEN
    v_days_to_expire := v_driver.ear_expires_at - CURRENT_DATE;
    
    IF v_days_to_expire < 0 THEN
      v_can_go_online := false;
      v_issues := v_issues || jsonb_build_object(
        'code', 'ear_expired',
        'message', 'EAR vencido',
        'expired_at', v_driver.ear_expires_at
      );
    ELSIF v_days_to_expire <= 30 THEN
      v_issues := v_issues || jsonb_build_object(
        'code', 'ear_expiring_soon',
        'message', 'EAR vence em ' || v_days_to_expire || ' dias',
        'expires_at', v_driver.ear_expires_at,
        'severity', 'warning'
      );
    END IF;
  END IF;
  
  -- Verificar documentos obrigatórios do motorista
  FOR v_doc IN
    SELECT dd.document_type, dd.status, dd.expires_at
    FROM rides_driver_documents dd
    WHERE dd.tenant_id = p_tenant_id 
      AND dd.driver_id = p_driver_id 
      AND dd.is_current = true
  LOOP
    IF v_doc.status = 'rejected' THEN
      v_can_go_online := false;
      v_issues := v_issues || jsonb_build_object(
        'code', 'document_rejected',
        'message', 'Documento rejeitado: ' || v_doc.document_type,
        'document_type', v_doc.document_type
      );
    ELSIF v_doc.status = 'expired' OR (v_doc.expires_at IS NOT NULL AND v_doc.expires_at < CURRENT_DATE) THEN
      v_can_go_online := false;
      v_issues := v_issues || jsonb_build_object(
        'code', 'document_expired',
        'message', 'Documento vencido: ' || v_doc.document_type,
        'document_type', v_doc.document_type,
        'expired_at', v_doc.expires_at
      );
    END IF;
  END LOOP;
  
  -- Buscar veículo ativo
  SELECT * INTO v_vehicle
  FROM rides_vehicles
  WHERE tenant_id = p_tenant_id 
    AND driver_id = p_driver_id 
    AND is_active = true
  LIMIT 1;
  
  IF v_vehicle IS NULL THEN
    v_can_go_online := false;
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_active_vehicle',
      'message', 'Nenhum veículo ativo cadastrado'
    );
  ELSE
    -- Verificar status do veículo
    IF v_vehicle.verification_status != 'approved' THEN
      v_can_go_online := false;
      v_issues := v_issues || jsonb_build_object(
        'code', 'vehicle_not_approved',
        'message', 'Veículo não aprovado',
        'vehicle_id', v_vehicle.vehicle_id,
        'status', v_vehicle.verification_status
      );
    END IF;
    
    -- Verificar CRLV
    IF v_vehicle.registration_expires_at IS NOT NULL THEN
      v_days_to_expire := v_vehicle.registration_expires_at - CURRENT_DATE;
      
      IF v_days_to_expire < 0 THEN
        v_can_go_online := false;
        v_issues := v_issues || jsonb_build_object(
          'code', 'crlv_expired',
          'message', 'CRLV vencido',
          'vehicle_id', v_vehicle.vehicle_id,
          'expired_at', v_vehicle.registration_expires_at
        );
      ELSIF v_days_to_expire <= 30 THEN
        v_issues := v_issues || jsonb_build_object(
          'code', 'crlv_expiring_soon',
          'message', 'CRLV vence em ' || v_days_to_expire || ' dias',
          'vehicle_id', v_vehicle.vehicle_id,
          'expires_at', v_vehicle.registration_expires_at,
          'severity', 'warning'
        );
      END IF;
    END IF;
    
    -- Verificar seguro (se obrigatório)
    IF v_vehicle.insurance_expires_at IS NOT NULL THEN
      v_days_to_expire := v_vehicle.insurance_expires_at - CURRENT_DATE;
      
      IF v_days_to_expire < 0 THEN
        v_issues := v_issues || jsonb_build_object(
          'code', 'insurance_expired',
          'message', 'Seguro vencido',
          'vehicle_id', v_vehicle.vehicle_id,
          'expired_at', v_vehicle.insurance_expires_at,
          'severity', 'warning'
        );
      END IF;
    END IF;
    
    -- Verificar categoria
    IF v_vehicle.category_id IS NULL THEN
      v_issues := v_issues || jsonb_build_object(
        'code', 'vehicle_not_classified',
        'message', 'Veículo não classificado em categoria',
        'vehicle_id', v_vehicle.vehicle_id,
        'severity', 'warning'
      );
    END IF;
    
    -- Verificar documentos do veículo
    FOR v_doc IN
      SELECT vd.document_type, vd.status, vd.expires_at
      FROM rides_vehicle_documents vd
      WHERE vd.tenant_id = p_tenant_id 
        AND vd.vehicle_id = v_vehicle.vehicle_id 
        AND vd.is_current = true
    LOOP
      IF v_doc.status = 'rejected' THEN
        v_can_go_online := false;
        v_issues := v_issues || jsonb_build_object(
          'code', 'vehicle_document_rejected',
          'message', 'Documento do veículo rejeitado: ' || v_doc.document_type,
          'document_type', v_doc.document_type
        );
      ELSIF v_doc.status = 'expired' OR (v_doc.expires_at IS NOT NULL AND v_doc.expires_at < CURRENT_DATE) THEN
        v_can_go_online := false;
        v_issues := v_issues || jsonb_build_object(
          'code', 'vehicle_document_expired',
          'message', 'Documento do veículo vencido: ' || v_doc.document_type,
          'document_type', v_doc.document_type,
          'expired_at', v_doc.expires_at
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'can_go_online', v_can_go_online,
    'driver_id', p_driver_id,
    'vehicle_id', v_vehicle.vehicle_id,
    'issues', v_issues,
    'issues_count', jsonb_array_length(v_issues),
    'blocking_issues_count', (
      SELECT COUNT(*) FROM jsonb_array_elements(v_issues) elem 
      WHERE elem->>'severity' IS NULL OR elem->>'severity' != 'warning'
    ),
    'checked_at', now()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9) FUNÇÃO: rides_get_expiring_documents
-- Busca documentos que vão vencer em X dias
-- ============================================

CREATE OR REPLACE FUNCTION rides_get_expiring_documents(
  p_tenant_id UUID,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  driver_id UUID,
  user_id UUID,
  document_type VARCHAR,
  expires_at DATE,
  days_remaining INTEGER,
  status VARCHAR
) AS $$
BEGIN
  -- Documentos de motoristas
  RETURN QUERY
  SELECT 
    'driver'::TEXT as entity_type,
    dd.document_id as entity_id,
    dd.driver_id,
    d.user_id,
    dd.document_type,
    dd.expires_at,
    (dd.expires_at - CURRENT_DATE)::INTEGER as days_remaining,
    dd.status
  FROM rides_driver_documents dd
  INNER JOIN rides_drivers d ON d.driver_id = dd.driver_id
  WHERE dd.tenant_id = p_tenant_id
    AND dd.is_current = true
    AND dd.status = 'approved'
    AND dd.expires_at IS NOT NULL
    AND dd.expires_at <= CURRENT_DATE + p_days_ahead
    AND dd.expires_at >= CURRENT_DATE
  
  UNION ALL
  
  -- CNH do motorista
  SELECT 
    'driver_license'::TEXT,
    d.driver_id,
    d.driver_id,
    d.user_id,
    'cnh'::VARCHAR,
    d.license_expires_at,
    (d.license_expires_at - CURRENT_DATE)::INTEGER,
    d.verification_status
  FROM rides_drivers d
  WHERE d.tenant_id = p_tenant_id
    AND d.license_expires_at IS NOT NULL
    AND d.license_expires_at <= CURRENT_DATE + p_days_ahead
    AND d.license_expires_at >= CURRENT_DATE
  
  UNION ALL
  
  -- EAR do motorista
  SELECT 
    'driver_ear'::TEXT,
    d.driver_id,
    d.driver_id,
    d.user_id,
    'ear'::VARCHAR,
    d.ear_expires_at,
    (d.ear_expires_at - CURRENT_DATE)::INTEGER,
    d.verification_status
  FROM rides_drivers d
  WHERE d.tenant_id = p_tenant_id
    AND d.ear_expires_at IS NOT NULL
    AND d.ear_expires_at <= CURRENT_DATE + p_days_ahead
    AND d.ear_expires_at >= CURRENT_DATE
  
  UNION ALL
  
  -- Documentos de veículos
  SELECT 
    'vehicle'::TEXT,
    vd.document_id,
    v.driver_id,
    d.user_id,
    vd.document_type,
    vd.expires_at,
    (vd.expires_at - CURRENT_DATE)::INTEGER,
    vd.status
  FROM rides_vehicle_documents vd
  INNER JOIN rides_vehicles v ON v.vehicle_id = vd.vehicle_id
  INNER JOIN rides_drivers d ON d.driver_id = v.driver_id
  WHERE vd.tenant_id = p_tenant_id
    AND vd.is_current = true
    AND vd.status = 'approved'
    AND vd.expires_at IS NOT NULL
    AND vd.expires_at <= CURRENT_DATE + p_days_ahead
    AND vd.expires_at >= CURRENT_DATE
  
  UNION ALL
  
  -- CRLV do veículo
  SELECT 
    'vehicle_crlv'::TEXT,
    v.vehicle_id,
    v.driver_id,
    d.user_id,
    'crlv'::VARCHAR,
    v.registration_expires_at,
    (v.registration_expires_at - CURRENT_DATE)::INTEGER,
    v.verification_status
  FROM rides_vehicles v
  INNER JOIN rides_drivers d ON d.driver_id = v.driver_id
  WHERE v.tenant_id = p_tenant_id
    AND v.registration_expires_at IS NOT NULL
    AND v.registration_expires_at <= CURRENT_DATE + p_days_ahead
    AND v.registration_expires_at >= CURRENT_DATE
  
  ORDER BY days_remaining ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 10) SEED: Categorias padrão
-- ============================================

CREATE OR REPLACE FUNCTION rides_seed_vehicle_categories(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO rides_vehicle_categories (tenant_id, key, name, description, min_year, min_seats, requires_air_conditioning, requires_4_doors, requires_automatic, min_driver_rating, min_driver_trips, base_fare_multiplier, display_order)
  VALUES
    (p_tenant_id, 'economy', 'Econômico', 'Viagens com melhor custo-benefício', 2012, 4, true, true, false, 4.0, 0, 1.00, 1),
    (p_tenant_id, 'comfort', 'Conforto', 'Carros mais espaçosos e confortáveis', 2017, 4, true, true, false, 4.7, 50, 1.30, 2),
    (p_tenant_id, 'premium', 'Premium', 'Veículos de alto padrão', 2019, 4, true, true, true, 4.85, 100, 1.60, 3),
    (p_tenant_id, 'black', 'Black', 'Experiência luxuosa com os melhores veículos', 2020, 4, true, true, true, 4.9, 200, 2.00, 4),
    (p_tenant_id, 'pool', 'Compartilhada', 'Divida a viagem e economize', 2012, 4, true, true, false, 4.0, 0, 0.70, 5)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11) SEED: Requisitos de documentos padrão
-- ============================================

CREATE OR REPLACE FUNCTION rides_seed_document_requirements(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Documentos do motorista
  INSERT INTO rides_document_requirements (tenant_id, entity_type, document_type, is_required, has_expiration, description)
  VALUES
    (p_tenant_id, 'driver', 'cnh', true, true, 'Carteira Nacional de Habilitação'),
    (p_tenant_id, 'driver', 'selfie_cnh', true, false, 'Selfie segurando a CNH'),
    (p_tenant_id, 'driver', 'foto_perfil', true, false, 'Foto de perfil'),
    (p_tenant_id, 'driver', 'comprovante_residencia', false, false, 'Comprovante de residência')
  ON CONFLICT DO NOTHING;
  
  -- Documentos do veículo
  INSERT INTO rides_document_requirements (tenant_id, entity_type, document_type, is_required, has_expiration, description)
  VALUES
    (p_tenant_id, 'vehicle', 'crlv', true, true, 'Certificado de Registro e Licenciamento do Veículo'),
    (p_tenant_id, 'vehicle', 'foto_frontal', true, false, 'Foto frontal do veículo'),
    (p_tenant_id, 'vehicle', 'foto_traseira', true, false, 'Foto traseira do veículo'),
    (p_tenant_id, 'vehicle', 'foto_lateral', true, false, 'Foto lateral do veículo'),
    (p_tenant_id, 'vehicle', 'foto_interna', true, false, 'Foto do interior do veículo')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE rides_vehicle_categories IS 'Categorias de veículos (economy, comfort, premium, black)';
COMMENT ON TABLE rides_driver_documents IS 'Documentos do motorista com controle de vencimento';
COMMENT ON TABLE rides_vehicle_documents IS 'Documentos do veículo com controle de vencimento';
COMMENT ON TABLE rides_document_requirements IS 'Documentos obrigatórios por cidade/serviço';

COMMENT ON FUNCTION rides_classify_vehicle IS 'Classifica veículo automaticamente na categoria apropriada';
COMMENT ON FUNCTION rides_check_driver_compliance IS 'Verifica se motorista pode ficar online (documentos, CNH, EAR, veículo)';
COMMENT ON FUNCTION rides_get_expiring_documents IS 'Lista documentos que vão vencer nos próximos X dias';
COMMENT ON FUNCTION rides_seed_vehicle_categories IS 'Cria categorias padrão de veículos';
COMMENT ON FUNCTION rides_seed_document_requirements IS 'Cria requisitos padrão de documentos';

-- ============================================
-- FIM 017_rides_driver_vehicle_compliance.sql
-- ============================================

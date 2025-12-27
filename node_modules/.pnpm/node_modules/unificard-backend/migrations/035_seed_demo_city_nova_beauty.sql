-- ================================================
-- UNIFICARD - MIGRATION 035
-- Seed Demo: Cidade Nova Beauty / Manicure
-- Cenário end-to-end de demonstração
-- ================================================

-- ===========================
-- 1. TENANT DEMO
-- ===========================
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Verificar se tenant já existe
  SELECT tenant_id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'cidade-nova-demo'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Criar tenant demo
    INSERT INTO tenants (name, slug)
    VALUES ('Cidade Nova Demo', 'cidade-nova-demo')
    RETURNING tenant_id INTO v_tenant_id;
    
    RAISE NOTICE '✅ Tenant "Cidade Nova Demo" criado (ID: %)', v_tenant_id;
  ELSE
    RAISE NOTICE 'ℹ️  Tenant "Cidade Nova Demo" já existe (ID: %)', v_tenant_id;
  END IF;
END $$;

-- ===========================
-- 2. EMPRESA DEMO
-- ===========================
DO $$
DECLARE
  v_tenant_id UUID;
  v_company_id UUID;
BEGIN
  -- Buscar tenant
  SELECT tenant_id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'cidade-nova-demo'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "Cidade Nova Demo" não encontrado';
  END IF;

  -- Verificar se empresa já existe
  SELECT company_id INTO v_company_id
  FROM companies
  WHERE tenant_id = v_tenant_id AND name = 'Cidade Nova Beauty'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    -- Criar empresa demo
    INSERT INTO companies (tenant_id, name, description, is_active)
    VALUES (v_tenant_id, 'Cidade Nova Beauty', 'Salão de beleza especializado em manicure e pedicure', true)
    ON CONFLICT (tenant_id, name) DO NOTHING
    RETURNING company_id INTO v_company_id;
    
    RAISE NOTICE '✅ Empresa "Cidade Nova Beauty" criada (ID: %)', v_company_id;
  ELSE
    RAISE NOTICE 'ℹ️  Empresa "Cidade Nova Beauty" já existe (ID: %)', v_company_id;
  END IF;
END $$;

-- ===========================
-- 4. USUÁRIA E PROFISSIONAL DEMO (Maria Manicure)
-- ===========================
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_profile_id UUID;
  v_global_user_id UUID;
  v_worker_id UUID;
BEGIN
  -- Buscar tenant
  SELECT tenant_id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'cidade-nova-demo'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "Cidade Nova Demo" não encontrado';
  END IF;

  -- Verificar se usuária já existe
  SELECT user_id INTO v_user_id
  FROM users
  WHERE tenant_id = v_tenant_id AND email = 'maria.manicure@cidadenova.demo'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Criar identidade global primeiro
    INSERT INTO global_users (full_name, metadata)
    VALUES ('Maria Manicure', '{"role": "worker", "demo": true}'::jsonb)
    RETURNING global_user_id INTO v_global_user_id;

    -- Criar usuária local
    INSERT INTO users (tenant_id, email, password_hash, global_user_id)
    VALUES (v_tenant_id, 'maria.manicure@cidadenova.demo', '$2b$10$dummy.hash.for.demo.user', v_global_user_id)
    RETURNING user_id INTO v_user_id;

    -- Criar perfil
    INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
    VALUES (v_tenant_id, v_user_id, 'Maria Manicure', '+55 11 99999-9999', '{"specialty": "manicure", "demo": true}'::jsonb)
    RETURNING profile_id INTO v_profile_id;

    -- Criar link de identidade
    INSERT INTO user_identity_links (global_user_id, user_id, tenant_id)
    VALUES (v_global_user_id, v_user_id, v_tenant_id)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Usuária "Maria Manicure" criada (user_id: %, global_user_id: %)', v_user_id, v_global_user_id;
  ELSE
    -- Buscar global_user_id existente
    SELECT global_user_id INTO v_global_user_id
    FROM users
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'ℹ️  Usuária "Maria Manicure" já existe (user_id: %, global_user_id: %)', v_user_id, v_global_user_id;
  END IF;

  -- Verificar se worker já existe
  SELECT worker_id INTO v_worker_id
  FROM workers
  WHERE tenant_id = v_tenant_id AND user_id = v_user_id
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    -- Criar worker
    INSERT INTO workers (tenant_id, user_id, bio, hourly_rate, is_active, is_verified, reputation_score)
    VALUES (
      v_tenant_id,
      v_user_id,
      'Manicure profissional com 10 anos de experiência. Especializada em unhas artísticas e esmaltação em gel.',
      50.00,
      true,
      true,
      4.8
    )
    RETURNING worker_id INTO v_worker_id;
    
    RAISE NOTICE '✅ Worker "Maria Manicure" criado (worker_id: %)', v_worker_id;
  ELSE
    RAISE NOTICE 'ℹ️  Worker "Maria Manicure" já existe (worker_id: %)', v_worker_id;
  END IF;
END $$;

-- ===========================
-- 5. CATEGORIAS (Beleza / Manicure)
-- ===========================
DO $$
DECLARE
  v_category_beleza_id UUID;
  v_category_manicure_id UUID;
BEGIN
  -- Verificar se categoria "beleza" já existe
  SELECT category_id INTO v_category_beleza_id
  FROM categories
  WHERE slug = 'beleza'
  LIMIT 1;

  IF v_category_beleza_id IS NULL THEN
    -- Criar categoria raiz "beleza"
    INSERT INTO categories (name, slug, description, level, path)
    VALUES ('Beleza', 'beleza', 'Categoria de serviços de beleza e estética', 0, ARRAY['beleza'])
    RETURNING category_id INTO v_category_beleza_id;
    
    RAISE NOTICE '✅ Categoria "Beleza" criada (ID: %)', v_category_beleza_id;
  ELSE
    RAISE NOTICE 'ℹ️  Categoria "Beleza" já existe (ID: %)', v_category_beleza_id;
  END IF;

  -- Verificar se categoria "manicure" já existe
  SELECT category_id INTO v_category_manicure_id
  FROM categories
  WHERE slug = 'beleza-manicure'
  LIMIT 1;

  IF v_category_manicure_id IS NULL THEN
    -- Criar categoria filha "manicure"
    INSERT INTO categories (parent_id, name, slug, description, level, path)
    VALUES (
      v_category_beleza_id,
      'Manicure',
      'beleza-manicure',
      'Serviços de manicure e pedicure',
      1,
      ARRAY['beleza', 'beleza-manicure']
    )
    RETURNING category_id INTO v_category_manicure_id;
    
    RAISE NOTICE '✅ Categoria "Manicure" criada (ID: %)', v_category_manicure_id;
  ELSE
    RAISE NOTICE 'ℹ️  Categoria "Manicure" já existe (ID: %)', v_category_manicure_id;
  END IF;
END $$;

-- ===========================
-- 6. SCHEDULE PARA MARIA MANICURE
-- ===========================
DO $$
DECLARE
  v_tenant_id UUID;
  v_global_user_id UUID;
  v_schedule_id UUID;
  v_sexta_18h TIMESTAMPTZ;
  v_sexta_19h TIMESTAMPTZ;
  v_sabado_10h TIMESTAMPTZ;
BEGIN
  -- Buscar tenant
  SELECT tenant_id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'cidade-nova-demo'
  LIMIT 1;

  -- Buscar global_user_id da Maria
  SELECT u.global_user_id INTO v_global_user_id
  FROM users u
  WHERE u.tenant_id = v_tenant_id AND u.email = 'maria.manicure@cidadenova.demo'
  LIMIT 1;

  IF v_global_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuária Maria Manicure não encontrada';
  END IF;

  -- Calcular datas (próxima sexta às 18h, 19h e próximo sábado às 10h)
  -- Assumindo timezone America/Sao_Paulo
  v_sexta_18h := (SELECT date_trunc('week', CURRENT_DATE) + INTERVAL '5 days' + INTERVAL '18 hours') AT TIME ZONE 'America/Sao_Paulo';
  v_sexta_19h := v_sexta_18h + INTERVAL '1 hour';
  v_sabado_10h := v_sexta_18h + INTERVAL '1 day' - INTERVAL '8 hours'; -- Sábado 10h

  -- Verificar se schedule já existe
  SELECT schedule_id INTO v_schedule_id
  FROM schedules
  WHERE tenant_id = v_tenant_id AND global_user_id = v_global_user_id
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    -- Criar schedule
    INSERT INTO schedules (tenant_id, global_user_id, metadata)
    VALUES (v_tenant_id, v_global_user_id, '{"demo": true, "worker_name": "Maria Manicure"}'::jsonb)
    RETURNING schedule_id INTO v_schedule_id;
    
    RAISE NOTICE '✅ Schedule criado para Maria Manicure (ID: %)', v_schedule_id;
  ELSE
    RAISE NOTICE 'ℹ️  Schedule já existe para Maria Manicure (ID: %)', v_schedule_id;
  END IF;

  -- Criar slots (se não existirem)
  -- Sexta 18h
  INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
  SELECT v_schedule_id, v_sexta_18h, v_sexta_18h + INTERVAL '1 hour', 'available', '{"demo": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM schedule_slots
    WHERE schedule_id = v_schedule_id
    AND start_time = v_sexta_18h
  );

  -- Sexta 19h
  INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
  SELECT v_schedule_id, v_sexta_19h, v_sexta_19h + INTERVAL '1 hour', 'available', '{"demo": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM schedule_slots
    WHERE schedule_id = v_schedule_id
    AND start_time = v_sexta_19h
  );

  -- Sábado 10h
  INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
  SELECT v_schedule_id, v_sabado_10h, v_sabado_10h + INTERVAL '1 hour', 'available', '{"demo": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM schedule_slots
    WHERE schedule_id = v_schedule_id
    AND start_time = v_sabado_10h
  );

  RAISE NOTICE '✅ Slots criados: Sexta 18h, Sexta 19h, Sábado 10h';
END $$;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE companies IS 'Empresas do sistema (demo: Cidade Nova Beauty)';









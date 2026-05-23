-- ================================================
-- UNIFICARD - SEED DEMO
-- Seed Demo: Cidade Nova Beauty / Manicure
-- Cenário end-to-end de demonstração funcional
-- ================================================
/*
Arquivo: 035_seed_demo_cidade_nova_beauty.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Tipo: Seed / Demo controlado (idempotente)

Objetivo:
- Criar um tenant de demonstração
- Criar uma empresa (salão de beleza)
- Criar uma usuária global + local (Maria Manicure)
- Criar vínculo profissional (worker)
- Criar categorias (Beleza > Manicure)
- Criar agenda e horários disponíveis
- Validar integração entre:
  identidade global, categorias, agenda, empresas e serviços

Dependências obrigatórias:
- tenants
- tenant_contexts (migration 0059; bootstrap alinhado a tenant.service.createTenant)
- users
- profiles
- companies
- workers
- global_users
- user_identity_links
- categories
- schedules
- schedule_slots

Observações:
- Script é idempotente (pode rodar mais de uma vez)
- NÃO deve ser executado em produção
- Ideal para demo, staging e QA
- Executa apenas se RUN_SEEDS=true estiver definido

Notas de execução:
- Este seed tenta desativar RLS via row_security=off dentro do DO.
  Se seu role de migration não tiver permissão/bypass de RLS, ainda pode falhar.
  Nesse caso, rode como role privilegiado (ou ajuste policies para o role de migration em ambientes de demo/QA).
*/

-- =================================================
-- SEED END-TO-END (single transaction block)
-- =================================================
DO $$
DECLARE
  -- Verificar se tabela companies existe (dependência da migration 047)
  companies_exists BOOLEAN;
  -- Tenant / Company
  v_tenant_id      UUID;
  v_company_id     UUID;

  -- User / Identity
  v_user_id        UUID;
  v_global_user_id UUID;
  v_profile_id     UUID;
  v_worker_id      UUID;

  -- Categories
  v_root_category_id  UUID;
  v_child_category_id UUID;

  -- Schedule
  v_schedule_id UUID;
  v_base        TIMESTAMPTZ;

  -- Constants
  c_tenant_slug  TEXT := 'cidade-nova-demo';
  c_tenant_name  TEXT := 'Cidade Nova Demo';

  c_company_name TEXT := 'Cidade Nova Beauty';

  c_email        TEXT := 'maria.manicure@cidadenova.demo';
  c_full_name    TEXT := 'Maria Manicure';

BEGIN
  -- Verificar se tabela companies existe (dependência da migration 047)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'companies'
  ) INTO companies_exists;

  -- Se companies não existe, pular este seed (será executado após migration 047)
  IF NOT companies_exists THEN
    RAISE NOTICE 'Seed 035: Tabela companies não existe. Seed será pulado (executado após migration 047).';
    RETURN;
  END IF;

  -- Try to disable RLS for this block (best effort).
  PERFORM set_config('row_security', 'off', true);

  -- =================================================
  -- 1) TENANT DEMO
  -- =================================================
  -- Contrato SSOT (espelho de createTenant): INSERT tenant + bootstrap canónico em tenant_contexts no mesmo ramo.
  SELECT t.id
    INTO v_tenant_id
  FROM tenants t
  WHERE t.slug = c_tenant_slug
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug)
    VALUES (c_tenant_name, c_tenant_slug)
    RETURNING id INTO v_tenant_id;

    INSERT INTO tenant_contexts (tenant_id, context, permission)
    SELECT v_tenant_id, c, 'read'::text
    FROM unnest(
      ARRAY[
        'professional',
        'interest',
        'education',
        'hobby',
        'learning',
        'health',
        'company',
        'lifestyle'
      ]::text[]
    ) AS t(c)
    ON CONFLICT (tenant_id, context) DO NOTHING;

    RAISE NOTICE '✅ Tenant criado: % (%).', c_tenant_name, v_tenant_id;
  ELSE
    RAISE NOTICE 'ℹ️ Tenant já existe: % (%).', c_tenant_name, v_tenant_id;
  END IF;

  -- =================================================
  -- 2) EMPRESA DEMO
  -- =================================================
  SELECT c.company_id
    INTO v_company_id
  FROM companies c
  WHERE c.tenant_id = v_tenant_id
    AND c.name = c_company_name
  LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO companies (tenant_id, name, description, is_active)
    VALUES (
      v_tenant_id,
      c_company_name,
      'Salão de beleza especializado em manicure e pedicure',
      true
    )
    RETURNING company_id INTO v_company_id;

    RAISE NOTICE '✅ Empresa criada: % (%).', c_company_name, v_company_id;
  ELSE
    RAISE NOTICE 'ℹ️ Empresa já existe: % (%).', c_company_name, v_company_id;
  END IF;

  -- =================================================
  -- 3) USUÁRIA + PROFISSIONAL DEMO (Maria Manicure)
  -- =================================================

  -- 3.1) Usuária local (se existir, reutiliza)
  SELECT u.user_id, u.global_user_id
    INTO v_user_id, v_global_user_id
  FROM users u
  WHERE u.tenant_id = v_tenant_id
    AND u.email = c_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- 3.2) Tenta reaproveitar global_user caso tenha sobrado de execução parcial anterior
    SELECT gu.global_user_id
      INTO v_global_user_id
    FROM global_users gu
    WHERE gu.full_name = c_full_name
      AND gu.metadata @> '{"role":"worker","demo":true}'::jsonb
    LIMIT 1;

    IF v_global_user_id IS NULL THEN
      INSERT INTO global_users (full_name, metadata)
      VALUES (
        c_full_name,
        '{"role":"worker","demo":true}'::jsonb
      )
      RETURNING global_user_id INTO v_global_user_id;
    END IF;

    -- 3.3) Cria usuária local
    INSERT INTO users (tenant_id, email, password_hash, global_user_id)
    VALUES (
      v_tenant_id,
      c_email,
      '$2b$10$dummy.hash.for.demo.user',
      v_global_user_id
    )
    RETURNING user_id INTO v_user_id;

    RAISE NOTICE '✅ Usuária local criada: % (%).', c_email, v_user_id;
  ELSE
    -- Usuária já existe; garante global_user_id carregado
    IF v_global_user_id IS NULL THEN
      -- Em caso de dado inconsistente, tenta recuperar ou cria um global_user mínimo.
      SELECT gu.global_user_id
        INTO v_global_user_id
      FROM global_users gu
      WHERE gu.full_name = c_full_name
        AND gu.metadata @> '{"demo":true}'::jsonb
      LIMIT 1;

      IF v_global_user_id IS NULL THEN
        INSERT INTO global_users (full_name, metadata)
        VALUES (c_full_name, '{"role":"worker","demo":true}'::jsonb)
        RETURNING global_user_id INTO v_global_user_id;
      END IF;

      UPDATE users
         SET global_user_id = v_global_user_id
       WHERE user_id = v_user_id;
    END IF;

    RAISE NOTICE 'ℹ️ Usuária local já existe: % (%).', c_email, v_user_id;
  END IF;

  -- 3.4) Perfil (garante existência)
  SELECT p.profile_id
    INTO v_profile_id
  FROM profiles p
  WHERE p.tenant_id = v_tenant_id
    AND p.user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
    VALUES (
      v_tenant_id,
      v_user_id,
      c_full_name,
      '+55 11 99999-9999',
      '{"specialty":"manicure","demo":true}'::jsonb
    )
    RETURNING profile_id INTO v_profile_id;

    RAISE NOTICE '✅ Perfil criado: % (%).', c_full_name, v_profile_id;
  ELSE
    RAISE NOTICE 'ℹ️ Perfil já existe: % (%).', c_full_name, v_profile_id;
  END IF;

  -- 3.5) Link identidade (idempotente)
  INSERT INTO user_identity_links (global_user_id, user_id, tenant_id)
  VALUES (v_global_user_id, v_user_id, v_tenant_id)
  ON CONFLICT DO NOTHING;

  -- 3.6) Worker (garante existência)
  SELECT w.worker_id
    INTO v_worker_id
  FROM workers w
  WHERE w.tenant_id = v_tenant_id
    AND w.user_id = v_user_id
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    INSERT INTO workers (
      tenant_id,
      user_id,
      bio,
      hourly_rate,
      is_active,
      is_verified,
      reputation_score
    )
    VALUES (
      v_tenant_id,
      v_user_id,
      'Manicure profissional com 10 anos de experiência.',
      50.00,
      true,
      true,
      4.80
    )
    RETURNING worker_id INTO v_worker_id;

    RAISE NOTICE '✅ Worker criado: % (%).', c_full_name, v_worker_id;
  ELSE
    RAISE NOTICE 'ℹ️ Worker já existe: % (%).', c_full_name, v_worker_id;
  END IF;

  -- =================================================
  -- 4) CATEGORIAS (Beleza > Manicure)
  -- =================================================
  -- Atenção: este seed assume categories global (sem tenant_id obrigatório).
  -- Se categories for tenant-scoped no seu schema, este trecho precisa ser refeito.
  SELECT cat.category_id
    INTO v_root_category_id
  FROM categories cat
  WHERE cat.slug = 'beleza'
  LIMIT 1;

  IF v_root_category_id IS NULL THEN
    INSERT INTO categories (name, slug, description, level, path)
    VALUES (
      'Beleza',
      'beleza',
      'Serviços de beleza e estética',
      0,
      ARRAY['beleza']
    )
    RETURNING category_id INTO v_root_category_id;

    RAISE NOTICE '✅ Categoria raiz criada: Beleza (%).', v_root_category_id;
  ELSE
    RAISE NOTICE 'ℹ️ Categoria raiz já existe: Beleza (%).', v_root_category_id;
  END IF;

  SELECT cat.category_id
    INTO v_child_category_id
  FROM categories cat
  WHERE cat.slug = 'beleza-manicure'
  LIMIT 1;

  IF v_child_category_id IS NULL THEN
    INSERT INTO categories (parent_id, name, slug, description, level, path)
    VALUES (
      v_root_category_id,
      'Manicure',
      'beleza-manicure',
      'Serviços de manicure e pedicure',
      1,
      ARRAY['beleza','beleza-manicure']
    )
    RETURNING category_id INTO v_child_category_id;

    RAISE NOTICE '✅ Categoria filha criada: Manicure (%).', v_child_category_id;
  ELSE
    RAISE NOTICE 'ℹ️ Categoria filha já existe: Manicure (%).', v_child_category_id;
  END IF;

  -- =================================================
  -- 5) AGENDA + HORÁRIOS
  -- =================================================
  SELECT s.schedule_id
    INTO v_schedule_id
  FROM schedules s
  WHERE s.tenant_id = v_tenant_id
    AND s.global_user_id = v_global_user_id
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    INSERT INTO schedules (tenant_id, global_user_id, metadata)
    VALUES (
      v_tenant_id,
      v_global_user_id,
      '{"demo":true,"worker":"Maria Manicure"}'::jsonb
    )
    RETURNING schedule_id INTO v_schedule_id;

    RAISE NOTICE '✅ Schedule criado (%).', v_schedule_id;
  ELSE
    RAISE NOTICE 'ℹ️ Schedule já existe (%).', v_schedule_id;
  END IF;

  -- Slot: sexta-feira 18:00 da semana atual (relativo ao momento da execução)
  v_base := date_trunc('week', now()) + interval '5 days 18 hours';

  INSERT INTO schedule_slots (schedule_id, start_time, end_time, status)
  SELECT v_schedule_id, v_base, v_base + interval '1 hour', 'available'
  WHERE NOT EXISTS (
    SELECT 1
    FROM schedule_slots ss
    WHERE ss.schedule_id = v_schedule_id
      AND ss.start_time = v_base
  );

  RAISE NOTICE '✅ Slot garantido para schedule % em %.', v_schedule_id, v_base;

END $$;

-- =================================================
-- FIM DO SEED DEMO
-- =================================================















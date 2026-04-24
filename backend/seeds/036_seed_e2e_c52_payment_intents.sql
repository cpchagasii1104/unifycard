-- ================================================
-- UNIFICARD - SEED E2E C52
-- Seed para validar migracoes de payment_intents
-- Cenario: 6 fluxos de payment com status variados
-- ================================================
/*
Arquivo: 036_seed_e2e_c52_payment_intents.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Tipo: Seed E2E para validacao de C52

Objetivo:
- Criar dados minimos para validar as migracoes do C52:
  1. Renomear status -> payment_status
  2. Normalizar valores para lowercase
  3. Atualizar CHECK constraint
  4. Adicionar coluna source
  5. Unificar writers
  6. Atualizar os 6 callers

Os 6 callers mapeados:
  1. payment-link.routes.ts (source: 'payment_link')
  2. governance-financial-action-worker.ts (source: 'governance')
  3. subscription.service.ts (source: 'subscription')
  4. pdv.service.ts (source: 'pdv')
  5. venue.routes.ts (source: 'venue')
  6. ticket.service.ts (source: 'ticket')

Dependencias:
- tenants (usa existente: UnifyCard DEV)
- actors (cria e2e_buyer e e2e_seller se nao existir)
- orders (cria 6 orders para os 6 fluxos)
- payment_intents (cria com status variados para testar normalizacao)

Notas:
- Script e idempotente
- NAO deve ser executado em producao
- Ideal para E2E pre e pos-migracao C52
*/

DO $$
DECLARE
  v_tenant_id UUID;
  v_buyer_actor_id UUID;
  v_seller_actor_id UUID;

  -- 6 orders para os 6 fluxos
  v_order_payment_link UUID;
  v_order_governance UUID;
  v_order_subscription UUID;
  v_order_pdv UUID;
  v_order_venue UUID;
  v_order_ticket UUID;

  c_tenant_slug TEXT := 'unificard-dev';

BEGIN
  -- Desabilitar RLS para esta transacao
  PERFORM set_config('row_security', 'off', true);

  -- =================================================
  -- 1) TENANT (usa existente)
  -- =================================================
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE slug = c_tenant_slug
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Cria tenant se nao existir
    INSERT INTO tenants (name, slug)
    VALUES ('UnifyCard DEV', c_tenant_slug)
    RETURNING id INTO v_tenant_id;
    RAISE NOTICE 'Tenant criado: %', v_tenant_id;
  ELSE
    RAISE NOTICE 'Tenant existente: %', v_tenant_id;
  END IF;

  -- =================================================
  -- 2) ACTORS (buyer e seller para E2E)
  -- =================================================
  -- Buyer actor
  SELECT id INTO v_buyer_actor_id
  FROM actors
  WHERE tenant_id = v_tenant_id
    AND display_name = 'E2E Buyer C52'
  LIMIT 1;

  IF v_buyer_actor_id IS NULL THEN
    INSERT INTO actors (
      tenant_id, actor_type, display_name,
      metadata, is_identity_required
    )
    VALUES (
      v_tenant_id, 'user', 'E2E Buyer C52',
      '{"e2e": true, "test": "c52"}'::jsonb,
      false
    )
    RETURNING id INTO v_buyer_actor_id;
    RAISE NOTICE 'Buyer actor criado: %', v_buyer_actor_id;
  ELSE
    RAISE NOTICE 'Buyer actor existente: %', v_buyer_actor_id;
  END IF;

  -- Seller actor
  SELECT id INTO v_seller_actor_id
  FROM actors
  WHERE tenant_id = v_tenant_id
    AND display_name = 'E2E Seller C52'
  LIMIT 1;

  IF v_seller_actor_id IS NULL THEN
    INSERT INTO actors (
      tenant_id, actor_type, display_name,
      metadata, is_identity_required, responsible_actor_id
    )
    VALUES (
      v_tenant_id, 'company', 'E2E Seller C52',
      '{"e2e": true, "test": "c52"}'::jsonb,
      false, v_buyer_actor_id
    )
    RETURNING id INTO v_seller_actor_id;
    RAISE NOTICE 'Seller actor criado: %', v_seller_actor_id;
  ELSE
    RAISE NOTICE 'Seller actor existente: %', v_seller_actor_id;
  END IF;

  -- =================================================
  -- 3) ORDERS (6 orders para os 6 fluxos)
  -- =================================================

  -- Order 1: payment_link
  SELECT id INTO v_order_payment_link
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "payment_link"}'::jsonb
  LIMIT 1;

  IF v_order_payment_link IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      10000, 'submitted', 1, '{"e2e_source": "payment_link", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_payment_link;
    RAISE NOTICE 'Order payment_link criada: %', v_order_payment_link;
  END IF;

  -- Order 2: governance
  SELECT id INTO v_order_governance
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "governance"}'::jsonb
  LIMIT 1;

  IF v_order_governance IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      20000, 'submitted', 1, '{"e2e_source": "governance", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_governance;
    RAISE NOTICE 'Order governance criada: %', v_order_governance;
  END IF;

  -- Order 3: subscription
  SELECT id INTO v_order_subscription
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "subscription"}'::jsonb
  LIMIT 1;

  IF v_order_subscription IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      15000, 'submitted', 1, '{"e2e_source": "subscription", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_subscription;
    RAISE NOTICE 'Order subscription criada: %', v_order_subscription;
  END IF;

  -- Order 4: pdv
  SELECT id INTO v_order_pdv
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "pdv"}'::jsonb
  LIMIT 1;

  IF v_order_pdv IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      5000, 'submitted', 1, '{"e2e_source": "pdv", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_pdv;
    RAISE NOTICE 'Order pdv criada: %', v_order_pdv;
  END IF;

  -- Order 5: venue
  SELECT id INTO v_order_venue
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "venue"}'::jsonb
  LIMIT 1;

  IF v_order_venue IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      30000, 'submitted', 1, '{"e2e_source": "venue", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_venue;
    RAISE NOTICE 'Order venue criada: %', v_order_venue;
  END IF;

  -- Order 6: ticket
  SELECT id INTO v_order_ticket
  FROM orders
  WHERE tenant_id = v_tenant_id
    AND metadata @> '{"e2e_source": "ticket"}'::jsonb
  LIMIT 1;

  IF v_order_ticket IS NULL THEN
    INSERT INTO orders (
      tenant_id, buyer_actor_id, seller_actor_id,
      total_cents, status, total_quantity, metadata
    )
    VALUES (
      v_tenant_id, v_buyer_actor_id, v_seller_actor_id,
      8000, 'submitted', 1, '{"e2e_source": "ticket", "test": "c52"}'::jsonb
    )
    RETURNING id INTO v_order_ticket;
    RAISE NOTICE 'Order ticket criada: %', v_order_ticket;
  END IF;

  -- =================================================
  -- 4) PAYMENT_INTENTS (status variados para testar normalizacao)
  -- =================================================
  -- Cria payment_intents com diferentes valores de status
  -- para validar a migracao de normalizacao

  -- payment_link: status CREATED (maiusculo - Writer A) -> normalizado para pending
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 10000, 'pending', 'payment',
    v_order_payment_link::text, 'pix', 'BRL', v_order_payment_link,
    '{"e2e_source": "payment_link", "test": "c52", "status_case": "uppercase"}'::jsonb, 'payment_link'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "payment_link"}'::jsonb
  );

  -- governance: status PENDING (maiusculo) -> normalizado para pending
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 20000, 'pending', 'payment',
    v_order_governance::text, 'internal', 'BRL', v_order_governance,
    '{"e2e_source": "governance", "test": "c52", "status_case": "uppercase"}'::jsonb, 'governance'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "governance"}'::jsonb
  );

  -- subscription: status pending (minusculo - Writer B)
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 15000, 'pending', 'subscription',
    v_order_subscription::text, 'stripe', 'BRL', v_order_subscription,
    '{"e2e_source": "subscription", "test": "c52", "status_case": "lowercase"}'::jsonb, 'subscription'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "subscription"}'::jsonb
  );

  -- pdv: status CAPTURED (maiusculo) -> normalizado para captured
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 5000, 'captured', 'payment',
    v_order_pdv::text, 'pix', 'BRL', v_order_pdv,
    '{"e2e_source": "pdv", "test": "c52", "status_case": "uppercase"}'::jsonb, 'pdv'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "pdv"}'::jsonb
  );

  -- venue: status completed (minusculo) -> normalizado para settled
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 30000, 'settled', 'payment',
    v_order_venue::text, 'pix', 'BRL', v_order_venue,
    '{"e2e_source": "venue", "test": "c52", "status_case": "lowercase"}'::jsonb, 'venue'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "venue"}'::jsonb
  );

  -- ticket: status SETTLED (maiusculo) -> normalizado para settled
  INSERT INTO payment_intents (
    tenant_id, actor_id, amount_cents, payment_status, intent_type,
    reference_id, gateway, currency, order_id, metadata, source
  )
  SELECT
    v_tenant_id, v_buyer_actor_id, 8000, 'settled', 'payment',
    v_order_ticket::text, 'pix', 'BRL', v_order_ticket,
    '{"e2e_source": "ticket", "test": "c52", "status_case": "uppercase"}'::jsonb, 'ticket'
  WHERE NOT EXISTS (
    SELECT 1 FROM payment_intents
    WHERE metadata @> '{"e2e_source": "ticket"}'::jsonb
  );

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'SEED E2E C52 CONCLUIDA';
  RAISE NOTICE 'Tenant: %', v_tenant_id;
  RAISE NOTICE 'Buyer actor: %', v_buyer_actor_id;
  RAISE NOTICE 'Seller actor: %', v_seller_actor_id;
  RAISE NOTICE '6 orders criadas (payment_link, governance, subscription, pdv, venue, ticket)';
  RAISE NOTICE '6 payment_intents criados com status variados (maiusculo/minusculo)';
  RAISE NOTICE '=================================================';

END $$;

-- =================================================
-- QUERIES DE VALIDACAO (executar apos migracao C52)
-- =================================================
/*
-- 1) Verificar que todos os status foram normalizados para lowercase:
SELECT id, status, metadata->>'e2e_source' as source
FROM payment_intents
WHERE metadata @> '{"test": "c52"}'::jsonb
ORDER BY metadata->>'e2e_source';

-- 2) Verificar contagem por status (pre-migracao):
SELECT status, COUNT(*)
FROM payment_intents
WHERE metadata @> '{"test": "c52"}'::jsonb
GROUP BY status;

-- 3) Verificar que coluna payment_status existe (pos-migracao 1):
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payment_intents'
  AND column_name = 'payment_status';

-- 4) Verificar que coluna source existe (pos-migracao 4):
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payment_intents'
  AND column_name = 'source';

-- 5) Verificar mapeamento status -> payment_status (pos-migracao 2):
SELECT id, payment_status, metadata->>'status_case' as original_case
FROM payment_intents
WHERE metadata @> '{"test": "c52"}'::jsonb;
*/

-- FIM DO SEED E2E C52

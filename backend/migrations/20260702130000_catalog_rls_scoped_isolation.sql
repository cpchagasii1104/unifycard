-- ============================================================
-- 20260702130000: RLS scoped-isolation em canonical_services + canonical_catalog_events
-- (DT-CATALOG-RLS-SCOPED-NO-ISOLATION)
-- ============================================================
-- Achado (GATE 4 de F-SERVICE-CATALOG-GROWTH-PRESEED-GATES, 2026-06-29): canonical_services e
-- canonical_catalog_events ficaram FORA do hardening de RLS de 20260620120000 (que cobriu
-- bank_*/actors/payout). Com o runtime unificard_app NOBYPASSRLS vivo (RLS-live virado), um
-- tenant conseguia SELECT linhas scope='scoped' de OUTRO tenant em canonical_services — sem
-- isolamento algum.
--
-- READ-FIRST revelou escopo maior que o texto original da DT (2026-07-02):
--   1. canonical-service.service.ts usava pool.query CRU em toda parte — NENHUMA query setava
--      app.current_tenant. Aplicar RLS ingenuamente quebraria a busca normal de servico inteira
--      (nao so o leak), ja que scope='scoped' exigiria contexto que nunca era setado.
--   2. A curadoria admin (catalog-curation.service.ts::listPending, canonical-service.service.ts::
--      approve/mergeInto) e CROSS-TENANT POR DESENHO -- curador de plataforma cura vocabulario
--      compartilhado de TODOS os tenants (rotas /catalog/governance/curation/*, sempre atras de
--      fastify.requireRole(['admin'])). Uma policy so-tenant quebraria a curadoria inteira.
--
-- Decisao (Clayton 2026-07-02, apos os 2 achados acima): pacote completo -- refatorar
-- canonical-service.service.ts para usar getClientWithTenant (leitura/escrita do proprio tenant)
-- ou getClientWithPlatformAdmin (curadoria cross-tenant, SOMENTE atras de rota ja gated por role
-- admin), e aplicar RLS com 3 condicoes: global (tenant_id IS NULL) OR scoped-do-proprio-tenant
-- OR admin-bypass (GUC app.is_platform_admin, setado SOMENTE server-side, nunca do cliente).
--
-- canonical_catalog_events: SEM leitor vivo em codigo de aplicacao (append-only, so INSERT) --
-- fecha a LEITURA (o que a DT relatava) mas mantem ESCRITA permissiva (WITH CHECK true), pois
-- canonical-variant.service.ts (fluxo de PRODUTO, FORA de escopo desta DT) tambem escreve nesta
-- mesma tabela sem contexto de tenant setado -- exigir contexto ali seria expandir o escopo pra
-- um fluxo nao reportado como vulneravel. Escrita ja era 100% aberta hoje; nao piora nada.
--
-- Mesmo padrao canonico de 20260620120000 (ENABLE+FORCE RLS, policy nomeada, infra_bypass para
-- unificard_infra). Lei 2: forward-only, idempotente (DO $$ IF NOT EXISTS).
-- ============================================================

BEGIN;

-- ── canonical_services: RLS completa (leitura E escrita) ─────────────────────
ALTER TABLE canonical_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_services FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canonical_services' AND policyname = 'canonical_services_rls') THEN
    CREATE POLICY canonical_services_rls ON canonical_services
      USING (
        (scope = 'global' AND tenant_id IS NULL)
        OR (scope = 'scoped' AND tenant_id::text = current_setting('app.current_tenant', true))
        OR (current_setting('app.is_platform_admin', true) = 'true')
      )
      WITH CHECK (
        (scope = 'global' AND tenant_id IS NULL)
        OR (scope = 'scoped' AND tenant_id::text = current_setting('app.current_tenant', true))
        OR (current_setting('app.is_platform_admin', true) = 'true')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canonical_services' AND policyname = 'canonical_services_infra_bypass') THEN
    CREATE POLICY canonical_services_infra_bypass ON canonical_services TO unificard_infra USING (true);
  END IF;
END $$;

-- ── canonical_catalog_events: RLS só de LEITURA (escrita permanece permissiva) ──
ALTER TABLE canonical_catalog_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_catalog_events FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canonical_catalog_events' AND policyname = 'canonical_catalog_events_rls') THEN
    CREATE POLICY canonical_catalog_events_rls ON canonical_catalog_events
      USING (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant', true)
        OR (current_setting('app.is_platform_admin', true) = 'true')
      )
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canonical_catalog_events' AND policyname = 'canonical_catalog_events_infra_bypass') THEN
    CREATE POLICY canonical_catalog_events_infra_bypass ON canonical_catalog_events TO unificard_infra USING (true);
  END IF;
END $$;

-- ── Verificação final ──────────────────────────────────────────────────────
DO $$
DECLARE missing TEXT := '';
        tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['canonical_services', 'canonical_catalog_events']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = tbl
        AND c.relrowsecurity = true AND c.relforcerowsecurity = true
    ) THEN
      missing := missing || tbl || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'RLS ou FORCE RLS incompleto: %', missing;
  END IF;
  RAISE NOTICE 'RLS + FORCE RLS OK em canonical_services (leitura+escrita) e canonical_catalog_events (leitura). App role unificard_app respeita as 2 tabelas.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual; executar apenas se necessário reverter):
-- BEGIN;
-- DROP POLICY IF EXISTS canonical_services_rls ON canonical_services;
-- DROP POLICY IF EXISTS canonical_services_infra_bypass ON canonical_services;
-- ALTER TABLE canonical_services DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS canonical_catalog_events_rls ON canonical_catalog_events;
-- DROP POLICY IF EXISTS canonical_catalog_events_infra_bypass ON canonical_catalog_events;
-- ALTER TABLE canonical_catalog_events DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

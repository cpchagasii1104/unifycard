-- 20260706160000_fix_rls_policies_wrong_guc.sql
-- FIX BLOCKER da auditoria Yala (2026-07-06): policies RLS com GUC ERRADO = quebra-fechada sob RLS-live.
-- O runtime seta `app.current_tenant` (pool.ts; 101 policies usam). Policies com outro nome de GUC
-- NUNCA casam (current_setting → NULL) → toda leitura/escrita bloqueada:
--   • follows (20260706150000, REGRESSÃO desta frente): usava `app.tenant_id` → follow quebrado +
--     eventos visibility='followers' invisíveis (3 leitores em events).
--   • webauthn_credentials/webauthn_challenges/audit_events/partner_employees/category_ai_logs
--     (abril/2026, PRÉ-EXISTENTE, mesma classe): usavam `app.current_tenant_id` (nunca setado).
-- Correção mecânica: recriar cada policy com o GUC canônico. Fail-closed→funcional; zero bank_*.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('follows',              'follows_tenant_isolation'),
      ('webauthn_credentials', 'webauthn_credentials_tenant_isolation'),
      ('webauthn_challenges',  'webauthn_challenges_tenant_isolation'),
      ('audit_events',         'audit_events_tenant_isolation'),
      ('partner_employees',    'partner_employees_tenant_isolation'),
      ('category_ai_logs',     'category_ai_logs_tenant_isolation')
    ) AS t(tbl, pol)
  LOOP
    IF to_regclass(rec.tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', rec.pol, rec.tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id::text = current_setting(''app.current_tenant'', true)) WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true))',
        rec.pol, rec.tbl
      );
    END IF;
  END LOOP;
END $$;

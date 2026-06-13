-- 20260613120000_user_referral_links.sql
-- DECISION-0119 — Referral link / vínculo de indicação como RELAÇÃO PURA.
-- F-REFERRAL-LINK-MATERIALIZATION-AND-SPLIT-CONTRACT.
--
-- CAUSA-RAIZ (reseal Yala PASS COM RESSALVA): o applyReferralCode legado
-- apontava para `user_referral_links` (AUSENTE no schema vivo), `referrals`
-- (arquivada/incompatível) e `users.metadata` — o vínculo A→B nunca
-- materializava e getActiveReferral devolvia null.
--
-- MODELO: vínculo PURO A→B (D1). A tabela NÃO guarda percentual/bps/janela/
-- starts_at/ends_at/status/expiração/política de split (isso é responsabilidade
-- do split-engine/economic_policy_engine — engine-neutro, D3). Money-adjacent,
-- NÃO Bank writer (D4). Integridade D5: sem autoindicação, um referrer por
-- indicado, tenant-safe (RLS), idempotente, imutável (sem updated_at).
--
-- Forward-only, aditiva, idempotente. NÃO reaplica migrations arquivadas
-- 0070/0077 (arqueologia). Zero Bank. gen_random_uuid() (PG13+ nativo).

BEGIN;

CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  referrer_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_used  text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- D5: um referrer por usuário indicado dentro do tenant.
  CONSTRAINT uq_user_referral_links_referred UNIQUE (tenant_id, referred_user_id),
  -- D5: sem autoindicação.
  CONSTRAINT chk_user_referral_links_no_self CHECK (referrer_user_id <> referred_user_id)
);

-- Leitura de dashboard/quem-eu-indiquei.
CREATE INDEX IF NOT EXISTS idx_user_referral_links_referrer
  ON user_referral_links (tenant_id, referrer_user_id);

-- RLS tenant-safe (padrão vivo: app.current_tenant via set_config).
ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_referral_links'
      AND policyname = 'user_referral_links_tenant_isolation'
  ) THEN
    CREATE POLICY user_referral_links_tenant_isolation
      ON user_referral_links
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;

COMMIT;

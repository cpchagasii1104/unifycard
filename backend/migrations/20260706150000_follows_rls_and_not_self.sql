-- 20260706150000_follows_rls_and_not_self.sql
-- F-FOLLOW-ACTIVATION-SLICE-A (decisão soberana de Clayton 2026-07-06: "seguir EXISTE no sistema").
-- GATE 00_AGENT_PROTOCOL §2.3.2: substrato `follows` JÁ EXISTE (20260530310000, actor-keyed, UNIQUE
-- ordenado por par direcional) e o writer identity-bound JÁ EXISTE (social-2.0 follow/unfollow).
-- Esta migration NÃO cria substrato novo — ENDURECE o existente antes de ligar o botão:
--   1) RLS ENABLE+FORCE + policy de tenant (estava relrowsecurity=false; o SELECT do writer não
--      filtra tenant_id → sem RLS, leitura potencialmente cross-tenant). Mesmo padrão de
--      actor_delegations (20260706130000).
--   2) CHECK not-self (seguir a si mesmo era possível — mesmo padrão chk_actor_relationships_not_self).
-- Forward-only aditivo · zero dado alterado · zero bank_* (D4) · idempotente.

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'follows_tenant_isolation') THEN
    CREATE POLICY follows_tenant_isolation ON follows
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_follows_not_self') THEN
    -- pré-limpeza defensiva (não deve existir linha self em dev; DELETE idempotente e seguro)
    DELETE FROM follows WHERE follower_actor_id = followed_actor_id;
    ALTER TABLE follows ADD CONSTRAINT chk_follows_not_self CHECK (follower_actor_id <> followed_actor_id);
  END IF;
END $$;

COMMENT ON TABLE follows IS
  'Aresta DECLARATIVA UNILATERAL de atenção (A segue B; sem aperto-de-mão — distinta de actor_relationships, que é relação MÚTUA por par não-ordenado). Decisão soberana Clayton 2026-07-06. Writer identity-bound em social-2.0 (follower derivado server-side).';

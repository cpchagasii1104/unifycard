-- 20260719200000_company_interact_feed_authority.sql
-- DECISION-0189B D4 — AUTORIDADE EXATA DE INTERAÇÃO NO FEED (reactions/comments).
--
-- Adiciona o grant fino `company_users.can_interact_feed` (default FALSE — memberships
-- existentes NÃO ganham interação automática) + a capability de TIPO `can_interact_feed`
-- no actor_registry (fato de tipo: todo actor não-humano registrado pode interagir, igual a
-- can_publish_feed) + materializa o CATÁLOGO v2 (código soberano: company-policy-registry.ts;
-- boot compara digest e FALHA em divergência — R16). APPEND-ONLY; não edita migration histórica.

-- ── Guard de divergência (idempotência estrita) ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_users' AND column_name = 'can_interact_feed'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: company_users.can_interact_feed já existe — estado divergente.';
  END IF;
END $$;

-- ── 1. Grant fino (default FALSE para memberships existentes — D4) ────────────
ALTER TABLE company_users
  ADD COLUMN can_interact_feed BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Capability de TIPO no registry (fato de tipo; idempotente por merge JSONB) ─
-- Todo actor registrado (company/event/group/service/project) é CAPAZ de interagir —
-- espelha can_publish_feed=true. Não é concessão de membro (subject grant decide o membro).
UPDATE actor_registry
   SET capabilities_json = capabilities_json || jsonb_build_object('can_interact_feed', true),
       updated_at = NOW()
 WHERE NOT (capabilities_json ? 'can_interact_feed');

-- ── 3. Catálogo v2 (materialização versionada; digest do código soberano) ─────
INSERT INTO company_permission_catalog
  (permission_key, catalog_version, actor_capability, subject_grant_column, classification, invitable, delegable, protected)
VALUES
  ('publish_feed',              2, 'can_publish_feed',   'can_publish_feed',    'company_grant',          true,  true,  false),
  ('interact_feed',             2, 'can_interact_feed',  'can_interact_feed',   'company_grant',          true,  true,  false),
  ('create_events',             2, 'can_create_events',  'can_create_events',   'company_grant',          true,  true,  false),
  ('view_financial',            2, NULL,                 'can_view_financial',  'company_grant_terminal', true,  false, false),
  ('manage_financial',          2, 'can_hold_assets',    'can_manage_financial','company_grant_terminal', false, false, true),
  ('manage_members',            2, 'can_manage_members', 'can_manage_members',  'company_grant_terminal', false, false, true),
  ('company:manage_governance', 2, NULL,                 'can_manage_company',  'company_grant_terminal', false, false, true),
  ('company:manage_employees',  2, NULL,                 'can_manage_employees','company_grant',          true,  false, false),
  ('company:manage_services',   2, NULL,                 'can_manage_services', 'company_grant',          true,  false, false),
  ('company:view_reports',      2, NULL,                 'can_view_reports',    'company_grant',          true,  false, false);

-- digest v2 = SHA-256 das linhas ordenadas por permission_key (computeCompanyCatalogDigest()).
INSERT INTO company_permission_catalog_meta (catalog_version, digest)
VALUES (2, 'b8b592a480641152aac0070815ee4117b3241a65dd48ee0489dd8b8f1cf94d65');

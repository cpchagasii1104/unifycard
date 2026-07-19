-- ============================================================
-- F-COMPANY-ACCESS-AUTHORITY-FOUNDATION · F2 — FUNDAÇÃO DORMENTE (DECISION-0189)
--
-- O QUE É:
--   1. Subject grants novos em company_users (DORMENTES — nenhum decisor os lê até F3):
--      can_view_financial · can_manage_members · can_publish_feed · can_create_events.
--   2. Catálogo materializado do vocabulário empresarial (company_permission_catalog +
--      _meta com digest) — o CÓDIGO é soberano (company-policy-registry.ts); o banco é
--      materialização versionada; o boot compara digest e FALHA em divergência (R16).
--   3. Casa do vínculo jurídico company_member_relationships (temporal, auditável) +
--      trilha company_member_events (append-only, UPDATE/DELETE proibidos por trigger).
--   4. Backfill determinístico: (a) SET_V1 para gestores com proveniência real
--      (can_manage_company=true — flag imposta server-side no nascimento da empresa;
--      NUNCA por inferência de role); (b) vínculo jurídico da delegação mais recente com
--      relationship_type (fonte governada) ou derivação role→relationship registrada como
--      backfill_role_derivation; eventos 'backfill' na MESMA transação.
--   5. Função do trigger de EXCLUSIVIDADE membership×delegação POR RELAÇÃO (R12) —
--      CRIADA aqui, ATIVADA SOMENTE na F4 (a dual-write transitória F2→F4 a violaria).
--   6. Candidate keys compostas (tenant_id, id) p/ FKs tenant-safe.
--
-- O QUE NÃO FAZ: nenhum decisor muda; nenhuma rota lê as colunas novas; delegações
--   INTOCADAS (dual-write começa no código TS desta fatia, lendo a fonte ANTIGA);
--   ZERO efeito em bank_* (Δbank=0); grupos/canais/território INTOCADOS.
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT FAIL-CLOSED
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.company_users') IS NULL OR to_regclass('public.companies') IS NULL
     OR to_regclass('public.tenants') IS NULL OR to_regclass('public.actor_delegations') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: company_users/companies/tenants/actor_delegations ausentes.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='company_users'
                AND column_name IN ('can_view_financial','can_manage_members','can_publish_feed','can_create_events')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: colunas DECISION-0189 já existem em company_users — estado divergente.';
  END IF;
  IF to_regclass('public.company_permission_catalog') IS NOT NULL
     OR to_regclass('public.company_member_relationships') IS NOT NULL
     OR to_regclass('public.company_member_events') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela DECISION-0189 já existe — estado divergente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='company_users' AND column_name='can_manage_company') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: company_users.can_manage_company ausente (RBAC 20260530520500 não aplicada).';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SUBJECT GRANTS DORMENTES (tabela normativa DECISION-0189 §2.3)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_users
  ADD COLUMN can_view_financial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN can_manage_members BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN can_publish_feed  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN can_create_events BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN company_users.can_view_financial IS 'DECISION-0189: subject grant TERMINAL de view_financial — leitura financeira privada da empresa. Nunca derivado de role/ownership.';
COMMENT ON COLUMN company_users.can_manage_members IS 'DECISION-0189: subject grant TERMINAL de manage_members (empresa) — administra membros COMUNS dentro dos dois tetos.';
COMMENT ON COLUMN company_users.can_publish_feed  IS 'DECISION-0189 R9-B: publicar em nome da empresa NÃO é direito automático de membro — exige este grant.';
COMMENT ON COLUMN company_users.can_create_events IS 'DECISION-0189: subject grant de create_events (tríade com capability can_create_events do registry).';

-- member_status ganha o estado terminal 'revoked' (expansão ADITIVA — Lei 4: enum não reduz;
-- 'invited' morre só na F4, após prova de zero linhas). DELETE físico de membership é condenado
-- já nesta fatia: a casa jurídica/eventos referenciam company_users e o histórico é preservado.
ALTER TABLE company_users DROP CONSTRAINT chk_company_users_member_status_valid;
ALTER TABLE company_users ADD CONSTRAINT chk_company_users_member_status_valid
  CHECK (member_status IN ('active', 'invited', 'suspended', 'revoked'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CANDIDATE KEYS COMPOSTAS (FKs tenant-safe; aditivas, condicionais)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_company_users_tenant_id_id') THEN
    ALTER TABLE company_users ADD CONSTRAINT uq_company_users_tenant_id_id UNIQUE (tenant_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_companies_tenant_id_company_id') THEN
    ALTER TABLE companies ADD CONSTRAINT uq_companies_tenant_id_company_id UNIQUE (tenant_id, company_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. CATÁLOGO MATERIALIZADO (R16) — código soberano; aqui só a materialização v1
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE company_permission_catalog (
  permission_key       TEXT    NOT NULL,
  catalog_version      INTEGER NOT NULL,
  actor_capability     TEXT,
  subject_grant_column TEXT    NOT NULL
    CONSTRAINT chk_cpc_grant_column CHECK (subject_grant_column ~ '^can_[a-z_]+$'),
  classification       TEXT    NOT NULL
    CONSTRAINT chk_cpc_classification CHECK (classification IN ('company_grant','company_grant_terminal')),
  invitable            BOOLEAN NOT NULL,
  delegable            BOOLEAN NOT NULL,
  protected            BOOLEAN NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'active'
    CONSTRAINT chk_cpc_status CHECK (status IN ('active','retired')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (permission_key, catalog_version),
  -- protegida NUNCA é convidável (DECISION-0189 §2.3 nota 2)
  CONSTRAINT chk_cpc_protected_not_invitable CHECK (NOT (protected AND invitable))
);

CREATE TABLE company_permission_catalog_meta (
  catalog_version INTEGER PRIMARY KEY,
  digest          TEXT    NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE company_permission_catalog IS 'DECISION-0189 R16: materialização versionada do COMPANY_POLICY_REGISTRY (código soberano). Escrita SÓ por migration; boot compara digest e falha em divergência.';

-- runtime lê, nunca escreve (chave não muda de significado fora de migration governada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    GRANT SELECT ON company_permission_catalog TO unificard_app;
    GRANT SELECT ON company_permission_catalog_meta TO unificard_app;
    REVOKE INSERT, UPDATE, DELETE ON company_permission_catalog FROM unificard_app;
    REVOKE INSERT, UPDATE, DELETE ON company_permission_catalog_meta FROM unificard_app;
  END IF;
END $$;

-- Linhas V1 = tabela normativa §2.3 (serialização canônica → digest abaixo; espelho byte-a-byte
-- de company-policy-registry.ts companyCatalogRows()).
INSERT INTO company_permission_catalog
  (permission_key, catalog_version, actor_capability, subject_grant_column, classification, invitable, delegable, protected)
VALUES
  ('publish_feed',              1, 'can_publish_feed',   'can_publish_feed',    'company_grant',          true,  true,  false),
  ('create_events',             1, 'can_create_events',  'can_create_events',   'company_grant',          true,  true,  false),
  ('view_financial',            1, NULL,                 'can_view_financial',  'company_grant_terminal', true,  false, false),
  ('manage_financial',          1, 'can_hold_assets',    'can_manage_financial','company_grant_terminal', false, false, true),
  ('manage_members',            1, 'can_manage_members', 'can_manage_members',  'company_grant_terminal', false, false, true),
  ('company:manage_governance', 1, NULL,                 'can_manage_company',  'company_grant_terminal', false, false, true),
  ('company:manage_employees',  1, NULL,                 'can_manage_employees','company_grant',          true,  false, false),
  ('company:manage_services',   1, NULL,                 'can_manage_services', 'company_grant',          true,  false, false),
  ('company:view_reports',      1, NULL,                 'can_view_reports',    'company_grant',          true,  false, false);

-- digest = SHA-256 das linhas ordenadas por permission_key, campos '|', linhas '\n'
-- (computado por computeCompanyCatalogDigest() do código — fonte soberana).
INSERT INTO company_permission_catalog_meta (catalog_version, digest)
VALUES (1, '936417436c6f65e2ed7f9aeb6e8dc5da6ff9b3ac8530b26df2d11dfa6450e589');

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CASA DO VÍNCULO JURÍDICO (R11) — temporal, auditável
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE company_member_relationships (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id),
  company_id          UUID        NOT NULL,
  company_user_id     UUID        NOT NULL,
  relationship_type   TEXT
    CONSTRAINT chk_cmr_relationship_type CHECK (relationship_type IS NULL OR relationship_type IN
      ('partner','director','administrator','attorney','legal_representative','employee','contractor')),
  department_key      TEXT
    CONSTRAINT chk_cmr_department_key CHECK (department_key IS NULL OR department_key ~ '^[a-z][a-z0-9_]*$'),
  source              TEXT        NOT NULL
    CONSTRAINT chk_cmr_source CHECK (source IN
      ('declared','bootstrap','backfill_delegation','backfill_role_derivation','invite_accept','cutover')),
  declared_by_user_id  UUID,
  declared_by_actor_id UUID,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to            TIMESTAMPTZ,
  predecessor_id      UUID        REFERENCES company_member_relationships(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_cmr_company_user FOREIGN KEY (tenant_id, company_user_id)
    REFERENCES company_users (tenant_id, id),
  CONSTRAINT fk_cmr_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies (tenant_id, company_id),
  CONSTRAINT chk_cmr_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- um vínculo VIGENTE por membership
CREATE UNIQUE INDEX uq_cmr_current ON company_member_relationships (tenant_id, company_user_id)
  WHERE valid_to IS NULL;
CREATE INDEX idx_cmr_company ON company_member_relationships (tenant_id, company_id);

COMMENT ON TABLE company_member_relationships IS 'DECISION-0189 R11: casa canônica do vínculo jurídico do membro (antes vivia em actor_delegations.relationship_type). role NÃO absorve relationship_type (eixos ortogonais). department_key substitui scopes dept:* em JSON.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. TRILHA DE EVENTOS (append-only)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE company_member_events (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id),
  company_id        UUID        NOT NULL,
  company_user_id   UUID        NOT NULL,
  event_type        TEXT        NOT NULL
    CONSTRAINT chk_cme_event_type CHECK (event_type IN
      ('bootstrap','invited_accepted','suspended','resumed','revoked','reentered',
       'grants_changed','governance_transferred','relationship_declared','backfill','delegation_cutover')),
  snapshot          JSONB,
  details           JSONB,
  acted_by_user_id  UUID,
  acted_by_actor_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_cme_company_user FOREIGN KEY (tenant_id, company_user_id)
    REFERENCES company_users (tenant_id, id),
  CONSTRAINT fk_cme_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies (tenant_id, company_id)
);
CREATE INDEX idx_cme_member ON company_member_events (tenant_id, company_user_id, created_at);

CREATE OR REPLACE FUNCTION fn_company_member_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'company_member_events é APPEND-ONLY (DECISION-0189): % proibido', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_cme_append_only ON company_member_events;
CREATE TRIGGER trg_cme_append_only
  BEFORE UPDATE OR DELETE ON company_member_events
  FOR EACH ROW EXECUTE FUNCTION fn_company_member_events_append_only();

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RLS (padrão tenant + infra bypass — espelha 20260706130000)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['company_member_relationships','company_member_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_rls') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id::text = current_setting(''app.current_tenant'', true)) WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true))',
        tbl || '_rls', tbl
      );
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_infra') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_infra_bypass') THEN
        EXECUTE format('CREATE POLICY %I ON %I TO unificard_infra USING (true)', tbl || '_infra_bypass', tbl);
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
      EXECUTE format('GRANT SELECT, INSERT ON %I TO unificard_app', tbl);
    END IF;
  END LOOP;
  -- relationships também recebe UPDATE (fechar vigência valid_to); events NUNCA (append-only)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    GRANT UPDATE ON company_member_relationships TO unificard_app;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. FUNÇÃO DO TRIGGER DE EXCLUSIVIDADE (R12) — ATIVAÇÃO SÓ NA F4
--    (a dual-write transitória F2→F4 grava membership E delegação — ativar agora quebraria)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_membership_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_global_user_id UUID;
  v_conflict BIGINT;
BEGIN
  -- Dispara em INSERT/UPDATE de actor_delegations rumo a status='active' quando o
  -- institutional actor é EMPRESA e o user actor pertence a uma Identity com membership
  -- ATIVA na MESMA empresa (DECISION-0189 §6.3 — exclusividade POR RELAÇÃO).
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT a.company_id INTO v_company_id
    FROM actors a
   WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.institutional_actor_id;
  IF v_company_id IS NULL THEN
    RETURN NEW; -- grupo/canal/evento — fora do escopo empresarial (guard ESCOPADO)
  END IF;
  SELECT u.global_user_id INTO v_global_user_id
    FROM actors ua
    JOIN users u ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
   WHERE ua.tenant_id = NEW.tenant_id AND ua.id = NEW.user_actor_id;
  IF v_global_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_conflict
    FROM company_users cu
   WHERE cu.tenant_id = NEW.tenant_id AND cu.company_id = v_company_id
     AND cu.global_user_id = v_global_user_id AND cu.member_status = 'active';
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'EXCLUSIVITY_VIOLATION: Identity com membership ATIVA na empresa % não pode receber delegação empresarial ativa para a MESMA relação (DECISION-0189 §6.3)', v_company_id;
  END IF;
  RETURN NEW;
END;
$$;
-- NOTA: CREATE TRIGGER correspondente vive na migration da F4 (cutover).

-- ────────────────────────────────────────────────────────────────────────────
-- 8. BACKFILL DETERMINÍSTICO (eventos na MESMA transação)
-- ────────────────────────────────────────────────────────────────────────────

-- 8a. SET_V1 p/ gestores com PROVENIÊNCIA REAL: can_manage_company=true é imposto
--     server-side no nascimento da empresa (companies.service) e nunca nasce de role.
--     NENHUMA inferência de role aqui (R B16).
WITH updated AS (
  UPDATE company_users cu
     SET can_view_financial = true,
         can_manage_members = true,
         can_publish_feed   = true,
         can_create_events  = true,
         updated_at         = now()
   WHERE cu.can_manage_company = true
   RETURNING cu.id, cu.tenant_id, cu.company_id,
             cu.can_manage_financial, cu.can_manage_employees, cu.can_manage_services, cu.can_view_reports
)
INSERT INTO company_member_events (tenant_id, company_id, company_user_id, event_type, snapshot, details)
SELECT u.tenant_id, u.company_id, u.id, 'backfill',
       jsonb_build_object(
         'before', jsonb_build_object(
           'can_view_financial', false, 'can_manage_members', false,
           'can_publish_feed', false, 'can_create_events', false)),
       jsonb_build_object(
         'permission_set_version', 'V1',
         'source', 'DECISION-0189 F2 backfill — proveniência can_manage_company server-side')
  FROM updated u;

-- 8b. Vínculo jurídico: delegação mais recente com relationship_type (fonte governada);
--     fallback = derivação role→relationship REGISTRADA como backfill_role_derivation.
WITH pairs AS (
  SELECT cu.id AS company_user_id, cu.tenant_id, cu.company_id, cu.role,
         d.relationship_type AS delegated_type
    FROM company_users cu
    LEFT JOIN LATERAL (
      SELECT ad.relationship_type
        FROM actor_delegations ad
        JOIN actors ua ON ua.tenant_id = ad.tenant_id AND ua.id = ad.user_actor_id
        JOIN users u   ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
        JOIN actors pa ON pa.tenant_id = ad.tenant_id AND pa.id = ad.institutional_actor_id
       WHERE ad.tenant_id = cu.tenant_id
         AND pa.company_id = cu.company_id
         AND u.global_user_id = cu.global_user_id
         AND ad.relationship_type IS NOT NULL
       ORDER BY ad.created_at DESC
       LIMIT 1
    ) d ON true
), inserted AS (
  INSERT INTO company_member_relationships
    (tenant_id, company_id, company_user_id, relationship_type, source)
  SELECT p.tenant_id, p.company_id, p.company_user_id,
         COALESCE(p.delegated_type,
                  CASE p.role WHEN 'admin' THEN 'administrator'
                              WHEN 'staff' THEN 'employee'
                              WHEN 'contractor' THEN 'contractor'
                              ELSE NULL END),
         CASE WHEN p.delegated_type IS NOT NULL THEN 'backfill_delegation'
              ELSE 'backfill_role_derivation' END
    FROM pairs p
  RETURNING id, tenant_id, company_id, company_user_id, relationship_type, source
)
INSERT INTO company_member_events (tenant_id, company_id, company_user_id, event_type, details)
SELECT i.tenant_id, i.company_id, i.company_user_id, 'backfill',
       jsonb_build_object('relationship_id', i.id, 'relationship_type', i.relationship_type, 'source', i.source)
  FROM inserted i;

-- POSTCHECK: todo membership tem exatamente 1 vínculo vigente
DO $$
DECLARE v_missing BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_missing
    FROM company_users cu
   WHERE NOT EXISTS (
     SELECT 1 FROM company_member_relationships r
      WHERE r.tenant_id = cu.tenant_id AND r.company_user_id = cu.id AND r.valid_to IS NULL);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % memberships sem vínculo vigente após backfill.', v_missing;
  END IF;
END $$;

COMMIT;

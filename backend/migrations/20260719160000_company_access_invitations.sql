-- ============================================================
-- F-COMPANY-ACCESS-AUTHORITY-FOUNDATION · F5 — CONVITE E ACEITE CANÔNICOS (DECISION-0189 §8)
--
-- company_access_invitations — o ÚNICO caminho (além do bootstrap) que cria membership
-- 'active' (R17). Convite vinculado IMUTAVELMENTE ao invitee (Identity global);
-- token 256-bit armazenado SÓ como hash (single-use); idempotência = chave OPACA do
-- cliente + request_hash separado (R14); permissões NORMALIZADAS com FK ao catálogo
-- VERSIONADO (revalidação no aceite — R16); histórico PRESERVADO (declined/revoked/
-- expired ficam; sem DELETE).
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL · Δbank=0.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.company_access_invitations') IS NOT NULL
     OR to_regclass('public.company_access_invitation_permissions') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabelas de convite já existem — estado divergente.';
  END IF;
  IF to_regclass('public.company_permission_catalog') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: catálogo ausente (F2 não aplicada).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_company_users_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: F4 não aplicada (exclusividade inativa).';
  END IF;
END $$;

CREATE TABLE company_access_invitations (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id),
  company_id              UUID        NOT NULL,
  inviter_global_user_id  UUID        NOT NULL REFERENCES global_users(global_user_id),
  -- vínculo IMUTÁVEL ao convidado (Identity SSOT — nunca actor, nunca re-apontável)
  invitee_global_user_id  UUID        NOT NULL REFERENCES global_users(global_user_id),
  token_hash              TEXT        NOT NULL
    CONSTRAINT chk_cai_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key         TEXT        NOT NULL
    CONSTRAINT chk_cai_idem_key CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash            TEXT        NOT NULL
    CONSTRAINT chk_cai_request_hash CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  catalog_version         INTEGER     NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_cai_status CHECK (status IN ('pending','accepted','declined','revoked','expired')),
  expires_at              TIMESTAMPTZ NOT NULL,
  accepted_at             TIMESTAMPTZ,
  declined_at             TIMESTAMPTZ,
  revoked_at              TIMESTAMPTZ,
  created_by_user_id      UUID,
  created_by_actor_id     UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_cai_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies (tenant_id, company_id),
  -- shape do lifecycle: timestamp do estado terminal correspondente
  CONSTRAINT chk_cai_lifecycle_shape CHECK (
    (status = 'pending'  AND accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL) OR
    (status = 'accepted' AND accepted_at IS NOT NULL) OR
    (status = 'declined' AND declined_at IS NOT NULL) OR
    (status = 'revoked'  AND revoked_at IS NOT NULL) OR
    (status = 'expired')
  ),
  -- anti-autoelevação estrutural (Identity, não actor)
  CONSTRAINT chk_cai_no_self_invite CHECK (inviter_global_user_id <> invitee_global_user_id)
);

-- token é único (hash-only; uso único garantido pela transição de status sob lock)
CREATE UNIQUE INDEX uq_cai_token_hash ON company_access_invitations (token_hash);
-- idempotência R14: chave OPACA por (tenant, operação implícita=invite, inviter)
CREATE UNIQUE INDEX uq_cai_idempotency ON company_access_invitations (tenant_id, inviter_global_user_id, idempotency_key);
-- UM pendente por (empresa, convidado)
CREATE UNIQUE INDEX uq_cai_pending_per_target ON company_access_invitations (tenant_id, company_id, invitee_global_user_id)
  WHERE status = 'pending';
CREATE INDEX idx_cai_company ON company_access_invitations (tenant_id, company_id, status);
CREATE INDEX idx_cai_invitee ON company_access_invitations (tenant_id, invitee_global_user_id, status);

COMMENT ON TABLE company_access_invitations IS 'DECISION-0189 §8: convite canônico de acesso à empresa. Token 256-bit hash-only single-use; invitee IMUTÁVEL (Identity); idempotência chave-opaca+request_hash; permissões nas linhas normalizadas; aceite = writer transacional com locks ordem-fixa + dois tetos + catálogo revalidado.';

CREATE TABLE company_access_invitation_permissions (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID    NOT NULL REFERENCES tenants(id),
  invitation_id  UUID    NOT NULL REFERENCES company_access_invitations(id),
  permission_key TEXT    NOT NULL,
  catalog_version INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- FK COMPOSTA ao catálogo VERSIONADO — zero texto livre (R16)
  CONSTRAINT fk_caip_catalog FOREIGN KEY (permission_key, catalog_version)
    REFERENCES company_permission_catalog (permission_key, catalog_version),
  CONSTRAINT uq_caip_invitation_key UNIQUE (invitation_id, permission_key)
);
CREATE INDEX idx_caip_invitation ON company_access_invitation_permissions (invitation_id);

-- IMUTÁVEIS após criação (mudar permissões = revogar convite e emitir outro — §4.1)
CREATE OR REPLACE FUNCTION fn_company_invitation_permissions_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'company_access_invitation_permissions é IMUTÁVEL (DECISION-0189 §8.1): % proibido — revogue o convite e emita outro', TG_OP;
END;
$$;
DROP TRIGGER IF EXISTS trg_caip_immutable ON company_access_invitation_permissions;
CREATE TRIGGER trg_caip_immutable
  BEFORE UPDATE OR DELETE ON company_access_invitation_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_company_invitation_permissions_immutable();

-- RLS (padrão tenant + infra bypass)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['company_access_invitations','company_access_invitation_permissions'] LOOP
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
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    GRANT SELECT, INSERT, UPDATE ON company_access_invitations TO unificard_app;
    GRANT SELECT, INSERT ON company_access_invitation_permissions TO unificard_app;
    REVOKE DELETE ON company_access_invitations FROM unificard_app; -- histórico preservado
  END IF;
END $$;

COMMIT;

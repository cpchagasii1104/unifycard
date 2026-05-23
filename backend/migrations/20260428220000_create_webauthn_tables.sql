BEGIN;

-- ============================================================
-- webauthn_credentials
-- Colunas: derivadas de webauthn.repository.ts (WebAuthnCredentialRow)
-- Queries: SELECT id, credential_id, public_key, counter, friendly_name,
--          WHERE credential_id = $2 / WHERE user_id = $2
--          UPDATE SET counter, last_used_at WHERE credential_id = $3
-- ============================================================
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  credential_id   TEXT NOT NULL,
  public_key      TEXT NOT NULL,
  counter         BIGINT NOT NULL DEFAULT 0,
  friendly_name   TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ NULL,
  CONSTRAINT uidx_webauthn_credentials_tenant_credential
    UNIQUE (tenant_id, credential_id),
  CONSTRAINT chk_webauthn_credentials_counter_nonneg
    CHECK (counter >= 0)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_tenant_user
  ON webauthn_credentials (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_last_used
  ON webauthn_credentials (last_used_at DESC NULLS LAST);

COMMENT ON TABLE webauthn_credentials IS
  'Credenciais WebAuthn/Passkey por usuário. C32. Verificação criptográfica não implementada (SCAFFOLDING).';

-- ============================================================
-- webauthn_challenges
-- Colunas: derivadas de webauthn.repository.ts (WebAuthnChallengeRow)
-- Queries: INSERT (tenant_id, user_id, challenge, expires_at) RETURNING id
--          SELECT id, tenant_id, user_id, challenge, expires_at, created_at
--          DELETE WHERE id = $1 AND tenant_id = $2
-- ============================================================
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  challenge   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_webauthn_challenges_expires_after_created
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_lookup
  ON webauthn_challenges (tenant_id, user_id, challenge);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires
  ON webauthn_challenges (expires_at);

COMMENT ON TABLE webauthn_challenges IS
  'Challenges WebAuthn temporários (TTL ~5min). C33. Limpeza por DELETE WHERE expires_at < NOW().';

-- ============================================================
-- RLS — padrão obrigatório para tabelas tenant-scoped
-- ============================================================
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE webauthn_challenges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges  FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webauthn_credentials'
      AND policyname = 'webauthn_credentials_tenant_isolation'
  ) THEN
    CREATE POLICY webauthn_credentials_tenant_isolation
      ON webauthn_credentials
      USING (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webauthn_challenges'
      AND policyname = 'webauthn_challenges_tenant_isolation'
  ) THEN
    CREATE POLICY webauthn_challenges_tenant_isolation
      ON webauthn_challenges
      USING (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;

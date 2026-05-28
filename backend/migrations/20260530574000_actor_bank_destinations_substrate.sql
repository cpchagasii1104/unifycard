-- ============================================================
-- F4.0 — actor_bank_destinations substrate (MVP)
-- DECISION-0060 (governança canônica F4.0) + DECISION-0059 (cerca F4)
-- Sessão 2026-05-28
--
-- Catálogo reutilizável de destinos externos DECLARADOS do actor.
--
-- IMPORTANTE — escopo estrito:
--   - Apenas cadastro + lifecycle + "conta própria".
--   - Zero PSP, zero PIX/TED real, zero callback, zero worker.
--   - Zero movimentação em bank_ledger, bank_transactions, bank_splits.
--   - Não altera actor_wallet_payout_requests.destination_type CHECK (segue
--     só 'internal_settlement' até F4.1 autorizar mudança).
--   - Não popula actor_wallet_payout_requests.destination_key.
--
-- "Conta própria" (DECISION-0060 D8) — defesa em profundidade:
--   Camada A (service): valida holder_document vs identities.tax_id ANTES do INSERT.
--   Camada B (este DB): TRIGGER BEFORE INSERT/UPDATE valida mesmo predicado.
--   CHECK puro é inviável (não suporta JOIN).
--
-- KYC (DECISION-0060 D12):
--   Cadastro NÃO bloqueia por kyc_status='pending'. Decisão fica no service.
--   Uso real para payout externo (F4.1+) exigirá strict approved — fora desta migration.
--
-- Pré-requisitos satisfeitos:
--   - identities (migration 0009): tax_id NOT NULL, kyc_status CHECK
--   - actors (migration 0010): global_user_id FK identities + chk_actor_requires_identity
--   - normalizeTaxId/validateCPF/validateCNPJ helpers em backend/src/core/kyc/
--
-- Reversibilidade: DROP TABLE CASCADE + DROP TRIGGERS + DROP FUNCTIONS.
-- Blast: BAIXO — additive only; zero rows impactadas.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabela actor_bank_destinations
-- ============================================================
CREATE TABLE actor_bank_destinations (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_id                     UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,

  -- Tipo de destino (MVP: pix_key | bank_account)
  destination_type             TEXT NOT NULL,

  -- Campos PIX (NULL se destination_type='bank_account')
  pix_key_type                 TEXT,
  pix_key_value_normalized     TEXT,

  -- Campos conta bancária (NULL se destination_type='pix_key')
  bank_code                    TEXT,
  bank_name                    TEXT,
  agency_number                TEXT,
  account_number               TEXT,
  account_digit                TEXT,
  account_type                 TEXT,

  -- Titular (DECISION-0060 D3: deve ser o próprio actor)
  holder_name                  TEXT NOT NULL,
  holder_document              TEXT NOT NULL,
  holder_document_type         TEXT NOT NULL,

  -- Lifecycle (DECISION-0060 D9)
  status                       TEXT NOT NULL DEFAULT 'pending_verification',
  rejected_reason              TEXT,
  archived_at                  TIMESTAMPTZ,

  -- Verificação de titularidade (DECISION-0060 D10)
  ownership_verification_method TEXT,
  ownership_verified_at         TIMESTAMPTZ,

  -- Extensibilidade
  metadata                     JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Auditoria
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── CHECKs (sem JOIN — JOIN fica para TRIGGER) ─────────────────────────────

  CONSTRAINT chk_abd_destination_type CHECK (
    destination_type IN ('pix_key', 'bank_account')
  ),

  CONSTRAINT chk_abd_pix_key_type CHECK (
    pix_key_type IS NULL
    OR pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')
  ),

  CONSTRAINT chk_abd_account_type CHECK (
    account_type IS NULL
    OR account_type IN ('checking', 'savings', 'payment')
  ),

  CONSTRAINT chk_abd_holder_document_type CHECK (
    holder_document_type IN ('cpf', 'cnpj')
  ),

  CONSTRAINT chk_abd_status CHECK (
    status IN ('pending_verification', 'verified', 'rejected', 'archived')
  ),

  CONSTRAINT chk_abd_ownership_method CHECK (
    ownership_verification_method IS NULL
    OR ownership_verification_method IN ('auto_tax_id_match', 'manual_review', 'psp_future')
  ),

  -- Estrutural: pix_key exige pix_key_type + pix_key_value_normalized
  CONSTRAINT chk_abd_pix_complete CHECK (
    destination_type != 'pix_key'
    OR (pix_key_type IS NOT NULL AND pix_key_value_normalized IS NOT NULL)
  ),

  -- Estrutural: bank_account exige bank_code + agency + account + type
  CONSTRAINT chk_abd_bank_complete CHECK (
    destination_type != 'bank_account'
    OR (
      bank_code IS NOT NULL
      AND agency_number IS NOT NULL
      AND account_number IS NOT NULL
      AND account_type IS NOT NULL
    )
  ),

  -- holder_document NÃO pode ser vazio (NOT NULL já cobre; reforço length)
  CONSTRAINT chk_abd_holder_document_nonempty CHECK (length(trim(holder_document)) > 0),
  CONSTRAINT chk_abd_holder_name_nonempty CHECK (length(trim(holder_name)) > 0),

  -- Coerência verified ↔ ownership_verified_at + method
  CONSTRAINT chk_abd_verified_has_evidence CHECK (
    status != 'verified'
    OR (ownership_verified_at IS NOT NULL AND ownership_verification_method IS NOT NULL)
  ),

  -- Coerência rejected ↔ rejected_reason
  CONSTRAINT chk_abd_rejected_has_reason CHECK (
    status != 'rejected'
    OR (rejected_reason IS NOT NULL AND length(trim(rejected_reason)) > 0)
  ),

  -- Coerência archived ↔ archived_at
  CONSTRAINT chk_abd_archived_has_timestamp CHECK (
    status != 'archived'
    OR archived_at IS NOT NULL
  )
);

COMMENT ON TABLE actor_bank_destinations IS
  'F4.0 (DECISION-0060) — catálogo reutilizável de destinos externos DECLARADOS do actor. '
  'MVP: zero PSP, zero PIX/TED real, zero callback, zero ledger. Apenas cadastro + '
  'lifecycle + conta própria (defesa em profundidade via service + TRIGGER).';

COMMENT ON COLUMN actor_bank_destinations.holder_document IS
  'CPF/CNPJ do titular (normalizado ou com formatação — TRIGGER normaliza para comparar). '
  'DECISION-0060 D8: DEVE ser igual a identities.tax_id do actor vinculado (conta própria).';

COMMENT ON COLUMN actor_bank_destinations.ownership_verification_method IS
  'Método de verificação de titularidade. auto_tax_id_match = chave PIX = tax_id do actor; '
  'manual_review = admin aprova após análise; psp_future = reservado, sem integração.';

COMMENT ON COLUMN actor_bank_destinations.metadata IS
  'JSON livre para extensibilidade futura sem migration. Não conter dados financeiros.';


-- ============================================================
-- 2. Índices
-- ============================================================
CREATE INDEX idx_abd_tenant ON actor_bank_destinations (tenant_id);
CREATE INDEX idx_abd_actor ON actor_bank_destinations (actor_id);
CREATE INDEX idx_abd_status ON actor_bank_destinations (status);
CREATE INDEX idx_abd_tenant_actor ON actor_bank_destinations (tenant_id, actor_id);
CREATE INDEX idx_abd_tenant_actor_status ON actor_bank_destinations (tenant_id, actor_id, status);


-- ============================================================
-- 3. TRIGGER de "conta própria" (DECISION-0060 D8 — camada B)
--    BEFORE INSERT/UPDATE em holder_document ou actor_id.
--    Resolve identities.tax_id via actor.global_user_id e compara normalizado.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_abd_enforce_own_account()
RETURNS TRIGGER AS $$
DECLARE
  v_global_user_id UUID;
  v_tax_id TEXT;
  v_tax_id_norm TEXT;
  v_holder_norm TEXT;
BEGIN
  -- Resolve global_user_id do actor (rota direta via FK 0010)
  SELECT global_user_id INTO v_global_user_id
    FROM actors
   WHERE id = NEW.actor_id AND tenant_id = NEW.tenant_id;

  IF v_global_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_bank_destinations: actor % (tenant %) sem identity vinculada (global_user_id NULL) — conta própria não verificável',
      NEW.actor_id, NEW.tenant_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Resolve tax_id da identity
  SELECT tax_id INTO v_tax_id
    FROM identities
   WHERE global_user_id = v_global_user_id;

  IF v_tax_id IS NULL THEN
    RAISE EXCEPTION 'actor_bank_destinations: identity % sem tax_id — conta própria não verificável',
      v_global_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Normalizar ambos os lados (remove dígitos não numéricos)
  v_tax_id_norm := regexp_replace(v_tax_id, '\D', '', 'g');
  v_holder_norm := regexp_replace(NEW.holder_document, '\D', '', 'g');

  IF v_holder_norm IS NULL OR length(v_holder_norm) = 0 THEN
    RAISE EXCEPTION 'actor_bank_destinations: holder_document vazio após normalização'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_holder_norm != v_tax_id_norm THEN
    RAISE EXCEPTION 'actor_bank_destinations: holder_document (%) não corresponde ao tax_id (%) do actor — DECISION-0060 D8 conta própria',
      v_holder_norm, v_tax_id_norm
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_abd_enforce_own_account
  BEFORE INSERT OR UPDATE OF holder_document, actor_id
  ON actor_bank_destinations
  FOR EACH ROW
  EXECUTE FUNCTION trg_abd_enforce_own_account();

COMMENT ON FUNCTION trg_abd_enforce_own_account() IS
  'F4.0 / DECISION-0060 D8 — defesa em profundidade camada B. Valida que '
  'holder_document normalizado corresponde a identities.tax_id do actor. '
  'Camada A (service) deve falhar antes; este trigger é guarda final.';


-- ============================================================
-- 4. TRIGGER de lifecycle (DECISION-0060 D9)
--    Valida transições válidas em UPDATE OF status:
--      pending_verification → verified | rejected | archived
--      verified              → archived
--      rejected              → archived
--      archived              → terminal (sem transições)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_abd_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending_verification' AND NEW.status IN ('verified', 'rejected', 'archived') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'verified' AND NEW.status = 'archived' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'rejected' AND NEW.status = 'archived' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'actor_bank_destinations: transição de status inválida % → % — DECISION-0060 D9',
    OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_abd_lifecycle
  BEFORE UPDATE OF status
  ON actor_bank_destinations
  FOR EACH ROW
  EXECUTE FUNCTION trg_abd_lifecycle();

COMMENT ON FUNCTION trg_abd_lifecycle() IS
  'F4.0 / DECISION-0060 D9 — valida transições de status. Lifecycle: '
  'pending_verification → verified | rejected | archived; '
  'verified | rejected → archived; archived terminal.';


-- ============================================================
-- 5. TRIGGER updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION trg_abd_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_abd_touch_updated_at
  BEFORE UPDATE
  ON actor_bank_destinations
  FOR EACH ROW
  EXECUTE FUNCTION trg_abd_touch_updated_at();


COMMIT;

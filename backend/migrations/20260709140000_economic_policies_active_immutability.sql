-- 20260709140000_economic_policies_active_immutability.sql
-- DECISION-0166 D5 — Fase 1 / F1-a da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- Policy ATIVA não é editada in-place: a versão que explicou dinheiro passado nunca é reescrita.
-- Este trigger congela economic_policies quando status='active':
--   PERMITIDO em ativa: encerramento legítimo — status active→deprecated e definição/ajuste de
--     effective_until (encerrar a vigência de uma versão é legítimo; reescrevê-la não). updated_at livre
--     (trigger próprio). Qualquer mudança de REGRA = INSERT de nova version (UNIQUE tenant+code+version
--     já suporta).
--   BLOQUEADO em ativa: UPDATE de qualquer campo material (code/version/type/module/seletores/priority/
--     effective_from/metadata/autoria) e retorno a draft.
--   deprecated é TERMINAL e CONGELADA: sem UPDATE algum. Fecha o bypass active→deprecated→edita→reativa,
--     que tornaria a trava de ativa inútil.
--   DELETE bloqueado em active E deprecated (append-only: versão que existiu não some; draft pode ser
--     deletada). Simetria com bank_splits_append_only (20260623120000) e bank_ledger (0021).
-- Draft continua totalmente editável (inclusive draft→active = ativação).
-- Runtime vivo NÃO faz UPDATE/DELETE em economic_policies (verificado: resolver só lê; único create é
-- repository.createPolicy INSERT) — trigger não bloqueia fluxo canônico. Forward-only, idempotente,
-- não toca dados nem dinheiro.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_economic_policies_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies is append-only for % policies: DELETE not allowed (policy %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'economic_policies: deprecated policy % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies: active policy % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.policy_code IS DISTINCT FROM OLD.policy_code
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.policy_type IS DISTINCT FROM OLD.policy_type
      OR NEW.module_context IS DISTINCT FROM OLD.module_context
      OR NEW.vertical IS DISTINCT FROM OLD.vertical
      OR NEW.actor_type IS DISTINCT FROM OLD.actor_type
      OR NEW.service_type IS DISTINCT FROM OLD.service_type
      OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
      OR NEW.settlement_flow IS DISTINCT FROM OLD.settlement_flow
      OR NEW.country IS DISTINCT FROM OLD.country
      OR NEW.region IS DISTINCT FROM OLD.region
      OR NEW.city IS DISTINCT FROM OLD.city
      OR NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'economic_policies: active policy % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for rule changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    -- permitidos: effective_until (encerramento controlado), status active→deprecated, updated_at.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS economic_policies_immutability ON economic_policies;
CREATE TRIGGER economic_policies_immutability
  BEFORE UPDATE OR DELETE ON economic_policies
  FOR EACH ROW
  EXECUTE FUNCTION enforce_economic_policies_immutability();

COMMIT;

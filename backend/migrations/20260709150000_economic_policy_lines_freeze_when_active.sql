-- 20260709150000_economic_policy_lines_freeze_when_active.sql
-- DECISION-0166 D5 — Fase 1 / F1-b da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- As LINHAS congelam no momento em que a policy pai fica ativa. Este era o buraco mais grave do GATE:
-- economic_policy_lines não tinha NENHUM trigger — um UPDATE podia mudar bps/destination_type de uma
-- policy ATIVA e reescrever silenciosamente a explicação de todo dinheiro passado apontando para a versão.
--
--   BLOQUEADO: INSERT / UPDATE / DELETE de linha cuja policy pai esteja 'active' OU 'deprecated'
--     (deprecated também explica dinheiro passado — mesma razão do trigger da F1-a; protege bps,
--     fixed_amount, destination_type/key, line_type, applies_to, regional_origin_basis, priority, metadata).
--   PERMITIDO: linhas de policy DRAFT totalmente editáveis (o fluxo governado passa a ser
--     draft → insere linhas → ativa; a F1-a permite a ativação draft→active).
--   FAIL-CLOSED: em INSERT/UPDATE, se o pai não for visível (RLS/tenant errado ou FK inválida) → EXCEPTION
--     (não assume draft). Em DELETE com pai ausente → PERMITE: é o cascade de um DELETE de policy DRAFT
--     (o trigger da F1-a já barrou DELETE de active/deprecated; órfã real não existe por FK).
-- Runtime vivo NÃO escreve em economic_policy_lines fora de createPolicyLine (INSERT) — nenhuma rota/serviço
-- canônico faz UPDATE/DELETE. Consequência conhecida e aceita: scripts e2e que criavam policy 'active' e
-- inseriam linhas DEPOIS passam ao padrão draft→lines→activate (ajustados nesta mesma fatia).
-- Forward-only, idempotente, não toca dados nem dinheiro.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_economic_policy_lines_freeze()
RETURNS trigger AS $$
DECLARE
  parent_status TEXT;
  parent_id UUID;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.policy_id ELSE NEW.policy_id END;

  SELECT status INTO parent_status FROM economic_policies WHERE id = parent_id;

  IF parent_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      -- pai já removido no mesmo comando = cascade de DELETE de policy draft (única deleção que a F1-a permite).
      RETURN OLD;
    END IF;
    RAISE EXCEPTION
      'economic_policy_lines: parent policy % not visible — cannot verify immutability (fail-closed).',
      parent_id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF parent_status IN ('active', 'deprecated') THEN
    RAISE EXCEPTION
      'economic_policy_lines: policy % is % — lines are frozen (no INSERT/UPDATE/DELETE). Create a new policy version to change rules.',
      parent_id, parent_status
      USING ERRCODE = 'raise_exception';
  END IF;

  -- UPDATE que tenta mover a linha para OUTRA policy: valida também o pai de destino ≠ origem.
  IF TG_OP = 'UPDATE' AND NEW.policy_id IS DISTINCT FROM OLD.policy_id THEN
    SELECT status INTO parent_status FROM economic_policies WHERE id = OLD.policy_id;
    IF parent_status IS NULL OR parent_status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policy_lines: cannot move line away from policy % (status %) — lines are frozen.',
        OLD.policy_id, COALESCE(parent_status, 'not visible')
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS economic_policy_lines_freeze ON economic_policy_lines;
CREATE TRIGGER economic_policy_lines_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON economic_policy_lines
  FOR EACH ROW
  EXECUTE FUNCTION enforce_economic_policy_lines_freeze();

COMMIT;

-- ============================================================
-- Financial Approval Core — governança não-executora
-- DECISION-0128 / F-CORE-FINANCIAL-APPROVAL-MODEL (2026-06-14)
--
-- ADAPTA o substrato canônico já existente (approval_requests / approval_votes,
-- migration 20260530569000, DECISION-0054). NÃO duplica tabelas: o Core de Aprovação
-- usa as tabelas canônicas. Esta migration apenas adiciona a governança que faltava
-- para o "motor" não-executor (request/decision/auditoria), SEM mover dinheiro:
--   1. idempotency_key em approval_requests (+ unique parcial) — evita request duplicada;
--   2. approval_votes append-only (UPDATE/DELETE rejeitados) — decisão imutável;
--   3. approval_requests sem DELETE — registro de governança não some;
--   4. approval_requests congela status terminal — decisão não é sobrescrita silenciosamente
--      (status não volta de approved/rejected/expired/cancelled).
--
-- Fora do escopo (frentes futuras): executor financeiro, bank-http, payout wiring, cartão.
-- NÃO toca bank_*/payout/ledger. Não-financeiro. Sem backfill. Reversível (drop col/trigger).
-- Blast: BAIXO — approval_requests/approval_votes vazias; nenhum writer de dinheiro tocado.
-- ============================================================

BEGIN;

-- 1) Idempotência de request (mesmo padrão de uq_payout_request_idempotency)
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_request_idempotency
  ON approval_requests(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN approval_requests.idempotency_key IS
  'Chave de idempotência server-side (DECISION-0128). Unique parcial por tenant. '
  'Evita request de aprovação duplicada. Nunca derivada de body/query como autoridade.';

-- 2) approval_votes é append-only (a migration 569000 declarava por comentário; agora é enforce)
CREATE OR REPLACE FUNCTION prevent_approval_vote_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approval_votes is append-only. UPDATE or DELETE is not allowed (DECISION-0128).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_votes_no_update ON approval_votes;
CREATE TRIGGER approval_votes_no_update
  BEFORE UPDATE ON approval_votes
  FOR EACH ROW EXECUTE PROCEDURE prevent_approval_vote_modification();

DROP TRIGGER IF EXISTS approval_votes_no_delete ON approval_votes;
CREATE TRIGGER approval_votes_no_delete
  BEFORE DELETE ON approval_votes
  FOR EACH ROW EXECUTE PROCEDURE prevent_approval_vote_modification();

-- 3) approval_requests não pode ser deletada (registro de governança/auditoria)
CREATE OR REPLACE FUNCTION prevent_approval_request_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approval_requests cannot be deleted (governance record, DECISION-0128).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_requests_no_delete ON approval_requests;
CREATE TRIGGER approval_requests_no_delete
  BEFORE DELETE ON approval_requests
  FOR EACH ROW EXECUTE PROCEDURE prevent_approval_request_delete();

-- 4) Estado terminal é congelado: decisão não é sobrescrita silenciosamente.
--    UPDATE só é permitido enquanto o status NÃO é terminal; uma vez
--    approved/rejected/expired/cancelled, o status não muda (fluxo causal não regride).
CREATE OR REPLACE FUNCTION prevent_approval_request_terminal_overwrite()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('approved', 'rejected', 'expired', 'cancelled')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'approval_requests status is terminal (%); cannot transition to % (DECISION-0128).',
      OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_requests_freeze_terminal ON approval_requests;
CREATE TRIGGER approval_requests_freeze_terminal
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE PROCEDURE prevent_approval_request_terminal_overwrite();

COMMIT;

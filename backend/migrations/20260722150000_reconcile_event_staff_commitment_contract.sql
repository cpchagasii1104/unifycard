-- 20260722150000: EVENT-ENGINE-COMPLETION · C2a — reconcilia o schema VIVO de event_staff ao CONTRATO
-- promulgado (docs/01_normative/operational_commitment_minimum_contract.md §3/§4). Fecha
-- DT-EVENT-STAFF-OPERATIONAL-COMMITMENT-SCHEMA-DRIFT: o writer actor-first createCommitment já grava
-- conforme a norma (status='expected'; lifecycle checked_in/checked_out/failed; colunas
-- checked_in_at/checked_out_at/failure_reason), mas o schema vivo NÃO aceitava — CHECK vivo era
-- ('active','inactive','cancelled') e as 3 colunas de lifecycle não existiam.
--
-- LEI: event_staff/OperationalCommitment é O vínculo actor↔evento (materializar event_actors = realidade
-- paralela, PROIBIDO §2). PROIBIDO campo financeiro/valor/preço/share/penalidade/reputação (contrato §3/§11).
-- Reconcile PURAMENTE operacional: +3 colunas NULL (contrato §3) + CHECK alinhado ao vocabulário §4.
--
-- STATUS (contrato §4): expected · checked_in · checked_out · failed. Os estados LEGADOS
-- ('active','inactive','cancelled') do assignStaff (que insere via DEFAULT 'active' — events.service.ts)
-- são MANTIDOS de forma coerente durante a transição: a deprecação do assignStaff é C2b, não aqui. O
-- DEFAULT 'active' da coluna NÃO é alterado (createCommitment grava 'expected' explicitamente).
-- Aditiva/forward-only/idempotente. Δbank=0 (nenhum campo financeiro).
BEGIN;

-- (i) Colunas de lifecycle factual (contrato §3) — todas NULL, sem economia/punição.
ALTER TABLE event_staff
  ADD COLUMN IF NOT EXISTS checked_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- (ii) CHECK de status alinhado ao contrato §4 (∪ legado do assignStaff até a deprecação C2b).
ALTER TABLE event_staff DROP CONSTRAINT IF EXISTS chk_event_staff_status;
ALTER TABLE event_staff
  ADD CONSTRAINT chk_event_staff_status
  CHECK (status IN (
    'expected', 'checked_in', 'checked_out', 'failed',  -- contrato §4 (OperationalCommitment)
    'active', 'inactive', 'cancelled'                    -- legado assignStaff (deprecação = C2b)
  ));

COMMENT ON COLUMN event_staff.checked_in_at IS
  'C2a/contrato §3: timestamp do check-in (fato). Sem decisão, sem punição, sem economia.';
COMMENT ON COLUMN event_staff.checked_out_at IS
  'C2a/contrato §3: timestamp do check-out (fato). Sem decisão, sem punição, sem economia.';
COMMENT ON COLUMN event_staff.failure_reason IS
  'C2a/contrato §3: motivo de falha (status=failed). Texto livre, sem regra automática.';

COMMIT;

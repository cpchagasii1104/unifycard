-- 20260708210000: HORÁRIO de retirada/devolução (F-RENTAL-AVAILABILITY-SUBPERIOD-UX, GO Clayton 2026-07-08).
-- Correção semântica: para veículo/equipamento/imóvel a JANELA de disponibilidade é por PERÍODO (datas,
-- posse contínua) — o horário NÃO é limite diário. O "das X às Y" desses tipos é a REGRA de retirada/
-- devolução do recurso (quando o dono aceita entregar/receber), guardada aqui como atributo do RECURSO
-- (uma vez), não em cada janela. Para ESPAÇO o horário continua sendo o uso real (fica na própria janela
-- de availability). TIME sem timezone = hora do dia local do recurso. Nullable (a combinar). Δbank=0.
BEGIN;
ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS handoff_time_start TIME,
  ADD COLUMN IF NOT EXISTS handoff_time_end TIME,
  ADD CONSTRAINT chk_handoff_time_order
    CHECK (handoff_time_start IS NULL OR handoff_time_end IS NULL OR handoff_time_end > handoff_time_start);
COMMIT;

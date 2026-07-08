-- 20260708170000: modo de aprovação de reserva (modelo Airbnb). O DONO decide no cadastro:
--   'automatic' = a solicitação vira reserva confirmada NA HORA (não esfria o negócio);
--   'manual'    = o dono aprova cada pedido (booking fica 'requested' até ele confirmar).
-- Vocabulário GOVERNADO (CHECK). Default 'manual' (conservador p/ recursos já existentes; o formulário
-- de cadastro sugere 'automatic'). PRÉ-DINHEIRO: 'confirmado' = compromisso de agenda, NÃO pagamento
-- (dinheiro/caução/contrato = PORTA-1). Forward-only.
BEGIN;
ALTER TABLE rentable_resources ADD COLUMN IF NOT EXISTS booking_approval_mode TEXT NOT NULL DEFAULT 'manual'
  CHECK (booking_approval_mode IN ('manual', 'automatic'));
COMMIT;

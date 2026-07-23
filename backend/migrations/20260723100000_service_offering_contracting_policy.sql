-- 20260723100000: POLÍTICA DE CONTRATAÇÃO da oferta do performer (apresentacao-musical e afins).
-- A banda decide, NA PRÓPRIA service_offering, se ACEITA-DIRETO ('automatic' — "fechou fechou": um booking
-- dentro da condição de distância AUTO-CONFIRMA na hora, passando pelo lock canônico por provider) ou NEGOCIA
-- ('manual' — o booking fica 'requested' até a banda confirmar/recusar). Espelha o modelo já SELADO de
-- rentable_resources.booking_approval_mode (20260708170000): vocabulário GOVERNADO por CHECK (NÃO enum type,
-- §4.9.7), colunas REAIS (predicáveis por SQL — NÃO conditions JSONB opaco). Condição = DISTÂNCIA (mesma cidade
-- OU raio em km que a banda define), reusando o primitivo geo canônico (actor_active_location + haversine_distance_km,
-- DECISION-0030). PREÇO fica FORA desta fatia. PRÉ-DINHEIRO: 'confirmed' = compromisso de agenda, NÃO pagamento
-- (dinheiro/contrato = PORTA-1). Δbank=0. Additive + idempotente. Forward-only.
BEGIN;

-- 1. Colunas de política (REAIS, CHECK-governed; default conservador = 'manual'/negocia para ofertas já existentes).
ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS booking_approval_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (booking_approval_mode IN ('manual', 'automatic')),
  ADD COLUMN IF NOT EXISTS accept_direct_same_city BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_direct_radius_km NUMERIC
    CHECK (accept_direct_radius_km IS NULL OR accept_direct_radius_km > 0);

-- 2. CHECK físico "aceita-direto TEM que ter distância": automatic exige pelo menos uma condição de alcance
--    (mesma-cidade OU raio). Sem condição não há prova de within-reach → auto-confirm cego é proibido no banco.
--    Guarded (idempotente) — Postgres não tem ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_offering_automatic_requires_distance'
  ) THEN
    ALTER TABLE service_offerings
      ADD CONSTRAINT chk_service_offering_automatic_requires_distance
      CHECK (
        booking_approval_mode <> 'automatic'
        OR accept_direct_same_city = true
        OR accept_direct_radius_km IS NOT NULL
      );
  END IF;
END $$;

COMMIT;

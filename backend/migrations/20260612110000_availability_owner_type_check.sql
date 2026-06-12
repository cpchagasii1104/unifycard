-- 20260612110000_availability_owner_type_check.sql
-- DECISION-0118 D2 — F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE.
--
-- CAUSA-RAIZ (reseal Yala, [B2]): availability.owner_type era VARCHAR LIVRE —
-- o banco aceitava qualquer string; o writer de service_offering gravava um
-- tipo fora do enum TypeScript (`as never`) e a família temporal tratava
-- owner_id como ACTOR (autorização quebrada para owners-recurso).
--
-- CHECK físico fail-closed com SOMENTE os owner types normados, vivos E
-- suportados pelo resolver polimórfico de autoridade
-- (backend/src/core/availability/availability-owner-authority.ts):
--   user · service · event · group · page · service_offering
-- Vocabulário ESPELHADO no enum AvailabilityOwnerType — não alterar um sem o
-- outro (gate temporal compara os dois conjuntos).
-- Nenhum tipo por antecipação (driver/pdv exigem norma + runtime + policy).
--
-- Aditiva, forward-only; valida dados vivos ANTES (aborta se houver linha fora).

BEGIN;

DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM availability
   WHERE owner_type NOT IN ('user', 'service', 'event', 'group', 'page', 'service_offering');
  IF bad > 0 THEN
    RAISE EXCEPTION 'availability_owner_type_check: % linhas com owner_type fora do vocabulário canônico — abortando (decisão humana necessária).', bad;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_availability_owner_type') THEN
    ALTER TABLE availability ADD CONSTRAINT chk_availability_owner_type
      CHECK (owner_type IN ('user', 'service', 'event', 'group', 'page', 'service_offering'));
  END IF;
END $$;

COMMIT;

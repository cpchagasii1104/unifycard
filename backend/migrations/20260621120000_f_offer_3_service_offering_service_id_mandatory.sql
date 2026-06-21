-- F-OFFER-3 (3A schema) · DECISION-0145 — service_offering PERTENCE a um service.
-- PARANOICA: PROVA antes de ALTER (fail-closed, RAISE aborta); NÃO corrige dado; sem DROP CASCADE.
--   (1) service_offerings.service_id NOT NULL (a oferta exige um `service` — writer 3B já o popula nesta MESMA fatia MODO B)
--   (2) FK service_offerings.service_id -> services(service_id) ON DELETE RESTRICT (era SET NULL/fraca)
-- O runner (migrate.ts) registra em schema_migrations — este arquivo é só preflight + DDL idempotente.
-- NÃO toca: availability/discovery/dinheiro/payout/presence/grants/service_order/docs/01_normative.

DO $$
DECLARE
  v_so_null int; v_so_orphan int; v_fk int;
BEGIN
  -- ===== PREFLIGHT (fail-closed; NÃO corrige dado) =====
  SELECT count(*) INTO v_so_null FROM service_offerings WHERE service_id IS NULL;
  SELECT count(*) INTO v_so_orphan FROM service_offerings so
    WHERE so.service_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM services s WHERE s.service_id = so.service_id);
  IF v_so_null   > 0 THEN RAISE EXCEPTION 'F-OFFER-3 STOP: % service_offerings com service_id NULL (writer 3B deve popular antes; nao corrigir na migration)', v_so_null; END IF;
  IF v_so_orphan > 0 THEN RAISE EXCEPTION 'F-OFFER-3 STOP: % service_offerings com service_id orfao (sem match em services)', v_so_orphan; END IF;

  -- ===== (1) service_id NOT NULL (idempotente) =====
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='service_offerings' AND column_name='service_id' AND is_nullable='YES') THEN
    ALTER TABLE service_offerings ALTER COLUMN service_id SET NOT NULL;
    RAISE NOTICE 'F-OFFER-3: service_offerings.service_id -> NOT NULL';
  ELSE
    RAISE NOTICE 'F-OFFER-3: service_offerings.service_id ja NOT NULL (idempotente)';
  END IF;

  -- ===== (2) FK service_id -> services RESTRICT (descoberta exata; sem CASCADE) =====
  SELECT count(*) INTO v_fk FROM pg_constraint
    WHERE conrelid='service_offerings'::regclass AND conname='service_offerings_service_id_fkey' AND contype='f';
  IF v_fk <> 1 THEN RAISE EXCEPTION 'F-OFFER-3 STOP: FK service_offerings.service_id ambigua/ausente (esperado 1, achou %)', v_fk; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='service_offerings_service_id_fkey' AND confdeltype <> 'r') THEN
    ALTER TABLE service_offerings DROP CONSTRAINT service_offerings_service_id_fkey;
    ALTER TABLE service_offerings ADD CONSTRAINT service_offerings_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE RESTRICT;
    RAISE NOTICE 'F-OFFER-3: service_offerings.service_id FK -> RESTRICT';
  ELSE
    RAISE NOTICE 'F-OFFER-3: service_offerings.service_id FK ja RESTRICT (idempotente)';
  END IF;
END $$;

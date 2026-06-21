-- F-OFFER-2A · DECISION-0144 — materializa a parte SCHEMA da régua declaração→service.
-- PARANOICA: PROVA antes de ALTER (fail-closed, RAISE aborta o bloco atômico); NÃO corrige dado;
-- sem DROP ... CASCADE; sem runtime. O runner (migrate.ts) registra em schema_migrations — este
-- arquivo é só preflight + DDL idempotente.
--   (1) services.canonical_service_id NOT NULL  (sem `service` concept-less — DECISION-0142/0143/0144 §A.2)
--   (2) FK actor_professional_concepts.concept_id -> concepts(concept_id) ON DELETE RESTRICT (D3-6A)
--   (3) FK company_concept_publications.concept_id -> concepts(concept_id) ON DELETE RESTRICT (D3-6A)
-- NÃO toca: createService/runtime · service_offerings · availability · discovery · actor_capability_grants
-- · ramo-4 legado · dinheiro/payout/presença.

DO $$
DECLARE
  v_svc_null int; v_svc_orphan int;
  v_cs_concept_null int; v_cs_concept_orphan int; v_cs_fk int;
  v_apc_orphan int; v_ccp_orphan int; v_apc_fk int; v_ccp_fk int;
BEGIN
  -- ===== PREFLIGHT (fail-closed; NÃO corrige dado) =====
  SELECT count(*) INTO v_svc_null FROM services WHERE canonical_service_id IS NULL;
  SELECT count(*) INTO v_svc_orphan FROM services s
    WHERE s.canonical_service_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.id = s.canonical_service_id);
  SELECT count(*) INTO v_cs_concept_null FROM canonical_services WHERE concept_id IS NULL;
  SELECT count(*) INTO v_cs_concept_orphan FROM canonical_services cs
    WHERE cs.concept_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM concepts c WHERE c.concept_id = cs.concept_id);
  SELECT count(*) INTO v_cs_fk FROM pg_constraint
    WHERE conrelid='canonical_services'::regclass AND contype='f' AND confdeltype='r'
      AND pg_get_constraintdef(oid) ILIKE '%(concept_id)%REFERENCES%concepts%';
  SELECT count(*) INTO v_apc_orphan FROM actor_professional_concepts a
    WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.concept_id = a.concept_id);
  SELECT count(*) INTO v_ccp_orphan FROM company_concept_publications p
    WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.concept_id = p.concept_id);

  IF v_svc_null      > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: % services com canonical_service_id NULL (corrigir dado+DECISAO, nao na migration)', v_svc_null; END IF;
  IF v_svc_orphan    > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: % services com canonical_service_id orfao', v_svc_orphan; END IF;
  IF v_cs_concept_null   > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: canonical_services com concept_id NULL (%) — nao resolve concept', v_cs_concept_null; END IF;
  IF v_cs_concept_orphan > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: canonical_services concept_id orfao (%)', v_cs_concept_orphan; END IF;
  IF v_cs_fk < 1 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: canonical_services NAO resolve concept_id materialmente (FK concept_id->concepts RESTRICT ausente)'; END IF;
  IF v_apc_orphan    > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: actor_professional_concepts concept_id orfao (%)', v_apc_orphan; END IF;
  IF v_ccp_orphan    > 0 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: company_concept_publications concept_id orfao (%)', v_ccp_orphan; END IF;

  -- ===== (1) services.canonical_service_id NOT NULL (idempotente) =====
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='services' AND column_name='canonical_service_id' AND is_nullable='YES') THEN
    ALTER TABLE services ALTER COLUMN canonical_service_id SET NOT NULL;
    RAISE NOTICE 'F-OFFER-2A: services.canonical_service_id -> NOT NULL';
  ELSE
    RAISE NOTICE 'F-OFFER-2A: services.canonical_service_id ja NOT NULL (idempotente)';
  END IF;

  -- ===== (2) FK apc concept_id -> concepts RESTRICT (descoberta exata da constraint; sem CASCADE) =====
  SELECT count(*) INTO v_apc_fk FROM pg_constraint
    WHERE conrelid='actor_professional_concepts'::regclass
      AND conname='actor_professional_concepts_concept_id_fkey' AND contype='f';
  IF v_apc_fk <> 1 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: FK apc concept_id ambigua/ausente (esperado 1, achou %)', v_apc_fk; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname='actor_professional_concepts_concept_id_fkey' AND confdeltype <> 'r') THEN
    ALTER TABLE actor_professional_concepts DROP CONSTRAINT actor_professional_concepts_concept_id_fkey;
    ALTER TABLE actor_professional_concepts ADD CONSTRAINT actor_professional_concepts_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT;
    RAISE NOTICE 'F-OFFER-2A: apc FK concept_id -> RESTRICT';
  ELSE
    RAISE NOTICE 'F-OFFER-2A: apc FK concept_id ja RESTRICT (idempotente)';
  END IF;

  -- ===== (3) FK ccp concept_id -> concepts RESTRICT =====
  SELECT count(*) INTO v_ccp_fk FROM pg_constraint
    WHERE conrelid='company_concept_publications'::regclass
      AND conname='company_concept_publications_concept_id_fkey' AND contype='f';
  IF v_ccp_fk <> 1 THEN RAISE EXCEPTION 'F-OFFER-2A STOP: FK ccp concept_id ambigua/ausente (esperado 1, achou %)', v_ccp_fk; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname='company_concept_publications_concept_id_fkey' AND confdeltype <> 'r') THEN
    ALTER TABLE company_concept_publications DROP CONSTRAINT company_concept_publications_concept_id_fkey;
    ALTER TABLE company_concept_publications ADD CONSTRAINT company_concept_publications_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT;
    RAISE NOTICE 'F-OFFER-2A: ccp FK concept_id -> RESTRICT';
  ELSE
    RAISE NOTICE 'F-OFFER-2A: ccp FK concept_id ja RESTRICT (idempotente)';
  END IF;
END $$;

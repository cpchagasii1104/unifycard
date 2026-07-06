-- 20260706140000_r2_delegation_authorship_fk_to_actors.sql
-- R2 FIX RN3 (auditoria normativa Yala 2026-07-06, DT-R2-DELEGATION-AUTHORSHIP-COLUMNS-NO-FK-TO-ACTORS):
-- `granted_by_actor_id` (actor_delegations) e `actor_id` (actor_delegation_events) são nomeados `_actor_id`
-- — a convenção 07_NOMENCLATURA §4.3 "<entidade>_id" IMPLICA FK à entidade. Mas foram criados SEM FK a
-- actors(id) (só `previous_link_id` tinha FK self). O nome promete um vínculo que o schema não garantia.
-- Esta migration cumpre a convenção: FK de AUTORIA a actors(id), ON DELETE SET NULL (a autoria é nullable
-- por design — delegação legada/de-sistema; apagar o actor não apaga a delegação, só perde o rastro de quem).
--
-- GATE 00_AGENT_PROTOCOL §2.3.2: pilar AUTORIDADE; SSOT actor_delegations (§5.16); forward-only ADITIVO
-- (só adiciona constraint; nenhuma coluna/dado alterado); ZERO bank_* (D4). Seguro: em dev as 9 delegações
-- legadas têm granted_by NULL (NULL não viola FK); writes novos sempre passam actor real (validado no writer).
-- Idempotente (IF NOT EXISTS na checagem de constraint).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_actor_delegations_granted_by_actor') THEN
    ALTER TABLE actor_delegations
      ADD CONSTRAINT fk_actor_delegations_granted_by_actor
      FOREIGN KEY (granted_by_actor_id) REFERENCES actors (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_actor_delegation_events_actor') THEN
    ALTER TABLE actor_delegation_events
      ADD CONSTRAINT fk_actor_delegation_events_actor
      FOREIGN KEY (actor_id) REFERENCES actors (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_actor_delegations_granted_by_actor ON actor_delegations IS
  'R2/RN3: autoria da concessão (§4.9.9) referencia actors(id); ON DELETE SET NULL (autoria nullable).';
COMMENT ON CONSTRAINT fk_actor_delegation_events_actor ON actor_delegation_events IS
  'R2/RN3: autor do evento (grant/revoke) referencia actors(id); NULL para eventos de sistema (expired).';

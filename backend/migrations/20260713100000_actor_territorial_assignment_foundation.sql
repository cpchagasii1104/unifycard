-- FASE A — FUNDAÇÃO DO PAPEL TERRITORIAL CANÔNICO DO ACTOR
-- ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING. Base 6a7bd4a20 (N3 selada).
--
-- Adiciona a ÂNCORA actor-scoped FK-backed na CASA CANÔNICA existente (address_assignments) — sem 3ª tabela
-- de jurisdição. NÃO cria writer, NÃO integra CEP, NÃO altera os 37 addresses, NÃO faz seed/backfill,
-- NÃO abre rota, NÃO cria city/neighborhood, NÃO toca Social/Bank/split. Forward-only, aditiva.
--
-- Invariante: Actor → assignment territorial vigente → address → city_id canônico → neighborhood_id|NULL.
-- NUNCA user/profile/company/tenant/CEP/actor_active_location como jurisdição implícita.
--
-- TRAVA FAIL-CLOSED até a Fase C: os writers legados NÃO conhecem actor_id → não conseguem criar
-- linha owner_type='actor' válida (a CHECK exige actor_id = owner_id). A porta actor-scoped só abre
-- quando a Fase C escrever o writer canônico (canRepresentActor + validação + evento).

BEGIN;

-- 1. ÂNCORA CANÔNICA: actor_id FK real para actors(id). NULL nos assignments legados.
ALTER TABLE public.address_assignments
  ADD COLUMN actor_id uuid NULL REFERENCES public.actors(id) ON DELETE RESTRICT;

-- 2. VOCABULÁRIO ÚNICO: owner_type ganha o valor canônico 'actor'.
ALTER TABLE public.address_assignments DROP CONSTRAINT address_assignments_owner_type_check;
ALTER TABLE public.address_assignments ADD CONSTRAINT address_assignments_owner_type_check
  CHECK (owner_type = ANY (ARRAY['company','profile','event','ride','group','tenant_hq','service_provider','rentable_resource','actor_asset','actor']));

-- 3. COERÊNCIA actor-scoped: owner_type='actor' ⇔ actor_id NOT NULL ⇔ owner_id = actor_id (espelho;
--    owner_id é NOT NULL legado). Impede Actor implícito e impede actor_id em linhas não-actor.
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_actor_shape
  CHECK (
    (owner_type = 'actor' AND actor_id IS NOT NULL AND owner_id = actor_id)
    OR (owner_type <> 'actor' AND actor_id IS NULL)
  );

-- 4. VIGÊNCIA coerente (aplica a todos; legados já satisfazem: 0 violam).
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_validity_order
  CHECK (valid_until_at IS NULL OR valid_until_at > valid_from_at);

-- 5. PAPÉIS territoriais actor-scoped restritos ao vocabulário canônico (RESIDENCE/OPERATIONAL/HQ).
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_actor_role
  CHECK (owner_type <> 'actor' OR role = ANY (ARRAY['RESIDENCE','OPERATIONAL','HQ']));

-- 6. UNICIDADE actor-scoped: um único primary VIGENTE por (actor_id, role). Não substitui a unicidade legada.
CREATE UNIQUE INDEX uidx_addr_assign_actor_primary
  ON public.address_assignments (actor_id, role)
  WHERE actor_id IS NOT NULL AND is_primary = true AND valid_until_at IS NULL;

CREATE INDEX idx_addr_assign_actor_active
  ON public.address_assignments (actor_id, role)
  WHERE actor_id IS NOT NULL AND valid_until_at IS NULL;

-- 7. COERÊNCIA PF/PJ↔ROLE via TRIGGER (lê actors.actor_type AO VIVO; NÃO copia actor_type para a tabela).
--    RESIDENCE ⇒ PF (actor_type='user'); OPERATIONAL/HQ ⇒ PJ (actor_type='page'). Impede PF herdar papel PJ
--    e PJ herdar RESIDENCE do representante.
CREATE OR REPLACE FUNCTION public.fn_addr_assign_actor_role_coherence()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE v_type text;
BEGIN
  IF NEW.owner_type = 'actor' THEN
    SELECT actor_type INTO v_type FROM public.actors WHERE id = NEW.actor_id;
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_ACTOR_NOT_FOUND';
    END IF;
    IF NEW.role = 'RESIDENCE' AND v_type <> 'user' THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_RESIDENCE_REQUIRES_PF (actor_type=%)', v_type;
    END IF;
    IF NEW.role IN ('OPERATIONAL','HQ') AND v_type <> 'page' THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_OPHQ_REQUIRES_PJ (actor_type=%)', v_type;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_addr_assign_actor_role_coherence
  BEFORE INSERT OR UPDATE ON public.address_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_addr_assign_actor_role_coherence();

-- 8. IMUTABILIDADE HISTÓRICA dos vínculos ACTOR-SCOPED (não interfere nos legados: rentals/events soft-close):
--    proíbe mudar actor_id/address_id/role/valid_from_at/owner_type/owner_id/assignment_id in-place;
--    proíbe reabrir encerrado; proíbe re-primary (nova residência/operação = novo assignment); proíbe DELETE.
CREATE OR REPLACE FUNCTION public.fn_addr_assign_actor_immutability()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.owner_type = 'actor' THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_NO_DELETE (encerre via valid_until_at)';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.owner_type = 'actor' OR NEW.owner_type = 'actor' THEN
    IF NEW.assignment_id <> OLD.assignment_id
       OR NEW.owner_type <> OLD.owner_type
       OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
       OR NEW.address_id <> OLD.address_id
       OR NEW.role <> OLD.role
       OR NEW.valid_from_at <> OLD.valid_from_at
       OR NEW.owner_id <> OLD.owner_id THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_IMMUTABLE (nova residência/operação = novo assignment apos encerrar o anterior)';
    END IF;
    IF OLD.valid_until_at IS NOT NULL AND NEW.valid_until_at IS NULL THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_NO_REOPEN';
    END IF;
    IF OLD.is_primary = false AND NEW.is_primary = true THEN
      RAISE EXCEPTION 'ACTOR_TERRITORIAL_NO_REPRIMARY (crie novo primary)';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_addr_assign_actor_immutability
  BEFORE UPDATE OR DELETE ON public.address_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_addr_assign_actor_immutability();

COMMENT ON COLUMN public.address_assignments.actor_id IS
  'FASE A - ancora canonica FK-backed da jurisdicao territorial do Actor. NOT NULL sse owner_type=actor (owner_id=actor_id espelho). Writers legados nao preenchem -> nao criam actor-scoped (trava fail-closed ate a Fase C). SSOT de jurisdicao do Actor; nunca via profile/company/tenant/CEP/actor_active_location.';

COMMIT;

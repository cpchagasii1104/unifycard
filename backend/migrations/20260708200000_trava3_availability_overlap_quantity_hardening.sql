-- 20260708200000: TRAVA 3 — HARDENING DE BANCO (GO Clayton 2026-07-08). Leva ao BANCO duas regras que
-- hoje só o service protege: (A) janelas macro ativas do mesmo recurso não se sobrepõem; (B) só
-- equipamento pode quantity>1. NÃO é feature; Δbank=0 (nada financeiro).
--
-- LIMPEZA EXPLÍCITA (preflight reportou): 8 janelas availability de rentable_resource ÓRFÃS (owner_id
-- não existe em rentable_resources — recursos fantasma criados por smokes 2026-07-07) violariam a
-- EXCLUDE. NÃO são dados reais (recursos vivos como o Silverado NÃO estão sobrepostos: overlap real=0).
-- ON DELETE CASCADE em bookings→availability remove os 2 bookings órfãos junto. Só órfãs; recursos
-- reais preservados. Forward-only.
BEGIN;

-- (0) limpeza dos órfãos de smoke/dev (owner inexistente). WHERE cirúrgico: só rentable_resource órfão.
DELETE FROM availability
 WHERE owner_type = 'rentable_resource'
   AND owner_id NOT IN (SELECT id FROM rentable_resources);

-- (1) btree_gist: necessário para EXCLUDE combinando '=' em uuid com '&&' em tstzrange no mesmo índice.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (A) OVERLAP: janelas macro ATIVAS do mesmo rentable_resource não podem se sobrepor. Partial WHERE →
-- não afeta os outros owner_types (user/page/service_offering) nem janelas paused. Reserva/subperíodo
-- vive em bookings (não aqui) — esta trava é só das JANELAS macro declaradas. '[)' = fim exclusivo, então
-- janelas contíguas (fim==início) são permitidas (mesma semântica do guard do service).
ALTER TABLE availability
  ADD CONSTRAINT availability_rental_no_overlap
  EXCLUDE USING gist (
    owner_id WITH =,
    tstzrange(start_datetime, end_datetime, '[)') WITH &&
  )
  WHERE (owner_type = 'rentable_resource' AND status = 'active');

-- (B) QUANTITY por tipo: só equipment pode >1; vehicle/property/space travados em 1 (regra MVP; espaço
-- com capacidade múltipla é OUTRO atributo, não quantity de itens idênticos — decisão futura governada).
ALTER TABLE rentable_resources
  ADD CONSTRAINT rentable_quantity_single_unless_equipment
  CHECK (resource_type = 'equipment' OR quantity = 1);

COMMIT;

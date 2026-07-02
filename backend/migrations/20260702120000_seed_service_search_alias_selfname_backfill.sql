-- ============================================================
-- 20260702120000: backfill de aliases self-name (DT-SERVICE-SEARCH-ALIAS-SELFNAME-GAP)
-- ============================================================
-- Achado: a ponte termo→concept (service_search_aliases) é curada INDEPENDENTEMENTE de
-- concepts/canonical_services (doutrina: alias = lente de busca, NUNCA autoridade/verdade
-- derivada). Isso é correto para sinônimos/gíria/profissão→serviço ("barbeiro"→barba,
-- "diarista"→faxina-residencial) — exige julgamento humano, não é derivável do dado.
--
-- Mas o PRÓPRIO NOME de um canonical_service é diferente: é literalmente a identidade do dado,
-- não curadoria editorial. Sem alias self-name, digitar o nome exato do serviço do catálogo (ex.:
-- "barba") caía em "termo desconhecido" mesmo com concept/canonical_service existindo — bug
-- reproduzido por Clayton no browser. Decisão (Clayton, 2026-07-02): tratamento HÍBRIDO —
-- self-name = garantia estrutural (não deve depender de alguém lembrar de curar); sinônimo/gíria
-- = editorial, como já é. Esta migration cobre o backfill imediato; a garantia estrutural daqui
-- pra frente vem do guard audit-service-search-alias-selfname-invariant.mjs (regression-guards),
-- não de trigger/runtime novo (canonical_service hoje só nasce via migration/seed, não via UI —
-- DT-SERVICE-CURATION-PIPELINE-HEADLESS é frente futura própria).
--
-- Escopo: 12 canonical_services global/active SEM self-name alias (de 20 totais; os outros 8 já
-- tinham por coincidência — ex. "manicure" é ao mesmo tempo termo de profissão E nome do serviço).
-- alias_term = concept_labels.label (pt-BR/default/primary, apresentação governada); normalized_term
-- = canonical_services.slug (confirmado idêntico a normalizeSearchTerm(label) para os 12 — sem
-- ambiguidade de normalização). Mesma tríade/INNER JOIN/ON CONFLICT do molde da Slice de Limpeza.
--
-- Lei 2: forward-only, idempotente (ON CONFLICT DO NOTHING). Zero mudança de motor/authority/money.
-- ============================================================

BEGIN;

INSERT INTO public.service_search_aliases
  (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
SELECT
  cl.label, cs.slug, cs.concept_id,
  'high', 'approved', true,
  'clayton_curated_selfname_backfill_2026_07_02', 'selfname-backfill-v1'
FROM public.canonical_services cs
JOIN public.concept_labels cl
  ON cl.concept_id = cs.concept_id AND cl.locale = 'pt-BR' AND cl.context_key = 'default' AND cl.is_primary = true
WHERE cs.scope = 'global'
  AND cs.status = 'active'
  AND cs.slug IN (
    'alisamento-capilar', 'barba', 'coloracao-total', 'corte-de-cabelo-feminino',
    'corte-de-cabelo-masculino', 'design-de-sobrancelhas', 'escova', 'faxina-residencial',
    'luzes-capilares', 'organizacao-residencial', 'retoque-de-raiz', 'tonalizante'
  )
ON CONFLICT (normalized_term, concept_id) DO NOTHING;

-- ── PÓS-ASSERÇÃO (fail-closed): os 12 self-name aliases materializaram, cada canonical_service
-- global/active agora resolve por si mesmo, e nenhum alias vira autoridade.
DO $$
DECLARE
  n_alias  integer;
  n_missing integer;
BEGIN
  SELECT count(*) INTO n_alias FROM public.service_search_aliases
   WHERE source = 'clayton_curated_selfname_backfill_2026_07_02';
  IF n_alias <> 12 THEN
    RAISE EXCEPTION 'SELFNAME BACKFILL STOP: esperado 12 aliases, achou %.', n_alias;
  END IF;

  SELECT count(*) INTO n_missing
  FROM public.canonical_services cs
  WHERE cs.scope = 'global' AND cs.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.service_search_aliases a
       WHERE a.normalized_term = cs.slug AND a.concept_id = cs.concept_id
         AND a.is_active = true AND a.review_status = 'approved'
    );
  IF n_missing <> 0 THEN
    RAISE EXCEPTION 'SELFNAME BACKFILL STOP: % canonical_services global/active ainda sem self-name alias.', n_missing;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- 20260804210000: REAPLICAÇÃO do backfill de alias self-name
-- ============================================================
-- Não promulga regra nova. A regra JÁ é sua, de 2026-07-02, e está escrita em
-- 20260702120000_seed_service_search_alias_selfname_backfill.sql:
--
--   "self-name = GARANTIA ESTRUTURAL (não deve depender de alguém lembrar de curar);
--    sinônimo/gíria = editorial, como já é."
--
-- O que falhou não foi a regra: foi a FORMA da garantia. Backfill de data fixa protege o passado
-- e não protege o que nasce amanhã. O guard existe, está correto — e estava FORA do runner, então
-- ninguém o via ficar vermelho.
--
-- ═══ ESTADO MEDIDO EM 2026-08-04 (antes desta migration) ═══
--   canonical_services global/active .......... 175
--   SEM self-name alias ....................... 141  (81%)
--   mais antigos sem alias .................... 2026-07-07, CINCO DIAS após o backfill
--
-- 81% do catálogo era indescobrível digitando o próprio nome do serviço. Sem erro e sem log:
-- search-by-term depende 100% desta tabela e o miss devolve lista vazia.
-- (Levantado pela instância de ARQUITETURA como caso único `mudanca-e-frete`; a medição mostrou
--  que o caso único era 141.)
--
-- ═══ POR QUE O `alias_term` MUDA DE FONTE ═══
-- O molde de 2026-07-02 usa INNER JOIN em `concept_labels` (pt-BR/default/primary). Medido hoje:
-- dos 141 faltantes, apenas 2 têm essa label. O molde original alcançaria 2 de 141.
-- Aqui `alias_term` vem de `canonical_services.name` — preenchido em 175/175, e é literalmente o
-- nome do serviço no catálogo, que é o que a regra quer resolver. `normalized_term` continua sendo
-- `cs.slug`, que é exatamente o que o guard exige.
--
-- 🔴 LACUNA COLATERAL NOMEADA, NÃO CONSERTADA AQUI: 139 concepts sem `concept_labels` pt-BR
-- primária. Isso é apresentação governada e tem dono próprio — consertar de carona, dentro de uma
-- migration de busca, seria decidir rótulo por conveniência. Fica registrado para frente própria.
--
-- Lei 2: forward-only, idempotente (ON CONFLICT DO NOTHING). Zero mudança de motor/autoridade/dinheiro.
-- ============================================================

BEGIN;

INSERT INTO public.service_search_aliases
  (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
SELECT
  cs.name, cs.slug, cs.concept_id,
  'high', 'approved', true,
  'selfname_backfill_reapply_2026_08_04', 'selfname-backfill-v2'
FROM public.canonical_services cs
WHERE cs.scope = 'global'
  AND cs.status = 'active'
  AND cs.name IS NOT NULL
  AND btrim(cs.name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.service_search_aliases a
     WHERE a.normalized_term = cs.slug
       AND a.concept_id = cs.concept_id
       AND a.is_active = true
       AND a.review_status = 'approved'
  )
ON CONFLICT DO NOTHING;

COMMIT;

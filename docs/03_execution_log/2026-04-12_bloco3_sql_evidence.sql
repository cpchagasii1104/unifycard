-- Bloco 3 — evidência SQL — executado via psql -f
-- Não contém credenciais.
--
-- Nota SSOT (2026-04-12): `concepts.domain` = N0 (`domains.domain_key`), não slugs N1 `marketplace-*`.
-- Critério ORIENTACAO legado `#1` com `LIKE 'marketplace-%'` mantém-se só como registo documental (#1a).
-- Critério operacional fechamento Bloco 3: #1b (`item-comercial`).

-- #1a (legado ORIENTACAO — pode ser 0 linhas com modelo N0)
SELECT domain, COUNT(*) AS count
FROM concepts
WHERE domain LIKE 'marketplace-%'
GROUP BY domain;

-- #1b (SSOT — conceitos catálogo item-comercial)
SELECT domain, COUNT(*) AS count
FROM concepts
WHERE domain = 'item-comercial'
GROUP BY domain;

-- #2 (3C) categorias marketplace sem canónico global READY (esperado 0 linhas)
SELECT cat.slug, COUNT(cp.id) AS canonicals
FROM categories cat
LEFT JOIN canonical_products cp
  ON cp.category_id = cat.category_id
  AND cp.scope = 'global'
  AND cp.concept_resolution_status = 'confirmed'
  AND cp.concept_id IS NOT NULL
WHERE cat.metadata->>'domain' = 'marketplace'
GROUP BY cat.slug
HAVING COUNT(cp.id) = 0;

-- #3a (3C) globais não-READY (esperado 0)
SELECT COUNT(*) AS not_ready_globals
FROM canonical_products
WHERE scope = 'global'
  AND NOT (
    concept_resolution_status = 'confirmed'
    AND concept_id IS NOT NULL
    AND btrim(name::text) <> ''
    AND category_id IS NOT NULL
  );

-- #3b (3C) contagem globais confirmed (esperado > 0 se seed 3C aplicado)
SELECT COUNT(*) AS ready_global_canonicals
FROM canonical_products
WHERE scope = 'global' AND concept_resolution_status = 'confirmed';

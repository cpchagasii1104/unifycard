-- 20260707160000: guincho e mudança/frete (pergunta Clayton: "onde entraria?")
-- Resposta ontológica: são CONCEPTS de SERVIÇO (mobilidade-e-logistica) — contratáveis
-- pelo motor de demanda (picker deriva da tríade), NÃO domínio novo de marketplace
-- (anti-umbrella). Método tríade (concept + canonical_services global).
BEGIN;
SELECT set_config('app.concept_governance', 'true', true);
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'mobilidade-e-logistica' FROM (VALUES ('guincho'), ('mudanca-e-frete')) AS v(slug)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);
INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.cslug, 'active'
FROM (VALUES ('guincho', 'Guincho', 'guincho'), ('mudanca-e-frete', 'Mudança e frete', 'mudanca-e-frete')) AS v(slug, name, cslug)
JOIN concepts c ON c.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.cslug AND cs.tenant_id IS NULL);
COMMIT;

-- 20260722100000: EVENT-ENGINE-COMPLETION · C1a — concept-oferta GOVERNADO de apresentação musical.
-- Habilita um Actor (banda/artista) a PUBLICAR uma oferta contratável de performance musical REUSANDO o
-- trilho SELADO service_offering: nasce em domain='servicos', com canonical_service global + offer_kind=
-- 'service'. Espelha EXATAMENTE o padrão selado dos service-concepts de evento (20260708350000) e o gate
-- offer_kind='service' (20260708330000). NÃO reinventa shape. NÃO revive cultural_profiles/PAC ghost.
-- Um único concept novo (MVP musical). Idempotente/forward-only. Bank-free (Δbank=0). Statements SEPARADOS.
BEGIN;

-- Habilita o trigger de governança de concept (INSERT direto bloqueado sem isto — ver 0075).
SELECT set_config('app.concept_governance', 'true', true);

-- (1) CONCEPT (domain=servicos). Dedup: só cria se o slug não existir.
INSERT INTO concepts (concept_id, slug, domain)
SELECT gen_random_uuid(), v.slug, 'servicos'
  FROM (VALUES
    ('apresentacao-musical')
  ) v(slug)
 WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- (2) canonical_service global (rótulo pt-BR) — statement SEPARADO (enxerga o concept recém-criado).
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', v.nome, c.slug, 'active', '{}'::jsonb
  FROM (VALUES
    ('apresentacao-musical', 'Apresentação musical')
  ) v(slug, nome)
  JOIN concepts c ON c.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);

-- (3) aplicabilidade offer_kind='service' — só assim entra no picker de serviço/capability/demanda E
-- satisfaz a cadeia SERVICE_OFFERING_REQUIRES_SERVICE (gate 20260708330000).
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'service'
  FROM concepts c
 WHERE c.slug = 'apresentacao-musical'
ON CONFLICT (concept_id, offer_kind) DO NOTHING;

COMMIT;

-- 20260708350000: F-EVENT-ORCHESTRATION-PHASE-B — seed governado dos 4 service concepts de necessidade de
-- evento (RFC ratificado). NÃO reusa genéricos: limpeza-comercial='Limpeza comercial'(estabelecimento) e
-- buffet genérico(ambíguo) foram REJEITADOS por prova semântica; decoracao/fotografia existentes são domínio
-- educacao(ensino). Estes 4 nascem em domain=servicos, com canonical + offer_kind='service'. Dedup por slug.
-- Δbank=0. Forward-only. Statements SEPARADOS (bug de snapshot CTE no seed anterior).
BEGIN;

-- Habilita o trigger de governança de concept (INSERT direto bloqueado sem isto).
SELECT set_config('app.concept_governance', 'true', true);

-- (1) CONCEPTs (domain=servicos). Dedup: só cria se o slug não existir.
INSERT INTO concepts (concept_id, slug, domain)
SELECT gen_random_uuid(), v.slug, 'servicos'
  FROM (VALUES
    ('buffet-para-eventos'),
    ('decoracao-de-eventos'),
    ('fotografia-de-eventos'),
    ('limpeza-de-eventos')
  ) v(slug)
 WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- (2) canonical_service global (rótulo pt-BR) — statement SEPARADO (enxerga os concepts recém-criados).
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', v.nome, c.slug, 'active', '{}'::jsonb
  FROM (VALUES
    ('buffet-para-eventos', 'Buffet para eventos'),
    ('decoracao-de-eventos', 'Decoração de eventos'),
    ('fotografia-de-eventos', 'Fotografia de eventos'),
    ('limpeza-de-eventos', 'Limpeza de eventos')
  ) v(slug, nome)
  JOIN concepts c ON c.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);

-- (3) aplicabilidade offer_kind='service' — só assim entram no picker de serviço/capability/demanda E
-- satisfazem a FK composta dos templates (need é service na v1).
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'service'
  FROM concepts c
 WHERE c.slug IN ('buffet-para-eventos', 'decoracao-de-eventos', 'fotografia-de-eventos', 'limpeza-de-eventos')
ON CONFLICT (concept_id, offer_kind) DO NOTHING;

COMMIT;

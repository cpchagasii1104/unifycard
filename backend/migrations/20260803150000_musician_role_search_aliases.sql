-- 20260803150000_musician_role_search_aliases.sql
-- F-MUSICIAN-ROLES (2ª fatia): os papéis de músico passam a ser ENCONTRÁVEIS no perfil profissional.
--
-- ═══ O ELO QUE FALTAVA ═══
-- A migration 20260803140000 criou 14 papéis (vocalista, baixista, DJ…) como serviço declarável.
-- Mas a busca do perfil profissional NÃO varre `concepts`: ela resolve o termo humano por
-- `service_search_aliases` (professional-c1.service.ts → resolveConceptsFromSearchTerm →
-- semantic.adapter:148 `FROM service_search_aliases`). Sem alias, digitar "baixista" devolveria
-- `[]` — o conceito existiria e a tela juraria que não.
--
-- 🔴 Conceito criado sem alias é conceito INVISÍVEL. Medido antes de escrever isto, não suposto.
--
-- Cada papel ganha o termo canônico + sinônimos que a pessoa REALMENTE digita ("cantor", "tecladista"
-- para quem diz "teclado", "sanfoneiro" para quem diz "acordeonista"). confidence='high' e
-- review_status='approved' porque a correspondência é exata e curada aqui — não é palpite de
-- descoberta automática.
--
-- ⚠️ NÃO cria alias para GÊNERO ("rock", "samba"). Gênero não é capability profissional: vive em
-- shared_subject_concepts e pendura na OFERTA (tagOfferingGenres). Misturar faria "rock" aparecer
-- como profissão declarável — o mesmo tipo de vazamento que o gate F-OFFER-KIND-SERVICE-GATE já
-- barra ("futebol"/"festa" vazavam como capability prestável).

BEGIN;

-- `catalog_version` é NOT NULL e agrupa o alias por lote curado ('beauty-v1', 'cleaning-v1' já
-- existem). Descoberto ao aplicar: a 1ª versão desta migration FALHOU por omiti-lo. Reescrita em vez
-- de sucessora porque a falha significa que ela NUNCA foi aplicada (Lei 2 protege o aplicado, não o
-- que ninguém rodou) — sucessora para desfazer o que não existe seria lixo.
INSERT INTO service_search_aliases (alias_term, normalized_term, concept_id, confidence, review_status, is_active, source, catalog_version)
SELECT v.alias, lower(v.normalized), c.concept_id, 'high', 'approved', true, 'F-MUSICIAN-ROLES', 'music-v1'
  FROM (VALUES
    ('Vocalista',      'vocalista',      'vocalista'),
    ('Cantor',         'cantor',         'vocalista'),
    ('Cantora',        'cantora',        'vocalista'),
    ('Guitarrista',    'guitarrista',    'guitarrista'),
    ('Baixista',       'baixista',       'baixista'),
    ('Contrabaixista', 'contrabaixista', 'baixista'),
    ('Baterista',      'baterista',      'baterista'),
    ('Tecladista',     'tecladista',     'tecladista'),
    ('Pianista',       'pianista',       'tecladista'),
    ('Violonista',     'violonista',     'violonista'),
    ('Percussionista', 'percussionista', 'percussionista'),
    ('Saxofonista',    'saxofonista',    'saxofonista'),
    ('Trompetista',    'trompetista',    'trompetista'),
    ('Trombonista',    'trombonista',    'trombonista'),
    ('Violinista',     'violinista',     'violinista'),
    ('Sanfoneiro',     'sanfoneiro',     'sanfoneiro'),
    ('Acordeonista',   'acordeonista',   'sanfoneiro'),
    ('Cavaquinista',   'cavaquinista',   'cavaquinista'),
    ('DJ',             'dj',             'dj'),
    ('Discotecário',   'discotecario',   'dj')
  ) AS v(alias, normalized, slug)
  JOIN concepts c ON c.slug = v.slug AND c.domain = 'servicos'
 WHERE NOT EXISTS (
   SELECT 1 FROM service_search_aliases a
    WHERE a.normalized_term = lower(v.normalized) AND a.concept_id = c.concept_id
 );

COMMIT;

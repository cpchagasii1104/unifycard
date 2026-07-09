-- 20260708340000: RFC-SHARED-SUBJECT-CONCEPT-POOL (GO Clayton 2026-07-08).
-- Pool canônico NEUTRO de ASSUNTO — compartilhado por TEMA de evento + INTERESSE declarado (+ recomendação
-- futura). Aplicabilidade governada: "este CONCEPT pode ser usado como assunto". NÃO é oferta (não entra em
-- concept_offer_kinds); NÃO define significado (SSOT = concepts.concept_id); categoria/TREE = navegação, não
-- autoridade; canonical_services deixa de ser autoridade de tema/interesse. Espelha event_format_concepts.
-- Δbank=0. Forward-only. Sem tenant/preço/agenda/offer_kind/category-autoridade/texto-livre.
BEGIN;

CREATE TABLE IF NOT EXISTS shared_subject_concepts (
  concept_id  UUID PRIMARY KEY REFERENCES concepts(concept_id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  seed_reason TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed inicial = os 32 shared subjects de F-SHARED-SUBJECT-CONCEPT-SEED (assunto de tema/interesse).
-- Enumeração governada por slug (mesmo padrão do seed de formato/espaço). Formatos (festa/campeonato/show/
-- workshop) e espaços (area-de-churrasco) NÃO entram — têm aplicabilidade própria (event_format_concepts /
-- concept_rentable_types). Idempotente.
INSERT INTO shared_subject_concepts (concept_id, seed_reason)
SELECT c.concept_id, 'bootstrap RFC-SHARED-SUBJECT-CONCEPT-POOL (F-SHARED-SUBJECT-CONCEPT-SEED)'
  FROM concepts c
 WHERE c.slug IN (
    'futebol','sinuca','video-game','kart','corrida','ciclismo','trilha','caminhada','skate',
    'carros-antigos','carros','motos','musica','sertanejo','rock','pagode','samba','funk','hip-hop',
    'teatro','stand-up','danca','churrasco','feijoada','gastronomia','pizza','festa-infantil',
    'casamento','mutirao','beneficente','bairro','voluntariado'
  )
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;

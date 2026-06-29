-- ============================================================
-- 20260629140000: CREATE service_search_aliases — PONTE DE BUSCA termo→concept (advisory)
-- Frente: F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A
-- Carimbo soberano: Clayton ratifica o design pack (Opção A — "Pode mandar"). Instrumento
--   autorizador = martelo soberano + F-SERVICE-SEARCH-ALIAS-DISCOVERY-DESIGN-PACK.
--   Base: docs HEAD 48c624eac · material HEAD f67d64143.
-- ============================================================
-- NATUREZA: camada GLOBAL, ADVISORY, READ-ONLY em runtime. Modelada no padrão DECISION-0104
--   (cnae_concept_suggestions): SINAL/EVIDÊNCIA, NÃO autoridade. Esta tabela é uma PONTE de
--   BUSCA — um termo de ocupação / linguagem comum digitado pelo usuário ("cabeleireiro",
--   "barbeiro", "manicure", "colorista", "escovista") aponta para CONCEPT(s) já existentes e
--   triplo-selados. Multi-candidato por termo (1 termo → N concepts).
--
-- CERCA ELÉTRICA (ratificada por Clayton):
--   · alias AJUDA busca · alias NÃO cria significado · texto digitado NÃO vira concept ·
--   · CONCEPT continua soberano (Lei 7) · publicação gated continua regida por DECISION-0144.
--   O LADO-VALOR é SEMPRE concept_id (FK concepts) → o alias só pode apontar para significado
--   JÁ aprovado; jamais o define. "Alias é ponte de busca, não cartório de nascimento."
--
-- POR QUE NÃO concept_labels (DECISION-0107): label é APRESENTAÇÃO do MESMO concept (1 concept
--   ↔ N nomes), e o COMMENT de 0107 PROÍBE resolver concept POR label. Alias é o oposto: 1 termo
--   EXTERNO → N concepts DISTINTOS, e a sua função É resolver para descoberta. Formas e doutrinas
--   incompatíveis → substrato próprio (não reusar concept_labels nem reviver occupations_reference).
--
-- O QUE NÃO FAZ: NÃO cria concept/canonical_service/categoria · NÃO semeia linhas (seed vem na
--   20260629150000, beleza-only, curado) · NÃO tem tenant_id / NÃO tem RLS (catálogo é global,
--   igual a concepts/canonical_services/categories/concept_labels/cnae_concept_suggestions) ·
--   NÃO toca DECISION-0142/0144 · NÃO toca frontend / dinheiro / oferta / preço / estoque /
--   checkout / order / payment-plan / payout / PORTA-1 / rides / bank_ledger / bank_transactions ·
--   NÃO toca cbo-matcher / RLS de catálogo / telemetria / curadoria runtime.
--
-- NORMA: Lei 2 (forward-only) · Lei 3 (fail-closed nos consumidores) · Lei 7 (concept = SSOT).
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS + índices IF NOT EXISTS. Re-execução = no-op seguro.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS service_search_aliases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- termo de ORIGEM/auditoria (como foi curado); apresentação, não chave de busca.
  alias_term       TEXT NOT NULL,
  -- termo NORMALIZADO (lower, sem acento, kebab) — a CHAVE de lookup em runtime.
  normalized_term  TEXT NOT NULL,
  -- LADO-VALOR soberano: concept JÁ existente. FK garante que o alias nunca aponta para o vazio.
  concept_id       UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  confidence       TEXT NOT NULL DEFAULT 'medium',
  review_status    TEXT NOT NULL DEFAULT 'proposed',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  source           TEXT NOT NULL,
  catalog_version  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_ssa_alias_term       CHECK (length(btrim(alias_term)) > 0),
  CONSTRAINT chk_ssa_normalized_term  CHECK (length(btrim(normalized_term)) > 0),
  CONSTRAINT chk_ssa_source           CHECK (length(btrim(source)) > 0),
  CONSTRAINT chk_ssa_catalog_version  CHECK (length(btrim(catalog_version)) > 0),
  -- confiança/prioridade (curadoria define; consumidor pode ordenar/ranquear).
  CONSTRAINT chk_ssa_confidence       CHECK (confidence IN ('low','medium','high')),
  -- curadoria humana: só 'approved' é servida em runtime (mapping não revisado não vira ponte forte).
  CONSTRAINT chk_ssa_review_status    CHECK (review_status IN ('proposed','approved','retired')),

  -- N concepts por termo, mas sem duplicar o MESMO par (termo normalizado, concept).
  CONSTRAINT uq_ssa_term_concept UNIQUE (normalized_term, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_service_search_aliases_normalized_term
  ON service_search_aliases (normalized_term);

CREATE INDEX IF NOT EXISTS idx_service_search_aliases_concept
  ON service_search_aliases (concept_id);

-- Caminho quente da descoberta: termo → concepts vivos e curados.
CREATE INDEX IF NOT EXISTS idx_ssa_active_approved
  ON service_search_aliases (normalized_term)
  WHERE is_active = true AND review_status = 'approved';

COMMENT ON TABLE service_search_aliases IS
  'Ponte de BUSCA termo→CONCEPT (F-SERVICE-SEARCH-ALIAS-DISCOVERY, padrão DECISION-0104). ADVISORY '
  'e READ-ONLY em runtime: um termo de ocupação/linguagem comum aponta para concept(s) JÁ existentes. '
  'NÃO é SSOT semântico (CONCEPT é, Lei 7); NÃO cria significado; texto digitado NUNCA vira concept. '
  'Lado-valor é sempre concept_id (FK). Multi-candidato por termo. Seed é curado/migration-only e '
  'SELETIVO (beleza-only na Slice-A). NÃO reusa concept_labels (apresentação) nem occupations_reference '
  '(arquivado/morto). Publicação gated permanece regida por DECISION-0144 — descobrir ≠ poder publicar.';
COMMENT ON COLUMN service_search_aliases.normalized_term IS
  'Termo normalizado (lower, sem acento, kebab) — CHAVE de lookup. O runtime normaliza o input do '
  'usuário do mesmo modo e faz SELECT; NUNCA INSERT (escrita é migration/curadoria-only).';
COMMENT ON COLUMN service_search_aliases.concept_id IS
  'CONCEPT alvo (FK concepts). É PONTE de busca, nunca autoridade semântica: o alias aponta para '
  'significado já aprovado, jamais o define.';
COMMENT ON COLUMN service_search_aliases.review_status IS
  'Curadoria humana (proposed|approved|retired). Só approved+is_active é servido em runtime.';

COMMIT;

-- ============================================================
-- F-PJ-CONCEPT-LABELS-SCHEMA-MIGRATION (DECISION-0107)
-- Camada GLOBAL de APRESENTAÇÃO governada para o nome legível de CONCEPT.
-- ------------------------------------------------------------
-- O display name de concept mora AQUI (D4), NÃO em `concepts` (que fica seco: concept_id/slug/domain).
-- Label é APRESENTAÇÃO, NÃO identidade (D1): proibido resolver concept POR label / usar label em
-- WHERE/JOIN de identidade; `concept_id`/`slug` seguem como chave material/SSOT semântico. Read-model
-- governado, localizável (locale/context_key) — aterra `18_DOMAIN_ONTOLOGY §5.2.2` (display_names
-- LocalizedName[]). SEM tenant_id (apresentação é global). SEM i18n runtime nesta fatia (só a coluna
-- locale preparada). SEM seed (D12 — labels vêm em fatia própria). SEM endpoint/frontend.
-- Forward-only / transacional / idempotente. NÃO altera `concepts` (não ganha display_name).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS concept_labels (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id   UUID NOT NULL REFERENCES concepts(concept_id),
  locale       TEXT NOT NULL DEFAULT 'pt-BR',
  context_key  TEXT NOT NULL DEFAULT 'default',
  label        TEXT NOT NULL,
  short_label  TEXT NULL,
  is_primary   BOOLEAN NOT NULL DEFAULT true,
  source       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_cl_locale       CHECK (length(btrim(locale)) > 0),
  CONSTRAINT chk_cl_context_key  CHECK (length(btrim(context_key)) > 0),
  CONSTRAINT chk_cl_label        CHECK (length(btrim(label)) > 0),
  CONSTRAINT chk_cl_source       CHECK (length(btrim(source)) > 0)
);

-- D6: no máximo UMA label PRIMÁRIA por (concept_id, locale, context_key).
-- Labels NÃO-primárias (is_primary=false) podem ser múltiplas (sinônimos/aliases de apresentação).
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_labels_one_primary
  ON concept_labels (concept_id, locale, context_key)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_concept_labels_concept
  ON concept_labels (concept_id);

CREATE INDEX IF NOT EXISTS idx_concept_labels_locale_context
  ON concept_labels (locale, context_key);

COMMENT ON TABLE concept_labels IS
  'Apresentação governada (display name) de CONCEPT (DECISION-0107). Camada GLOBAL, localizável '
  '(locale/context_key). Label NÃO é identidade: proibido resolver concept por label ou usar label em '
  'WHERE/JOIN de identidade; concept_id/slug seguem SSOT. concepts NÃO ganha display_name. Read-model — '
  'exposição por JOIN nos endpoints (fallback honesto: sem label → null → frontend mostra slug).';
COMMENT ON COLUMN concept_labels.is_primary IS
  'Label primária do (concept_id, locale, context_key) — no máx. 1 (uq_concept_labels_one_primary). Demais = alternativas.';
COMMENT ON COLUMN concept_labels.source IS
  'Origem da label (ex.: curadoria/seed). Obrigatório (auditabilidade).';

COMMIT;

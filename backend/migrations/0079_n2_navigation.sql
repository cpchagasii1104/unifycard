-- ============================================================
-- 0079: N2 + CONTEXT navegação (norma 20_N2_NAVIGATION_STRUCTURE_UNIFICARD v4.0.4)
-- ============================================================
-- FK N1 = n1_nodes(n1_id); N0 opcional = domains(domain_key).
-- Escrita: triggers exigem app.n2_governance = true (n2-governance.service).
-- Bootstrap: seed nesta migration antes dos triggers (igual 0078).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE n2_nodes (
  n2_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL,
  n1_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_n2_n1
    FOREIGN KEY (n1_id)
    REFERENCES n1_nodes (n1_id)
    ON DELETE CASCADE,
  CONSTRAINT n2_unique_per_n1 UNIQUE (slug, n1_id)
);

CREATE INDEX idx_n2_n1 ON n2_nodes (n1_id);
CREATE INDEX idx_n2_active ON n2_nodes (is_active);
CREATE INDEX idx_n2_slug ON n2_nodes (slug);

CREATE TABLE context_nodes (
  context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_slug VARCHAR(64) NOT NULL UNIQUE,
  domain_key TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_context_domain
    FOREIGN KEY (domain_key)
    REFERENCES domains (domain_key)
    ON DELETE RESTRICT
);

CREATE INDEX idx_context_nodes_slug ON context_nodes (context_slug);

CREATE TABLE context_localized_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  value VARCHAR(128) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT fk_context_loc_context
    FOREIGN KEY (context_id)
    REFERENCES context_nodes (context_id)
    ON DELETE CASCADE,
  CONSTRAINT context_locale_priority_unique UNIQUE (context_id, locale, priority)
);

CREATE TABLE context_n2_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL,
  n2_id UUID NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_ctx_n2_context
    FOREIGN KEY (context_id)
    REFERENCES context_nodes (context_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ctx_n2_n2
    FOREIGN KEY (n2_id)
    REFERENCES n2_nodes (n2_id)
    ON DELETE CASCADE,
  CONSTRAINT unique_context_n2 UNIQUE (context_id, n2_id)
);

CREATE INDEX idx_context_mapping_context ON context_n2_mapping (context_id);
CREATE INDEX idx_context_mapping_n2 ON context_n2_mapping (n2_id);

CREATE TABLE n2_localized_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  n2_id UUID NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  value VARCHAR(128) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT fk_n2_loc_n2
    FOREIGN KEY (n2_id)
    REFERENCES n2_nodes (n2_id)
    ON DELETE CASCADE,
  CONSTRAINT n2_locale_priority_unique UNIQUE (n2_id, locale, priority)
);

DROP TRIGGER IF EXISTS trg_n2_nodes_updated_at ON n2_nodes;
CREATE TRIGGER trg_n2_nodes_updated_at
  BEFORE UPDATE ON n2_nodes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_context_nodes_updated_at ON context_nodes;
CREATE TRIGGER trg_context_nodes_updated_at
  BEFORE UPDATE ON context_nodes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE n2_nodes IS
  'N2 — navegação LAYER 2; não é CONCEPT nem SSOT semântico.';
COMMENT ON TABLE context_nodes IS
  'CONTEXT — identidade formal governada; não é string livre.';
COMMENT ON TABLE context_n2_mapping IS
  'Ativação: qual N2 é válido em qual contexto (navegação, não regra de negócio).';

-- ---------------------------------------------------------------------------
-- Seed: contextos (doc 10.4) + N2 alimentação (supermercado + delivery)
-- ---------------------------------------------------------------------------

INSERT INTO context_nodes (context_slug, domain_key)
VALUES
  ('supermercado', NULL),
  ('delivery', NULL),
  ('nutricao', NULL),
  ('varejo', NULL),
  ('bar', NULL),
  ('perfumaria', NULL),
  ('farmacia', NULL),
  ('moda', NULL),
  ('casa', NULL),
  ('eletronicos', NULL),
  ('loja-material', NULL),
  ('reforma-casa', NULL),
  ('veiculos', NULL),
  ('autopecas', NULL),
  ('esportes', NULL),
  ('app-servicos', NULL),
  ('consultoria', NULL),
  ('tecnicos', NULL),
  ('salao', NULL),
  ('spa', NULL),
  ('corporativo', NULL),
  ('edtech', NULL),
  ('eventos', NULL),
  ('tech', NULL),
  ('mercado-financeiro', NULL);

INSERT INTO context_localized_names (context_id, locale, value, priority)
SELECT c.context_id, 'pt-BR', initcap(replace(c.context_slug, '-', ' ')), 1
FROM context_nodes c;

-- N2: supermercado (6)
INSERT INTO n2_nodes (slug, n1_id, sort_order)
SELECT v.slug, n.n1_id, v.ord
FROM n1_nodes n
CROSS JOIN (
  VALUES
    ('acougue', 1),
    ('hortifruti', 2),
    ('laticinios-e-frios', 3),
    ('mercearia', 4),
    ('padaria-e-confeitaria', 5),
    ('congelados-e-resfriados', 6)
) AS v(slug, ord)
WHERE n.slug = 'alimentacao'
  AND n.domain_key = 'produtos-e-comercio';

-- N2: delivery (6)
INSERT INTO n2_nodes (slug, n1_id, sort_order)
SELECT v.slug, n.n1_id, v.ord
FROM n1_nodes n
CROSS JOIN (
  VALUES
    ('japonesa', 1),
    ('pizza', 2),
    ('hamburguer', 3),
    ('brasileira', 4),
    ('saudavel', 5),
    ('doces-e-sobremesas', 6)
) AS v(slug, ord)
WHERE n.slug = 'alimentacao'
  AND n.domain_key = 'produtos-e-comercio';

INSERT INTO n2_localized_names (n2_id, locale, value, priority)
SELECT n2.n2_id, 'pt-BR', initcap(replace(n2.slug, '-', ' ')), 1
FROM n2_nodes n2
JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
WHERE n1.slug = 'alimentacao'
  AND n1.domain_key = 'produtos-e-comercio';

INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
SELECT
  (SELECT context_id FROM context_nodes WHERE context_slug = 'supermercado'),
  n2.n2_id,
  true,
  n2.sort_order
FROM n2_nodes n2
JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
WHERE n1.slug = 'alimentacao'
  AND n1.domain_key = 'produtos-e-comercio'
  AND n2.slug IN (
    'acougue',
    'hortifruti',
    'laticinios-e-frios',
    'mercearia',
    'padaria-e-confeitaria',
    'congelados-e-resfriados'
  );

INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
SELECT
  (SELECT context_id FROM context_nodes WHERE context_slug = 'delivery'),
  n2.n2_id,
  true,
  n2.sort_order
FROM n2_nodes n2
JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
WHERE n1.slug = 'alimentacao'
  AND n1.domain_key = 'produtos-e-comercio'
  AND n2.slug IN (
    'japonesa',
    'pizza',
    'hamburguer',
    'brasileira',
    'saudavel',
    'doces-e-sobremesas'
  );

-- ---------------------------------------------------------------------------
-- Governança: escrita só com app.n2_governance = true
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_n2_tree_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.n2_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'n2 tree write blocked: use n2-governance.service (set app.n2_governance in authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_n2_nodes_governance ON n2_nodes;
CREATE TRIGGER trg_n2_nodes_governance
  BEFORE INSERT OR UPDATE ON n2_nodes
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_nodes_governance ON context_nodes;
CREATE TRIGGER trg_context_nodes_governance
  BEFORE INSERT OR UPDATE ON context_nodes
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_n2_mapping_governance ON context_n2_mapping;
CREATE TRIGGER trg_context_n2_mapping_governance
  BEFORE INSERT OR UPDATE ON context_n2_mapping
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_context_localized_governance ON context_localized_names;
CREATE TRIGGER trg_context_localized_governance
  BEFORE INSERT OR UPDATE ON context_localized_names
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

DROP TRIGGER IF EXISTS trg_n2_localized_governance ON n2_localized_names;
CREATE TRIGGER trg_n2_localized_governance
  BEFORE INSERT OR UPDATE ON n2_localized_names
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n2_tree_governance();

COMMENT ON FUNCTION enforce_n2_tree_governance() IS
  'Bloqueia INSERT/UPDATE diretos em tabelas N2/CONTEXT; exige app.n2_governance = true.';

COMMIT;

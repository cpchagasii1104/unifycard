-- ============================================================
-- 0078: N1 navegação (norma 19_N1_NAVIGATION_STRUCTURE_UNIFICARD)
-- ============================================================
-- N1 = filtro de navegação (LAYER 2); não entra em GRAPH nem CONCEPT.
-- FK N0 = domains.domain_key (TEXT), alinhado a 0073_domains_n0.sql.
-- Bootstrap: seed nesta migration; depois só n1-governance.service (+ flag).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE n1_nodes (
  n1_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) NOT NULL,
  domain_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_n1_domain
    FOREIGN KEY (domain_key)
    REFERENCES domains (domain_key)
    ON DELETE RESTRICT,
  CONSTRAINT unique_n1_slug_per_domain
    UNIQUE (slug, domain_key)
);

CREATE INDEX idx_n1_nodes_domain_sort ON n1_nodes (domain_key, sort_order);

CREATE TABLE n1_localized_names (
  n1_id UUID NOT NULL,
  locale VARCHAR(10) NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (n1_id, locale),
  CONSTRAINT fk_n1_localized
    FOREIGN KEY (n1_id)
    REFERENCES n1_nodes (n1_id)
    ON DELETE CASCADE
);

CREATE TABLE category_n1_mapping (
  category_id UUID NOT NULL,
  n1_id UUID NOT NULL,
  PRIMARY KEY (category_id),
  CONSTRAINT fk_category_n1_category
    FOREIGN KEY (category_id)
    REFERENCES categories (category_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_category_n1_n1
    FOREIGN KEY (n1_id)
    REFERENCES n1_nodes (n1_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_category_n1_mapping_n1 ON category_n1_mapping (n1_id);

DROP TRIGGER IF EXISTS trg_n1_nodes_updated_at ON n1_nodes;
CREATE TRIGGER trg_n1_nodes_updated_at
  BEFORE UPDATE ON n1_nodes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: 30 N1 (doc 19) + pt-BR
-- ---------------------------------------------------------------------------

INSERT INTO n1_nodes (slug, domain_key, sort_order)
VALUES
  ('alimentacao', 'produtos-e-comercio', 1),
  ('bebidas', 'produtos-e-comercio', 2),
  ('higiene-e-beleza', 'produtos-e-comercio', 3),
  ('vestuario-e-acessorios', 'produtos-e-comercio', 4),
  ('casa-e-decoracao', 'produtos-e-comercio', 5),
  ('eletroeletronicos', 'produtos-e-comercio', 6),
  ('materiais-de-construcao', 'produtos-e-comercio', 7),
  ('veiculos', 'produtos-e-comercio', 8),
  ('pecas-e-acessorios-automotivos', 'produtos-e-comercio', 9),
  ('produtos-para-animais', 'produtos-e-comercio', 10),
  ('papelaria', 'produtos-e-comercio', 11),
  ('mobiliario-e-equipamentos-de-escritorio', 'produtos-e-comercio', 12),
  ('equipamentos-esportivos', 'produtos-e-comercio', 13),
  ('manutencao-e-reformas', 'servicos', 1),
  ('servicos-domesticos', 'servicos', 2),
  ('consultoria-e-assessoria', 'servicos', 3),
  ('servicos-tecnicos-especializados', 'servicos', 4),
  ('estetica-e-cuidados-pessoais', 'servicos', 5),
  ('treinamento-corporativo', 'servicos', 6),
  ('capacitacao-e-treinamentos', 'servicos', 7),
  ('producao-e-realizacao-de-eventos', 'servicos', 8),
  ('servicos-de-tecnologia', 'servicos', 9),
  ('marketing-e-comunicacao', 'servicos', 10),
  ('pagamentos-e-transferencias', 'financas-e-economia', 1),
  ('creditos-e-emprestimos', 'financas-e-economia', 2),
  ('investimentos-renda-fixa', 'financas-e-economia', 3),
  ('investimentos-renda-variavel', 'financas-e-economia', 4),
  ('seguros-e-previdencia', 'financas-e-economia', 5),
  ('cambio-e-moedas', 'financas-e-economia', 6),
  ('contas-e-relacionamento', 'financas-e-economia', 7);

INSERT INTO n1_localized_names (n1_id, locale, display_name)
SELECT n.n1_id, 'pt-BR', v.display_name
FROM (VALUES
  ('alimentacao', 'produtos-e-comercio', 'Alimentação'),
  ('bebidas', 'produtos-e-comercio', 'Bebidas'),
  ('higiene-e-beleza', 'produtos-e-comercio', 'Higiene e beleza'),
  ('vestuario-e-acessorios', 'produtos-e-comercio', 'Vestuário e acessórios'),
  ('casa-e-decoracao', 'produtos-e-comercio', 'Casa e decoração'),
  ('eletroeletronicos', 'produtos-e-comercio', 'Eletroeletrônicos'),
  ('materiais-de-construcao', 'produtos-e-comercio', 'Materiais de construção'),
  ('veiculos', 'produtos-e-comercio', 'Veículos'),
  ('pecas-e-acessorios-automotivos', 'produtos-e-comercio', 'Peças e acessórios automotivos'),
  ('produtos-para-animais', 'produtos-e-comercio', 'Produtos para animais'),
  ('papelaria', 'produtos-e-comercio', 'Papelaria'),
  ('mobiliario-e-equipamentos-de-escritorio', 'produtos-e-comercio', 'Mobiliário e equipamentos de escritório'),
  ('equipamentos-esportivos', 'produtos-e-comercio', 'Equipamentos esportivos'),
  ('manutencao-e-reformas', 'servicos', 'Manutenção e reformas'),
  ('servicos-domesticos', 'servicos', 'Serviços domésticos'),
  ('consultoria-e-assessoria', 'servicos', 'Consultoria e assessoria'),
  ('servicos-tecnicos-especializados', 'servicos', 'Serviços técnicos especializados'),
  ('estetica-e-cuidados-pessoais', 'servicos', 'Estética e cuidados pessoais'),
  ('treinamento-corporativo', 'servicos', 'Treinamento corporativo'),
  ('capacitacao-e-treinamentos', 'servicos', 'Capacitação e treinamentos'),
  ('producao-e-realizacao-de-eventos', 'servicos', 'Produção e realização de eventos'),
  ('servicos-de-tecnologia', 'servicos', 'Serviços de tecnologia'),
  ('marketing-e-comunicacao', 'servicos', 'Marketing e comunicação'),
  ('pagamentos-e-transferencias', 'financas-e-economia', 'Pagamentos e transferências'),
  ('creditos-e-emprestimos', 'financas-e-economia', 'Créditos e empréstimos'),
  ('investimentos-renda-fixa', 'financas-e-economia', 'Investimentos renda fixa'),
  ('investimentos-renda-variavel', 'financas-e-economia', 'Investimentos renda variável'),
  ('seguros-e-previdencia', 'financas-e-economia', 'Seguros e previdência'),
  ('cambio-e-moedas', 'financas-e-economia', 'Câmbio e moedas'),
  ('contas-e-relacionamento', 'financas-e-economia', 'Contas e relacionamento')
) AS v(slug, domain_key, display_name)
JOIN n1_nodes n ON n.slug = v.slug AND n.domain_key = v.domain_key;

COMMENT ON TABLE n1_nodes IS
  'N1 — navegação LAYER 2 por N0 (domain_key). Não é CONCEPT nem GRAPH.';
COMMENT ON TABLE n1_localized_names IS
  'Nomes localizados para nós N1.';
COMMENT ON TABLE category_n1_mapping IS
  '1 categoria → 1 N1 (navegação). Resolução: N1 → categories → concept_id → graph.';

-- ---------------------------------------------------------------------------
-- Governança: escrita só com app.n1_governance = true
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_n1_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.n1_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'n1 write blocked: use n1-governance.service (set app.n1_governance in authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_n1_governance_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.n1_governance', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'n1 mapping delete blocked: use n1-governance.service (set app.n1_governance in authorized transaction)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_n1_nodes_governance ON n1_nodes;
CREATE TRIGGER trg_n1_nodes_governance
  BEFORE INSERT OR UPDATE ON n1_nodes
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n1_governance();

DROP TRIGGER IF EXISTS trg_n1_localized_governance ON n1_localized_names;
CREATE TRIGGER trg_n1_localized_governance
  BEFORE INSERT OR UPDATE ON n1_localized_names
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n1_governance();

DROP TRIGGER IF EXISTS trg_category_n1_mapping_governance ON category_n1_mapping;
CREATE TRIGGER trg_category_n1_mapping_governance
  BEFORE INSERT OR UPDATE ON category_n1_mapping
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n1_governance();

DROP TRIGGER IF EXISTS trg_category_n1_mapping_governance_del ON category_n1_mapping;
CREATE TRIGGER trg_category_n1_mapping_governance_del
  BEFORE DELETE ON category_n1_mapping
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_n1_governance_delete();

COMMENT ON FUNCTION enforce_n1_governance() IS
  'Bloqueia INSERT/UPDATE diretos em n1_nodes, n1_localized_names, category_n1_mapping; exige app.n1_governance = true.';

COMMIT;

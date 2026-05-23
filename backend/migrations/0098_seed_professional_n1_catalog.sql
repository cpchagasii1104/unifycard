-- ============================================================
-- 0098: N0 "profissoes" + N1 operacionais (taxonomia_ocupacoes_v2)
-- ============================================================
-- Contexto: bootstrap 0094 criou apenas saude > medicina > 3 N2.
-- O seed via create_category_from_concept (0097) exige parent N1
-- (scope=professional, level=1) por slug. Esta migration adiciona um
-- segundo ramo N0 e os N1 alinhados ao parent_n1 da taxonomia (exceto
-- medicina, já existente sob saude).
--
-- Contrato de path: apenas ancestrais; array_length(path,1) = level
-- (igual 0096).
--
-- Idempotente: ON CONFLICT (slug) DO UPDATE promove/ajusta linha existente.
-- ============================================================

BEGIN;

-- N0: raiz para N1 fora de "Saúde"
INSERT INTO categories (
  parent_id,
  name,
  slug,
  description,
  level,
  path,
  scope,
  status,
  is_active
)
VALUES (
  NULL,
  'Áreas profissionais',
  'profissoes',
  'Catálogo amplo de ocupações (N1 operacionais)',
  0,
  ARRAY['profissoes']::text[],
  'professional',
  'active',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  level = EXCLUDED.level,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- N1 sob profissoes (slugs = taxonomia MD / dataset validado)
INSERT INTO categories (
  parent_id,
  name,
  slug,
  description,
  level,
  path,
  scope,
  status,
  is_active
)
SELECT
  p.category_id,
  v.name,
  v.slug,
  v.description,
  1,
  ARRAY['profissoes']::text[],
  'professional',
  'active',
  true
FROM categories p
CROSS JOIN (
  VALUES
    ('agronegocio-rural', 'Agronegócio & Rural', 'Ocupações do agronegócio e meio rural'),
    ('automotivo-mecanica', 'Automotivo & Mecânica', 'Veículos e mecânica automotiva'),
    ('ciencias-pesquisa', 'Ciências & Pesquisa', 'Pesquisa científica e laboratório'),
    ('construcao-imoveis', 'Construção & Imóveis', 'Construção civil e mercado imobiliário'),
    ('criativo-design', 'Criativo & Design', 'Design, audiovisual e artes aplicadas'),
    ('direito', 'Direito', 'Advocacia e serviços jurídicos'),
    ('educacao', 'Educação', 'Ensino e formação'),
    ('financas-contabilidade', 'Finanças & Contabilidade', 'Finanças, contabilidade e fiscal'),
    ('gastronomia', 'Gastronomia', 'Alimentação e hotelaria de cozinha'),
    ('industria-manufatura', 'Indústria & Manufatura', 'Produção e manufatura'),
    ('marketing-comunicacao', 'Marketing & Comunicação', 'Marketing, mídia e comunicação'),
    ('operacoes-logistica', 'Operações & Logística', 'Logística, supply chain e operações'),
    ('rh-gestao-pessoas', 'RH & Gestão de Pessoas', 'Recursos humanos e desenvolvimento organizacional'),
    ('seguranca-defesa', 'Segurança & Defesa', 'Segurança patrimonial e defesa'),
    ('tecnologia', 'Tecnologia & TI', 'Tecnologia da informação'),
    ('turismo-hospitalidade', 'Turismo & Hospitalidade', 'Turismo, eventos e hospitalidade'),
    ('vendas-atendimento', 'Vendas & Atendimento', 'Comercial, vendas e atendimento')
) AS v(slug, name, description)
WHERE p.slug = 'profissoes'
  AND p.scope = 'professional'
  AND p.level = 0
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  level = EXCLUDED.level,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

COMMIT;

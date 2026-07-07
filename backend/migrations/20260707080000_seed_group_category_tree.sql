-- 20260707080000: Árvore de categorias de GRUPO (scope='group') — definida por Clayton 2026-07-07
-- ("já vamos definir isso hoje"; exemplos dele: animais de rua, moradores de rua, churrasco,
-- kart, arrancadas/carros, society, tênis, corrida de rua, viagens, rapel, esporte, lazer, paquera).
-- Árvore ÚNICA (§13), level 1, approved; direcionamento específico SOB o propósito (0163).
-- Idempotente por slug. Extensão futura = migration governada, nunca texto livre.
BEGIN;
INSERT INTO categories (name, slug, description, level, scope, status, is_active)
SELECT v.name, v.slug, v.descr, 1, 'group', 'approved', true
FROM (VALUES
  ('Animais de rua',            'grupo-animais-de-rua',        'Resgate e cuidado de animais'),
  ('Moradores de rua',          'grupo-moradores-de-rua',      'Apoio à população de rua'),
  ('Pessoas com deficiência',   'grupo-pcd',                   'Apoio e inclusão PcD'),
  ('Doações e campanhas',       'grupo-doacoes-campanhas',     'Arrecadações e campanhas'),
  ('Futebol e society',         'grupo-futebol-society',       'Peladas, times e campos'),
  ('Corrida de rua',            'grupo-corrida-de-rua',        'Assessorias e provas'),
  ('Tênis e raquetes',          'grupo-tenis-raquetes',        'Tênis, padel, beach tennis'),
  ('Ciclismo e pedal',          'grupo-ciclismo-pedal',        'Grupos de pedal'),
  ('Lutas e artes marciais',    'grupo-lutas-artes-marciais',  'Academias e treinos'),
  ('Kart e corrida',            'grupo-kart-corrida',          'Kart e campeonatos'),
  ('Arrancadas e carros',       'grupo-arrancadas-carros',     'Arrancadas, encontros automotivos'),
  ('Carros antigos',            'grupo-carros-antigos',        'Colecionadores e exposições'),
  ('Motoclube',                 'grupo-motoclube',             'Motociclismo e rolês'),
  ('Churrasco e gastronomia',   'grupo-churrasco-gastronomia', 'Churrascos e confrarias'),
  ('Bar e boteco',              'grupo-bar-boteco',            'Encontros de bar'),
  ('Festas e baladas',          'grupo-festas-baladas',        'Festas e vida noturna'),
  ('Viagens e excursões',       'grupo-viagens-excursoes',     'Viagens em grupo'),
  ('Trilhas, rapel e aventura', 'grupo-trilhas-rapel-aventura','Ecoturismo e aventura'),
  ('Camping e pesca',           'grupo-camping-pesca',         'Camping e pescarias'),
  ('Vizinhança e condomínio',   'grupo-vizinhanca-condominio', 'Bairro e condomínio'),
  ('Torcida organizada',        'grupo-torcida-organizada',    'Torcidas e fandom'),
  ('Igreja e fé',               'grupo-igreja-fe',             'Comunidades de fé'),
  ('Estudos e idiomas',         'grupo-estudos-idiomas',       'Grupos de estudo'),
  ('Games e e-sports',          'grupo-games-esports',         'Games e campeonatos digitais'),
  ('Paquera e encontros',       'grupo-paquera-encontros',     'Encontros e relacionamentos')
) AS v(name, slug, descr)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug AND c.scope = 'group');
COMMIT;

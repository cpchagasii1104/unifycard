-- 20260707110000: mapa GOVERNADO propósito→categoria (achado Clayton: "fé mostrando festa vira bagunça")
-- Cada categoria de grupo carrega metadata.group_purposes (⊆ GROUP_PURPOSES/0163);
-- o wizard FILTRA a projeção por propósito selecionado. Festa junina da igreja = EVENTO do grupo.
BEGIN;
UPDATE categories SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('group_purposes', to_jsonb(v.p))
FROM (VALUES
  ('grupo-animais-de-rua',        ARRAY['cuidado_e_impacto']),
  ('grupo-moradores-de-rua',      ARRAY['cuidado_e_impacto']),
  ('grupo-pcd',                   ARRAY['cuidado_e_impacto']),
  ('grupo-doacoes-campanhas',     ARRAY['cuidado_e_impacto','ajuda_mutua_e_cooperacao']),
  ('grupo-futebol-society',       ARRAY['interesse_e_hobby']),
  ('grupo-corrida-de-rua',        ARRAY['interesse_e_hobby']),
  ('grupo-tenis-raquetes',        ARRAY['interesse_e_hobby']),
  ('grupo-ciclismo-pedal',        ARRAY['interesse_e_hobby']),
  ('grupo-lutas-artes-marciais',  ARRAY['interesse_e_hobby']),
  ('grupo-kart-corrida',          ARRAY['interesse_e_hobby']),
  ('grupo-arrancadas-carros',     ARRAY['interesse_e_hobby']),
  ('grupo-carros-antigos',        ARRAY['interesse_e_hobby']),
  ('grupo-motoclube',             ARRAY['comunidade_e_pertencimento','interesse_e_hobby']),
  ('grupo-churrasco-gastronomia', ARRAY['comunidade_e_pertencimento','interesse_e_hobby']),
  ('grupo-bar-boteco',            ARRAY['comunidade_e_pertencimento']),
  ('grupo-festas-baladas',        ARRAY['encontros_e_relacionamentos']),
  ('grupo-viagens-excursoes',     ARRAY['interesse_e_hobby']),
  ('grupo-trilhas-rapel-aventura',ARRAY['interesse_e_hobby']),
  ('grupo-camping-pesca',         ARRAY['interesse_e_hobby']),
  ('grupo-vizinhanca-condominio', ARRAY['comunidade_e_pertencimento','ajuda_mutua_e_cooperacao']),
  ('grupo-torcida-organizada',    ARRAY['comunidade_e_pertencimento']),
  ('grupo-igreja-fe',             ARRAY['fe_e_espiritualidade']),
  ('grupo-estudos-idiomas',       ARRAY['aprendizado']),
  ('grupo-games-esports',         ARRAY['interesse_e_hobby']),
  ('grupo-paquera-encontros',     ARRAY['encontros_e_relacionamentos']),
  ('grupo-comunidade',            ARRAY['comunidade_e_pertencimento','ajuda_mutua_e_cooperacao'])
) AS v(slug, p)
WHERE categories.slug = v.slug AND categories.scope = 'group';
COMMIT;

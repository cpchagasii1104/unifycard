-- ============================================================
-- F3-S5 — Seed estrutural Brasil mínimo soberano (v2 — corrigido)
-- ============================================================
-- Remete a: DECISION-0020 (REMEDIATION_DECISIONS_LOG.md)
-- Frente: F3 — Domain Foundations: Location Core Materialization
--
-- Alteração v2 (2026-05-08, pós-auditoria ChatGPT):
--   Subqueries de cities agora filtram por abbreviation AND country_id.
--   Motivo: semântica correta — sigla UF não é globalmente única.
--   "WHERE abbreviation = 'PR'" implica unicidade global (falso).
--   "WHERE abbreviation = 'PR' AND country_id = (...)" é ontologicamente
--   correto e prepara multi-país sem reescrever seed.
--   Custo da correção agora = zero (banco ainda vazio).
--
-- Escopo desta migration:
--   1. 1 país: Brasil (BR)
--   2. 27 estados (UFs) com ISO 3166-2, sigla, código IBGE
--   3. 27 capitais com código IBGE e lat/lng
--
-- Fora de escopo (decisão explícita de rollout incremental):
--   - neighborhoods: tabela existe, seed NÃO popula
--   - cidades não-capitais: expansão lazy quando módulos integrarem
--   - outros países: Brasil-first incremental
--   - enrichment automático: ZERO fetch online, ZERO API, ZERO CSV remoto
--
-- INSERT PURO (sem ON CONFLICT):
--   Seed fundacional não é sync incremental. Se duplicar = erro,
--   investigação, correção consciente.
--
-- Depende de: F3-S4 (tabelas), F3-S4b (constraint abbreviation unique).
-- Forward-only. Determinístico, offline, auditável, versionado.
-- Fontes: IBGE, ISO 3166-2:BR, Wikipedia (lat/lng capitais).
-- ============================================================

BEGIN;

-- ============================================================
-- PAÍS: Brasil
-- ============================================================

INSERT INTO countries (
  iso_alpha2, iso_alpha3, name, name_localized,
  phone_code, currency_code, timezone_default, is_active
) VALUES (
  'BR', 'BRA', 'Brasil',
  '{"en": "Brazil", "es": "Brasil", "fr": "Brésil", "de": "Brasilien"}'::jsonb,
  '+55', 'BRL', 'America/Sao_Paulo', TRUE
);

-- ============================================================
-- ESTADOS: 27 UFs
-- ============================================================

INSERT INTO states (country_id, iso_3166_2, external_code, name, abbreviation) VALUES
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-AC', '12', 'Acre', 'AC'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-AL', '27', 'Alagoas', 'AL'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-AP', '16', 'Amapá', 'AP'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-AM', '13', 'Amazonas', 'AM'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-BA', '29', 'Bahia', 'BA'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-CE', '23', 'Ceará', 'CE'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-DF', '53', 'Distrito Federal', 'DF'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-ES', '32', 'Espírito Santo', 'ES'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-GO', '52', 'Goiás', 'GO'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-MA', '21', 'Maranhão', 'MA'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-MT', '51', 'Mato Grosso', 'MT'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-MS', '50', 'Mato Grosso do Sul', 'MS'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-MG', '31', 'Minas Gerais', 'MG'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-PA', '15', 'Pará', 'PA'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-PB', '25', 'Paraíba', 'PB'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-PR', '41', 'Paraná', 'PR'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-PE', '26', 'Pernambuco', 'PE'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-PI', '22', 'Piauí', 'PI'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-RJ', '33', 'Rio de Janeiro', 'RJ'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-RN', '24', 'Rio Grande do Norte', 'RN'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-RS', '43', 'Rio Grande do Sul', 'RS'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-RO', '11', 'Rondônia', 'RO'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-RR', '14', 'Roraima', 'RR'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-SC', '42', 'Santa Catarina', 'SC'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-SP', '35', 'São Paulo', 'SP'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-SE', '28', 'Sergipe', 'SE'),
  ((SELECT country_id FROM countries WHERE iso_alpha2 = 'BR'), 'BR-TO', '17', 'Tocantins', 'TO');

-- ============================================================
-- CAPITAIS: 27 cidades (uma por estado)
-- Subquery filtra por abbreviation AND country_id (semanticamente correto).
-- Prepara multi-país sem reescrever seed.
-- ============================================================

INSERT INTO cities (state_id, external_code, name, lat, lng) VALUES
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'AC' AND c.iso_alpha2 = 'BR'), '1200401', 'Rio Branco',       -9.9754,  -67.8249),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'AL' AND c.iso_alpha2 = 'BR'), '2704302', 'Maceió',           -9.6658,  -35.7350),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'AP' AND c.iso_alpha2 = 'BR'), '1600303', 'Macapá',            0.0349,  -51.0694),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'AM' AND c.iso_alpha2 = 'BR'), '1302603', 'Manaus',            -3.1019,  -60.0250),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'BA' AND c.iso_alpha2 = 'BR'), '2927408', 'Salvador',         -12.9714,  -38.5014),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'CE' AND c.iso_alpha2 = 'BR'), '2304400', 'Fortaleza',         -3.7172,  -38.5433),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'DF' AND c.iso_alpha2 = 'BR'), '5300108', 'Brasília',         -15.7801,  -47.9292),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'ES' AND c.iso_alpha2 = 'BR'), '3205309', 'Vitória',          -20.3155,  -40.3128),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'GO' AND c.iso_alpha2 = 'BR'), '5208707', 'Goiânia',          -16.6864,  -49.2643),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'MA' AND c.iso_alpha2 = 'BR'), '2111300', 'São Luís',          -2.5391,  -44.2829),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'MT' AND c.iso_alpha2 = 'BR'), '5103403', 'Cuiabá',           -15.6014,  -56.0979),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'MS' AND c.iso_alpha2 = 'BR'), '5002704', 'Campo Grande',     -20.4697,  -54.6201),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'MG' AND c.iso_alpha2 = 'BR'), '3106200', 'Belo Horizonte',   -19.9167,  -43.9345),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'PA' AND c.iso_alpha2 = 'BR'), '1501402', 'Belém',             -1.4558,  -48.5044),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'PB' AND c.iso_alpha2 = 'BR'), '2507507', 'João Pessoa',       -7.1195,  -34.8450),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'PR' AND c.iso_alpha2 = 'BR'), '4106902', 'Curitiba',         -25.4284,  -49.2733),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'PE' AND c.iso_alpha2 = 'BR'), '2611606', 'Recife',            -8.0578,  -34.8829),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'PI' AND c.iso_alpha2 = 'BR'), '2211001', 'Teresina',          -5.0892,  -42.8019),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'RJ' AND c.iso_alpha2 = 'BR'), '3304557', 'Rio de Janeiro',   -22.9068,  -43.1729),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'RN' AND c.iso_alpha2 = 'BR'), '2408102', 'Natal',             -5.7945,  -35.2110),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'RS' AND c.iso_alpha2 = 'BR'), '4314902', 'Porto Alegre',     -30.0346,  -51.2177),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'RO' AND c.iso_alpha2 = 'BR'), '1100205', 'Porto Velho',       -8.7612,  -63.9004),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'RR' AND c.iso_alpha2 = 'BR'), '1400100', 'Boa Vista',          2.8235,  -60.6758),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'SC' AND c.iso_alpha2 = 'BR'), '4205407', 'Florianópolis',    -27.5954,  -48.5480),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'SP' AND c.iso_alpha2 = 'BR'), '3550308', 'São Paulo',        -23.5505,  -46.6333),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'SE' AND c.iso_alpha2 = 'BR'), '2800308', 'Aracaju',           -10.9472, -37.0731),
  ((SELECT s.state_id FROM states s JOIN countries c ON c.country_id = s.country_id WHERE s.abbreviation = 'TO' AND c.iso_alpha2 = 'BR'), '1721000', 'Palmas',           -10.2491,  -48.3243);

-- ============================================================
-- VALIDAÇÃO INLINE
-- ============================================================

SELECT
  (SELECT COUNT(*) FROM countries WHERE iso_alpha2 = 'BR') AS paises_BR,
  (SELECT COUNT(*) FROM states s JOIN countries c ON c.country_id = s.country_id WHERE c.iso_alpha2 = 'BR') AS estados_BR,
  (SELECT COUNT(*) FROM cities ci JOIN states s ON s.state_id = ci.state_id JOIN countries c ON c.country_id = s.country_id WHERE c.iso_alpha2 = 'BR') AS capitais_BR;

-- Esperado: paises_BR=1, estados_BR=27, capitais_BR=27

COMMIT;

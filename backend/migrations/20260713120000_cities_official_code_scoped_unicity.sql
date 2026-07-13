-- FASE B — FUNDAÇÃO DE UNICIDADE DO CÓDIGO OFICIAL DA CIDADE (RFC B1-D · D-C)
-- ADDRESS → CITY/NEIGHBORHOOD CANONICAL BINDING. Base 1721ffb28 (decisão B1-D ratificada).
--
-- Identidade oficial de cidade é ESCOPADA pela jurisdição canônica: BR + UF (state_id) + código
-- IBGE → no máximo UMA city canônica. `external_code` NU não é identidade global (o mesmo código
-- pode existir em outros países/provedores) — por isso a unicidade é (state_id, external_code),
-- NUNCA UNIQUE global em external_code isolado.
--
-- NÃO faz backfill, NÃO insere/atualiza/deleta linhas, NÃO altera os 27 códigos existentes,
-- NÃO cria tabela territorial paralela, NÃO toca states.external_code. Forward-only, aditiva,
-- idempotente (IF NOT EXISTS). Se houver duplicidade viva em (state_id, external_code), o CREATE
-- falha fail-closed — corrigir dados NÃO é papel desta migration.

BEGIN;

-- Unicidade parcial: só linhas com código oficial materializado participam. NULL e string em
-- branco ficam de fora (cidades sem código oficial continuam permitidas, inclusive várias por UF).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_cities_state_external_code
  ON public.cities (state_id, external_code)
  WHERE external_code IS NOT NULL AND btrim(external_code) <> '';

COMMIT;

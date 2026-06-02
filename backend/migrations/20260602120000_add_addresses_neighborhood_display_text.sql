-- ============================================================
-- F-GEO-4a (DECISION-0079) — destino textual controlado para bairro no Location Core
-- ============================================================
-- Adiciona `addresses.neighborhood_display_text`: bairro como TEXTO DE EXIBIÇÃO controlado.
--
-- Natureza (DECISION-0079 §3):
--   - NÃO é SSOT territorial;
--   - NÃO é FK (a coluna `neighborhood_id` permanece RESERVADA para o dia em que houver catálogo
--     oficial/confiável de bairros — IBGE codifica município, NÃO bairro);
--   - é dado de exibição / importação de CEP (origem ViaCEP/input);
--   - NÃO usar para autoridade territorial, fiscalidade, matching crítico ou delimitação territorial;
--   - substitui (em fatia futura F-GEO-4b) o bairro textual hoje preso em `profiles.metadata.address.neighborhood`.
--
-- Esta fatia (F-GEO-4a) APENAS cria a prateleira. NÃO migra valor do blob, NÃO altera core.service,
-- NÃO limpa o blob, NÃO toca PJ/Companies. Migration forward-only/idempotente; NÃO chama internet.
-- ============================================================

BEGIN;

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS neighborhood_display_text TEXT;

COMMENT ON COLUMN addresses.neighborhood_display_text IS
  'F-GEO-4a/DECISION-0079: bairro como TEXTO DE EXIBICAO controlado (NAO FK, NAO SSOT territorial). '
  'Origem CEP/input; NAO usar para autoridade/fiscalidade/matching/delimitacao. neighborhood_id segue '
  'reservado para catalogo oficial futuro.';

-- VERIFICACAO POS: coluna existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'addresses' AND column_name = 'neighborhood_display_text'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: addresses.neighborhood_display_text nao foi criada';
  END IF;
END $$;

COMMIT;

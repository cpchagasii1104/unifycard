-- F-MIGRATION-REBUILD-PACKAGES Pacote 1.b
-- Repair: criar bank_transactions.concept_id NUA antes do statement precoce
-- 20260428210000_bank_transactions_concept_id_not_null.sql, cujo COMMENT ON COLUMN
-- (linha 14) está FORA do DO $$ guard e quebra o rebuild quando a coluna ainda
-- não existe.
--
-- Cronologia real do banco vivo (executed_at): 20260530506000 rodou ANTES e criou
-- a coluna com FK + índice; depois 20260428210000 foi adicionada ao tree e fez
-- SET NOT NULL + COMMENT sobre a coluna já existente. No rebuild zero (ordem
-- alfabética via localeCompare) 20260428210000 viria PRIMEIRO — falha.
--
-- Esta migration backdated cria APENAS a coluna nua (UUID, nullable). Depois:
--   20260428210000  → SET NOT NULL guarded efetiva (col agora existe) + COMMENT roda OK
--   20260530506000  → DO $$ IF NOT EXISTS = FALSE (col existe) → skip; CREATE INDEX
--                     IF NOT EXISTS cria o índice
-- A FK REFERENCES concepts(concept_id) ON DELETE RESTRICT da 506000 NÃO será criada
-- no rebuild (divergência conhecida e aceita por instrução — escopo mínimo).
--
-- Idempotência: ADD COLUMN IF NOT EXISTS. Banco vivo: no-op (coluna já existe).

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS concept_id UUID;

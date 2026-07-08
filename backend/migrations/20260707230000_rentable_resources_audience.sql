-- 20260707230000: plateia na LOCAÇÃO (Clayton 2026-07-07: "Locação deve ganhar a pergunta 1
-- 'Para quem é isso?' usando a mesma fonte"). ESPELHO do padrão 0162/0164 (posts/demanda):
-- visibility macro + refinamento ⊆ vocabulário typed-edge governado. A LISTA de opções vem do
-- transversal /audience-options; aqui só o substrato + CHECK (a última linha é o banco).
BEGIN;
ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'connections', 'only_me')),
  ADD COLUMN IF NOT EXISTS audience_relationship_types TEXT[] DEFAULT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rentable_resources_audience_types') THEN
    ALTER TABLE rentable_resources ADD CONSTRAINT chk_rentable_resources_audience_types
      CHECK (audience_relationship_types IS NULL
        OR audience_relationship_types <@ ARRAY['amigo','conhecido','familiar','cliente','colaborador','fornecedor','parceiro']::text[]);
  END IF;
END $$;
COMMIT;

-- 20260707130000: DECISION-0164 — plateia refinada na DEMANDA (achado Clayton no wizard:
-- "começar selecionando pra quem estou postando — pode ser pra fornecedores").
-- ESPELHO do padrão 0162 (posts): visibility macro + refinamento ⊆ vocabulário typed-edge.
BEGIN;
ALTER TABLE service_demands
  ADD COLUMN IF NOT EXISTS audience_relationship_types TEXT[] DEFAULT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_demands_audience_types') THEN
    ALTER TABLE service_demands ADD CONSTRAINT chk_service_demands_audience_types
      CHECK (audience_relationship_types IS NULL
        OR audience_relationship_types <@ ARRAY['amigo','conhecido','familiar','cliente','colaborador','fornecedor','parceiro']::text[]);
  END IF;
END $$;
COMMIT;

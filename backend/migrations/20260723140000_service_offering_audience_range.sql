-- 20260723140000: PÚBLICO-FAIXA (faixa de público preferida) da oferta do performer (apresentacao-musical e afins).
-- A banda declara, NA PRÓPRIA service_offering, a FAIXA de tamanho de público que prefere/aceita tocar:
-- audience_min + audience_max. É um atributo de CONFORTO/PREFERÊNCIA que alimenta os FILTROS DE DESCOBERTA.
-- DISTINTO de conditions.audience_capacity (C1c-a), que é o ALCANCE DO EQUIPAMENTO/som próprio ("meu som atende
-- até N pessoas" — insumo logístico da orquestração de locação de equipamento). Dois conceitos DIFERENTES,
-- mantidos separados (§2 sem verdade duplicada). Colunas REAIS (predicáveis por SQL — NÃO conditions JSONB opaco),
-- espelhando o precedente SELADO de contracting-policy (20260723100000). Vocabulário GOVERNADO por CHECK
-- (NÃO enum type, §4.9.7). PREÇO/cardápio FORA desta fatia. Bank-free (público = contagem de pessoas, nunca
-- dinheiro). Additive + idempotente. Forward-only.
BEGIN;

-- 1. Colunas de faixa de público (REAIS, NULLABLE; both-or-neither validado no writer — declarar uma exige a outra).
ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS audience_min INTEGER
    CHECK (audience_min IS NULL OR audience_min > 0),
  ADD COLUMN IF NOT EXISTS audience_max INTEGER
    CHECK (audience_max IS NULL OR audience_max > 0);

-- 2. CHECK físico de coerência da faixa: quando ambos presentes, min <= max (faixa bem-formada).
--    Guarded (idempotente) — Postgres não tem ADD CONSTRAINT IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_offering_audience_range'
  ) THEN
    ALTER TABLE service_offerings
      ADD CONSTRAINT chk_service_offering_audience_range
      CHECK (
        audience_min IS NULL
        OR audience_max IS NULL
        OR audience_min <= audience_max
      );
  END IF;
END $$;

COMMIT;

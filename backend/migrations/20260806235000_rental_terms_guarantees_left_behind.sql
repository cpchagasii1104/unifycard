-- 20260806235000: DT-DB-GUARANTEE-SWEEP-INCOMPLETE — as 12 garantias que a migração de substrato
-- deixou para trás na locação. Forward-only. Δbank=0. Backfill = 0 (as 4 linhas vivas já conformam).
--
-- ── COMO ISTO FOI ACHADO, E POR QUE QUASE NÃO FOI ────────────────────────────────────────────────
-- Um pacote de recomendação afirmou que a varredura de garantias estava COMPLETA — *"nada esquecido
-- para trás na camada temporal/grupo"* — e propôs marcar a dívida como PAGA. O censo dele estava
-- certo no que mediu (2 EXCLUDEs no banco, nenhuma em `availability`, triggers dos pares OK), mas
-- **não comparou o CONTEÚDO dos CHECKs do par migrado**. Medido:
--
--   rentable_resources        (MORTA, 0 linhas)  → 26 CHECKs
--   actor_asset_rental_terms  (VIVA,  4 linhas)  → 16 CHECKs
--
-- Das 10 de diferença, **9 são sobre colunas que AS DUAS tabelas têm** (a 10ª, `resource_year`, é
-- coluna que só existe na morta — morta por definição). Somando as que a viva tinha só pela metade,
-- são **12 garantias reais** ausentes do substrato VIVO. É exatamente o padrão que já tinha mordido
-- neste mesmo par em 2026-08-06 (`chk_aart_quantity_single_unless_equipment`, migration
-- 20260806010000): *a tabela nova copiou parte dos CHECKs e deixou o resto para trás.*
--
-- 🔴 QUATRO DELAS SÃO DE DINHEIRO. A viva tem 5 colunas `_cents` e **guarda de não-negativo em UMA**
-- (`price_cents`). `cleaning_fee_cents`, `collection_fee_cents`, `delivery_fee_cents` e
-- `extra_km_fee_cents` aceitavam **valor negativo** — em termos de locação que alimentam preço.
-- Δbank=0 (não é ledger), mas é valor declarado, e valor negativo em taxa é defeito mudo.
--
-- ── AS 12, POR FAMÍLIA ──────────────────────────────────────────────────────────────────────────
--  (1) não-negativo de dinheiro: cleaning · collection · delivery · extra_km          [4]
--  (2) coerência de limpeza: policy='separate_required' EXIGE valor                    [1]
--  (3) ordem do horário de entrega/retirada: fim > início                              [1]
--  (4) coerência de quilometragem: só 'limited' tem km · 'limited' EXIGE km ·
--      km não-negativo · km só para veículo                                            [4]
--  (5) vocabulário de plateia (⊆ typed-edge, espelho da 0162)                          [1]
--  (6) modalidade de locação só para imóvel                                            [1]
--
-- ⚠️ NÃO copiei as outras 9 diferenças: são CHECKs sobre colunas que a viva NÃO TEM
-- (`resource_year`, `label`, `concept_id`, `metadata`, …). Copiar CHECK de coluna inexistente é o
-- oposto do conserto — foi o que fez a v1 do guard de locação reprovar o próprio conserto.

BEGIN;

-- (1) DINHEIRO: nenhuma taxa de locação pode ser negativa.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_cleaning_fee_nonneg   CHECK (cleaning_fee_cents   IS NULL OR cleaning_fee_cents   >= 0),
  ADD CONSTRAINT chk_aart_collection_fee_nonneg CHECK (collection_fee_cents IS NULL OR collection_fee_cents >= 0),
  ADD CONSTRAINT chk_aart_delivery_fee_nonneg   CHECK (delivery_fee_cents   IS NULL OR delivery_fee_cents   >= 0),
  ADD CONSTRAINT chk_aart_extra_km_fee_nonneg   CHECK (extra_km_fee_cents   IS NULL OR extra_km_fee_cents   >= 0),
  ADD CONSTRAINT chk_aart_delivery_radius_pos   CHECK (delivery_radius_km   IS NULL OR delivery_radius_km   > 0);

-- (2) COERÊNCIA DE LIMPEZA: cobrar à parte exige dizer quanto.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_cleaning_fee_required_when_separate
  CHECK (cleaning_fee_policy IS DISTINCT FROM 'separate_required' OR cleaning_fee_cents IS NOT NULL);

-- (3) ORDEM DO HORÁRIO de entrega/retirada.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_handoff_time_order
  CHECK (handoff_time_start IS NULL OR handoff_time_end IS NULL OR handoff_time_end > handoff_time_start);

-- (4) QUILOMETRAGEM: só existe em veículo, só sob política 'limited', e nunca negativa.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_mileage_limited_fields_only
    CHECK (mileage_policy = 'limited'
        OR (included_km_per_day IS NULL AND included_km_total IS NULL AND extra_km_fee_cents IS NULL)),
  ADD CONSTRAINT chk_aart_mileage_limited_requires_km
    CHECK (mileage_policy IS DISTINCT FROM 'limited' OR included_km_per_day IS NOT NULL),
  ADD CONSTRAINT chk_aart_mileage_nonnegative
    CHECK ((included_km_per_day IS NULL OR included_km_per_day >= 0)
       AND (included_km_total   IS NULL OR included_km_total   >= 0)),
  ADD CONSTRAINT chk_aart_mileage_vehicle_only
    CHECK (resource_type = 'vehicle'
        OR (mileage_policy IS NULL AND included_km_per_day IS NULL
            AND included_km_total IS NULL AND extra_km_fee_cents IS NULL));

-- (5) PLATEIA: vocabulário typed-edge, espelho da 0162 (o mesmo conjunto de service_demands).
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_audience_types
  CHECK (audience_relationship_types IS NULL
      OR audience_relationship_types <@ ARRAY['amigo','conhecido','familiar','cliente','colaborador','fornecedor','parceiro']::text[]);

-- (6) MODALIDADE de locação só faz sentido em imóvel.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_rental_modality_property_only
  CHECK (resource_type = 'property' OR rental_modality IS NULL);

COMMENT ON CONSTRAINT chk_aart_cleaning_fee_nonneg ON actor_asset_rental_terms IS
  'DT-DB-GUARANTEE-SWEEP-INCOMPLETE (2026-08-06): garantia que ficou em rentable_resources quando o '
  'arco asset-first migrou o substrato. A tabela viva tinha 5 colunas _cents e nao-negativo em UMA. '
  'Ver as irmas chk_aart_*_nonneg e o guard audit-rental-guarantee-parity, que compara o PAR por '
  'coluna comum em vez de por lista de nomes.';

COMMIT;

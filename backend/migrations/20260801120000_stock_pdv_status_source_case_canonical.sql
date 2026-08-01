-- 20260801120000_stock_pdv_status_source_case_canonical.sql
-- F-STATUS-SOURCE-CASE-CANONICAL: converge 9 enums nativos de PDV/estoque/compras para o case
-- exigido pela norma. Sucede em espírito 20260731130000 (severity), que corrigiu o eixo OPOSTO —
-- lá o defeito era minúsculo onde a norma manda MAIÚSCULO (§4.34); aqui é MAIÚSCULO onde a norma
-- manda minúsculo (§4.11 e §4.40).
--
-- NORMA APLICADA (lida literalmente antes desta migration, não de memória):
--   · 07_NOMENCLATURA_CANONICA.md §4.11 "Status e Lifecycle" — `snake_case`, coluna `status`,
--     tipo VARCHAR ou ENUM. Todos os vocabulários exemplificados são lowercase.
--   · 07_NOMENCLATURA_CANONICA.md §4.40 "Source/Origin (Origem)" — "Valores padronizados em
--     `lowercase`", e a lista canônica contém LITERALMENTE 'pdv' e 'marketplace'.
--
-- FORA DE ESCOPO — deliberado, não esquecimento:
--   · alert_severity (CRITICAL/ERROR/WARNING/INFO/AUDIT) → §4.34 manda UPPER_CASE. Está CORRETO;
--     foi convergido ontem por 20260731130000. NÃO tocar.
--   · alert_type (INVENTORY_LOW_STOCK/...) e inventory_movement_type (IN/OUT/ADJUSTMENT) → não
--     encontrei regra de case para `*_type` fora de §4.41 (event type `domain.entity.action`), que
--     não é o caso destes. inventory_movement_type ainda governa o LEDGER FÍSICO (Lei 5, remissão
--     a INVARIANTES_OPERACIONAIS_LEDGER) — mexer nele exige decisão nomeada, não inferência.
--
-- MAPEAMENTO: renomeação PURA. O conjunto é idêntico ignorando case em todos os 9 enums — nenhum
-- valor muda de significado, nenhum estado nasce ou morre. Por isso usa ALTER TYPE ... RENAME VALUE
-- (preserva o OID do rótulo) em vez do swap de tipo usado em 20260731130000, que só foi necessário
-- lá porque os valores TAMBÉM remapeavam (high→ERROR etc.).
--
-- PROVA DO MECANISMO (banco efêmero, criado e destruído antes de escrever este arquivo):
--   RENAME VALUE reescreve o DEFAULT da coluna sozinho ('OPEN'::t → 'open'::t), converte linhas
--   preexistentes in-place e mantém INSERT-por-default funcionando. Por isso NÃO há UPDATE de dado
--   nem ALTER COLUMN SET DEFAULT aqui — seriam ruído, e ruído em migration vira dívida.
--
-- ESTADO MEDIDO EM unificard_dev ANTES DESTA MIGRATION (todas as 8 tabelas afetadas VAZIAS):
--   pdv_sessions 0 · purchase_orders 0 · purchase_order_items 0 · fulfillment_orders 0
--   fulfillment_items 0 · inventory_reservations 0 · stock_transfers 0 · stock_transfer_receipts 0
--   Cada um dos 9 enums é usado por EXATAMENTE 1 coluna (verificado em information_schema).
--   Nenhum guard em backend/scripts/ referencia estes enums.

BEGIN;

-- ═══ 1. pdv_session_status — pdv_sessions.status (DEFAULT 'OPEN') ═══
ALTER TYPE pdv_session_status RENAME VALUE 'OPEN'   TO 'open';
ALTER TYPE pdv_session_status RENAME VALUE 'CLOSED' TO 'closed';

-- ═══ 2. purchase_order_status — purchase_orders.status (DEFAULT 'DRAFT') ═══
ALTER TYPE purchase_order_status RENAME VALUE 'DRAFT'              TO 'draft';
ALTER TYPE purchase_order_status RENAME VALUE 'SUBMITTED'          TO 'submitted';
ALTER TYPE purchase_order_status RENAME VALUE 'CONFIRMED'          TO 'confirmed';
ALTER TYPE purchase_order_status RENAME VALUE 'PARTIALLY_RECEIVED' TO 'partially_received';
ALTER TYPE purchase_order_status RENAME VALUE 'RECEIVED'           TO 'received';
ALTER TYPE purchase_order_status RENAME VALUE 'CANCELLED'          TO 'cancelled';
ALTER TYPE purchase_order_status RENAME VALUE 'COMPLETED'          TO 'completed';

-- ═══ 3. fulfillment_status — fulfillment_orders.status (DEFAULT 'PENDING') ═══
ALTER TYPE fulfillment_status RENAME VALUE 'PENDING'   TO 'pending';
ALTER TYPE fulfillment_status RENAME VALUE 'PICKED'    TO 'picked';
ALTER TYPE fulfillment_status RENAME VALUE 'SHIPPED'   TO 'shipped';
ALTER TYPE fulfillment_status RENAME VALUE 'CANCELLED' TO 'cancelled';

-- ═══ 4. fulfillment_item_status — fulfillment_items.status (DEFAULT 'PENDING') ═══
ALTER TYPE fulfillment_item_status RENAME VALUE 'PENDING' TO 'pending';
ALTER TYPE fulfillment_item_status RENAME VALUE 'PICKED'  TO 'picked';

-- ═══ 5. inventory_reservation_status — inventory_reservations.status (DEFAULT 'ACTIVE') ═══
ALTER TYPE inventory_reservation_status RENAME VALUE 'ACTIVE'   TO 'active';
ALTER TYPE inventory_reservation_status RENAME VALUE 'RELEASED' TO 'released';
ALTER TYPE inventory_reservation_status RENAME VALUE 'CONSUMED' TO 'consumed';

-- ═══ 6. receipt_status — stock_transfer_receipts.status (DEFAULT 'IN_PROGRESS') ═══
ALTER TYPE receipt_status RENAME VALUE 'IN_PROGRESS' TO 'in_progress';
ALTER TYPE receipt_status RENAME VALUE 'COMPLETED'   TO 'completed';
ALTER TYPE receipt_status RENAME VALUE 'CANCELLED'   TO 'cancelled';

-- ═══ 7. stock_transfer_status — stock_transfers.status (DEFAULT 'DRAFT') ═══
ALTER TYPE stock_transfer_status RENAME VALUE 'DRAFT'     TO 'draft';
ALTER TYPE stock_transfer_status RENAME VALUE 'PENDING'   TO 'pending';
ALTER TYPE stock_transfer_status RENAME VALUE 'SHIPPED'   TO 'shipped';
ALTER TYPE stock_transfer_status RENAME VALUE 'RECEIVED'  TO 'received';
ALTER TYPE stock_transfer_status RENAME VALUE 'CANCELLED' TO 'cancelled';

-- ═══ 8. fulfillment_source — fulfillment_orders.source (§4.40) ═══
ALTER TYPE fulfillment_source RENAME VALUE 'PDV'         TO 'pdv';
ALTER TYPE fulfillment_source RENAME VALUE 'MARKETPLACE' TO 'marketplace';

-- ═══ 9. inventory_reservation_source — inventory_reservations.source (§4.40) ═══
ALTER TYPE inventory_reservation_source RENAME VALUE 'MARKETPLACE' TO 'marketplace';
ALTER TYPE inventory_reservation_source RENAME VALUE 'PDV'         TO 'pdv';

COMMENT ON COLUMN pdv_sessions.status IS
  'Lifecycle da sessão de caixa, §4.11 snake_case minúsculo: open, closed.';
COMMENT ON COLUMN purchase_orders.status IS
  'Lifecycle do pedido de compra, §4.11 snake_case minúsculo: draft, submitted, confirmed, partially_received, received, cancelled, completed.';
COMMENT ON COLUMN fulfillment_orders.status IS
  'Lifecycle do fulfillment, §4.11 snake_case minúsculo: pending, picked, shipped, cancelled.';
COMMENT ON COLUMN fulfillment_orders.source IS
  'Origem, §4.40 lowercase (vocabulário canônico da norma): pdv, marketplace.';
COMMENT ON COLUMN fulfillment_items.status IS
  'Lifecycle do item de fulfillment, §4.11 snake_case minúsculo: pending, picked.';
COMMENT ON COLUMN inventory_reservations.status IS
  'Lifecycle da reserva de estoque, §4.11 snake_case minúsculo: active, released, consumed.';
COMMENT ON COLUMN inventory_reservations.source IS
  'Origem, §4.40 lowercase (vocabulário canônico da norma): marketplace, pdv.';
COMMENT ON COLUMN stock_transfer_receipts.status IS
  'Lifecycle do recebimento, §4.11 snake_case minúsculo: in_progress, completed, cancelled.';
COMMENT ON COLUMN stock_transfers.status IS
  'Lifecycle da transferência de estoque, §4.11 snake_case minúsculo: draft, pending, shipped, received, cancelled.';

COMMIT;

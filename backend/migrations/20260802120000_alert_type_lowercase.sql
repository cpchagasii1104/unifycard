-- 20260802120000_alert_type_lowercase.sql
-- F-ALERT-TYPE-LOWERCASE: converge o enum `alert_type` para 07_NOMENCLATURA §4.77 (emenda
-- ratificada por Clayton em 2026-08-02). alert_type é TIPO, não severity — a exceção MAIÚSCULA
-- da norma é SÓ a §4.34 (severity/priority), que permanecem intactas nesta mesma tabela.
--
-- RENAME VALUE puro (conjunto idêntico ignorando case; preserva OID; reescreve DEFAULT sozinho —
-- mecanismo provado em 20260801120000). ESTADO MEDIDO ANTES: alerts = 0 linhas.
-- HOMÔNIMOS PRESERVADOS de propósito no código: 'PAYMENT_FAILED' como CÓDIGO DE ERRO HTTP
-- (checkout.routes.ts:27,:150) e o vocabulário de eventType do bus interno de automação — são
-- OUTROS vocabulários, não este enum.

BEGIN;

ALTER TYPE alert_type RENAME VALUE 'INVENTORY_LOW_STOCK'    TO 'inventory_low_stock';
ALTER TYPE alert_type RENAME VALUE 'INVENTORY_OUT_OF_STOCK' TO 'inventory_out_of_stock';
ALTER TYPE alert_type RENAME VALUE 'PAYMENT_FAILED'         TO 'payment_failed';
ALTER TYPE alert_type RENAME VALUE 'PAYOUT_FAILED'          TO 'payout_failed';
ALTER TYPE alert_type RENAME VALUE 'FISCAL_PENDING'         TO 'fiscal_pending';
ALTER TYPE alert_type RENAME VALUE 'ORDER_EXPIRED'          TO 'order_expired';
ALTER TYPE alert_type RENAME VALUE 'RESERVATION_EXPIRED'    TO 'reservation_expired';
ALTER TYPE alert_type RENAME VALUE 'RISK_SCORE_LOW'         TO 'risk_score_low';
ALTER TYPE alert_type RENAME VALUE 'OTHER'                  TO 'other';

COMMENT ON COLUMN alerts.type IS
  'Tipo do alerta, §4.77 lowercase: inventory_low_stock, inventory_out_of_stock, payment_failed, payout_failed, fiscal_pending, order_expired, reservation_expired, risk_score_low, other. Convergido em 2026-08-02. severity/priority da MESMA tabela seguem MAIÚSCULOS (§4.34) — case por TIPO DE CAMPO, nunca por tabela.';

COMMIT;

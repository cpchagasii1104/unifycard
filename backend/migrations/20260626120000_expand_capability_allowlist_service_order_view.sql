-- 20260626120000_expand_capability_allowlist_service_order_view.sql
-- F-OPERATOR-SERVICE-ORDER-VIEW-GRANT — expande a allowlist NÃO-financeira de actor_capability_grants
-- adicionando SOMENTE 'service_order:view' (capability de LEITURA operacional de ordem de serviço).
--
-- Decisão soberana (prompt EXECUTORA): NENHUMA outra capability autorizada nesta frente. Money-free:
-- sem tabela nova, sem coluna nova, sem tabela financeira (Bank/payment/payout/settlement/checkout intocados).
-- Forward-only/idempotente: DROP IF EXISTS + ADD do CHECK chk_acg_capability_nonfinancial. A trava física
-- (CHECK) é espelho DEFENSIVO do registry vivo permission-keys.ts (DECISION-0136 W1) e da
-- NON_FINANCIAL_CAPABILITY_ALLOWLIST (actor-capability-grant.types.ts). 'service_order:view' JÁ existe em
-- permission-keys.ts (ownership/representação suficiente) — aqui ele passa a ser CONCEDÍVEL por grant.

BEGIN;

ALTER TABLE actor_capability_grants
  DROP CONSTRAINT IF EXISTS chk_acg_capability_nonfinancial;

ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_capability_nonfinancial CHECK (
    capability_key IN (
      'calendar:block',
      'calendar:unblock',
      'services:create',
      'services:edit',
      'services:disable',
      'service_order:view'
    )
  );

COMMENT ON CONSTRAINT chk_acg_capability_nonfinancial ON actor_capability_grants IS
  'Allowlist NAO-financeira de capabilities concediveis por grant (DECISION-0136 + F-OPERATOR-SERVICE-ORDER-VIEW-GRANT). Espelho defensivo do registry vivo permission-keys.ts; PROIBIDO conter capability financeira.';

COMMIT;

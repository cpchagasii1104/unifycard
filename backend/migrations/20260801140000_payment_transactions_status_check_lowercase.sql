-- 20260801140000_payment_transactions_status_check_lowercase.sql
-- F-PAYMENT-TRANSACTIONS-STATUS-GOVERNED: dá TRAVA e case canônico a `payment_transactions.status`.
--
-- ACHADO (varredura de 2026-08-01, ao fechar a lacuna que a auditoria independente apontou no
-- frontend): a coluna é **TEXT SEM CHECK NENHUM** — vocabulário totalmente livre, qualquer string
-- entra. E o que o código usa é MAIÚSCULO (`PENDING`/`SUCCESS`/`FAILED`), contra §4.11 da norma
-- (status/lifecycle em snake_case minúsculo).
--
-- 🔴 POR QUE ISTO É DÍVIDA MESMO SEM BUG VIVO: backend e frontend CONCORDAM entre si hoje
--    (`payment-transaction.repository.ts` grava e compara MAIÚSCULO; `marketplace.ts:958` declara
--    MAIÚSCULO), então nada quebra AGORA. O que existe é pior de outra forma: **a única tabela
--    desta família sem trava**. A irmã `payment_intents` já tem CHECK com 13 valores MINÚSCULOS e
--    já foi normalizada por `20260530503000_payment_intents_normalize_status` (que mapeou
--    'CREATED'→'pending', 'completed'→'settled'). Uma foi convergida e travada; a outra ficou —
--    e a que ficou é justamente a que aceita qualquer coisa.
--
-- ALCANCE — os 8 sítios reais (grep sem truncar, `payment-transaction.repository.ts`):
--   :109 compara 'FAILED' · :126 INSERT 'PENDING' · :196 SET 'SUCCESS' · :199 WHERE 'PENDING'
--   :209 compara 'SUCCESS' · :220 SET 'FAILED' · :223 WHERE 'PENDING' · :233 compara 'FAILED'
--   Frontend: `api/marketplace.ts:958` (interface PaymentTransaction).
--   ⚠️ NÃO CONFUNDIR — foram verificados e estão FORA:
--     · `payment_status` é coluna de OUTRAS tabelas (`payment_intents`, `service_discovery_requests`)
--     · `PaymentLinkPaymentStatus` aponta para `payment_links`, tabela **AUSENTE** (é fantasma,
--       outra classe de dívida — não se conserta case de tabela que não existe)
--     · `PayoutTransaction` (marketplace.ts:980) pertence ao domínio payout, cujas rotas estão
--       CONTIDAS em 503 (DECISION-0189B D2) — não se toca superfície contida para "arrumar case"
--
-- ESTADO MEDIDO ANTES (unificard_dev, read-only): `payment_transactions` = **0 linhas**.
--   Sem linha, o ADD CONSTRAINT não precisa de backfill nem de NOT VALID.
--
-- Forward-only / transacional / idempotente.

BEGIN;

ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('pending', 'success', 'failed'));

COMMENT ON COLUMN payment_transactions.status IS
  'Lifecycle da transação de pagamento, §4.11 snake_case minúsculo: pending, success, failed. Antes de 2026-08-01 esta coluna era TEXT SEM CHECK (vocabulário livre) e o código usava MAIÚSCULO — a irmã payment_intents já era minúscula e travada desde 20260530503000.';

COMMIT;

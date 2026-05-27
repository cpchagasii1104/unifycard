-- ============================================================
-- DECISION-0052: F-REFUND-SPLIT-AWARE-HARDENING
-- Taxonomia canônica + autoria forte em reversals
-- ============================================================
-- Sessão: 2026-05-27 (pós PE-5-RESOLVER-MVP, antes de PE-6/PF).
--
-- Norma: docs/01_normative/CORE_ESTORNOS_FINANCEIROS_CANONICO.md
--   §1.1 reversal_type canônico
--   §4   autoria obrigatória diferenciada por tipo
--   §9.1 internal_refund EXIGE performed_by_user_id
--
-- Pré-condição: 0 rows em reversals no DB live (sem backfill necessário).
-- Reversibilidade: ALTA (DROP CONSTRAINT + DROP COLUMN).
-- Blast: ZERO (sem dados afetados).
--
-- Não inclui: gate de aprovação para internal_refund (Bloco C — frente
-- própria, condicional a raio-x do Core de Aprovação Financeira).
-- Não inclui: separação escrow_refunds vs reversals (Bloco F — fora de escopo).
-- ============================================================

BEGIN;

-- ─── Bloco A — Taxonomia canônica ─────────────────────────────
ALTER TABLE reversals
  ADD COLUMN reversal_type TEXT NOT NULL DEFAULT 'external_reversal';

ALTER TABLE reversals
  ADD CONSTRAINT chk_reversal_type_canonical
  CHECK (reversal_type IN (
    'external_reversal',
    'internal_refund',
    'chargeback_open',
    'chargeback_lost',
    'chargeback_reversed'
  ));

-- ─── Bloco B — Autoria forte (diferencia sistema de manual) ──
-- performed_by_user_id: NULL para reversões sistêmicas (external,
-- chargeback). NOT NULL para internal_refund (CHECK abaixo).
ALTER TABLE reversals
  ADD COLUMN performed_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT;

-- authority_source: enum canônico de fontes de autoridade.
-- 'system'      — sistema/worker (sem humano específico)
-- 'ownership'   — dono da conta agindo sobre seu próprio recurso
-- 'delegation'  — delegação explícita (futuro)
-- 'account_acl' — permissão concedida via ACL de conta (futuro)
ALTER TABLE reversals
  ADD COLUMN authority_source TEXT;

ALTER TABLE reversals
  ADD CONSTRAINT chk_authority_source_canonical
  CHECK (
    authority_source IS NULL
    OR authority_source IN ('system', 'ownership', 'delegation', 'account_acl')
  );

-- Internal refund exige user humano (norma §4 + §9.1).
ALTER TABLE reversals
  ADD CONSTRAINT chk_internal_refund_requires_user
  CHECK (
    NOT (reversal_type = 'internal_refund' AND performed_by_user_id IS NULL)
  );

-- External reversal e chargebacks são sistêmicos por natureza — coerência
-- com norma §4 ("Estorno externo: performed_by NULL").
ALTER TABLE reversals
  ADD CONSTRAINT chk_external_reversal_is_systemic
  CHECK (
    NOT (reversal_type IN ('external_reversal', 'chargeback_open',
                            'chargeback_lost', 'chargeback_reversed')
         AND performed_by_user_id IS NOT NULL)
  );

COMMENT ON COLUMN reversals.reversal_type IS
  'DECISION-0052: taxonomia canônica do estorno (CORE_ESTORNOS §1.1).
   external_reversal: gateway externo iniciou (ex: payment provider chargeback hook).
   internal_refund: operador humano da plataforma decidiu refund (EXIGE user humano + aprovação Bloco C futura).
   chargeback_open/lost/reversed: estados de disputa externa.';

COMMENT ON COLUMN reversals.performed_by_user_id IS
  'DECISION-0052: NULL para reversões sistêmicas (external_reversal,
   chargeback_*). NOT NULL para internal_refund (CHECK
   chk_internal_refund_requires_user enforça).';

COMMENT ON COLUMN reversals.authority_source IS
  'DECISION-0052: fonte canônica da autoridade que disparou a reversão.
   system | ownership | delegation | account_acl. NULL aceito enquanto
   reversões legadas não foram backfilladas (0 rows hoje; default operacional
   é declarar conforme o caminho de chamada).';

COMMIT;

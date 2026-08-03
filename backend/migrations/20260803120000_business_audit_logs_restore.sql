-- 20260803120000_business_audit_logs_restore.sql
-- F-BUSINESS-AUDIT-RESTORE: materializa `business_audit_logs`, a trilha de auditoria de negócio que
-- o código escreve há tempo contra uma tabela QUE NÃO EXISTE.
--
-- ═══ O DEFEITO, PROVADO NO CÓDIGO (não suposição) ═══
--   app.builder.ts:581            registra o módulo agreements
--   agreements.routes.ts:27       → agreementService.createAgreement
--   agreement.service.ts:43       → recordBusinessAuditSafely
--     → business-audit.service.createLog → business-audit.repository.ts:47
--        INSERT INTO business_audit_logs  ← tabela ausente → 42P01
--   business-audit.helpers.ts:26  catch { console.error(...) }  ← engole, não bloqueia
-- 40 call sites, incluindo ledger, invoice, payout, evidence e permission_denied.
-- Consequência: a trilha de compliance está sendo DESCARTADA a cada requisição, hoje.
--
-- ═══ POR QUE NÃO É CÓPIA DO ARCHIVE (migrations_archive/0922) ═══
-- O archive é desenho PRÉ-GÊNESIS e está errado em 3 eixos — copiá-lo criaria tabela quebrada:
--   [a] FK    archive: tenants(tenant_id)      REAL: tenants(id)          → falharia ao criar
--   [b] RLS   archive: app.current_tenant_id   REAL: app.current_tenant   → policy nunca casaria
--   [c] vocab archive: 14 actions              CÓDIGO: 53                 → recusaria 39 valores
-- Medidos em unificard_dev. "Archive não é SSOT vigente" (CLAUDE.md).
--
-- ═══ CASE CONVERGIDO AGORA, PORQUE É DE GRAÇA ═══
-- 4 valores nasciam MAIÚSCULOS contra 65 minúsculos, todos de store-onboarding.service.ts:
--   MARKETPLACE_STORE_ONBOARDED · MARKETPLACE_CATEGORY_IMPORTED ·
--   MARKETPLACE_CATEGORY_IMPORT_UPDATED · contextType 'ACTOR'
-- §4.77/§4.78: *_type e action são MINÚSCULOS (a exceção MAIÚSCULA é só severity/priority, §4.34).
-- Como a tabela NUNCA existiu, NENHUM valor jamais foi gravado: não há dado para migrar, e há ZERO
-- leitor comparando contra eles (2 dos 3 nem caller têm). Criar o CHECK com MAIÚSCULO cristalizaria
-- a violação — o mesmo erro que gerou `alert_severity` minúsculo com o runner verde.
--
-- TEXT + CHECK (não enum nativo): o vocabulário vive em business-audit.types.ts e cresce por fatia;
-- enum exigiria migration a cada valor novo. O CHECK aqui espelha o TS — se divergir, o INSERT é
-- recusado e o catch engole, voltando ao silêncio. A asserção GREEN④ do E2E
-- (validate-pipeline-e2e-business-audit-restore) compara os DOIS conjuntos e falha se o TS crescer
-- sem migration correspondente. ⚠️ É E2E efêmero, NÃO guard contínuo do runner — quem adicionar
-- valor novo ao TS precisa rodar `scripts/run-business-audit-restore-ephemeral.ps1`.

BEGIN;

CREATE TABLE IF NOT EXISTS business_audit_logs (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  actor_id      UUID NOT NULL,
  user_id       UUID,
  context_type  TEXT NOT NULL,
  context_id    UUID NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_business_audit_action CHECK (action IN (
    'booking_requested','booking_decided','booking_confirmed',
    'rfq_created','quote_submitted','rfq_converted','bundle_confirmed','financial_terms_confirmed',
    'service_order_created','service_order_confirmed','service_order_started',
    'service_order_completed','service_order_cancelled',
    'permission_denied','production_assisted_required',
    'agreement_created','agreement_updated','agreement_proposed','agreement_accepted',
    'agreement_finalized','agreement_bypass_attempted',
    'evidence_event_added','dispute_opened','dispute_resolved',
    'escrow_created','funds_held','milestone_reached','funds_released','refund_issued',
    'escrow_bypass_attempted',
    'trust_event_registered','trust_score_updated','trust_action_blocked','trust_action_warning',
    'bypass_detected','off_platform_attempt',
    'ledger_entry_created',
    'payout_batch_created','payout_executed','payout_blocked','payout_failed',
    'invoice_created','invoice_issued','invoice_cancelled',
    'risk_dashboard_viewed',
    'policy_created','policy_activated','policy_deactivated',
    'policy_decision_applied','policy_decision_revoked',
    'marketplace_store_onboarded','marketplace_category_imported','marketplace_category_import_updated'
  )),

  CONSTRAINT chk_business_audit_context_type CHECK (context_type IN (
    'event','rfq','booking','service_order','bundle','split','agreement','evidence_pack',
    'escrow','trust_profile','ledger','payout_batch','payout_order','invoice',
    'risk_command_center','actor'
  ))
);

CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_context
  ON business_audit_logs (tenant_id, context_type, context_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_actor
  ON business_audit_logs (tenant_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_action
  ON business_audit_logs (tenant_id, action, created_at DESC);

-- RLS com o setting REAL do schema vivo (app.current_tenant), medido em pg_policies.
ALTER TABLE business_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_audit_logs_tenant_isolation ON business_audit_logs;
CREATE POLICY business_audit_logs_tenant_isolation ON business_audit_logs
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant', true));

-- APPEND-ONLY DE VERDADE. O archive prometia "🔴 BLINDAGEM: Logs são IMUTÁVEIS" e entregava só um
-- COMENTÁRIO — nada impedia UPDATE/DELETE. Trilha legal que pode ser reescrita não é trilha.
-- Mesmo padrão dos ledgers de eventos já vivos no schema.
CREATE OR REPLACE FUNCTION fn_business_audit_logs_append_only() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'BUSINESS_AUDIT_LOG_IMMUTABLE: business_audit_logs é append-only (tentativa de %)', TG_OP
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_audit_logs_append_only ON business_audit_logs;
CREATE TRIGGER trg_business_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON business_audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_business_audit_logs_append_only();

COMMENT ON TABLE business_audit_logs IS
  'Trilha imutável (append-only por trigger) de ações de negócio para rastreabilidade legal. '
  'Vocabulário de action/context_type espelha business-audit.types.ts — divergir faz o INSERT '
  'ser recusado e o helper engolir em silêncio; há guard comparando os dois conjuntos.';

COMMIT;

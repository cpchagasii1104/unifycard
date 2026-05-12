-- C36: status columns sem CHECK constraint
-- 30 tabelas: TEXT/VARCHAR com status sem CHECK (7 ENUM já protegidas, 3 diferidas com DT)
-- DECISION-0031: estados válidos derivados de análise estática do código TypeScript e migrations
--
-- Diferidos com DT (registrados em REMEDIATION_DT_LOG.md):
--   company_validations.status — coluna nunca escrita pelo código, nullable
--   unifycard_transactions.status — valores não definidos no código atual
--   categories.status — ALLOWLISTED: ontologia central, revisão separada
--
-- Case drift: actor_debts (pending lowercase + TRANSFERRED_TO_ORGANIZER uppercase) → DT registrado
-- Case drift: payment_transactions (código usa UPPERCASE, dados dev têm lowercase) → normalizado aqui

BEGIN;

-- ─── NORMALIZAÇÃO DE CASE (antes de adicionar CHECKs) ────────────────────────

-- payment_transactions: código escreve UPPERCASE, dados antigos em lowercase
UPDATE payment_transactions SET status = UPPER(status)
  WHERE status IN ('pending', 'success', 'failed');

-- ─── FINANCIAL ────────────────────────────────────────────────────────────────

ALTER TABLE bank_settlements
  ADD CONSTRAINT chk_bank_settlements_status
  CHECK (status IN ('pending', 'processing', 'sent', 'failed'));

ALTER TABLE financial_circuit_breakers
  ADD CONSTRAINT chk_financial_circuit_breakers_status
  CHECK (status IN ('active', 'released'));

ALTER TABLE financial_disputes
  ADD CONSTRAINT chk_financial_disputes_status
  CHECK (status IN ('opened', 'under_review', 'resolved', 'rejected'));

ALTER TABLE financial_freezes
  ADD CONSTRAINT chk_financial_freezes_status
  CHECK (status IN ('active', 'released', 'cancelled'));

ALTER TABLE payout_requests
  ADD CONSTRAINT chk_payout_requests_status
  CHECK (status IN ('requested', 'processing', 'completed', 'failed'));

ALTER TABLE payment_transactions
  ADD CONSTRAINT chk_payment_transactions_status
  CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED'));

ALTER TABLE treasury_distributions
  ADD CONSTRAINT chk_treasury_distributions_status
  CHECK (status IN ('pending', 'processed', 'failed'));

-- ─── GOVERNANCE ───────────────────────────────────────────────────────────────

ALTER TABLE governance_financial_actions
  ADD CONSTRAINT chk_governance_financial_actions_status
  CHECK (status IN ('pending', 'processed', 'failed'));

ALTER TABLE governance_funding
  ADD CONSTRAINT chk_governance_funding_status
  CHECK (status IN ('pending', 'processing', 'funded', 'failed'));

ALTER TABLE governance_proposals
  ADD CONSTRAINT chk_governance_proposals_status
  CHECK (status IN ('open', 'approved', 'rejected', 'executed'));

-- ─── IDENTITY / AUTH ──────────────────────────────────────────────────────────

ALTER TABLE actor_delegations
  ADD CONSTRAINT chk_actor_delegations_status
  CHECK (status IN ('active', 'revoked', 'expired'));

ALTER TABLE authority_roots
  ADD CONSTRAINT chk_authority_roots_status
  CHECK (status IN ('active'));

-- actor_debts: case drift (pending lowercase + TRANSFERRED_TO_ORGANIZER uppercase)
-- DT-C36-actor-debts-case-drift registrado para normalização futura
ALTER TABLE actor_debts
  ADD CONSTRAINT chk_actor_debts_status
  CHECK (status IN ('pending', 'TRANSFERRED_TO_ORGANIZER'));

-- ─── COMPANIES ────────────────────────────────────────────────────────────────

ALTER TABLE companies
  ADD CONSTRAINT chk_companies_status
  CHECK (status IN ('active', 'inactive', 'suspended', 'closed'));

-- ─── EVENTS / AVAILABILITY ────────────────────────────────────────────────────

ALTER TABLE availability
  ADD CONSTRAINT chk_availability_status
  CHECK (status IN ('active', 'paused'));

ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_status
  CHECK (status IN ('requested', 'confirmed', 'cancelled', 'expired', 'checked_in', 'checked_out'));

ALTER TABLE event_attendees
  ADD CONSTRAINT chk_event_attendees_status
  CHECK (status IN ('registered', 'cancelled', 'attended', 'no_show'));

ALTER TABLE event_rsvp
  ADD CONSTRAINT chk_event_rsvp_status
  CHECK (status IN ('pending', 'yes', 'no', 'maybe'));

ALTER TABLE event_staff
  ADD CONSTRAINT chk_event_staff_status
  CHECK (status IN ('active', 'inactive', 'cancelled'));

ALTER TABLE schedule_slots
  ADD CONSTRAINT chk_schedule_slots_status
  CHECK (status IN ('available', 'booked', 'blocked', 'cancelled'));

ALTER TABLE schedules
  ADD CONSTRAINT chk_schedules_status
  CHECK (status IN ('active', 'inactive', 'archived'));

-- ─── CHAT / SOCIAL ────────────────────────────────────────────────────────────

-- chat_messages: código usa UPPERCASE (VISIBLE, DELETED)
ALTER TABLE chat_messages
  ADD CONSTRAINT chk_chat_messages_status
  CHECK (status IN ('VISIBLE', 'DELETED'));

ALTER TABLE chat_rooms
  ADD CONSTRAINT chk_chat_rooms_status
  CHECK (status IN ('active', 'archived'));

ALTER TABLE groups
  ADD CONSTRAINT chk_groups_status
  CHECK (status IN ('active', 'inactive'));

-- ─── SERVICES / OPERATIONS ────────────────────────────────────────────────────

ALTER TABLE service_booking_decisions
  ADD CONSTRAINT chk_service_booking_decisions_status
  CHECK (status IN ('accepted', 'rejected', 'pending', 'expired'));

ALTER TABLE service_payment_requests
  ADD CONSTRAINT chk_service_payment_requests_status
  CHECK (status IN ('pending', 'cancelled', 'expired', 'paid'));

ALTER TABLE marketplace_plugin_executions
  ADD CONSTRAINT chk_marketplace_plugin_executions_status
  CHECK (status IN ('pending', 'executed', 'failed'));

ALTER TABLE ai_operations_log
  ADD CONSTRAINT chk_ai_operations_log_status
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));

ALTER TABLE order_sagas
  ADD CONSTRAINT chk_order_sagas_status
  CHECK (status IN ('created', 'payment_pending', 'paid', 'fulfilled', 'failed', 'cancelled'));

-- ─── RECORD IN schema_migrations ─────────────────────────────────────────────
INSERT INTO schema_migrations (filename) VALUES ('20260530535000_c36_status_check_constraints.sql')
  ON CONFLICT DO NOTHING;

COMMIT;

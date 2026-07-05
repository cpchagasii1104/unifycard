-- ============================================================
-- MIGRATION: substrato do Chamado — gated por FATO DE NEGÓCIO real (Fatia 6)
-- Arquivo: 20260706120000_support_tickets_business_fact_gate.sql
-- Frente: F-SUPPORT-TICKET-BUSINESS-FACT-GATE (GUIA_MESTRE §5.6; DESENHO_PAGINA_DO_ACTOR
--         §5/§5B SELADO — "Chamado gated por FATO DE NEGÓCIO, não por conexão")
--
-- O QUE É: o "Chamado" — um ticket de atendimento entre duas partes que só nasce se existir um
-- NEGÓCIO REAL específico entre elas (compra/contratação/reserva) — nunca por conexão social.
-- O chamado REFERENCIA o evento de negócio específico ("comprei X e deu problema"), ancorando na
-- verdade causal (segmentos.md #5 "Confiança causal"; DESENHO §5B mesma doutrina p/ avaliação).
--
-- O QUE NÃO É: NÃO é o módulo `disputes`/`reconciliation` (financial_disputes/
-- reconciliation_disputes) — aqueles são disputa financeira/reversão contábil interna
-- (auto-detecção de discrepância de ledger), contidos fail-closed (DECISION-0123). Domínio
-- DIFERENTE: `support_tickets` é comunicação entre as DUAS PARTES de um negócio real — nunca
-- move dinheiro, nunca reverte transação (Δbank=0 por design; reversão continua exclusiva do
-- domínio `disputes`).
--
-- reference_type/reference_id é POLIMÓRFICO (mesmo padrão de `reactions.entity_type/entity_id`
-- e `financial_disputes.reference_id`) — aponta pra `orders`/`service_orders`/`bookings`, as
-- fontes de VERDADE de fato-de-negócio já vivas. Sem FK direta (seria preciso 3 FKs opcionais
-- exclusivas — pattern polimórfico é o canônico já usado no sistema); a integridade é garantida
-- pelo SERVICE (resolve as partes reais da referência antes do INSERT, nunca no banco).
--
-- Vocabulário GOVERNADO por CHECK (Lei §8): reference_type ∈ {order, service_order, booking};
-- status ∈ {open, in_progress, resolved, closed}. Forward-only, aditiva. Δbank=0.
-- ============================================================

BEGIN;

CREATE TABLE support_tickets (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- referência polimórfica ao FATO DE NEGÓCIO real (orders | service_orders | bookings)
  reference_type        TEXT        NOT NULL
    CONSTRAINT chk_support_tickets_reference_type
    CHECK (reference_type IN ('order', 'service_order', 'booking')),
  reference_id          UUID        NOT NULL,
  -- quem abre o chamado (uma das duas partes REAIS do negócio referenciado)
  from_actor_id         UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  -- contra quem (a OUTRA parte real do MESMO negócio referenciado)
  to_actor_id           UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  subject               TEXT        NOT NULL,
  message               TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'open'
    CONSTRAINT chk_support_tickets_status
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_by_user_id    UUID        NOT NULL,
  responded_by_user_id  UUID,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_support_tickets_not_self CHECK (from_actor_id <> to_actor_id)
);

CREATE INDEX idx_support_tickets_from ON support_tickets (tenant_id, from_actor_id, status);
CREATE INDEX idx_support_tickets_to   ON support_tickets (tenant_id, to_actor_id, status);
CREATE INDEX idx_support_tickets_reference ON support_tickets (tenant_id, reference_type, reference_id);

-- RLS tenant-scoped. ENABLE implica FORCE (invariante §1.4 RLS-live, sem gap novo).
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_rls ON support_tickets
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION support_tickets_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_tickets_bump_updated_at();

COMMIT;

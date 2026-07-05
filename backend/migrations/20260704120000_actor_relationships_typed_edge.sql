-- ============================================================
-- MIGRATION: substrato de relação tipada entre actors (Fatia 1) + ponte suppliers→actor (Opção B)
-- Arquivo: 20260704120000_actor_relationships_typed_edge.sql
-- Frente: F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 (GUIA_MESTRE_ACOPLAMENTO_CRM_ERP_PDV.md §5.1/§8;
--         DESENHO_PAGINA_DO_ACTOR.md §5 SELADO; SPEC_FATIA1_RELACAO_TIPADA.md; Opção B ratificada
--         por Clayton 2026-07-04 — a aresta é o CRM único).
--
-- O QUE É: a aresta actor↔actor com tipo GOVERNADO e classificação ASSIMÉTRICA (cada lado
-- classifica o outro pela sua ótica — requester_label no envio, target_label no aceite).
-- Um dado, N usos: social (plateias) · CRM (meus clientes/fornecedores/colaboradores) · B2B.
--
-- O QUE NÃO É (fronteiras duras, Lei de Coerência + DECISION-0113/0125):
--   · NÃO concede autoridade — nunca escreve company_users/canManageCompany/permissão;
--   · NÃO move dinheiro (Δbank=0);
--   · NÃO substitui follows (seguir coexiste; relação exige consentimento + classificação).
--
-- Vocabulário de tipo = CHECK constraint (07_NOMENCLATURA_CANONICA §4 — tipo social NÃO é
-- concepts nem tabela nova). Seed aprovado por Clayton (DESENHO §7):
--   PF↔PF {amigo, conhecido, familiar} · PF↔PJ {cliente, colaborador, fornecedor} ·
--   PJ↔PJ {fornecedor, cliente, parceiro}. Extensível por RFC (nova DECISION), não por feature.
-- O pareamento por tipo-de-actor (qual label vale para qual par PF/PJ) é validado no service
-- (fail-closed); o CHECK congela o vocabulário total.
--
-- PONTE Opção B: suppliers.actor_id (nullable) — quando o fornecedor É actor na plataforma, liga.
-- purchase_orders.supplier_id CONTINUA INTACTO (o fluxo vivo PO→inventário→a-pagar não regride;
-- esta migration NÃO toca purchase_orders). O ghost `contacts` morre na Fatia 7 (CRM projetado).
--
-- Forward-only idempotente-por-construção (CREATE novo + ADD COLUMN IF NOT EXISTS). Δbank=0.
-- ============================================================

BEGIN;

CREATE TABLE actor_relationships (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_actor_id         UUID        NOT NULL REFERENCES actors(id)  ON DELETE CASCADE,
  to_actor_id           UUID        NOT NULL REFERENCES actors(id)  ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_actor_relationships_status
    CHECK (status IN ('pending', 'accepted', 'rejected', 'removed', 'blocked')),
  -- como o FROM classifica o TO (obrigatório no envio — "no envio E no aceite", Clayton 2026-07-04)
  requester_label       TEXT        NOT NULL
    CONSTRAINT chk_actor_relationships_requester_label
    CHECK (requester_label IN ('amigo', 'conhecido', 'familiar', 'cliente', 'colaborador', 'fornecedor', 'parceiro')),
  -- como o TO classifica o FROM (NULL até o aceite; obrigatório ao aceitar — validado no service)
  target_label          TEXT
    CONSTRAINT chk_actor_relationships_target_label
    CHECK (target_label IS NULL OR target_label IN ('amigo', 'conhecido', 'familiar', 'cliente', 'colaborador', 'fornecedor', 'parceiro')),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at          TIMESTAMPTZ,
  -- auditoria (07_NOMENCLATURA_CANONICA §4.13): principal autenticado server-side, nunca client-declared
  created_by_user_id    UUID        NOT NULL,
  responded_by_user_id  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- não conecta consigo mesmo
  CONSTRAINT chk_actor_relationships_not_self CHECK (from_actor_id <> to_actor_id)
);

-- UNIQUE por par NÃO-ordenado: A→B e B→A são a MESMA aresta (uma relação por par; o lifecycle
-- vive no status da mesma linha — sem linhas duplicadas espelhadas).
CREATE UNIQUE INDEX uidx_actor_relationships_pair
  ON actor_relationships (tenant_id, LEAST(from_actor_id, to_actor_id), GREATEST(from_actor_id, to_actor_id));

CREATE INDEX idx_actor_relationships_from ON actor_relationships (tenant_id, from_actor_id, status);
CREATE INDEX idx_actor_relationships_to   ON actor_relationships (tenant_id, to_actor_id, status);

-- RLS tenant-scoped (relação é intra-tenant nesta fatia; cross-tenant = decisão de tenancy pendente).
-- ENABLE implica FORCE (invariante §1.4 do runbook RLS-live — sem gap novo no preflight).
ALTER TABLE actor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_relationships FORCE ROW LEVEL SECURITY;

CREATE POLICY actor_relationships_rls ON actor_relationships
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION actor_relationships_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_actor_relationships_updated_at
  BEFORE UPDATE ON actor_relationships
  FOR EACH ROW EXECUTE FUNCTION actor_relationships_bump_updated_at();

-- ── PONTE Opção B: suppliers ganha actor_id (nullable) ──────────────────────
-- Quando o fornecedor existe como actor, a aresta de relação (tipo=fornecedor) é o CRM;
-- o registro suppliers vira a âncora do fluxo de compra (purchase_orders.supplier_id INTACTO)
-- com resolução opcional via actor. Off-platform: actor_id fica NULL (registro externo).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES actors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_actor
  ON suppliers (tenant_id, actor_id) WHERE actor_id IS NOT NULL;

COMMIT;

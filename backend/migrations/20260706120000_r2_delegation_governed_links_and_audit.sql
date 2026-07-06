-- 20260706120000_r2_delegation_governed_links_and_audit.sql
-- R2.1 — Delegação / authorized links governados + trilha de auditoria (Lote L2, decisões D1-D5 de Clayton, 2026-07-06).
--
-- CONTEXTO NORMATIVO (00_AGENT_PROTOCOL §2.3.2 GATE):
--   Pilar: AUTORIDADE/identidade. SSOT: actor_delegations (SSOT_REGISTRY §5.16; delegação normativa
--   LEI_DE_COERENCIA §4.9/§4.9.9). Estrutura JÁ EXISTE (20260530493000) — esta migration ESTENDE, não duplica
--   (não cria segunda SSOT de delegação, §5.16 "não duplicar segunda SSOT de delegação"). Forward-only, ADITIVO:
--   todas as colunas novas são NULLABLE (as 9 linhas existentes ficam válidas; Lei 4 "estrutura prevalece"
--   preservada). ZERO bank_* (D4: escopo financeiro fica FORA de R2 até AP/AR DECISION-0114 + PORTA-1).
--
-- DECISÕES DE CLAYTON APLICADAS:
--   D1 (SIM, abrir R2): esta é a fatia R2.1 (schema-only; writer governado = R2.2, fatia própria com selo Yala).
--   D2 (dois eixos): `relationship_type` = VÍNCULO JURÍDICO-INSTITUCIONAL (enum governado por CHECK). A LOTAÇÃO
--       operacional (departamento: RH/warehouse/finance/admin/sales/operations) NÃO é coluna — vive como scope
--       estruturado em scopes_json (ex.: 'dept:warehouse'), preenchido pelo writer R2.2. Os dois eixos evoluem
--       independentes.
--   D3 (tabela de eventos): actor_delegation_events append-only (mesmo padrão de bank_splits/bank_ledger e de
--       financial_approval_policy_events). O `revoke` deixa de ser só flip de status — passa a gerar evento.
--   D4 (financeiro fora): nenhuma coluna/escopo de dinheiro aqui.
--   D5 (risco depois): nada de anti-laranja/credential-sharing nesta fatia (sub-frente própria pós R2.1-R2.3).
--
-- §4.9.9 (cadeia de delegação): `granted_by_actor_id` (quem concedeu, com que autoridade — o writer R2.2 valida
--   canManageCompany) + `previous_link_id` (referência ao elo anterior, encadeamento). `expires_at` (temporalidade)
--   já existia. O FECHO até actor humano §4.8 é enforçado pelo writer (R2.2), não por constraint de schema.
--
-- Idempotente onde a Lei 3 permite (ADD COLUMN IF NOT EXISTS para colunas nullable aditivas; CREATE TABLE IF NOT
-- EXISTS; CREATE INDEX IF NOT EXISTS; DROP TRIGGER IF EXISTS + CREATE). NÃO cria trigger que chame função inexistente.

-- ── 1. Colunas de vínculo governado + cadeia (§4.9.9) em actor_delegations ──────────────────────────────────

ALTER TABLE actor_delegations
  ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS granted_by_actor_id UUID,
  ADD COLUMN IF NOT EXISTS previous_link_id UUID;

-- Vocabulário governado de VÍNCULO JURÍDICO (D2, eixo 1). NULL permitido (linhas legadas + delegações genéricas
-- de company-members que ainda não classificam vínculo). Novo vínculo governado escolhe da lista fechada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_actor_delegations_relationship_type'
  ) THEN
    ALTER TABLE actor_delegations
      ADD CONSTRAINT chk_actor_delegations_relationship_type
      CHECK (
        relationship_type IS NULL OR relationship_type IN (
          'partner',              -- sócio
          'director',             -- diretor
          'administrator',        -- administrador
          'attorney',             -- procurador
          'legal_representative', -- responsável legal
          'employee',             -- funcionário (CLT/estatutário)
          'contractor'            -- prestador/terceiro
        )
      );
  END IF;
END $$;

-- previous_link_id: FK self (cadeia §4.9.9). ON DELETE SET NULL — apagar um elo anterior não apaga a cadeia inteira
-- (delegação é append-preferente; revoke é o caminho normal, não delete). Delegação legada tem previous_link_id NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_actor_delegations_previous_link'
  ) THEN
    ALTER TABLE actor_delegations
      ADD CONSTRAINT fk_actor_delegations_previous_link
      FOREIGN KEY (previous_link_id) REFERENCES actor_delegations (delegation_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN actor_delegations.relationship_type IS
  'R2/D2 eixo jurídico: tipo de vínculo institucional (partner/director/administrator/attorney/legal_representative/employee/contractor). Lotação/departamento vive em scopes_json (dept:*), NÃO aqui. Escrito pelo writer governado R2.2.';
COMMENT ON COLUMN actor_delegations.granted_by_actor_id IS
  'R2/§4.9.9: actor que concedeu esta delegação (autoridade validada no writer via canManageCompany). NULL em delegações legadas.';
COMMENT ON COLUMN actor_delegations.previous_link_id IS
  'R2/§4.9.9: elo anterior na cadeia de delegação (encadeamento). NULL = raiz da cadeia. FK self, ON DELETE SET NULL.';

-- ── 2. Trilha de auditoria append-only (D3) — actor_delegation_events ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS actor_delegation_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  delegation_id UUID NOT NULL REFERENCES actor_delegations (delegation_id),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('granted', 'revoked', 'expired')),
  -- actor que provocou o evento (concedente/revogador); NULL só para 'expired' (evento de sistema/tempo).
  actor_id UUID,
  relationship_type VARCHAR(40),  -- snapshot do vínculo no momento do evento (auditoria histórica)
  scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,  -- snapshot dos scopes no momento do evento
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actor_delegation_events_delegation
  ON actor_delegation_events (tenant_id, delegation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_actor_delegation_events_actor
  ON actor_delegation_events (tenant_id, actor_id);

-- Append-only: UPDATE e DELETE bloqueados (mesma doutrina de bank_splits/bank_ledger — trilha de autoridade não é
-- editável; correção = novo evento, nunca alterar/apagar). Idempotente.
CREATE OR REPLACE FUNCTION prevent_actor_delegation_events_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'actor_delegation_events is append-only. UPDATE or DELETE is not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actor_delegation_events_no_update ON actor_delegation_events;
CREATE TRIGGER actor_delegation_events_no_update
  BEFORE UPDATE ON actor_delegation_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_actor_delegation_events_modification();

DROP TRIGGER IF EXISTS actor_delegation_events_no_delete ON actor_delegation_events;
CREATE TRIGGER actor_delegation_events_no_delete
  BEFORE DELETE ON actor_delegation_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_actor_delegation_events_modification();

COMMENT ON TABLE actor_delegation_events IS
  'R2/D3: trilha append-only de grant/revoke/expire de delegações (§4.9.9 audit). Snapshot de relationship_type+scopes no momento do evento. Escrito pelo writer governado R2.2. UPDATE/DELETE bloqueados por trigger.';

-- 20260727110000_economic_policies_change_reason.sql
-- FATIA 2 (F-ECONOMIC-POLICY-ADMIN-FRONT) — write API de versoes de economic_policy.
--
-- ARTIGO XI da Constituicao ("emendas publicas, justificadas, nunca silenciosas"): toda nova
-- versao de uma economic_policy exige justificativa explicita do autor. change_reason materializa
-- essa exigencia como campo de primeira classe (nao string solta dentro de metadata) — auditavel,
-- consultavel, e protegido pelo MESMO trigger de imutabilidade que ja protege os demais campos
-- materiais de uma policy ATIVA (20260709140000 + extensao 20260727100000).
--
-- NULLABLE por decisao deliberada (nao omissao): o repository economicPolicyRepository.createPolicy
-- e usado por ~9 scripts E2E pre-existentes (PE-1/PE-3/PE-5/fiscal/refund) que nao fazem parte desta
-- fatia e nao passam change_reason — sao fixtures de teste que antecedem a existencia desta coluna.
-- Tornar a coluna NOT NULL quebraria esses ~9 chamadores fora do escopo mandatado (write API de
-- versionamento admin), abrindo um raio de blast nao autorizado. A garantia CONSTITUCIONAL
-- (obrigatoriedade + nao-vazio) e' aplicada pela CAMADA DE APLICACAO do write API novo (rejeita 400
-- antes de gravar — ver economic-policy-write-validation.ts, assertCreatePolicyVersionRequestValid) —
-- essa e' a leitura textual do mandato ("Reject with 400 if the reason is missing/empty"), nao uma
-- exigencia de NOT NULL no schema. O CHECK abaixo e' defesa em profundidade complementar: se um
-- valor for gravado, ele nao pode ser uma string vazia/so-espacos (fecha o contorno trivial da
-- validacao de aplicacao por quem grava fora dela).
--
-- Bank-free: esta migration nao cria, altera nem referencia bank_ledger/bank_transactions/
-- bank_splits/bank_accounts. economic_policies continua substrato de REGRA (delta zero no Bank).

BEGIN;

ALTER TABLE economic_policies
  ADD COLUMN change_reason TEXT;

ALTER TABLE economic_policies
  ADD CONSTRAINT chk_economic_policies_change_reason_not_blank
  CHECK (change_reason IS NULL OR length(btrim(change_reason)) > 0);

COMMENT ON COLUMN economic_policies.change_reason IS
  'ARTIGO XI da Constituicao ("emendas publicas, justificadas, nunca silenciosas"): justificativa
   do autor para esta VERSAO da policy. Obrigatorio por CAMADA DE APLICACAO em toda gravacao via o
   write API admin (POST /economy/admin/policies rejeita ausencia/vazio com 400 antes do INSERT) —
   NULLABLE no schema apenas para nao quebrar chamadores pre-existentes de
   economicPolicyRepository.createPolicy (fixtures E2E de fatias anteriores, fora deste escopo).
   Protegido pelo mesmo trigger de imutabilidade de policy ATIVA
   (enforce_economic_policies_immutability) — nao pode ser reescrito depois que a versao explicou
   dinheiro passado.';

-- Estende a trava de imutabilidade de policy ATIVA (20260709140000, ja estendida por 20260727100000
-- para os seletores territoriais) para tambem proteger change_reason — mesmo motivo: coluna nova
-- nao pode escapar da comparacao NEW IS DISTINCT FROM OLD por omissao. CREATE OR REPLACE FUNCTION e'
-- a excecao idempotente permitida pela Lei 3; o corpo e' o MESMO da migration anterior + este campo.
CREATE OR REPLACE FUNCTION enforce_economic_policies_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies is append-only for % policies: DELETE not allowed (policy %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'economic_policies: deprecated policy % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies: active policy % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.policy_code IS DISTINCT FROM OLD.policy_code
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.policy_type IS DISTINCT FROM OLD.policy_type
      OR NEW.module_context IS DISTINCT FROM OLD.module_context
      OR NEW.vertical IS DISTINCT FROM OLD.vertical
      OR NEW.actor_type IS DISTINCT FROM OLD.actor_type
      OR NEW.service_type IS DISTINCT FROM OLD.service_type
      OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
      OR NEW.settlement_flow IS DISTINCT FROM OLD.settlement_flow
      OR NEW.country IS DISTINCT FROM OLD.country
      OR NEW.region IS DISTINCT FROM OLD.region
      OR NEW.city IS DISTINCT FROM OLD.city
      OR NEW.country_id IS DISTINCT FROM OLD.country_id
      OR NEW.state_id IS DISTINCT FROM OLD.state_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.change_reason IS DISTINCT FROM OLD.change_reason
    THEN
      RAISE EXCEPTION
        'economic_policies: active policy % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for rule changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    -- permitidos: effective_until (encerramento controlado), status active→deprecated, updated_at.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger ja existe (economic_policies_immutability) e aponta para a mesma function por nome —
-- CREATE OR REPLACE FUNCTION acima ja e' suficiente para o novo corpo valer.

COMMIT;

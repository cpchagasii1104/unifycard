-- FISCAL 4D-1-R (DECISION-0167 §8; remediação consolidada pós-auditoria Yala, Veredito C) —
-- ENFORCEMENT DE BANCO: torna IMPOSSÍVEL, em qualquer caminho SQL, que uma regra fiscal ATIVA
-- exista sem rounding_mode, ou que o modo de uma regra ativa seja alterado depois de ativada.
--
-- Repository (activateRule) e guard já fazem a checagem em CÓDIGO — mas nem repository nem guard
-- substituem constraint (Lei do Contador: o dado governado precisa estar protegido no schema, não
-- só na aplicação). Esta migration fecha as 3 lacunas provadas read-only pelo GATE de remediação:
--   GAP-1: INSERT direto status='active' + rounding_mode=NULL — bypassava o repository.
--   GAP-2: INSERT draft NULL → UPDATE direto status='active' — bypassava activateRule.
--   GAP-3: regra ativa válida → UPDATE rounding_mode para outro valor — o trigger de imutabilidade
--          (migration 20260710140000, enforce_tax_rules_immutability) enumera os campos materiais
--          protegidos por nome; rounding_mode nasceu DEPOIS (4d-1) e ainda não estava na lista.
--
-- Como tax_rules=0 no baseline: CHECK validado IMEDIATAMENTE (zero NOT VALID, zero backfill, zero
-- UPDATE, zero seed, zero tratamento de dado histórico — não há dado histórico).
--
-- Vocabulário de rounding_mode INTOCADO (half_up|half_even|floor|ceil); zero DEFAULT (a coluna
-- draft continua NULLABLE — só a combinação status='active' + rounding_mode NULL é proibida).

BEGIN;

-- (1) GAP-1 + GAP-2: nenhuma linha pode existir com status='active' e rounding_mode NULL —
-- fecha tanto INSERT direto quanto qualquer UPDATE que produza esse estado final (inclui
-- draft→active sem passar por activateRule).
ALTER TABLE tax_rules
  ADD CONSTRAINT chk_tax_rules_active_requires_rounding
  CHECK (status <> 'active' OR rounding_mode IS NOT NULL);

-- (2) GAP-3: reforço ESTREITO da função canônica de imutabilidade (CREATE OR REPLACE — Lei 3
-- "functions são substituíveis"; a trigger já existente não é duplicada nem recriada em paralelo).
-- Adiciona rounding_mode à lista de campos materiais protegidos quando OLD.status='active' —
-- mesmo padrão dos demais campos já enumerados (rate_bps, source, etc.). active→deprecated
-- continua permitido; deprecated permanece terminal (comportamento pré-existente inalterado).
CREATE OR REPLACE FUNCTION enforce_tax_rules_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'tax_rules is append-only for % rules: DELETE not allowed (rule %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'tax_rules: deprecated rule % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'tax_rules: active rule % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.tax_type_id IS DISTINCT FROM OLD.tax_type_id
      OR NEW.scope_level IS DISTINCT FROM OLD.scope_level
      OR NEW.taxpayer_kind IS DISTINCT FROM OLD.taxpayer_kind
      OR NEW.platform_revenue_stream IS DISTINCT FROM OLD.platform_revenue_stream
      OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
      OR NEW.concept_id IS DISTINCT FROM OLD.concept_id
      OR NEW.country_id IS DISTINCT FROM OLD.country_id
      OR NEW.state_id IS DISTINCT FROM OLD.state_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.rate_bps IS DISTINCT FROM OLD.rate_bps
      OR NEW.rounding_mode IS DISTINCT FROM OLD.rounding_mode
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.configured_by_actor_id IS DISTINCT FROM OLD.configured_by_actor_id
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'tax_rules: active rule % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON CONSTRAINT chk_tax_rules_active_requires_rounding ON tax_rules IS
  'FISCAL 4D-1-R (remediacao Yala Veredito C): status=active exige rounding_mode governado (DECISION-0167 par.8). Draft permanece NULLABLE. Zero default fiscal silencioso.';

COMMIT;

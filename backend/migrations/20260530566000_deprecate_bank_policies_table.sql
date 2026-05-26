-- ============================================================
-- DECISION-0048: Hard-deprecate bank_policies como fonte de policy
-- de split / decisão econômica.
-- ============================================================
-- Sessão: 2026-05-26 (convergência pós-PE-1).
--
-- bank_policies (chave-valor JSONB) foi historicamente o policy
-- registry hierárquico do split engine antigo (bank-split-engine.
-- service + bank-policy.service.resolveSplitPolicy). PE-1 + DECISION-
-- 0048 declaram economic_policies + economic_policy_engine como
-- resolvedor canônico ÚNICO de policy econômica para fluxos novos.
--
-- bank_policies NÃO é dropada agora porque:
--   - bank-limit.service.ts ainda usa bankPolicyService.getPolicy<T>()
--     para configurar limites operacionais (defaultLimit). Esse uso
--     é distinto de split policy e legítimo.
--   - 0 rows em produção/dev — sem migração de dados a fazer.
--
-- Após esta migration:
--   - bankPolicyService.resolveSplitPolicy() removido em código (não
--     há mais caller).
--   - bankPolicyService.setPolicy() removido em código.
--   - Apenas bankPolicyService.getPolicy() permanece (limites).
--   - Guardrail NO_LEGACY_BANK_POLICY_SERVICE_IMPORT em
--     validate-architectural-patterns.mjs impede novo import fora
--     da allowlist (bank-policy.service / bank-limit.service).
--
-- Remoção física da tabela será frente própria após bank-limit.service
-- migrar para tabela dedicada de limites. Rastreado em
-- DT-BANK-POLICIES-PHYSICAL-REMOVAL.
--
-- Reversibilidade: ALTA. Blast: ZERO (apenas COMMENT).
-- ============================================================

BEGIN;

COMMENT ON TABLE bank_policies IS
  'DEPRECATED 2026-05-26 (DECISION-0048). NÃO usar como fonte de policy
   econômica/split em fluxos novos — usar economic_policies +
   economic_policy_engine. Preservada porque bank-limit.service ainda
   usa getPolicy<T>() para limites operacionais (uso distinto de
   split). Remoção física rastreada em DT-BANK-POLICIES-PHYSICAL-REMOVAL.';

COMMIT;

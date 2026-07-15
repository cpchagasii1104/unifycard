-- FISCAL 4D-1 (DECISION-0167 §8; GO material D9.7 2026-07-14) — rounding_mode como DADO GOVERNADO da regra.
--
-- Arredondamento fiscal é norma de jurisdição, não detalhe de código (Lei do Contador). A coluna é
-- CONFIGURAÇÃO da regra: draft pode nascer sem (NULL); regra ATIVA não pode permanecer sem —
-- `activateRule` falha fechado antes de ativar draft sem rounding_mode. ZERO default fiscal
-- silencioso: nenhum DEFAULT aqui, nenhuma escolha automática pelo motor, nenhum fallback.
--
-- Vocabulário governado (registrado em ROUNDING_MODES/tax-catalog.types + manifesto de vocabulários;
-- semânticas matemáticas padrão — a ESCOLHA por regra é do contribuinte/contador via configuração):
--   half_up   — arredonda 0.5 para cima
--   half_even — banker's rounding (0.5 para o par)
--   floor     — trunca para baixo
--   ceil      — arredonda para cima
--
-- NÃO faz: backfill (tax_rules=0 no baseline), criação/ativação de regra, mudança de rate_bps,
-- toque em applies_to (4d-2), toque em Bank. Guard 4c-3 permanece byte-intacto.

BEGIN;

ALTER TABLE tax_rules
  ADD COLUMN rounding_mode TEXT NULL
    CONSTRAINT chk_tax_rules_rounding_mode
      CHECK (rounding_mode IS NULL OR rounding_mode IN ('half_up', 'half_even', 'floor', 'ceil'));

COMMENT ON COLUMN tax_rules.rounding_mode IS
  'DECISION-0167 §8: modo de arredondamento GOVERNADO da regra (half_up|half_even|floor|ceil). '
  'Draft pode ser NULL; ativação exige valor (activateRule fail-closed). Sem default silencioso.';

COMMIT;

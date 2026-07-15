-- FISCAL 4D-2 (DECISION-0178; GO material próprio de Clayton 2026-07-15) — extensão governada de
-- economic_policy_lines.applies_to e composição fiscal × policy.
--
-- Esta migration é a inversão CONSCIENTE, forward-only, da fronteira que o guard 4c-3 mantinha de
-- propósito (applies_to permanecia gross|net até a fatia 4d-2). Ela materializa o VOCABULÁRIO FÍSICO
-- de 5 valores decidido em DECISION-0178 D1:
--
--   VALORES FÍSICOS (CHECK): gross | net | gross_transaction | commission_gross | commission_distributable
--   VALORES GRAVÁVEIS (writer+tipos+manifesto+guard): gross_transaction | commission_gross | commission_distributable
--   LEGADOS READ-ONLY (preservados p/ histórico congelado): gross | net
--
-- O CHECK físico aceita 5 valores porque as 75 linhas históricas 'gross' vivem sob 45 policies
-- deprecated CONGELADAS pelo trigger economic_policy_lines_freeze (remover 'gross' do CHECK seria
-- incompatível com o histórico imutável — DECISION-0178, fatos materiais). A trava dos 3 graváveis
-- NÃO é do CHECK (que não distingue histórico de gravação nova): é do writer/tipos/manifesto/guard.
--
-- NÃO faz: backfill, UPDATE, seed, conversão de gross/net, recálculo histórico, reativação de policy
-- deprecated, tabela/função/trigger nova, toque em Bank, tax_reserve (line_type é a 4e). A coluna
-- permanece NOT NULL; o DEFAULT 'gross' é REMOVIDO (D2 — base vira intenção explícita do caller
-- governado; ausência falha fechado no writer). CHECK validado IMEDIATAMENTE (sem NOT VALID): as 75
-- linhas 'gross' já satisfazem o novo conjunto, zero linha alterada.

BEGIN;

-- D2: remove o DEFAULT 'gross' (base deixa de ser decidida pelo banco por conveniência).
ALTER TABLE economic_policy_lines ALTER COLUMN applies_to DROP DEFAULT;

-- D1: substitui conscientemente o CHECK gross|net pelo vocabulário físico de 5 valores.
-- Validação imediata (sem NOT VALID): as linhas existentes ('gross') pertencem ao novo conjunto.
ALTER TABLE economic_policy_lines DROP CONSTRAINT economic_policy_lines_applies_to_check;
ALTER TABLE economic_policy_lines ADD CONSTRAINT economic_policy_lines_applies_to_check
  CHECK (applies_to IN ('gross', 'net', 'gross_transaction', 'commission_gross', 'commission_distributable'));

COMMENT ON COLUMN economic_policy_lines.applies_to IS
  'DECISION-0178 (FISCAL 4D-2): base de cálculo. Físico (CHECK) = 5 valores. '
  'Graváveis (writer/tipos/manifesto/guard) = gross_transaction|commission_gross|commission_distributable. '
  'Legados READ-ONLY (histórico congelado) = gross|net — NUNCA graváveis por novo writer, NUNCA aliases. '
  'Sem DEFAULT: base é intenção explícita do caller governado (ausência falha fechado).';

COMMIT;

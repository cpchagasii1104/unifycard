-- ============================================================
-- DECISION-0049: regional_origin_basis em economic_policy_lines
-- ============================================================
-- Sessão: 2026-05-26 (rodada Clayton + ChatGPT pós PE-4-METRICS).
--
-- CONTRATO: quando policy line é regional_fund DINÂMICO (sem
-- destination_key explícito), policy DEVE declarar qual ORIGEM
-- regional usar — engine não interpreta intenção.
--
-- Enum canônico (7 valores; mixed_policy NÃO está aqui — composição
-- é via MÚLTIPLAS linhas regional_fund, não via valor de enum):
--
--   payer_identity_residence       — RESIDENCE do CPF do payer
--   receiver_identity_residence    — RESIDENCE do CPF do receiver
--   receiver_company_operational   — OPERATIONAL do CNPJ do receiver
--   receiver_company_hq            — HQ do CNPJ do receiver (SÓ se policy
--                                    declarar explicitamente; NUNCA fallback)
--   service_location               — endereço do service/booking
--   transaction_location           — endereço do canal/loja
--   explicit_economic_region       — destination_key carrega economic_region_id
--                                    (mas se key existir, basis pode ser NULL)
--
-- Regras inegociáveis:
--   1. CNPJ identifica a entidade; actor identifica unidade/papel;
--      OPERATIONAL identifica onde impacta.
--   2. PJ default = receiver_company_operational. HQ só explícito.
--   3. NUNCA fallback automático no resolver. Se OPERATIONAL pedido e
--      ausente, falha POLICY_REGIONAL_ORIGIN_UNRESOLVABLE.
--   4. Métrica pública deduplica por identidade, não por actor (já
--      provado em PE-4-METRICS).
--   5. mixed_policy = padrão de USO via múltiplas linhas regional_fund,
--      cada uma com seu basis próprio. NÃO é valor de enum.
--
-- Pré-condição: 0 rows em economic_policy_lines com line_type='regional_fund'
-- (confirmado em audit pré-migration). Sem backfill necessário.
--
-- Resolver dinâmico continua FAIL-CLOSED em PE-3 / resolveSplitDestinationFromPolicy.
-- Esta migration entrega APENAS contrato/schema; resolver dinâmico é frente
-- futura, condicional a DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL.
--
-- Reversibilidade: ALTA (DROP CONSTRAINT + DROP COLUMN). Blast: ZERO (0 rows).
-- ============================================================

BEGIN;

ALTER TABLE economic_policy_lines
  ADD COLUMN regional_origin_basis TEXT;

-- CHECK 1: quando line_type='regional_fund' E destination_key IS NULL
-- (resolução dinâmica), regional_origin_basis É OBRIGATÓRIO.
ALTER TABLE economic_policy_lines
  ADD CONSTRAINT chk_origin_basis_required_for_dynamic_regional
  CHECK (
    NOT (
      line_type = 'regional_fund'
      AND destination_key IS NULL
      AND regional_origin_basis IS NULL
    )
  );

-- CHECK 2: enum canônico (mixed_policy NÃO está aqui).
ALTER TABLE economic_policy_lines
  ADD CONSTRAINT chk_origin_basis_canonical_values
  CHECK (
    regional_origin_basis IS NULL
    OR regional_origin_basis IN (
      'payer_identity_residence',
      'receiver_identity_residence',
      'receiver_company_operational',
      'receiver_company_hq',
      'service_location',
      'transaction_location',
      'explicit_economic_region'
    )
  );

COMMENT ON COLUMN economic_policy_lines.regional_origin_basis IS
  'DECISION-0049 (2026-05-26). Quando regional_fund DINÂMICO (line_type=
   ''regional_fund'' AND destination_key IS NULL), basis OBRIGATÓRIO via
   CHECK chk_origin_basis_required_for_dynamic_regional. Resolver NUNCA
   faz fallback entre basis: se OPERATIONAL pedido e actor não tem
   address_assignments(role=''OPERATIONAL''), falha
   POLICY_REGIONAL_ORIGIN_UNRESOLVABLE. Para HQ, policy declara basis=
   receiver_company_hq EXPLICITAMENTE em outra linha (ou única).
   mixed_policy = composição via múltiplas linhas regional_fund,
   NUNCA valor de enum. Vide CORE_SPLIT_PAGAMENTO_CANONICO.md §9.4.';

COMMIT;

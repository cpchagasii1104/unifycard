# RFC C2 — Seed de concepts financeiros

**Status:** DECIDIDO · aprovado · 2026-04-24
**Remete a:** RFC_C2_rollout.md (Opção B — commit 706b61af). Este RFC cobre o Passo 2 do rollout: seed de concepts financeiros antes dos writers receberem `concept_id` obrigatório.

## 1. Contexto e 3 Regras Duras (herdadas do escopo)

**Regra 1** — Concept = intenção econômica atômica, não nome de serviço. Operações com propósito ou direção distintos → concepts distintos.
**Regra 2** — Fluxos com a mesma mutação no ledger → mesmo concept.
**Regra 3** — Cada concept deve ser inferível do par débito/crédito no ledger, nunca de metadata.

## 2. Domínios identificados

Baseado nos 44 call sites lidos (SRC_FULL.txt — todos com `referenceType` ou `context` explícitos):

| Domínio | Descrição |
|---|---|
| `financeiro-payment` | Pagamentos iniciados por usuário (marketplace, evento, serviço, grupo, corrida) |
| `financeiro-escrow` | Retenção e liberação de garantia |
| `financeiro-payout` | Repasses a sellers/destinatários finais |
| `financeiro-treasury` | Distribuições internas de tesouraria |
| `financeiro-reversal` | Estornos de transações anteriores |
| `financeiro-fund` | Alocações para fundos regionais/governance |
| `financeiro-gateway` | Liquidações com parceiros externos (PIX, bank_settlement) |

Domínios **não usados** (sem evidência no código): `financeiro-p2p`, `financeiro-split` (splits são efeito de payment, não concept próprio).

## 3. Convenção proposta

**Padrão observado nos concepts existentes (MIGRATIONS_FULL.txt):**
- Slug: `kebab-case` — ex: `arroz-branco-tipo-1`, `medico-clinico-geral`, `varejo-alimentar-integrado`
- Domain: `kebab-case` com semântica de domínio — ex: `item-comercial`, `servicos`, `mobilidade-e-logistica`, `produtos-e-comercio`
- Não há prefixo fixo no slug; o domain já discrimina o universo.

**Convenção proposta para concepts financeiros:**
- Domain: `financeiro-<categoria>` (kebab-case, alinha com padrão existente)
- Slug: verbo-objeto em kebab-case, descrevendo a mutação — ex: `escrow-hold`, `seller-payout`, `treasury-regional-fund-distribution`
- Não reaproveitar concepts existentes (nenhum dos ~63 existentes é de operação financeira).

**Nota arquitetural — acoplamento:** os concepts financeiros referenciam o papel econômico de contas (ex: “fundo regional”, “reserva sistêmica”), não o nome literal de tabelas ou IDs de conta no schema atual. Se uma conta for renomeada ou refatorada mantendo o mesmo papel econômico, o concept permanece válido. Apenas mudanças de arquitetura econômica (ex: unificação de fundos distintos em pool único) exigem revisão do concept.

## 4. Mapeamento fluxo → concept

| Arquivo | Mutação no ledger (débito → crédito) | domain | slug |
|---|---|---|---|
| `bank-integration.ts` (event_ticket) + `event-economy.service.ts` (event_ticket) | buyer_account → organizer_account + splits internos | `financeiro-payment` | `event-ticket-payment` |
| `bank-integration.ts` (event_consumption) | buyer_account → organizer_account + splits — **Regra 2: mesma mutação que event_ticket** (L120170: "mesmo split de ingresso"; `context: 'event_ticket'` idêntico; `type: 'event_consumption'` em metadata — Regra 3 proíbe usar como discriminador) | `financeiro-payment` | `event-ticket-payment` **(unificado)** |
| `bank-integration.ts` (service_booking) | buyer_account → provider_account + splits | `financeiro-payment` | `service-booking-payment` |
| `bank-integration.ts` (service_execution / referenceType `service_execution`) | from_account → splitLines explícitas (provider + platform) | `financeiro-payment` | `service-execution-payment` |
| `bank-integration.ts` (group_contribution) | contributor_account → group_account + splits | `financeiro-payment` | `group-contribution-payment` |
| `bank-integration.ts` (ride_payment) | passenger_account → driver + fee + regional + group (splitLines) | `financeiro-payment` | `ride-payment` |
| `escrow.service.ts` (release — milestone) | escrow_account → recipient_account | `financeiro-escrow` | `escrow-release-to-recipient` |
| `escrow.service.ts` (refund) | escrow_account → payer_account | `financeiro-escrow` | `escrow-refund-to-payer` |
| `event-payment-execution.service.ts` (`event_payment_release`) | escrow_account → owner_account | `financeiro-escrow` | `escrow-release-to-recipient` |
| `governance-funding-commitment-worker.ts` (`governance_funding_commitment`) | treasury_account → escrow_account — **Regra 2:** entrada em escrow; mesmo concept que qualquer outro hold (contexto governance fica em referenceType) | `financeiro-escrow` | `escrow-hold` |
| `payment-event-resolver.ts` (`seller_release`) | seller_pending_account → seller_available_account | `financeiro-payout` | `seller-funds-release` |
| `payout.service.ts` (`marketplace_payout`) + `payout-worker.ts` (`seller_payout`) | platform_account / seller_available → recipient / seller_payout | `financeiro-payout` | `seller-payout` |
| `capacity-application.service.ts` (`resource_compensation`) | platform_revenue_account → dest_account | `financeiro-payout` | `resource-compensation-payout` |
| `treasury-split.service.ts` (`treasury_split_leg` → regional_fund) | source_account → regional_fund_account | `financeiro-treasury` | `treasury-regional-fund-distribution` |
| `treasury-split.service.ts` (`treasury_split_leg` → community_fund) | source_account → community_fund_account | `financeiro-treasury` | `treasury-community-fund-distribution` |
| `treasury-split.service.ts` (`treasury_split_leg` → system_reserve) | source_account → system_reserve_account | `financeiro-treasury` | `treasury-system-reserve-distribution` |
| `treasury-split.service.ts` (`treasury_split_leg` → governance_pool) | source_account → governance_pool_account | `financeiro-treasury` | `treasury-governance-pool-distribution` |

> **Nota (Ajuste C):** os 4 concepts de treasury são separados por decisão de governança — cada fundo tem governança distinta, regras de uso distintas e relatórios financeiros distintos. Não é apenas diferença de destino: é diferença de propósito econômico institucional. Se no futuro a governança desses fundos for unificada, esta separação deve ser revisada.

| `ledger-compensation.service.ts` (`ledger_compensation`) | original_receiver_account → original_payer_account | `financeiro-reversal` | `ledger-compensation` |
| `reversal.service.ts` (`financial_reversal_leg`) | from_account → to_account (inverso de split leg) | `financeiro-reversal` | `transaction-reversal-leg` |
| `reversal.service.ts` (`financial_reversal`) | from_account → to_account (inverso de tx completa) | `financeiro-reversal` | `transaction-reversal` |
| `regional-fund.service.ts` (`regional_fund_bank_topup`) | reserve_account → regional_fund_account | `financeiro-fund` | `regional-fund-topup` |
| `marketplace-orchestration.service.ts` (`regional_fund_incentive`) | regional_fund_account → recipient_account | `financeiro-fund` | `regional-fund-incentive-grant` |
| `bank-settlement-worker.ts` (`bank_settlement`) | seller_payout_account → bank_settlement_account | `financeiro-gateway` | `bank-external-settlement` |
| `payment-event-resolver.ts` L150712 (`PIX_PAYMENT_CONFIRMED`) | escrow_account → actor_wallet_account | `financeiro-gateway` | `pix-payment-received` |
| `financial.commands.ts` / `bank-ledger.service.ts` (B2B intent) | buyer_account → supplier_account | `financeiro-payment` | `b2b-payment` |

| `financial-simulator.controller.ts` (`simulation_deposit`) | system_reserve_account → buyer_wallet_account — sem equivalente no mapeamento; repasse de reserva a destinatário final | `financeiro-payout` | `system-reserve-credit` |
| `financial-simulator.controller.ts` (`simulation_payment`) | buyer_wallet_account → escrow_account — **Regra 2:** entrada em escrow; mesmo concept que qualquer outro hold | `financeiro-escrow` | `escrow-hold` |

**Total: 24 concepts.** (Dentro do critério 15–30.)

## 5. Pendências e casos especiais

**Excluído do mapeamento — não precisa de concept:**
- `payment-event-resolver.ts` L150597 (`markExternallySettledByReference`) — UPDATE em `internal_completed_at`, não INSERT. Não cria linha no ledger.
- `transaction.service.ts` (legacy wrapper) — `referenceType` é passado pelo caller; o concept é determinado pelo chamador, não pelo wrapper.

## 6. Autoavaliação (4 critérios do escopo)

| Critério | Resultado |
|---|---|
| Total de concepts ≤ 40 | ✅ 24 concepts |
| Algum nome genérico ("payment", "transfer")? | ✅ Não — todos qualificados com contexto |
| Algum concept baseado em nome de arquivo? | ✅ Não — baseados em `referenceType` + par débito/crédito |
| Algum concept sem "Mutação no ledger" preenchida? | ✅ Nenhuma — todas as pendências resolvidas |

## 7. Critério de saída

Clayton valida a tabela do §4. Decisão necessária antes de avançar:
1. Aprovar ou ajustar os 24 concepts (slug, domain, agrupamento).
RFC atualizado com `DECISÃO: aprovado — <data>`. Só então: migration de seed (Passo 2 do rollout).

## 8. Fora do escopo

- SQL de seed (migration Passo 2 — RFC separado não necessário; segue direto para migration)
- `concept_resolution_status` dos concepts financeiros (todos `confirmed` por definição — operações canônicas)
- Coexistência com enum `transfer_purpose`
- Mapeamento de concepts para `canonical_products` (irrelevante — concepts financeiros não são produtos)

## 9. Decisão

**DECISÃO: APROVADO** — 2026-04-24 — 24 concepts validados em 3 camadas independentes de auditoria (Opus, Claude Sonnet, ChatGPT). Regras 1/2/3 aplicadas consistentemente; zero concepts genéricos; zero dependência de metadata para discriminação; acoplamento ancorado em papel econômico (não em nome literal de conta). Próximo passo: migration de seed (Passo 2 da Opção B do rollout).

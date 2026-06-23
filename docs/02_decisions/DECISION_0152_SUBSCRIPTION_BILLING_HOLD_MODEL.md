# DECISION-0152 — Subscription/Recurring Billing: HOLD até Camada 1 + Quarentena · DECISION_SUBSCRIPTION_MODEL

**Status:** **PROMULGADA / DECISÃO DE MODELO (DOMÍNIO FINANCEIRO) / DOCS + GUARD** (Clayton 2026-06-23). Declara que billing recorrente é HOLD e quarentena os fragmentos. **NÃO** implementa assinatura.
**Data:** 2026-06-23 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `f699439e` · **Insumo:** `docs/subscription/SUBSCRIPTION_MODEL_DECISION_PACK.md`.
**Deriva de / coerente com:** DECISION-0110 (firewall financeiro) · DECISION-0021/0022 (bank_ledger/splits append-only SSOT) · DECISION-0149/runbook RLS-live · arco payout (PORTA-1/recovery/execution). Ordem: SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO/ENTITLEMENT → ESTADO → **FINANCEIRO**.

---

## §A — A DECISÃO (soberana de Clayton)
1. **Assinatura recorrente é DOMÍNIO FINANCEIRO.** A essência é o **ciclo de cobrança recorrente** → PaymentIntent → `bank_ledger` (SSOT append-only). Logo é **HOLD** até a **Camada 1 financeira** (pós **RLS-live** + **PORTA-1** + **payment-execution seguro**).
2. **Pré-money NÃO terá billing recorrente novo.** **Entitlement/membership** pré-money permanece em **`access_passes`** (`access_pass_products` + `actor_access_passes`) — acesso temporal one-time, **sem** cobrança recorrente. **NÃO** transformar access_passes em billing recorrente.
3. **Modelo FUTURO preferido (quando o dinheiro ligar):** **recurring-order reusando `order` + `bank_ledger`** — SSOT único, **sem ledger paralelo**, sem "subscription ledger". `organizer_subscriptions` (gateway externo) é caso legado/adjacente que converge ou fica isolado por decisão própria.
4. **NÃO reviver agora:** módulo Sprint87 `src/modules/subscriptions` (DEAD, toca payment-execution/PaymentIntent) · stub `marketplace-subscriptions` · contrato FROZEN · rota frontend comentada.

## §B — Classificação dos fragmentos (de 1ª mão)
| Fragmento | Estado | Tratamento |
|---|---|---|
| `organizer_subscriptions` + `organizer-billing.service` | VIVO (billing organizer, gateway externo) | legado específico — não mexer sem READ-FIRST próprio |
| `src/modules/subscriptions` (Sprint87, routes/service/repo) | **DEAD** (sem tabela; toca PaymentIntent/payment-execution) | **QUARENTENA** — não registrar (guard) |
| `marketplace-subscriptions.routes/service` | **STUB** (in-memory, rota TODO vazia) | **QUARENTENA** — permanecer stub (guard) |
| `Subscription.contract.ts` | FROZEN (v1, não implementado) | manter congelado |
| `access_passes` (products + actor) | **VIVO** | entitlement pré-money canônico (não vira billing) |
| frontend `SubscriptionsPage` | rota **COMENTADA** (DT-MODULE-SUBSCRIPTIONS-FANTASMA) | **QUARENTENA** — manter comentada (guard) |

## §C — Guard (anti-revival)
`audit-subscription-billing-quarantined.mjs` (cadeia regression-guards) MORDE se: (1) o módulo Sprint87 for registrado em runtime; (2) o stub marketplace-subscriptions ganhar rota/billing real; (3) o frontend reabilitar `<Route path="subscriptions">`. NP: registrar Sprint87 → morde; reabrir rota frontend → morde.

## §D — HOLD explícito (Camada 1 financeira)
ciclo de cobrança · PaymentIntent recorrente · invoice · recurring order · `bank_*` · gateway billing · worker de cobrança · retry/dunning · payout · settlement. Tudo só após RLS-live + PORTA-1 + payment-execution.

## §E — Materialização
- **AGORA:** guard de quarentena (esta fatia). **Zero dinheiro/runtime de billing.**
- **FUTURO (pós-money):** `F-SUBSCRIPTION-BILLING-CORE` — Opção B (recurring-order reusando order+ledger). Só após Camada 1, com DECISION/flag explícita.

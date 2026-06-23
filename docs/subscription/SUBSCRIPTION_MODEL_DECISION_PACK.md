# Decision Pack — Subscription/Recurrence Model (DECISION_SUBSCRIPTION_MODEL · P8)

**Data:** 2026-06-23 · **HEAD:** `b704f561` · **Tipo:** DECISION PACK (READ-FIRST, **docs-only — nada implementado**) · **Branch:** `rescue-structural`
**Para:** Clayton decidir o modelo canônico de assinatura. Ordem: SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → **FINANCEIRO**.

## 1. Estado atual (de 1ª mão) — landscape FRAGMENTADO (4+ peças)
| Peça | Estado | O que é |
|---|---|---|
| `organizer_subscriptions` (tabela) + `organizer-billing.service` | **REAL_CHAIN (vivo)** | MODELO 1: plano de organizer de evento (free/basic/pro/enterprise); period start/end; **payment_gateway externo (stripe/pagarme)**; sem coluna de preço (cobrança fora). |
| `src/modules/subscriptions/{routes,service,repository}` (Sprint 87) | **DEAD_CODE** | MODELO 2: recorrência contact+payment_link+amount+interval+next_run_at+PaymentIntent. **Tabela `subscriptions` NÃO existe** (0194 em archive, não aplicada); rotas não registradas; zero imports. Toca payment-execution. |
| `marketplace-subscriptions.service` (in-memory) + `Subscription.contract.ts` | **STUB / CONTRACT_ONLY** | MODELO marketplace: orquestra Order→Checkout→PaymentPlan; estado em `Map` (não persiste); contrato v1 FROZEN não implementado; rota = TODO vazio. |
| `access_pass_products` + `actor_access_passes` (tabelas) | **REAL_CHAIN (vivo)** | MODELO 3: membership/passe **one-time** com duração → `commission_override_bps`. NÃO é recorrência, mas é o substrato de **entitlement temporal** (active/expired). |
| `subscription-expiration.job` | **LATENTE** | Sem scheduler chamando; faz downgrade de plano (organizer). |
| Frontend `SubscriptionsPage` | **rota COMENTADA** | escondida p/ evitar HTTP 500 (sem backend). |

## 2. O achado que decide tudo: **assinatura = cobrança recorrente = MONEY**
> Diferente de locação (que tem espinha pré-money limpa = recurso-no-tempo), a **essência** de assinatura é o **ciclo de cobrança recorrente** → PaymentIntent → `bank_ledger` (append-only SSOT, **HOLD**).
- Toda peça "real" de recorrência (Sprint 87, marketplace-subscriptions cycle) cria **Order→Checkout→Payment** ou **PaymentIntent→payment-execution** = **dinheiro**.
- `bank_ledger` está HOLD (Camada 1 financeira não ligada; depende de RLS-live + PORTA-1 + payment-execution).
- ⚠️ Os agentes recomendaram **reviver `subscription.service` (Sprint 87)** como SSOT — **mas ele toca PaymentIntent/payment-execution**. Revivê-lo agora violaria DINHEIRO FORA. **Não revivê-lo.**

**Conclusão:** **não há MVP de billing de assinatura pré-money** — billing É dinheiro. O único pedaço pré-money é **entitlement/acesso temporal**, que **já existe** (`access_passes`).

## 3. Opções
**Opção A — Entitlement-first (pré-money possível)**
- subscription = **direito de acesso temporal** (active/expired) SEM cobrança; a cobrança é concern separado da Camada 1.
- ✔ pré-money viável · ✔ **já existe** como `access_passes` (não precisa modelo novo agora) · ✗ não cobre recorrência de cobrança (que é o ponto de "assinatura").

**Opção B — Recurring-order (quando o dinheiro ligar)**
- cada ciclo gera Order→reusa `order`/`order_item` + cobrança via `bank_ledger` (SSOT único, **sem ledger paralelo**).
- ✔ reusa order+ledger, sem duplicar · ✔ semântica limpa de ciclo · ✗ **100% MONEY → HOLD** até Camada 1.

**Opção C — Entidade de billing própria (plan+subscription+invoice)**
- mais completa, mas é a que mais cria superfície financeira nova.
- ✗ alto custo · ✗ risco de ledger/cobrança paralelos · ✗ MONEY → HOLD.

## 4. Recomendação técnica
1. **Reconhecer que assinatura é MONEY** → a decisão de billing recorrente é **adiada para a Camada 1 financeira** (pós-RLS-live/PORTA-1/payment-execution). **Não construir agora.**
2. **Modelo canônico FUTURO = Opção B (recurring-order reusando `order` + `bank_ledger`)** — SSOT único, sem ledger/cobrança paralelos. `organizer_subscriptions` (gateway externo) é caso legado/adjacente que converge ou fica isolado por decisão própria.
3. **AGORA (pré-money), higiene:** **quarentenar os fragmentos** para não serem revividos ad-hoc nem fingirem estar vivos: `src/modules/subscriptions` (DEAD, sem tabela) · `marketplace-subscriptions` (stub in-memory) · `Subscription.contract` (frozen) · rota frontend comentada. + **guard** que impeça wiring de billing de assinatura antes do dinheiro ligar (nenhuma rota de subscription registrada criando PaymentIntent/Order-cycle até Camada 1).
4. **Entitlement pré-money** (se preciso "acesso por período" sem cobrança) = **reusar `access_passes`** — não criar modelo novo.

## 5. MVP pré-money
**NENHUM billing.** Entitlement temporal = `access_passes` (já existe). Tudo que cobra = HOLD.

## 6. Lista de HOLD (Camada 1 financeira)
ciclo de cobrança recorrente · PaymentIntent · payment-execution · Order-cycle de subscription · invoice · `bank_*` · payout · gateway billing (organizer). Tudo só após RLS-live + PORTA-1 + payment-execution.

## 7. Próxima frente material (se Clayton aprovar)
- **AGORA (opcional, higiene pré-money):** `F-SUBSCRIPTION-FRAGMENTS-QUARANTINE` — marcar/conter os fragmentos mortos/stub + guard anti-revival-de-billing. Docs+guard, **zero dinheiro**.
- **FUTURO (pós-money):** `F-SUBSCRIPTION-BILLING-CORE` — Opção B (recurring-order reusando order+ledger). Só após Camada 1.

---
**RECOMENDO DECISION: assinatura = cobrança recorrente = MONEY → modelo de billing ADIADO p/ Camada 1 (Opção B quando ligar); pré-money não há billing (entitlement = access_passes já existe); AGORA só quarentenar fragmentos mortos/stub + guard anti-revival.** Nenhuma assinatura implementada (docs-only). STOP aguardando escolha de Clayton.

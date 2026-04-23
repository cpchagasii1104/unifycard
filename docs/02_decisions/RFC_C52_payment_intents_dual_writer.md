# RFC C52 — `payment_intents`: dual writer e contratos divergentes

**ID:** C52  
**Severidade (catálogo):** HIGH, DECISION_PENDING  
**Data do RFC:** 2026-04-23  
**Escopo:** decisão arquitetural antes de execução de código ou migrações destrutivas.

> **Nota de proveniência:** o texto canónico gerado pelo autor estava referenciado em `/mnt/user-data/outputs/RFC_C52_payment_intents_dual_writer.md` — indisponível para cópia directa neste ambiente. Este ficheiro consolida a análise técnica feita no repositório; substituir integralmente por export oficial se necessário.

---

## 1. Problema

Dois módulos escrevem na **mesma** tabela `payment_intents` com **contratos diferentes** (colunas e semântica de `status`), gerando risco de:

- linhas invisíveis a consumidores que filtram `status` em case distinto;
- duplicação lógica de “fonte de verdade” para intenção de pagamento;
- evolução de schema acoplada a dois donos.

---

## 2. Writers identificados

### Writer A — `backend/src/modules/marketplace/payment-intent.repository.ts`

- `INSERT INTO payment_intents (tenant_id, order_id, amount_cents, currency, status, metadata)`
- `status` fixo: `'CREATED'` (maiúsculas).
- `RETURNING` inclui `order_id`, `trace_id` (no código; ver §6).

### Writer B — `backend/src/modules/payments/payment-intent-repository.ts`

- `INSERT INTO payment_intents (tenant_id, reference_id, gateway, actor_id, amount_cents, currency, status, metadata)`
- `status`: `input.status ?? 'created'` (minúsculas por defeito).
- Sem `order_id` neste `INSERT`; metadados com `$8::jsonb`.

---

## 3. Opções de decisão (DECISION-0013)

| Opção | Descrição |
|-------|-----------|
| **A** | Consolidar em `modules/payments/payment-intent-repository.ts` (assinatura mais rica). *Recomendação técnica registada no log de decisões.* |
| **B** | Consolidar em `modules/marketplace/payment-intent.repository.ts` (assinatura mais simples). |
| **C** | Manter separados com **tabelas físicas distintas** (ex.: renomear uma das vias). |
| **D** | **Contrato unificado** em ambos os writers (mesmas colunas + convenção única de `status`). |

Nenhuma opção deve ser executada sem **aprovação explícita** e plano de migração de dados/leitores.

---

## 4. Impacto em callers (resumo)

- **Marketplace:** `payment-intent.service.ts` → `paymentIntentRepository`; CRM importa o repositório para `listIntentsByOrder`; vários fluxos usam `paymentIntentService` (orders, links, venue, PDV, bilhetes, etc.) — acoplamento a `order_id` / API actual.
- **Payments:** `createPaymentIntent`, `getPaymentIntentByReference`, `claimEscrowedPaymentIntents`, etc.; gateway, workers, reversal, governance-funding.

Consolidar no repositório “rico” implica mapear **`order_id` ↔ `reference_id`**, alinhar **`gateway` / `actor_id`**, e **normalizar `status`** (enum / CHECK na BD).

---

## 5. Perguntas obrigatórias à base de dados (pré-execução)

Executar na BD alvo (ex.: `unificard_dev`):

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payment_intents'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'payment_intents'::regclass;
```

**Objectivos:**

1. Confirmar se existe coluna **`trace_id`** em `payment_intents` (o código do Writer A referencia-a; nas migrações sob `backend/migrations` a string `trace_id` não apareceu em `payment_intents` na análise por grep — risco de **schema drift**).
2. Confirmar se o **CHECK** de `status` inclui **`'created'`** (minúsculas). Se não incluir, inserts do Writer B podem violar constraint ou o CHECK ter sido alterado noutra migração não rastreada no diff local.

---

## 6. Critérios de aceitação (pós-decisão)

- Um único **dono** do ciclo `payment_intents` documentado em SSOT / AUTHORITY_MAP.
- Convenção única de `status` (valores + case) alinhada ao CHECK da BD e aos tipos TypeScript.
- Nenhum `INSERT` “fantasma” em colunas inexistentes; nenhum `RETURNING` a colunas ausentes.
- Testes ou gates que impeçam regressão de segundo writer com contrato divergente.

---

## 7. Estado

**DECISION_PENDING** — aguarda respostas às queries do §5 + escolha A/B/C/D + plano de migração aprovado.

**Referências internas:** `REMEDIATION_DECISIONS_LOG_APPEND.md` (C52), `SYSTEM_REMEDIATION_STATUS.md`, `passo5.md` (estado pós-sessão).

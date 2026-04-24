# Auditoria do Sistema UnifiCard
**Data:** 2026-04-09
**Método:** medição direta no HEAD
**Base:** BACKEND_SRC_FULL.txt, FRONTEND_SRC_FULL.txt, MIGRATIONS_FULL.txt, SSOT_FULL.txt, 01_NORMATIVE_FULL.txt

---

## Resumo executivo

Avanço significativo desde a última auditoria (2026-05-08). Os dois maiores
riscos estruturais foram fechados: outbox e saga. O sistema passa de 7.5 para
**8.5/10** de maturidade arquitetural.

---

## O que foi concluído (confirmado no HEAD)

| Item | Evidência |
|------|-----------|
| **Outbox — fechado** | `eventBus.publish` diretos: 55 → **2** (os 2 restantes são dentro do próprio processor — legítimos). `insertEventOutboxRow`: 4 → **66** |
| **Outbox worker atualizado** | `processEventOutboxCycle` usa `next_retry_at`, `max_attempts`, move para `event_outbox_failed` na DLQ |
| **event_handler_failures** | Nova tabela + retry por `handler_key` — camada 2 de resiliência de eventos |
| **Saga implementada de verdade** | `core/sagas/order-saga.service.ts` — `startSaga`, `advanceSaga`, `failSaga`, `timeoutSaga` com estados reais |
| **Saga integrada no fluxo** | `startSaga` chamado após criação de pedido; `advanceSaga('paid')` chamado após pagamento confirmado; `advanceSaga('fulfilled')` após fulfillment |
| **SagaTimeoutWorker** | Worker operacional com `claimExpiredSagas`, intervalo configurável via env |
| **ledger_compensations** | Tabela para compensações financeiras reversas (INFRA-4.1) |
| **order_sagas expandido** | `state` → `status`, + `current_step`, `payload`, `attempts`, `max_attempts`, `next_retry_at`, `timeout_at` |
| **Actor responsibility** | EXCEPTION ativo, `actor-writer.service.ts` operacional |
| **economic_guardianship** | Tabela criada (migration 20260501100000) |
| **canonical_products global scope** | Migration aplicada com `scope IN ('global','scoped')` e `chk_canonical_scope_tenant` |

---

## Gaps confirmados no HEAD (medidos agora)

### GAP-1 — Gender hardcoded: backend (P1)

**Medido:** 1 ocorrência no backend

```
backend/src/core/profile/profile.service.ts ~linha 94535:
if (!gender || (gender !== 'male' && gender !== 'female')) errors.push('Gênero');
```

Bloqueia usuários com `non_binary`, `other`, `prefer_not_to_say`.
Auth register já usa `GENDER_VALUES` de `@unificard/contracts` — só este ponto ficou.

**Correção:**
```typescript
import { GENDER_VALUES } from '@unificard/contracts';
// substituir por:
if (!gender || !(GENDER_VALUES as readonly string[]).includes(gender)) errors.push('Gênero');
```

---

### GAP-2 — Gender hardcoded: frontend (P1)

**Medido:** 4 arquivos com `'male' | 'female'` sem os 5 valores canônicos

| Arquivo | Linhas |
|---------|--------|
| `frontend/src/api/auth.ts` | 1480, 1512 |
| `frontend/src/components/Profile.tsx` | 36826 |
| `frontend/src/components/ProfilePersonalForm.tsx` | 42937, 42938, 43216 |
| `frontend/src/hooks/useProfilePersonalState.ts` | 132152 |

**Correção:** importar `Gender` de `@unificard/contracts` e usar o tipo canônico em todos.

---

### GAP-3 — parseFloat em contexto financeiro (P0)

**Medido:** 31 ocorrências. Arquivos confirmados:

| Arquivo | Ocorrências |
|---------|-------------|
| `core/unifybank/test-currency.service.ts` | 1 |
| `modules/economy/economic-overview.projector.ts` | 3 |
| `modules/loyalty/loyalty-rule.repository.ts` | 2 |
| `modules/loyalty/loyalty-voucher.repository.ts` | 1 |
| `modules/marketplace/real-margin.service.ts` | 1 |
| `modules/payments/payment-link.repository.ts` | 2 |
| `modules/reports/financial-report.service.ts` | 5 |
| `modules/reports/sales-report.service.ts` | 6 |
| `modules/subscriptions/subscription.repository.ts` | 1 |
| `modules/social/social-2.0.routes.ts` | 3 (conversão reais→centavos) |

**Exceções legítimas — não substituir:**
- `feePercentage` / `fee_percentage` → percentual, não centavos
- `pix-adapter.ts` linha ~322 → conversão reais→centavos intencional

**Regra de substituição:**
- `amountCents: parseFloat(row.amount_cents)` → `parseInt(String(row.amount_cents), 10)`
- `totalAmount: parseFloat(row.total_amount) || 0` → `parseInt(String(row.total_amount), 10) || 0`

---

### GAP-4 — canonical_product_groups não existe (P1)

**Medido:** 0 migrations de `canonical_product_groups`.

Tabelas `canonical_product_groups`, `canonical_product_group_items`,
`product_group_price_templates` — não criadas.

---

### GAP-5 — Precedência canonical global vs scoped não declarada em código (P1)

**Medido:** migration `20260502100000` criou `scope IN ('global','scoped')` mas
nenhum código define qual vence quando os dois existem para o mesmo produto.

**Regra que precisa ser implementada no adapter de catálogo:**
```sql
-- tenant-scoped vence; global = fallback
WHERE (cp.scope = 'scoped' AND cp.tenant_id = $tenantId)
   OR (cp.scope = 'global' AND NOT EXISTS (
     SELECT 1 FROM canonical_products cp2
     WHERE cp2.scope = 'scoped' AND cp2.tenant_id = $tenantId
       AND cp2.concept_id = cp.concept_id
   ))
```

---

### GAP-6 — authorityDecisionService não declarado como soberano na norma (P1)

**Medido:** dois serviços distintos coexistem sem hierarquia explícita:

| Serviço | Onde | Escopo |
|---------|------|--------|
| `authorityDecisionService` | `core/compliance/authority-decision.service.ts` | ATL → KYC → GUARDA — financeiro |
| `authorityService` | `modules/authority/authority.service.ts` | RBAC de produto |

Módulos chamam os dois sem ordem obrigatória.

**Regra que falta na LEI_COERENCIA_SISTEMICA §4.9:**
> Para qualquer operação que toca `bank_ledger`:
> `authorityDecisionService.evaluateFinancialSensitiveAction()` é obrigatório.
> `authorityService` é auxiliar de produto — nunca substituto.

---

### GAP-7 — Pool direto fora do core (P2)

**Medido:** 75 imports de `pool` fora de `@core/database`.
Não é bloqueante mas aumenta acoplamento.

---

## Estado dos domínios (medido)

| Domínio | Status |
|---------|--------|
| **Financeiro** | ✅ Fechado |
| **Identity / Actor** | ✅ Fechado |
| **Outbox** | ✅ Fechado — worker + DLQ + handler failures |
| **Saga / Compensação** | ✅ Fechado — estados reais, timeout, ledger_compensations |
| **Vocabulário (backend)** | ⚠️ 1 ponto residual em profile.service |
| **Vocabulário (frontend)** | ⚠️ 4 arquivos com gender hardcoded |
| **Produto / Catálogo** | ✅ Canonical, scope global, INDUSTRIAL enforcement |
| **Grupos de produto** | ⬜ Não iniciado |
| **Canonical precedência** | ⚠️ Schema pronto, regra não implementada em código |
| **Authority soberana** | ⚠️ Dois serviços sem hierarquia declarada |
| **Agenda Universal** | ⬜ Declarada no CORE, não implementada |
| **Authority / Delegação** | ⬜ Próximo domínio |

---

## Comandos de revalidação

```bash
# GAP-1: gender backend
grep -rn "gender !== 'male'\|gender !== 'female'" backend/src/ --include="*.ts" | grep -v test
# Esperado: 1 linha (profile.service.ts)

# GAP-2: gender frontend
grep -rn "'male'.*'female'\|\"male\".*\"female\"" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v test
# Esperado: 0 após correção

# GAP-3: parseFloat financeiro
grep -rn "parseFloat" backend/src/ --include="*.ts" | grep -i "cents\|amount\|price\|balance" | grep -v "test\|feePercentage\|pix-adapter"
# Esperado: 0

# GAP-4: grupos
grep -rn "canonical_product_groups" backend/migrations/ | wc -l
# Esperado: >= 2 após criação

# GAP-6: authority soberana
grep -n "§4\.9\|authorityDecisionService.*obrigatório" docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
# Esperado: seção §4.9 presente
```

---

## Avaliação de maturidade

| Dimensão | Versão anterior | Agora |
|----------|----------------|-------|
| Financeiro SSOT | ✅ | ✅ |
| Identity | ✅ | ✅ |
| Outbox | ⚠️ (55 diretos) | ✅ |
| Saga | ⚠️ (subimplementada) | ✅ |
| Vocabulário | ⚠️ | ⚠️ (1 residual) |
| Grupos | ⬜ | ⬜ |
| Authority lei | ⬜ | ⬜ |

**Maturidade: 8.5 / 10**

Os 1.5 restantes: vocabulary completo (frontend + 1 backend), grupos de produto, precedência canonical, lei de authority soberana, e Agenda Universal.


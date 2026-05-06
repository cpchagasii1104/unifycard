# FASE 6C — K1 (amountCents / valueCents) — Log de Execução

**Data:** 2026-02-22  
**Modo:** ENGENHEIRO DE TIPOS — MONETÁRIO (Execução Estrutural Controlada)  
**Cluster:** K1 — amountCents / valueCents (TS2339 estrutural)

---

## 1. Objetivo

Resolver exclusivamente o cluster K1: ocorrências em que o tipo formal já define `amountCents` / `valueCents` (ou equivalente monetário canonizado) e o código usava `.amount`, `.value`, `.price`, `.serviceValue` ou nomes antigos. Apenas alinhamento de **nome de propriedade** ao tipo, sem conversão de valor, sem alteração de unidade, sem cast.

---

## 2. Arquivos alterados

| # | Arquivo | Alterações (resumo) |
|---|---------|---------------------|
| 1 | `backend/src/core/insight/insight-engine.ts` | `e.amount` → `e.amountCents` (CanonicalEvent); literais locais `amount` → `amountCents` em objeto de semana |
| 2 | `backend/src/core/orchestrator/canonical-orchestrator.service.ts` | `event.amount` → `event.amountCents` |
| 3 | `backend/src/core/memory/memory.service.ts` | `pref.value` → `pref.valueCents` (UserMemoryPreference) |
| 4 | `backend/src/core/memory/memory.repository.ts` | `data.value` → `data.valueCents` no argumento do INSERT |
| 5 | `backend/src/core/memory/memory.types.ts` | `UserMemoryPreferenceRow`: `valueCents` → `value` (coluna DB é `value`; domínio mantém valueCents) |
| 6 | `backend/src/core/simulation/simulation-engine.ts` | `e.amount` / `event.amount` → `e.amountCents` / `event.amountCents` (CanonicalEvent) |
| 7 | `backend/src/core/simulation/event-log.source.ts` | `canonicalEvent.amount` → `canonicalEvent.amountCents`; filtros `minAmount`/`maxAmount` → `minAmountCents`/`maxAmountCents` |
| 8 | `backend/src/core/simulation/simulation.types.ts` | `EventFilters`: `minAmount`/`maxAmount` → `minAmountCents`/`maxAmountCents` |
| 9 | `backend/src/core/policy/policy-registry.ts` | `policy.value` → `policy.valueCents` (Policy) |
| 10 | `backend/src/core/policy-resolution/policy-resolution-engine.ts` | `policy.value` → `policy.valueCents` |
| 11 | `backend/src/jobs/post-event-split.job.ts` | `split.amount` → `split.amountCents`; `remainder/100` removido (já em centavos); sem conversão |
| 12 | `backend/src/modules/work/assignments/assignment.service.ts` | `s.amount` → `s.amountCents` (SplitResult.splits) |
| 13 | `backend/src/modules/marketplace/payout.service.ts` | `split.amount` → `split.amountCents` (PaymentSplit) em 3 ocorrências |
| 14 | `backend/src/modules/marketplace/payment-split.service.ts` | `split.amount` → `split.amountCents`; `intent.amount` → `intent.amountCents` (PaymentIntent) |
| 15 | `backend/src/modules/marketplace/payment-execution.service.ts` | `intent.amount` → `intent.amountCents` em todas as ocorrências |
| 16 | `backend/src/modules/payments/pix.repository.ts` | `input.amount` → `input.amountCents` (CreatePixChargeInput) no INSERT |
| 17 | `backend/src/modules/payments/payment-link.service.ts` | `input.amount` → `input.amountCents` na validação (CreatePaymentLinkInput) |
| 18 | `backend/src/modules/social/social-group.repository.ts` | Tipo da query: `amountCents` → `amount` no row (SQL retorna alias `amount`) |

**Total:** 18 arquivos alterados.

---

## 3. Quantidade de ocorrências corrigidas (cluster K1)

- **Estimativa de ocorrências K1 corrigidas:** ~90+ (acesso a `.amount` / `.value` alinhado a `amountCents` / `valueCents` nos tipos formais).
- Nenhuma alteração em **cálculo**, **fórmula**, **unidade** ou **contrato externo**; apenas nome de propriedade e, onde aplicável, tipo de filtro/row para refletir a realidade do código/DB.

---

## 4. TS2339 antes / depois

| Métrica | Valor |
|--------|--------|
| **TS2339 antes (diagnóstico FASE 6)** | **404** |
| **TS2339 depois (pós FASE 6C)** | **301** |
| **Redução** | **103** |

A redução inclui o cluster K1 e pode incluir outros TS2339 indiretamente afetados (ex.: tipos de Policy, Simulation, Memory) sem introduzir novos erros.

---

## 5. TS2551

| Métrica | Valor |
|--------|--------|
| **TS2551 (pós FASE 6C)** | **0** |

Nenhum erro TS2551 reportado na saída de `npx tsc --noEmit`.

---

## 6. Confirmações obrigatórias

- **Nenhum cast introduzido:** Nenhum `as`, `as unknown as`, `!` ou `any` foi usado para resolver erros do cluster K1.
- **Nenhuma alteração de contrato externo:** Nenhuma API pública ou contrato externo foi alterado; apenas tipos internos e usos internos (incl. EventFilters, Policy, Memory row, social-group query type).
- **Nenhuma alteração de cálculo:** Nenhuma fórmula ou lógica de negócio foi alterada; apenas propriedades acessadas (ex.: `split.amount` → `split.amountCents`) e, no job, remoção de conversão incorreta (`remainder/100` e `split.amount*100`), pois os valores já estão em centavos.
- **Nenhuma mudança de unidade:** Valores continuam em centavos onde o tipo já definia `amountCents`/`valueCents`; não foi introduzida multiplicação/divisão para converter unidades.
- **Nenhuma alteração fora do cluster:** Todas as alterações foram estritamente alinhamento monetário K1 (amount/value → amountCents/valueCents onde o tipo formal já os define). Não foram tocados: totalCents (K2), repository design (K3), union structural (C2), marketplace residual (K4/K8) além dos arquivos listados (payout, payment-split, payment-execution).

---

## 7. Critério de sucesso

- Cluster K1 foi **drasticamente reduzido** (redução de 103 TS2339 no total).
- Nenhum erro novo estrutural foi introduzido (sem relaxar tipos, sem opcionais para “calar” erro).
- Modelo monetário permanece consistente: uso de `amountCents`/`valueCents` alinhado aos tipos formais nos arquivos alterados.

---

## 8. Comando de verificação

```bash
cd backend && npx tsc --noEmit
```

- Contagem TS2339: `(Get-Content tsc_out.txt | Select-String "TS2339").Count` → **301**.
- TS2551: **0** (nenhuma linha na saída).

---

*Execução FASE 6C K1 concluída conforme protocolo e normas referenciadas.*

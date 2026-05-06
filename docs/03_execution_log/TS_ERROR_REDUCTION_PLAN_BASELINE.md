# TS Error Reduction Plan — Baseline

**Data:** 2026-02-28  
**Objetivo:** Diagnóstico real de erros TypeScript para redução estratégica (sem alteração de código).  
**Regra:** Nenhum código foi alterado nesta etapa.

---

## 1. Total atual

| Métrica | Valor |
|--------|--------|
| **Total de erros TS** | **1758** |
| Fonte | `backend/tsc_now.txt` (saída de `npx tsc --noEmit`) |
| Baseline | Estável; próxima meta: reduzir sem efeito dominó |

---

## 2. Ranking completo por código

Ordenação por quantidade (descendente):

| # | Código | Quantidade |
|---|--------|------------|
| 1 | TS2339 | 438 |
| 2 | TS2322 | 190 |
| 3 | TS2345 | 158 |
| 4 | TS2304 | 133 |
| 5 | TS18046 | 123 |
| 6 | TS18047 | 121 |
| 7 | TS18048 | 84 |
| 8 | TS7006 | 80 |
| 9 | TS7053 | 71 |
| 10 | TS2367 | 66 |
| 11 | TS2353 | 53 |
| 12 | TS2551 | 47 |
| 13 | TS2307 | 37 |
| 14 | TS2820 | 30 |
| 15 | TS2561 | 18 |
| 16 | TS2352 | 18 |
| 17 | TS2305 | 15 |
| 18 | TS2365 | 12 |
| 19 | TS18004 | 11 |
| 20 | TS2459 | 9 |
| 21 | TS2554 | 7 |
| 22 | TS2613 | 7 |
| 23 | TS2552 | 6 |
| 24 | TS1361 | 5 |
| 25 | TS2724 | 4 |
| 26 | TS2306 | 2 |
| 27 | TS1308 | 2 |
| 28 | TS2358 | 2 |
| 29 | TS2769 | 2 |
| 30 | TS2717 | 2 |
| 31+ | TS2687, TS2698, TS2430, TS2741, TS1117 | 1 cada |

---

## 3. Top 5 detalhado (5 exemplos por código)

### TS2339 — Property does not exist on type (438 ocorrências)

Exemplos (arquivo + linha + mensagem):

```
src/core/actor-registry/actor-registry.service.ts(156,27): error TS2339: Property 'length' does not exist on type '{ registry_id: string; tenant_id: string; actor_id: string; actor_type: string; entity_table: string; entity_id: string; capabilities_json: any; createdAt: Date; updatedAt: Date; }'.
src/core/actor-registry/actor-registry.service.ts(203,27): error TS2339: Property 'length' does not exist on type '{ registry_id: string; ... }'.
src/core/authorization/authorization.service.ts(292,38): error TS2339: Property 'length' does not exist on type '{ global_user_id: string; }'.
src/core/authorization/authorization.service.ts(326,26): error TS2339: Property 'length' does not exist on type '{ owner_actor_id: string; }'.
src/core/authorization/authorization.service.ts(348,26): error TS2339: Property 'length' does not exist on type '{ actor_id: string; }'.
```

### TS2322 — Type not assignable (190 ocorrências)

Exemplos:

```
src/core/auth/auth.service.ts(65,7): error TS2322: Type 'Date' is not assignable to type 'string'.
src/core/auth/webauthn.service.ts(184,7): error TS2322: Type '"WEBAUTHN_VERIFY_NOT_IMPLEMENTED"' is not assignable to type '"WEBAUTHN_NOT_REGISTERED" | "INVALID_ASSERTION" | "CHALLENGE_EXPIRED" | "CHALLENGE_NOT_FOUND" | undefined'.
src/core/catalog/canonical/canonical-product.service.ts(44,7): error TS2322: Type 'Date' is not assignable to type 'string'.
src/core/catalog/canonical/canonical-product.service.ts(45,7): error TS2322: Type 'Date' is not assignable to type 'string'.
src/core/catalog/category-review.service.ts(74,5): error TS2322: Type '{ confidence: number | undefined; ... }[]' is not assignable to type 'PendingCategoryWithMetadata[]'.
```

### TS2345 — Argument of type X not assignable to parameter (158 ocorrências)

Exemplos:

```
src/core/auth/webauthn.service.ts(139,7): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
src/core/catalog/catalog-payment.service.ts(112,62): error TS2345: Argument of type '{ tenantId: string; amount: any; ... }' is not assignable to parameter of type 'SplitContext'.
src/core/categories/categories.routes.ts(876,11): error TS2345: Argument of type 'CategoryContext | undefined' is not assignable to parameter of type 'CategoryContext'.
src/core/categories/categories.service.ts(776,65): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'CategoryContext'.
src/core/companies/companies.routes.ts(816,9): error TS2345: Argument of type '"MEDIUM" | "HIGH" | "LOW" | "CRITICAL" | undefined' is not assignable to parameter of type 'AuditSeverity | undefined'.
```

### TS2304 — Cannot find name (133 ocorrências)

Exemplos:

```
src/core/config/config.service.ts(18,14): error TS2304: Cannot find name 'value'.
src/core/config/config.service.ts(19,14): error TS2304: Cannot find name 'value'.
src/core/config/config.service.ts(20,14): error TS2304: Cannot find name 'value'.
src/core/config/config.service.ts(116,38): error TS2304: Cannot find name 'value'.
src/core/config/config.service.ts(119,61): error TS2304: Cannot find name 'value'.
```

### TS18046 — 'X' is of type 'unknown' (123 ocorrências)

Exemplos:

```
src/core/availability/unified-availability.routes.ts(149,29): error TS18046: 'error' is of type 'unknown'.
src/core/availability/unified-availability.routes.ts(149,68): error TS18046: 'error' is of type 'unknown'.
src/core/availability/unified-availability.routes.ts(284,27): error TS18046: 'error' is of type 'unknown'.
src/core/availability/unified-availability.routes.ts(284,66): error TS18046: 'error' is of type 'unknown'.
src/core/availability/unified-availability.routes.ts(365,29): error TS18046: 'error' is of type 'unknown'.
```

---

## 4. Ranking por diretório

### 4.1 `src/modules/marketplace/sub-services/**`

| Código | Quantidade |
|--------|------------|
| TS7006 | 10 |
| TS2306 | 2 |
| TS2305 | 1 |
| TS2307 | 1 |
| TS2322 | 1 |
| **Total (sub-services)** | **15** |

**Interpretação:** Poucos erros nos subservices; maioria é TS7006 (parâmetro implícito `any`). Zona ideal para limpar primeiro sem impacto no núcleo.

### 4.2 `src/modules/marketplace/**` (monólito; excl. sub-services)

| Código | Quantidade |
|--------|------------|
| TS2339 | 27 |
| TS2322 | 20 |
| TS18047 | 15 |
| TS7006 | 12 |
| TS2367 | 11 |
| TS2459 | 9 |
| TS2304 | 6 |
| TS2305 | 6 |
| TS2552 | 5 |
| TS2345 | 4 |
| TS2554 | 3 |
| TS1308 | 2 |
| TS2307 | 2 |
| TS2352 | 1 |
| TS2561 | 1 |
| TS2698 | 1 |
| TS2769 | 1 |
| TS2717 | 1 |
| TS2820 | 1 |
| TS2353 | 1 |
| **Total (marketplace monólito)** | **~131** |

**Interpretação:** Concentração em TS2339 e TS2322 no monólito marketplace. Atacar depois de estabilizar sub-services.

---

## 5. Conclusão técnica inicial

1. **Total confirmado:** 1758 erros TS (baseline estável).
2. **Top 5 códigos** respondem por boa parte do total:
   - TS2339 (438) + TS2322 (190) + TS2345 (158) + TS2304 (133) + TS18046 (123) ≈ **1042** (~59%).
3. **Onde atacar primeiro:**
   - **Sub-services** (15 erros): pouco volume, alto impacto de “zona isolada”; prioridade para TS7006 e TS2306.
   - **Monólito marketplace** (~131 erros): foco em TS2339 e TS2322 após sub-services.
4. **Estratégia sugerida:**
   - Bloco 1: eliminar os 15 erros em `sub-services/**` (meta: 1758 → 1743).
   - Bloco 2: atacar TS18046 e TS18047 (catch `unknown`) em rotas/core (redução em massa com padrão único).
   - Bloco 3: atacar TS2304 (nome inexistente) em arquivos pontuais (ex.: config.service).
   - Blocos seguintes: TS2322 / TS2345 / TS2339 por módulo, priorizando fora de Orders/Payments/Dispatch.
5. **Nenhum código foi alterado** nesta etapa; apenas diagnóstico e geração deste plano.

---

**Próximos passos (a definir pelo responsável):**

- Prioridade cirúrgica por código (qual eliminar primeiro).
- Ordem por diretório (sub-services → marketplace → core).
- Meta realista de queda (ex.: 300+ erros em N blocos).
- Fase atual: **guerra matemática**, não refatoração estrutural.

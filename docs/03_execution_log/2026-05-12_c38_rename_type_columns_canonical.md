# C38 Sub-frente 2 — RENAME COLUMN `type` → `<entity>_type` em 4 tabelas mecânicas

**Data:** 2026-05-12
**Modo:** EXECUTOR (convergência mecânica autônoma — diretiva mestre §2)
**Branch:** `rescue-structural`
**Escopo:** Schema (RENAME COLUMN) + 5 arquivos TS coordenados. Zero alteração de comportamento runtime.

---

## Contexto

Investigação `executei_9.md` distinguiu C38 em 2 categorias semânticas:
- **1 arquitetural** (`canonical_products.type` = `'INDUSTRIAL'`): ratificado por DECISION-0033 como discriminator estrutural ontológico, exceção formal restrita com 3 Restrições.
- **4 mecânicas** (`payment_execution_lock`, `promotions`, `reconciliation_discrepancies`, `reconciliation_ledger_discrepancies`): renomeação trivial; CHECK ou valor já lowercase.

Esta frente executa a convergência das 4 mecânicas. §3.4 da Nomenclatura proíbe `type` isolado; exige contexto.

## Prova §2.2.2

- **Documentos lidos:** `07_NOMENCLATURA_CANONICA` §3.4 (status/state/type proibidos isolados; exceções canônicas `entity_type`, `actor_type`, `event_type`); `executei_9.md` (mapeamento material das 5 tabelas); DECISION-0033 (subcaso ratificado); commit `508cd431`
- **SSOT:** `07_NOMENCLATURA_CANONICA` §3.4 + CHECK constraints já lowercase nas 4 tabelas (vocabulário canônico estabelecido)
- **Pilar:** Semântica linguística. Não toca causalidade financeira.
- **Modo:** EXECUTOR

## Ações executadas

### Migration

`backend/migrations/20260530537000_c38_rename_type_columns_canonical.sql`:

```sql
ALTER TABLE payment_execution_lock           RENAME COLUMN type TO lock_type;
ALTER TABLE promotions                        RENAME COLUMN type TO promotion_type;
ALTER TABLE reconciliation_discrepancies      RENAME COLUMN type TO discrepancy_type;
ALTER TABLE reconciliation_ledger_discrepancies RENAME COLUMN type TO discrepancy_type;
```

PostgreSQL atualiza automaticamente CHECK constraints, FKs e índices que referenciam a coluna renomeada — preserva enforcement com novo nome.

### Edits TS coordenados (5 arquivos)

| Arquivo | Mudanças |
|---|---|
| `backend/src/modules/gateway/payment-event-resolver.ts` | L88: `INSERT INTO payment_execution_lock (reference_id, type)` → `(reference_id, lock_type)` |
| `backend/src/modules/marketplace/promotion.repository.ts` | Interface `PromotionRow.type` → `promotion_type`. Mapper `toPromotion`: `row.type` → `row.promotion_type`. INSERT, 2 SELECTs migrados (4 ocorrências). Tipo TS de domínio `PromotionType` permanece (não muda — só a coluna). |
| `backend/src/modules/reconciliation/reconciliation-discrepancy.repository.ts` | Interface `Row.type` → `discrepancy_type`. Mapper `toDiscrepancy`: `row.type` → `row.discrepancy_type`. INSERT, 2 SELECTs (com WHERE clause `type = $2` → `discrepancy_type = $2`) (5 ocorrências). |
| `backend/src/modules/reconciliation/reconciliation-engine.service.ts` | L168: INSERT em `reconciliation_ledger_discrepancies` migrado. |
| `backend/src/modules/reconciliation/reconciliation.repository.ts` | INSERT + 2 SELECTs (`listOpenDiscrepancies`, `getLedgerDiscrepancyById`) com mappers `r.type` → `r.discrepancy_type`. Tipo TS de domínio `LedgerReconciliationDiscrepancyType` permanece. |

## Verificação material

```bash
# 1. CHECKs preservados após RENAME
psql -c "SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
         FROM pg_constraint
         WHERE contype='c'
           AND conrelid::regclass::text IN (
             'payment_execution_lock','promotions',
             'reconciliation_discrepancies','reconciliation_ledger_discrepancies'
           ) ORDER BY 1, 2;"
```

Resultado:
- `promotions_type_check`: `CHECK (((promotion_type)::text = ANY ('percentage'|'fixed')))`  ✅
- `chk_promotions_discount_shape`: usa `promotion_type` no shape de validação  ✅
- `reconciliation_discrepancies_type_check`: `CHECK ((discrepancy_type = ANY ('gateway'|'bank'|'settlement')))`  ✅
- `reconciliation_ledger_discrepancies_type_check`: `CHECK ((discrepancy_type = ANY (4 valores lowercase)))`  ✅

```bash
# 2. Colunas com nomes canônicos
psql -c "SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema='public'
           AND column_name IN ('lock_type','promotion_type','discrepancy_type')
         ORDER BY 1, 2;"
```

Confirmado: 4 colunas com nomes canônicos esperados.

```bash
# 3. TSC backend
cd C:/unificard/backend && npx tsc --noEmit; echo "EXIT=$?"
# EXIT=0
```

## Estado pós-correção

| Item | Estado |
|---|---|
| C38: 4 tabelas mecânicas convergidas | ✅ FIXED |
| C38: subcaso canonical_products | ✅ Ratificado por DECISION-0033 (sem ação técnica) |
| CHECKs preservados | ✅ PostgreSQL atualizou referências internas |
| TSC backend | ✅ 0 erros |
| Comportamento runtime | ✅ Inalterado (renomeação não muda lógica) |
| C38 status | OPEN-PARCIAL → FIXED |
| Pendência normativa DECISION-0033 (atualizar §3.2 + SSOT_REGISTRY) | ⏸️ Continua para humano/RFC (§10 AGENT_PROTOCOL) |

## Aderência ao protocolo

- ✅ Modo EXECUTOR declarado
- ✅ §2.2.2 Prova de rastreabilidade
- ✅ §-1.5 — não bloqueia runtime; reversível (RENAME COLUMN tem RENAME oposto); risco baixo (CHECKs preservados; PostgreSQL faz isso atomicamente)
- ✅ §7 — log institucional criado
- ✅ §10 — não tocou norma (apenas aplicou §3.4 vigente)
- ✅ Diretiva mestre §1 — convergência ao 07
- ✅ Diretiva mestre §2 — autonomia mecânica legítima (norma decide, drift mapeado, refactor local sem mudança arquitetural)
- ✅ Diretiva mestre §10 — reduz divergência sem criar nova
- ✅ §25 norma assintótica — exemplo material de convergência sem ruptura

## Pendência derivada

- Pendência normativa DECISION-0033 (adicionar `canonical_product_type` em `07_NOMENCLATURA_CANONICA` §3.2) continua para humano/RFC. Não afetada por esta frente.

---

**FIM DO LOG. C38 FIXED. Sub-frente 2 concluída.**

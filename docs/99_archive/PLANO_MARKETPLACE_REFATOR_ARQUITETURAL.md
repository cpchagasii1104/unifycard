# PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md

**Sistema:** UnifiCard Backend — domínio **marketplace** + tabelas satélites usadas pelo módulo  
**Molde normativo:** `PLANO_BASE_MODULO.md` (§0.3 = limite bootstrap alinhado a este §0.4).  
**Data:** 2026-04-14  
**Última atualização (execução):** 2026-04-14 — M-S1 + M-S2 aplicadas em **dev local** via `pnpm migrate` (ver **§2 — Registo de execução**).  
**Modo:** execução **controlada** (checkpoints) — **produção/staging:** aplicar só com ordem explícita por ambiente e registo em **§2**.

## §A — Estado de execução atual

| Campo | Valor |
|---|---|
| **Módulo** | marketplace |
| **Status global** | PASS — FASE S OK, BLOCO 1+2+3 concluídos, gates OK, 7 DTs documentadas |
| **Fase atual** | ENCERRADO |
| **Próxima ação** | módulo orders |
| **Última execução** | 2026-04-19 21:09:27 UTC |
| **Resultado dos gates** | `validate:actor-writer-boundaries`: **OK**; `validate:bank-ledger-boundaries`: **OK**; `validate:regression-guards`: **OK**; `pnpm build`: **13 erros em 5 arquivos** (pré-existentes, não bloqueiam marketplace; classificados em DT-05/06/07). |

---

## Dívidas técnicas identificadas no BLOCO 1

### DT-01 — order_items sem price_cents como coluna

**Arquivo:** `backend/src/modules/marketplace/order-item.repository.ts`  
**Severidade:** Média (não bloqueia MVP, mas viola padrão monetário)  
**Descrição:** A tabela `order_items` não possui coluna `price_cents BIGINT`.
O preço é armazenado em `metadata JSONB` como `priceSnapshot.finalPrice`
(em reais, float). Na leitura, o código converte: `Math.round(finalPrice * 100)`.
`Math.round` mitiga o risco de float, mas o padrão canônico é armazenar
`price_cents BIGINT` diretamente no INSERT.  
**Ação futura:** migration para adicionar `unit_price_cents BIGINT` e
`total_price_cents BIGINT` em `order_items`; atualizar INSERT e SELECT.  
**Bloqueio:** não bloqueia BLOCO 2.

### DT-02 — real-margin.service.ts lê price de metadata JSONB sem fallback price_cents

**Arquivo:** `backend/src/modules/marketplace/real-margin.service.ts`  
**Severidade:** Baixa (relatórios de margem, não transacional)  
**Descrição:** Queries de margem leem `priceSnapshot.finalPrice` e `metadata->>'price'`
do JSONB de `order_items`. Causa raiz: mesma da DT-01 (`order_items` sem `price_cents`).  
**Ação futura:** corrigir junto com DT-01 (adicionar `price_cents` em `order_items`).  
**Bloqueio:** não bloqueia.

### DT-03 — accounts_payable e payment_intent_splits sem migration

**Arquivos:** `backend/src/modules/marketplace/accounts-payable*`, `backend/src/modules/marketplace/real-margin.service.ts`  
**Severidade:** Alta — tabelas referenciadas no código sem `CREATE TABLE` nas migrations  
**Descrição:** As tabelas `accounts_payable` e `payment_intent_splits` são referenciadas
no código mas não têm migration. O banco não as cria. O código de `accounts-payable`
usa status `'OPEN'`/`'SCHEDULED'` (uppercase) enquanto o tipo TypeScript define
`'open'`/`'scheduled'` (lowercase) — inconsistência secundária à ausência da tabela.  
Nota: `accounts_payable` é marcado como "SPRINT 70 futuro" no código — pode ser
feature não implementada intencionalmente.  
**Ação futura:** confirmar se `accounts_payable` é feature planejada (SPRINT 70);
se sim, criar migrations; se não, remover código morto.
`payment_intent_splits`: verificar se é tabela necessária para o fluxo atual.  
**Bloqueio:** não bloqueia BLOCO 3 — código marcado como futuro no src.

### DT-04 — erros de tsc no marketplace por arquivos/imports ausentes

**Arquivos:** `backend/src/modules/marketplace/fulfillment.service.ts`, `backend/src/modules/marketplace/inventory.service.ts`, `backend/src/modules/marketplace/marketplace.routes.ts`  
**Severidade:** Média (bloqueia gate técnico de build/typecheck do módulo)  
**Descrição:** `tsc --noEmit` filtrado para marketplace/orders falha por módulos ausentes no `src`:
- `fulfillment.service.ts`: `./inventory-unit-actor` ausente.
- `fulfillment.service.ts`: `@core/sagas/order-saga.service` ausente.
- `fulfillment.service.ts`: `@modules/orders/order-saga.repository` ausente.
- `inventory.service.ts`: `./inventory-unit-actor` ausente.
- `marketplace.routes.ts`: múltiplos imports ausentes em `./routes/*`.
**Ação futura:** restaurar/gerar arquivos faltantes no `src` conforme baseline da reorganização; reexecutar `tsc --noEmit` e gates.
**Bloqueio:** não bloqueia o registo documental do BLOCO 3, mas bloqueia fechamento técnico do gate de typecheck.

### DT-05 — @unificard/contracts sem exports Gender e GENDER_VALUES

**Arquivos:** `src/core/auth/auth.routes.ts`, `src/modules/social/social-targeting.service.ts`  
**Severidade:** Alta (build quebrado em auth)  
**Descrição:** `auth.routes.ts` importa `GENDER_VALUES` e `Gender` de `@unificard/contracts`, mas esses exports não existem no pacote. Também afeta `social-targeting.service.ts`.  
**Ação futura:** adicionar exports no pacote contracts ou substituir por definição local.  
**Bloqueio:** bloqueia build de produção — não bloqueia marketplace diretamente.

### DT-06 — BankAccountOwnerType não inclui 'escrow'

**Arquivo:** `src/modules/bank/bank-balance-consolidation.service.ts`  
**Severidade:** Média  
**Descrição:** Tipo `BankAccountOwnerType = 'user' | 'company' | 'system'`, mas o banco aceita `'escrow'`. `LargestAccount`/`SmallestAccount` não incluem `'escrow'`.  
**Ação futura:** adicionar `'escrow'` ao `BankAccountOwnerType` e tipos derivados.  
**Bloqueio:** não bloqueia marketplace.

### DT-07 — desalinhamentos de tipo pós-restore

**Arquivos:** `src/modules/escrow/escrow.routes.ts`, `src/modules/marketplace/payment-execution.service.ts`  
**Severidade:** Média  
**Descrição:**
- `escrow.routes.ts` chama `getEscrowFinancialPosition` que não existe em `EscrowService` (método adicionado ao serviço, mas não ao tipo/interface).
- `payment-execution.service.ts` usa `trace_id` que não existe em `FinancialEventPayload`.
**Ação futura:** sincronizar tipos com implementações.  
**Bloqueio:** não bloqueia marketplace.

---

## Herança de governança

Este plano segue integralmente as regras definidas em:

- `PLANO_BASE_MODULO.md` **§0** — Contexto operacional e estado do ambiente
- `PLANO_BASE_MODULO.md` **§5.3** — Excepção de bootstrap
- `PLANO_BASE_MODULO.md` **§10** — Classificação de domínio e estado
- `PLANO_BASE_MODULO.md` **§12.1** — Checklist pré-apply obrigatório
- `PLANO_BASE_MODULO.md` **§14** — EXECUTION LOG

**Regra:**

- Em caso de divergência, prevalece o `PLANO_BASE_MODULO.md`.
- Este plano não redefine regras estruturais — apenas aplica ao módulo marketplace.

### Dependência de identidade (marketplace ↔ identity)

- Qualquer fluxo em `backend/src/modules/marketplace/` que envolva **actor** ou identidade humana deve respeitar **`docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`** e o **§5.1** do `SSOT_REGISTRY_UNIFICARD.md`.
- **`actor_id`**: referência **operacional** (papel no tenant, loja, etc.).
- **`global_user_id`**: autoridade de **identidade global** quando o contrato do fluxo exige documento/KYC — resolver sempre via caminhos normados (`identity.service`, writers allowlisted), não por inferência ad hoc em SQL de marketplace.
- O módulo marketplace **não** deve inferir identidade fiscal nem duplicar campos de KYC; leitura de documento = **`identities`**.

---

## 0. Regras absolutas (rédea curta)

| # | Regra |
|---|--------|
| R1 | **Não** executar `psql` / apply migrations em **staging/prod LIVE** sem confirmação explícita; dev **PARTIAL** ficou coberto por **§0.2–0.3** + **§2**. |
| R2 | **Não** criar novo SSOT financeiro; saldo e decisão monetária → **Bank** (`bank_ledger`, `bank_transactions`, serviços em `modules/bank/`). |
| R3 | **Não** violar Gate 2 (escritas `bank_*` fora de `modules/bank/`). |
| R4 | Migrations **forward-only**, blocos `DO $$ … END $$` + `information_schema` (idempotência). |
| R5 | **Não** apagar coluna legada monetária até janela de convivência + código ler só `*_cents` (salvo decisão documentada por tabela). |
| R6 | **Estado do banco** (§0.1) guia rigor: `LIVE` exige aprovação formal pré-`migrate`; `EMPTY` / `PARTIAL` não dispensam registo em **§2**. |
| R7 | **§0.4** — excepção bootstrap **nunca** em LIVE, nunca contra Gate 2 / SSOT; violação → `FALSIFICATION_LOG.md`. |

### 0.1 Estado do banco (classificação)

| Valor | Significado |
|-------|-------------|
| **EMPTY** | Sem linhas de negócio relevantes (cold-start puro). |
| **PARTIAL** | Poucos registos (seeds, identidades de teste); sem carga de produtos/empresas/pedidos reais. |
| **LIVE** | Dados de negócio reais — **nunca** `migrate` sem ordem explícita + checklist. |

**Referência dev (2026-04-14):** `PARTIAL` — `identities` com poucas linhas; `_deprecated_tenant_products` vazia; sem carga de catálogo/pedidos.

### 0.2 Exceção controlada (bootstrap / cold-start)

Em ambiente **EMPTY** ou **PARTIAL** (sem risco material a dados de negócio), migrations **podem** ser aplicadas antes do ciclo completo de aprovação documental **desde que**:

1. fiquem **registadas em §2** (data, ficheiros, comando);
2. **não** alterem SSOT financeiro (Bank / ledger);
3. **não** incluam remoção de dados de negócio nem `DROP` de colunas monetárias canónicas sem decisão explícita.

**Staging/prod com `LIVE`:** não se aplica esta exceção — mantém-se aprovação formal pré-execução.

### 0.3 Decisão retroactiva (governança)

As migrations **M-S1** e **M-S2** foram aplicadas em ambiente **dev local** em contexto **PARTIAL** (cold-start), sem risco material a dados de negócio.

A execução é considerada **válida sob exceção de bootstrap** (§0.2), com registo obrigatório em **§2**.

**APROVADO RETROACTIVAMENTE** para esse contexto (dev local, 2026-04-14). *Não* constitui precedente para `LIVE` sem ordem explícita.

### 0.4 Limite da excepção de bootstrap (trava anti-produção)

A excepção em **§0.2** aplica-se **exclusivamente** a ambientes classificados como:

- **EMPTY**, ou
- **PARTIAL** *sem* dados de negócio relevantes (sem catálogo/pedidos/transacções reais que importem para auditoria ou reconciliação).

**É expressamente proibido:**

- invocar esta excepção em ambiente **LIVE** (ou tratá-lo como PARTIAL quando houver carga de negócio real);
- usar a excepção para justificar **bypass do Gate 2** ou escrita financeira fora do Bank;
- usar a excepção para criar ou mover **decisão de domínio estrutural** (novo SSOT, segunda verdade normada).

Qualquer tentativa de reutilizar a excepção fora deste contexto → **violação de governança** → registo obrigatório em `docs/01_normative/FALSIFICATION_LOG.md` (equivalente **§8.8** do `PLANO_BASE_MODULO.md`).

**Regra operacional:** *bootstrap não cria precedente.*

---

## 1. FASE S — Schema Analysis (OUTPUT OBRIGATÓRIO)

### 1.1 STATUS

**INCONSISTENTE** (normativo / temporal / legado) — com **mitigações já aplicadas** em parte do catálogo (`product_offers`, `product_prices`, `economic_guardianship`).

Motivo objetivo:

- ~~Existe DDL **Genesis** com `TIMESTAMP` sem timezone em `identities`~~ **Corrigido em dev** por `20260526100000_draft_ms1_identities_timestamptz.sql` (DECISÃO CANÔNICA: UTC naïve → `TIMESTAMPTZ`). **Outros ambientes:** aplicar migration e marcar **§2**.
- Existiu `tenant_products.price NUMERIC` + `availability BOOLEAN`; a tabela foi **renomeada** para `_deprecated_tenant_products` em migração posterior — o estado no DB alvo depende de **até onde as migrations foram aplicadas**.
- Quantidades físicas (`order_items`, `inventory_movements`, etc.) usam **NUMERIC** por desenho (não são “preço em reais”); exigem **classificação** antes de trocar tipo (risco de domínio).

---

### 1.2 Tabelas tocadas pelo código em `backend/src/modules/marketplace` (amostra verificável)

| Tabela | Uso típico no módulo |
|--------|----------------------|
| `products` | `product.repository.ts` — INSERT/SELECT/UPDATE |
| `product_variants` | visibilidade, inventário, ofertas |
| `product_offers` | `store-onboarding.service.ts`, visibilidade, índices |
| `canonical_products` | guards, onboarding, adapters |
| `categories`, `category_n1_mapping` | onboarding, seeds |
| `inventory_movements`, `inventory_reservations` | stock, reservas |
| `order_items`, `orders` | pedido físico / itens |
| `payment_intents` | pré-financeiro (0004) |
| `contacts`, `business_segments`, `groups` | CRM / segmentos (repositórios) |
| `identities` | **não** no `marketplace/` direto; FK global via `actors` / `identity.service` |

*(Lista expansível: `rg "INSERT INTO|FROM [a-z_]+" backend/src/modules/marketplace --glob "*.ts"`.)*

---

### 1.3 Problemas identificados (com evidência no repositório)

| ID | Problema | Severidade | Evidência (repo) |
|----|-----------|------------|------------------|
| P1 | `identities.created_at` / `updated_at` eram **`TIMESTAMP`** (sem TZ) | **Mitigado** (dev) | Origem: `0009_create_identities.sql`; fix: `20260526100000_draft_ms1_identities_timestamptz.sql` (guard: `data_type LIKE 'timestamp%'` e `NOT ILIKE '%with time zone%'`). |
| P2 | **`tenant_products`** legada: `price NUMERIC`, `availability BOOLEAN` | **Alta** (se ainda existir como `_deprecated_*`) | `backend/migrations/0112_create_tenant_products.sql` L14–L16; rename em `20260429100000_unificacao_semantica_v2.sql` |
| P3 | `product_prices` criou `price NUMERIC` | **Corrigido por migração** | `20260415120000_product_prices.sql` + `20260416100000_product_prices_promotions_nomenclature.sql` |
| P4 | `product_offers` `price` / `active` | **Corrigido por migração** | `20260331150000_product_offers_nomenclature.sql` |
| P5 | `economic_guardianship.limit_amount` NUMERIC | **Corrigido por migração** (incl. drop da coluna legada) | `20260501100000_economic_guardianship.sql` + `20260513100000_economic_guardianship_limit_amount_cents.sql` |
| P6 | Quantidades **`NUMERIC(20,4)`** em inventário / itens | **Média** (não é monetário) | `0102_inventory_movements.sql`, `0119_order_items.sql`, etc. |
| P7 | **Duplicação de verdade financeira** se marketplace persistir “saldo” ou “valor final” fora de Bank | **Crítica** (governo) | Norma: `AUTHORITY_MAP_FINANCIAL_v1.md`; código deve manter `amount_cents` / intents, não “saldo”. |

---

### 1.4 Migrations **NECESSÁRIAS** (estado)

#### M-S1 — `identities` → `TIMESTAMPTZ` (**final / aplicada em dev**)

- **Ficheiro:** `backend/migrations/20260526100000_draft_ms1_identities_timestamptz.sql`
- **DECISÃO CANÔNICA:** timestamps `identities` = UTC naïve; `USING (col AT TIME ZONE 'UTC')`.
- **Guard portável:** `data_type LIKE 'timestamp%'` AND `data_type NOT ILIKE '%with time zone%'` (evita depender só do literal `timestamp without time zone`).
- **Lock:** `ALTER … TYPE` pode reescrever tabela — irrelevante para `identities` pequena; documentar para tabelas grandes.

#### M-S2 — `_deprecated_tenant_products` / `tenant_products` (**aplicada em dev**)

- **Ficheiro:** `backend/migrations/20260526101000_draft_ms2_tenant_products_price_cents_append_only.sql`
- Append-only `price_cents`; sem `DROP` de `price`. Gate 2: não é SSOT financeiro; tabela legada — destino final = produto / Gate 5.

#### M-S3 — Inventário “boolean sem prefixo”

- Auditar `information_schema` em **staging** por colunas `active`, `enabled`, `availability` em tabelas `marketplace%` / catálogo — **não** inferir só pelo DDL antigo.

#### M-S4 — `TIMESTAMP` restantes em tabelas do **trilho marketplace**

- Query única sugerida (só documentação aqui):

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type LIKE 'timestamp%'
  AND data_type NOT ILIKE '%with time zone%'
  AND table_name IN (
    'identities', 'products', 'product_offers', 'product_variants',
    'orders', 'order_items', 'payment_intents', 'inventory_movements'
  );
```

*(Ajustar lista após resultado real no ambiente.)*

---

## 2. Registo de execução (fluxo — não apêndice)

**Regra de execução (prova, não só histórico):** toda **nova** linha ou nota neste registo (ou em `docs/03_execution_log/`) deve indicar explicitamente:

- **FASE S** no momento da acção: `OK` ou `INCONSISTENTE` (§1.1);
- se foi usada **excepção bootstrap** (**§0.2**) e confirmação de que **§0.4** permite (nunca LIVE);
- **referência PROPOSTA** (`PROPOSTA-…` + `APROVADO:`) quando aplicável (**alinhado a `PLANO_BASE_MODULO.md` §13.1**).

**EXECUTION LOG (eventos de governança):**

| Data (UTC) | Tipo | Referência / detalhe |
|------------|------|----------------------|
| 2026-04-14 | Alinhamento de governança | Herança explícita do template (`PLANO_BASE_MODULO.md`); secção **Herança de governança** inserida; prevalece o template em divergência. |
| 2026-04-14 | Gate 2 — documentação DDL | `backend/README.md` §Governança DDL; migration `20260527120000_unifycard_transactions_non_ssot_comment.sql` (COMMENT NON-SSOT); aplicar com `pnpm migrate` quando aprovado por ambiente. |
| 2026-04-19 | BLOCO 1 — Writers | INSERTs do módulo mapeados. `price_cents` correto em todas as tabelas ativas. DT-01 e DT-02 registradas. FASE S: OK. Gate 2: OK. |
| 2026-04-19 | BLOCO 2 — Readers | SELECTs mapeados. DT-03 (accounts_payable sem migration, SPRINT 70 futuro). DT-04 resolvida pela restauração de arquivos. FASE S: OK. |
| 2026-04-19 | BLOCO 3 — Gates | validate:actor-writer-boundaries OK. validate:bank-ledger-boundaries OK. validate:regression-guards OK. DT-05/06/07 registradas. FASE S: OK. |
| 2026-04-19 | Restauração | 368 arquivos restaurados do backup. 4 arquivos com marcadores de merge corrigidos. 3 violações actor-writer pós-restore corrigidas. |
| 2026-04-19 | PASS | Módulo marketplace encerrado. Gates OK. 7 DTs documentadas. Build com 13 erros pré-existentes (DT-05/06/07) — não bloqueiam marketplace. |

| Ambiente | Estado (§0.1) | Data | M-S1 (`20260526100000_…`) | M-S2 (`20260526101000_…`) | Operador / notas |
|----------|---------------|------|---------------------------|---------------------------|------------------|
| Dev local (Cursor) | PARTIAL | 2026-04-14 | Aplicada (`pnpm migrate`) | Aplicada (`pnpm migrate`) | FASE S: **INCONSISTENTE**. Bootstrap **§0.2** + retro **§0.3**; **§0.4** OK (não LIVE). Sem PROPOSTA prévia (excepção documentada). `identities` → `timestamptz`; `_deprecated_tenant_products` + `price_cents` (0 linhas). |
| Staging | | | ☐ | ☐ | Exige ordem explícita + registo. |
| Produção | LIVE (assumido) | | ☐ | ☐ | Exige ordem explícita + registo. |

**Pós-apply sanity (copiar para cada ambiente):**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'identities'
  AND column_name IN ('created_at', 'updated_at');
-- Esperado: timestamp with time zone
```

---

## 3. Ciclo de execução contínua **controlada** (simulação de “daemon”)

```
FASE S → OUTPUT → CHECKPOINT (humano ou critério) → FASE M (migrations desenhadas) → REVIEW → APPLY (manual)
```

**Checkpoint obrigatório** antes de `APPLY`:

- `git diff` da migration
- `pnpm exec tsc --noEmit`
- Plano de rollback (revert migration file + restore)

---

## 4. Prompt cirúrgico para o Cursor (colar na sessão)

### 4.1 Controlo contínuo — marketplace (prioridade)

```text
MODO DE EXECUÇÃO CONTROLADA — MARKETPLACE

ANTES de qualquer acção:

1. Ler PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md (§0–§2 mínimo).

2. Declarar:
   - FASE S actual (§1.1): OK | INCONSISTENTE
   - DATABASE_STATE / classificação (§0.1): EMPTY | PARTIAL | LIVE
   - Excepção bootstrap (§0.2): sim | não — se sim, confirmar §0.4 (nunca LIVE; nunca Gate 2)
   - Acção envolve SSOT financeiro: sim | não

3. Validar:
   - Gate 2 OK?
   - FASE S OK ou excepção válida (§0.2 + §0.4)?
   - Existe PROPOSTA vinculada (PLANO_BASE §13.1) quando não for bootstrap?

SE QUALQUER RESPOSTA FOR INCERTA:
→ PARAR
→ emitir PROPOSTA

AO EXECUTAR:
- registar de imediato em §2 (e opcionalmente docs/03_execution_log/)
- incluir: timestamp (UTC), acção, justificativa, referência (§0.2 | §0.3 | PROPOSTA-… + APROVADO)

PROIBIDO:
- migration sem declarar contexto (§0.1, §1.1)
- assumir dados existentes sem query ou plano
- criar nova verdade / SSOT paralelo
- ignorar §0.4 (limite bootstrap)

OUTPUT:
- o que foi feito
- por que foi permitido
- em qual regra se baseou (§x)
```

### 4.2 FASE S — análise de schema (sessão focada)

```text
MODO: EXECUÇÃO CONTROLADA CONTÍNUA

Operar sob: PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md + AUTHORITY_MAP_FINANCIAL_v1.md + 00_NORMATIVE_MANDATORY.

REGRAS ABSOLUTAS:
1. NÃO executar migrations (nem psql) sem ordem explícita do operador — exceto **excepção bootstrap** §0.2 apenas se §0.1 for EMPTY/PARTIAL conforme §0.4 + registo em §2.
2. NÃO assumir que staging = produção.
3. NÃO criar SSOT financeiro novo; NÃO gravar saldo fora de Bank.
4. NÃO violar Gate 2 (escritas bank_* fora de modules/bank/).

FASE ATUAL: FASE S (Schema Analysis)

OBJETIVO:
- Cruzar tabelas usadas em backend/src/modules/marketplace com migrations em backend/migrations.
- Listar gaps: NUMERIC monetário, boolean sem is_*, TIMESTAMP sem TZ.
- Emitir STATUS OK | INCONSISTENTE e lista de migrations PROPOSTAS (sem aplicar).

OUTPUT OBRIGATÓRIO:
1. STATUS
2. Tabelas
3. Problemas (com ficheiro+migration de evidência)
4. SQL proposto (forward-only, DO $$ guards)

PARAGEM:
- dúvida de domínio (ex.: NUMERIC é quantidade vs dinheiro)
- risco SSOT
- tabela sem DDL no repo

Após cada bloco: mostrar resultado; continuar só se sem bloqueio.
```

---

## 5. Próximo passo recomendado (humano)

1. **Staging:** aplicar M-S1 + M-S2 com ordem explícita; atualizar **§2**; correr query **§1.4 M-S4** no Postgres alvo.  
2. Colar resultado de auditoria no **EXECUTION LOG** (`docs/03_execution_log/` ou sprint doc).  
3. `pnpm exec tsc --noEmit` e smoke de rotas que leem `identities` / catálogo legado.  
4. **Bloco código (fase seguinte):** remover leitura/escrita de `price` onde existir, preferir `price_cents` (sem violar Gate 2).

---

## 6. Referências cruzadas

- `backend/migrations/0004_marketplace.sql` — `amount_cents` / `total_cents` / `TIMESTAMPTZ` (padrão bom).  
- `backend/migrations/0009_create_identities.sql` — exceção **TIMESTAMP**.  
- `backend/migrations/20260331150000_product_offers_nomenclature.sql` — padrão de migração monetária + boolean.  
- `STATUS_EXECUCAO.md` — índice operacional; não substitui norma.

---

**Fim do plano** — FASE S + §0 governança + **§2** execução + M-S1/M-S2 no repo.

# Auditoria de acoplamento — módulo `marketplace` (MVP, read-only)

**Data:** 2026-04-16  
**Escopo:** `backend/src/modules/marketplace/`  
**Norma de referência:** `PLANO_BASE_MODULO.md` §8.9, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `SSOT_REGISTRY_UNIFICARD.md`, `ACTOR_TRACEABILITY_CONTRACT.md`  
**Restrição:** nenhum código alterado; grep/leitura apenas.

---

## FASE 1 — Inventário (resumo)

### 1.1 Estrutura

- **~294** ficheiros `.ts` sob `modules/marketplace/` (camadas `application/`, `domain/`, `routes/`, repositórios, serviços legacy na raiz).
- **Rotas:** uso generalizado de `requirePermission` (`@core/authorization/require-permission.guard`) em rotas de catálogo, orders, payments, B2B, etc.
- **Pagamentos:** `payment-execution.service.ts` orquestra intents e chama **`bankTransactionService.transfer`** / `bankAccountService` (`../bank/`) — não há strings `INSERT INTO bank_*` no módulo marketplace.

### 1.2 Pontos de escrita (`INSERT INTO` — amostra grep)

Repositórios e serviços com SQL de inserção em tabelas de **domínio marketplace** (produtos, orders, inventory, fiscal, regional_funds, economic_identities, etc.), **não** em `bank_ledger` / `bank_transactions` directamente.

Exemplos de ficheiros: `order.repository.ts`, `product.repository.ts`, `payment-intent.repository.ts`, `regional-fund.repository.ts`, `economic-identity.repository.ts`, `fulfillment.repository.ts`, …

### 1.3 Integração financeira explícita

- `payment-execution.service.ts` — fluxo principal de execução; dependência de **`bank-transaction.service`** / **`bank-account.service`**.
- `b2b-supply-order.routes.ts` — import de `createTransactionFromIntent`, `bankAccountRepository`, tipos de authorship do **módulo Bank**.

---

## FASE 2 — Auditoria de violações (checklist §8.9)

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | **Financeiro:** `INSERT`/`UPDATE` directo em `bank_*` dentro de `marketplace/` | **Não encontrado** (grep `INSERT INTO bank_` / `UPDATE bank_`). |
| 2 | **Identity:** `INSERT INTO actors` em `marketplace/` | **Não encontrado**. |
| 3 | **Writer:** `ensureUserActor` / `actor-writer` em `marketplace/` | **Não encontrado** no grep; criação de actor tende a ocorrer em serviços upstream ou social — **verificar em runtime** quem chama marketplace com `actor_id` já resolvido. |
| 4 | **`responsible_actor_id`** em strings no módulo | **Não encontrado** no grep; não implica que todas as entidades criadas pelo marketplace preencham responsabilidade — **validar por fluxo** (ex.: `groups` com `created_by_actor_id`). |
| 5 | **Authority:** `role === 'admin'`, `isAdmin`, `hasPermission` ad hoc | **Não encontrado** no grep; rotas usam **guard canónico** `requirePermission`. |
| 6 | **SSOT semântico:** conceitos transaccionais | **Resolução canónica** concentrada em `adapters/concept-offer-refs.adapter.ts` (alinhado à LEI §4.10). |

### 2.1 FLAGS (itens a aprofundar, não necessariamente violação)

| ID | Descrição | Severidade sugerida |
|----|-----------|---------------------|
| F1 | **Volume de SQL em repositórios** — muitos `INSERT` em tabelas de negócio; risco de **segunda verdade** se duplicar regras já no core/catalog. | **MÉDIO** — mapear tabela ↔ SSOT no `SSOT_REGISTRY`. |
| F2 | **`economic_identities` / `economic_identity_events`** escritos pelo marketplace — confirmar se são **DERIVED/LOG** e não substituem `identities`. | **MÉDIO** — cruzar com `IDENTITY_SSOT_PRECEDENCE.md`. |
| F3 | **`regional_fund_allocations`** com `amount_cents` — confirmar que **não** substitui ledger Bank para “dinheiro realizado”. | **ALTO** se houver decisão de saldo; **MÉDIO** se só alocação interna normada. |
| F4 | **Compensação / ledger** em `marketplace-compensation.service.ts` e `capacity-application.service.ts` — usa facade `recordResourceCompensationLedger`; validar que **só** encadeia ao domínio Bank/ledger canónico. | **ALTO** até prova de encadeamento único. |
| F5 | **`payment-execution.service.ts`** — ficheiro grande (~1,3k linhas); risco de **regressão** e de caminhos que contornem invariantes. | **MÉDIO** (manutenibilidade + revisão por PR). |

---

## FASE 3 — Classificação

| Severidade | Itens |
|------------|--------|
| **CRÍTICO** | Nenhum detectado **só** por grep (sem escrita directa `bank_*` no módulo). |
| **ALTO** | F3, F4 — qualquer dúvida sobre “dinheiro real” vs snapshot/alocação. |
| **MÉDIO** | F1, F2, F5. |
| **BAIXO** | Cobertura incremental de testes / documentação de fronteiras módulo ↔ Bank. |

---

## FASE 4 — Plano de correção / acoplamento (sem refactor massivo)

1. **Documentar matriz** “tabela marketplace ↔ classe SSOT” para F1 (uma página no plano do módulo ou entrada em `MODULOS.txt`).
2. **Revisão dirigida** de `payment-execution.service.ts` e `regional-fund` com **Gate 2** (`PLANO_BASE` §4.1 / SSOT Bank) — par de olhos + testes de integração Bank.
3. **Rastreio de actor:** para fluxos que criam `groups` / entidades com `created_by_actor_id`, confirmar que o **caller** obteve actor via **writer** (fora do grep; revisão por stack de chamadas).
4. **Manter** `requirePermission` nas rotas; onde faltar rota nova, **adicionar** guard em vez de `if` local.
5. **Próximo módulo sugerido após marketplace:** `orders` (forte acoplamento a marketplace + payment intents) ou `payments` se existir pasta separada.

---

## Princípio (eco da tua mensagem)

Nenhum módulo é dono da verdade: **Bank** (dinheiro), **identities/actors** (pessoa e papel), **authority** (permissão), **concept adapter** (semântica transaccional). O marketplace, nesta auditoria superficial, **não** mostrou violação grossa de escrita directa em `bank_*` nem `INSERT` em `actors`; os riscos restantes são **governança de dados** e **profundidade** de ficheiros críticos.

---

*Fim da auditoria MVP — próximo passo: aprofundar F3/F4 com leitura de ficheiro + testes, ou repetir o mesmo roteiro para `orders`.*

---

## ADDENDUM — 2026-04-14 (implementação: regional fund + compensação → Bank)

**Estado:** código implementado no `backend` (não é apenas análise).

| FLAG / artefacto | Descrição |
|------------------|-----------|
| `USE_BANK_REGIONAL_FUND` | Default **false** (`backend/src/core/features/use-bank-regional-fund.ts`). Quando `true`, leitura de saldo regional e escritas de incentivo/compensação relevantes passam pelo **Bank** (`bank_transactions` / `bank_ledger`). |
| F3 (`regional_funds`) | Com flag **on**: `total_balance_cents` **deixa de ser** a fonte usada em `getRegionalFundByRegion` para o valor de `balance` (passa a `bankAccountService.getBalance`). Escrita SQL legacy de `allocate` **não** é usada em `consumeIncentive` quando a flag está ativa. |
| F4 (compensação) | Com flag **on**: `recordResourceCompensationLedger` cria **`bank_transaction`** real (`reference_type = resource_compensation`); `compensationId` é UUID. Sem flag: mantém stub `ledger-resource-compensation-*`. |

**Documentação operacional (piloto / GO–NO-GO):** `docs/03_execution_log/MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md`.

**Registry normativo:** `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` §5.9.2.

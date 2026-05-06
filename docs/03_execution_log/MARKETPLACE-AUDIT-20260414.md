# MARKETPLACE-AUDIT-20260414

**Módulo:** `backend/src/modules/marketplace`  
**Tipo:** auditoria **somente leitura** (sem alteração de código, migrations ou refactors)  
**Data:** 2026-04-14  
**Executor:** Cursor Agent  
**Ambiente FASE S:** PostgreSQL apontado por `DATABASE_URL` em `backend/.env` (local)

---

## 1. Inventário (ficheiros)

| Categoria | Quantidade (aprox.) | Notas |
|-----------|---------------------|--------|
| Total de ficheiros sob `marketplace/` | **324** | Inclui `.md` de relatório interno ao módulo |
| Rotas `*.routes.ts` | **53** | Entrada HTTP ampla (checkout, orders, B2B, fiscal, PDV deprecated, etc.) |
| `*repository*.ts` | **42** | Camada SQL concentrada em repositórios |
| Ficheiros com `*service*` no nome | **111** | Inclui `domain/`, `application/services/`, `services/` — **sobreposição de camadas** |
| Event bus / handlers | Ver §5 | Vários ficheiros em `application/events/`, `core/event-bus.ts`, handlers |

Pastas de topo relevantes: `application/`, `domain/`, `routes/`, `services/`, `facades/`, `core/`, `adapters/`, repositórios na raiz do módulo.

---

## 2. FASE S — Schema (tabelas vs código)

### 2.1 Tabelas com prefixo `marketplace_`

No BD verificado existem:

- `marketplace_plugins`
- `marketplace_plugin_executions`

### 2.2 Amostra alargada (código → existência no `public`)

Foi compilada uma lista de tabelas referenciadas por `INSERT INTO` / `FROM` no módulo (amostra de 58 nomes) e verificada com:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = ANY($1::text[]);
```

**Resultado no ambiente local:** **40 presentes** / **58 verificadas** — **18 tabelas referenciadas no código não existem** neste PostgreSQL:

| Tabela (código referencia) | Nota |
|----------------------------|------|
| `business_segments` | |
| `contacts` | |
| `groups` | possível colisão semântica com módulo `groups` / social |
| `product_attributes` | |
| `company_profiles` | |
| `commission_rules` | |
| `event_settlements` | nome próximo a domínio `events` — risco de confusão |
| `fiscal_documents` | |
| `fiscal_document_items` | |
| `fiscal_provider_attempts` | |
| `inventory_adjustments` | |
| `payment_methods` | |
| `regional_fees` | |
| `tax_profiles` | |
| `unifycard_payment_methods` | |
| `referral_codes` | |
| `order_revenue` | leituras em `real-margin.service.ts` |
| `payment_intent_splits` | leituras em `real-margin.service.ts` |

**Interpretação:** ou as migrações não foram aplicadas até ao fim neste ambiente, ou parte do código é **futura / morta** / depende de outro baseline. **Repetir a mesma query em CI/staging/prod** antes de qualquer refactor.

**Não foi feita** coluna-a-coluna `information_schema.columns` vs cada `INSERT` (próximo passo de BLOCO 1, se aprovado).

---

## 3. Writers — `INSERT` / `UPDATE` (mapa resumido)

Há **dezenas** de pontos de escrita em repositórios `.ts` (lista não exaustiva):

| Área | Tabelas exemplos |
|------|------------------|
| Catálogo / oferta | `products`, `product_variants`, `product_prices`, `product_offers`, `promotions`, `store_product_activations` |
| Pedidos | `orders`, `order_items`, `order_status_history` |
| Inventário | `inventory_movements`, `inventory_reservations`, `inventory_balances`, `inventory_lots`, `stock_transfers`, … |
| Pagamentos (estado app) | `payment_intents` |
| Fiscal / comissão / perfis | repositórios que apontam para tabelas **ausentes** no BD local (§2.2) |
| Regional / fundo | `regional_funds`, `regional_fund_allocations`, `regional_activation_*`, `regional_impact_snapshots` |
| Identidade económica | `economic_identities`, `economic_identity_events` |
| Plugins | `marketplace_plugins`, `marketplace_plugin_executions` |

**Classificação preliminar:**

- **Canónico:** repositórios dedicados com SQL explícito (padrão dominante).
- **Duplicado / risco:** duas classes com nomes semelhantes para “orders” — `MarketplaceOrdersModule` (`domain/orders/marketplace-orders.service.ts`) vs `MarketplaceOrdersService` (`services/marketplace-orders.service.ts`); dois `marketplace-dispatch.service` (`domain/` vs `services/`).
- **Financeiro:** ver §7 — `payment-execution.service.ts`, `payout.service.ts`, `b2b-supply-order.routes.ts` chamam **Bank** explicitamente.

---

## 4. Readers

- **`SELECT *`:** **0 ocorrências** em `backend/src/modules/marketplace/**/*.ts` (grep).
- **Colunas legadas / drift:** não mapeado campo a campo; o risco principal levantado por esta auditoria é **tabelas inexistentes** no BD alvo (§2.2).

---

## 5. Event bus — paralelismo

Existem **três** mecanismos distintos tocados pelo módulo:

| Bus | Ficheiro | Papel |
|-----|----------|--------|
| **Sistema** | `@core/events/event-bus` | Usado em `register-marketplace-dispatch-accepted-handlers.ts` — `eventBus.registerHandler(...)` |
| **Domínio marketplace** | `core/event-bus.ts` — `domainEventBus` | Eventos de domínio (`DomainEvent`), métricas + timeline; `subscribe` / `publish` |
| **Marketplace “nomeado”** | `application/events/event-bus.ts` + `marketplace-event-bus.ts` — `marketplaceEventBus` | Bus separado (comentário: intra-módulo, **não** canónico global) |

`marketplace.service.ts` expõe `readonly eventBus = marketplaceEventBus` e também configura `domainEventBus` (subscribes).

**Achado:** superfície elevada para **dupla publicação** ou handlers inconsistentes se o mesmo facto de negócio passar por mais do que um bus sem contrato escrito.

---

## 6. SSOT (respostas objetivas)

| Pergunta | Resposta preliminar |
|----------|---------------------|
| O marketplace **cria** verdade? | **Sim** — pedidos, inventário, intenções de pagamento (`payment_intents`), ofertas, preços de produto, dados regionais próprios. |
| Ou **consome**? | **Sim** — `canonical_products`, `concepts`, `actors`, `categories`, `tenants`, catálogo SSOT. |
| Preço vem de onde? | Principalmente `product_prices` / estratégias em serviços de pricing; amarrar ao **07** e ao catálogo canónico num trilho futuro. |
| Estado do pedido? | `orders` + `order_status_history` (e lógica em serviços / domain). |
| Pagamento definitivo? | Fluxos orquestrados com **`bankAccountService` / `bankTransactionService`** em `payment-execution.service.ts` e afins — **consumo do Bank SSOT**, não ledger paralelo óbvio neste grep. |

---

## 7. Vazamento de domínio / Bank

**Referências diretas a `@modules/bank` / serviços bank** (amostra grep):

- `payment-execution.service.ts` — intenso (`ensurePlatformAccounts`, `transfer`, …)
- `payout.service.ts`
- `b2b-supply-order.routes.ts` — `bank-ledger.service`, `bank-account.repository`

**Leitura de `actors`:** queries em `payment-execution.service.ts` (resolução de dono).

**Conclusão:** o módulo **não esconde** dependência financeira; o risco não é “import bank” em si, e sim **dupla fonte de estado** (tabelas `orders`/`payment_intents` vs `bank_*`) se invariantes não estiverem documentados.

---

## 8. Duplicação estrutural

| Achado | Gravidade |
|--------|-----------|
| `MarketplaceOrdersModule` vs `MarketplaceOrdersService` (nomes e ficheiros) | Média — onboarding de devs e grep |
| `domain/.../marketplace-dispatch.service.ts` vs `services/marketplace-dispatch.service.ts` | Média |
| Múltiplos event buses (§5) | Média a alta |
| Rotas HTTP muito numerosas (53) sem mapa único no doc | Baixa a média (operacional) |

---

## 9. Tabela de achados (síntese)

| Achado | Onde / evidência | Gravidade | Motivo |
|--------|------------------|-----------|--------|
| Drift schema: 18 tabelas no código sem tabela no BD local | §2.2 — query `information_schema` | **Alta** | Runtime 42P01 ou código morto |
| Três sistemas de event bus em interação | §5 | **Média** | Risco de inconsistência de handlers |
| Duplicação nominal orders/dispatch | §3, §8 | **Média** | Manutenção e bugs de wiring |
| Escrita `regional_funds` / alocações no marketplace | `regional-fund.repository.ts` | **Média** → **mitigado (opt-in)** | Ver `MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md` + `SSOT_REGISTRY_UNIFICARD.md` §5.9.2 (`USE_BANK_REGIONAL_FUND`) |
| Sem `SELECT *` no módulo | grep | **Info** | Bom sinal |
| Dependência Bank explícita em pagamento/payout/B2B | §7 | **Info** | Esperado; validar invariantes num trilho dedicado |

---

## 10. Conclusão

- O módulo **marketplace** é **grande**, **multi-camadas** (`application` / `domain` / `services` / repositórios) e **acoplado** a catálogo canónico, identidade (`actors`) e **Bank** nos fluxos de pagamento.
- A **FASE S** neste ambiente revelou **lacunas de schema** relevantes: **18** tabelas referenciadas no código **ausentes** do `public` local — **bloqueador para assumir “schema = código”** até repetir a verificação com migrações aplicadas.
- **Próximo passo sugerido (não executado aqui):** definir BLOCO 1 (writers + DDL) e BLOCO 2 (readers + event bus) **por sub-domínio** (ex.: orders+payment_intents primeiro), com log dedicado — só após matriz de tabelas **100% presentes** no alvo.

**Actualização 2026-04-14:** foi implementada migração **opt-in** marketplace → Bank para fundo regional (leitura + `consumeIncentive`) e compensação de recurso (`resource_compensation`), com critérios de piloto e GO/NO-GO em `MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md`.

---

## 11. Queries reprodutíveis

Listar tabelas `marketplace%`:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'marketplace%'
ORDER BY 1;
```

Verificar existência de um conjunto de tabelas (ajustar lista ao código em revisão):

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = ANY(ARRAY['orders','products',/* ... */]);
```

---

**Fim do relatório — nenhuma alteração de código foi feita para produzir este documento.**

---

## Appendice A — Errata (2026-04-14)

- **`order_revenue`:** não é tabela física — é **CTE** em `real-margin.service.ts`. A lista “18 ausentes” deve ser tratada como **17 tabelas** + 1 falso positivo.
- **Fechamento FASE S:** ver `MARKETPLACE-SCHEMA-FIX.md` — causa raiz (DDL em `migrations_archive` não promovido; `payment_intent_splits` sem DDL na cadeia).

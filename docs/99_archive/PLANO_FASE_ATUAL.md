Plano em **ordem de execução**, já no trilho de **executor disciplinado**, não de arquiteto filósofo de LinkedIn. O bastão está claro: o **bloqueio estrutural de longo prazo** continua a ser **governança evolutiva de `canonical_products`** (GTIN, `concept_id`, eventos, colisão global vs scoped) — com **DDL de tabela agora versionada** via baseline (ver *ONDE CONTINUAR* e Fase G abaixo). Em paralelo, a **ponte de execução loja** `CANONICAL → PRODUCT → OFFER` foi **fechada no código** (ver *Marco recente — catálogo loja*). A execução tem que respeitar protocolo, SSOT e fluxo end-to-end.

**Sincronização EXECUTOR 2026-04-08:** legenda **Cls** — [✓] fechado no repo/testes indicados · [~] parcial · [ ] aberto · [X] histórico/arquivo. **Plano seed** histórico: `docs/99_archive/PLANO_EXECUCAO_SEED.md`. Pendências sistémicas: `BACKLOG_CONSOLIDADO.md` + `EXECUTION_CONTEXT_LOCK.md`.

**Sincronização SSOT 2026-04-12:** `STATUS_EXECUCAO.md` (raiz) passou a declarar explicitamente que **não** tem autoridade de decisão; tabela §17 e «Onde estamos» alinhados ao trilho v3 e ao log em `docs/03_execution_log/2026-EXECUCAO_V3.md` (ver também `PLANO_EXECUCAO_CURSOR_v3.md` no mesmo diretório).

| Trilho (leitura rápida abaixo) | Cls |
|--------------------------------|-----|
| §9 E2E catálogo → intent → Bank | [✓] |
| Pricing no pedido | [✓] |
| §17 pronto plataforma | [✓] |
| Migrate / CI (migrations no repo) | [✓] ficheiros · [~] job CI Postgres opcional |
| `canonical_products` global em queries | [~] DDL `20260502100000_*` · adapter/2B |

### Pastas na raiz — categorias, seeds e patches

Dois diretórios na raiz do repositório estão **amarrados** ao mesmo plano de execução:

- **`isto-e-para-voce/`** — arquitetura, governança, **`STATUS_EXECUCAO.md`** (feito / pendente, inclui **Fase 3.5** governança `product_concepts`). Plano de seed **histórico** arquivado: **`docs/99_archive/PLANO_EXECUCAO_SEED.md`** (stub em `isto-e-para-voce/PLANO_EXECUCAO_SEED.md`). Índice: `isto-e-para-voce/README.md`.
- **`leia-esta-pasta/`** — **`PATCH_*.md`** + **`README.md`** (índice). **Não** contém SQL duplicado: os espelhos `*.up.sql` foram **eliminados**; conteúdo equivalente está **concluído** em `backend/migrations/` (timestamps `20260416100000`, `20260416110000`, `20260416120000`, etc.). **Sempre** correr migrate a partir de `backend/migrations/`.

### Onde estamos agora (leitura rápida)

| Trilho | Situação |
|--------|----------|
| **Testes em camadas (§10.1–3)** | Fechados (unit, mocks, fluxo parcial até order sem ledger). |
| **§9 — E2E catálogo → intent → Bank** | **Fechado** com Postgres real: `catalog-order-ledger.e2e.test.ts`; requer `DATABASE_URL` + migrations (incl. `product_prices` / `promotions`). |
| **Pricing no pedido** | **Fechado** no código: preço vem de `product_prices` via `PricingService`; falhas **não** são engolidas no `OrderService`. |
| **§17 — “pronto próxima fase” plataforma** | **Fechado no trilho do executor (v3):** critérios da secção **#17** verificados conforme `docs/03_execution_log/PLANO_EXECUCAO_CURSOR_v3.md` e evidência em `docs/03_execution_log/2026-EXECUCAO_V3.md` (§5A/eventos, visibilidade §8, governança em `canonical_products`, guard empresa×concept, versionamento industrial, ADR §5.1). §9 **não** substituiu §17 sozinho; o conjunto do v3 fechou o gate no âmbito documentado no log. **Prova por ambiente alvo** (ex. produção): obrigatória quando a governança do projecto a exigir — não confundir “fechado no repo + evidência de dev” com assinatura operacional de produção. **Opcional:** invariantes de dados contínuas em CI — processo, não condição do fecho v3. |
| **§10–11 pool / escrow** | **Não abrir** sem decisão explícita de roadmap. O gate §17 normativo está satisfeito no **trilho v3** conforme execução e log referidos acima; avanço para §10–11 deixa de ser “bloqueado por §17 em aberto no código” e passa a ser **escolha de produto** + evidência no ambiente alvo quando aplicável. |
| **Migrate / CI** | Fila **corrigida** no repo (`20260411120000` + pricing). Correr `pnpm migrate` após pull; E2E de pricing requer **`20260415120000`** + **`20260415120100`** aplicadas. |

---

## ONDE CONTINUAR (checkpoint)

**Última consolidação registada neste documento:** baseline de `canonical_products` no repo + memória normativa no protocolo do agente; inventário multi-unidade (FASE F) implementado no código/migrations; **pipeline de criação canónica** + **§5.2–5.3 / fronteira PG** no pacote `catalog/canonical`; **CI bloqueante** (`arch:core:validate` + `lint` sem `|| true`); **Passos 1–3 de testes (§10)** — invariantes canónico, onboarding, fluxos parciais até order (mocks, sem DB, sem ledger no Passo 3); **§9 E2E real** validado com app + Postgres (catálogo → `intent/execute` → `bank_ledger`); **pricing declarativo** com tabelas **`product_prices`** + **`promotions`** no trilho de migrations e **sem fallback silencioso** de preço em `OrderService`.

| Área | Estado | Ao retomar |
|------|--------|------------|
| **`canonical_products` (DDL no Git)** | Migration **`20260412000000_canonical_products_baseline.sql`** — `CREATE TABLE IF NOT EXISTS` + índices alinhados ao banco de desenvolvimento; **não** recupera ficheiros `2026040114*` ausentes. | Correr **`migrate`** em clone/CI fresco para validar no-op vs criação; **não** usar `migrations_archive` como SSOT (ver **`docs/01_normative/00_AGENT_PROTOCOL.md` §17**). |
| **§9 — E2E até Bank (gate operacional)** | **Validado na prática:** `backend/tests/e2e/catalog-order-ledger.e2e.test.ts` — `resolveRefsFromVariant` → `ok`; `POST /intent/execute` sem `REF_RESOLUTION_FAILED`; ledger com mint + `transfer` (`reference_id` = order); seed de crédito em conta **system** para não disparar `COVERAGE_EXCEEDED`. **Skip** sem `DATABASE_URL` (CI sem Postgres não falha). App mínima: `build-intent-e2e-app.ts` (não carrega `BOOT` completo). | Correr `pnpm test:e2e:catalog` com `DATABASE_URL` após migrations; opcional: job CI com serviço Postgres + `DATABASE_URL` + migrate. **Nota:** “pagamento” no teste usa `bankTransactionService`, não `POST /marketplace/payments/execute` (repositório de pagamento ainda stub). |
| **Pricing (`product_prices` / promoções)** | Migrations **`20260415120000_product_prices.sql`** + **`20260415120100_promotions.sql`** (alinhadas a `product-price.repository.ts` e `promotion.repository.ts`). `OrderService` (**`createOrderWithItemsAndReservations`** e **`addItem`**) **exige** resolução via `pricingService.getCurrentPrice` — produto em falta ou preço em falta **falha explicitamente** (sem `try/catch` que engolia erro). E2E insere linha em `product_prices` para a variante seed. | Aplicar migrations em todos os ambientes; se já existir `promotions` legada (arquivo), reconciliar antes do apply. |
| **Inventory multi-unidade** | **FASE F** fechada no **código/repo**: `20260411120000_inventory_movements_actor_id.sql` — `product_offers.is_active` (não `active`); backfill com trigger append-only **desligado** durante `UPDATE`; passo 8 sem `FROM LATERAL` inválido no `UPDATE`; passo 9 fallback para qualquer actor do tenant se não houver `company`. | Próximo produto: **idempotência por linha** (item vs cabeçalho), se necessário — ver FASE F *Limitação conhecida*. |
| **Governança canónica (GTIN, concept, lifecycle)** | Ainda **prioridade estratégica**; baseline só fecha **existência** da tabela no repo. | Trilho §3 / observabilidade / travas global vs scoped (tabela *Veredito*). |
| **Onboarding loja / categorias `metadata.domain = marketplace`** | `store-onboarding.service.ts`: `seedCanonicalLines` opcional com validação de recorte (department + selected) + dedupe por id com catálogo; materialização `CANONICAL → PRODUCT → OFFER` inalterada. | Testes §10 Passos 2–3 em `tests/unit/store-onboarding.service.test.ts` (incl. ligação explícita canonical → product → offer). |
| **Estrutura base marketplace por tipo de empresa** | Trilho **planeado** (sem DDL nesta fase): categorias base → tipos de empresa que **referenciam** categorias → herança no onboarding; ver secção **Estrutura Base de Marketplace por Tipo de Empresa** (após Passos §10.1–3 neste doc). | Executar na ordem 1→4 da secção; não duplicar SSOT de categorias; produtos/canonicals só na etapa 4 (documentada como posterior). |
| **README `backend/README.md`** | Pode ainda referir ficheiros `2026040114*` — **cruzar** com baseline real ao documentar. | Atualizar doc operacional quando conveniente (fora do âmbito mínimo deste plano). |

**Frase-guia:** o problema era **repo incompleto face ao banco** após reconstrução; a baseline **fecha o presente** sem reescrever histórico no PostgreSQL.

### Validação em camadas (§8 / §10 — ordem do plano)

**Congelar ordem:** invariantes e testes de serviço **antes** de E2E (§9); E2E só valida fluxo quando os invariantes já provam regras.

| Passo | O quê | Estado |
|--------|--------|--------|
| **1** | Invariantes `canonical-product-creation.service` (GTIN, match forte, sem match, validação 400) — `jest.mock` do repositório, sem banco | **Feito** — `backend/tests/unit/canonical-product-creation.service.test.ts` |
| **2** | Onboarding: `seedCanonicalLines`, categoria fora do recorte, domínio `marketplace`, dedupe seed + catálogo — mocks (sem banco) | **Feito** — `backend/tests/unit/store-onboarding.service.test.ts` |
| **3** | Fluxos parciais: cadeia onboarding (`canonical → product → offer`); order DRAFT + `addItem` (variante → product → pricing, **sem** ledger) | **Feito** — `store-onboarding.service.test.ts` (describe *Passo 3*); `marketplace-order-partial-flow.test.ts` |
| **§9** | E2E completo (incl. ledger): catálogo real + Postgres + `intent/execute` + `bank_ledger` | **Feito** — `backend/tests/e2e/catalog-order-ledger.e2e.test.ts`; script `pnpm test:e2e:catalog` (ver `backend/package.json`). Critérios do §9 (neste doc): **(1)** `resolveRefs` ok **(2)** checkout canónico sem `REF_RESOLUTION_FAILED` **(3)** liquidação registada no ledger. |

**Nomenclatura e fronteira técnica:** alinhar a **`docs/01_normative/07_NOMENCLATURA_CANONICA.md`** (§5.5 ficheiros; §5.2–5.3 camelCase + `DbRow` + mappers). Tipos PG em `canonical-product-db.types.ts`; **não** importar esse módulo fora de `src/core/catalog/canonical` (depcruise `canonical-product-db-types-boundary` + ESLint).

**Ordem de leitura do trilho:** os Passos **1–3** (§10) consolidam invariantes e fluxos parciais; a secção seguinte define o **próximo pacote de produto** (estrutura marketplace por tipo de empresa) **antes** de assumir o §9 E2E como único foco de validação ponta a ponta — o §9 na tabela acima continua a marcar o gate já exercitado quando `DATABASE_URL` + migrations estão alinhados.

## Estrutura Base de Marketplace por Tipo de Empresa

**Objetivo:** preparar o sistema para criação de empresas com onboarding pré-configurado, evitando setup manual de categorias e permitindo início imediato de operação (cadastro de estoque e preços).

### Ordem obrigatória de execução (não inverter)

**1. Popular categorias base (marketplace)**

- Inserir categorias padrão com `metadata.domain = 'marketplace'`.
- Garantir hierarquia consistente (se aplicável).
- Categorias devem ser genéricas e reutilizáveis (ex.: alimentos, bebidas, higiene, etc.).
- **Não** associar ainda a tipos de empresa nesta etapa.

**2. Definir tipos de empresa (templates de negócio)**

- Criar estrutura para representar tipos de empresa (ex.: padaria, supermercado, restaurante, etc.).
- Cada tipo de empresa deve mapear um conjunto de categorias relevantes.
- **Não** duplicar categorias — apenas referenciar categorias existentes.
- **Não** criar nova fonte de verdade (respeitar SSOT de categorias).

**3. Implementar lógica de herança no onboarding**

- No fluxo de criação de empresa:
  - ao selecionar o tipo de empresa, aplicar automaticamente:
    - categorias relevantes;
    - estrutura inicial do catálogo.
- Garantir que:
  - categorias aplicadas pertencem ao domínio marketplace;
  - não há duplicação de categorias;
  - tudo respeita `tenant`.

**4. Preparar para futura etapa (não implementar agora)**

- População de produtos (`canonical` → `product` → `variant` → `offer`).
- Apenas documentar que essa etapa vem **depois** da estrutura de categorias.

### Regras importantes

- **Não** alterar schema neste momento (usar estrutura existente).
- **Não** misturar com governança de `canonical_products`.
- **Não** antecipar E2E ou lógica financeira.
- **Categoria aplicada ≠ categoria criada:** no onboarding (incl. herança por tipo de empresa), **nunca** criar linhas novas em `categories` — só **referenciar / associar** categorias já existentes (seed ou catálogo base).
- Manter separação clara:
  - **categoria** = estrutura;
  - **produto** = instância futura.
- Respeitar **`docs/01_normative/07_NOMENCLATURA_CANONICA.md`**.

### Resultado esperado

- Nova empresa criada com tipo definido já possui:
  - categorias pré-configuradas;
  - estrutura pronta para cadastro de produtos.
- Utilizador só precisa inserir:
  - estoque;
  - preços.

---

## Marco recente — catálogo loja (Fase A + B, código)

**Documento vivo:** esta secção deve ser revista sempre que o trilho de migrations ou o onboarding mudarem.

| Marco | O que foi feito | O que **não** mudou |
|--------|-----------------|---------------------|
| **Fase A — camada `products`** | `CreateProductInput` / `Product` com `canonicalProductId` opcional; `product.repository` persiste e lê `canonical_product_id`; `getProductByCanonicalId(tenantId, canonicalId)` no repositório e em `productCatalogService`. | Schema: coluna já existia (`20260404090000_products_canonical_product_id_b2b`); sem nova migration neste marco. |
| **Fase B — onboarding** | `store-onboarding.service.ts`: por cada canónico INDUSTRIAL, resolve ou cria linha em `products` (com `canonical_product_id`) e só então cria `product_offers` com `products.id` — **FK `product_offers → products` respeitada**. | Sem alteração a `product_offers` (só deixa de receber id de canónico por engano). |
| **Fase G — baseline `canonical_products` (repo)** | Migration **`20260412000000_canonical_products_baseline.sql`**: consolida no Git o DDL da tabela (idempotente) para clones e CI; norma em **`00_AGENT_PROTOCOL.md` §17**. | Não substitui governança futura (GTIN/concept/events); `migrations_archive` permanece histórico não aplicado pelo runner. |
| **Fase C — unicidade + idempotência** | Migration `20260410140000_uidx_products_tenant_canonical.sql`: índice único `(tenant_id, canonical_product_id)` com `WHERE canonical_product_id IS NOT NULL`. `product.repository.createProduct`: em violação **23505** desse índice, devolve o produto existente via `getProductByCanonicalId` (sem erro ao cliente). | **Apply:** se já existirem duplicatas no tenant, a migration falha até deduplicação manual. |
| **Fase D — `category_id` hard (§6)** | Migration `20260410150000_products_category_id_not_null_fk.sql`: guard em PL/pgSQL (aborta se `category_id` NULL ou órfão); `ALTER COLUMN category_id SET NOT NULL`; `fk_products_category` → `categories(category_id)` (`ON DELETE RESTRICT`). `product.repository.updateProduct`: não permite limpar categoria (reutiliza `requireCategoryIdForProductCreate`). | **Apply:** falha com mensagem explícita se houver linhas inválidas; categorias globais pós-0092. |
| **Pipeline entrada canónica (governança incremental)** | `canonical-product-creation.service.ts` + `canonical-product.repository.ts`: dedupe por GTIN e por match forte nome+marca+`category_id`; tipos PG centralizados em `canonical-product-db.types.ts`; §5.2–5.3 no pacote `canonical`; boundary enforcement (depcruise + ESLint). `seedCanonicalLines` no onboarding. | **Não** adicionar `concept_id` / tabela `concepts` neste trilho até decisão explícita do plano §3. |

**Decisões próximas em cima deste documento (sugeridas):**

1. **Governança `canonical_products`:** trilho §3 / evoluções pós-baseline — continua prioridade para “proto → produção” (**baseline DDL:** `20260412000000_canonical_products_baseline.sql` já no repo).
2. ~~**Idempotência `(tenant_id, canonical_product_id)`**~~ — **feito (Fase C)**; manter alinhamento com §14 em outros fluxos de criação.
3. ~~**Contrato de API:** `productId` ambíguo~~ — **feito:** resposta usa `canonicalProductId` (`AvailableCatalogProduct` backend + `frontend/src/api/store-onboarding.ts`), alinhado ao §5 / distinção face a `products.id`.
4. ~~**`products.category_id` NOT NULL + FK**~~ — **feito (Fase D)**; aplicar migration nos ambientes.

**Próxima leitura obrigatória cruzada:** `docs/01_normative/00_AGENT_PROTOCOL.md` (mapa N0/N1/N2 / categories / CONCEPT / **§17 baseline `canonical_products`**) + schema real aplicado no ambiente.

5. **Inventory multi-unidade:** ver **FASE E — INVENTORY (análise)** abaixo; **não** implementar extensão de ledger até modelo de unidade (store/location) fechado. **Modelo de unidade fechado** na subsecção **MODELO DE UNIDADE OPERACIONAL (OFICIAL)** (mesma FASE E); implementação técnica do ledger só depois, alinhada a esse texto. **Implementação executada (FASE F):** migration `20260411120000_inventory_movements_actor_id.sql` + serviços/repositório (`actor_id`, elegibilidade, índice único alargado); pormenores na secção **FASE F — INVENTORY MULTI-UNIDADE (IMPLEMENTAÇÃO)**.

---

## FASE E — INVENTORY (análise)

**Documento vivo:** rever após desenho de multi-unidade ou alterações em `inventory_movements` / `inventory_balances`.

**Origem:** mapeamento ASK do repositório (migrations `0102`, `0103`, `0124`, `20260331140000`, `20260410_uidx_inventory_movements_reference` + `inventory.service` / `inventory-movement.repository`).

### Estado atual

* **`inventory_movements`** = **SSOT** de quantidade física: ledger **append-only** (triggers impedem `UPDATE`/`DELETE`), tipos `IN` / `OUT` / `ADJUSTMENT`, FK a `product_variants`, RLS por `tenant_id`.
* **Saldo “real”** = **derivado por soma** sobre o ledger (`IN` +, `OUT` −, `ADJUSTMENT` conforme regra no código); **não** se assume `inventory_balances` como verdade absoluta.
* **`product_variants`** ligado a **`products`** por FK composta `(tenant_id, product_id)` — **coerente** com Fases C/D (produto e categoria travados no modelo operacional).

### Limitações identificadas

1. **Multi-filial / multi-local:** **inexistente** no schema atual do movimento — não há `store_id`, `location_id` ou equivalente como dimensão de primeira classe. O estoque modelado é, na prática, **por `(tenant_id, product_variant_id)`** (mais opcionalmente **lote** / `metadata`). O sistema não distingue “30 na loja A / 70 na loja B” no ledger.
2. **Idempotência:** **parcial** — índice único `uidx_inventory_movements_reference` aplica-se só quando `reference_type` e `reference_id` estão preenchidos; movimentos **sem** referência podem **duplicar** em retries mal desenhados.
3. **Read model:** **`inventory_balances`** é projeção/cache; a app atualiza após movimento de forma **best-effort** (falha não bloqueia). **Pode divergir** do ledger até reconciliação — comportamento **esperado** no desenho, não bug de intenção.
4. **Nomenclatura código vs BD:** risco de desalinhamento **`createdAt` vs `created_at`** no `inventory-movement.repository` face à snake_case (`0124`) — **validar** no ambiente com migrations aplicadas.

**Nota pós-FASE F:** o ponto 1 acima descrevia o ledger **antes** de `actor_id`. Com **`20260411120000_inventory_movements_actor_id`**, a unidade operacional está modelada — ver **FASE F** e **MODELO DE UNIDADE OPERACIONAL (OFICIAL)**. O saldo agregado por variante **sem** filtrar `actor_id` pode continuar a somar **várias** unidades (comportamento herdado até evolução de read model / APIs).

### Classificação

| Área | Status |
|------|--------|
| Ledger (SSOT) | OK |
| FK / integridade (variante → produto) | OK |
| Idempotência (sem referência) | PARCIAL |
| Multi-filial / multi-local | ~~INEXISTENTE~~ → **unidade = `actor_id`** (FASE F); saldo por unidade = filtrar movimentos |
| Read model (`inventory_balances`) | PARCIAL (cache, não SSOT) |

### Decisão arquitetural (nesta fase do plano)

* **Não** alargar implementação de inventory “multi-filial” **antes** de fechar o **modelo de unidade** (o que é “local de stock”: loja, actor, armazém, filial).
* **Manter** `inventory_movements` como **única fonte de verdade** de quantidade; qualquer extensão deve preservar **saldo = soma dos movimentos** (não gravar saldo mutável como verdade paralela).

### Próximo passo (pós-análise)

* Desenhar **modelo de unidade** (store / location / vínculo com `actors` ou entidade nova).
* Decidir: **coluna** no movimento vs **tabela de locais** vs uso disciplinado de `metadata` (com travas).
* Definir **impacto no ledger** (novas colunas, índices, idempotência por `(tenant, variant, location, ref)` se aplicável) e **invariantes** documentados.
* Corrigir, se necessário, **alinhamento SQL** timestamp no repositório após confirmação do schema real.

### MODELO DE UNIDADE OPERACIONAL (OFICIAL)

**Atualização:** o desenho de unidade referido em *Próximo passo (pós-análise)* fica **fechado** nesta subsecção; o trabalho seguinte é **implementação** (migrations, validação de elegibilidade, read model).

**Documento normativo para inventory multi-unidade.** Qualquer migration ou código que grave movimento físico deve respeitar isto.

#### Definição

* **Unidade operacional (local de stock)** = um **`actors.id`** pertencente ao **mesmo `tenant_id`** do movimento.
* **Não** criar, nesta fase, tabela nova `stores` / `branches` / `warehouses` — **reutilizar** `actors` já usados no marketplace e pedidos.

#### Restrição (crítico)

* **Nem todo `actor` é unidade de estoque.** Permitir movimento apenas quando o actor for **elegível** como unidade (evitar stock “pendurado” em cliente, `system`, etc.).

#### Critério inicial de elegibilidade (evolutivo)

* **`actor_type = 'company'`** no modelo genesis (`0002_identity` / evoluções), **ou**
* **Actor já usado como “loja / comerciante”** no fluxo existente, nomeadamente:
  * `product_offers.merchant_id` → `actors(id)`
  * `orders.seller_actor_id` (e, quando aplicável, contexto de venda) → `actors(id)`
  * Onboarding: `storeId` = `actorId` da loja
  * `store_product_activations.store_id` → `actors(id)`

**Nota:** a implementação deve **validar** elegibilidade na aplicação (e, quando possível, reforçar com política/constraint ou documentação de papéis); **refinar** a lista (ex.: vínculo explícito `actor` ↔ `companies`) numa iteração posterior se o produto exigir.

#### Uso já consolidado no sistema (âncoras)

* Oferta: **`merchant_id`** = actor.
* Pedido: **comprador / vendedor** = actors.
* Loja no onboarding: **actor** como identidade da loja no tenant.

#### Invariante alvo do ledger (após implementação)

* Cada linha de **`inventory_movements`** deve identificar inequivocamente o stock em **`tenant_id` + `actor_id` (unidade) + `product_variant_id`** (mais lote opcional, como hoje).
* **Saldo por unidade** = **soma dos movimentos** filtrada por essa chave — **append-only** mantido; **não** introduzir “saldo mutável” como verdade paralela ao ledger.

#### Regras

* Todo movimento de inventário **válido** associa: **tenant**, **actor elegível (unidade)**, **variante**.
* **`inventory_balances`** permanece **cache**; se existir por variante só, deverá **evoluir** para refletir unidade — sem substituir o ledger.

#### Decisão explícita

* **Não** duplicar entidade “loja” em nova tabela nesta fase.
* **Não** alterar o papel de **`actors`** no resto do core — apenas **restringir** quem pode ser **unidade de stock**.

#### Próximo passo de implementação (bloqueado até execução técnica)

* Migration(ões): adicionar **`actor_id`** (ou nome canónico alinhado ao protocolo) a **`inventory_movements`**, FK a **`actors`**, dados legados com **guard/backfill** (ex.: actor padrão por tenant ou por oferta — **definir na implementação** com ADR curto).
* Estender **idempotência** (índice único parcial ou novo) para incluir **unidade** onde `reference_*` existir; manter política para movimentos sem referência.
* Serviços/repositório: validação de **elegibilidade** do actor; manter triggers **append-only**.

---

## FASE F — INVENTORY MULTI-UNIDADE (IMPLEMENTAÇÃO)

**Documento vivo:** rever após evolução da idempotência por linha (item vs cabeçalho) ou alterações em `inventory_movements` / `inventory_balances`.

**Leitura conjunta com FASE E:** a FASE E regista análise e modelo oficial; esta secção regista o que **já está implementado** no repositório após a migration indicada.

**Migration de referência:** `20260411120000_inventory_movements_actor_id.sql`.

### O que foi implementado

* **`inventory_movements.actor_id`** — `UUID NOT NULL`, unidade operacional = **`actors.id`** no mesmo tenant (conforme **MODELO DE UNIDADE OPERACIONAL (OFICIAL)** na FASE E).
* **FK** `fk_inventory_movements_actor` → `actors(id)`; **trigger** `trg_inventory_movements_actor_tenant` garante coerência **`actors.tenant_id` = `inventory_movements.tenant_id`** em cada `INSERT`.
* **Validação de elegibilidade** na aplicação: `assertInventoryUnitActorEligible` (actor não é unidade só por existir — critério alinhado ao plano: company, merchant/oferta, loja em ativação, participação em pedidos, criador de PO, extremos de transferência, etc., conforme código).
* **Repositório e call sites** passam **`actorId`** explicitamente (ex.: fulfillment → `seller_actor_id` do pedido; transferência OUT/IN → `from`/`to`; receção de PO → `created_by_actor_id`; ajuste → actor do ajuste; API manual → campo no body).

### Idempotência

* Índice único parcial **`uidx_inventory_movements_reference`** em **`(tenant_id, reference_type, reference_id, product_variant_id, actor_id)`** quando `reference_type` e `reference_id` estão preenchidos — idempotência **por unidade** (mesma referência + mesma variante em **actors** distintos = linhas distintas).
* Movimentos **sem** `reference_*` continuam **fora** deste índice único (comportamento herdado; retries sem referência exigem desenho cuidadoso).

### Ledger

* **Append-only** mantido (triggers existentes que impedem `UPDATE`/`DELETE` em linhas de movimento **não** foram substituídos por lógica mutável).
* **Saldo** continua **derivado por soma** sobre o ledger; **não** se promoveu `inventory_balances` a SSOT nesta fase (**sem** alteração de contrato do read model neste entregável).

### Backfill

* Estratégias em cadeia no SQL: fulfillment → pedido vendedor; stock transfer por tipo de movimento; purchase order; ajustes (se tabela existir); oferta por variante; fallback **controlado** para primeiro `actor` **company** do tenant.
* Se restarem linhas sem `actor_id` resolvível, a migration **aborta com mensagem explícita** (falha visível em vez de dado silenciosamente inválido).

### Invariantes (operacionais)

* Todo movimento **válido** inclui **`actor_id`** preenchido e consistente com o tenant.
* O actor da unidade deve ser **elegível** segundo as regras da aplicação (ver subsecção de elegibilidade na FASE E e implementação em código).

### Limitação conhecida

* A idempotência continua ancorada na **referência de cabeçalho** (`reference_id` = id do fulfillment, transferência, etc.). **Cenário de risco:** várias linhas operacionais com a **mesma** `product_variant_id` e a **mesma** referência de cabeçalho podem gerar **colisão** no índice único ou, em desenhos alternativos, duplicidade mal controlada — depende do fluxo.
* **Não** bloqueia o uso atual em massa, mas deve ser tratado explicitamente quando o produto exigir várias saídas/entradas da mesma SKU na mesma operação.

### Próximo passo

* Evoluir idempotência para **nível de linha** quando necessário (ex.: referenciar **`fulfillment_item_id`**, item de transferência, linha de PO), mantendo **`actor_id`** na chave lógica e o ledger append-only.

---

## Veredito de auditoria (execução)

**Status: correto e executável como direção.** Parte do DDL (ex.: `canonical_products`, `inventory_movements.actor_id`) pode já estar aplicada no teu ambiente; **sempre cruzar** este documento com o schema real (`\d`, `schema_migrations`, dados legados) antes de assumir travas. O plano respeita SSOT, protocolo, ordem de execução e separação de domínios.

**Congelar (não mudar direção):**

* Fluxo: `CONCEPT → CANONICAL → PRODUCT → VARIANT → OFFER → INVENTORY → ORDER → BANK` — eixo estrutural.
* Ordem macro: **canonical → categoria → empresa/categorias → visibilidade → economia**; inverter quebra encadeamento.
* SSOT blindado: CONCEPT = semântico; canonical = industrial; categories = navegação; bank = dinheiro; `inventory_movements` = estoque (ledger físico).
* Financiamento coletivo: lifecycle, ligação com order, settlement via Bank.
* Escrow: vínculo com order, estados, release, fallback — fluxo fechado em nível de execução.

**Travas finais a impor (sem desviar do trilho):**

1. **Global vs scoped em `canonical_products`:** regra obrigatória — canonical scoped **não pode conflitar** com global; quando houver **GTIN**, ele é a **chave primária industrial** para detectar colisão global vs scoped (não misturar com fallback semântico).
2. **Deduplicação e concorrência:** lock transacional na criação (`SELECT … FOR UPDATE`) **ou** constraint única + retry controlado — evitar duas requisições simultâneas criando duplicado.
3. **Pool (financiamento):** garantia técnica de execução única — ex. índice/constraint do tipo `UNIQUE (pool_id) WHERE status = 'executed'` **e/ou** lock transacional antes de gerar order.
4. **Visibilidade e performance:** decisão fechada no **§8.4** — fase atual: **query dinâmica com índices corretos**; read model / view materializada só com evidência de gargalo.
5. **Supply chain:** nesta fase pode permanecer mínima, mas manter no radar: estoque real por tenant, fallback de fornecedor, regra de prioridade.
6. **Observabilidade:** mais crítica do que só o “passo 15” sugere — o **mínimo para eventos de canonical / colisão GTIN / mudança de governança** deve subir **junto com os passos 3–5** (ver secção dedicada abaixo). O passo 15 completa o resto (pool, escrow, integridade global).

> Agora está no trilho. **Não muda direção — só fecha as travas.**

**Validação final (reauditoria):** travas críticas incorporadas; plano em **nível de execução / produção** (arquitetura + invariantes + travas). Daqui em diante, **se quebrar, tende a ser erro de implementação — não de desenho**. Não é mais fase de “só planejar”; é executar.

**Próximo passo operacional:** (0) **Manter §9 verde:** `pnpm migrate` + `pnpm test:e2e:catalog` com `DATABASE_URL`. (1) **Aplicar** migrations pendentes no ambiente após pull (incl. **`20260411120000`**, baseline canónico, **`20260415120000`** / **`20260415120100`**). (2) **Governança `canonical_products`** além do DDL: lifecycle, `concept_id`, GTIN global vs scoped, observabilidade §5A. (3) ~~**Payload semântico** — `productId` vs canónico~~ — campo **`canonicalProductId`** na API de produtos disponíveis para onboarding. (4) **Inventory:** modelo de unidade **fechado** (FASE E + F); evoluir **idempotência por linha** quando o produto exigir (FASE F *Próximo passo*). (5) **Categorias marketplace** — validar `metadata.domain` / seeds para onboarding não falhar em ambiente fresco. (6) **Gate §17 vs §10–11:** §9 exercitado **não** substitui o critério completo do §17 (canonical em alvo de produção, §5A, etc.) — ver tabela abaixo e secção **#17**.

---

## Cruzamento com o estado real (lacuna plano × banco)

O plano descreve o **alvo**; o banco pode estar **atrás**. Sem este cruzamento, a equipa trata `canonical_products` como “pronta” quando ainda é **proto**.

### Diagnóstico típico (revalidar no teu ambiente)

| Área | O que o plano exige | Risco se o banco não tiver |
|------|---------------------|----------------------------|
| `canonical_products` | `concept_id`, governança (`version`, lifecycle de status), trilha de atores, GTIN com travas global/scoped | Duplicação industrial, canonical sem semântica ligada, sem audit trail |
| GTIN | Índices/constraints que impeçam scoped a colidir com global | **Bomba de duplicidade** ativa |
| `products.category_id` | `NOT NULL` + FK coerente | Produto sem categoria; **checkout / navegação a falhar de forma opaca** |
| Pool / escrow (passos 10–11) | Tabelas e fluxos explícitos | Normal **não existir** nesta fase — o erro é **executar antes do gate** |
| Empresa × catálogo | Modelo explícito de permissões | Já pode existir algo próximo no schema — **evoluir, não duplicar** |

### Tratamento de `canonical_products`

* **Não** assumir “evolução leve” se o schema atual for só `id`, `tenant_id`, `gtin`, `name`, `brand`, `category_id`, etc., **sem** `concept_id` nem governança.
* Tratar o passo 3 como **refatoração estrutural** (migration que adiciona colunas, backfill, constraints, triggers/índices únicos), não como “preencher campos opcionais”.
* **Backfill de `concept_id`** a partir de `category_id → categories.concept_id` é **heurístico**: categoria errada arrasta conceito errado. **Obrigatório:** após cada linha preenchida por esta heurística, registar em **`canonical_product_events`** (ou equivalente do §5A) um evento com `payload` que identifique a origem — ex. `{ "source": "backfill_category", "category_id": "…" }` — para a auditoria humana **filtrar exatamente** o que precisa revisão; “auditoria posterior” deixa de ser só intenção e passa a ser **mecanismo rastreável**.

### Trilho de migrations documentado (ordem de apply)

Aplicar **nesta ordem** quando os ficheiros existirem no repositório (nomes indicativos da auditoria; confirmar no diretório `backend/migrations`):

1. **`20260411100000` — governança `canonical_products`** — escopo global/scoped alinhado a `tenant_id`; governança (`version`, status/lifecycle); deduplicação GTIN (índices únicos global vs scoped por tenant); regra que impede scoped com GTIN já global; triggers auxiliares se o desenho o exigir.
2. **`products.category_id` NOT NULL + FK** — **implementado:** `20260410150000_products_category_id_not_null_fk.sql` (guard + NOT NULL + `fk_products_category`). Nomes `20260411110000` eram indicativos na auditoria; cruzar sempre com `backend/migrations/`.
3. **`20260411120000` — observabilidade canónica antecipada** — eventos append-only (ex.: criação canonical, mudança de governança, colisão GTIN), de forma a não depender só do “passo 15” para bugs invisíveis.

**Depois do apply:** validar dados legados, criar canonical com GTIN, tentar conflito global vs scoped, e **ainda** garantir na app **constraint + retry** ou `FOR UPDATE` onde a corrida persistir.

### Passo 7 — o que já pode existir

* Existe (ou pode existir) **`company_type_allowed_concepts`** (mapeamento **tipo de empresa → concept**).
* O plano fala em “empresa → categorias permitidas” — é **conceitualmente próximo** mas **não idêntico**.
* **Regra:** reconhecer o artefacto atual, **estender ou alinhar** o modelo de onboarding (empresa / tipo → conceitos ou categorias derivadas) em vez de inventar um segundo SSOT paralelo sem fechar o anterior.

---

# 0. Bootstrap obrigatório antes de mexer em qualquer coisa

Primeiro, a execução só vale se começar assim:

Pilar afetado:

* semântico
* navegação
* estoque
* financeiro

SSOT por pilar:

* semântico: **CONCEPT**
* navegação: **categories**
* estoque: **inventory_movements**
* financeiro: **bank_ledger**

Estruturas que não são SSOT:

* `canonical_products`
* `products`
* `offers`
* `inventory` como estado derivado

Risco de duplicação de verdade:

* `canonical_products` tentar virar semântica
* `products` duplicar atributo industrial
* saldo fora do Bank
* estoque fora do ledger físico

Precedência aplicada:

* Constituição > Leis > SSOT Registry > Ontologia. Isso está no protocolo e precisa governar a execução, não só enfeitar texto. 

# 1. Travar o escopo e o fluxo canônico

Antes de abrir migration, o fluxo oficial da implementação fica congelado assim:

`CONCEPT → CANONICAL_PRODUCT → PRODUCT → VARIANT → OFFER → INVENTORY → ORDER → BANK`

Tudo que não encaixar aqui é rejeitado. Esse é o eixo que conecta catálogo, execução comercial e liquidação. O próprio contexto do anexo já aponta esse fluxo como regra estrutural. 

# 2. Fechar a decisão mais importante: escopo do canonical

Antes de criar tabela, precisa bater o martelo numa decisão que ainda está com risco de ambiguidade:

Modelo operacional:

* `canonical_products` pode ser global
* ou tenant-scoped
* ou híbrido, mas com regra explícita

Minha ordem de execução aqui é:

2.1 Definir política:

* `tenant_id IS NULL` = global
* `tenant_id IS NOT NULL` = scoped

2.2 Explicitar isso como regra de domínio, não como detalhe opcional de coluna

2.3 Proibir ambiguidade operacional:

* um canonical global não pode ser regravado por tenant
* tenant pode referenciar global ou criar scoped conforme governança

2.4 **Constraint lógica obrigatória (anti-duplicação industrial):** quando **GTIN** estiver preenchido, ele é a **chave primária de identificação industrial** para colisão: se existir canonical **global** com esse GTIN, **não** permitir canonical **scoped** que conflite com esse registro. Só onde GTIN não existir entram critérios alternativos (fabricante/marca/etc.) acordados no modelo. Materializar na migration/regra de aplicação (validação + constraint ou índice único composto conforme modelo).

Sem isso, você cria uma bomba de duplicidade com cara de flexibilidade.

# 3. `canonical_products` nível produção — refatoração estrutural, não “já está feita”

**Estado frequente no banco:** tabela criada cedo com schema **mínimo** (ex.: `id`, `tenant_id`, `gtin`, `name`, `brand`, `images`, `attributes`, `category_id`) **sem** `concept_id`, **sem** lifecycle de governança, **sem** travas GTIN global/scoped. Isso é **proto**, não o alvo deste plano.

**O que fazer:** migration(ões) que **constroem o alvo** — colunas novas, backfill controlado, constraints, índices únicos, triggers — alinhadas ao trilho *Cruzamento com o estado real*. Não tratar como mera extensão opcional.

Objetivo da tabela (alvo):

* representar identidade industrial reutilizável
* nunca representar identidade semântica
* sempre apontar para `concept_id`

Campos-base:

* `id`
* `concept_id NOT NULL`
* `tenant_id NULLABLE` com regra de escopo explícita
* `scope` opcional se quiser blindar leitura
* `gtin`
* `brand`
* `manufacturer`
* `title`
* `description`
* `specifications`
* `version`
* `status`
* `created_by_actor_id`
* `verified_by_actor_id`
* timestamps

Regras que entram junto:

* `concept_id` obrigatório
* `version` obrigatório
* status governado
* trilha de autoria obrigatória

Resultado esperado:

* nasce a camada industrial sem invadir a semântica

**Backfill de `concept_id` (reforço):** qualquer preenchimento via `category_id → categories.concept_id` deve **gerar evento append-only** com `source: 'backfill_category'` (ver *Cruzamento com o estado real*), para revisão humana direccionada. Sem isso, o legado fica opaco.

# 4. Fechar deduplicação robusta do canonical

Aqui não pode usar hash meia-boca e rezar.

**Regra explícita para o time:** quando existir **GTIN**, ele é a **chave primária de deduplicação** (primeiro e decisivo para match industrial). **Só depois** entram fallbacks — evita interpretação ambígua (“GTIN ou algo parecido”).

Ordem de deduplicação:

4.1 **Critério primário (obrigatório quando aplicável):**

* **GTIN** — se estiver presente, é a chave de deduplicação; colisão = mesmo registro candidato / merge / rejeição, conforme governança

4.2 **Segundo critério** (apenas quando **não** houver GTIN utilizável, ou como reforço não concorrente com 4.1):

* combinação normalizada de fabricante + marca + especificações-chave

4.3 **Terceiro critério:**

* fila de revisão/manual merge quando a deduplicação automática não for confiável

4.4 Proibir criação cega se houver colisão provável

4.5 **Concorrência:** na criação/deduplicação, obrigar **lock transacional** (`SELECT … FOR UPDATE` sobre o candidato existente ou fila de merge) **ou** **constraint única no banco + retry controlado** na aplicação — duas requisições simultâneas não podem abrir brecha de corrida para duplicado.

**Nota:** índices únicos na migration **fecham duplicação estrutural**; **race na app** pode ainda exigir retry idempotente ou lock — não assumir que o DDL sozinho resolve 100% dos cenários HTTP.

O objetivo não é “evitar 100% de duplicata por mágica”. O objetivo é impedir duplicação silenciosa. Isso é muito diferente.

# 5. Colocar governança mínima no canonical

Depois da tabela, entra a trava de quem pode criar.

Ordem:

5.1 Permissão inicial (regra de negócio — **materializar no modelo já existente**):

* indústria
* distribuidor autorizado
* não marketplace comum

**Ancoragem obrigatória (antes de codar):** mapear estes perfis para o **sistema de autoridade que o Unificard já usa** — não inventar paralelo. Em concreto, **auditar primeiro** `requirePermission` / `permission_key`, `businessAuthorizationService`, papéis de **organização** (`role_key`, convites) e **membros de empresa** (`company_members.role`), e qualquer **ATL / registo de permissões** já persistido. A decisão tem de sair como: *“criar canonical exige permissão X (chave explícita) e/ou papel Y”* — documentada (ADR ou nota no PR). **Proibido** acrescentar à pressa colunas tipo `tenants.can_create_canonical` ou tabela de perfil isolada **sem** essa decisão explícita; isso duplicaria o modelo de autoridade.

5.2 Marcar origem do criador

* actor
* tenant
* tipo de permissão

5.3 Criar status de governança

* draft
* pending_review
* active
* deprecated
* merged

5.4 Não permitir overwrite destrutivo

* mudança industrial relevante cria nova versão

Sem isso, `canonical_products` nasce certo e morre prostituído.

# 5A. Observabilidade mínima do canonical (em paralelo a 3–5, não só no 15)

**Problema:** deduplicação silenciosa, colisão GTIN e mudanças de governança **não aparecem** sem trilho de eventos.

**Obrigatório subir cedo:** tabela **append-only** de eventos ligada a `canonical_products` (ex. `canonical_product_events`), com política de acesso coerente (RLS se aplicável). O passo **#15** amplia para pool, escrow, integridade e operações finais — **não substitui** este mínimo.

**Quem grava o quê (decisão fechada — evita o Cursor escolher ao acaso):**

* **Trigger no PostgreSQL** para **INSERT** em `canonical_products` e para **UPDATE** que altere `governance_status` (ou campo equivalente de lifecycle). Garante registo mesmo com insert direto, script ou migration.
* **Camada de aplicação** para **colisão / tentativa bloqueada de GTIN** (ex. antes de persistir ou ao interpretar erro `23505`): o fluxo de conflito **aborta** a transação antes de um segundo INSERT útil no log; o trigger sozinho não substitui este registo — a app **escreve o evento** (ou mensagem estruturada) **antes** de falhar ou num caminho que não dependa do commit abortado, conforme desenho técnico.
* **Backfill de `concept_id` por categoria:** preferencialmente **INSERT de evento** na mesma migration/transação do backfill, com `payload.source = 'backfill_category'`, alinhado ao *Cruzamento com o estado real*.

Alinhar implementação às migrations `20260411100000` e `20260411120000` quando existirem no repositório.

# 6. Tornar `products.category_id` hard constraint

**Bloqueador operacional urgente** se hoje for `NULL` permitido: produto sem categoria quebra navegação, onboarding e pode fazer **checkout falhar de forma opaca**.

Isso vem **logo após** o canonical estar pronto para **backfill** (ex.: categoria derivada do canonical), na ordem do trilho de migrations.

Ordem:

6.1 Auditar produtos atuais sem categoria
6.2 Corrigir legado mínimo
6.3 Aplicar `NOT NULL`
6.4 Aplicar FK consistente
6.5 Bloquear criação futura sem categoria

Regra:

* category é navegação
* category não define semântica
* mas é obrigatória para operação do catálogo

O anexo deixou isso claro como bloqueador real. 

# 7. Conectar empresa ao catálogo permitido (sem duplicar o que já existe)

Aqui fecha o onboarding inteligente.

**Realidade:** pode já existir **`company_type_allowed_concepts`** (tipo de empresa → **concept**). O plano descreve “empresa → categorias permitidas” como **intenção de produto** — **não** como ordem para ignorar o que está no schema.

Ordem:

7.1 **Inventariar** vínculos existentes (`company_type_allowed_concepts` e afins)
7.2 **Decidir evolução:** estender o modelo atual (ex.: derivar categorias navegáveis a partir de concepts permitidos) **ou** acrescentar vínculo empresa/categoria **sem** segundo SSOT contraditório
7.3 Exigir o vínculo relevante no onboarding
7.4 Validar criação de produto contra esse vínculo
7.5 Impedir produto fora do conjunto permitido

Fluxo operacional (ajustar à tua implementação real):

* cria empresa (ou tipo)
* define **concepts/categorias** permitidos de forma **única e coerente** com o schema
* só então libera produtos nesse universo

Isso evita o lixo sistêmico que o próprio handoff apontou **e** evita paralelismo acidental entre dois modelos de “o que a empresa pode vender”.

# 8. Fechar a visibilidade real de produto

Produto não pode existir para o usuário só porque alguém preencheu meia dúzia de campos.

Regra operacional:

* produto visível = oferta ativa + estoque disponível

Ordem:

8.1 Implementar a regra de visibilidade em **serviço + query dinâmica** (ver 8.4)
8.2 Garantir que não haja listagem sem `offer` ativa
8.3 Garantir que não haja listagem sem disponibilidade vinda do estoque
8.4 **Decisão de performance (fechada para esta fase):** com catálogo a nascer e volume baixo, usar **query dinâmica com índices corretos** nas tabelas que participam da regra (oferta, estoque derivado, etc.) — simples, sem estado derivado extra a manter. **Read model** ou **view materializada** entram **só** quando houver **evidência** de gargalo (métricas, `EXPLAIN`, latência). O Cursor **não** deve inventar materialized view nesta fase sem esse gatilho.

Importante:

* `inventory` não é SSOT, o ledger físico é
* a visibilidade deriva do estado operacional validado

# 9. Fechar o vínculo end-to-end até execução econômica

Depois do catálogo, a próxima ordem é fechar a linha inteira até dinheiro.

Ordem:

* `canonical_product` referencia `concept`
* `product` referencia `canonical_product`
* `variant` referencia `product`
* `offer` referencia `variant`
* disponibilidade vem de `inventory_movements`
* `order` consome variante/oferta válida
* `bank` liquida

Aqui você transforma estrutura em economia. Antes disso, ainda é fundação.

**Critérios de validação executáveis (gate do §9 — sem isto o passo é vago):**

1. **Cadeia catálogo:** criar um `canonical_products` com GTIN (ou fixture válido), `product` a apontar para ele, `product_variant`, `offer` ativa; chamar **`resolveRefsFromVariant`** (`concept-offer-refs.adapter`) com o ID da variante e o `tenant_id` corretos e verificar resultado **`resolution: 'ok'`** (referências de concept/oferta resolvidas).
2. **Order / checkout:** criar **order** que use essa variante/oferta; verificar que o fluxo de checkout **não** devolve código **`REF_RESOLUTION_FAILED`** (ou equivalente documentado nas rotas de intent/checkout).
3. **Liquidação:** executar **pagamento** (fluxo real ou teste integrado) para essa order e verificar entrada esperada no **`bank_ledger`** (ou tabelas SSOT do pilar financeiro que o projeto define como registo autoritário de movimento) — montante, contas e natureza alinhados ao desenho.

**Estado (abril 2026):** os três critérios foram **cobertos pelo E2E** `backend/tests/e2e/catalog-order-ledger.e2e.test.ts` com dados reais em Postgres (tenant, atores, concept/categoria, canonical → product → variant, ativação, movimento de stock, preço em **`product_prices`**). O checkout canónico exercitado é **`POST /intent/execute`** (não o endpoint REST cru de marketplace orders). O passo financeiro no teste usa **`bankTransactionService`** (mint + transfer), não `POST /marketplace/payments/execute`, enquanto o repositório de transação de pagamento marketplace permanecer stub.

**Falha:** qualquer um dos três falhar — o encadeamento **não** está fechado; não avançar para economia avançada (pool/escrow) fingindo que §9 passou. **Nota:** §9 verde **não** dispensa o **§17** (canonical em nível produção, eventos §5A, etc.) para abrir §10–11.

# 10. Modelar financiamento coletivo completo

Isso entra só depois de fechar as camadas acima. Se fizer antes, vira fantasia financeira em cima de catálogo torto.

**Gate explícito (não negociável):** só abrir implementação 10 (e 11) quando **todas** as condições do §17 estiverem **verdadeiras no banco e na app**, em especial:

* `canonical_products` no alvo de governança + GTIN travado
* `products.category_id` **NOT NULL** e fluxo de produto validado
* encadeamento até order/bank **exercitado** nos casos principais

Enquanto isso for “zero tabelas no banco” — **estado esperado**; o erro é **pressão de entrega** empurrar pool/escrow antes do gate.

Ordem:

10.1 Criar `investment_pool`

* vínculo com `canonical_product`
* meta financeira
* lifecycle: draft → funding → funded → executed → settled → cancelled

10.2 Criar `pool_contributions`

* ator
* valor
* timestamp
* status

10.3 **Garantia técnica** de execução única (não basta regra só em texto)

* um pool não pode disparar duas orders
* materializar com **constraint/índice único parcial** quando o modelo permitir (ex.: `UNIQUE (pool_id) WHERE status = 'executed'`, ou variante alinhada ao schema real de lifecycle)
* e/ou **lock transacional** imediatamente antes de gerar a order a partir do pool

10.4 Ligar pool a `order`

* funded gera order executável
* order concluída dispara settlement

10.5 Liquidar via Bank

* nada de saldo paralelo
* distribuição proporcional via `bank_transactions` e `bank_splits`

O contexto que você recebeu já indicou explicitamente que isso tem que viver no pilar financeiro e passar pelo Bank.  

# 11. Modelar escrow de verdade

**Mesmo gate do §10.** Só depois das fundações e do critério de pronto do §17.

Aqui também não vale “já está pronto” só porque `owner_type = 'escrow'` existe.

Ordem:

11.1 Criar vínculo explícito order ↔ escrow
11.2 Criar estado do escrow

* held
* releasable
* released
* disputed
* refunded

11.3 Definir condição de liberação

* entrega confirmada
* ou prazo
* ou decisão de disputa

11.4 Fazer liberação via Bank

* escrow account → seller account

11.5 Definir fallback

* disputa
* estorno
* cancelamento

O banco já suporta conta escrow, mas o fluxo ainda precisa ser fechado em nível de execução.  

# 12. Subir supply chain mínima

Isso vem depois, não antes. Nesta fase o desenho pode permanecer **deliberadamente mínimo**; o risco é ficar só no conceitual sem os itens de radar abaixo — aprofundar quando o catálogo e o ledger estiverem estáveis.

Ordem:

12.1 Introduzir papéis operacionais

* supplier
* distributor
* retailer

12.2 Vincular isso a `canonical_product`
12.3 Registrar relações entre tenants
12.4 Ligar movimentação entre atores ao **estoque real por tenant** via ledger físico (`inventory_movements`)
12.5 Definir **prioridade** e **fallback de fornecedor** (radar explícito — evita problema operacional depois)

Sem isso, supply chain vira desenho bonito e estoque continua local.

# 13. Validar N2 e onboarding contextual

Com catálogo, empresa e supply chain começando a existir, aí sim faz sentido revisar N2.

Ordem:

13.1 Validar se N2 cobre:

* cadeia comercial
* onboarding de empresa
* contexto de produto/empresa/canal

13.2 Ajustar N2 sem invadir semântica
13.3 Garantir que navegação continue sendo árvore, não SSOT identitário

# 14. Aplicar travas de concorrência e invariantes

Aqui é onde sistema sério deixa de ser PowerPoint.

Travas obrigatórias:

* canonical sem duplicação silenciosa; **GTIN = chave primária de deduplicação quando existir**; **scoped não conflita com global** nessa chave
* deduplicação com **proteção de concorrência** (lock ou unique + retry)
* pool sem execução duplicada (**constraint/lock**, não só intenção)
* produto sem categoria impossível
* visibilidade sem oferta/estoque impossível
* escrow sem bypass
* settlement sempre no Bank
* estoque sempre derivado do ledger físico

Tudo que ainda permitir ambiguidade, concorrência ou duplicação não está pronto. A frase do outro chat está certa nessa parte.

# 15. Fechar observabilidade e auditoria (complemento ao 5A)

O **núcleo de eventos de canonical** já deveria existir no **§5A**. Este passo **completa** o pacote de produção.

Está numerado tarde na lista, mas **não é secundário**: sem o conjunto **5A + 15** não se cobre bem pool, escrow, settlement e integridade transversal — tratar como requisito de produção, não “nice to have”.

Além do que já cobre o 5A, antes de chamar isso de produção completa, precisa rastrear:

* criação e versionamento de canonical
* colisões de deduplicação
* tentativa de produto fora de categoria permitida
* pool executado
* release de escrow
* disputa
* falhas de integridade

Sem observabilidade, produção é só uma aposta cara.

# 16. Ordem final resumida de execução

### A) Pré-condições — **humano** (leitura, alinhamento, verificação)

Isto **não** é tarefa para o Cursor “marcar como feita” por ter lido o plano. É responsabilidade de quem governa a execução:

1. Bootstrap normativo e declaração formal de pilar/SSOT/risco compreendidos pela equipa
2. Fluxo canônico end-to-end **congelado** e comunicado
3. Plano **cruzado** com **schema real** e dados legados (secção *Cruzamento com o estado real*)

### B) Trilho de execução — **Cursor / implementação** (migrations, código, testes)

Só depois de (A) estar explícito, seguir **nesta ordem** (alinhado ao **trilho de migrations** e ao **gate** dos passos 10–11):

0. **Feito no código (não substitui migrations):** ponte **CANONICAL → PRODUCT → OFFER** no onboarding da loja; camada `products` com `canonical_product_id` persistido e `getProductByCanonicalId`. *Continuação:* travas de unicidade/concorrência e DDL canónico abaixo.

1. Decidir escopo do `canonical_products` (§2) — se ainda não estiver fechado em ADR/decisão
2. **Migration governança canonical** (refatoração estrutural §3 + dedup §4 + governança §5) e **observabilidade mínima §5A** (ou mesma release), incluindo eventos de backfill `source: 'backfill_category'` onde aplicável
3. ~~**Migration `products.category_id NOT NULL`**~~ — ver Fase D / `20260410150000_products_category_id_not_null_fk.sql`
4. **Ampliar observabilidade** se ainda faltar cobertura de eventos críticos (ligação 5A → 15)
5. Evoluir **empresa / tipo → catálogo permitido** sem duplicar `company_type_allowed_concepts` (§7)
6. Fechar regra de visibilidade de produto (§8), com **query dinâmica + índices** conforme §8.4
7. ~~Executar os **três critérios executáveis** do §9 (`resolveRefsFromVariant`, checkout sem `REF_RESOLUTION_FAILED`, `bank_ledger`)~~ — **feito** no E2E `catalog-order-ledger.e2e.test.ts` (com migrations de pricing aplicadas e sem fallback de preço no `OrderService`)
8. **Só após critério §17:** modelar financiamento coletivo (§10)
9. **Só após o mesmo gate:** modelar escrow (§11)
10. Introduzir supply chain mínima entre tenants (§12)
11. Revisar N2/contexto operacional (§13)
12. Revisão final de **travas de concorrência e invariantes** na app + DB (§14)
13. Completar **observabilidade e auditoria** global (§15)
14. Só então chamar de base de produção

**Pós-apply obrigatório:** validar legados; testar criação de canonical com GTIN; testar conflito global vs scoped; **filtrar em `canonical_product_events` por `backfill_category`** para auditoria humana das linhas heurísticas.

# 17. Meu critério de pronto

**Nota (estado intermédio):** o fluxo **onboarding da loja** já **materializa `products`** e liga **`product_offers` a `products.id`** no código. Os bullets abaixo continuam a definir **pronto de plataforma** (migrations, travas de BD, gates económicos) — não confundir “FK de oferta correta” com “canonical em nível produção no schema”.

Eu consideraria “pronto para próxima fase” (catálogo + linha até Bank) quando estas condições forem **verdade no banco e na app**:

* `canonical_products` está no **alvo** do plano (não só proto): `concept_id`, governança, versionamento, travas GTIN global/scoped
* produto sem categoria é **impossível** (`category_id NOT NULL` + FK coerente)
* empresa / tipo de empresa só cria produto no **conjunto permitido** (modelo único: evoluir `company_type_allowed_concepts` ou equivalente alinhado)
* produto só aparece com oferta ativa e estoque válido (§8, com **query dinâmica + índices** nesta fase)
* order sempre consegue desaguar corretamente no Bank nos fluxos principais
* **eventos mínimos de canonical** registados (§5A) — senão “pronto” é ilusório para debug

**Gate para abrir passos 10 e 11 (pool / escrow):** as condições acima **cumpridas**; aceitar que **zero tabelas** de pool/escrow até lá é estado **correto**, não atraso arbitrário.

**Lembrete:** GTIN como chave primária de deduplicação **não elimina** a necessidade de **fallback governado** (revisão manual / fila) para casos sem GTIN ou ambíguos — §4.3 permanece obrigatório.

Esse é o meu plano de execução.
⚠️ GATE 2 ATIVO — SSOT

Este repositório está sob o Gate 2 (Bloqueio Estrutural).
É PROIBIDO:
- criar novos writers financeiros fora do Bank
- usar legado para decisão
- introduzir “temporários”

Qualquer violação = FAIL de Gate.

Ver: `docs/01_normative/PROHIBITED_STRUCTURES.md`, `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`. **Norma monetária e SSOT financeiro (documentação única):** `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (bloco *DOCUMENTAÇÃO ÚNICA*) + `docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md`.

---

## Documentação de módulos

- [Arquitetura do Módulo Marketplace](src/modules/marketplace/ARQUITETURA_MARKETPLACE.md) — visão geral, camadas, fluxos e diagramas (Mermaid).

## Scripts: fundo regional (Bank) e checklist de incentivos (dev)

Com `USE_BANK_REGIONAL_FUND=true`, o saldo regional para incentivos vem do ledger Bank. **Funding** (reserve → conta regional, idempotente, sem SQL manual em `bank_*`):

- `pnpm fund:regional-fund-bank -- --tenant <uuid> --country BR --state SP --city <igual ao fluxo> --amount-cents <≤5_000_000> --ref <chave lógica>` — ver `src/scripts/fund-regional-fund-bank-from-reserve.ts` (limite por transferência em `src/core/financial/transfer-limits.ts`).

**Checklist** (regra em memória + grant + consume + validação `bank_ledger` no mesmo processo): `pnpm e2e:incentive-bank-checklist`. Opcional: `E2E_TENANT_ID`. `E2E_RELAX_BANK_COVERAGE=true` só se o trigger `trg_check_coverage` bloquear em base de desenvolvimento — **DEV ONLY: nunca em `production` nem `staging`** (desactiva enforcement de cobertura no `bank_ledger`; ver cabeçalho do script). O `loadBackendEnv()` em `src/core/db/load-backend-env.ts` (invocado pelo `pool` e por scripts) faz **fail-fast** com essa flag quando `NODE_ENV` é `production` ou `staging`.

## Convenção de nomeação de migrations (`migrations/`)

Governança do repositório — evita ambiguidade entre o padrão legado (`NNNN_`) e o padrão atual por data/hora.

- **Ordem de execução:** o runner aplica todos os `.sql` de `migrations/` em **ordem alfabética** (lexicográfica) pelo **nome do ficheiro**. O registo do que já correu está em `schema_migrations`. Implementação: `src/core/db/migrate.ts`.
- **Padrão oficial para migrations novas:** `YYYYMMDDHHMMSS_descricao_curta.sql` (ex.: `20260402120000_add_index_foo.sql`). Use um timestamp **posterior** ao da última migration já existente no branch, para manter ordenação correta em merges.
- **Legado (congelado):** ficheiros `NNNN_descricao.sql` (ex.: `0061_categories.sql`, `0130_stock_transfer_receipts.sql`) **não** devem ser renomeados nem renumerados; tratam-se de histórico aplicado em muitos ambientes.
- **Proibido para código novo:** criar migrations com numeração incremental `0131`, `0132`, … — em ordenação alfabética esses nomes ficam **antes** de qualquer ficheiro que comece por `2026…` e podem **executar fora de ordem** relativamente às migrations por timestamp, quebrando dependências de schema sem erro óbvio no runner.
- **Regra de ouro:** a ordem efectiva é o **nome do ficheiro**, não “o próximo número” da série antiga nem a ordem manual em que alguém imagina que o histórico deveria ter sido escrito.

### Regimes de migration (três mundos — evita debate estéril sobre `IF NOT EXISTS`)

```text
GENESIS (0001–0004 e bloco inicial acordado)     → HARD LAW: DDL explícito, ordem fixa; não reescrever ficheiros já aplicados.
MIGRATIONS 2026+ (YYYYMMDDHHMMSS_*.sql)           → FORWARD LAW CONTROLLED: idempotência com DO $$ / information_schema; §12.1.
LEGADO NNNN_*.sql (congelado)                    → TOLERATED BUT FROZEN: não renumerar; correcções = nova migration com timestamp.
```

### Governança DDL (Gate 2, idempotência, legado)

- **`unifycard_transactions`** (`0004_marketplace.sql`): tabela de **log operacional** / pré-correlação com `bank_transactions`; **não** é SSOT de saldo nem substituto do ledger. Comentário canónico em `20260527120000_unifycard_transactions_non_ssot_comment.sql` + `20260528120000_unifycard_transactions_class_log_comment.sql` (**CLASS: LOG**). Espelho em código: `src/core/db/table-classification.ts` (allowlist no guard). **Semântica não é enforcement:** validação em CI via `pnpm validate:regression-guards` (`guard-financial-regression.ts` — `unifycard_transactions` em **`src/`** e **`scripts/*.ts`**, allowlist + PROPOSTA; mensagem de falha com referências normativas). `pnpm lint:sql-regression`: bloqueia `FROM`/`JOIN` à tabela em migrations excepto `0004_marketplace.sql` e `20260527120000_unifycard_transactions_non_ssot_comment.sql`. `REVOKE`/`GRANT` por role de aplicação são recomendados em produção quando existir **role dedicada** distinta do owner da tabela; em dev com role `postgres` dono da tabela, `REVOKE` tem efeito limitado — ver operação de base.
- **Genesis “Constitucional Rígido”** (`0001`–`0007`, `0004`, …): comentário *sem IF NOT EXISTS* aplica-se ao desenho **da altura**; ficheiros posteriores podem usar `IF NOT EXISTS` / guards `information_schema` por **idempotência** — isso não invalida `DATABASE_STATE` (§0.1 do `PLANO_BASE_MODULO.md`); exige checklist **§12.1**.
- **Não reescrever** migrations `NNNN_*.sql` já aplicadas em ambientes reais só para “limpar” `IF NOT EXISTS` — risco de drift e de hashes `schema_migrations`; mudanças estruturais = **nova** migration com data/hora + PROPOSTA quando LIVE.
- **DDL destrutivo** (`DROP COLUMN`, etc.): só com rastreabilidade (`PLANO_BASE_MODULO.md` §5.2 / §14, ou plano de módulo §2) e decisão explícita; dados sensíveis (ex.: identidade) exigem critério legal + arquitectura. **Padrão recomendado** em migrations novas: antes de `DROP`, `DO $$ … RAISE EXCEPTION` se pré-condição de integridade falhar (ex.: linhas órfãs) — *não* alterar migrations genesis já aplicadas só para acrescentar o check; correcção = forward migration + PROPOSTA se necessário.
- **Precedência identidade** (actors / identities / economic): `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`.

## Procurement campaign (fase neutra, SSOT)

- **DDL:** `migrations/20260403120000_procurement_campaign_neutral.sql` — tabelas `procurement_campaign`, `campaign_interest`, `campaign_sourcing`. **Não** há captação, saldo, retorno nem integração com `bank_*` ou `inventory_movements`. `quoted_price` em `campaign_sourcing` é **estimativa comercial** (comentário SQL: `NON-FINANCIAL ESTIMATE — NOT PART OF BANK SSOT`).
- **Código:** `src/core/procurement-campaign/` — serviço sem agregações monetárias por utilizador.
- **Feature flag:** `ENABLE_PROCUREMENT_CAMPAIGN=true` regista rotas autenticadas em `/procurement/*`; sem a variável (default), **nenhuma rota HTTP** é exposta. Não ativar captação ou promessas de rendimento na UI/copy sem parecer jurídico e RFC de fase 2 (UnifyBank).

## Distribuição entre tenants (RFC 1 — mínimo)

- **DDL:** `migrations/20260403140000_distribution_relationship_supplier_catalog.sql` — `distribution_relationship` (fornecedor ↔ comprador, `manufacturer|distributor|reseller`) e `supplier_catalog` (canônico disponibilizado pelo **mesmo** tenant dono do `canonical_products`). Sem pedido, preço B2B, estoque partilhado ou Bank.
- **Código:** `src/core/distribution/` — rotas autenticadas `/distribution/*`. Regra: entradas em `supplier_catalog` só para `canonical_product_id` cujo `canonical_products.tenant_id` coincide com `supplier_tenant_id` (não duplica identidade de produto).
- **Integridade:** FKs a `tenants` e `canonical_products`; relação única por par fornecedor+comprador; proibido self-link.
- **Supply graph (read-only):** `GET /distribution/supply-graph/upstream?canonical_product_id=<uuid>` — fornecedores diretos/indiretos até profundidade 5, com `provides_product` (linha ativa em `supplier_catalog`). `GET /distribution/supply-graph/downstream` — compradores downstream na mesma profundidade máxima. Só o tenant do JWT consulta a sua perspetiva; sem preço, stock ou pedidos.
- **B2B supply orders:** migrações `20260404100000` … `20260404150000` (incl. centavos). Itens: variantes fornecedor/comprador, **`unit_price_cents`** + `currency`; intenções: **`amount_cents`**. Confirm exige `unit_price_cents > 0`. **Norma de SSOT financeiro e centavos:** só em `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (bloco *DOCUMENTAÇÃO ÚNICA* + 5.9.1) e `INVARIANTES_OPERACIONAIS_LEDGER.md`. `orderTotal` derivado em centavos. **ship:** lock `product_variants` + saldo + OUT na mesma transação.

## Operações: `products.category_id` (RFC 0)

**Fundação canônica (DDL):** já está em `migrations/20260401140000_create_canonical_products.sql` e `20260401140001_products_canonical_product_fk.sql` (`canonical_products` com `tenant_id`, `gtin`, `name`, `brand`, `images`, `attributes`, `category_id`, `type`; FK opcional em `products.canonical_product_id`). Não há coluna `slug` em `canonical_products` — identificação industrial segue **GTIN** + nome.

**Dados mínimos de demo:** `migrations/20260401140004_seed_canonical_products_rfc0_min.sql` — 4 linhas idempotentes (`ON CONFLICT` em `tenant_id`+`gtin`), tenant `supermercado_teste` (ou primeiro tenant), categorias existentes `sommelier-cervejas` / `caixa-supermercado`. Comentário no SQL: slugs atuais são N1 “papel”; servem só como FK válida até taxonomia de produto dedicada.

**Matching fase 1 (GTIN exato, sugestão persistida):** `20260406120000_canonical_match_suggestions.sql` + `20260406130000_canonical_match_suggestions_hardening.sql` (índice único parcial GTIN). `input_gtin` é normalizado (só dígitos, 8–20). `confidence_score` = **1.0** fixo para `match_type = GTIN`. API: `POST /catalog/products/match-suggestions/gtin`, `GET /catalog/products/match-suggestions`. Norma: `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` § 5.9.3.

Aplicar: `pnpm migrate` (na raiz `backend/` ou `pnpm --filter unificard-backend run migrate` a partir do monorepo). **`.env`:** o carregamento usa `src/core/db/load-backend-env.ts` (raiz do pacote resolvida por `package.json`, não só `process.cwd()`; releitura da linha `DATABASE_URL` para senhas com `#`, que o dotenv trunca sem aspas).

**Taxonomia PRODUCT vs SERVICE:** `migrations/20260402100000_categories_domain_type_product_tree.sql` adiciona `categories.domain_type` (`SERVICE` default, legado) e árvore `cat-*` (`PRODUCT`, `scope=global`) com concepts em `produtos-e-comercio`; realinha `canonical_products` + `products` dos GTINs do seed 40004. Slugs `cat-*` evitam colisão com N1/N2 profissionais. Governança: `set_config('app.concept_governance','true')` antes de INSERT em `concepts`.

- **Criação:** na aplicação, `category_id` é obrigatório; erro padronizado `CATEGORY_REQUIRED` (camada de serviço e repositório). Código: `product-catalog.service.ts`, `product.repository.ts`.
- **Backfill de legado:** `pnpm backfill:products-category-id` — modo padrão *dry-run*; mapa tenant → categoria em `scripts/tenant-category-fallback.example.json`; aplicação apenas com `--apply`.
- **Auditoria de qualidade (só leitura):** `pnpm audit:products-category-quality` — distribuição, top categorias, heurísticas de slug genérico, concentração e órfãos; opcional `--json-out=…`. Não altera dados.
- **Auditoria p/ seed RFC0:** `pnpm audit:rfc0-seed-readiness` — lista slugs reais (amostra A–Z, grupos por prefixo, hits por keyword), candidatos ordenados para `TARGET_CATEGORY_SLUGS`, e checklist (`canonical_products`, `products.canonical_product_id`, `product_offers`, dados). Só leitura; opcional `--json-out=…`.
- **Seed de validação multi-tenant (dev):** `pnpm seed:rfc0-catalog-validation` — cria tenants de teste, usa apenas `categories` existentes (slugs em `TARGET_CATEGORY_SLUGS` no script — alinhar com a auditoria acima), lê `canonical_products` sem alterá-los, cria `products` + `product_offers` de forma idempotente; no fim chama a auditoria. Requer migrações aplicadas (`canonical_products`, `products.canonical_product_id`, `product_offers`) e linhas canonical com `category_id` válido; caso contrário termina sem inserir produtos (idempotente). Opcional `--json-out=…`.
- **Guardrail:** em bases migradas com **0092**, `categories` são **globais** (não há `tenant_id` em `categories`); não assumir escopo por tenant ao cruzar com `products` — usar só `category_id` (e `tenant_id` em `products` quando fizer sentido para o produto).

## Contrato de API e governança

- [Governança de contrato (YAML → domínio → Fastify → Swagger)](docs/API_CONTRACT_GOVERNANCE.md)
- [Contrato de referência: stock transfer + receipt (OpenAPI 3)](docs/openapi-stock-transfer-receipt.contract.yaml)

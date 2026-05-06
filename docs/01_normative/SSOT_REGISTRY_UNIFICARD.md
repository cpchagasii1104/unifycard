## SSOT TEMPORAL

### Autoridade Canônica

| Domínio   | SSOT                                 | Tabelas                        | Service                                   |
|-----------|--------------------------------------|--------------------------------|-------------------------------------------|
| **Temporal** | `unified_availability` + `unified_bookings` | `unified_availability`, `unified_bookings` | services do domínio unified_availability  |

**Regra:** unified_availability é a fonte única de verdade para estado temporal. unified_bookings representa eventos derivados (consumo do tempo).

### Escopo de Autoridade

**unified_availability** governa:
- Agenda e disponibilidade
- Janelas temporais
- Reservas e bloqueios
- Conflitos temporais
- Recorrência
- RSVP com efeito temporal

### Fontes Legadas (READ-ONLY)

| Tabela           | Status  | Migration REVOKE                                      |
|------------------|---------|------------------------------------------------------|
| `schedules`      | LEGADO  | 20260428200000 (não aplicada — bloqueará WRITE)      |
| `schedule_slots` | LEGADO  | 20260428200000 (não aplicada — bloqueará WRITE)      |

**Proibição:** qualquer WRITE em `schedules` ou `schedule_slots` constitui violação crítica (C63).

**Regra:** nenhuma outra tabela ou módulo pode definir ou persistir estado temporal.

### Violação Ativa

**C63 (CRITICAL):** 6 WRITE paths ativos em schedules/schedule_slots

**Status:** IN_PROGRESS (migração via DECISION-0014)

**Referências:**
- Contrato: `CORE_TEMPORAL_CONTRACT.md`
- Plano de migração: `LEGADO_TEMPORAL_MIGRATION_PLAN.md`
- Decisão: `REMEDIATION_DECISIONS_LOG.md` → DECISION-0014
# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO V — SSOT REGISTRY COMPLETO
# ═══════════════════════════════════════════════════════════════════════════

## DOCUMENTAÇÃO ÚNICA — DINHEIRO, CENTAVOS E LEDGER

**Esta secção é a fonte única de verdade da documentação** para:

- o que é **SSOT financeiro** em dados de runtime (`bank_ledger`, `bank_transactions`, …);
- a convenção de **valores monetários em centavos inteiros** (`*_cents`, `BIGINT`), alinhada ao Bank;
- o que **não** é SSOT financeiro (snapshots comerciais, intenções B2B, estimativas de procurement).

**Par normativo obrigatório (não contradizer noutros sítios):**

| Documento | Papel |
|-----------|--------|
| **`SSOT_REGISTRY_UNIFICARD.md`** (este ficheiro, secções Bank + Marketplace abaixo) | Registo de autoridade por domínio / tabela |
| **`INVARIANTES_OPERACIONAIS_LEDGER.md`** | Invariantes: ledger físico vs. dinheiro; proibições explícitas |

**Regra:** `backend/README.md`, `ARQUITETURA_*.md`, notas de migração, planos (`UNIFICARD_PLANO_*`) e comentários longos em código **não redefinem** SSOT nem regras de centavos; podem citar DDL e rotas, mas **devem remeter** a este par para norma.

**Runtime (dados):** autoridade contábil de dinheiro = **`bank_ledger`** + **`bank_transactions`** (secções 5.2–5.5). Colunas como `b2b_order_items.unit_price_cents`, `b2b_payment_intents.amount_cents` ou `quoted_price` em procurement são **comercial, snapshot ou intenção** — não substituem o ledger.

**Regra de ouro (precisão executável):** **decisão contábil e estado financeiro persistente** só existem no Bank (ledger / transações canónicas). **Validações locais, cálculos derivados e regras de aplicação** são permitidos desde que **não** criem saldo paralelo, persistência financeira como verdade primária nem segundo ledger. O sistema pode **calcular** valor fora do Bank; só o Bank **define** o que é dinheiro movimentado.

**B2B:** `b2b_payment_intents` permanece intenção/registo operacional — **não** pode evoluir para ledger disfarçado (sem linhagem em `bank_ledger` / `bank_transactions` quando a fase exigir dinheiro real).

### Taxonomia de classificação de tabela (Gate 2 / relatórios)

| Classe | Significado | Exemplos |
|--------|-------------|----------|
| **SSOT** | Fonte normada da verdade para aquele facto | `bank_ledger`, `bank_transactions`, `identities` (KYC/documento) |
| **DERIVED** | Projeção ou cache reconstruível a partir de SSOT | `inventory_balances`, `economic_identities` |
| **LOG** | Registo operacional **sem autoridade decisória** | **`unifycard_transactions`** (correlação / parceiro; **não** saldo; CI: `guard-financial-regression.ts`) |

Regra: **LOG** e **DERIVED** não podem ser promovidos a “fonte de BI” ou agregação de saldo sem PROPOSTA + alinhamento ao Bank.

---

## 5.1 Identity / Actor

```yaml
Domínio: identity
Conceito: ator econômico (quem paga/recebe)
Autoridade: actors
Chave: actor_id
Escritor (runtime): actor-writer.service — ensureUserActor, ensurePageActor
Persistência INSERT: actor.repository (invocada pelo writer / port social; único caminho técnico de INSERT)
Gate 0 (exceção normada): identity.service — ver LEI §4.8.1
Leitores: bank, payments, splits, events, marketplace, services
Proibidos: global_user_id como chave final em dinheiro; INSERT em actors fora do writer (exc. §4.8.1)
Bank wallet utilizador: owner_id alinhado a users.user_id onde o contrato do Bank o exige (ver LEI §4.8.1)
Tipo: Primário
```

**Modelo fiscal / KYC (alinhamento com DDL `identities`):** precedência entre `identities.global_user_id`, projeção em `actors` e camada `economic_identities` — ver **`IDENTITY_SSOT_PRECEDENCE.md`** (não contradiz a autoridade operacional de `actor_id` em pagamentos; detalha onde vive documento vs papel).

**Consolidação actor-centric (rastreabilidade e responsabilidade, sem checklist de execução):** **`ACTOR_TRACEABILITY_CONTRACT.md`**.

## 5.2 Bank Core — Conta

```yaml
Domínio: bank
Conceito: conta econômica
Autoridade: bank_accounts
Chave: account_id
Escritor: bank-account service
Proibidos: accounts (legacy), region_accounts, group_accounts como primária
Tipo: Primário
```

**Acesso em código (aplicação):** SQL sobre `bank_accounts` **restringe-se** ao domínio `backend/src/modules/bank/`. Outros módulos **DEVEM** usar as APIs do Bank. Ver `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6**–§**4.7**.

## 5.3 Bank Core — Transação

```yaml
Domínio: bank
Conceito: transação econômica
Autoridade: bank_transactions
Chave: bank_transaction_id
Escritor: bank-transaction service
Proibidos: transactions, payment_transactions, payout_transactions, escrow_transactions, group_transactions
Tipo: Primário
Estado Final: bank_transactions
```

**Acesso em código (aplicação):** SQL sobre `bank_transactions` **restringe-se** ao domínio `backend/src/modules/bank/`. Outros módulos **DEVEM** usar as APIs do Bank. Ver `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6**–§**4.7**.

## 5.4 Bank Core — Ledger

```yaml
Domínio: bank
Conceito: verdade contábil e saldo
Autoridade: bank_ledger
Chave: ledger_entry_id
Escritor: bank-ledger service
Proibidos: ledger, ledger_entries, qualquer coluna balance como primária
Tipo: Primário
Estado Final: bank_ledger
```

**Acesso em código (aplicação):** leitura/escrita e bloqueios (`FOR UPDATE` quando aplicável) sobre `bank_ledger` **restringem-se** ao domínio `backend/src/modules/bank/` (repositórios/serviços). Outros módulos **DEVEM** usar as APIs expostas pelo Bank. Ver `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.6** e §**4.7**.

## 5.5 Bank Core — Split

```yaml
Domínio: bank
Conceito: split final de transação
Autoridade: bank_splits
Chave: split_id
Escritor: bank-splits service
Proibidos: payment_splits, payment_intent_splits, event_split_declarative, ledger_referral_splits, event_revenue_split
Tipo: Primário
Estado Final: bank_splits
```

## 5.6 Payments — Ciclo

```yaml
Domínio: payments
Conceito: intenção de pagamento
Autoridade: payment_intents
Chave: payment_intent_id
Escritor: payments module
Tipo: Primário (pré-financeiro)
Estado Final: NUNCA (não decide dinheiro)
```

## 5.7 Refund/Chargeback

```yaml
Domínio: bank/payments
Conceito: reversão financeira
Autoridade: bank_ledger + bank_transactions
Chave: bank_transaction_id (âncora)
Proibidos: event_refund, event_chargeback sem âncora no banco
Tipo: Primário (no banco), Derivado (no evento)
```

## 5.8 UnifyCard

```yaml
Domínio: unifycard
Conceito: captura/autorização/settlement
Registo operacional: unifycard_transactions (tabela LOG — NON-AUTHORITATIVE; ver taxonomia no topo da secção V)
Chave: unifycard_tx_id
Regra: NÃO decide saldo, NÃO decide estado final; não usar SUM/aggregações para decisão financeira
Tipo: LOG (NON-SSOT financeiro)
Estado Final: UnifyBank (bank_transactions/bank_ledger)
```

## 5.9 Marketplace — Movimentação física (ledger de quantidade)

```yaml
Domínio: marketplace / inventory
Conceito: eventos de quantidade (entrada, saída, ajuste) por variante de produto
Autoridade: inventory_movements
Chave: id (ledger_entry_id lógico)
Escritor: caminho canónico via serviço/repositório de marketplace (ex.: inventory-movement.repository / inventoryService.addMovement)
Leitores: reservas, fulfillment, transferências, relatórios, saldos derivados
Proibidos:
  - tabela paralela com papel de SSOT de movimento de estoque (ex.: inventory_events duplicando inventory_movements)
  - usar inventory_balances (ou qualquer projeção) como fonte primária de quantidade sem linhagem em inventory_movements
  - saldo de stock mutável por UPDATE direto fora do modelo de eventos
Tipo: Primário (append-only na autoridade)
Estado Final: inventory_movements
Read model opcional: inventory_balances (derivado; reconstruível por soma sobre inventory_movements)
Norma detalhada: docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md
```

**Nota:** identidade semântica do produto no domínio continua **CONCEPT** (Lei 7); `product_variant_id` liga ao catálogo, não substitui CONCEPT.

### 5.9.1 Marketplace — B2B: valores comerciais (não SSOT financeiro)

```yaml
Domínio: marketplace (pedidos B2B supply)
Conceito: preço acordado na linha; intenção de pagamento B2B
Autoridade de dados: b2b_order_items (unit_price_cents, currency); b2b_payment_intents (amount_cents, currency, status)
Tipo: Snapshot comercial / registo operacional — NÃO é saldo nem ledger
Estado final de dinheiro: somente via fluxo UnifyBank (bank_ledger / bank_transactions), fora do âmbito destas tabelas
Representação: BIGINT centavos (mesma convenção que amount_cents no Bank)
Documentação normativa: bloco DOCUMENTAÇÃO ÚNICA no topo deste ficheiro + INVARIANTES_OPERACIONAIS_LEDGER.md
```

### 5.9.2 Marketplace — Fundo regional e compensação de recurso (Bank, flag opt-in)

```yaml
Domínio: marketplace + bank
Conceito: incentivos consumidos a partir de pool regional; repasse resource_compensation
Autoridade financeira: bank_ledger + bank_transactions (mesmo quando o pedido nasce no marketplace)
Flag: USE_BANK_REGIONAL_FUND — default false; ver docs/03_execution_log/MARKETPLACE_BANK_REGIONAL_FUND_2026-04-14.md
Comportamento quando flag true:
  - Saldo regional exibido para decisão: derivado de bank_ledger na conta system owner_id system:regional_fund:{tenant_id}:{country}-{state}-{city} (criada por bankAccountService.ensureRegionalFundBankAccountForRegion)
  - consumeIncentive: bankTransactionService.transfer com reference_type regional_fund_incentive; treasurySource treasury:settlement na origem system
  - resource_compensation: transfer com reference_type resource_compensation; origem MVP platform_revenue (dívida de produto: futuro seller/escrow)
Comportamento quando flag false:
  - regional_funds.total_balance_cents e regional_fund.repository allocate/executeAllocation (legado) — não promover a verdade primária em paralelo ao ledger sem PROPOSTA
Tipo: Primário financeiro = sempre Bank; tabelas regional_funds / regional_fund_allocations = legado ou metadados até migração explícita
```

### 5.9.3 Catálogo — `canonical_products` (materialização operacional)

#### `canonical_products`

| | |
|--|--|
| **Tipo** | Estrutura operacional **derivada** |
| **Pilar** | Catálogo |
| **SSOT semântico** | **Não** — CONCEPT continua o único SSOT de “o que algo é” |

**Definição:**

- **não** é SSOT semântico;
- **não** é fonte de verdade primária de significado;
- é estrutura **derivada** de CONCEPT (`concept_id` obrigatório, validação semântica prévia).

**Função:**

- garantir identidade **operacional** única de produtos no catálogo;
- permitir reutilização entre tenants;
- suportar pipeline operacional: **canonical → product → pricing → order → bank** (sem inverter a dependência semântica: **CONCEPT → … → canonical**).

**Dependência obrigatória:**

- `concept_id` válido (FK obrigatória);
- validação semântica prévia baseada em CONCEPT.

**Limite de autoridade:**

- canonical **não** define semântica;
- canonical **não** substitui CONCEPT;
- canonical **não** pode divergir de CONCEPT.

**Proibições:**

- criar canonical sem `concept_id`;
- usar canonical como **regra de negócio semântica** ou como substituto de CONCEPT;
- permitir múltiplos canonicals semanticamente idênticos **sem** diferenciação estrutural legítima (atributos, identificadores externos, etc.);
- derivar identidade de slug, nome ou categoria **como fonte de significado**.

**Regra estrutural:**

Se houver dúvida entre canonical e CONCEPT:

→ **CONCEPT vence**.

---

**Identidade comercial por tenant:** nomes e SKUs por tenant ficam em **`products`** / **`product_variants`**; não definem significado semântico nem substituem CONCEPT.

**Proteção do catálogo:** **nenhum** match automático pode **criar, alterar ou fundir** `canonical_products` diretamente sem decisão explícita (operador humano ou política forte **auditável**). Algoritmo **sugere**; governança **decide**; só então persiste a **materialização** canónica.

**Fluxo normativo:**

```text
INPUT (nome livre / catálogo do tenant)
  → MATCHING (sugestão)
  → DECISÃO (governança)
  → CANONICAL (materialização operacional; sempre ancorada em CONCEPT)
```

**Evolução recomendada (sem auto-merge silencioso):**

1. **Fase 1:** matching **determinístico** por **GTIN** (ou identificador industrial equivalente) **exato**.
2. **Fase 2:** sugestão por **atributos** (marca, volume, família); **nunca** auto-merge para canónico.
3. **Fase 3:** **fila de revisão** (human-in-the-loop) antes de gravar ou fundir canónico.

**Proibido:** fuzzy match automático que **crie** `canonical_products`; merge **silencioso** entre canónicos; decisão **só** por string de nome; duplicar canónico **por região/país** sem **motivo físico** distinto (embalagem/SKU real diferente).

**Global vs. local:** o canónico **não** é “local por país”. **Disponibilidade e oferta** são locais: `supplier_catalog`, `distribution_relationship`, escopo do tenant.

**Persistência de sugestões (fase 1 — GTIN):** tabela `canonical_match_suggestions` (por `tenant_id`); **não** altera `canonical_products`; índice único parcial sobre `(tenant_id, input_gtin, suggested_canonical_product_id)` para `match_type = 'GTIN'`; GTIN de entrada normalizado (só dígitos, 8–20); `confidence_score` = 1.0 fixo para GTIN. Rotas: `POST /catalog/products/match-suggestions/gtin`, `GET /catalog/products/match-suggestions`.

---

## 5.10 Estruturas PROIBIDAS

### Financeiro Legacy
- ❌ accounts
- ❌ transactions
- ❌ ledger

### Splits Concorrentes
- ❌ ledger_referral_splits
- ❌ payment_splits
- ❌ payment_intent_splits
- ❌ event_split_declarative
- ❌ event_revenue_split

### Transações Paralelas
- ❌ payment_transactions (como autoridade)
- ❌ escrow_transactions (como autoridade)
- ❌ group_transactions (como autoridade)
- ❌ payout_transactions (como autoridade)

### Saldos Primários Proibidos
- ❌ accounts.balance
- ❌ group_balance.current_balance
- ❌ region_accounts.balance_cents
- ❌ bank_accounts.cached_balance (só derivado)

### Eventos sem Âncora
- ❌ event_refund sem bank_transaction_id
- ❌ event_chargeback sem bank_transaction_id

### Inventário / Quantidade (paralelismo proibido)
- ❌ tabela alternativa de “eventos de stock” com o mesmo papel de `inventory_movements`
- ❌ coluna ou tabela de “stock atual” como verdade primária sem eventos em `inventory_movements`
- ❌ UPDATE/DELETE em `inventory_movements` (imutabilidade; correção via novo evento / política explícita)

---

## 5.11 SEPARAÇÃO DE CAMADAS

- **CONCEPT** = SSOT semântico (identidade compartilhada entre módulos).
- **CATEGORY (`categories`)** = TREE de navegação operacional (não é SSOT semântico).
- **N1_NODES (`n1_nodes`)** = navegação global governada (não substitui `categories`).
- **PROFILE** = read model (não define identidade semântica).

## 5.12 REGRA DE IDENTIDADE SEMÂNTICA

- É proibido definir semântica fora de CONCEPT.
- `slug`, `category_id`, nome e labels não podem ser usados como identidade.
- A ligação entre módulos (perfil, marketplace, eventos, serviços) deve ocorrer por CONCEPT.

## 5.13 USO DE CATEGORIES

- Existe uma única árvore em `categories` para o sistema.
- Módulos usam recortes por `scope`/contexto, sem criação de árvores paralelas.
- `categories` organiza navegação e descoberta; não governa significado.

## 5.14 PERFIL PROFISSIONAL — ESTADO ATUAL

- Usa `categories` com `scope = 'professional'`.
- Skills válidas no estado atual: `level <= 2`.
- `concept_id` obrigatório para consistência semântica.
- Regra de validação: estrita, sem fallback silencioso.

## 5.15 ANTI-PATTERNS (PROIBIDO)

- Criar árvore paralela para perfil.
- Misturar `n1_nodes` com papel de árvore operacional.
- Inferir semântica por `slug`.
- Conectar módulos por `category_id`/nome como identidade.
- Criar SSOT semântico paralelo ao CONCEPT.
- Criar autoridade de movimentação de estoque paralela a `inventory_movements` (ver secção 5.10 — Inventário).

## 5.16 AUTHORITY / PERMISSÃO E ACTING ON BEHALF

```yaml
Domínio: authority (permissão operacional)
Conceito: quem pode executar ação P como actor A no tenant T (utilizador U)
Autoridade normativa: LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md §4.9 e §4.9.9 (delegação encadeada)
Chave lógica: (tenant_id, user_id, actor_id, permissionKey[, recurso])
delegation_chain (conceito normativo): sequência ordenada de elos de delegação, cada um com actor_origem, actor_destino, escopo, validade temporal, referência ao elo anterior; obrigatório fecho até actor humano §4.8 — ver §4.9.9
Temporalidade: toda delegação válida tem janela ou revogação determinável; proibido estado permanente não auditável (lei §4.9.9)
Vínculo responsibility: cadeia operacional não substitui nem oculta responsible_actor_id / âncora civil (§4.8.2; §4.9.2)
Motor de resolução (implementação atual — evoluir): authorization.service — canActAs / equivalentes; devem considerar cadeia futura sem quebrar SSOT
Fachada modules: authority.service — quarentena §4.8.4 + canActAs (§4.9.8)
Delegação (persistência): actor-delegation (repositório e tabelas associadas) — não duplicar segunda SSOT de delegação; alinhar a §4.9.9 quando evoluir
Mapa de permissões: MAPA_CANONICO_PERMISSIONS_v1.md + permission-keys (código) — chaves desconhecidas proibidas em produção
Quarentena prévia: isActorEffectivelyBlocked (§4.8.4) — gate antes ou dentro da resolução
Leitores: todos os módulos que escolhem actor ou ordenam mutações sensíveis (social, bank callers, marketplace, votes, …)
Proibidos:
  - resolver permissão só em middleware HTTP sem serviço de domínio
  - confundir responsible_actor_id (civil, §4.8) com permissão operacional (§4.9)
  - criar identidade ou ledger neste domínio
  - cadeia de delegação sem fecho humano ou sem temporalidade (§4.9.9)
Integração Bank: validar contexto de atuação alinhado a owner/user_id/company_id antes de operações financeiras (§4.9.6; Bank §4.6–4.7)
Tipo: Primário (complementar a §5.1 Identity e §5.2–5.5 Bank)
Prompt operacional (não substitui lei): CURSOR_PROMPT_AUTHORITY_LAYER.md — convergência de código §4.9 / §5.16
```

**Referência cruzada:** identidade e writer de actors — §**5.1**; valor e ledger — §**5.2**–**5.5**; **delegação normativa (cadeia, níveis, limites)** — `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §**4.9.9**.

**Imports / fronteiras de código:** `ARCHITECTURE_DEPENDENCY_BOUNDARIES.md` — alinhamento técnico progressivo (Bank repositories, authority, CI).

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- ACTOR_TRACEABILITY_CONTRACT.md
- ARCHITECTURE_DEPENDENCY_BOUNDARIES.md
- IDENTITY_SSOT_PRECEDENCE.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- 07_NOMENCLATURA_CANONICA.md
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- ACTOR_TRACEABILITY_CONTRACT.md
- BANK_DOMAIN_RULES.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- IDENTITY_SSOT_PRECEDENCE.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md
- VOCABULARIO_CANONICO_UNIFICARD.md
<!-- AUTO-GENERATED-END -->
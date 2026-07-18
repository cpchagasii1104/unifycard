# GATE READ-ONLY R-8 + R-7 — DESTRAVAMENTO DAS FATIAS D E A

**MODO: GUARDIÃO** · 2026-07-18 · read-only absoluto
**Worktree:** `C:\unificard` @ `rescue-structural` · **HEAD:** `8163a252e07113d0bcca71742df480c2f4f6fc7d`
**Âncoras:** `docs/04_audit/YALA_FINAL_REGULARIZACAO_R1_R10_2026-07-18.md` · `docs/03_execution_log/EXECUTION_LOG_F1_F3_O1_RUNNER_STOP_2026-07-18.md` · `REMEDIATION_DT_LOG.md`
**Escrita autorizada:** SOMENTE este arquivo. Zero edição de código/guards/cartório/migrations/schema_migrations; zero commit; banco só `BEGIN TRANSACTION READ ONLY`.

## VEREDITOS
- **R-8 (fronteira Bank):** **VEREDITO A — MATERIAL ELEGÍVEL** (envelope de REUSO de port Bank existente; sem decisão humana; sem novo SSOT).
- **R-7 (perfil efêmero):** **VEREDITO A — MATERIAL ELEGÍVEL** (envelope usa o mecanismo governado já existente `IGNORED_MIGRATIONS`; sem pré-marcação falsa; sem tocar dev nem a N1).
- **Reconciliação do registry do dev** (parte (b) da DT-EPHEMERAL): **VEREDITO C — BLOQUEADO** (persistente; fora deste escopo; autoridade própria).

---

## 1. PROVA NORMATIVA (§2.2.2)
Domínios: FINANCEIRO/FRONTEIRA-BANK (R-8) · PROVA/MIGRATIONS/CI (R-7) · união cautelosa com ACTOR (Fatia A) e TERRITÓRIO (Fatia D). Lidos integralmente nesta sessão: `00_AGENT_PROTOCOL` (§2.3.2 fronteira financeira), `CONSTITUICAO` (Art. V, VII), `LEIS_OPERACIONAIS` (Lei 1/2/3/5), `SSOT_EXCLUSIVE_BANK_RULE`, `BANK_DOMAIN_RULES` (§1/§3/§4), `LEDGER_SOVEREIGNTY`, `SSOT_REGISTRY` (§5.2–5.5, §5.9.2, §5.16, DECISION-0021), `PROHIBITED_STRUCTURES`, `API_CONTRACT_GOVERNANCE`; código vivo `core/unifybank/*`, `core/bank/ports-registry.ts`, `modules/bank/*`, `core/db/migrate.ts` + `migration-runner-core.ts`, migration `20260713140000`, cartório. **Pilar/SSOT:** financeiro — SSOT `bank_ledger` (Lei 5); executor soberano do ledger = `modules/bank` (BANK_DOMAIN_RULES §1; SSOT_REGISTRY §5.2 "SQL sobre bank_* restringe-se ao domínio `backend/src/modules/bank/`; outros módulos DEVEM usar as APIs do Bank"). **Não-SSOT:** `regional_fund_accounts` (mapping FK), `transparency.service` (reader), `schema_migrations` (registry técnico, não SSOT de produto). **Precedência:** Constituição > Leis > SSOT Registry > Ontologia. **Gate §2.3.2:** auditoria read-only; nenhum pilar mutado; nenhum SQL de escrita.

## 2. CONFIRMAÇÃO DO ESTADO SELADO (HEAD 8163a252e)
Reproduzido de 1ª mão:
- **HEAD** = `8163a252e`; working tree limpa exceto 2 untracked pré-existentes (`02_decisions_FULL.txt`, `YALA1_…` do modo-inválido).
- **Commits** `dac87f91e` (fixture e2e via writer selado Fase C — só `validate-pipeline-e2e-regional-fund-residence-reader.ts`), `6e31400f3` (2 selos), `8163a252e` (execution log) — **confirmados**. Desde a última YALA (`dcbcb03bb..8163a252e`) só mudaram: cartório, 2 guards (F-1/F-3), 1 fixture E2E, docs/logs, 2 relatórios YALA versionados (O-1). **ZERO código material/runtime/frontend/migration.**
- **Dois selos** registrados e **corretamente restritos**: SELO A (regularização PROCESSUAL — não sela A/D, não fecha DT); SELO B (Fatia C contenção fail-closed — declara módulo NÃO materializado, DT OPEN, 503 antes do ghost). ✓
- **DT-INVOICING-HARDCODED-TAX-RATE** = `🔴 OPEN · PARCIALMENTE REMEDIADA` (não fechada). ✓
- **Runner canônico executado read-only:** `node scripts/run-regression-guards.mjs` → **191/191, exit 0, 0 GATE FAIL** (1 warning honesto: fiscal-tax-catalog com DT OPEN + hardcode ausente). F-1 (guard C1 reconciliado, não afrouxado — troca 1 marcador literal por 4 checks discriminados mais fortes) e F-3 (guard de contrato agora repo-wide, descobre os 4 consumidores incl. `MFIBankSummary`) confirmados verdes.
- **DB (read-only):** `migrations=520`; `invoices=NULL`; `bank_accounts=16 · bank_transactions=0 · bank_splits=0 · bank_ledger=0` → **Δbank=0**; `regional_fund_accounts=1`. Bate com o esperado (520/Δbank=0/invoices=NULL). **Sem divergência → prossigo (não-FAIL).**

---

## 3. GATE R-8 — FRONTEIRA BANK

### 3.1 Mapa de 1ª mão (SQL bank_* em `core/unifybank`)
| Arquivo | Linhas | Tabelas | Natureza | Alcançável por rota |
|---|---|---|---|---|
| `transparency.service.ts` | 376–377 (`_getStatementForAccount`) | bank_ledger, bank_transactions | **leitura** (extrato de conta) | `GET /bank/statement`, `/bank/actor-statement` |
| `transparency.service.ts` | 519, 565 (`getTransactionSplits`) | bank_transactions, bank_accounts | leitura (splits) | `GET /bank/transaction/:id/splits` |
| `transparency.service.ts` | **682–700 (`getUserRegionalFund`)** | **bank_ledger, bank_transactions** | **leitura (movimentações do fundo)** | **`GET /bank/regional-fund` ← ENDPOINT DA FATIA D** |
| `transparency.service.ts` | 789–790 (`getAdminRegionalFund`) | bank_ledger, bank_transactions | leitura | `GET /bank/admin/regional-fund` (admin) |
| `regional-fund-governance.service.ts` | 101/106/136/137 | bank_accounts, bank_ledger | leitura | governança regional |
| `donation.service.ts` | 151 | bank_transactions | leitura | doação |

**Call graph do endpoint da Fatia D:** `GET /bank/regional-fund` (`transparency.routes.ts:240`) → `transparencyService.getUserRegionalFund(tenantId, userId)` → `findByUserId` (actor) → `resolveActorTerritory(ACTOR_RESIDENCE)` → `resolveRegionalFundAccountIdViaMapping(cityId)` (mapping `regional_fund_accounts`) → **saldo**: `bankPortsRegistry.getBankAccount().getBalance(tenantId, regionAccountId)` [linha 667–668, **já via PORT canônico**] → **movimentações**: SQL DIRETO a `bank_ledger` + `bank_transactions` [linhas 682–700, **A VIOLAÇÃO**].

**Achado decisivo:** a **decisão de saldo já é canônica** (port `getBalance`). A violação é **apenas o listing de movimentações** (extrato) por SQL direto. É **leitura pura** — não decide/escreve dinheiro, sem lock, sem cache, sem saldo derivado, sem fallback. Δbank=0. Contrato público afetado: `RegionalFundView.entries[]` (extrato) e `summary` (totais derivados das entries).

### 3.2 Veredito de jurisdição
- **`core/unifybank` NÃO possui jurisdição Bank promulgada.** SSOT_REGISTRY §5.2 restringe explicitamente o SQL de `bank_*` a `backend/src/modules/bank/`; BANK_DOMAIN_RULES §3 e LEI §4.6 mandam "outros módulos DEVEM usar as APIs do Bank". DECISION-0021: soberania fora de `/core` exige **declaração** por SSOT/lei/contrato — **inexistente** para `core/unifybank`. Nome "unifybank"/pasta "core" **não** provam soberania (DECISION-0021 é explícita).
- **A norma NÃO permite SQL `bank_*` fora de `modules/bank`.** A violação **não pode** ser mantida como exceção (improvisar exceção é proibido, §2.3.2). **A Fatia D NÃO pode ser selada enquanto esse caminho permanecer alcançável.**

### 3.3 Portas Bank existentes (descoberta — proibido duplicar)
- `core/bank/ports-registry.ts` → `bankPortsRegistry.getBankAccount()` (port `BankAccountPort`, **já usado para o saldo**).
- `modules/bank/bank-ledger.repository.ts` → **`getEntriesByAccount(tenantId, accountId, {entryType?, startDate?, endDate?, limit, offset})`** → retorna `BankLedgerEntry[]` (direction, amount_cents, transaction_id, created_at) = **exatamente o extrato** hoje montado por SQL cru.
- `modules/bank/bank-transaction-read.repository.ts` → `getAmountCentsByTransactionIds`, `listRecentTransactionsByActorId` (metadados de transação).
- `modules/bank/bank-balance-by-region.service.ts` → **`getRegionalFundHistory(tenantId, regionId, currency)`** → `RegionalFundHistory { balance, entries[] }`; comentário vivo: "FONTE CANÔNICA: conta de sistema regional_fund". **Já é um reader canônico de extrato+saldo de fundo regional dentro do Bank.**

**Conclusão:** os readers canônicos JÁ EXISTEM. Duplicar é proibido; encapsular novo também é desnecessário.

### 3.4 Comparação de envelopes
| | Aderência normativa | Mudança mínima | Risco SSOT paralelo | Contrato | Frontend | Decisão humana |
|---|---|---|---|---|---|---|
| **A** mover reader p/ `modules/bank` | alta | média (novo método/arquivo) | baixo | preservado | 0 | não |
| **B** REUSAR port/serviço Bank existente (`bank-ledger.repository`/`bank-balance-by-region`) | **máxima** | **mínima** | **nenhum** | preservado | 0 | **não** |
| **C** promulgar `core/unifybank` como jurisdição Bank | **contraria SSOT_REGISTRY §5.2** (exigiria emenda) | — | alto (legitima SQL espalhado) | — | sim (emenda) | **DESCARTADA** |
| **D** bloquear o endpoint | alta mas desproporcional | baixa | — | quebra consumidores | alto | não |

**C é descartada** (a norma restringe SQL a `modules/bank`; manter/expandir contradiz §5.2 — e B resolve sem emenda). **D é desnecessária** (leitura contida, Δbank=0, correção mecânica). **A é redundante** (o reader já existe). **Recomendação única: ENVELOPE B — REUSO.**

### 3.5 Envelope material R-8 (VEREDITO A)
**Objetivo:** substituir, em `transparency.service.getUserRegionalFund`, o SQL direto a `bank_ledger`/`bank_transactions` (linhas 682–700) por chamada ao reader canônico do Bank, **preservando byte-a-byte o contrato `RegionalFundView`**.
- **Arquivos PERMITIDOS:** `backend/src/core/unifybank/transparency.service.ts` (trocar o bloco de SQL de movimentações por `bankLedgerRepository.getEntriesByAccount(...)` + `bankTransactionReadRepository.getAmountCentsByTransactionIds(...)` **ou** delegar a `bankBalanceByRegionService.getRegionalFundHistory(...)` se o mapping region↔account alinhar); opcionalmente `bank-ledger.repository`/`bank-balance-by-region.service` **apenas** se faltar um método de leitura estritamente equivalente (preferir reuso puro); um guard novo `backend/scripts/audit-unifybank-no-direct-ledger-sql.mjs`; E2E/fixtures.
- **Arquivos PROIBIDOS:** qualquer migration; `modules/bank` **schema** (só leitura via repo); frontend (`RegionalFundView` inalterado); `bank_ledger`/`bank_transactions`/`bank_accounts` DDL/DML; qualquer escrita financeira; `donation.service`/`regional-fund-governance.service`/`_getStatementForAccount`/`getAdminRegionalFund` (dívida IRMÃ — mesma DT, **sequência posterior**, NÃO exigida para destravar a Fatia D e NÃO deve inchar o commit).
- **Port reutilizado:** `bank-ledger.repository.getEntriesByAccount` (+`bank-transaction-read` p/ metadados) e/ou `bank-balance-by-region.service`. **Saldo permanece** via `bankPortsRegistry.getBankAccount().getBalance` (já canônico — NÃO tocar).
- **Dependência permitida de `core/unifybank`:** importar/chamar **serviços/repositórios públicos do Bank** (padrão sancionado §4.6/BANK_DOMAIN_RULES §3). **Import de `modules/bank` por `core/unifybank` é a fronteira correta** (consumidor usando a API do Bank), não uma violação.
- **Contrato preservado:** `GET /bank/regional-fund` → `RegionalFundView` idêntico (4 `resourceState`, `entries[]`, `summary`, `currentBalanceCents number|null`). Guard `audit-regional-fund-contract` (já no runner) prova a preservação.
- **Testes/provas negativas/guards:** E2E `validate-pipeline-e2e-regional-fund-residence-reader` continua 6/6 (isolamento SP≠Curitiba; Δbank=0); guard novo `audit-unifybank-no-direct-ledger-sql` morde `FROM bank_ledger`/`bank_transactions`/`bank_accounts` em `core/unifybank/transparency.service.ts` **no caminho do endpoint** (prova negativa: reintroduzir SQL cru → guard MORDE → restauração byte-exata) e é **integrado ao runner canônico** pelo rito oficial (fingerprint) — sem duplicar o guard de fronteira existente se houver.
- **Critérios PASS:** endpoint sem SQL `bank_*` direto; contrato idêntico; runner ≥192/192; E2E verde; typecheck 0. **FAIL:** contrato alterado / novo saldo derivado / import indevido de tabela. **STOP:** se a delegação exigir mudar o mapping region↔account (aí é dívida-irmã, parar e registrar).
- **Rollback:** commit único revertível; sem migration; sem estado persistente.
- **Δbank=0** (leitura pura; provado por contagem antes/depois no E2E efêmero).
- **Critério p/ YALA da Fatia D:** (i) este envelope R-8 aplicado e provado; (ii) runner verde; (iii) F-1/F-3/contrato/resolver canônico já OK; (iv) fronteira Bank do **endpoint** fechada (dívida-irmã de `_getStatementForAccount`/`getAdminRegionalFund`/`donation`/`governance` pode permanecer OPEN na DT como sequência, **desde que não alcançável a agravar** — a YALA da D julgará se o fechamento do endpoint basta ou exige a superfície toda).

---

## 4. GATE R-7 — PERFIL EFÊMERO GOVERNADO

### 4.1 Mapa das migrations (1ª mão)
- `migrate.ts` + `migration-runner-core.ts`: `getMigrationProfile()` (CORE_ONLY|FULL); `shouldExecuteMigration(filename, profile)`: **`IGNORED_MIGRATIONS.includes(f) → false`** (nunca executa **e nunca marca** em `schema_migrations`); FULL executa todo o resto; CORE_ONLY exclui `LATENT_MODULE_MIGRATIONS`. `schema_migrations` grava `(filename, executed_at, checksum)`. Há um BASELINE automático (marca sem executar) **apenas** para DB populado com registry incompleto — não é o caso do efêmero (nasce vazio).
- **`IGNORED_MIGRATIONS` hoje** = `['046_company_status_and_documents.sql']` — mecanismo **governado e versionado** de skip honesto (SKIPPED ≠ APPLIED; não insere em schema_migrations).
- **N1 `20260713140000`**: DORMENTE por desenho (auto-prova self-aborting; "N1 migration obrigatória" só sob GATE/GO real; ausente de dev por design). Sob FULL, `migrate.ts` tenta executá-la → aborta → **é por isso que os E2E FULL só passaram com a pré-marcação manual não versionada** (o bypass condenado).
- `20260713100000`/`120000`: objetos existem em dev **sem** linha em `schema_migrations` (parte (b) — persistente).

### 4.2 Alternativas
| | Aderência | Migration? | Risco estado falso | Reprodutível | CI/Win/Linux | Decisão humana |
|---|---|---|---|---|---|---|
| **A** manifest c/ APPLIED/SKIPPED/DORMANT | alta | não | baixo | sim | ok | não |
| **B** reusar `IGNORED_MIGRATIONS` (lista governada existente) p/ a N1 dormente | **máxima** | não | **nenhum** (não marca como aplicada) | **sim** | ok | **não** |
| C snapshot efêmero do dev | média | não | médio (herda anomalia (b)) | parcial | frágil | não |
| D reconciliar registry do dev | — | — | — | — | — | **persistente → fora** |
| E alterar a migration N1 | — | sim | alto | — | — | **PROIBIDO pela missão** |

**Recomendação única: ENVELOPE B.** Adicionar `20260713140000_neighborhood_alias_first_governed_flow.sql` a `IGNORED_MIGRATIONS` (lista governada, versionada) — `shouldExecuteMigration=false` → **SKIPPED, não APPLIED, não inserida em schema_migrations**. Isso torna o FULL efêmero reprodutível a partir do repo **sem** pré-marcação falsa. (Opcional de clareza: renomear/segmentar como `DORMANT_MIGRATIONS` com o mesmo efeito — mas o reuso puro de `IGNORED_MIGRATIONS` é mínimo.)

### 4.3 Proibições respeitadas pelo envelope B
Não insere filename em `schema_migrations` sem executar (SKIPPED honesto); não trata SKIPPED como APPLIED; não modifica banco persistente; não depende de script scratch; **checksum** intacto (a linha nem é criada); não esconde migration que deveria falhar em produção (dormente por decisão registrada, não "que deveria falhar"); não reescreve migration selada; **não abre a N1 materialmente**; não fabrica equivalência com produção (espelha o dev sancionado onde a N1 está ausente).

### 4.4 Separação de concerns (autoridades distintas — §3.3)
1. **Perfil efêmero de teste (R-7):** Envelope B — **VEREDITO A, material elegível**, test-infra only.
2. **Reconciliação do registry do dev** (`20260713100000/120000`): **VEREDITO C — BLOQUEADO** (persistente; a missão proíbe "corrigir schema_migrations"; frente própria com GO; envolve hash/objeto no registry).
3. **Correção da migration N1:** **PROIBIDO** pela missão — não tocar.

### 4.5 Envelope material R-7 (VEREDITO A)
- **Arquivos PERMITIDOS:** `backend/src/core/db/migration-runner-core.ts` (adicionar a N1 a `IGNORED_MIGRATIONS`, com comentário citando a DT e a natureza dormente); versionar/ajustar o runner efêmero `run-actor-page-ephemeral.ps1` (e irmãos A/C/D) para **não** depender de pré-marcação; opcional guard `audit-migration-profile-governed.mjs` (morde qualquer INSERT em `schema_migrations` de filename não-executado fora do BASELINE governado).
- **PROIBIDOS:** a própria migration N1; `schema_migrations` do **dev**; qualquer migration nova; qualquer DDL.
- **Como a Fatia A será provada:** com a N1 em `IGNORED_MIGRATIONS`, `run-actor-page-ephemeral.ps1` (migrate FULL → **completa sem abortar, sem pré-marca**) → E2E actor-page **19/19** (vetores L/M/N/O/P; Authority+spoofing) → DB efêmera destruída → **dev intocado** (N1 ausente de `schema_migrations`, migrations/Bank do dev inalterados) → comandos 100% reproduzíveis do repo, em CI. Guard `audit-migration-runner-isolation` (já no runner) deve permanecer verde após a inclusão.
- **Critérios PASS:** ephemeral FULL sem pré-marca; A 19/19 focal reproduzível; dev intocado; runner verde. **STOP:** se `IGNORED_MIGRATIONS` quebrar `audit-migration-runner-isolation` → parar e reavaliar (talvez `DORMANT_MIGRATIONS` dedicada). **Critério p/ YALA da Fatia A:** os itens acima + ausência total de pré-marcação manual.

---

## 5. PRIORIDADE, DEPENDÊNCIAS E ORDEM

- **R-8 é violação de RUNTIME alcançável em produção** (SQL `bank_*` fora do Bank via `GET /bank/regional-fund`) → **prioridade sobre R-7** (que é test-infra). Contudo, R-8 é read-only/contido/Δbank=0 → não exige desligar o endpoint; corrigível já.
- **Ambos podem correr na MESMA campanha contínua, com COMMITS E PROVAS SEPARADOS** (não misturar): 1 commit R-8 (transparency.service + guard + provas) · 1 commit R-7 (IGNORED_MIGRATIONS + runner efêmero + provas). Cada um com seu E2E e seu registro no runner.
- **Decisões humanas estritamente necessárias: NENHUMA.** Ambos os envelopes são **determinados pela norma** (R-8 = reuso de port Bank existente, §4.6/§5.2; R-7 = mecanismo `IGNORED_MIGRATIONS` já governado). A alternativa C (jurisdição `core/unifybank`) foi **descartada por norma**, não remetida ao titular.
- **Gates que bloqueiam material:** nenhum. NÃO incluir: frontend fiscal/contábil, RFC, D9.2-B, B-CITY-2, Invoicing material, PORTA 01 (todos fora).
- **Fora do escopo (permanecem STOP/DT OPEN):** dívida-irmã do SQL Bank (`_getStatementForAccount`/`getAdminRegionalFund`/`donation`/`regional-fund-governance`) — sequência posterior sob a mesma DT; reconciliação do registry do dev (parte (b)).

## 6. CRITÉRIOS DE STOP / FAIL
- **STOP** se: R-8 exigir alterar mapping region↔account ou o contrato `RegionalFundView`; R-7 quebrar `audit-migration-runner-isolation`; qualquer necessidade de tocar `schema_migrations` do dev ou a N1.
- **FAIL** (na futura YALA) se: contrato alterado; saldo derivado fora do Bank; SQL `bank_*` remanescente alcançável pelo endpoint; pré-marcação manual persistir; runner < verde.

## 7. CRITÉRIOS PARA AS YALAS FINAIS
- **Fatia D:** endpoint sem SQL `bank_*` direto (via port); contrato idêntico; F-1/F-3/resolver/contrato OK; runner ≥192/192; Δbank=0; E2E verde. (A YALA decidirá se o fechamento do endpoint basta ou exige toda a superfície `core/unifybank`.)
- **Fatia A:** prova FULL reproduzível do repo sem pré-marca (N1 em lista governada); A 19/19; dev intocado; runner verde.

## 8. PROMPT COPIÁVEL PARA O EXECUTOR (uma campanha, commits/provas separados)
```text
MODO: EXECUTOR. Âncora: docs/04_audit/GATE_READONLY_R8_R7_DESTRAVAMENTO_D_A_2026-07-18.md.
Executar DOIS envelopes em commits e provas SEPARADOS, nesta ordem. NÃO tocar: frontend
fiscal, RFC, D9.2-B, B-CITY-2, Invoicing material, PORTA 01, migration N1, schema_migrations
do dev. Δbank=0 em ambos.

COMMIT 1 — R-8 (fronteira Bank, VEREDITO A · reuso):
 - Em backend/src/core/unifybank/transparency.service.ts, no método getUserRegionalFund,
   substituir o SQL direto a bank_ledger/bank_transactions (movimentações, ~682-700) por
   reuso do reader canônico do Bank: bankLedgerRepository.getEntriesByAccount(...) +
   bank-transaction-read para metadados, OU bankBalanceByRegionService.getRegionalFundHistory(...).
   MANTER o saldo via bankPortsRegistry.getBankAccount().getBalance (já canônico). NÃO alterar
   RegionalFundView. NÃO tocar donation/regional-fund-governance/_getStatementForAccount/
   getAdminRegionalFund (dívida-irmã, sequência posterior na mesma DT).
 - Criar guard scripts/audit-unifybank-no-direct-ledger-sql.mjs (morde FROM bank_ledger/
   bank_transactions/bank_accounts no caminho do endpoint em core/unifybank) + prova negativa;
   integrar ao runner canônico pelo rito oficial (fingerprint).
 - Provas: E2E validate-pipeline-e2e-regional-fund-residence-reader 6/6; guard regional-fund-
   contract verde; runner ≥192/192; typecheck 0; Δbank=0. Registrar execution log.

COMMIT 2 — R-7 (perfil efêmero, VEREDITO A · mecanismo governado):
 - Em backend/src/core/db/migration-runner-core.ts, adicionar
   '20260713140000_neighborhood_alias_first_governed_flow.sql' a IGNORED_MIGRATIONS (comentário:
   DORMENTE por desenho, self-aborting; ver DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED; SKIPPED,
   NUNCA marcada em schema_migrations). Ajustar os runners efêmeros A/C/D para NÃO pré-marcar.
 - Provas: run-actor-page-ephemeral.ps1 → migrate FULL completa sem abortar e SEM pré-marca →
   E2E actor-page 19/19; DB efêmera destruída; unificard_dev intocado (N1 ausente de
   schema_migrations); guard audit-migration-runner-isolation verde; runner verde. Execution log.

NÃO selar. Ao final, nova YALA independente por fatia (D e A).
```

## 9. DECLARAÇÃO FINAL
Nenhum código, guard, cartório, migration, `schema_migrations` ou banco foi alterado. HEAD permanece `8163a252e`; dev intocado; Δbank=0. Este Gate NÃO promulga arquitetura, NÃO executa R-7/R-8 material, NÃO abre D9.2-B/B-CITY-2/PORTA 01, NÃO emite selo. **R-8 = VEREDITO A** · **R-7 = VEREDITO A** · reconciliação do registry do dev = **VEREDITO C** (fora do escopo).

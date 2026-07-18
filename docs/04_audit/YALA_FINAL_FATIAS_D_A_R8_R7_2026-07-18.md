# YALA — AUDITORIA INDEPENDENTE FINAL DAS FATIAS D E A (R-8 / R-7)

**MODO: GUARDIÃO** · 2026-07-18 · read-only absoluto · vereditos A e D **independentes**
**Worktree:** `C:\unificard` @ `rescue-structural` · **HEAD auditado:** `04f4584be836291356ace60b56d6f9ac1e8d7444`
**Base:** `8163a252e` · **Âncoras:** Gate `GATE_READONLY_R8_R7_DESTRAVAMENTO_D_A_2026-07-18.md`, execution log `EXECUTION_LOG_R8_R7_DESTRAVAMENTO_2026-07-18.md`, YALAs anteriores A/C/D + R-1..R-10.
**Escrita autorizada:** SOMENTE este arquivo. Zero edição de código/guards/migrations/cartório/DTs/logs; zero commit; zero selo; banco só `BEGIN TRANSACTION READ ONLY`.

## VEREDITOS (independentes)
- **FATIA D (R-8 · fronteira Bank do endpoint):** **PASS — APTA PARA SELO** (restrito ao endpoint `GET /bank/regional-fund`).
- **FATIA A (R-7 · perfil FULL efêmero governado):** **PASS — APTA PARA SELO** (restrito à Fatia A + parte (a) da DT).
- **DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL:** permanece **🔴 OPEN · PARCIALMENTE REMEDIADA** (dívida-irmã alcançável em superfícies independentes).
- **DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED:** permanece **🔴 OPEN · PARCIALMENTE REMEDIADA** (partes (b)/(c) persistentes).

---

## 0. CADEIA DE CUSTÓDIA E PREFLIGHT
- **HEAD** = `04f4584be` (confirmado). Working tree limpa exceto 2 untracked **pré-existentes** (`02_decisions_FULL.txt`, `YALA1_…` do modo-inválido) — não apagados/movidos/alterados.
- **6 commits** `8163a252e..04f4584be`, separados por função: `9e620a696` (R-8 material inicial: transparency.service + `bank-transaction-read.repository` + guard + E2E) · `7e744f4e7` (R-7: `migration-runner-core.ts` + `migrate.ts`) · `a1d1dae65` (Gate versionado, **+167/0 add puro**) · `2bea83770` (**refino R-8 por PORTS** + ratchet 592→591) · `b7c72b2af` (cartório) · `04f4584be` (execution log).
- **Gate byte-exato:** o Gate versionado foi adicionado num único commit `+167/0` sem edição posterior à sua path → **byte-idêntico** ao relatório produzido por esta YALA. ✓
- **§0.6 (pós-runner-declaration):** após `2bea83770` (onde a executora rodou o runner) só mudaram **cartório** (`b7c72b2af`, REMEDIATION_DT_LOG.md) e **execution log** (`04f4584be`) — **zero runtime/guards/baseline/migrations/testes** (confirmado por numstat). ✓
- **`git diff --check`:** limpo.
- **Runner RE-EXECUTADO por esta YALA no HEAD final** (não confiei na execução de `2bea83770`): `node scripts/run-regression-guards.mjs` → **192/192 · exit 0 · 0 GATE FAIL**, sem early-exit/skip silencioso; o guard novo `audit-unifybank-no-direct-ledger-sql` **consta do manifesto** e passou; warnings honestos classificados em §3.

---

## 1. FATIA D — R-8 · FUNDO REGIONAL · **PASS — APTA PARA SELO**

### 1.1 Fronteira Bank (verificado no código vivo do HEAD)
`transparency.service.getUserRegionalFund`:
- **NÃO** contém SQL direto a `bank_ledger`/`bank_transactions` (guard escopado ao método prova; reverifiquei o corpo). ✓
- **NÃO** importa repositório concreto de `modules/bank` — o único import de `@modules/bank` é `integer-cents-from-db` (util puro de centavos, não repositório). ✓ (o import direto do repositório existiu no `9e620a696` e foi **removido** em `2bea83770` — estado final limpo).
- **Saldo:** `bankPortsRegistry.getBankAccount().getBalance()` — port canônico, inalterado. **Não deriva saldo.** ✓
- **Extrato:** `BankAccountPort.getLedgerEntriesByAccount(tenantId, accountId, {limit,offset})` — impl em `bankAccountService` **reusa `bankLedgerRepository.getEntriesByAccount`** (reader canônico existente; **não** cria segunda semântica). ✓
- **Metadados:** `BankTransactionReadPort.getMetadataByTransactionIds(tenantId, ids)` — impl em `bank-transaction-read.repository` com SQL **dentro de `modules/bank`**. ✓
- **Sem ensure/create/provisionamento no read path.** ✓ **Não concede soberania Bank a `core/unifybank`** (consome a interface pública do Bank via registry). ✓
- **Ampliação das portas:** `getLedgerEntriesByAccount` é **conta-scoped** (coerente com `BankAccountPort`; a conta é a âncora do ledger — não vira interface genérica sem fronteira); `getMetadataByTransactionIds` é coerente com `BankTransactionReadPort`. **Sem dependência circular** (`core/unifybank → core/bank/ports (interface) → modules/bank (impl via adapter/registry)`). **Sem reader/verdade/regra duplicados** — expõe os readers existentes (`getEntriesByAccount`), respeitando SSOT_REGISTRY §5.2. **Não é segunda semântica** → não rebaixa para CONDICIONAL.

### 1.2 Segurança e isolamento (1ª mão)
- `getMetadataByTransactionIds`: `SELECT ... FROM bank_transactions WHERE tenant_id = $1 AND id = ANY($2)` via `runQueriesWithTenant` → **metadata cross-tenant por transaction IDs é fisicamente impossível** (tenant no WHERE + RLS). ✓
- `getLedgerEntriesByAccount` e `getBalance`: tenant explícito no 1º parâmetro; conta resolvida por `regional_fund_accounts` (mapping FK) da **residência canônica** do actor (`findByUserId` → `resolveActorTerritory(ACTOR_RESIDENCE)` → city_id → mapping EXATO); **sem** fallback mono-fundo/Curitiba/CEP/nome; `cityId` **nunca** do frontend; ambiguidade de actor **fail-closed** (`findByUserId` `LIMIT 2` → `ACTOR_USER_ANCHOR_AMBIGUOUS`). ✓
- **Prova adversarial (E2E `validate-pipeline-e2e-regional-fund-residence-reader`, reproduzida no HEAD):** A fund_available (Curitiba, saldo 0 real) · B **ISOLAMENTO** SP≠Curitiba (2 cidades, 2 contas regionais próprias) · C `regional_fund_not_provisioned` · D `canonical_city_missing` · E `residence_missing` (legado `owner_type=profile` NÃO usado pelo reader) · G residência pelo writer SELADO Fase C · **H movimento real (currentBalanceCents=4200 + 1 credit) via reader Bank canônico** · **F Δbank=0**. Cobre a matriz exigida (tenants tenant-scoped; 2 cidades/2 contas; residência ausente; cidade canônica ausente; fundo não provisionado; cross-tenant tx bloqueado por SQL).

### 1.3 Contrato, guard e caso H
- `RegionalFundView` **preservado** (4 `resourceState`, `currentBalanceCents number|null`, `entries[]`, `summary`, ordenação `created_at DESC` + LIMIT/OFFSET idênticos, `null≠0`). Guard `audit-regional-fund-contract` (repo-wide, 4 consumidores) **verde**; nenhum consumidor colapsa ausência em R$ 0,00.
- Guard novo `audit-unifybank-no-direct-ledger-sql`: **escopo deliberado e honesto** — só `getUserRegionalFund` (o endpoint), com prova negativa (reintroduzir SQL cru → morde) e declaração de que **não** cobre a dívida-irmã. Integrado ao runner canônico (192). Não duplica o guard de escrita `audit-bank-ledger-boundaries`. ✓
- **Caso H** semeia `INSERT INTO bank_ledger` **apenas na DB efêmera** (`assertEphemeralDb` aborta se alvo≠efêmero; `EXPECTED_DATABASE_NAME`); residência via **writer selado Fase C** (`setActorTerritorialAddress`, sem INSERT direto, sem desabilitar trigger/RLS/guard). **Não** cria caminho produtivo de escrita nem enfraquece guard/allowlist. ✓ **Δbank=0** no dev (16/0/0/0).

### 1.4 Escopo do selo D (restrito — obrigatório)
- **Suficiente para selar APENAS a Fatia D (endpoint `GET /bank/regional-fund`).**
- **A DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL DEVE permanecer OPEN/PARCIALMENTE REMEDIADA:** `_getStatementForAccount`, `getTransactionSplits`, `getAdminRegionalFund`, `donation.service`, `regional-fund-governance.service` ainda fazem SQL direto a `bank_*` — **superfícies independentes**, NÃO alcançáveis por `GET /bank/regional-fund` (endpoints distintos). **PROIBIDO** fechar a DT integralmente. O cartório já reflete isso corretamente (dívida-irmã OPEN).

---

## 2. FATIA A — R-7 · PERFIL FULL EFÊMERO · **PASS — APTA PARA SELO**

### 2.1 Mecanismo governado (1ª mão)
- `IGNORED_MIGRATIONS` em `src/core/db/migration-runner-core.ts` inclui **`20260713140000_neighborhood_alias_first_governed_flow.sql`** com comentário que declara natureza DORMENTE/self-aborting + remissão à DT. `shouldExecuteMigration=false` → **NÃO executa e NÃO insere em `schema_migrations`** (SKIPPED ≠ APPLIED). O log do runner passou a dizer "SKIPPED (skip governado … NÃO marcadas como aplicadas)". ✓
- **Migration N1 BYTE-INTACTA:** blob `ad176db8f…` idêntico base↔HEAD (não tocada). ✓ **N0/N1/N2/ontologia/vocabulário soberano intocados** (nenhum arquivo de navegação no intervalo). ✓
- `IGNORED_MIGRATIONS` aplica-se a todos os ambientes; para a N1 isso é **correto** — ela é dormente por decisão registrada (só aplicável sob GATE/GO territorial real), ausente do dev por design; o skip global **não mascara** uma migration material obrigatória (é o oposto: torna honesto o que antes era pré-marcação falsa). Não inferi autorização "porque ficou verde": confirmei a **semântica** (SKIPPED, sem INSERT).

### 2.2 Reprodutibilidade (REPRODUZIDA por esta YALA, sem pré-marca)
Executei o runner efêmero versionado `run-actor-page-ephemeral.ps1` (cria DB nova → `migrate FULL` → E2E → drop), **sem** inserir manualmente a N1:
1. **`migrate FULL` terminou com exit 0, SEM abortar** (antes abortava na N1 — o bypass condenado). ✓
2. **N1 SKIPPED:** `20260713140000` **ausente** da lista de migrations EXECUTADAs (100000/120000 rodam normal no efêmero fresco). ✓
3. **Actor-page E2E: 19/19** — incl. spoof **L/M/N/O**, fallback canônico **P** (`findByUserId`), ambiguidade coberta pelo caminho `viewer=null` (O), e **G Δbank=0**. ✓
4. **DB efêmera destruída** (🧹 drop); **0 clones `_e2e` remanescentes** (verificado). ✓
5. **`unificard_dev` intocado** pós-ephemeral: migrations=520, **N1 ausente** de `schema_migrations` (0). ✓
- **Prova negativa** (CONFIRMADA-POR-MECANISMO, não re-executada destrutivamente para não mutar o repo): a N1 é self-aborting por desenho; sem a entrada em `IGNORED_MIGRATIONS`, `shouldExecuteMigration=true` → FULL tenta executá-la → aborta — exatamente o histórico documentado nas DTs/YALAs anteriores. Coerente e determinado pelo código lido.

### 2.3 Escopo do selo A (restrito — obrigatório)
- **Suficiente para selar a Fatia A** (authority/viewer da Actor Page — já correta desde a campanha — **agora com prova FULL reproduzível do repo**).
- **A DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED DEVE permanecer OPEN/PARCIALMENTE REMEDIADA:** parte (a) endereçada; **(b)** objetos `20260713100000`/`120000` em dev sem linha em `schema_migrations` (persistente — VEREDITO C) e **(c)** registry por filename seguem OPEN. **A anomalia (b)/(c) NÃO afeta a prova da Fatia A** (a prova roda em DB efêmera fresca onde essas migrations executam normalmente; é dívida do **registry persistente do dev**, independente). **Alteração da N1 continua PROIBIDA.**

---

## 3. RUNNER, RATCHETS E NÃO-REGRESSÃO (HEAD final)
- **`run-regression-guards.mjs` = 192/192 · exit 0 · 0 GATE FAIL** (reproduzido). Guard novo no manifesto; sem contagem inflada/skip silencioso.
- **financial-ssot 592→591 — RATCHET LEGÍTIMO:** count real medido = **591 / max 591**. Causa: `getUserRegionalFund` deixou de importar `bankLedgerRepository`/`bankTransactionReadRepository` (removidos em `2bea83770`) e passou às PORTAS → `transparency.service` deixou de referenciar 'repository' financeiro (impl vive em `modules/bank/bank-account.service`, já contado). **Remoção real de ocorrência**, não mascaramento por renome/regex/exclusão/allowlist; baseline abaixado no MESMO commit (DECISION-0158 ratchet só-desce). Conforme. ✓
- **financial-vocabulary 3855 < 3889:** warning honesto (abaixo do teto; runner sugere ratchet-down opcional). Não é FAIL; pré-existente, não relacionado a esta campanha.
- **fiscal-tax-catalog:** GATE OK + 1 warning (DT-INVOICING **OPEN** + hardcode ausente → "fechar com re-carimbo" — esperado; a DT NÃO deve ser fechada aqui).
- **typecheck** oficial backend (`tsconfig.build.json`) = 0; **frontend** (`tsc --noEmit`) = 0. **`git diff --check`** limpo.
- **DB (read-only):** migrations aplicadas=**520** (dev antes=depois); **invoices=NULL** (ghost); `bank_accounts=16 · tx=0 · ledger=0 · splits=0` → **Δbank=0**; `regional_fund_accounts=1`; N1 ausente de `schema_migrations`.
- **DT-INVOICING** permanece 🔴 OPEN · PARCIALMENTE REMEDIADA. **PORTA 01 fechada**; **D9.2-B/B-CITY-2 intocados**; allowlist territorial não ampliada; navegação/ontologia/vocabulário soberano inalterados.

---

## 4. DIVERGÊNCIAS ALEGAÇÃO×HEAD
Nenhuma divergência material. O cartório (`b7c72b2af`) e o execution log declaram **corretamente**: "MATERIAL IMPLEMENTADO · AGUARDA YALA · NÃO É SELO"; dívida-irmã OPEN; Fatia D/A NÃO SELADAS; DTs PARCIALMENTE REMEDIADAS. Sem autosselo. A alegação "runner 192/192" foi **independentemente reproduzida** por esta YALA no HEAD final.

## 5. ESTADO DAS DTs E ESCOPO ABERTO
- **DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL:** OPEN · PARCIALMENTE REMEDIADA (endpoint fechado; `_getStatementForAccount`/`getTransactionSplits`/`getAdminRegionalFund`/`donation`/`governance` OPEN — jurisdição de `core/unifybank` **não promulgada**, frente própria).
- **DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED:** OPEN · PARCIALMENTE REMEDIADA ((a) resolvida; (b) registry persistente do dev + (c) registry-por-filename OPEN).
- **DT-INVOICING-HARDCODED-TAX-RATE:** OPEN · PARCIALMENTE REMEDIADA (fora deste escopo; **não fechar**).

---

## 6. SELOS AUTORIZADOS (redação exata e restrita — a YALA autoriza; NÃO registra)

**SELO D — FATIA D · FRONTEIRA BANK DO ENDPOINT DO FUNDO REGIONAL — ✅ SELADA PELA YALA (RESTRITO)**
> Autorizado pela auditoria independente `docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md` (§1 = PASS). O caminho vivo de `GET /bank/regional-fund` (`transparency.service.getUserRegionalFund`) **não faz mais SQL direto a `bank_*`**: saldo via `bankPortsRegistry.getBankAccount().getBalance`; extrato via `getLedgerEntriesByAccount` (reuso de `bankLedgerRepository.getEntriesByAccount`); metadados via `getMetadataByTransactionIds` (tenant-scoped) — implementações em `modules/bank`. Contrato `RegionalFundView` preservado; guard `audit-unifybank-no-direct-ledger-sql` no runner (192/192); E2E territorial verde; Δbank=0; ratchet financial-ssot 592→591 legítimo. **RESTRIÇÕES:** NÃO declara `core/unifybank` soberano; NÃO declara a fronteira Bank saneada; a **DT-UNIFYBANK segue OPEN** (dívida-irmã statement/admin/donation/governance). Commits `9e620a696`+`2bea83770`; runner verde no HEAD `04f4584be`.

**SELO A — FATIA A · PERFIL FULL EFÊMERO GOVERNADO + VIEWER ACTOR PAGE — ✅ SELADA PELA YALA (RESTRITO)**
> Autorizado por esta auditoria (§2 = PASS). A prova FULL da Actor Page é agora **reproduzível do repositório sem pré-marcação falsa**: N1 dormente `20260713140000` em `IGNORED_MIGRATIONS` (SKIPPED ≠ APPLIED; N1 byte-intacta; nada inserido em `schema_migrations`); `migrate FULL` efêmero completa sem abortar; **actor-page 19/19** (spoof L/M/N/O, fallback P, Δbank=0); DB efêmera destruída; `unificard_dev` intocado. **RESTRIÇÕES:** NÃO fecha a DT-EPHEMERAL (partes (b) registry persistente do dev e (c) registry-por-filename seguem OPEN); NÃO reconcilia o registry do dev; NÃO altera a N1. Commit `7e744f4e7`; runner verde no HEAD `04f4584be`.

## 7. PROMPT MÍNIMO PARA O EXECUTOR (registrar SOMENTE os 2 selos autorizados)
```text
MODO: EXECUTOR. Âncora: docs/04_audit/YALA_FINAL_FATIAS_D_A_R8_R7_2026-07-18.md (§6).
Ato ÚNICO docs-only: registrar no REMEDIATION_DT_LOG.md, append-only, os DOIS selos com a
redação EXATA e RESTRITA do §6 (SELO D · Fatia D endpoint; SELO A · Fatia A/perfil efêmero),
citando relatório+commits+HEAD 04f4584be+runner 192/192. NÃO fechar DT-UNIFYBANK nem
DT-EPHEMERAL nem DT-INVOICING (todas seguem OPEN/PARCIALMENTE REMEDIADAS). NÃO selar o módulo
Invoicing. NÃO tocar código/guards/migrations/frontend. NÃO abrir D9.2-B/B-CITY-2/PORTA 01.
Δbank=0. Depois: STOP.
```

## 8. DECLARAÇÃO FINAL
Nenhum material, guard, migration, cartório, DT, log ou banco foi alterado por esta auditoria. HEAD permanece `04f4584be`; `unificard_dev` intocado (520 migrations, N1 ausente, Δbank=0); zero clone remanescente; zero commit; **nenhum selo registrado** (apenas autorizado). Vereditos **D e A independentes**, restritos e não-expansivos: **D = PASS/APTA (endpoint)**, **A = PASS/APTA (perfil efêmero + viewer)**; três DTs seguem OPEN.

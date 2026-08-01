# PARECER YALA — arco `f558561d1..3dc7bdf5b` (28 commits, 27 sem auditoria) · 2026-08-01

**Auditora:** YALA (independente, adversarial) · **Modo:** read-only absoluto.
**Banco de TODAS as provas: `unificard_dev`** (oficial, **550** migrations, dado curado intacto).
Só `SELECT`, catálogo do Postgres e execução de guards read-only. **Nenhuma escrita. Nenhum `dropdb`.**
**Mandato:** derrubar 5 afirmações. Não repeti o ataque de ratchet que a direção já fez nos 3 guards.

| # | afirmação | veredito |
|---|---|---|
| 1 | convergência de `severity` completa nas 4 tabelas | **SOBREVIVE** |
| 2 | religamento ao SSOT de reconciliação está certo | **SOBREVIVE-COM-RESSALVA** (type-confusion em `reference_id`) |
| 3 | 17 endpoints de `rides` contidos; os das 14 tabelas vivas seguem 200 | **SOBREVIVE** (contei 17 exatos) |
| 4 | o teto desceu por conserto REAL, não por afrouxamento | 🔴 **DERRUBADA (parcial)** — desceu por **allowlist** |
| 5 | PLACAR e `CLAUDE.md` descrevem o estado real | 🔴 **DERRUBADA** — a frase que sustenta o teto é falsa |

🔎 **Fora das 5, e é a vigésima:** o contrato de `riskLevel` diverge do banco **nos arquivos que o
commit de HEAD acabou de editar** (§ final).

---

## 【1】 SEVERITY — **SOBREVIVE**

**O que tentei, em ordem de probabilidade de morder:**
1. **Constraints vivas** (o que o `tsc` nunca vê) —
   `SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid::regclass::text IN ('audit_events','trust_events','financial_alerts','alerts') AND contype='c'`
   → as **3** CHECK são `('CRITICAL','ERROR','WARNING','INFO','AUDIT')`; o ENUM `alert_severity`
   tem exatamente os mesmos 5 labels. Nenhum resíduo minúsculo no schema.
2. **Dado vivo** — `SELECT severity, count(*)` nas 4 → única linha existente é `audit_events/INFO` (4).
   Nenhum valor fora do vocabulário sobreviveu à migration 550.
3. **Varredura de escrita minúscula em TODO o repo** (não só `backend/src`: incluí
   `backend/migrations`, `backend/scripts`, `scripts/`, `frontend/src`) →
   os únicos hits são **fora das 4 tabelas**: `core/reporting/reporting.service.ts:52` (escreve em
   `reports`, tabela que **não existe** — outro defeito, já catalogado, não este),
   `workers/reconciliation-scheduled.worker.ts:49` (vai para log/Slack via `alertRouter`),
   e tipos de `frontend/api/marketplace.ts` / `operational-limits` (domínios distintos).
4. **`pg_proc`** — nenhuma função/trigger plpgsql menciona as 4 tabelas ou `severity` (0 linhas).
5. **A brecha que eu mesma abri no arco anterior** — `tsconfig.build.json` exclui `*.test.ts`/
   `*.spec.ts`; revarri esses arquivos: **nenhum** escreve severity nas 4 tabelas.
6. **Os 28 commits novos** não introduziram nenhum writer novo dessas 4 tabelas.

**Não caiu.** A afirmação está correta como escrita.

---

## 【2】 RECONCILIAÇÃO — **SOBREVIVE-COM-RESSALVA**

**O que tentei:**
- **A DECISION é mesmo a que dizem?** Li `RECONCILIATION_DISCREPANCY_DUAL_TABLE.md` inteira:
  status **vigente**, e o SSOT de *"diagnóstico ledger ↔ transações ↔ contas"* é de fato
  `reconciliation_runs` + `reconciliation_ledger_discrepancies`. ✅
- **`account_mismatch` existe?** `pg_get_constraintdef` de
  `reconciliation_ledger_discrepancies` → o CHECK inclui `account_mismatch`. ✅
- **A corrida humana se mistura com as 15.938 do motor?** Era o ataque principal. **Não se
  mistura:** escreve `metadata.engine = 'manual_admin_input'`
  (`reconciliation.repository.ts:249,289`) e **a leitura filtra** —
  `WHERE r.tenant_id = $1 AND r.metadata->>'engine' = $2` (`:378`, e `:449` no get-by-id).
  Confirmei no banco: `SELECT metadata->>'engine', count(*) FROM reconciliation_runs GROUP BY 1`
  → **`prompt_52` = 15938**, nenhuma linha manual ainda. A DECISION exige exatamente esse
  prefixo de origem (*"engine: prompt_52 vs engine: legacy_0026"*). ✅
- **Diferença zero grava corrida sem discrepância?** `if (input.differenceCents !== 0)` →
  `discrepanciesFound = 1`; senão 0, e `finishRun(...,'completed')`. Confere. ✅
- **O ghost antigo foi realmente desligado?** `bank-reconciliation-history.repository.ts` está
  DORMENTE, com cabeçalho honesto, e **sem caller** — a única menção fora do arquivo é um
  comentário `NÃO:` na rota religada. ✅

### 🟠 RESSALVA — type-confusion plantada no SSOT de dinheiro (PROVADO por código)
O mesmo `discrepancy_type` passa a apontar para **duas entidades diferentes**:

| escritor | `discrepancy_type` | `reference_id` |
|---|---|---|
| motor (`reconciliation-engine.service.ts:148-149`) | `account_mismatch` | **`a.id` = id da conta bancária** |
| manual (`reconciliation.repository.ts:304-305`) | `account_mismatch` | **`tenantId` = id do tenant** |

Quem consumir `account_mismatch` fazendo o join natural (`reference_id → bank_accounts`) acha a
conta nas linhas do motor e **nada** nas manuais. Hoje é indetectável — `reconciliation_ledger_discrepancies`
tem **0 linhas** (nenhuma corrida achou discrepância), então nenhum teste morde isso.
A comparação humana é *saldo consolidado do tenant × extrato externo*: não é mismatch de
**conta** nenhuma, e a família 0053 não tem tipo para ela. **Correção:** ou tipo próprio, ou
`reference_id` que aponte para algo real (a conta consolidada) com a natureza declarada em
metadata. Grau: **PROVADO** · gravidade **AMARELA** (semântica, sem efeito enquanto não houver
discrepância real — e é justamente por isso que passa despercebido até o dia em que houver).

---

## 【3】 CONTENÇÃO DE `rides` — **SOBREVIVE** (a contagem bate exatamente)

**O que tentei — os dois lados do falso-negativo que o mandato nomeou:**

**"um a mais mata funcionalidade viva":** contei rota a rota, por arquivo:
`availability 4/4 · demand 4/4 · drivers 4 rotas/1 contida · location 2/1 · safety 5/5 ·
service-types 7/2` → **17 contenções** (`grep -cE "status\(501\)|code\(501\)"`), **exatamente** o
número afirmado, em 26 rotas. **9 rotas seguem vivas** — nenhuma contida por engano.

**"um a menos deixa 500":** extraí as tabelas referenciadas pelos módulos com rota viva
(`drivers`, `location`, `service-types`) e testei existência no banco:
`rides_cities · rides_driver_locations · rides_drivers · rides_rides · rides_service_types ·
rides_vehicles` **existem**; `rides_driver_availability` e `rides_driver_documents` **não**.
Persegui as duas ausentes até o fim:
- `rides_driver_availability` → só `drivers/availability/availability.service.ts`, alcançável
  apenas pelo `PATCH /:driverId/availability`, que **é a contenção** de `drivers.routes.ts:150-155`. ✅
- `rides_driver_documents` → `drivers.service.ts:90,126,184`, nos métodos `uploadDriverDocument`,
  `approveDriver`, `checkExpiredDocuments`. As **4 rotas vivas de drivers chamam só
  `listDrivers` (`:65`) e `createDriver` (`:139`)** — nenhuma toca esses métodos. ✅

**Também ataquei o que a varredura NÃO tocou** (módulos registrados fora dos 6 arquivos do
commit): `vehicles` e `zones` referenciam apenas `rides_drivers`, `rides_vehicles`, `rides_zones`
— **as três existem**. ✅

**Não caiu.**
🟡 **Ressalva declarada:** `rides/vehicle-compliance/vehicle-compliance.routes.ts` tem **6 rotas,
0 contenção** e faz `INSERT`/`UPDATE`/`FROM` em `rides_driver_documents` (`:194,256,267,527`) —
tabela ausente. **Não é 500 vivo:** o módulo **não é registrado** (`rides.module.ts` não o
importa). Mas ficou **fora da varredura e sem marcador nenhum**, então a próxima instância que
registrar o módulo acende 6 rotas contra tabela fantasma sem nada avisando. É a "classe ③" que o
mandato disse que ninguém mediu — medida aqui, e é dead-code, não risco vivo.

---

## 【4】 O TETO QUE DESCEU — 🔴 **DERRUBADA (parcial): desceu por ALLOWLIST, não por remoção**

A metade fácil da afirmação é verdadeira e eu confirmei: **`red-gates-baseline.json` NÃO foi
tocado no arco** (`git log f558561d1..HEAD --` nesse arquivo → vazio) e **nenhum arquivo foi
deletado** (`git diff --diff-filter=D --name-only f558561d1..HEAD` → vazio). ⚠️ Portanto a
premissa que o mandato me entregou — *"a executora subiu `financial-vocabulary` tirando o E2E do
repositório"* — **não tem lastro neste arco**: nem `backend/package.json` nem os scripts de
`financial-vocabulary` foram tocados. Se aconteceu, foi antes do denominador declarado.

**Mas a afirmação central cai.** Cadeia, com os comandos:

1. **Quando desceu:** `git show <commit>:backend/scripts/schema-coherence-ratchet-baseline.json | grep GHOST-WRITE-vivo`
   → `856c5529d` = **260 / 355** · `581259803` = **259 / 353**. A descida está em **`581259803`** —
   um commit intitulado *"docs(entry): four documents each claimed to be the way in"*.
2. **Por que desceu:** diff das chaves entre os dois commits →
   **exatamente 2 chaves removidas, nenhuma adicionada:**
   ```
   modules/bank/bank-reconciliation-history.repository.ts::bank_reconciliation_history::FROM::C1-GHOST-READ::CORRUPTOR::vivo
   modules/bank/bank-reconciliation-history.repository.ts::bank_reconciliation_history::INSERT::C1-GHOST-WRITE::BLOCKER::vivo
   ```
3. **O SQL fantasma continua no arquivo** — li `bank-reconciliation-history.repository.ts` em HEAD:
   `INSERT INTO bank_reconciliation_history` (`:101`) e `FROM bank_reconciliation_history`
   (`:161`, `:185`) estão **lá, intactos**.
4. **O que mudou foi a allowlist:** `scripts/schema-coherence-allowlist.json` ganhou a entrada
   `DT-BANK-RECONCILIATION-HISTORY-DORMANT` (`files_scope: [modules/bank/bank-reconciliation-history.repository.ts]`).
   A própria entrada admite: *"**Allowlistado (não consertado por remoção)** … a violação textual
   segue lá, só que morta."*
5. **E a allowlist SALVA, apesar do que o projeto acredita:**
   `scripts/validate-schema-code-coherence.mjs:1000-1005` —
   ```js
   const allowlistId = isAllowlisted(ref, allowlist.entries, ref.file);
   if (allowlistId) { allowlistedIds.add(allowlistId); }
   else { violations[detected.severity].push(...) }
   ```
   O ref allowlistado **nunca entra em `violations`**, e é `violations` que vira o `--json` que o
   ratchet consome. Logo a *"contagem do CÓDIGO"* que o ratchet compara **já vem filtrada pela
   allowlist**. Rodei o gate: `✅ GATE OK … GHOST-WRITE-vivo 259/259 · GHOST-READ-vivo 353/353`.

**Conclusão honesta, sem inflar:** o **conserto do caminho vivo foi real e vale** — a rota
`/admin/finance/consolidated-balance/reconciliation` deixou de bater num 42P01 e passou a gravar
no SSOT canônico. Mas **o número não desceu por causa disso**: desceu porque o arquivo entrou na
allowlist, e teria descido igual com **zero** linha de código alterada. O teto não distingue as
duas coisas — e é exatamente a falha que o `CLAUDE.md:49-52` descreve como lição aprendida
(*"Compare contra a contagem do CÓDIGO, não só contra a allowlist; senão adicionar a chave
'resolve' o vermelho"*). **A doutrina está certa; a implementação a viola uma camada abaixo.**

🔴 **Agravante — a isenção é permanente e desguardada:** não existe guard anti-revival do
repositório dormente (`grep` por `bank-reconciliation-history` em `backend/scripts/*.mjs` →
só um comentário). A isenção é **por caminho de arquivo**. No dia em que alguém importar
`bankReconciliationHistoryRepository` de novo, o SQL fantasma volta a executar e o gate
**permanece verde**. Grau: **PROVADO** · gravidade **LARANJA**.

---

## 【5】 A CAMADA SEM AUDITOR — 🔴 **DERRUBADA**

Li o PLACAR como quem vai agir. Três coisas falsas, uma delas load-bearing:

### 5.1 🔴 A frase que sustenta a confiança no teto é FALSA
`docs/04_audit/PAINEL_DIVIDA_VIVA.md`, seção *"OS DOIS TETOS"*:
> *"ambos com trava estrutural (o teto é comparado contra a contagem do CÓDIGO — **pôr a chave na
> allowlist não salva**)"*

**Salva.** É literalmente o mecanismo do §4 acima: `validate-schema-code-coherence.mjs:1000-1005`
descarta o ref allowlistado antes de contar, e a única descida de teto da história do projeto
aconteceu assim. E duas linhas adiante o documento reforça o erro:
> *"Número que desce = dívida paga de verdade. **Não há caminho silencioso para cima.**"*

Não há caminho silencioso para **cima** — verdade. **Há para baixo**, e foi usado. Quem ler esta
seção vai tratar qualquer queda futura do teto como dívida paga, sem conferir a allowlist.
Grau: **PROVADO** · gravidade **LARANJA** (é a métrica que a casa elegeu para dirigir o trabalho).

### 5.2 🟠 A tabela dos tetos está VENCIDA no próprio documento
A tabela lista `BLOCKER-vivo 260 · BLOCKER-scripts 105 · CORRUPTOR-vivo 364 · CORRUPTOR-scripts
1047 · DEBT 32/18` como *"valor congelado 2026-07-31"*. O guard em HEAD **não usa mais esses
buckets**: usa **14 tetos por condição** (`GHOST-WRITE-vivo 259`, `GHOST-READ-vivo 353`, …),
trocados em `856c5529d` — commit do próprio arco. A ERRATA logo abaixo explica a *classificação*
errada, mas **não corrige os números da tabela**, que continuam apresentados como vigentes.
Quem cruzar a tabela com a saída do runner encontra dois vocabulários e nenhum aviso.

### 5.3 🟡 O cabeçalho data errado
*"PLACAR — última medição **2026-07-30**"*, mas as linhas dizem *"query direta, 2026-07-31"* e o
baseline do gate declara `"generatedAt": "2026-08-01"`. Três datas, uma seção.
Também: *"`schema_migrations` 550 aplicadas"* — **confere** (`SELECT count(*)` → 550). ✅

### O que ataquei no PLACAR e **resistiu**
Migrations 550 ✅ · `bank_ledger`/`bank_transactions`/`bank_splits` = 0 ✅ · banco oficial
`unificard_dev` ✅ · os 3 guards novos **estão** no runner (`run-regression-guards.mjs:315,323,332`) ✅ ·
a ERRATA das 7 condições sob 3 rótulos é honesta e verificável ✅ · a declaração de que
`BLOCKER-vivo` **superestima** o perigo (contenção não é descontada) é correta e está declarada ✅.
**O PLACAR erra onde se elogia, não onde se acusa** — o padrão vale registrar.

---

## 🔎 FORA DAS 5 — A VIGÉSIMA, e está no commit de HEAD

`3dc7bdf5b` consertou os baldes do contador (`actorsByRiskLevel` agora `low|medium|high|critical`,
batendo com `trust_profiles_risk_level_check` — confirmei no banco:
`CHECK (risk_level = ANY (ARRAY['low','medium','high','critical']))`). **Mas o mesmo commit
editou os dois arquivos onde o defeito continua, e não o corrigiu:**

- `modules/risk-command-center/risk-dashboard.types.ts:49` — `ActorRiskProfile.riskLevel:
  'LOW'|'MEDIUM'|'HIGH'|'BLOCKED'` · `:108` — o **filtro** `ActorRiskFilters.riskLevel` idem.
  Vinte e cinco linhas acima, `:20-23`, o próprio arquivo declara: *"Vocabulário governado por
  `trust_profiles.risk_level` CHECK (low|medium|high|critical). NÃO usar MAIÚSCULA nem `BLOCKED`"*.
  **O arquivo se contradiz.**
- `frontend/src/api/risk-dashboard.ts:48` — mesma união MAIÚSCULA (arquivo também tocado pelo commit).
- **Caminho até o efeito:** `risk-dashboard.routes.ts:159` `riskLevel: req.query.riskLevel as any`
  → `risk-dashboard.service.ts:189` → `trust.repository.ts:296`
  `conditions.push('risk_level = $n'); values.push(filters.riskLevel)`.
  A coluna é **TEXT com CHECK** (não ENUM), então filtrar por `'HIGH'` **não dá erro: devolve 0
  linhas, em silêncio, para sempre.** É a classe silenciosa que eu declarei não-auditada no
  parecer anterior — e ela existe.
- E na saída: `service.ts:337` devolve `profile.riskLevel` (minúsculo, do banco) num campo tipado
  MAIÚSCULO; `RiskCommandCenterPage.tsx:89-107` faz `colors[riskLevel]` / `labels[riskLevel]` com
  chaves `LOW/MEDIUM/HIGH/BLOCKED` → **sempre o fallback**: cinza `#6b7280` e o texto cru.
- **Dois erros de vocabulário, não um:** `BLOCKED` não existe no CHECK, e `critical` — que existe
  — não tem representação no tipo nem na tela. **Ator de risco crítico não é selecionável pelo
  filtro nem rotulável na UI.**

Hoje ninguém vê: `trust_profiles` tem **0 linhas** e a superfície é fail-closed sob PORTA-01
(`assertFinancialProjectionAllowed`). É **fundação plantada**, exatamente como o `service_order_status`
do arco anterior. **Saiu do escopo das 5** — digo para não confundir cobertura com sorte.

---

## O QUE NÃO AUDITEI (declarado)
- **Não subi backend nem frontend; nenhuma requisição HTTP.** Provas = SQL real no banco oficial,
  catálogo do Postgres, execução do gate `schema-coherence-ratchet` e leitura de código.
- **Não rodei o runner completo** (232 comandos): confirmei que os 3 guards estão cabeados
  (`run-regression-guards.mjs:315,323,332`), não que os 232 passam.
- **Não ataquei os 3 guards novos** — a direção já o fez com violação nova + chave na baseline.
- Dos 28 commits, li integralmente os que sustentam as 5 afirmações; os de `docs/cartório`
  (`26de1f390`, `8e179c359`, `38a32bce8`, `bf702c05e`, `a70f11abd`) foram lidos só onde tocam
  o PLACAR e o `CLAUDE.md`.
- **A classe silenciosa está medida só onde olhei:** cruzei os **5 enums** minúsculos e o CHECK de
  `trust_profiles`. **Não** varri os ~30 demais CHECK textuais contra suas uniões TS — é onde
  estaria um quinto membro da família.
- `unificard_local` (aposentado) intocado.

---
*Read-only respeitado. Única escrita: este arquivo.*

# YALA FINAL — AUDITORIA DA REGULARIZAÇÃO R-1..R-10 · CAMPANHA A/C/D

**MODO: GUARDIÃO** · 2026-07-18 · execução independente
**Worktree:** `C:\unificard` @ `rescue-structural` · **HEAD auditado:** `dcbcb03bb74180210a665ac461f99f21842d0556`
**Âncora:** `docs/04_audit/YALA_RELATORIO_INDEPENDENTE_CAMPANHA_ACD_2026-07-18.md` (intocado — verificado: mtime 12:48, anterior aos commits da regularização; conteúdo íntegro)
**Intervalos:** regularização `693b3d63b..dcbcb03bb` (8 commits, mapeamento R-1..R-10 conferido por numstat) · acumulado `c06b6f32e..dcbcb03bb`
**Escritas desta auditoria:** SOMENTE este arquivo. Zero edição de código/cartório/DTs/guards; zero commit; banco somente `BEGIN TRANSACTION READ ONLY`+`ROLLBACK`.

---

## 1. PROVA NORMATIVA (§2.2.2)

Domínios (união cautelosa): ACTOR/AUTHORITY (A) · FINANCEIRO+FISCAL (C) · FINANCEIRO×TERRITÓRIO×CONTRATO-HTTP×FRONTEND (D) · PROCESSO/CARTÓRIO (R-1/2/7/8/9/10) · NAVEGAÇÃO (diff-zero apenas). Lidos integralmente nesta sessão: `00_AGENT_PROTOCOL` · `CONSTITUICAO` · `LEIS_OPERACIONAIS` · `SSOT_EXCLUSIVE_BANK_RULE` · `BANK_DOMAIN_RULES` · `LEDGER_SOVEREIGNTY` · `OBSERVABILIDADE_CONSTITUCIONAL` · `API_CONTRACT_GOVERNANCE` (integral) · `CORE_IMUTAVEL` · `SSOT_REGISTRY` (§5.1/§5.2/§5.9.2/§5.16) · `PROHIBITED_STRUCTURES` · (sessão) `02_ACTORS`/`03`/`07`/`18`/LEI §4.8-4.9 · relatório YALA anterior · cartório · execution log da regularização. Pilar/SSOT por fatia: **A** identidade+authority (`actors` §5.1 + `canRepresentActor` §5.16) · **C** financeiro/fiscal (`bank_ledger` Lei 5; `invoices` ≠ SSOT) · **D** financeiro+territorial (`bank_ledger` único saldo §5.9.2; `address_assignments` ACTOR_RESIDENCE; `regional_fund_accounts` mapping). Não-SSOT: N2 · category · slug · GRAPH · invoices · regional_fund_accounts · frontend · `actionContext.actorId` · cartório. Precedência: Constituição > Leis > SSOT Registry > Ontologia. Gate §2.3.2: auditoria read-only, nenhum pilar mutado, fronteira financeira respeitada. Suficiência: cobre integralmente o escopo R-1..R-10.

---

## 2. VEREDITO DA REGULARIZAÇÃO PROCESSUAL — **PASS**

Verificado de primeira mão (diffs + arquivos vivos):
- **Modo único:** todos os 8 commits são EXECUTOR (declarado no commit R-1, no cartório e no execution log); nenhum artefato de guardiã foi produzido pelo executor; **nenhum PASS/SELADA/RESOLVIDA emitido** — R-1 declara "Nenhum ✅/RESOLVIDA/SELADA/PASS é válido até auditoria YALA independente". Sem novo duplo-modo. ✓
- **R-1 (cartório):** headers A/C/D rebaixados para `🟠 MATERIAL (PARCIAL) IMPLEMENTADO · AGUARDANDO AUDITORIA YALA` com nota `SUPERSEDIDO POR R-1` e **texto original preservado**; DT-INVOICING **efetivamente REABERTA** (`🔴 OPEN · PARCIALMENTE REMEDIADA · AGUARDA YALA`; transição anterior anulada por supersessão com histórico riscado, não apagado); bloco R-1 no topo fixa o estado canônico. Append-only respeitado. ✓
- **R-2 (execution log):** `docs/03_execution_log/EXECUTION_LOG_CAMPANHA_ACD_E_REGULARIZACAO_2026-07-18.md` — **declaração de tardividade explícita**, sem alegar validação retroativa ("não tornam retroativamente válida…"); contém modo/escopo/objetivo/arquivos/commits/comandos/resultados/limitações/referência à YALA — satisfaz §6.2/§7 **para frente**. ✓
- **R-9:** GATE D9.2-B espelhado no cartório (`🟠 BLOQUEADO/CONDICIONAL · NÃO É GO`, B1–B4 explícitos); RFC ganhou banner `⚠️ NÃO É UMA DECISION PROMULGADA` + verificação §4.3 (primeiro artefato do tema; DECISIONs adjacentes citadas) + nota honesta da violação de duplo-modo de origem. ✓
- **Relatórios YALA intocados** ✓. **Observação O-1:** os dois relatórios YALA permanecem **untracked** (não commitados) — a âncora canônica citada pelo cartório não está versionada; commitar (docs-only) na próxima janela.
- **Observação O-2:** o execution log lista resultados de guards individuais, mas **o runner canônico completo nunca foi executado** pela campanha nem pela regularização — ver F-1 (§5), descoberto por esta auditoria.

A irregularidade processual anterior foi corretamente regularizada, sem retroatividade fingida.

---

## 3. FATIA A — ACTOR PAGE · **VEREDITO: CONDICIONAL** (inalterado)

Material revalidado de primeira mão (código vivo no HEAD): viewer derivado do principal; hint só com `canRepresentActor`; fallback `findByUserId` **read-only** com `actor_id` correto e **ambiguidade fail-closed** (`LIMIT 2` → `throw ACTOR_USER_ANCHOR_AMBIGUOUS`, `actor.repository.ts:341-343`); nenhuma criação em GET; infra → 5xx (catch→false removido); anti-enumeração; tenant-scoped; E2E com vetores adversariais L/M/N/O + caso P do fallback. **Material: CORRETO.**

**Prova 19/19 — auditoria especial (§4 da missão):**
- O script versionado é `run-actor-page-ephemeral.ps1` → cria DB e roda `npx tsx src/core/db/migrate.ts` com `MIGRATION_PROFILE='FULL'`.
- `migrate.ts` **não possui** mecanismo de skip para a migration N1 dormente `20260713140000` (self-aborting por desenho) — verificado por leitura do runner.
- Logo, **como versionado, o script ABORTARIA na N1**: a prova 19/19 só rodou com a **pré-marcação manual não versionada** de `schema_migrations` na DB efêmera (admitida no cartório da campanha e agora registrada honestamente em `DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED`).
- `unificard_dev` permanece limpo (N1 ausente de `schema_migrations` — reverificado read-only). Esta auditoria **não repetiu o bypass**.
- Classificação: **prova focal válida · prova FULL inválida/não-reproduzível do repo.** Conforme a missão ("não conceder PASS com base em migration fingida como aplicada"), a fatia permanece **CONDICIONAL**.

**Saída para PASS:** perfil efêmero governado e versionado (envelope da DT R-7) **ou** prova focal independente que não dependa da cadeia FULL.

---

## 4. FATIA C — INVOICING · **DOIS VEREDITOS**

### 4.1 Contenção fail-closed do módulo-fantasma — **PASS · CONTENÇÃO FAIL-CLOSED APTA PARA SELO**
*(sem declarar o módulo de Invoicing materializado)*

Verificado de primeira mão (diff R-6 + código vivo):
- `assertInvoicingSchemaAvailable()` prova `to_regclass('public.invoices')` — **probe de catálogo, não toca a tabela-fantasma** — como **passo 0** de `createInvoiceFromPayout` e **primeira linha** das outras 5 superfícies (`issueInvoice`/`cancelInvoice`/`listInvoices`/`getInvoiceById`/`getInvoiceByPayoutOrderId`). **Nenhuma consulta a invoices/invoice_items ocorre antes.** ✓
- Schema ausente → `INVOICE_MODULE_UNAVAILABLE` **503** (estado honesto de indisponibilidade), **distinto** de `INVOICE_FISCAL_CONFIG_MISSING` **422** (schema presente sem motor fiscal) — infra não se confunde com ausência. ✓
- Sem taxa default/hardcoded (guard verde; único "5%" é comentário histórico); nenhum documento fiscal oficial alegado; **nenhum schema criado** (`to_regclass('invoices')=NULL` no dev, reverificado). ✓
- `taxRate`/`taxAmountCents`/`taxesCents` **deprecados** com `@deprecated` sem remoção (compatível, contract-first). ✓
- Guard `audit-invoicing-no-hardcoded-tax` **integrado ao runner canônico** (`run-regression-guards.mjs`, 189→191) e reforçado (probe+assert antes do repository). ✓
- **Circularidade morta:** `audit-fiscal-tax-catalog` com a DT reaberta emite **warning honesto** (failures=0, exit 0: "hardcode ausente mas DT segue OPEN — fechar com re-carimbo") — o status da DT não gera mais self-pass; o estado registrado agora é VERDADEIRO. ✓

**Ressalva de efetividade (não invalida a contenção):** a barreira "no runner" só morde quando o runner roda verde — hoje o runner está VERMELHO por F-1 (defeito imputado à Fatia D, §5). O **registro do selo** da contenção deve aguardar a restauração do runner.

### 4.2 Estado da DT-INVOICING-HARDCODED-TAX-RATE — **CORRETO: 🔴 OPEN · PARCIALMENTE REMEDIADA**
A DT **não pode ser fechada**: o módulo segue schema-ghost, o motor fiscal não está integrado, e o resíduo de types existe (deprecado). O estado atual do cartório reflete a verdade. Fechamento futuro exige: materialização governada do schema + integração do motor fiscal canônico + reconciliação de `taxRegime` — frentes próprias com GO.

---

## 5. FATIA D — FUNDO REGIONAL · **VEREDITO: CONDICIONAL — BLOQUEADA PARA SELO (F-1 + F-2)**

### O que foi verificado CORRETO (1ª mão)
- **6.1 Contrato:** `GET /bank/regional-fund` **catalogado** no §5 (`API_CONTRACT_GOVERNANCE.md:243-266`) — contrato soberano identificável; request/response/4 estados/erros/autoridade/SSOT/efeitos/invariante de honestidade completos; **violação histórica de contract-first registrada honestamente** ("a ordem foi irregular… sem fingir retroatividade"); `resourceState` é nomenclatura **operacional** (não ontologia); guard de contrato criado e no runner.
- **6.2 Frontend (TODOS os consumidores localizados por grep repo-wide):** `RegionalFundCard` agora **projeta `resourceState`** (ausência → mensagens honestas; `?? 0` remanescente está DENTRO do branch `fund_available`, onde saldo é real) · `DashboardHome` projeta estados ('—' default; `?? 0` só em `fund_available`; CTA de residência → `/perfil`, sem criar verdade) · `RegionalFundUser` projeta (4 refs) · **`MFIBankSummary`** (4º consumidor, fora do radar anterior): null → "Fundo regional ainda não disponível" — **não colapsa**. R$ 0,00 só em `fund_available` com ledger provando zero. ✓
- **6.3 Resolver:** `resolveUserActorId` paralelo **removido** (0 ocorrências); `findByUserId` canônico em uso (`transparency.service.ts:630-635`) — tenant explícito + RLS, `actor_type='user'` sem enumeração legada (`actor_human`/`person` ausentes do resolver), **ambiguidade fail-closed propagada como 500** (nunca `residence_missing` silencioso), zero criação. ✓
- **Δbank:** contas=16 · regional_fund_accounts=1 · transactions=0 · splits=0 · ledger=0 (read-only). **Esclarecimento dos números:** "16/1/0/0/0" = (accounts, regional_fund_accounts, transactions, splits, ledger); "16/0/0" dos relatórios YALA = (accounts, transactions, ledger). **Tuplas diferentes da MESMA realidade — não houve mudança**; nenhum dinheiro movimentado; `bank_ledger` única verdade; nenhum saldo paralelo.

### Defeitos que bloqueiam o selo
- **F-1 (NOVO · ALTO · imputado à campanha D):** o runner canônico **FALHA no HEAD** — `audit-c1-human-journey-closure.mjs` morde: "DashboardHome deve exibir '—'/indisponível para null…". Causa provada: o guard exige o marcador literal `regionalFundCents === null ? '—'` (linha 135); o baseline `c06b6f32e` o tinha (1 ocorrência), o HEAD **não tem** (0) — a reescrita da Fatia D (`8170db60f`) removeu a variável. O comportamento NOVO é semanticamente honesto (verificado), mas **a barreira canônica está vermelha** e nem a campanha nem a regularização perceberam (o runner completo nunca foi executado — os guards foram rodados individualmente). Consequência: o trilho canônico de regressão está quebrado no HEAD; **nenhum selo deve ser registrado com o runner vermelho**; e a barreira nova de C (que vem depois na cadeia) não é alcançada em CI. **Correção monotemática:** reconciliar o guard C1 com o padrão novo (pelo rito oficial de alteração de guards) OU restaurar marcador equivalente — e então executar e registrar `run-regression-guards.mjs` **191/191**.
- **F-2 (fronteira Bank · DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL · OPEN):** o caminho vivo de `GET /bank/regional-fund` **atravessa SQL direto** a `bank_ledger`/`bank_transactions` em `core/unifybank/transparency.service.ts` — **fora** de `backend/src/modules/bank/`. A letra de `LEI §4.6`/`BANK_DOMAIN_RULES §3`/GATE §2.3.2 restringe esse SQL ao domínio Bank; `core/unifybank` **não possui ratificação promulgada** como domínio Bank (DECISION-0021 permite soberania fora de `/core` **por declaração** — declaração que não existe; a própria DT reconhece que a jurisdição é decisão NÃO promulgada). A DT registra honestamente (localização exata, callers `transparency/donation/regional-fund-governance`, risco, envelope, **sem exceção inventada**) — mas **a DT não elimina a violação**: o SQL segue **alcançável em produção** pelo endpoint. **Determinação desta YALA:** a DT bloqueia **o PASS/selo da Fatia D** (não bloqueia o runtime nem exige desligar o endpoint — leitura pré-existente, Δbank=0, contida); NÃO bloqueia A nem C. **Não existe fundamentação normativa que permita PASS com o SQL proibido alcançável** — logo D permanece CONDICIONAL até: decisão soberana ratificando `core/unifybank` como jurisdição Bank **ou** porta read-only canônica do Bank substituindo o SQL direto (envelope da DT, frente própria com GO).
- **F-3 (MÉDIA-BAIXA · robustez de guard):** `audit-regional-fund-contract.mjs` usa **allowlist fixa de 3 consumidores** e `continue` silencioso em erro de leitura — `MFIBankSummary.tsx` (que lê `currentBalanceCents`) **escapa da varredura**, e a mensagem de sucesso ("todo consumidor…") superdeclara. Hoje sem dano material (verifiquei o 4º consumidor manualmente — honesto); corrigir para varredura repo-wide (grep/glob) na correção F-1.

---

## 6. R-7 · MIGRATIONS E AMBIENTE EFÊMERO — **DT CORRETA · PROVA FULL SEGUE CONDICIONAL**

`DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` registra TODOS os itens exigidos: (a) pré-marcação manual não versionada da N1; (b) perfil versionado ausente; (c) objetos do dev sem linha em `schema_migrations` (`20260713100000`/`20260713120000`); (d) risco do registry por filename; (e) envelope de remediação (perfil governado + reconciliação por hash/objeto); (f) **STOP explícito** sobre o banco persistente ("banco NÃO corrigido; nenhuma migration falsificada em dev"). ✓ Nada foi escrito em `schema_migrations` (reverificado: N1 = 0 linhas em dev).

**"Reproduzível via runner versionado" ≠ verdadeiro:** provado nesta auditoria que `run-actor-page-ephemeral.ps1` + `migrate.ts` FULL **abortariam na N1** — os E2E FULL continuam dependendo exatamente do bypass condenado. Mantêm-se como **provas focais**; a prova FULL do repo permanece **BLOQUEADA** até o perfil governado. "Reproduzível" **não** é sinônimo de "governado" — e neste caso nem sequer é reproduzível.

---

## 7. R-8 · SQL BANK FORA DA FRONTEIRA — ver §5/F-2

DT íntegra (localização/callers/tabelas/alcance/risco/envelope; sem exceção inventada). **Determinação de alcance do bloqueio:** bloqueia **o selo da Fatia D** e a evolução futura da superfície; não bloqueia A/C; não exige desligamento do endpoint (read-only pré-existente, sistêmico, Δbank=0, tratado por STOP honesto + frente própria). "Era preexistente" foi usado para justificar **o registro como DT em vez de refatoração imediata** (aceitável — a correção depende de decisão arquitetural não promulgada e improvisar exceção é proibido), **não** para fingir conformidade — o texto da DT é explícito nisso.

---

## 8. R-10 · TYPECHECK — **PARCIALMENTE CONCLUÍDA**

- HEAD reproduzido por esta auditoria com o compilador oficial (`node ./node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit`): **exit 0 · 0 erros**. ✓
- **Comparação segura com `c06b6f32e`: NÃO realizada** (nem pelo Executor, nem por esta auditoria — worktree com node_modules cria junctions cuja remoção é vetada pelo protocolo de segurança). O execution log **não** alega "baseline confirmado"; adota a opção B da prescrição anterior (HEAD=0 como baseline vigente). **Classificação: evidência parcial quanto ao passado; suficiente para frente** (com HEAD=0, qualquer erro futuro é pós-baseline por definição). R-10 fica **concluída na opção B**, com a comparação histórica registrada como não-realizada.

---

## 9. D9.2-B · B-CITY-2 · RFC — **CONFORMES**

- **D9.2-B:** espelhado no cartório como `🟠 BLOQUEADO/CONDICIONAL · NÃO É GO MATERIAL`; B1–B4 completos; nenhum material executado; migrations D9.1/D9.2-A seguem NÃO aplicadas em dev. ✓
- **B-CITY-2:** STOP mantido; Gate de composição segue fora do cartório (corretamente reconhecido). ✓ **PORTA 01: fechada.** ✓
- **RFC:** banner de não-promulgação + §4.3 + nota de origem honesta; nenhum endpoint; nenhuma decisão financeira tomada pelo Executor. ✓

---

## 10. QUADRO FINAL

| Item | Veredito |
|---|---|
| Regularização processual (R-1/R-2/R-9) | **PASS — APTA PARA REGISTRO DE SELO** (processual) |
| Fatia A | **CONDICIONAL** (material correto; prova FULL bloqueada — DT R-7) |
| Fatia C · contenção | **PASS — CONTENÇÃO FAIL-CLOSED APTA PARA SELO** (registro condicionado à restauração do runner, F-1; módulo NÃO materializado) |
| Fatia C · DT-INVOICING | **OPEN · PARCIALMENTE REMEDIADA — estado correto, não fechável** |
| Fatia D | **CONDICIONAL — BLOQUEADA PARA SELO** (F-1 runner vermelho; F-2 fronteira Bank sem jurisdição promulgada; F-3 lacuna do guard) |
| Guards | individuais verdes; **runner canônico VERMELHO no HEAD (F-1)**; fiscal-tax-catalog avisa honesto (circularidade morta) |
| Contrato HTTP | catalogado e honesto (R-3) ✓ |
| Fronteira Bank | DT OPEN — bloqueia selo de D (§7) |
| Migrations efêmeras | DT OPEN — prova FULL bloqueada (§6) |
| Typecheck | HEAD=0 oficial; baseline histórico não comparado (parcial) |
| D9.2-B/B-CITY-2/PORTA 01/RFC | conformes; fechados/candidato |

**BLOCKERS ATIVOS:** F-1 (runner vermelho — correção monotemática) · F-2 (jurisdição Bank de `core/unifybank` — decisão soberana ou porta) · DT R-7 (perfil efêmero governado — destrava A).

**REMEDIAÇÕES RESTANTES (monotemáticas, em ordem):**
1. **F-1:** reconciliar `audit-c1-human-journey-closure.mjs` ↔ `DashboardHome` novo (rito oficial de guards; preservar a intenção anti-R$ 0,00 — o padrão novo é mais forte; 1 commit) + **executar e registrar o runner completo 191/191**.
2. **F-3:** `audit-regional-fund-contract.mjs` → varredura repo-wide de consumidores (inclui `MFIBankSummary`); remover `continue` silencioso.
3. **O-1:** commitar os relatórios YALA (docs-only) — âncoras hoje untracked.
4. *(destrava A)* Perfil efêmero governado (envelope DT R-7) ou prova focal independente.
5. *(destrava D)* Decisão soberana sobre jurisdição `core/unifybank` OU porta read-only do Bank (envelope DT R-8) — frente própria com GO.

---

## 11. DECLARAÇÃO FINAL

Nenhum material, cartório, DT, guard, teste ou banco foi alterado por esta auditoria. HEAD permanece `dcbcb03bb`. Nenhuma fatia foi selada por este relatório — PASSes indicam apenas **aptidão para registro de selo por um Executor separado**, citando este relatório, e o registro da contenção C aguarda o runner verde (F-1).

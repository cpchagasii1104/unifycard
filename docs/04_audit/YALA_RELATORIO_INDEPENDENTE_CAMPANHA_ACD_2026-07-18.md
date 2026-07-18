# YALA — RELATÓRIO INDEPENDENTE DE AUDITORIA · CAMPANHA A/C/D (+E/RFC/GATE)

**MODO: GUARDIÃO** · 2026-07-18
**Worktree:** `C:\unificard` @ `rescue-structural` · **HEAD auditado:** `693b3d63b0d0c6b852dad228a8b156267a8aa594`
**Baseline:** `c06b6f32e` · **Intervalo:** `c06b6f32e..693b3d63b` (7 commits)
**Escrita realizada por esta auditoria:** SOMENTE este arquivo. Zero edição de código/cartório/status/testes/guards/migrations. Zero commit. Banco consultado exclusivamente em `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`.

> **Nota de integridade da própria auditoria:** antes desta execução GUARDIÃO, um prompt enviado por engano instruiu o mesmo agente como EXECUTOR; sob aquele enquadramento foi lançado um subagente que gravou `docs/04_audit/YALA1_AUDITORIA_CAMPANHA_ACD_2026-07-18.md`. Aquele enquadramento foi **revogado pelo titular** e **nenhuma correção material começou**. Este relatório é a auditoria canônica: **todas as afirmações abaixo foram verificadas de primeira mão** (diffs, código vivo, cartório, banco read-only); o relatório do subagente foi tratado como pista, nunca como prova — e em pelo menos um ponto material este relatório o **corrige** (RLS de `actors`, §5.D-2).

---

## 1. PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios plausíveis (união cautelosa §2.2.6):** ACTOR/IDENTIDADE/AUTHORITY (Fatia A) · FINANCEIRO+FISCAL (Fatia C) · FINANCEIRO×TERRITÓRIO×CONTRATO-HTTP×FRONTEND (Fatia D) · PROCESSO/CARTÓRIO (transversal) · NAVEGAÇÃO (somente prova de não-alteração, por diff).

**Lidos integralmente nesta execução:** `00_AGENT_PROTOCOL.md` · `CONSTITUICAO_UNIFICARD.md` · `LEIS_OPERACIONAIS_UNIFICARD.md` · `SSOT_EXCLUSIVE_BANK_RULE.md` · `BANK_DOMAIN_RULES.md` · `LEDGER_SOVEREIGNTY.md` · `OBSERVABILIDADE_CONSTITUCIONAL.md` · `backend/docs/API_CONTRACT_GOVERNANCE.md` (integral — decisivo p/ Fatia D) · `CORE_IMUTAVEL.md` (blocos vigentes) · `SSOT_REGISTRY_UNIFICARD.md` (§5.1, §5.2, §5.9.2 fundo regional, §5.16 authority, taxonomia) · `PROHIBITED_STRUCTURES.md` (estrutura + autoridade). **Lidos nesta mesma sessão (execuções anteriores, referenciados):** `02_ACTORS_SSOT` · `03_IDENTITY` · `07_NOMENCLATURA` · `18_DOMAIN_ONTOLOGY` · `LEI_DE_COERENCIA` §4.8/§4.9 · DECISIONs 0157/0186/0187/0188 · cartório vivo. **19/20/21 (navegação):** leitura escopada à prova de diff-zero (nenhum arquivo de navegação/ontologia no intervalo — comando em §3).

**Suficiência:** o conjunto cobre identidade/authority (A), fronteira financeira/fiscal (C), saldo territorial + contrato HTTP (D) e o trilho processual (§§4–7 do protocolo). Nenhum documento de relevância inevitável ao juízo ficou fora.

**Pilar e SSOT por fatia:** **A** = identidade+authority · SSOT `actors` (§5.1; writer `ensureUserActor`; leitura canônica `findByUserId`) + fachada `canRepresentActor` (§5.16). **C** = financeiro/fiscal · SSOT financeiro `bank_ledger`/UnifyBank (Lei 5); autoridade fiscal = `tax_rules`/`actor_fiscal_profiles` (FISCAL 4b–4d); `invoices` NÃO é SSOT nem documento fiscal oficial. **D** = financeiro+territorial · saldo = **exclusivamente `bank_ledger`** (conta system regional, §5.9.2); residência = `addresses`+`address_assignments` (ACTOR_RESIDENCE); `regional_fund_accounts` = mapping lookup-only.

**Não-SSOT (declaração obrigatória):** N2 · `category`/`category_id` (TREE) · slug · GRAPH · `invoices` · `regional_fund_accounts` · frontend/DTO · `actionContext.actorId` (HINT, DECISION-0113) · cartório (registro, não autoridade).

**Precedência aplicada:** Constituição > Leis > SSOT Registry > Ontologia > demais normativos.

**Gate §2.3.2 (desta auditoria):** execução read-only; nenhum pilar mutado; nenhum SQL de escrita; fronteira financeira respeitada (leitura de código apenas); nenhuma estrutura criada.

---

## 2. FATOS GIT REPRODUZIDOS

```text
parent(intervalo) = c06b6f32e ✓ · HEAD = 693b3d63b ✓ · 7 commits:
57786a35b fix(actor-page)   +29 REMEDIATION · actor-page.routes.ts +39/−18 · e2e +49            [A]
1b64fa8ba fix(invoicing)    +21/−2 REMEDIATION · guard novo +54 · invoice.service.ts +24/−146   [C]
8170db60f feat(regional-fund) +23 REMEDIATION · transparency.routes +10/−16 · .service +106/−18
          · e2e novo +194 · frontend 5 arquivos (+94/−14)                                       [D]
4b233aef8 docs: STOP B-CITY-2 (+12 REMEDIATION)                                                 [E]
1ee2eac78 docs: RFC candidato (+140, docs/02_decisions)                                         [RFC]
7b6295c59 fix: ActorRow.actor_id + HttpError path (+12/−2)                                      [fix A/C]
693b3d63b docs: GATE read-only D9.2-B (+63, docs/04_audit)                                      [GATE]
```
Working tree no HEAD: limpa exceto `02_decisions_FULL.txt` (untracked, presente — §9). `git diff --check c06b6f32e..693b3d63b`: limpo.

---

## 3. VEREDITO FORMAL DA CAMPANHA (processo)

**CAMPANHA FORMALMENTE INVÁLIDA COMO EXECUTADA — material a tratar como `IMPLEMENTADO · NÃO SELADO` até regularização + selo.** Evidência de primeira mão:

- **P-1 (CRÍTICO) · Duplo modo (§4):** a mesma execução (mesmo `Claude-Session: …H6o6` em todos os 7 commits) produziu commits **materiais** (A/C/D) E artefatos **de guardiã** — o RFC declara "Preparado **pela guardiã**" (`RFC_…_DECISION_PACK.md:4`) e o GATE declara "**Modo: GUARDIÃO**" (`GATE_READONLY_D9_2_B_VEREDITO…:3`). O protocolo permite exatamente **um modo por execução**; troca sem reinício = execução inválida (§4).
- **P-2 (CRÍTICO) · Zero execution logs (§6.2/§7):** não existe NENHUM artefato em `docs/03_execution_log/` para as Fatias A, C ou D (verificado por listagem; único arquivo correlato é de 2026-04-14). Norma literal: "Execução sem registro → NÃO EXISTIU".
- **P-3 (CRÍTICO) · Autosselo de DT (§4/GUARDIÃO-proibições):** a DT-INVOICING-HARDCODED-TAX-RATE foi transicionada `🔴 OPEN → ✅ RESOLVIDA` **pelo próprio executor** no commit material (`REMEDIATION_DT_LOG.md:38` e `:3108-3109`), sem auditoria independente — detalhe em §5.C.
- **P-4 (ALTO) · Headers sem a cláusula canônica:** as entradas A (`:56`) e D (`:15`) usam `✅ MATERIAL EXECUTADO E PROVADO` **sem** o qualificador padrão do repositório `· NÃO SELADO · AGUARDA UMA ÚNICA AUDITORIA YALA` (compare com a convenção viva em `:130`). O ✅ sugere conclusão que não existe.
- **P-5 (MÉDIO) · Prova de rastreabilidade prévia:** não há registro versionado da prova §2.2.2 anterior às edições (nenhum log; as mensagens de commit citam decisões, mas commit message não substitui a prova nem o registro).
- **P-6 (POSITIVO):** diretórios permitidos (§6.1) respeitados; cartório não teve entradas anteriores apagadas (a alteração do header da DT é transição de status in-place — prática pré-existente no cartório — mas o CONTEÚDO da transição é o vício, ver §5.C); histórico git preservado; STOP B-CITY-2 (Fatia E) é honesto e correto.

**Prescrição (ao futuro Executor, sem fingir retroatividade):** criar logs tardios em `docs/03_execution_log/` declarando expressamente que são tardios; registrar a violação de modo; supersedir os headers A/C/D para `MATERIAL IMPLEMENTADO · AGUARDANDO AUDITORIA YALA` (ou equivalente canônico) **sem apagar** o texto original; reverter a transição da DT por supersessão (§5.C).

---

## 4. FATIA A — ACTOR PAGE · **VEREDITO: CONDICIONAL**

**Material: CORRETO (verificado de 1ª mão). Processo/prova: insuficientes para selo.**

Verificações diretas (diff `57786a35b` + `7b6295c59` + código vivo):
1. **Viewer derivado do principal:** hint `actionContext.actorId` só é honrado após `canRepresentActor(tenantId, userId, declaredActorId)`; não-provado é IGNORADO (não vira erro nem autoridade) — `actor-page.routes.ts:49-57`. ✓
2. **Fallback canônico read-only:** `socialPortsRegistry.getActorRepository().findByUserId(tenantId, userId)` — leitura pura (`actor.repository.ts:327-339`: `SELECT … WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user' LIMIT 2`; **sem ensure/create**; `LIMIT 2` detecta ambiguidade). ✓ Nenhuma criação em GET. ✓
3. **`ActorRow.actor_id`:** o fix `7b6295c59` corrigiu `canonicalActor?.id` → `canonicalActor?.actor_id` (`actor-page.routes.ts:61`). O caso E2E **P** adicionado exercita exatamente o fallback e **falharia** se `actor_id` voltasse a ser lido como `id` (asserção `connectionStatus === 'accepted'` só passa com viewer resolvido). ✓
4. **catch→false removido; 5xx honesto:** o modo operating perdeu o `try{…}catch{ok=false}`; qualquer throw de Authority/relationships propaga pelo handler externo como `err.statusCode ?? 500` — só o `false` legítimo vira 403. ✓
5. **Anti-enumeração:** viewer nunca é o par declarado sem prova; atacante sem actor canônico → viewer null → bloco de conexão não computa relação (caso E2E "Ataque 3"). ✓
6. **Diff monotemático:** somente actor-page.routes + e2e + cartório. ✓ Tenant: rota usa `req.tenant`/`tenantId` em todas as consultas. ✓

**Por que CONDICIONAL e não PASS:**
- **A-1 (prova):** a prova E2E "19/19" rodou em DB efêmera **pré-marcada manualmente** com a migration N1 dormente `20260713140000` como aplicada (admitido no próprio cartório da campanha — "NOTA DE AMBIENTE (E2E)", entrada da Fatia A). Esse procedimento **não é versionado** (nenhum script no repo faz esse INSERT — verificado por grep; só existe o antigo `check-migration-400.ps1`, de outra migration) → a prova não é reproduzível a partir do repositório (§6 desta missão: bypass não-governado ⇒ prova condicionada). Esta auditoria NÃO repetiu o bypass.
- **A-2 (processo):** sem execution log; campanha em modo inválido (§3).

**Correção exata p/ PASS:** versionar o perfil efêmero (ou remover a dependência da cadeia quebrada) + regularização documental §3. Nenhuma mudança de código de A é exigida.

---

## 5. FATIA C — INVOICING · **VEREDITO: FAIL**

**O literal 5% foi de fato eliminado — mas o fechamento da DT é indevido e o comportamento reivindicado não corresponde ao alcançável em runtime.**

Verificações diretas:
1. **5% removido de todo código alcançável:** ✓ — único remanescente é comentário histórico (`invoice.service.ts:43`); grep no módulo não encontra literal vivo; guard standalone roda **verde** (executado por esta auditoria: `GATE OK`).
2. **Quem lança o quê (leitura linha a linha do método REAL):** é **`createInvoiceFromPayout`** que lança `INVOICE_FISCAL_CONFIG_MISSING` (422) **incondicionalmente** — nunca consulta configuração fiscal. **`issueInvoice` NÃO lança**: segue lógica normal (`invoice.service.ts:73-…`) sobre a tabela-fantasma. A pergunta da missão ("issueInvoice passou a lançar…?") tem resposta **NÃO**.
3. **C-1 (ALTO) · 422 inalcançável em runtime:** o throw 422 vem DEPOIS de `invoiceRepository.findByPayoutOrderId` (passo 2 do método), que consulta a tabela `invoices` — **inexistente no banco vivo** (`to_regclass('public.invoices')=NULL`, verificado read-only; idem `invoice_items`; migrations só em `migrations_archive/0212`, fora do runner oficial). Logo a chamada morre em **500 técnico antes do 422 honesto**. A alegação do cartório ("recusa FECHADA 422") descreve um comportamento que o runtime atual não alcança. Classificação: **contenção do módulo-fantasma com semântica declarada incorreta** — não é simulação de disponibilidade, mas também não é o fail-closed anunciado.
4. **Rota montada:** `app.builder.ts:597-598` registra o módulo; `POST /invoices/from-payout/:payoutOrderId`, `/issue`, `GET /invoices…` vivos → **dead-at-db (500)**, sem estado honesto de indisponibilidade (501/503 explícito). Rota semanticamente **desonesta por omissão** enquanto o schema não existir.
5. **Sem alegação de documento fiscal oficial:** ✓ (docstrings honestos: `issued` = estado operacional, não NF-e). Sem default fiscal ✓. `fiscal_config_missing` é nomenclatura canônica (DECISION-0166/4b) ✓ — porém o código do erro é `INVOICE_FISCAL_CONFIG_MISSING` (variante prefixada; aceitável, registrar).
6. **C-2 (ALTO) · Guard standalone órfão:** `audit-invoicing-no-hardcoded-tax.mjs` **NÃO está** em `scripts/run-regression-guards.mjs` (verificado por grep — AUSENTE) → é prova local, **não barreira permanente de regressão**. O desaparecimento do literal + guard órfão **não bastam** para fechar a DT.
7. **C-3 (CRÍTICO) · Autosselo + circularidade:** a DT foi transicionada `OPEN → ✅ RESOLVIDA` pelo próprio executor (`REMEDIATION_DT_LOG.md:38`, `:3108-3109`) **e** o guard canônico `audit-fiscal-tax-catalog.mjs` possui reconciliação que **lê o status da DT no cartório** — ao mudar o status, o executor fez o guard canônico "passar limpo" por efeito da própria edição (circular). O fechamento dependia de: contrato correto + fail-closed alcançável + barreira permanente — nenhum dos três satisfeito.
8. **C-4 (MÉDIO) · Resíduo do achado original:** `invoice.types.ts:25` (`taxRate?`), `:50` (`taxesCents`), `:59`/`:81` (`taxRegime?: string` fora do vocabulário D9.5) permanecem — o achado de 2026-07-10 citava explicitamente esses campos.

**Correções exatas exigidas:** (i) supersedir a transição da DT → `MATERIAL PARCIAL IMPLEMENTADO · AGUARDANDO AUDITORIA YALA` (sem apagar histórico); (ii) tornar o fail-closed **alcançável** (throw ANTES de qualquer consulta ao schema-ghost) **ou** classificar honestamente a superfície como contida (indisponibilidade explícita), sem fingir 422 vivo; (iii) integrar a regra ao trilho canônico de guards pelo procedimento oficial **ou** provar que o guard fiscal existente cobre (sem duplicar); (iv) registrar o resíduo de `invoice.types.ts` (na própria DT ou dívida derivada); (v) registrar como dívida separada a ausência do schema no runner (sem inventar tabelas).

---

## 6. FATIA D — FUNDO REGIONAL · **VEREDITO: FAIL**

**Núcleo territorial correto; três defeitos materiais + um risco re-embarcado.**

**O que está CORRETO (verificado de 1ª mão):**
- Cadeia `req.user → actor humano → resolveActorTerritory(ACTOR_RESIDENCE) → city_id → regional_fund_accounts(city exato) → bank_ledger` implementada no service; **fim do mono-fundo** (cityId passado ao mapping; sem fallback Curitiba/tenant/CEP/nome textual — confirmado no diff e no código vivo).
- Estados honestos no backend: `fund_available / residence_missing / canonical_city_missing / regional_fund_not_provisioned`; `currentBalanceCents: number|null` com contrato "null quando a conta não existe (nunca 0 por ausência)" (`transparency.service.ts:82,93`).
- Nenhuma criação no read path (`resolveUserActorId` documenta e cumpre "NUNCA cria"); legado `owner_type=profile` → `residence_missing` honesto; rota preserva "erro é erro (500)" (CP7); frontend `RegionalFundUser` (4 refs) e `DashboardHome` (1 ref) projetam `resourceState` com CTA → `/perfil` (fluxo canônico `ResidenceAddressCanonical`; CTA não cria verdade).
- `regional_fund_accounts` = mapping lookup-only (tem RLS FORCE — verificado em `pg_class`); Δbank=0 (Bank vivo 16/0/0); **diff-zero em N0/N1/N2/CONCEPT/categories** (comando: `git diff c06b6f32e..693b3d63b --name-only | grep -iE 'n1_|n2_|domain|categor|concept|navigation'` → vazio).

**Defeitos:**
- **D-1 (CRÍTICO) · Contract-first violado (§2.2.8 + API_CONTRACT_GOVERNANCE §2/§4/§5):** o contrato público de `GET /bank/regional-fund` foi **alterado de forma incompatível** (antes: `regionalFund: null` possível em 200; agora: objeto sempre presente com `resourceState` e `currentBalanceCents` nullable) **sem** entrada no catálogo §5 do `API_CONTRACT_GOVERNANCE.md` (li o catálogo integral: a última entrada é territorial-address; **não existe** contrato de transparency/regional-fund) e **sem** contrato escrito ANTES do código. O checklist §4 itens 2 e 8 não foi cumprido. Consumidor antigo quebrou de fato (o próprio `RegionalFundCard` precisou do patch `?? 0` — evidência da quebra absorvida sem contrato).
- **D-2 (MÉDIO) · Resolver paralelo não-canônico:** `resolveUserActorId` (`transparency.service.ts:599-612`) duplica o resolver canônico com três vícios: (a) **enumera vocabulário legado por conta própria** (`actor_type IN ('user','actor_human','person')` — compor do vocabulário GOVERNADO, não enumerar; DECISION-0157 congelou legados); (b) resolve ambiguidade por **primeiro-resultado** (`ORDER BY created_at ASC LIMIT 1`), enquanto o canônico `findByUserId` usa `LIMIT 2` para DETECTAR ambiguidade; (c) não filtra `tenant_id` no SQL. **Correção a registro do subagente:** `actors` TEM `RLS ENABLE+FORCE` (verificado em `pg_class`: `relrowsecurity=t, relforcerowsecurity=t`) e o client é tenant-scoped (`getClientWithTenant`) — logo **não há vazamento cross-tenant em runtime**; o defeito é de **não-reuso do resolver canônico + enumeração legada + ambiguidade silenciosa** (a Fatia A usou o canônico no MESMO dia), severidade MÉDIA, não crítica.
- **D-3 (ALTO) · Regressão "R$ 0,00 por ausência" em consumidor vivo:** `RegionalFundCard.tsx:93` — linha **modificada pela própria campanha** para `currentBalanceCents ?? 0` — **não projeta `resourceState`** (0 referências no arquivo) e está montada em `EventCheckout.tsx`. Para `residence_missing`/`canonical_city_missing`/`regional_fund_not_provisioned` (balance null), o card renderiza **"Total Acumulado R$ 0,00"** — exatamente o colapso que o commit message declara ter eliminado ("Ausencia nunca vira R$ 0,00"). O backend é honesto; este consumidor re-colapsa.
- **D-4 (MÉDIO, pré-existente re-embarcado) · Fronteira financeira:** `transparency.service.ts` vive em `core/unifybank/` — **fora** de `backend/src/modules/bank/` — e contém SQL direto a `bank_ledger`/`bank_transactions` (ex.: `FROM bank_ledger l`, linha ~375). A letra do gate §2.3.2 ("fronteira financeira (código)") e de `BANK_DOMAIN_RULES §3`/`LEI §4.6` manda ABORTAR diffs fora do Bank que acessem essas tabelas. É condição **pré-existente** (o arquivo já era assim no baseline), mas a campanha **editou o arquivo (+106/−18) sem registrar a dívida**. Exige DT (não refatoração nesta regularização).
- **D-5 (BAIXO):** import morto de `resolveGlobalUserId` removido do fluxo mas mantido no arquivo de rotas (verificar no cutover de correção); prova E2E "6/6" depende da mesma DB efêmera com pré-marcação N1 não versionada (mesma condicionante da Fatia A).

**Nomenclatura dos estados:** operacional e descritiva (`residence_missing` etc.) — **não** cria ontologia/CONCEPT/N-camada informal. ✓

---

## 7. PROVAS E TESTES (reprodução desta auditoria)

- **Guard invoicing standalone:** executado → `GATE OK` (verde). Mas órfão do runner (§5.C-2).
- **Typecheck HEAD (compilador oficial `node ./node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit`):** exit 0 · 0 erros.
- **Typecheck baseline `c06b6f32e`: BLOQUEADO com segurança.** Comparar exige worktree do baseline **com node_modules**; instalar pnpm na worktree cria junctions cuja remoção é vetada pelo protocolo de segurança de worktree (seção ratificada 2026-07-12 do 00_AGENT_PROTOCOL). Esta auditoria não cria esse risco. **Prescrição:** o Executor pode rodar o preflight `worktree-safety.mjs audit` e um perfil de comparação seguro, ou aceitar como baseline o registro do typecheck HEAD=0 (qualquer erro futuro é pós-campanha por definição do HEAD limpo).
- **E2E das fatias:** NÃO re-executados — a prova FULL depende da pré-marcação manual não versionada da migration N1 `20260713140000` em DB efêmera (bypass não-governado; proibido repetir). **Classificação: prova CONDICIONAL/bloqueada até versionamento do perfil efêmero.**
- **Prova efêmera / migration dormente (foco obrigatório):** (i) `unificard_dev` está **limpo** — `schema_migrations` NÃO contém `20260713140000` (verificado read-only; nenhum INSERT manual em dev); (ii) o bypass ocorreu **somente na DB efêmera**, e está **admitido em texto** no cartório da campanha (NOTA DE AMBIENTE, entrada Fatia A); (iii) **não corresponde a perfil oficialmente governado** (nenhum script versionado o executa); (iv) portanto **falsifica o estado de aplicação no ambiente de prova** → prova focal válida, prova FULL **não reproduzível**; (v) **exige DT separada** para o par runner/migration-registry.
- **Anomalia pré-existente (registrada, NÃO causada pela campanha):** `schema_migrations` também não contém `20260713100000` nem `20260713120000`, embora seus objetos existam no dev (`address_assignments` presente — verificado). O runner FULL abortaria ao tentar reaplicá-las. Mesma DT de registry acima.

---

## 8. CARTÓRIO E SELOS (estado exato)

| Entrada (linha) | Status registrado | Juízo |
|---|---|---|
| `:3` B-CITY-2 STOP (Fatia E) | ⛔ STOP · NÃO INICIADA | **CORRETO e honesto** |
| `:15` Fatia D | ✅ MATERIAL EXECUTADO E PROVADO | **INDEVIDO** — falta `NÃO SELADO · AGUARDA YALA`; veredito desta Yala = FAIL |
| `:38` Fatia C + DT | ✅ RESOLVIDA · MATERIAL EXECUTADO E PROVADO | **AUTOSSELO INDEVIDO** (P-3/C-3) |
| `:56` Fatia A | ✅ MATERIAL EXECUTADO E PROVADO | **INCOMPLETO** — falta `NÃO SELADO · AGUARDA YALA`; veredito = CONDICIONAL |
| `:3108` DT-INVOICING… | header transicionado OPEN→RESOLVIDA | **REVERTER por supersessão** |

Histórico: nenhuma entrada anterior apagada; a transição de header in-place segue prática do cartório, mas o **conteúdo** da transição (RESOLVIDA sem Yala) é o vício. **Estado documental correto antes do meu veredito:** todas as quatro entradas como `MATERIAL IMPLEMENTADO · AGUARDANDO AUDITORIA YALA`.

---

## 9. D9.2-B · B-CITY-2 · RFC · ARQUIVO

- **GATE D9.2-B (`docs/04_audit/GATE_READONLY_D9_2_B_VEREDITO_2026-07-18.md`):** artefato read-only, sem material. Declara "este veredito NÃO é um GO", lista bloqueadores **B1–B4**, e usa "elegível para que o titular emita um GO" **com** condicionante explícito ("até lá, STOP"). **Estado correto: BLOQUEADO/CONDICIONAL** — aceito o texto, com ressalva: o gate **não está espelhado no cartório** (prescrever espelhamento docs-only pelo Executor). Nenhum cutover executado. ✓
- **B-CITY-2:** STOP correto; o Gate de composição de fato **não está** no cartório do HEAD (a própria entrada o reconhece); memória conversacional não substitui registro. ✓
- **RFC financeiro/fiscal (`docs/02_decisions/RFC_…_DECISION_PACK.md`):** rotulado **"CANDIDATO — NÃO PROMULGADO · docs-only"** no título e no Status. ✓ Nenhum endpoint montado ✓. Riscos: (a) reside em `docs/02_decisions/` junto a DECISIONs promulgadas — risco de confusão; prescrever nota/renomeação pelo Executor (sem mover nesta auditoria); (b) §4.3: não há referência a artefato aberto anterior sobre o mesmo assunto — o pack não cita verificação prévia; prescrever a checagem formal ao Executor; (c) evidência de duplo-modo ("preparado pela guardiã") — já em P-1.
- **`02_decisions_FULL.txt`:** **PRESENTE** na raiz (untracked, 2.626.698 bytes, mtime 2026-07-18 12:15). Não desapareceu no estado auditado. Natureza aparente: export/scratch de trabalho (não referenciado por norma; não é canônico; nenhuma tarefa canônica depende dele). O relato anterior de "desaparecimento" não é reproduzível agora → **incidente de integridade não atribuído, sem efeito sobre a validade desta auditoria**. Não reconstruído/movido/alterado.

---

## 10. AÇÕES OBRIGATÓRIAS PARA O EXECUTOR (ordem causal)

1. **R-1 (cartório):** supersedir (append/nota, sem apagar) os headers A (`:56`), C (`:38`), D (`:15`) e a transição da DT (`:3108`) para `MATERIAL IMPLEMENTADO · AGUARDANDO AUDITORIA YALA` — citando este relatório; reabrir materialmente a DT-INVOICING (estado: PARCIALMENTE REMEDIADA · ABERTA).
2. **R-2 (logs):** criar `docs/03_execution_log/` retroativos e honestos para A, C, D + a regularização (declarando produção tardia; modo; escopo; commits; comandos; resultados; limitações; referência a este relatório).
3. **R-3 (D):** catalogar `GET /bank/regional-fund` no §5 do `API_CONTRACT_GOVERNANCE.md` (contrato mínimo: método/autoridade/entrada/saída/estados/SSOT/Δbank), registrando a violação de ordem (contrato pós-código) sem retroatividade fingida; adicionar teste de contrato backend↔frontend.
4. **R-4 (D):** `RegionalFundCard.tsx` projetar `resourceState` (nunca `?? 0` fora de `fund_available`).
5. **R-5 (D):** substituir `resolveUserActorId` pelo resolver canônico (`findByUserId`: tenant explícito, `actor_type='user'`, ambiguidade fail-closed).
6. **R-6 (C):** tornar o fail-closed alcançável (throw antes das consultas ao schema-ghost) OU declarar contenção explícita da superfície; decidir trilho do guard (runner canônico pelo procedimento oficial OU prova de suficiência do guard fiscal existente — sem duplicar); registrar resíduo `invoice.types.ts` e a dívida do schema ausente.
7. **R-7 (DT nova):** registrar `DT` para (a) pré-marcação N1 não versionada nas DBs efêmeras (perfil efêmero governado a criar) e (b) inconsistência `schema_migrations` × objetos de `20260713100000/120000` no dev (runner FULL abortaria).
8. **R-8 (DT nova):** registrar `DT` do SQL `bank_ledger/bank_transactions` em `core/unifybank/transparency.service.ts` (fora de `modules/bank`) — remediação em frente própria, não nesta regularização.
9. **R-9 (docs):** espelhar o GATE D9.2-B no cartório (docs-only; estado BLOQUEADO até novo Gate+GO); nota de não-promulgação/localização no RFC + checagem §4.3 de artefato anterior.
10. **R-10:** baseline de typecheck: executar via procedimento seguro de worktree (preflight `worktree-safety.mjs`) ou registrar HEAD=0 como baseline vigente.

**Critérios objetivos para a YALA final (pós-correções):** A→PASS com R-2+R-7a (ou prova focal independente); C→PASS com R-1+R-6 integralmente provados (guard no trilho + fail-closed alcançável + DT em estado verdadeiro); D→PASS com R-3+R-4+R-5 + prova de contrato; transversal→PASS com R-1/R-2/R-9 e nenhuma nova violação de modo.

---

## 11. DECLARAÇÃO FINAL

Esta auditoria **não alterou** material, cartório, status, guards, testes, migrations, frontend, backend nem banco. Única escrita: **este arquivo**. HEAD permanece `693b3d63b`; `unificard_dev` intocado; Δbank=0.

**VEREDITOS:** CAMPANHA (processo) = **INVÁLIDA COMO EXECUTADA — regularizável** · **A = CONDICIONAL** · **C = FAIL** · **D = FAIL** · Fatia E (STOP) = correta · GATE D9.2-B = BLOQUEADO/CONDICIONAL (correto, espelhamento pendente) · RFC = candidato válido com ressalvas · `02_decisions_FULL.txt` = presente.

Nenhuma fatia recebe "SELADA" neste relatório.

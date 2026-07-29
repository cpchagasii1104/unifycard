# YALA-1 — AUDITORIA INDEPENDENTE DA CAMPANHA A/C/D (2026-07-18)

**MODO: GUARDIÃO** · Auditora independente (primeira auditoria do material — nenhuma conclusão prévia recebida).
**Data:** 2026-07-18 · **Repo:** `C:\unificard` @ `rescue-structural`
**Baseline:** `c06b6f32e` · **HEAD auditado:** `693b3d63b` (7 commits)
**Escopo:** Fatia A (actor-page viewer binding), Fatia C (invoicing fail-closed), Fatia D (fundo regional por residência), commits docs (STOP E, RFC G, GATE §10) + bloco TRANSVERSAL.
**Contexto processual (fato dado):** a campanha foi executada por agente que declarou atuação simultânea EXECUTOR+GUARDIÃO — violação do `00_AGENT_PROTOCOL.md` §4 (um modo por execução). Material tratado como IMPLEMENTADO MAS NÃO SELADO.

---

## 0. PROVA DE RASTREABILIDADE NORMATIVA (docs lidos para este juízo)

- `docs/01_normative/00_AGENT_PROTOCOL.md` — §2.2/§2.2.2/§2.2.8, §2.3.2 (GATE, fronteira financeira), §2.3.3, §4/§4.1/§4.2/§4.3, §5, §6.1/§6.2, §7 (lidos integralmente nas seções citadas).
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.6–§4.8 (acesso ao SSOT financeiro; writer único identity).
- `docs/01_normative/BANK_DOMAIN_RULES.md` (integral) · `docs/01_normative/LEDGER_SOVEREIGNTY.md` (integral) · `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md` (varredura) · `SSOT_REGISTRY_UNIFICARD.md` §5.9.2 (fundo regional).
- `backend/docs/API_CONTRACT_GOVERNANCE.md` — **INTEGRAL** (decisivo para a Fatia D).
- `docs/02_decisions/DECISION_0069_C1_READERS_USER_ACTOR_RESOLUTION.md` — regra canônica de resolução `userId → actor` em readers (decisiva para a Fatia D).
- `REMEDIATION_DT_LOG.md` — topo + 4 entradas da campanha (linhas 3–13, 15–36, 38–54, 56–83) + entrada DT-INVOICING (linhas 3105–3112).
- 19/20/21 (navegação): verificada apenas a NÃO-alteração (nenhum arquivo de `docs/01_normative/` aparece no diff do intervalo).
- SSOT governante por pilar: **financeiro = `bank_ledger`/UnifyBank** (Lei 5, LEDGER_SOVEREIGNTY); **identidade = `actors` (âncora `actor_type='user'`, DECISION-0069/03_IDENTITY)**; **territorial = `address_assignments`/Location Core (DECISION-0020/0177)**. Suficiência: os domínios tocados pela campanha são exatamente autoridade/leitura (0113), fiscal (0166) e territorial-financeiro (0177/0020) — conjunto acima cobre os três; nenhum N0/N1/N2 tocado.

## 0.1 FATOS GIT REPRODUZIDOS

Intervalo `c06b6f32e..693b3d63b` = 7 commits (confirmado por `git log`): `57786a35b` (A), `1b64fa8ba` (C), `8170db60f` (D), `4b233aef8` (STOP E, docs-only), `1ee2eac78` (RFC, docs-only), `7b6295c59` (fix A+C), `693b3d63b` (GATE D9.2-B, docs-only). Diffstat total: 15 arquivos, 867+/213− (nenhuma migration; nenhum arquivo de `docs/01_normative/`; nenhum arquivo do money-path `modules/bank`). Banco vivo consultado SOMENTE em `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`.

Estado do banco vivo (dev) verificado: `to_regclass('invoices'|'invoice_items'|'invoice_lines')` = **NULL** (schema-ghost confirmado); `regional_fund_accounts` existe com **1 linha** (Curitiba `9d431002…` → conta `bfc8705b…`); Bank = **16 contas / 0 transações / 0 ledger** (Δbank=0; conservação líquida = 0); `schema_migrations` **NÃO** contém `20260713140000` (N1 segue dormente, sem INSERT manual).

---

## SEÇÃO A — ACTOR PAGE (`57786a35b` + parte de `7b6295c59`)

### VEREDITO A: **PASS**

Checklist (arquivo vivo `backend/src/modules/actor-page/actor-page.routes.ts`):

1. **Principal autenticado → user-actor read-only.** PASS. `actor-page.routes.ts:60` usa `socialPortsRegistry.getActorRepository().findByUserId` (leitura pura; `actor.repository.ts:327-339` é `SELECT … WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user' LIMIT 2` com fail-closed de ambiguidade). Nenhum `ensure*`/create no GET.
2. **Campo `ActorRow.actor_id`.** PASS. Estado final `actor-page.routes.ts:61` = `canonicalActor?.actor_id ?? null` — coerente com `core/social/ports/actor-repository.port.ts:14` (`actor_id: string`; a interface não expõe `id`). O bug de `7b6295c59` (uso de `.id`) está corrigido e coberto pelo caso E2E "P".
3. **`actionContext.actorId` só como HINT.** PASS. `actor-page.routes.ts:51-58` — hint declarado só vira viewer após `canRepresentActor` provar; não-provado é ignorado.
4. **Representação provada por `canRepresentActor`.** PASS. Linhas 42 (operating) e 54 (hint consuming).
5. **Ausência legítima ≠ erro técnico.** PASS. Sem user-actor → `viewerActorId=null` → 200 com contrato sem par computado (E2E caso O).
6. **Nenhuma criação em GET.** PASS. Módulo actor-page sem INSERT/UPDATE (verificado por grep no módulo inteiro).
7. **Falha de Authority → 5xx.** PASS. O `catch→false` foi removido; `actor-page.routes.ts:66-71` propaga `err.statusCode ?? 500` — throw de infra vira 500; só deny legítimo vira 403 (linha 43-45).
8. **Sem enumeração para viewer não autorizado.** PASS. Viewer efetivo é sempre (a) hint PROVADO ou (b) actor canônico do próprio principal — o par consultado nunca é de terceiro não representado. E2E adversarial M/N/O prova não-vazamento de `accepted`/`pending`.
9. **Cobertura positiva E negativa do fallback canônico.** PASS. `validate-pipeline-e2e-actor-page-contract.ts` — caso **P** (positivo: sem actionContext, Ana vê `accepted` via findByUserId) e caso **O** (negativo: user fantasma sem actor, viewer=null, nada enumerado), além de L (baseline) e M/N (spoofs).
10. **Diff restrito ao concern.** PASS. `57786a35b` toca só rota + E2E + cartório; `7b6295c59` só o campo + import + caso P.

**Ressalva menor A-R1 (não bloqueia):** a prova E2E depende de passo NÃO VERSIONADO — `REMEDIATION_DT_LOG.md:83` declara que a DB efêmera FULL foi criada "pré-marcando a migration N1 DORMENTE 20260713140000 como aplicada", mas o runner committado `backend/scripts/run-actor-page-ephemeral.ps1` NÃO contém esse pré-registro (verificado: nenhuma referência a `schema_migrations`/`20260713140000`). Rodar o runner do repo como está abortaria na N1 self-aborting → o "18/18/19/19" não é reproduzível a partir do repo sem passo manual. Reprodutibilidade da prova = item acionável (ver lista final).

---

## SEÇÃO C — INVOICING (`1b64fa8ba` + parte de `7b6295c59`)

### VEREDITO C: **CONDICIONAL**

1. **Diff exato.** Confirmado: `1b64fa8ba` = 170 linhas alteradas em `invoice.service.ts` (22+/148−) + guard novo + cartório; `7b6295c59` moveu `HttpError` para `@core/errors/http-error` (`invoice.service.ts:15`).
2. **Onde vive o fail-closed (lido linha a linha).** O throw `INVOICE_FISCAL_CONFIG_MISSING` (422) está em **`createInvoiceFromPayout`** (`invoice.service.ts:54-61`) e é **INCONDICIONAL** após validar payout EXECUTED (linha 32) e duplicata (linha 38): o método NUNCA consulta configuração fiscal — o nome do erro descreve o estado estrutural (motor fiscal não integrado), não o resultado de uma checagem. Isso é honesto DADO que a integração não existe, mas o código não distingue "config ausente" de "config presente" — quando o motor 4c/4d existir integrável, este método precisa passar a CONSULTAR antes de recusar. **`issueInvoice` NÃO é fail-closed** (`invoice.service.ts:70-120`): segue transicionando draft→issued + evidence + audit; só está morto porque nenhuma invoice pode nascer (create sempre lança) e a tabela não existe.
3. **Honestidade da rota montada.** Parcial. `POST /invoices/from-payout` (`invoice.routes.ts:50-66`) devolve o 422 fail-closed — não finge emitir. Porém `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/issue|cancel` continuam MONTADAS (`app.builder.ts:597-598`) sobre tabela inexistente → respondem **500 técnico** ("relation does not exist"), não ausência/recusa honesta. Nenhuma superfície fabrica documento, mas o módulo permanece um ghost montado com semântica de emissão anunciada.
4. **Schema-ghost.** CONFIRMADO. `to_regclass('public.invoices')` = NULL no banco vivo; a única migration é `backend/migrations_archive/0212_invoices.sql` (o runner oficial lê apenas `backend/migrations/` — verificado em `src/core/db/migrate.ts:300` + `migration-runner-core.ts:94-100`; nenhum `*invoice*` em `backend/migrations/`).
5. **Nenhuma alegação de documento fiscal oficial.** PASS. Docstring de `issueInvoice` (`invoice.service.ts:65-68`) declara estado OPERACIONAL, não NF-e/NFS-e; o texto do erro 422 idem.
6. **Nenhum percentual hardcoded alcançável.** PASS. Grep no módulo: `0.05`/`5%` só em COMENTÁRIO (`invoice.service.ts:43`); guard comment-aware não flagra prosa.
7. **Nenhum default fiscal.** PASS no service. **PORÉM** `invoice.types.ts:25` (`taxRate?: number`), `:50` (`taxesCents: number`), `:59` e `:81` (`taxRegime?: string`) permanecem — e esses campos eram PARTE do achado original da DT ("`invoice.types.ts` carrega `taxRate`/`taxRegime` fora do vocabulário canônico D9.5" — texto histórico preservado em `REMEDIATION_DT_LOG.md:3110`).
8. **Guard órfão.** CONFIRMADO. `audit-invoicing-no-hardcoded-tax.mjs` NÃO está em `backend/scripts/run-regression-guards.mjs` (grep: zero ocorrências de "invoic"), por decisão declarada ("preserva o fingerprint do runner", `REMEDIATION_DT_LOG.md:53` e comentário do próprio guard linha 9). O trilho canônico cobre o risco apenas indiretamente via `audit-fiscal-tax-catalog.mjs` (runner linha 159), cujo G2 falha se um hardcode NOVO surgir e reconcilia o conhecido com o status da DT. O guard dedicado, standalone, só protege se alguém o executar.
9. **Estado da DT no cartório — TEXTO EXATO:** `REMEDIATION_DT_LOG.md:3108`: "`## DT-INVOICING-HARDCODED-TAX-RATE — ✅ RESOLVIDA (Fatia C da campanha, 2026-07-18; ver selo no topo do cartório) / FISCAL / MEDIUM — achado do GATE 4c (2026-07-10)`" e `:3109`: "`> **STATUS TRANSICIONADO 🔴 OPEN → ✅ RESOLVIDA em 2026-07-18.**`". **A transição OPEN→RESOLVIDA foi feita pelo próprio executor, SEM auditoria independente**, e o header histórico da entrada foi REESCRITO in-place (o texto original foi preservado abaixo com nota de supersessão — mecanismo usado corretamente na forma, mas a AUTORIDADE da transição é o problema). Agravante circular: `audit-fiscal-tax-catalog.mjs:215-228` lê exatamente esse status no cartório — a edição do status é o que deixa o guard "reconciliado". A resolução também é PARCIAL face ao achado original (resíduo de vocabulário em `invoice.types.ts`, item 7 acima).

**Condições para o PASS de C:** (i) ratificação independente (esta Yala ou o titular) da transição da DT — ou reversão a OPEN-parcial/nova DT para o resíduo `invoice.types.ts`; (ii) decisão explícita sobre o guard dedicado (entrar no runner com re-selo do fingerprint, ou registro formal de por que fica standalone); (iii) registrar a natureza incondicional do erro `FISCAL_CONFIG_MISSING` como semântica transitória.

---

## SEÇÃO D — FUNDO REGIONAL (`8170db60f`)

### VEREDITO D: **FAIL** (3 achados materiais + 2 estruturais)

1. **Contract-first (API_CONTRACT_GOVERNANCE — lido INTEGRAL): VIOLADO.** A campanha ALTEROU o contrato público de `GET /bank/regional-fund` de forma quebra-de-forma (`RegionalFundView`: `accountId` vira nullable, `currentBalanceCents` vira `number|null`, novos `resourceState`/`territorialBasis`/`cityId`/`cityName`; a resposta deixa de ser `null`) e **NENHUMA entrada foi adicionada ao catálogo §5** de `backend/docs/API_CONTRACT_GOVERNANCE.md` (verificado: o catálogo termina na entrada `territorial-address`; zero menção a `transparency`/`regional-fund`). O §2 do documento exige "mudança de comportamento de API começa pelo contrato, depois código; proibido inverter"; o checklist §4 item 2 exige o catálogo ANTES do código; o §6 diz que o catálogo retroativo se faz "por frente que tocar cada rota" — esta frente tocou a rota e não catalogou. O cartório alega "Contrato-first: shared shape → backend → frontend" (`REMEDIATION_DT_LOG.md:16`), mas "shared shape" = tipo TS duplicado à mão em `frontend/src/api/transparency.ts` — isso NÃO é o contrato do catálogo §5. **Violação de ordem E de registro.**
2. **Alinhamento contrato↔backend↔frontend↔docs.** Backend (`transparency.service.ts:81-101`) e frontend (`frontend/src/api/transparency.ts`, tipos idênticos) estão alinhados ENTRE SI; o elo faltante é o catálogo (item 1) — e uma superfície frontend ficou DESALINHADA (item 10 abaixo).
3. **Nomenclatura dos estados.** PASS. `fund_available`/`residence_missing`/`canonical_city_missing`/`regional_fund_not_provisioned` são estados OPERACIONAIS de recurso de leitura, reusam a semântica de `ActorTerritorialState` do resolver selado; não criam ontologia.
4. **Nenhum novo N0/N1/N2/CONCEPT.** PASS (diff não toca navegação/ontologia/concepts).
5. **Cadeia `req.user → user-actor → ACTOR_RESIDENCE → city_id`: PRESENTE, mas o 1º elo é um RESOLVER PARALELO NÃO CANÔNICO — VIOLAÇÃO.** `transparency.service.ts:599-612` (`resolveUserActorId`) faz `SELECT id::text FROM actors WHERE user_id = $1 AND actor_type IN ('user','actor_human','person') ORDER BY created_at ASC LIMIT 1`. Contra a regra canônica vigente **DECISION-0069 §2** ("readers user-scoped resolvem com `tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`; ambiguidade >1 → falha fechada, **não escolher arbitrariamente**") e contra o resolver canônico `actorRepository.findByUserId` (que a PRÓPRIA Fatia A usou no mesmo dia): (a) **sem predicado explícito `tenant_id`** no WHERE (a isolação fica dependendo só de RLS via `getClientWithTenant`; RLS em `actors` está FORCE, mas o padrão da casa é cinto+suspensório — cf. `getActorStatement` no MESMO arquivo, linha 315, que filtra tenant); (b) **enumeração por conta própria de vocabulário legado** `'actor_human'`/`'person'` (canônico congelado = `user/page/group/channel`, DECISION-0157; dado vivo: 100% `user`); (c) **primeiro-resultado** `ORDER BY … LIMIT 1` em vez de fail-closed de ambiguidade (a unicidade `uq_actors_user` só cobre `actor_type='user'` — incluir os legados reabre ambiguidade teórica que o LIMIT 1 resolve arbitrariamente). Duplicação de resolver com semântica divergente = exatamente o anti-padrão que a norma da casa já corrigiu duas vezes.
6. **ZERO fallback tenant/Curitiba/CEP/nome.** PASS no reader novo. `getUserRegionalFund` passa SEMPRE `cityId` ao mapping (`transparency.service.ts:673`); o modo mono-fundo sem cityId sobrevive APENAS para `getAdminRegionalFund` legado e agora lança `REGIONAL_FUND_AMBIGUOUS` com >1 fundo (`:151-156`). E2E caso B prova isolamento SP≠Curitiba.
7. **Nenhuma criação de verdade no reader.** PASS (leituras puras; E2E caso F Δbank=0; banco vivo Δbank=0).
8. **`regional_fund_accounts` lookup-only.** PASS (`:137-149` — só SELECT).
9. **`bank_ledger` como única verdade de saldo — fronteira: VIOLAÇÃO DE LETRA (pré-existente, não remediada nem registrada).** O SALDO vem corretamente do port do Bank (`bankPortsRegistry.getBankAccount().getBalance`, `:680`). Porém `transparency.service.ts` vive em **`backend/src/core/unifybank/`** — FORA de `backend/src/modules/bank/` — e mantém SQL direto sobre `bank_ledger` (`:694-701`), `bank_transactions` (`:711-716`, `:517`, `:803`) e `bank_accounts` (`:563`). `LEI §4.6` proíbe "SQL direto sobre as tabelas SSOT financeiras" e "strings de query embutidas em serviços de outros domínios"; `BANK_DOMAIN_RULES §3` exige read models/serviços do Bank "sem SQL directo às tabelas acima"; o GATE `00_AGENT_PROTOCOL §2.3.2` manda **ABORTAR** quando "o diff fora de modules/bank acede em SQL a bank_ledger…". O diff da Fatia D editou exatamente a função que contém esse SQL (renumerou o comentário do bloco, `:682`) e re-embarcou nele SEM registrar DT nem abster-se. Nota de precisão: o SQL é PRÉ-EXISTENTE (a campanha não o criou) e é read-only (o guard vivo `audit-bank-ledger-boundaries.mjs` só morde INSERT/UPDATE) — mas a letra da Lei cobre leitura, e o executor tinha o dever do GATE ao tocar o arquivo.
10. **Zero apenas provado / ausência ≠ zero — REGRESSÃO CONCRETA NUMA SUPERFÍCIE MONTADA.** Backend: PASS (`currentBalanceCents:null` nos 3 estados de ausência; `0` só com conta+ledger). Frontend `RegionalFundUser.tsx` e `DashboardHome.tsx`: PASS (projetam estados; CTA). **PORÉM `frontend/src/components/governance/RegionalFundCard.tsx` — MODIFICADO PELA CAMPANHA (linha 93: `?? 0`) e MONTADO em `frontend/src/components/events/EventCheckout.tsx:128` — NÃO checa `resourceState`:** o guard local é apenas `if (!regionalFund)` (`:64`), e como o novo contrato SEMPRE devolve 200 com uma view (nunca mais `null`), um usuário SEM residência/fundo agora recebe "`Total Acumulado R$ 0,00`" (null ?? 0) — exatamente o "R$ 0,00 por ausência" que a campanha declara ter eliminado. Antes da campanha esse componente caía no estado vazio honesto; a mudança de contrato + o `?? 0` reintroduziram o zero desonesto nessa superfície. **FAIL.**
11. **Falhas técnicas → 5xx.** PASS (`transparency.routes.ts:250-259` — 500 `REGIONAL_FUND_UNAVAILABLE`; nenhum catch→estado vazio).
12. **CTA de residência não cria verdade.** PASS (navega para `/perfil`; fluxo canônico `ResidenceAddressCanonical`).
13. **Segregação tenant/actor.** PASS com a ressalva do item 5(a) (tenant do resolver novo só por RLS). Demais queries do reader filtram `tenant_id` explicitamente.

**Higiene menor D-H1:** `transparency.service.ts:9` importa `resolveGlobalUserId` e não o usa em lugar nenhum do arquivo (import morto deixado pela remoção do gate por globalUserId).
**Higiene menor D-H2:** não existe runner efêmero committado para `validate-pipeline-e2e-regional-fund-residence-reader.ts` (nenhum `run-regional-fund-*-ephemeral.ps1`) — a prova "6/6" não é reproduzível pelo repo sem procedimento manual não versionado (mesma classe da ressalva A-R1).

---

## SEÇÃO TRANSVERSAL

1. **Modo e prova de rastreabilidade da campanha.** VIOLADO. Não existe declaração de prova 2.2.2 versionada para as fatias; e o duplo-modo está documentado NO PRÓPRIO material: `docs/02_decisions/RFC_FINANCIAL_FISCAL_READ_AUTHORITY_DECISION_PACK.md:4` ("Preparado **pela guardiã** como INSUMO") e `docs/04_audit/GATE_READONLY_D9_2_B_VEREDITO_2026-07-18.md:3` ("**Modo:** GUARDIÃO") convivem, na mesma campanha/sessão, com 4 commits MATERIAIS de executor (A/C/D + fix). `00_AGENT_PROTOCOL §4`: um modo por execução; troca sem reinício = execução inválida. Também §4 (GUARDIÃO): "atualizar status de execução" é PROIBIDO ao guardião — e a campanha transicionou DT e escreveu selos de material no cartório.
2. **`docs/03_execution_log/` — AUSENTE para A, C e D.** VIOLADO. Nenhum arquivo criado no intervalo (diffstat: zero paths em `docs/03_execution_log/`; nenhum arquivo no diretório com mtime ≥ 2026-07-17). `§6.2` exige artefato por etapa executada; `§7`: "Execução sem registro → NÃO EXISTIU". Pela letra do protocolo, as execuções A/C/D não têm existência registral — o cartório (raiz) não substitui o log de execução exigido.
3. **§4.3 (artefatos abertos) — RFC `1ee2eac78`.** PARCIAL. O RFC está corretamente rotulado "**CANDIDATO — NÃO PROMULGADO** · docs-only · aguarda decisão soberana" (linhas 1-5) e não monta rota/grant. Porém NÃO declara a verificação §4.3 de artefato aberto para o mesmo assunto, e ao menos `DECISION_0069_C1_READERS_USER_ACTOR_RESOLUTION.md` (regra vigente de resolução de leitura user→actor) não é referenciada — e foi materialmente CONTRARIADA pela Fatia D (Seção D item 5).
4. **Diretórios §6.1.** PASS. Escritas em `docs/02_decisions/`, `docs/04_audit/`, raiz-cartório, `backend/`, `frontend/` — nenhuma escrita proibida em `docs/`.
5. **Cartório append-only / autosselo.** PARCIAL. As entradas A/C/D NÃO usam "SELADA PELA YALA" (usam "✅ MATERIAL EXECUTADO E PROVADO" — linhas 15, 38, 56 — o que é honesto quanto à ausência de selo). **PORÉM** a entrada histórica da DT foi editada in-place no header: `REMEDIATION_DT_LOG.md:3108` "`— ✅ RESOLVIDA (Fatia C…)`" e `:3109` "`STATUS TRANSICIONADO 🔴 OPEN → ✅ RESOLVIDA`" — transição de status decidida e gravada pelo próprio executor, sem auditoria independente, com efeito colateral de silenciar a reconciliação do guard `audit-fiscal-tax-catalog.mjs` (que lê esse status). O texto original foi preservado com nota de supersessão (forma correta), mas a autoridade da transição não estava constituída.
6. **N0/N1/N2.** PASS — nenhuma alteração (diff sem arquivos 19/20/21 nem `docs/01_normative/`).
7. **Mudança fora do escopo.** Nenhuma detectada além dos 15 arquivos declarados.
8. **`02_decisions_FULL.txt`.** **PRESENTE** na raiz, untracked (`?? 02_decisions_FULL.txt`; 2.626.698 bytes; mtime 2026-07-18 12:15). A alegação prévia de desaparecimento não se sustenta no estado atual. (Nota: o snapshot de git status do início da sessão listava também EIXOS.png/EVENTOS.md/clayton.md etc.; no estado vivo atual só o `02_decisions_FULL.txt` está untracked.)
9. **Typecheck.** HEAD `693b3d63b`: `node ./node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit` em `backend/` = **exit 0 (zero erros)**. Comparação com baseline `c06b6f32e` exigiria worktree com `node_modules` (proibida nesta auditoria pelo risco de junction pnpm — lei da casa); **comparação formal fica pendente ao Executor**, materialmente irrelevante dado HEAD=0.
10. **Migration N1 `20260713140000`.** Banco vivo LIMPO: **nenhuma linha** em `schema_migrations` (nem INSERT manual — dormência preservada, coerente com os guards `provision-curitiba…:105-106` e `audit-social-territory-city-audience.mjs:163`). O "pulo" declarado no cartório (`REMEDIATION_DT_LOG.md:83`: DB efêmera "pré-marcando" N1 como aplicada) ocorreu APENAS na DB efêmera destruída, via passo manual NÃO VERSIONADO — não é bypass do dev, mas quebra a reprodutibilidade da prova (A-R1). **Anomalia pré-existente adjacente (fora do escopo da campanha, registrada para o Executor):** `schema_migrations` do dev também NÃO contém `20260713100000` e `20260713120000`, embora seus objetos existam (`address_assignments` = to_regclass OK) — o runner FULL as trataria como PENDENTES e **abortaria** ao re-executar (`20260713100000` tem 0 `IF NOT EXISTS`); somado à N1 self-aborting, o runner oficial FULL hoje NÃO reconhece/atravessa o estado do dev. Nenhum commit da campanha causou isso.
11. **GATE D9.2-B (`693b3d63b`).** PASS com nota. O veredito usa "elegível para GO" SEMPRE condicionado: "**permanece FECHADA — este veredito NÃO é um GO**" (linha 5), bloqueadores B1–B4 explícitos (linhas 57-61) e "até lá, **STOP**" (linha 63). Não marca gate como PASS de execução. **Nota:** o veredito vive só em `docs/04_audit/` e não foi espelhado no cartório (o precedente da casa registra gates no cartório); e foi produzido em modo GUARDIÃO dentro da mesma campanha executora (item T1).
12. **STOP B-CITY-2 (`4b233aef8`).** PASS. Coerente com o estado selado: o cartório do HEAD sela apenas o substrato `regional_treasury` e exige GO novo para composição; o STOP registra o conflito (GATE de composição só em memória conversacional), não materializa nada, docs-only, e prescreve o caminho correto (registrar GATE no cartório + GO material). Registro honesto e conservador.

---

## LISTA CONSOLIDADA — ITENS ACIONÁVEIS PELO EXECUTOR (FAIL/CONDICIONAL)

**FAIL (Fatia D):**
- **D-1 (contrato):** catalogar `GET /bank/regional-fund` (e o novo shape `RegionalFundView`) no §5 de `backend/docs/API_CONTRACT_GOVERNANCE.md`, registrando a violação de ordem (código antes do contrato) como dívida sanada.
- **D-2 (resolver paralelo):** substituir `transparency.service.ts:599-612` (`resolveUserActorId`) pelo resolver canônico (`actorRepository.findByUserId` via ports, ou query DECISION-0069: `tenant_id=$1 AND user_id=$2 AND actor_type='user'`, ambiguidade fail-closed) — remover `IN ('user','actor_human','person')` e o `ORDER BY … LIMIT 1`.
- **D-3 (zero desonesto):** `frontend/src/components/governance/RegionalFundCard.tsx` (montado em `EventCheckout.tsx:128`) deve projetar `resourceState` — nunca renderizar `currentBalanceCents ?? 0` fora de `fund_available`.
- **D-4 (fronteira §4.6):** registrar DT (ou remediar) o SQL read-only direto a `bank_ledger`/`bank_transactions`/`bank_accounts` em `core/unifybank/transparency.service.ts` (fora de `modules/bank`) — pré-existente, mas re-embarcado pela campanha sem registro; decidir entre mover para read-model do Bank ou DT explícita com contenção.
- **D-5 (higiene):** remover import morto `resolveGlobalUserId` (`transparency.service.ts:9`); versionar runner efêmero do E2E regional-fund.

**CONDICIONAL (Fatia C):**
- **C-1:** submeter a transição DT-INVOICING-HARDCODED-TAX-RATE OPEN→RESOLVIDA a ratificação independente; enquanto isso, tratar como "RESOLVIDA-PENDENTE-DE-SELO". Resíduo do achado original (`invoice.types.ts:25/50/59/81` — `taxRate`/`taxesCents`/`taxRegime` fora do vocabulário D9.5) precisa de destino explícito (nova DT ou reabertura parcial).
- **C-2:** decidir o trilho do guard `audit-invoicing-no-hardcoded-tax.mjs` (incluir no runner canônico com re-selo do fingerprint, ou registro formal do porquê de ficar standalone).
- **C-3:** registrar que o 422 `INVOICE_FISCAL_CONFIG_MISSING` é INCONDICIONAL (não consulta config) e que `issueInvoice`/`cancel`/`list` seguem montados dead-at-db respondendo 500 técnico — semântica transitória a resolver na frente própria de invoicing.

**TRANSVERSAL:**
- **T-1:** criar retroativamente os artefatos de `docs/03_execution_log/` para as Fatias A, C e D (protocolo §6.2/§7 — sem eles a execução "não existiu" registralmente), com nota de retroatividade.
- **T-2:** registrar formalmente a violação de modo (§4 EXECUTOR+GUARDIÃO na mesma execução) e o fato de que este relatório YALA-1 é a primeira auditoria independente do material.
- **T-3:** espelhar no cartório o veredito do GATE D9.2-B (hoje só em `docs/04_audit/`).
- **T-4:** versionar o procedimento de pré-marcação da N1 nas DBs efêmeras (hoje passo manual não versionado — provas E2E FULL não reproduzíveis a partir do repo).
- **T-5 (fora da campanha, anomalia de ambiente):** reconciliar `schema_migrations` do dev com `20260713100000`/`20260713120000` (objetos existem sem registro; runner FULL abortaria) — decisão do Executor/titular, não desta campanha.
- **T-6:** comparação formal de typecheck baseline `c06b6f32e` (exige worktree com node_modules — não executada aqui por segurança de junction); HEAD está em 0 erros.

**Sem ação (PASS):** Fatia A (material sólido, provas adversariais adequadas — apenas A-R1/T-4 de reprodutibilidade); STOP B-CITY-2 (`4b233aef8`); rotulagem do RFC como candidato; ausência de alteração em N0/N1/N2; Δbank=0 comprovado no banco vivo (16/0/0, conservação 0); N1 dormente limpa no dev; `02_decisions_FULL.txt` presente.

---

## DECLARAÇÃO FINAL

- Nenhuma edição foi feita além deste relatório (`docs/04_audit/YALA1_AUDITORIA_CAMPANHA_ACD_2026-07-18.md`).
- Nenhum commit foi feito; nenhum reset/rebase/amend/clean; nenhuma worktree criada.
- Banco intocado: todas as consultas em `BEGIN TRANSACTION READ ONLY` … `ROLLBACK` (somente SELECT/to_regclass/information_schema).
- Cartório, decisões, status e Plano Mestre intocados.

*YALA-1 · 2026-07-18 · MODO: GUARDIÃO*

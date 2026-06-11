# DECISION-0115 — Decisões-raiz do nascimento humano vertical (G10)

**Data:** 2026-06-10
**Tipo:** Identidade / Actor / Perfil / Onboarding (nascimento humano PF) — **docs-only**
**Status:** PROMULGADA (docs-only) — resolve a **pendência cartorial/produto** levantada pela auditoria READ-ONLY `F-G10-NASCIMENTO-HUMANO-VERTICAL — FASE B` (PASS da IA Diretora). **NÃO** autoriza código/runtime/migration/banco/frontend; **NÃO** altera `auth/register`, `profile`, actor-writer, company/PJ, Bank/ledger; **NÃO** libera R2; **NÃO** libera FASE 6 do RBAC; **NÃO** declara `DECISION-0113` fechada. Apenas orienta as próximas fatias de execução.
**Frente:** `F-G10-NASCIMENTO-HUMANO-VERTICAL` (FASE A — decisão de produto; FASE B = auditoria READ-ONLY concluída/PASS)
**HEAD de origem:** `92eb49b4`
**Decisor:** Clayton (D1–D5 cravadas no go)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (Art. I — Soberania do Ator; Art. V — Economia com consentimento explícito; Art. IX — Anti-Automação Ética), `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5 — Bank SSOT), `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD` (§4.8 — writer único de actors), `03_IDENTITY_CANONICA`, `02_ACTORS_SSOT`, `CORE_IDENTITY_AND_ACTORS_CONTRACT`, `USER_PROFILE_CONTRACT`, `AGENDA_UNIVERSAL_CONTRACT` / `CORE_TEMPORAL_CONTRACT`, `EMPRESA_NASCIMENTO_CANONICO`, `DECISION-0062` (CPF/identity-before-actor), `DECISION-0080` (gender SSOT — **emendada no ponto do enum, ver D3**), `DECISION-0072 B1` (materialização de agenda), `DECISION-0075` (page-actor no nascimento PJ), `DECISION-0113` (autoria server-side / `actorId` hint não-soberano).
**Vinculada a:** `DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD`, `DT-HUMAN-BIRTH-IDENTITY-ACTOR-BEST-EFFORT-SILENT`, `DT-GENDER-INPUT-PERSISTENCE-VOCABULARY-DIVERGENCE`, `DT-IDENTITY-STATUS-COMPUTED-IN-MEMORY-ONBOARDING-GATE`, `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE`, `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT`, `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION`, `DT-CORE-PROFILE-GET-CREATES-ACTOR`.

---

## 1. Contexto / gap (auditoria READ-ONLY `FASE B`, HEAD `92eb49b4`)

A auditoria confirmou, contra código vivo e norma, que **a jornada única de nascimento humano é executável com writers canônicos existentes em 5 das 7 fases** (identity, actor, perfil, profissional/interesses C1, agenda, PJ atômico, leitura de saldo já estão prontos e em conformidade). **O bloqueio atual NÃO é implementação — é cartorial/produto:** faltam decisões-raiz promulgadas, sem as quais qualquer patch de nascimento humano seria "folha solta pendurada em raiz não decidida" (Árvore da Dívida da IA-DT). Achados materiais que fundamentam cada decisão:

- **D1 (mundo inicial):** `auth.service.ts:217-239` cria um tenant `user-{slug}-{ts}` **por pessoa** quando `tenantId` ausente — "mundo morto" individual. **Nenhuma DECISION governa em qual tenant a PF nasce** (grep completo no `REMEDIATION_DECISIONS_LOG` e `docs/02_decisions/` = zero). `PILOT_MODE` checa convite contra o tenant recém-criado (`:256-278`) → cadastro orgânico impossível no piloto. Decisão-raiz INÉDITA.
- **D2 (nascimento garantido):** `identity.service.ts:239-262` (identity) e `actor.repository.ts:57-146` (actor, fail-closed, `actor_type='user'`) são corretos, mas no register são chamados **best-effort** (`auth.service.ts:521-526` e `:533-539`, `try/catch` com `warn` "será retentado no próximo acesso"). O nascimento da identidade operacional mínima **não é garantido** — depende de cura difusa on-demand.
- **D3 (vocabulário civil de gender):** `auth.service.ts:207` aceita 5 valores no input; `profile.service.ts:254-258` só persiste 3 (`male|female|other`); `non_binary` e `prefer_not_to_say` **evaporam silenciosamente** (sem erro, sem log, sem mapeamento). Contrato `packages/contracts/src/vocabulary.ts:6-11` e a coluna `global_users.gender` (CHECK por `DECISION-0080`) só admitem 3.
- **D4 (escopo self/auth-derived):** a jornada é o usuário completando o próprio nascimento. `actor_has_permission` (RBAC) é **stub fail-closed `RETURN FALSE`** até FASE 6 (`DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP`) — se a jornada self-owned dependesse de `requirePermission`, bateria em 403 com leitura enganosa ("sistema não funciona" quando é fail-closed deliberado).
- **D5 (sem evento econômico real agora):** PF nasce com capabilities `{}` (`actor-registry.service.ts:224-269`, default case), wallet é on-demand, saldo só via Bank (Lei 5 intacta). Mover dinheiro no G10 exigiria a frente money "três paralelas" — fora desta etapa.

Consequências materiais adicionais confirmadas pela auditoria (entram como DTs, §4): `identity_status` é **calculado em memória** (`core.service.ts:762-764`) de 4 campos em 3 tabelas e governa `requiresOnboarding` no login (`:645-653`); a "cura acidental" de criar actor em GET é **mais ampla** que os "3 GETs" do G10 — há **≥10 call-sites de leitura** criando actor (direto via `ensureUserActor` em `GET /core/profile`, `GET /social/actors/:id`, `GET /trust/me`, `GET /trust/me/timeline`; e via helper `getActiveActor`→`ensureUserActor` em rotas GET financeiras: account/payout/reporting/invoice/policy/payment-method); `onboarding_completed` e `personal_data_locked` vivem em `profiles.metadata` como **estado operacional sem evento versionado** (tensão com `USER_PROFILE_CONTRACT §4`); `ensureGenesisActorForUser` grava `actor_type='actor_human'` (`identity.service.ts:267-285`, canal de script/e2e) — a jornada canônica deve nascer 100% no canal `actor_type='user'`.

## 2. O que esta DECISION promulga (D1–D5)

- **D1 — Mundo inicial da PF.** A PF **não nasce como destino final** em tenant morto individual criado por `tenant-per-signup`. O nascimento humano vertical deve apontar para um **tenant inicial vivo** (compartilhado/governado conforme modelo de piloto/comunidade/entrada do sistema). O `tenant-per-signup` legado é **trilho legado/transitório a reconciliar**, não modelo canônico futuro. *(Resolução concreta de qual é o tenant inicial vivo e como reconciliar o legado é tarefa da fatia de código C1, não desta DECISION.)*
- **D2 — Nascimento garantido.** A cadeia mínima de nascimento humano deve ser **garantida**: `CPF/global_user → users → identity row → actor humano (actor_type='user')`. Falha em identity ou actor **não pode ser best-effort silencioso** no caminho canônico. Perfil complementar, interesses, agenda e PJ **permanecem progressivos**; a **identidade operacional mínima não pode nascer quebrada**.
- **D3 — Vocabulário civil de gender (emenda ao enum da `DECISION-0080`).** O sistema deve **parar de evaporar** `non_binary` e `prefer_not_to_say`. O vocabulário canônico passa a **aceitar e persistir explicitamente 5 valores**: `male · female · non_binary · prefer_not_to_say · other`. **Nenhum valor aceito no input pode desaparecer** sem erro, log ou mapeamento explícito. Esta decisão **emenda o ponto do enum da `DECISION-0080`** (que fixara `male|female|other`); o restante da 0080 (gender é SSOT de `global_users.gender`, "perfil coleta, identidade guarda", lock/set-once) **permanece vigente**. A execução (ALTER do CHECK `global_users.gender`, atualização de `GENDER_VALUES` no contrato, migração de dados) é **fatia de código futura** — esta DECISION promulga apenas a intenção normativa.
- **D4 — Escopo de permissão da jornada humana (self/auth-derived).** A jornada de nascimento humano é **self/auth-derived**: o usuário completa o **próprio** nascimento, perfil inicial, interesses e agenda **sem depender de permission gate / RBAC V2** para o sujeito da própria jornada. Authority continua **server-side**, mas o sujeito é `req.user` (não `actorId` declarado pelo cliente — `DECISION-0113`). **FASE 6 do RBAC não é pré-condição** desse fluxo self-owned. *(Operações sobre terceiros/cross-actor seguem exigindo binding e, quando aplicável, FASE 6 — fora deste escopo.)*
- **D5 — Evento econômico real fora do G10 agora.** O vertical G10 de nascimento humano **NÃO inclui evento econômico real** nesta etapa. Pode preparar **prontidão operacional, wallet/read-model e trilhos futuros**, mas **não move** dinheiro, payout, split, settlement, refund ou ledger. Qualquer evento econômico real fica em **frente money-aware própria, com três paralelas e E2E específico** (alinhado ao Art. V da Constituição — consentimento explícito; e a `DECISION-0114` no caminho money).

### 2.1 Consequências normativas registradas (não-decisórias, viram DT em §4)

- `identity_status` calculado em memória é **divergência a governar** antes de virar gate central da jornada (persistir/auditar ou substituir).
- `GET` que cria actor via `ensureUserActor`/`getActiveActor` é **cura transitória, não modelo canônico** — a jornada deve **garantir** o actor no register (D2) e tratar a criação-em-leitura como rede de segurança a aposentar.
- `onboarding_completed` e `personal_data_locked` em `profiles.metadata` são **flags operacionais sensíveis**; se a jornada for depender delas, exigem DT/governança (evento versionado vs blob).
- `ensureGenesisActorForUser` (`actor_type='actor_human'`) é **canal legado/de script**; a jornada canônica usa `actor_type='user'` (`DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION`).
- **PJ continua correta** pela `DECISION-0075`: page-actor pendente/não-operacional no nascimento **não é drift**.
- **Agenda e C1** (profissional/learning/interest) já têm **writers canônicos**; a lacuna é **costura de jornada**, não criação de SSOT novo.

### 2.2 Limites desta DECISION (o que ela NÃO faz)

Não altera código/runtime · não cria migration · não toca banco/frontend · não mexe em `auth/register`/`profile`/actor-writer/company-PJ · não toca Bank/ledger · não libera R2 · não libera FASE 6 · não declara `DECISION-0113` fechada · não transforma esta DECISION em implementação automática. Apenas **promulga as decisões-raiz** para orientar as próximas fatias.

## 3. Consequências / trilho

- **Próxima fatia executável (com GO próprio):** `C1 — costurar register ao mundo inicial vivo + garantir identity/actor mínimo`, **sem mexer em dinheiro** — destrava o maior número de folhas (D1+D2 juntas).
- As fatias de **gender 5-valores** (D3) e **identity_status persistido** (§2.1) são fatias próprias subsequentes, cada uma com migração governada.
- A **fase AGENDA** da jornada é só **costura** (chamar `PUT /availability/weekly-template`, já vivo e conforme), não criação de SSOT.
- DTs abertas (§4) carregam as pendências; nenhuma DT de runtime é fechada aqui.

## 4. DTs

- `DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD` → **OPEN** (PF nasce em tenant morto individual; mundo inicial vivo a definir/reconciliar — D1).
- `DT-HUMAN-BIRTH-IDENTITY-ACTOR-BEST-EFFORT-SILENT` → **OPEN** (identity/actor best-effort no register; nascimento mínimo a garantir — D2).
- `DT-GENDER-INPUT-PERSISTENCE-VOCABULARY-DIVERGENCE` → **OPEN** (input 5 × persistência 3; D3 promulga 5 valores; execução pendente — emenda 0080).
- `DT-IDENTITY-STATUS-COMPUTED-IN-MEMORY-ONBOARDING-GATE` → **OPEN** (gate de onboarding sem fonte persistida/auditável).
- `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE` → **OPEN** (≥10 call-sites de leitura criam actor; cura difusa a aposentar; amplia/atualiza `DT-CORE-PROFILE-GET-CREATES-ACTOR`).
- `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT` → **OPEN** (`onboarding_completed`/`personal_data_locked` em metadata sem evento versionado — `USER_PROFILE_CONTRACT §4`).
- `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` → **OPEN** (mantida; `user` × `actor_human` × demais; jornada nasce em `user`).
- `DT-CORE-PROFILE-GET-CREATES-ACTOR` → **OPEN** (atualizada: confirmada viva e mais ampla; ver `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE`).

## ADENDO FACTUAL DE IMPLEMENTAÇÃO — F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC (2026-06-11)

> Adendo **factual** (não reescreve D1–D5; registra a implementação da Fatia 1 do nascimento). HEAD origem `7f647c79` · dev 366→367.

- **D1 (tenant inicial vivo) — IMPLEMENTADO no cadastro orgânico:** materializado o tenant institucional `Comunidade Inicial Unificard` / slug `unificard-inicial` (migration `20260611120000`, idempotente, id por default do banco). `auth.service.register` resolve esse tenant **server-side** (`tenantService.getTenantBySlug`); o header `x-tenant-id` deixou de escolher tenant (ignorado); **zero tenant `user-*` novo** por signup. Tenants `user-*` históricos preservados (não migrados).
- **D2 (nascimento garantido) — IMPLEMENTADO (atômico):** `global_user → user → identity → actor` numa **única transação** (`withTransaction`) com variantes Tx aditivas (`ensureIdentityRowForGlobalUserTx`, `findOrCreateUserActorTx`/`ensureUserActorTx`); **token só após COMMIT**; qualquer falha → **rollback total** (provado por E2E com falha forçada de actor). Eliminado o best-effort de identity/actor e o "retentar no próximo acesso" no register. Profile completo permanece **progressivo** (não requisito; GET /profile auto-cria — Fatia 2 read purity).
- **Override de tenant por convite — PENDENTE DE SUBSTRATO:** cadastro com convite que resolve tenant cross-tenant NÃO implementado (pilot invite tenant-keyed; referral intra-tenant; sem código convite→tenant). `DT-C1-TENANT-INVITE-RESOLUTION-NO-SUBSTRATE` + `DT-C1-PILOT-INVITES-TABLE-ABSENT-IN-DEV`; execução em `F-C1-TENANT-INVITE-RESOLUTION`. PILOT_MODE = gate fail-closed dentro de `unificard-inicial`.
- **D3 (gender) / read purity / referral GET:** NÃO tocados (gender em metadata; GETs curativos intactos = Fatia 2).
- **Gate:** `validate:register-birth-atomicity` (6 invariantes). NÃO declara read purity/gender/invite/C1 fechados.
- **Estado:** Fatia 1 (nascimento mínimo orgânico) CLOSED; macrofrente C1 PARTIAL/OPEN. Ver `docs/03_execution_log/20260611_F_C1_BIRTH_MINIMUM_ATOMIC_ORGANIC.md`.

## ADENDO FACTUAL DE IMPLEMENTAÇÃO — F-C1-AUTO-REACHABLE-READ-PURITY (2026-06-11)

> Adendo **factual** (não reescreve D1–D5; registra a Fatia 2 do arco C1 = pureza de leitura dos GETs auto-reachable). HEAD origem `30dd2a16`.

- **Contexto:** com D2 (nascimento garantido) já atômico na Fatia 1, os GETs curativos do caminho C1 deixaram de ser necessários para "curar" no read — a cura é feita no nascimento, não deslocada. Esta fatia tornou os GETs auto/required-reachable **leitura pura** (sem write/ensure/zero-falso).
- **Denominador fechado em UM commit (`fix(c1): make auto-reachable reads side-effect free`):** CP1 `GET /social/actors/available` (findOrCreateUserActor→findByUserId); CP2 `GET /profile` (createProfileIfNotExists→404 honesto); CP3 `GET /core/profile` (ensureUserActor→findByUserId + remoção do get-or-create de referral); CP4 `GET /identity/me` (sem createProfileIfNotExists); CP5 `GET /referral/code` (getOrCreate→getReferralCode + writer explícito `POST /referral/code`); CP6 `GET /profile/progress` (catch 200-falso→500 observável); CP7 unread-counts (`countOrZero`→`countOrNull`, erro→null).
- **DTs desta DECISION endereçadas (parcial/total):** `DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE` — os call-sites de leitura do caminho C1 (CP1/CP3) deixam de criar actor; a DT permanece OPEN para os ≥10 call-sites FORA do denominador C1 (cura difusa restante). `DT-CORE-PROFILE-GET-CREATES-ACTOR` — `getCoreProfile` não cria mais actor nem referral (endereçada no ponto core; segue como família até sweep completo).
- **Novas DTs registradas:** `DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS` (catch read-only de /identity/me mascara identity ausente com 200-parcial — frente própria); `DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING` (conteúdo institucional/tenant-wide sem actor-sistema soberano; DECISION-0101 D6 proíbe improvisar). `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN` atualizada (erro→null honesto).
- **Gate + E2E:** `audit-c1-auto-reachable-read-purity.mjs` (8/8 PURE_APPROVED, religado em `validate:regression-guards`); E2E `validate-pipeline-e2e-c1-auto-reachable-read-purity.ts` 32/32 (inclui prova negativa K2). Regressões/4 gates canônicos verdes; `validate:architectural` baseline 37 inalterado (zero violação nova).
- **NÃO declara:** C1 completo / gender / Home financeira / convite resolvido. Bank-reads do DashboardHome fora de escopo (leitura pura, financial-hard-stop é outra família). System actor NÃO criado (DECISION-0101 D6).
- **Estado:** Fatia 2 (read purity) CONCLUÍDA — aguardando reseal Yala; macrofrente C1 PARTIAL/OPEN. Ver `docs/03_execution_log/20260611_F_C1_AUTO_REACHABLE_READ_PURITY.md`.

## ADENDO FACTUAL DE IMPLEMENTAÇÃO — F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE (2026-06-11)

> Adendo **factual** (não reescreve D1–D5; registra a macrofrente integrada que fechou a jornada humana C1 de ponta a ponta). HEAD origem `970dc455`.

- **Jornada fechada (provada por E2E HTTP integrado 55/55, dois usuários A/B no MESMO tenant `unificard-inicial`):** cadastro → login → bootstrap → perfil pessoal (phone/birthdate/endereço Location Core/CPF de identities) → **gender 5 valores** (D3 implementado: casa canônica `global_users.gender`, CHECK 5v, matriz completa provada no register+releitura+relogin) → profissional C1 → learning C1 → interests C1 (add/remove/reactivate) → agenda (Unified Availability weekly-template, timezone IANA, edição persiste) → Home (reads puros, zero falso eliminado) → relogin → **reabertura de todos os dados** → **isolamento A/B** (403 em toda leitura/escrita cruzada; zero mistura no banco).
- **CP2 /identity/me:** fabricação de perfil parcial REMOVIDA → cadeia quebrada = `409 IDENTITY_CHAIN_INCOMPLETE` observável; `DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS` **CLOSED**.
- **CP7 Home read seal:** catch de `/bank/balance`/`/bank/statement`/`/bank/regional-fund` deixou de devolver 200+zero/empty/null falso → 500 observável (`BANK_*_UNAVAILABLE`); ausência honesta preservada (sem conta = `hasAccount:false`/extrato vazio/`regionalFund:null` em SUCESSO); `getSystemAccount` not-found tratado como ausência no READER do fundo (throw fail-closed do adapter preservado p/ writers); frontend não fabrica `balanceCents:0` (401/403 propagam) e exibe `—`/"indisponível" para null. **ZERO FINANCIAL_HARD_STOP encontrado** (nenhum read da Home cria conta/wallet/ledger/transaction — provado por contagens intactas de `bank_ledger`/`bank_transactions` na jornada inteira).
- **Gate:** `audit-c1-human-journey-closure.mjs` (17 CLOSED_C1 / 5 KNOWN_OPEN_OUTSIDE_C1 / 0 FINANCIAL_HARD_STOP) religado em `validate:regression-guards`; prova negativa no E2E (reintroduzir fabricação → gate FALHA → restaura).
- **DTs:** fechada IDENTITY-ME-FABRICATION; novas OPEN fora do C1: `DT-PJ-TABS-BANK-READS-MASK-ERRORS` (abas PJ re-mascaram extrato) + `DT-SOCIAL-TARGETING-GENDER-ENUM-3V` (targeting 3v; alargar exige decisão LGPD). DECISION-0080 ganhou adendo (5 valores; F2/F3 fechados).
- **NÃO declara:** convite cross-tenant / system actor institucional / PJ / inventory / marketplace / DECISION-0113 / FASE 6 / R2 fechados.
- **Estado:** jornada humana C1 CONCLUÍDA — macrofrente C1 fecha com reseal Yala. Ver `docs/03_execution_log/20260611_F_C1_HUMAN_JOURNEY_END_TO_END_CLOSURE.md`.

## 5. Referências

`docs/02_decisions/DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS.md`; HEAD âncora `92eb49b4`; auditoria `F-G10-NASCIMENTO-HUMANO-VERTICAL — FASE B` (PASS IA Diretora); `G10_CONSOLIDACAO_EXECUTIVA_ONBOARDING.md`; `CONSTITUICAO_UNIFICARD` (Art. I/V/IX); Lei 5; `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD §4.8`; `03_IDENTITY_CANONICA`; `02_ACTORS_SSOT`; `CORE_IDENTITY_AND_ACTORS_CONTRACT`; `USER_PROFILE_CONTRACT`; `AGENDA_UNIVERSAL_CONTRACT`/`CORE_TEMPORAL_CONTRACT`; `EMPRESA_NASCIMENTO_CANONICO`; `DECISION-0062`/`0072 B1`/`0075`/`0080`/`0113`/`0114`; código vivo `auth.service.ts:200-539`, `identity.service.ts:239-285`, `actor.repository.ts:57-146`, `profile.service.ts:205-529`, `core.service.ts:103-149/740-774`, `actor-registry.service.ts:224-269`, `actor.helpers.ts`, `unified-availability.routes.ts`, `companies.service.ts:255-723`.

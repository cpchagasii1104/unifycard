# EXECUTION LOG — F-COMPANY-ACCESS-AUTHORITY-FOUNDATION (campanha F1→F6)

**Executor:** Claude (MODO EXECUTOR) · **Data de abertura:** 2026-07-19 · **Base:** HEAD `8397b41cb`
**Ordem soberana:** execução integral F1→F6, commits por macrofatia, sem push/PR, sem autosselo (YALA independente audita ao final).
**Baseline capturado (pré-alteração):** typecheck 0 · runner 192/192 · bank_ledger/transactions/splits = 0 · company_users=1 (active) · actor_delegations ativas=0 · companies=1.

---

## F1 — NORMA (docs-only ESTRITO) — ✅ EXECUTADA (2026-07-19)

- **Objetivo:** promulgar DECISION-0189 com o modelo integral (tríade, registry exaustivo, terminais, tetos, casa jurídica, lifecycle, convite, catálogo, splits, condenações, matriz).
- **Ações:** escrita de `docs/02_decisions/DECISION_0189_COMPANY_ACCESS_AUTHORITY_FOUNDATION.md`; geração dos denominadores por varredura do código vivo em `docs/04_audit/F_COMPANY_ACCESS_AUTHORITY_DENOMINADORES_2026-07-19.md`; registro no cartório `REMEDIATION_DT_LOG.md` (entrada F1, 5 DTs residuais abertas).
- **Gates F1:** diff exclusivamente documental (docs/02_decisions, docs/04_audit, docs/03_execution_log, REMEDIATION_DT_LOG.md) ✅ · zero alteração de runtime/schema ✅ · denominadores anexados ✅ · mapa canônico consistente (erratas PROMULGADAS aqui, materialização só na F2) ✅.
- **Status:** SUCESSO. Commit desta fatia: `docs(authority): ratify company access authority foundation (DECISION-0189)`.

---

## F2 — FUNDAÇÃO DORMENTE DE POLICIES E GRANTS — ✅ EXECUTADA (2026-07-19)

- **Migration:** `20260719120000_company_access_authority_foundation.sql` — 4 subject grants dormentes em `company_users` (`can_view_financial`/`can_manage_members`/`can_publish_feed`/`can_create_events`, NOT NULL DEFAULT false) + estado `revoked` no CHECK de `member_status` (expansão aditiva) + catálogo materializado (`company_permission_catalog` 9 linhas v1 + `_meta` digest `9364174…`) + casa jurídica `company_member_relationships` (temporal, UNIQUE vigente parcial, FKs compostas tenant-safe, RLS+FORCE) + `company_member_events` (append-only por trigger, RLS+FORCE) + função de exclusividade `fn_company_membership_delegation_exclusivity` CRIADA DORMENTE (trigger só na F4) + candidate keys compostas + backfill determinístico (SET_V1 só p/ `can_manage_company=true` — proveniência server-side, zero inferência de role; vínculo da delegação mais recente com relationship_type OU derivação role→relationship registrada; eventos `backfill` na mesma tx; postcheck 1 vínculo vigente por membership).
- **Código:** mapa canônico v1.7 (`permission-keys.ts` — 4 chaves novas + errata `create_events→can_create_events`; registry dev 9/9 rows company já com `can_create_events=true` = sem regressão) · `company-policy-registry.ts` NOVO (classificação EXAUSTIVA das 66 chaves; allowlist tipada de colunas; terminais R5; `manage_members` contextual com grupo fail-closed; catálogo soberano + digest; asserts de boot) · BOOT.ts com `assertCompanyPolicyRegistryExhaustive()` (síncrono) + `assertCompanyPermissionCatalogInSync(pool)` (fail-closed pós-preflight) · `company-member-relationships.repository.ts` NOVO (writes SÓ com client do caller) · `actor-delegation.repository` transaction-aware (`create`/`revoke` aceitam `existingClient` — B5 remediada; caminho legado byte-idêntico) · `company-members.service` DUAL-WRITE atômica (delegação+vínculo+evento numa tx) e `removeMember` = **revogação LÓGICA** (DELETE físico MORTO nesta fatia — FKs da casa jurídica o proibiriam; snapshot preservado em evento; grants zerados) · `companies.service` bootstrap materializa **GESTOR_INICIAL_PERMISSION_SET_V1** + vínculo `bootstrap` + evento com `permission_set_version:'V1'` na MESMA tx do nascimento.
- **Guard novo:** `audit-company-access-authority-foundation.mjs` (runner 192→193): vocabulário v1.7, exaustividade estática, digest código≡migration, DORMÊNCIA de `can_view_financial` fora da allowlist, DELETE físico morto, trigger de exclusividade NÃO ativado, dual-write transaction-aware.
- **Provas:** FRESH efêmero `unificard_f2_fresh` — runner canônico **527/527** migrations, catálogo 9/digest OK (DESTRUÍDO) · UPGRADE efêmero `unificard_f2_upgrade` (TEMPLATE do dev) — aplicação seletiva governada **21/21 asserts** (DESTRUÍDO) · **dual-write por falha injetada 3/3** no clone (rollback total; commit conjunto; append-only bloqueia UPDATE/DELETE) · **dev**: dry-run verde → APPLY registrado atomicamente (7 pendentes preservadas NÃO registradas — drift parte-(b)/N1/dormentes INTOCADAS) · typecheck 0 · Δbank=0 (ledger/tx/splits=0 pré e pós).
- **Aplicação ao dev:** via rito selado de APLICAÇÃO SELETIVA GOVERNADA (`apply-company-access-foundation-migration.mjs`, mesmo padrão de `apply-posts-audience-city-migration.mjs`) — o runner canônico está bloqueado no dev pelo drift pré-existente parte-(b) da DT-EPHEMERAL (defeito de BASELINE documentado no cartório, NÃO desta campanha; reconciliação segue BLOQUEADA/fora).
- **Dormência honesta:** NENHUM decisor lê as colunas novas nesta fatia; authority segue lendo `actor_delegations`; catálogo só é lido pelo assert de boot.
- **Status:** SUCESSO. Commit: `feat(authority): add company policy and grant foundation`.

---

## F3 — AUTORIDADE FINANCEIRA DE LEITURA — ✅ EXECUTADA (2026-07-19)

- **Decisor:** `canActAs` ganhou o DISPATCH do `COMPANY_POLICY_REGISTRY` (antes de ownership/delegation): chaves `company_grant_terminal` curto-circuitam (allow por subject grant OU deny TERMINAL — zero fallback role/is_primary/ownership); chaves `company_grant` ganham ramo de grant ADITIVO (`authoritySource:'membership_grant'`; fallback legado documentado até F4); `manage_members` com actor de GRUPO = fail-closed (R6). Nova fachada `financial-read-authority.ts`: `authorizeActorFinancialRead` (TERMINAL: self OU `can_view_financial` de membership ativa; grupo fail-closed) com a leitura executada SOB lock FOR SHARE da membership — **R13 provado: revogação concorrente ESPERA a leitura (linearização, caso 12)**.
- **Superfícies migradas:** `GET /bank/balance?actorId=` e `GET /bank/statement?actorId=` (a sopa de capabilities morreu; era saldo p/ QUALQUER membro ativo) · `GET /bank/transaction/:id/splits` — **autorização POR RECURSO** (origem via porta nova do Bank `getOriginAccountByTransactionId`; integral = self-origem OU view_financial na empresa dona; participante = SÓ pernas próprias + resumo sanitizado sem topologia; sem papel/inexistente = **404 UNIFORME**) · `GET /economy/accounts/:id[,/balance]` (representação/gestão NÃO lê mais dinheiro — terminal) · `recent-counterparts` (deriva de bank_splits → terminal) · **no-store + audit event (`financial_audit_trail`) ANTES da resposta em toda leitura financeira privada (falha de audit = 500, sem disclosure sem rastro)**.
- **Superfícies fechadas por estado permitido (R19):** `ledger.routes` — contas de empresa JÁ fail-closed 403 (owner_type='user' only; DT-LEDGER-ADMIN-READ-GATE-MISSING preexistente) · AP/AR — DISABLED fail-closed (R8H, preexistente) · `/accounts` list e `/owner/:id` — `financial:view_all_ledger` (manual_assignment; ninguém a tem = fail-closed) · `regional-fund` — transparência territorial PÚBLICA (0177, fora do view_financial privado).
- **Classificadas com divergência honesta da matriz (para a YALA julgar):** `invoice.routes` mantida como acesso POR PARTE do documento (emissor/destinatário representado — modelo de participante; invoices=schema-ghost, 0 linhas) em vez de view_financial; `economic-overview` mantida sob representação (rota se autodeclara "NÃO é banco/carteira/saldo" — projeção de atividade); `reports.routes` = operacional (`legacy_ownership_contained`).
- **Projeção:** `actorCapabilitiesService` virou projeção PURA — `bank.view_balance` REMOVIDA da base de page; `company.post` DERIVADA de `can_publish_feed` (R9-B); roster de delegações REDIGIDO (exige `can_manage_members`; membro comum vê só as próprias capabilities); leitura de membership por `member_status='active'`; gates de `home-feed`/`profile-inference` trocados por `canRepresentActor`.
- **Guard novo:** `audit-actor-capabilities-not-decisor.mjs` (runner 193→194) — allowlist de importadores (só a rota de projeção) + morde reintrodução de sopas `capabilities.includes('bank.view_balance'|…)`.
- **Provas:** adversarial **18/18 VERDES** em clone efêmero destruído (`unificard_f3_clone`): 5 negativos de rótulo/flag (owner/is_primary/manage_company/manage_financial sem view → 403), delegação publish_feed→financeiro deny, suspended/revoked deny, actor inexistente uniforme, self-wallet spoof deny, **linearização revogação×leitura**, roster redigido, canActAs terminal/grant, splits origem inexistente→null, audit persistido, Δbank=0 · typecheck 0 · runner 194/194.
- **Status:** SUCESSO. Commit: `fix(bank): enforce exact company financial read authority`.

---

## F4 — LIFECYCLE E CUTOVER EMPRESARIAL — ✅ EXECUTADA (2026-07-19)

- **Migration:** `20260719140000_company_membership_lifecycle_cutover.sql` — cutover das delegações de MEMBERSHIP vivas (revoke lógico + eventos `membership_cutover_0189` + `delegation_cutover`; escopo ESTRITO: institutional=empresa E Identity com membership ativa; representantes externos/grupos INTOCADOS; dev tinha 0 vivas) · CHECK `member_status` → {active,suspended,revoked} (`invited` MORTO; preflight aborta se houver linha) · **DROP COLUMN is_active** (inventário DB via catálogo: ZERO views/matviews/functions/índices/constraints/policies dependentes; único trigger = updated_at; preflight aborta em divergência is_active×member_status) · **exclusividade §6.3 ATIVADA nas 2 direções** (constraint triggers em actor_delegations E company_users, tenant-safe, escopados a empresa).
- **Decisor:** dispatch F4 — para actor de EMPRESA, TODA chave company_grant* decide no registry: grant → allow; chave DELEGÁVEL sem grant → delegação EXTERNA (authoritySource 'delegation'); senão DENY. **Ownership/role/is_primary NUNCA mais autorizam chave empresarial.** `checkOwnership`/`checkOwnershipOnClient`: ramos `is_primary=true` e `role='admin'` REMOVIDOS; `canManageCompany` = `can_manage_company` puro (sem `OR role='owner'`, sem is_active).
- **Comandos governados** (`company-membership-commands.service` NOVO): suspend (congela grants) · resume · revoke (zera grants + snapshot no evento + encerra vínculo vigente) · alterGrants (allowlist tipada; DOIS TETOS — protegidos exigem governança; grant ceiling só-concede-o-que-possui; administration ceiling target⊆caller) · transferGovernance (ATÔMICA, concede+rebaixa na mesma tx) · declareRelationship (casa jurídica). TODOS sob lock ORDEM FIXA empresa→alvo→caller (FOR UPDATE) com autoridade do caller resolvida DENTRO da tx; proteção do último gestor SOB o lock. Rotas: POST /members → **410 MEMBERSHIP_VIA_INVITATION_REQUIRED** (R17); PUT → SÓ rótulos (status → 400); DELETE → comando revoke; novos endpoints /commands/{suspend,resume,revoke}, PATCH /grants, /governance/transfer, /relationship (autoria não-forjável via requireRepresentsActingActor). Bridge social → **410 fail-closed** (corpo legado removido). `createMember`/`createDelegationForMember`/`getScopesForRole` (wildcard `['*']`) **REMOVIDOS** — dual-write F2 DESLIGADA nesta fatia. `repository.create`/DELETE físico inexistem.
- **is_active morto no runtime:** companies.service (canManageCompany, 4 read-models → `(member_status='active') AS is_active` projeção, INSERT bootstrap), company-publications, kyb-request-submit, module-projection.routes, social/actor.repository, members repository/service. `tenant_operator_grants.is_active`/`cnae.is_active` (outras tabelas) preservados.
- **Guards atualizados para a norma promulgada** (cada um com justificativa in-file): pj-human-to-company (2 arquivos novos classificados não-resolutores) · actor-authority-boundary (+fachada financeira como binding) · handler-authority-gap (4 comandos triados — binding local + autoridade terminal interna) · actor-relationship-boundary (bridge: prova a CONTENÇÃO 410, morde reintrodução) · r2-delegation-writer (prova o CUTOVER: reintroduzir writer de delegação de membership MORDE; autoria §4.9.9 migrou p/ casa jurídica) · territorial-foundation (registry na janela nominal — classification-only) · foundation guard estendido (F4: migration+DROP+triggers+no-is_active+role/is_primary/wildcard mortos, com strip de comentários). Prova F3 ajustada: Δbank via psql do rito (financial-ssot ratchet 591/591 preservado — SQL bank_* saiu do TS); porta do Bank no lugar de import de repository.
- **Provas:** FRESH efêmero 528/528 (is_active ausente; triggers ativos; CHECK correto) · UPGRADE clone via rito seletivo **16/16 asserts** · **adversarial F4 16/16 VERDES** (rótulos mortos; suspend/resume/revoke com snapshot; último gestor ×2 formas; dois tetos ×3; transferência atômica; exclusividade nas 2 direções; representante externo FUNCIONAL via delegação; DELETE físico bloqueado por FK; **dupla revogação concorrente linearizada pelo lock — empresa nunca órfã**) · Δbank=0 no clone · dev: dry-run → APPLY registrado · typecheck 0 · runner completo (bg).
- **Status:** SUCESSO. Commit: `refactor(authority): cut over company membership lifecycle`.

---

## F5 — CONVITE E ACEITE CANÔNICOS — ✅ EXECUTADA (2026-07-19)

- **Migration:** `20260719160000_company_access_invitations.sql` — `company_access_invitations` (invitee IMUTÁVEL por Identity; `token_hash` CHECK 64-hex + UNIQUE; `UNIQUE(tenant,inviter,idempotency_key)`; UM pendente por (empresa,convidado); CHECK anti-self-invite FÍSICO; shape de lifecycle com timestamps; RLS+FORCE; DELETE revogado do runtime) + `company_access_invitation_permissions` (FK COMPOSTA ao catálogo VERSIONADO; IMUTÁVEIS por trigger).
- **Backend:** `company-access-invitations.service` — create (lock empresa→caller; manage_members terminal; **grant ceiling**: requested ⊆ convidáveis ⊆ grants do convidador — governança NÃO bypassa; idempotência R14 com `timingSafeEqual` e replay SEM re-emissão de token; estados do alvo R17) · **aceite** (locks ORDEM FIXA empresa→convite→convidador→convidado; caller ≡ invitee pela Identity; `NOW()` na tx com lazy-expire; **tetos REVALIDADOS** — convidador revogado/rebaixado → falha; **catálogo revalidado por versão+invitable+status**; grants EXATOS das linhas persistidas — writer nem recebe body; reentrada EXCLUSIVA de revoked com **substituição INTEGRAL**; membership+vínculo+evento+consumo do token na MESMA tx; zero delegação — trigger §6.3 vigia) · decline/revoke/list (histórico preservado; token_hash nunca exposto) · **lookup por código de indicação** (R15): gestor-gated via `canActAs('manage_members')`, rate limit **FAIL-CLOSED** próprio (janela fixa por user E ip — não reusa o caminho fail-open de auth.routes), resolve server-side (`actor_referral_codes.code_status='active'` → actor HUMANO → Identity), resposta mínima/uniforme, zero poder. Rotas registradas em companies.module + `/invitations/accept|decline` (protectedScope).
- **Frontend:** `api/companyInvitations.ts` (idempotencyKey = `crypto.randomUUID()` por intenção; token nunca em storage) · `CompanyTeamTab` REESCRITA — lookup por código (diretório) → checkboxes das 6 CONVIDÁVEIS (servidor aplica tetos) → token exibido UMA vez; fila de pendentes com revogar; role marcado "(rótulo)"; status REVOKED · página `/convites` (`InvitationAcceptPage`: aceitar/recusar por token, trata 409/expirado/uniforme) · handler `executeInviteCompanyMember` RELIGADO ao convite (caminho 410 morto) · enum sem INVITED.
- **Provas:** FRESH 529/529 · clone `unificard_f5_clone` via rito seletivo → **PROVA F5 23/23 VERDES** (poder-zero pré-aceite; aceite materializa EXATO; tetos ×3; idempotência replay/409; pendente único; self-invite; token reusado/inexistente/expirado UNIFORMES + lazy-expire; convidador revogado → falha; **aceites concorrentes → 1 materialização**; reentrada integral SEM reviver resíduo; permissões IMUTÁVEIS; histórico preservado; **token em claro AUSENTE do banco — só o hash**) · Δbank=0 (psql) · dev: dry-run → APPLY · typecheck backend 0 + frontend 0 · runner **194/194** (guards F5: token 256-bit, sem token em log, timingSafeEqual, reentrada-só-de-revoked; triagens com justificativa).
- **Status:** SUCESSO. Commits: `feat(companies): add secure company access invitations` + `feat(companies-ui): add permissioned member invitation flow`.

---

## F6 — FECHAMENTO E ENTREGA PARA YALA — ✅ EXECUTADA (2026-07-19)

- **Código morto:** varredura ZERO resíduos (`createDelegationForMember`/`getScopesForRole`/`getRelationshipTypeForRole`/`CompanyMemberStatus.INVITED`/`activateMember` ausentes do runtime; a dual-write F2 foi desligada NA F4 — F6 confirmou nada remanescente).
- **Re-auditoria dos denominadores da F1 (F6.4):** nenhum `cu.is_active` no runtime ✅ · actorCapabilitiesService não-decisor (guard verde) ✅ · `bank.view_balance` fora da base de page (resta só na base de USER = self-wallet) ✅ · wildcard `['*']` extinto ✅ · `DELETE FROM company_users` inexistente ✅ · role/is_primary como authority mortos (guard com strip de comentários) ✅ · rotas diretas criando active: POST /members=410, bridge=410 (guards mordem reintrodução) ✅ · token em log: guard verde ✅ · dupla autoridade membership×delegação: triggers ATIVOS no dev (2/2) ✅.
- **Estado final do dev:** 3 migrations 0189 registradas · triggers exclusividade 2/2 · is_active=0 colunas · catálogo=9/digest OK · vínculo vigente=1 · eventos=2 · convites=0 · gestor com SET_V1=1 · delegações ativas=0 · **bank_ledger=0 · bank_transactions=0 · bank_splits=0 · bank_accounts=16 (IDÊNTICO ao baseline — Δbank=0 na campanha inteira)** · 7 pendentes preservadas não-registradas (drift parte-(b)/N1/dormentes INTOCADAS).
- **Gates finais:** typecheck contracts+backend 0 · frontend tsc 0 + build de produção OK (`vite build` ✓) · runner completo 194/194 · fresh DB final **529/529** · upgrade real = o próprio dev (3 ritos seletivos dry-run→apply, 100% asserts) · provas adversariais/concorrentes: F2 3/3 · F3 18/18 (linearização revogação×leitura) · F4 16/16 (dupla revogação concorrente; exclusividade 2 direções) · F5 23/23 (aceites concorrentes → 1 materialização).
- **Suite jest (npm test) — CLASSIFICAÇÃO HONESTA (F6.8):** 12 suítes FAIL encontradas; **TODAS baseline, nenhuma da campanha**: (a) `permission-canonical` — PROVADO baseline-red (pinada no mapa v1.3/32 permissions; o mapa PRÉ-campanha já era v1.6 com 76 chaves no union — `git show 8397b41cb` anexo): **ATUALIZADA para v1.7 nesta fatia → 15/15 VERDE** (de quebra auditou que o comentário histórico "Total: 62" do próprio mapa era stale — total real 80, corrigido); (b) `soft-block`/`debt-blocking` — `relation "alerts" does not exist` (tabela fantasma pré-existente); (c) `economic-identity` — casos rotulados "LEGACY — baseline antes de correção" no próprio teste; (d) demais 8 (groups-votes-drift, tenant-invariants, hobby-gate, tenant-context-permissions, categories-ssot, webhook-resolver, category-navigation, ui-domain-separation) — schema-drift/env pré-existentes; **grep provou ZERO referência a qualquer superfície da campanha (company_users/is_active/canManageCompany/actorCapabilities/can_view_financial/member_status) nas 10 restantes**. As suítes canônicas de evidência do repo (runner 194 + invariants permanentes) estão VERDES; PASS inclui rbac-invariants, permission-invariants, group-*-bindings, fiscal-*.
- **DTs residuais legítimas (fora de escopo financeiro; nenhuma sela abertura financeira):** DT-REFERRAL-CODE-32BIT-GLOBAL-HARDENING · DT-COMPANY-AUDITOR-ROLE · DT-GROUP-MANAGE-MEMBERS-SUBSTRATE (fail-closed vivo) · DT-CANREPRESENTACTOR-PER-ROUTE-EXACT-PERMISSION (contenção gestão-gated — nada alargado) · DT-COMPANY-FINE-GRANTS-PERMISSION-KEYS.
- **Divergências honestas para a YALA julgar (declaradas, não escondidas):** invoices mantidas como acesso-POR-PARTE do documento (emissor/destinatário; schema-ghost, 0 linhas) em vez de view_financial; economic-overview mantida sob representação (rota autodeclarada não-saldo); reports=operacional contido; representação de contexto de empresa CONTIDA em gestão (can_manage_company) — membro comum age só por canActAs exato (§1.3 da DECISION).
- **Status:** SUCESSO. Commit final: `chore(governance): close company access authority campaign`.

**IMPLEMENTAÇÃO CONCLUÍDA — CANDIDATA A AUDITORIA YALA INDEPENDENTE** (instruções de auditoria no relatório da executora e no cartório; a executora NÃO declara selo).

---

# CAMPANHA CORRETIVA — F-COMPANY-ACCESS-AUTHORITY-YALA-CLOSEOUT (2026-07-19)

**A YALA independente REPROVOU a DECISION-0189** (Findings A/B/C + R19). Reprovação aceita (D1).
Trilha histórica acima PRESERVADA — as afirmações do §13.4 e do fecho da F6 sobre publish_feed/
create_events e exclusividade estavam ERRADAS/OBSOLETAS; errata formal em DECISION-0189A §6.

## ETAPA A — ADENDO NORMATIVO — ✅ EXECUTADA
- `docs/02_decisions/DECISION_0189A_YALA_CLOSEOUT.md`: registra a reprovação; corrige §13.4
  (publish_feed sombreada + guard no actor errado; create_events sem gate); promulga D4 (chaves
  de eventos), D6 (advisory xact lock comum, transaction-level, antes do check, escopado a
  empresa), D7 (R19: overview/invoices/view_all_ledger/payouts/splits), D2/D3 (gate fino não
  sombreável; DT não absorve call-site coberto), lazy-heal da perna capability.
- Cartório atualizado (entrada ETAPA A) sem apagar histórico.
- Commit: `docs(authority): record YALA closeout requirements`.

*(Etapas B–F apensadas abaixo)*

## ETAPA B — GATES EXATOS DE FEED E EVENTOS — ✅ EXECUTADA (Findings A e B FECHADOS)
- **publish_feed dessombreada (Finding B):** POST /social/posts decide por `canActAs(publish_feed)`
  sobre o AUTOR declarado (subject=req.user.userId); pre-gate `canRepresentActor` REMOVIDO
  (403 novo `SOCIAL_POST_PUBLISH_FEED_DENIED`); `requirePermission` no actor do actionContext
  REMOVIDO (checava o actor errado). KYB-gate 0094 intocado no service.
- **Eventos (Finding A):** helpers novos `userCanActOnActor` (canActAs exato; D3) e
  `assertEventExactAuthority` (evento carregado server-side → dono → chave exata). Criações ×3
  (POST / · /v2/create · /v2/draft) → `create_events` no ORGANIZADOR declarado; writers ×12
  (PATCH /:id · publish · cancel · declare · v2 publish/activate/end/cancel · time-windows ·
  audience · needs POST/DELETE) → `manage_events`; administração de participantes ×4
  (commitments create · check-in · check-out · fail) → `manage_attendees`; leituras
  administrativas do organizador (2 GETs) e caminho econômico selado inalterados.
  CONTENÇÃO DE GRUPO: actor de grupo mantém o comportamento legado (representação do dono) —
  grupos fora do escopo; sem regressão.
- **Lazy-heal da perna capability (0189A §2):** dispatch empresarial materializa os defaults de
  TIPO no registry quando ausente (membro por convite não é mais negado pela perna capability).
- **Guards:** NOVO `audit-event-feed-exact-permission` (runner 194→195: cria×3, manage_events×12,
  manage_attendees×4, sombra proibida, company.post fora de Authority, errata preservada);
  3 guards legados ATUALIZADOS para exigir o gate NOVO (social-posts-actor-binding ·
  referral-register cross-check · social-legacy-containment — FORTALECIMENTO: chave exata
  subsume representação; a volta da sombra MORDE); binding lists de measure-handler-gap e
  event-lifecycle-authority reconhecem os helpers exatos.
- **Prova adversarial 15/15 VERDES** em clone efêmero (B1..B12: membro fino publica/cria SEM
  manage_company; gestor sem grant NEGADO; rep externo só com scope exato; alheio uniforme;
  manage_events/attendees governança-sim membro-não; suspenso/revogado negados; PF self).
- typecheck 0 · runner 195/195. Commit: `fix(authority): enforce exact feed and event permissions`.

## ETAPA C — EXCLUSIVIDADE SOB CONCORRÊNCIA REAL — ✅ EXECUTADA (Finding C FECHADO)
- **Migration `20260719180000_company_exclusivity_advisory_lock.sql`:** função auxiliar ÚNICA
  `fn_company_relation_advisory_lock(tenant,company,identity)` (representação canônica não-ambígua
  → `hashtextextended`; `pg_advisory_xact_lock` — NUNCA session); AMBAS as trigger functions
  recriadas adquirindo a MESMA chave ANTES do SELECT cross-table e reexecutando o check DEPOIS
  do lock; escopo estritamente empresarial (grupo/canal retornam sem lock); relação empresarial
  sem identity resolvível → FAIL-CLOSED; triggers preservados (binding verificado no postcheck).
- **PROVA CONCORRENTE 6/6 VERDES** (clone efêmero, duas conexões, janela crítica ABERTA):
  C1 T1 membership segura a tx → T2 delegação BLOQUEIA no lock → T1 commita → T2 vê e falha
  (EXCLUSIVITY_VIOLATION; estado m=1,d=0) · C2 ordem invertida (m=0,d=1) · C3 duas relações da
  mesma empresa em paralelo SEM deadlock · C4 chave isola tenant · C5 representante externo
  intocado · C∞ ZERO violações no estado final.
- Guard: seção 5d no foundation-guard (lock comum ANTES do check nos DOIS lados; xact-level;
  session-lock proibido; check-sem-lock MORDE). Dev: dry-run → APPLY via rito seletivo.
- Commit: `fix(authority): serialize company membership delegation exclusivity`.

## ETAPA D — FECHAMENTO R19 — ✅ EXECUTADA (D7 promulgada e materializada)
- **PORTA_HOLD estrutural:** `financial:view_all_ledger` + `marketplace_execute_payouts` +
  `marketplace_manage_splits` = DENY TERMINAL para QUALQUER actor (self incluído — ownership
  genérico nunca as concede) no decisor canônico E no caminho legado (businessAuthorization —
  que antes "negava" só porque organization_members é tabela fantasma; "zero linhas" deixou de
  ser a segurança). payouts/splits reclassificados (fora de legacy_ownership_contained).
- **economic-overview (D7.A):** payload classificado campo a campo (totalReceived/totalPaid/
  fluxo/lastTransactions.amountCents = agregado econômico privado) → rota de ACTOR sob a
  fachada TERMINAL (self | can_view_financial; leitura sob lock; no-store; audit ANTES do
  disclosure; gestor sem view → deny) · rota de GRUPO estava ABERTA a qualquer autenticado →
  FAIL-CLOSED (fachada nega grupos; substrato próprio = frente futura).
- **invoices (D7.B):** autorização POR PARTE via fachada financeira (PF=self; parte
  EMPRESARIAL exige view_financial — representação/can_manage_company NÃO leem);
  **listagem ESCOPADA ANTES da query** (sem filtro de parte → 400 EXPLICIT_PARTY_FILTER_REQUIRED;
  tenant-wide morto); no-store + audit; escape view_all_ledger agora deny estrutural.
- **Prova 7/7 VERDES** (clone): PORTA_HOLD ×3 (self e gestor pleno negados com razão
  PORTA_01_HOLD) · caminho legado deny explícito · gestor/finance sem view→deny, membro com
  view→allow · grupo deny · estranho deny. Fachada: principal desconhecido = deny fail-closed
  (infra segue propagando). Guard: seção R19 no audit-event-feed-exact-permission (PORTA_HOLD
  no registry+decisor+legado; fachada/no-store/audit/escopo-antes-da-query — regressão MORDE).
- **NÃO REPRODUZIDA (honesto):** a perna "fixtures materiais" de invoices/overview — as FONTES
  (`invoices`, `payment_executions`, `payment_splits`) são SCHEMA-GHOST (to_regclass=NULL);
  criar linhas exigiria inventar schema (proibido). A AUTORIZAÇÃO (objeto de R19) está provada;
  o 500 pré-existente das superfícies ghost permanece coberto por DT-INVOICING (OPEN).
- runner 195/195 · typecheck 0 · Δbank=0 (clone e dev). Sem migration nesta etapa.
- Commit: `fix(finance): close residual company financial read authority`.

## ETAPA E — PROVAS COMPORTAMENTAIS PENDENTES — ✅ EXECUTADA
- **E.A Cross-tenant F5 (9/9 VERDES):** tenant B COMPLETO construído em clone efêmero ao lado
  do A (tenant+Identity+users+actors+company+membership SET_V1+registry). E1 token A no tenant
  B → uniforme · E2 Identity B não aceita convite A · E3 list/revoke tenant-scoped · E4 lookup
  não cruza · **E5 RLS com o ROLE REAL (SET ROLE unificard_app + GUC): dados do outro tenant
  INVISÍVEIS, próprios visíveis** · E6 FK composta explode convite-B→empresa-A no SCHEMA.
- **E.B Upgrade canônico (PROVADO):** BASE materializada em DB efêmero pelo RUNNER CANÔNICO
  (526 migrations — as 4 da campanha retiradas temporariamente do diretório e restauradas
  byte-idênticas via git; ZERO seletivo) → `migrate.ts` FINAL aplicou EXATAMENTE as 4
  (526→530, cada uma registrada 1×) → 2ª execução NO-OP (530 inalterado). **Honesto:** no DEV
  o runner canônico segue IMPOSSÍVEL — migration bloqueadora identificada:
  `20260713100000_actor_territorial_assignment_foundation.sql` (objetos presentes sem registro
  — drift parte-(b) pré-existente, DT-EPHEMERAL OPEN); o dev usa o rito seletivo governado e
  isso NÃO é vendido como upgrade-canônico-de-dev.
- **E.C Suite BASE×FINAL (ZERO regressão):** as MESMAS 12 suítes rodadas em BASE `8397b41cb`
  (checkout temporário de backend/src+tests, mesmo node/deps/env/DB; tree restaurada e
  verificada limpa) → **12/12 FALHAM EM BASE** (79 failed/91). FINAL: 11 falham
  (permission-canonical CONSERTADA → 15/15). Nenhuma regressão nova; 1 suíte melhorada.
- **E.D Fixtures financeiras:** matriz de AUTORIZAÇÃO R19 provada (Etapa D 7/7 + PORTA_HOLD);
  perna "dados materiais" de invoices/overview **NÃO REPRODUZIDA** — fontes schema-ghost
  (to_regclass NULL); inventar schema para prova é proibido; sem selo pleno nessa perna.
- **E.E Concorrência re-executada no estado FINAL:** membership×delegação 6/6 (Etapa C, janela
  crítica real) · aceite×aceite E7 (1 materialização) · **aceite×revogação E8 (1 vencedor;
  estado consistente accepted+membro XOR revoked+sem-membro)** · dupla revogação de gestor
  F4 16/16 · leitura×revogação F3 17/17. Provas F3/F4 ATUALIZADAS à semântica promulgada
  (caso 6: rep externo — delegação p/ membro ativo agora é PROIBIDA pelo trigger; caso 15:
  fallback de ownership aposentado → gestor sem grant DENY) — atualizações justificadas
  in-file.
- Commit: `test(governance): add YALA closeout behavioral evidence`.

## ETAPA F — FECHAMENTO DA CAMPANHA CORRETIVA — ✅ EXECUTADA
- **Gates finais no HEAD corretivo:** runner **195/195 exit 0** · typecheck backend **0 erros** ·
  typecheck frontend **0 erros** · suítes permission/auth/rbac + permission-canonical
  **4/4 suítes · 32/32 testes** · fresh efêmero final **530/530** · **Δbank=0 no dev**
  (bank_ledger=0 · bank_transactions=0 · bank_splits=0 · bank_accounts=16 — idêntico ao
  baseline da campanha original; PORTA 01 permanece FECHADA) · 4 migrations `20260719*`
  registradas no dev via rito seletivo governado.
- **Reauditoria dos denominadores (todos VERIFICADOS no código do HEAD):**
  1. POST /events (×3 rotas de criação) decide por `create_events` exato sobre o organizador
     declarado (`userCanActOnActor`, event.routes); writers ×12 = `manage_events`;
     participantes ×4 = `manage_attendees`.
  2. Create-post decide por `canActAs(publish_feed)` no AUTOR; **zero** `canRepresentActor`
     residual na rota; membro fino publica SEM `can_manage_company`; gestor sem o grant é
     NEGADO (prova 15/15 da Etapa B).
  3. Nenhum money-path decide por ownership/role/is_primary: `dispatchCompanyPolicy` é
     TERMINAL e curto-circuita ANTES dos ramos de ownership; `PORTA_HOLD_KEYS`
     (view_all_ledger/payouts/splits) negam no TOPO de `canActAs` E em
     businessAuthorizationService (estrutural, não ghost-dependente).
  4. Overview/invoices exigem recurso+`can_view_financial` via fachada
     `financial-read-authority` (FOR SHARE + audit ANTES do disclosure + no-store);
     listagem de invoices exige filtro explícito de parte.
  5. Ambos os triggers de exclusividade adquirem `fn_company_relation_advisory_lock`
     (pg_advisory_xact_lock, chave única tenant×company×identity) ANTES do check
     cross-table (migration `20260719180000` linhas 98/129); write-skew provado morto (6/6).
  6. Nenhum guard afrouxado: todos os guards atualizados exigem o padrão NOVO mais forte
     (runner 195, +2 sobre o fechamento F6); nenhum token de convite em log (guard ativo).
- **Cartório:** entrada de fechamento no REMEDIATION_DT_LOG (Findings A/B/C FECHADOS;
  errata §13.4 vigente via DECISION-0189A §6; DT-CANREPRESENTACTOR reclassificada — feed e
  eventos migrados REMOVIDOS do denominador; decisão R19 registrada como RESOLVIDA por D7).
  **DT global de canRepresentActor NÃO fechada** (rotas legitimamente contidas permanecem).
  **NENHUM selo declarado** — executora não se autossela.
- **Commits da corretiva:** `498607b0d` (A) → `e0c77a5b9` (B) → `f73062d85` (C) →
  `21b5d9eda` (D) → `576137b56` (E) → fechamento de cartório (F). Os 7 commits da campanha
  original permanecem INTOCADOS (sem amend/squash/rebase).
- **Limitações NÃO REPRODUZIDAS (sem invenção de resultado):** upgrade do DEV pelo runner
  canônico segue bloqueado pelo drift parte-(b) pré-existente (migration bloqueadora:
  `20260713100000`; objetos presentes sem registro) — upgrade canônico foi provado em
  efêmero por file-set BASE(526)→FINAL(530)→no-op; perna de dados materiais de
  invoices/payment_executions/payment_splits não reproduzível (to_regclass NULL — schema
  ghost; NÃO usado como argumento de segurança, fechamento é estrutural).

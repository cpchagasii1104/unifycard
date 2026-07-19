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

*(entradas F3–F6 são apensadas abaixo conforme executadas)*

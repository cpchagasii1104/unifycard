# Execution Log — F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC

**Data:** 2026-06-11
**Frente:** `F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC` (após HARD STOP aceito de `F-C1-BIRTH-MINIMUM-ATOMIC`)
**HEAD origem:** `7f647c79` · **Branch:** `rescue-structural` · **dev:** 366 → **367**
**Modo:** MIGRATION + BACKEND + E2E + GATE + DOCUMENTAÇÃO
**Governado por:** decisão TENANT (FECHADA) + DECISION-0115 (D1/D2) + GO revisado da IA Diretora + C1_REACHABILITY_MANIFEST

---

## 1. Causa-raiz (manifest B1/B2/parte de B3)

register: tenant-per-signup (`user-<slug>-<ts>`), `x-tenant-id` do cliente como autoridade, nascimento statement-by-statement, identity/actor best-effort (try/catch "retentar no próximo acesso"), token emitido ANTES da cadeia. A correção elimina a raiz no caminho ORGÂNICO (não desloca a cura: identity+actor passam a ser garantidos atomicamente).

## 2. Tenant institucional

`migrations/20260611120000_seed_unificard_inicial_tenant.sql`: `INSERT INTO tenants (name, slug) VALUES ('Comunidade Inicial Unificard','unificard-inicial') ON CONFLICT (slug) DO NOTHING`. id via default `uuid_generate_v4()` (sem hardcode); idempotente (`tenants_slug_key`); forward-only; não move tenants históricos; não toca Bank. Aplicada (dev 367); 1 linha materializada.

`tenant.service.getTenantBySlug(slug)`: resolver server-side fail-closed (exatamente 1 linha; ausente/duplicado → erro). Sem criação de tenant no register.

## 3. register reescrito (auth.service.ts)

- Tenant resolvido SERVER-SIDE = `unificard-inicial`. `x-tenant-id` (param `tenantId`) IGNORADO (`void tenantId`).
- PILOT_MODE: gate de admissão DENTRO de unificard-inicial (`hasValidInvite(finalTenantId, email)`); sem convite → 403 ANTES de qualquer escrita (não cria/reverte tenant). Sem busca cross-tenant.
- Validações pré-tx (zero escrita): email duplicado (409), CPF obrigatório+válido (400), referral validado intra-tenant (inválido → 400 `INVALID_REFERRAL_CODE`).
- **Transação única** (`withTransaction(unificardInicialId)`): global_users UPSERT(cpf) → users INSERT → profiles(cpf) INSERT (dedup atômico; 23505→409→rollback) → `identityService.ensureIdentityRowForGlobalUserTx(client, gu)` → `ensureUserActorTx(client, tenant, userId)`. Qualquer falha → ROLLBACK total.
- **Token só APÓS COMMIT** (`generateTokens` depois do `withTransaction`).
- Pós-commit progressivo (best-effort, não invalida o nascimento completo): metadata de perfil (gender preservado em metadata — fora do escopo), aplicação de referral (já validado), aceite de convite piloto, código próprio de indicação.
- `requiresOnboarding = true`.

`auth.routes.ts`: log de sucesso corrigido (sem `tenantWasCreated/Provided`; `tenantResolution: server-side:unificard-inicial`).

## 4. Writers Tx (aditivos — não forkam a cadeia canônica)

| Writer | Arquivo | Nota |
|--------|---------|------|
| `ensureIdentityRowForGlobalUserTx(client, gu)` | identity.service.ts | variante client-aware de ensureIdentityRowForGlobalUser |
| `findOrCreateUserActorTx(client, tenant, userId)` | actor.repository.ts | espelha findOrCreatePageActorTx; fail-closed (identity antes de actor) |
| (port) `findOrCreateUserActorTx` | actor-repository.port.ts + adapter | |
| `ensureUserActorTx(client, tenant, userId)` | actor-writer.service.ts | wrapper soberano §4.8 |

Os writers NÃO-Tx originais permanecem intactos (usados por outros fluxos: company birth, GET curativos).

## 5. Profile mínimo

Profile completo NÃO é requisito do nascimento (DECISION-0115 D2; o GET /profile auto-cria — curado na Fatia 2). Incluído na transação apenas o `profiles(cpf)` existente (writer de dedup CPF; não é completude nova) para preservar a integridade de CPF atomicamente.

## 6. Referral / PILOT_MODE

- Referral: validação pré-tx (inválido → 400 antes de escrita); intra-tenant; nunca cross-tenant; aplicação pós-commit (progressivo). Não toca GET /referral/code.
- PILOT_MODE: gate de admissão dentro de unificard-inicial; fail-closed. NÃO escolhe tenant; NÃO busca cross-tenant. (Substrato `pilot_invites` ausente em dev → DT própria; caminho de convite válido não exercitável em dev, mas o nascimento orgânico não depende dele.)

## 7. Token

Gerado e retornado SOMENTE após COMMIT, com `tenantId = unificard-inicial`. Em qualquer falha (tenant/pilot/referral/global_user/user/identity/actor/commit) → exceção propagada, sem token, sem estado residual (rollback).

## 8. Gate estrutural

`scripts/audit-register-birth-atomicity.mjs` (`validate:register-birth-atomicity` + em `validate:regression-guards`). Invariantes: INV1 tenant server-side (`getTenantBySlug('unificard-inicial')`) · INV2 sem tenant-per-signup (sem `createTenant`/`user-${`) · INV3 `void tenantId` · INV4 `withTransaction` + `ensureIdentityRowForGlobalUserTx` + `ensureUserActorTx` · INV5 sem "retentar no próximo acesso"/`ensureUserActor` não-Tx · INV6 token após `withTransaction`. NÃO declara read purity/gender/invite/C1 fechados.

## 9. E2E (29/29)

`validate-pipeline-e2e-c1-birth-minimum-atomic-organic.ts` (HTTP real, POST /auth/register):
- A tenant institucional único + nome canônico.
- B/C 2 cadastros orgânicos → unificard-inicial; global_user+user+identity+actor; JWT tenantId+globalUserId; requiresOnboarding; entidades distintas.
- D x-tenant-id alheio → cai em unificard-inicial.
- H referral inválido → 400; zero residual.
- ROLLBACK: falha forçada de actor (monkey-patch transiente do writer) → não-201, zero global_user/user/identity/actor (atomicidade real).
- M zero tenant user-* novo · N histórico user-cpchagasii intacto.
- PILOT_MODE rejeição (sem convite → não-201, zero residual).
- Estrutural (S1–S6) + Gate (G1 verde + G2 prova negativa: register regressivo → gate falha).
- Cleanup por MARKER; Z2 unificard-inicial/dev/histórico intactos.

## 10. Gates e regressões

tsc backend OK (2 geo baseline) · actor-writer OK · bank-ledger OK · regression-guards OK (367 migrations) · architecture:strict critical_new=0 (warning_new=4 pré-existentes, não-meus) · system-state PASS.
Regressões: groups-mine 26/26 · x-actor-id 9/9 · consolidado 39/39 · self-escalation 33/33 · actor-target 16/16 · members 7/7 · role-vocab 7/7 · inventory f6-5-c3 12/12 · legacy-readers 32/32.

## 11. Cartório

- TENANT (decisão): FECHADA. Tenant orgânico no register: IMPLEMENTADO. Tenant por convite cross-tenant: PENDENTE DE SUBSTRATO.
- `F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC`: CLOSED. `F-C1-BIRTH-MINIMUM-ATOMIC`: PARTIAL. Macrofrente C1: PARTIAL/OPEN.
- READ PURITY / REFERRAL GET / GENDER: PENDENTE. IDENTITY_STATUS: CONDICIONAL. HOME READ SEAL: PENDENTE.
- DTs novas OPEN: `DT-C1-TENANT-INVITE-RESOLUTION-NO-SUBSTRATE`, `DT-C1-PILOT-INVITES-TABLE-ABSENT-IN-DEV`.
- DECISION-0115: adendo factual de implementação (sem reescrever a decisão).

## 12. Escopo intocado / STOPs

read purity (GETs curativos) · gender (metadata preservado; enum não tocado) · GET /referral/code · /core/profile · /identity/me · Home/Bank/wallet/ledger/payout/recovery/settlement · inventory · FASE 6 · R2 · PJ/agenda/learning/interests/profissional · convite cross-tenant · tenants `user-*` históricos · tabela de invite token. **C1/tenant compartilhado NÃO liberados; DECISION-0113 NÃO fechada; denominador global NÃO fechado.**

## 13. Próxima fatia

Fatia 2 (read purity): tornar puros `/social/actors/available` (remover findOrCreateUserActor), `/profile` (createProfileIfNotExists), `/core/profile` (ensureUserActor), `/referral/code` (UPDATE-on-GET) — agora que o nascimento garante actor+profile atomicamente. Em paralelo (decisão de produto): `F-C1-TENANT-INVITE-RESOLUTION`.

HOLD — aguardando reseal da Yala.

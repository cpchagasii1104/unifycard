# Execution Log — F-C1-AUTO-REACHABLE-READ-PURITY

**Data:** 2026-06-11
**Frente:** `F-C1-AUTO-REACHABLE-READ-PURITY` (Fatia 2 do arco C1, após `F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC`)
**HEAD origem:** `30dd2a16` · **Branch:** `rescue-structural`
**Modo:** BACKEND + FRONTEND (mínimo) + GATE + E2E + DOCUMENTAÇÃO
**Governado por:** GO IA Diretora (CP1–CP7) + DECISION-0115 (D1/D2) + DECISION-0062 + DECISION-0043 + LEI_COERENCIA §4.8 (writer soberano) + C1_REACHABILITY_MANIFEST

---

## 0. Invariante central

Nenhum GET **AUTO/REQUIRED-REACHABLE** do caminho C1 (register → SessionProvider → actors disponíveis → profile → onboarding → primeira Home) pode: criar actor/profile/identity/referral-code; provisionar conta/wallet; INSERT/UPDATE/DELETE/UPSERT; publicar evento de domínio; fazer get-or-create/ensure-materializing; compensar nascimento incompleto; nem transformar falha estrutural em zero/null-enganoso/array-vazio-enganoso/progress:0-falso/HTTP-200-falso. O GET PODE: ler, projetar, devolver ausência honesta, devolver erro observável, devolver estado explicitamente incompleto.

A fatia fecha a **família inteira** no denominador congelado (CP1–CP7) em UM commit, não endpoint-a-endpoint em sessões separadas.

## 1. Denominador (CP1–CP7) e correções

| CP | Superfície | Antes (write-on-GET / falso) | Depois (leitura pura) |
|----|-----------|------------------------------|------------------------|
| CP1 | `GET /social/actors/available` | `findOrCreateUserActor` (cria user-actor no GET) | `findByUserId`; se ausente, NÃO empurra (ausência honesta) |
| CP2 | `GET /profile` | `createProfileIfNotExists` + 200 | `404 PROFILE_NOT_FOUND` (ausência honesta) |
| CP3 | `GET /core/profile` | `ensureUserActor` + bloco get-or-create de `referral_code` | `actorRepository.findByUserId` (read); `referralCode = row.referral_code || null` |
| CP4 | `GET /identity/me` | `createProfileIfNotExists` (cria profile no GET) | `getProfile` (read); downstream trata null. (catch de identity-ausente = LEITURA, deixado intacto → DT própria) |
| CP5 | `GET /referral/code` | `getOrCreateReferralCode` (gera no GET) | `getReferralCode` (read, null se ausente); **writer explícito** `POST /referral/code` idempotente |
| CP6 | `GET /profile/progress` | catch → 200 `ok:true progress:0` (falso) | catch → `500 PROFILE_PROGRESS_CALCULATION_FAILED` (observável); sucesso intacto |
| CP7 | `GET /social/unread-counts` + `/feed/unread-counts` | `countOrZero` (erro → 0 falso) | `countOrNull` (erro → `null` honesto/indisponível) |

### Arquivos backend tocados
- `modules/social/actor.repository.ts` — CP1 (findAvailableActors lê via findByUserId; sem write).
- `core/profile/profile.routes.ts` — CP2 (404 honesto) + CP6 (catch 500).
- `core/core.service.ts` — CP3 (removido import + uso de `ensureUserActor`; removido bloco get-or-create de referral; `referralCode = row.referral_code || null`).
- `core/identity/identity.routes.ts` — CP4 (sem `createProfileIfNotExists`; catch de identity-ausente preservado, read-only).
- `core/referral/referral.routes.ts` — CP5 (GET lê; novo `POST /code` writer idempotente).
- `modules/social/social.routes.ts` + `core/feed/feed.routes.ts` — CP7 (`countOrNull`, erro → null).

### Frontend (mínimo necessário)
- `frontend/src/api/unread.ts` — `UnreadCounts` agora `feed/groups/events/services: number | null`; comentário: `null` = indisponível (erro estrutural), distinto de `0` = nada novo. UI já trata null como sem-badge.

## 2. Por que cada correção é segura (não desloca a cura)

Após `F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC` (DECISION-0115 D2), todo nascido tem **identity + actor garantidos atomicamente**. Logo os GETs curativos (CP1/CP3/CP4) não precisam mais "curar" no caminho C1 vivo — a cura foi feita no nascimento, não deslocada para o read. Usuário legado sem actor → ausência honesta (não recriação silenciosa). O `POST /referral/code` (CP5) preserva a capacidade de gerar código, mas como **escrita explícita**, não efeito colateral de leitura.

### Decisão de contrato (CP3 `/core/profile`)
Escolhido **ausência honesta** (`actor: null`) em vez de erro observável, porque os callers são CLICK-reachable (Profile.tsx, wizard de grupo) e o nascido sempre tem actor — documentado como defensável sob a invariante "estado explicitamente incompleto". Não mascara: não inventa actor, não retorna shape que parece completo.

### CP4 — catch de identity-ausente preservado (read-only)
O catch de `/identity/me` que reconstrói profile parcial é LEITURA (sem INSERT/UPDATE), logo NÃO viola a invariante de read-purity. É mascaramento de completude (200-parcial em vez de incompletude honesta) → registrado como **DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS** (frente própria; muda contrato de resposta + blast radius no modal de primeiro acesso). Morto no C1 vivo pós-nascimento-atômico.

## 3. Gate estrutural

`backend/scripts/audit-c1-auto-reachable-read-purity.mjs` (NOVO): valida 8 superfícies do denominador (CP1–CP7). Classificações: PURE_APPROVED / KNOWN_OPEN / FORBIDDEN_REGRESSION / NEW_UNCLASSIFIED. Resultado: **8/8 PURE_APPROVED, KNOWN_OPEN=0**. NÃO declara C1/gender/Home financeira/convite fechados.
- Religado em `validate:regression-guards` (append `&& node scripts/audit-c1-auto-reachable-read-purity.mjs`).
- Script dedicado `validate:c1-read-purity`.

## 4. E2E HTTP real

`backend/src/scripts/validate-pipeline-e2e-c1-auto-reachable-read-purity.ts` (NOVO): app Fastify real (auth público + escopo protegido tenant/auth/actionContext/rbac + core/profile/referral/social/identity). Cadastro orgânico REAL → snapshots de estado (actors/profiles/identities/refcodes) antes/depois de cada GET. Cenários **A–K + Z1**:
- A nascimento garante actor+profile; B actors/available puro; C legado sem actor não curado; D /profile puro + 404 honesto; E /core/profile puro (actor read, sem geração de referral); F /identity/me puro; G referral GET sem escrita + POST idempotente; H /profile/progress 200 + puro; I unread `feed===null` (prova de erro estrutural real) + `groups` número; J bootstrap sem novo estado; K1 gate verde no código final + K2 **prova negativa** (injeta `createProfileIfNotExists` transitoriamente → gate FALHA → restaura); Z1 cleanup zero residual.
- **Resultado: 32/32 verdes.**

## 5. Validações (todas verdes)

- `tsc` backend: apenas baseline geo-enrichment (4 linhas pré-existentes; 0 novas).
- `tsc` frontend: 0 erros.
- `validate:actor-writer-boundaries` (§4.8.1): GATE OK.
- `validate:bank-ledger-boundaries` (§4.6): GATE OK.
- `validate:regression-guards` (inclui o novo gate): GATE OK — c1-read-purity 8/8 PURE_APPROVED, KNOWN_OPEN=0.
- `validate:architectural`: 37 violações **pré-existentes** (categories/lifestyle/interest-c1 / USER_PROFILE_CONTRACT) — **stash test confirmou baseline=37 com e sem a fatia (idêntico): zero violação nova introduzida**. Falha pré-existente, neutra à fatia.
- Regressões: birth-organic 29/29 · feed-contextual-authorship-f6-5-4 **8/8** (literal `visibility='PUBLIC'` preservado) · unread-counts-isolation **20/20** (B8 atualizado: `countOrNull` + erro→null, isolamento preservado) · groups-mine 26/26 · x-actor-id 9/9 · self-escalation 33/33 · consolidated 39/39 · legacy-readers 32/32 · company-members 7/7 · role-vocab 7/7 · dev-login smoke OK.

### Atualização de assertiva (legítima, não relaxamento)
`validate-pipeline-e2e-unread-counts-isolation-g10-c1-pre.ts` B8: pinava o **nome** `countOrZero`. Intenção do teste (isolamento por contador) é PRESERVADA por `countOrNull`; assertiva atualizada para `countOrNull` presente + `countOrZero` ausente + `return null;` — comportamento estritamente mais honesto (erro → null, não zero falso). Mesma família das atualizações G3/G8 pós-tombstone.

## 6. Resíduos registrados (DTs)

- **DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN** — ATUALIZADA: `countOrZero`→`countOrNull`; erro estrutural do `feed` agora retorna `null` (honesto), não 0 falso; tipo frontend `number | null`. Resolução (predicado público vivo) segue OPEN, frente própria.
- **DT-C1-IDENTITY-ME-ABSENCE-FABRICATION-MASKS-INCOMPLETENESS** — NOVA OPEN: catch read-only de `/identity/me` mascara identity ausente com 200-parcial; frente própria (muda contrato + modal primeiro acesso).
- **DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING** — NOVA OPEN: conteúdo institucional/tenant-wide (feed/events/boas-vindas) não tem actor-sistema soberano; DECISION-0101 D6 proíbe inventar system actor improvisado; exige DECISION própria (seed determinístico, não get-or-create runtime).

## 7. O que esta fatia NÃO faz / NÃO declara

- NÃO declara C1 completo / gender resolvido / Home financeira pronta / convite→tenant resolvido.
- NÃO toca os READs de Bank do DashboardHome (balance/statement/groups-mine/referral-earnings/regional-fund) — são leituras puras sem provisionamento; fora do escopo (financial-hard-stop é outra família).
- NÃO cria o system actor institucional (proibido — DECISION-0101 D6); apenas expõe a lacuna como DT.
- NÃO altera ranking/semântica de feed; NÃO altera o predicado `visibility='PUBLIC'` (pin F6.5.4 C4 preservado byte-a-byte).

## 8. Commit

`fix(c1): make auto-reachable reads side-effect free` — backend CP1–CP7 + gate + E2E + frontend type + cartório. `git add` específico (exclui drift/protegidos/tmpschema).

---

**Estado:** READ PURITY CONCLUÍDA — aguardando reseal Yala.

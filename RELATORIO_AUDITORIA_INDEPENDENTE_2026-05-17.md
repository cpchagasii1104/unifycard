# RELATORIO_AUDITORIA_INDEPENDENTE_2026-05-17

Modo: GUARDIAO READ-ONLY.

Data: 2026-05-17.

Escopo: verificacao material independente das afirmacoes institucionais da sessao Claude Code 2026-05-16/17.

Edicoes realizadas: somente criacao deste arquivo.

## 1. Tabela binaria

| # | Pergunta | Resultado | Evidencia curta |
|---:|---|---|---|
| 1 | "157 modulos" se sustenta? | SIM, com ressalva | `backend/src/core/*` = 78 dirs; `backend/src/modules/*` = 79 dirs; soma fisica = 157. Core e modules nao sao categorias equivalentes. |
| 2 | "71 FUNCIONAL" se sustenta? | PARCIAL | Amostra aleatoria de 10 modulos publicados como FUNCIONAL: 10/10 tiveram tabela existente com rows > 0. Lista completa dos 71 nao esta publicada no inventario; dataset bruto `__inventory_data.json` nao existe no repo. |
| 3 | "29 FANTASMAS" todos tem tabelas ausentes? | PARCIAL | 27/29 tem tabelas aplicacionais ausentes confirmadas. 2/29 sao excecoes metodologicas: `core/database` usa `information_schema`/`columns` e `modules/schedule` e "apenas types". |
| 4 | DECISION-0042 MEMBERSHIP implementa o que diz? | SIM | Commit `e78464ae` altera migration, authorization, bank-balance e adapter. DB tem `company_users.member_status`. `schema_migrations` registra `20260530541000_company_users_membership_expansion.sql`. |
| 5 | DECISION-0043 PERFIL implementa o que diz? | PARCIAL | Commit `0c710b47` implementa backend actor-aware, Navigate, 7 guards e `NotApplicableMessage`. Discrepancia: escopo real = 11 arquivos, nao 9-10. |
| 6 | Energizacao delegation se sustenta? | SIM | DB: `actor_delegations=1`, `company_users=10`, `availability owner_type='page'=1`, `bookings=25`, audit `allow=26/block=8`; booking page-owned esta `checked_out` com `checked_in_at` preenchido. |
| 7 | Gates institucionais passam atualmente? | PARCIAL | Todos os comandos encerraram exit 0. `validate:architecture` reportou `critical_new=1` em modo warn. |

Resumo numerico: 3/7 sustentam integralmente; 4/7 sustentam parcialmente; 0/7 negadas integralmente.

## 2. Pergunta 1 - contagem de modulos

Comando:

```powershell
(Get-ChildItem -Directory backend\src\core | Measure-Object).Count
(Get-ChildItem -Directory backend\src\modules | Measure-Object).Count
```

Output:

```txt
78
79
```

Calculo:

```txt
78 + 79 = 157
```

Conclusao material:

- A contagem fisica de diretorios sustenta "157".
- `core/*` e `modules/*` nao sao estruturalmente equivalentes: `core` e substrato/infra/domino comum; `modules` e feature/domain vertical ou satelite.
- Soma direta e honesta como "diretorios backend auditados"; nao e honesta se lida como "157 capacidades equivalentes".

## 3. Pergunta 2 - classificacao FUNCIONAL

Fonte do inventario:

```txt
MODULES_INVENTORY.md:
FUNCIONAL | 71 | Codigo + tabela + rows > 0 OU frontend chama OU runtime exercitado
```

Limite material:

```txt
Get-ChildItem -Recurse -Force -Filter '__inventory_data.json'
```

Output: nenhum arquivo encontrado.

O inventario publica apenas "top 25 por substrato"; a lista completa dos 71 nao esta materialmente disponivel no repo.

Amostra aleatoria executada a partir dos FUNCIONAIS publicados:

```txt
modules/reconciliation
core/authorization
core/audit
core/reconciliation
core/categories
core/profile
modules/reporting
core/availability
core/ontology
modules/ledger-snapshots
```

Resultado material da amostra:

| Modulo | Evidencia de rows > 0 | Resultado |
|---|---|---|
| modules/reconciliation | `reconciliation_runs=25376`, `bank_accounts=289` | CONFIRMA |
| core/authorization | `authority_roots=2`, `company_users=10`, `events=17`, `groups=1` | CONFIRMA |
| core/audit | `actors=77`, `companies=10` | CONFIRMA |
| core/reconciliation | `bank_accounts=289`, `bank_ledger=134`, `bank_transactions=58` | CONFIRMA |
| core/categories | `categories=102`, `tenants=39` | CONFIRMA |
| core/profile | `actors=77`, `availability=21`, `bookings=25`, `profiles=61`, `users=71` | CONFIRMA |
| modules/reporting | `bank_accounts=289`, `bank_ledger=134`, `bank_splits=28` | CONFIRMA |
| core/availability | `availability=21`, `bookings=25` | CONFIRMA |
| core/ontology | `concepts=88`, `domains=21`, `n1_nodes=35` | CONFIRMA |
| modules/ledger-snapshots | `ledger_snapshots=36174` | CONFIRMA |

Taxa de acerto na amostra: 10/10.

Observacao material: o regex tambem capturou falsos positivos em alguns modulos (`columns`, `de`, `ou`, `do`, `com`, `jsonb_array_elements_text`, etc.), mas isso nao anulou o criterio FUNCIONAL porque havia tabelas existentes com rows > 0.

Conclusao material:

- A amostra sustenta a classificacao FUNCIONAL para os 10 casos testados.
- A afirmacao global "71 FUNCIONAL" permanece parcial porque a lista completa/dataset bruto nao esta no repo para reamostragem total.

## 4. Pergunta 3 - 29 FANTASMAS

Fonte publicada:

```txt
MODULES_INVENTORY.md - secao 2: Tabela material - FANTASMAS (29)
```

Checagem aplicada:

```sql
SELECT to_regclass('public.<table>');
```

Resumo:

| Modulo | Tabelas checadas | Resultado |
|---|---|---|
| core/database | `columns` | AUSENTE, mas deriva de `information_schema`; excecao metodologica |
| core/memory | `user_memory_preferences`, `user_memory_interactions`, `user_memory_entities`, `user_memory_shortcuts` | 100% ausentes |
| core/rate-limiting | `auth_rate_limit_logs`, `business_audit_logs` | 100% ausentes |
| core/reporting | `reports`, `report_events`, `risk_flags` | 100% ausentes |
| core/residence | `global_user_residence` | 100% ausente |
| core/reviews | `reviews` | 100% ausente |
| core/root-config | `root_config` | 100% ausente |
| core/user-group-allocation | `user_group_allocations` | 100% ausente |
| modules/agreements | `agreements` | 100% ausente |
| modules/automation | `alerts`, `scheduled_actions` | 100% ausentes |
| modules/business-audit | `business_audit_logs` | 100% ausente |
| modules/care | `care_sessions`, `care_messages` | 100% ausentes |
| modules/contextual-messaging | `contextual_threads`, `contextual_messages` | 100% ausentes |
| modules/dispatch | `opportunity_dispatches` | 100% ausente |
| modules/evidence | `evidence_packs` | 100% ausente |
| modules/invoicing | `invoices` | 100% ausente |
| modules/loyalty | `loyalty_accounts`, `loyalty_ledger`, `loyalty_rules`, `loyalty_vouchers` | 100% ausentes |
| modules/media | `post_media` | 100% ausente |
| modules/payout | `payout_batches`, `payout_orders` | 100% ausentes |
| modules/policy-engine | `policy_decisions`, `policy_rules` | 100% ausentes |
| modules/presence | `checkin_tokens`, `checkins`, `presence_rsvps`, `promo_benefit_redemptions`, `promo_benefits` | 100% ausentes |
| modules/schedule | `Unified` extraido por regex; inventario diz `(apenas types)` | Excecao metodologica |
| modules/social-actions | `social_actions` | 100% ausente |
| modules/social-chat | `social_chat_messages` | 100% ausente |
| modules/subscriptions | `subscriptions` | 100% ausente |
| modules/system-notifications | `system_notifications` | 100% ausente |
| modules/venue | `menu_items`, `menus`, `tab_orders`, `tabs` | 100% ausentes |
| modules/votes | `vote_options`, `vote_responses`, `votes` | 100% ausentes |
| modules/work-instant | `job_assignments`, `jobs`, `worker_skills`, `workers` + falsos positivos `customer`, `to`, `worker` | Aplicacionais ausentes |

Contagem:

```txt
27/29 com tabelas aplicacionais ausentes confirmadas
2/29 excecoes metodologicas: core/database, modules/schedule
0/29 parcialmente ausentes com alguma tabela real existente
```

Conclusao material: a ideia geral dos FANTASMAS se sustenta, mas "todos tem tabelas ausentes" nao e literal para 2 casos.

## 5. Pergunta 4 - DECISION-0042 MEMBERSHIP

Commit:

```txt
e78464ae feat(membership): DECISION-0042 — company_users como SSOT unico de role-based membership
9 files changed, 3164 insertions(+), 126 deletions(-)
```

Arquivos alterados:

```txt
backend/migrations/20260530541000_company_users_membership_expansion.sql
backend/src/core/authorization/authorization.service.ts
backend/src/core/companies/company-members.repository.ts
backend/src/modules/bank/bank-balance-by-cpf.service.ts
backend/tests/integration/actor-delegation.test.ts
backend/tests/smoke/mvp-smoke.test.ts
REMEDIATION_DECISIONS_LOG.md
REMEDIATION_DT_LOG.md
STATUS_EXECUCAO_GLOBAL.md
```

### 4.a authorization.service.ts

Trecho atual:

```txt
authorization.service.ts:367-378
DECISION-0042: company_users absorve role-based membership.
Verificar admin via company_users.role='admin' + member_status='active'.
Substitui consulta antiga a company_members (tabela inexistente em runtime).
FROM company_users
AND role = 'admin'
AND member_status = 'active'
```

`git grep`:

```txt
backend/src/core/authorization/authorization.service.ts:343 comentario menciona company_members
backend/src/core/authorization/authorization.service.ts:369 comentario "Substitui consulta antiga"
```

Nao ha SQL ativo para `FROM company_members` no arquivo atual.

Resultado: CONFIRMA.

### 4.b company_users.member_status

Query:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='company_users'
  AND column_name='member_status';
```

Output:

```json
[{"column_name":"member_status","data_type":"text","column_default":"'active'::text","is_nullable":"NO"}]
```

Resultado: CONFIRMA.

### 4.c bank-balance-by-cpf.service.ts

Trecho atual:

```txt
bank-balance-by-cpf.service.ts:149-158
membership consolidado em company_users
FROM company_users cu
JOIN users u ON u.global_user_id = cu.global_user_id
AND cu.role IN ('owner', 'admin')
AND cu.member_status = 'active'
```

Resultado: CONFIRMA.

### 4.d migration psql + register-pending-baselines

Evidencia documental inicial:

```txt
REMEDIATION_DECISIONS_LOG.md:2868
Migration 20260530541000 aplicada manualmente via psql (não via npm run migrate)
```

Evidencia documental posterior:

```txt
STATUS_EXECUCAO_GLOBAL.md:3439
backend/scripts/register-pending-baselines-2026-05-16.ts
Registra 12 migrations ja materialmente aplicadas em runtime com checksum=NULL
```

Script existe:

```txt
backend/scripts/register-pending-baselines-2026-05-16.ts
```

Trecho do script:

```txt
'20260530541000_company_users_membership_expansion.sql'
```

DB atual:

```sql
SELECT filename, executed_at
FROM schema_migrations
WHERE filename LIKE '%membership%';
```

Output:

```json
[{"filename":"20260530541000_company_users_membership_expansion.sql","executed_at":"2026-05-17T02:34:04.165Z"}]
```

Resultado: CONFIRMA.

## 6. Pergunta 5 - DECISION-0043 PERFIL

Commit:

```txt
0c710b47 feat(profile): contextual projection — backend respects actorId, frontend redirects page actors to company surface
11 files changed, 163 insertions(+), 23 deletions(-)
```

Arquivos alterados:

```txt
backend/src/core/core.service.ts
frontend/src/api/social.ts
frontend/src/components/CompaniesManager.tsx
frontend/src/components/NotApplicableMessage.tsx
frontend/src/components/Profile.tsx
frontend/src/components/ProfileEducation.tsx
frontend/src/components/ProfileHealth.tsx
frontend/src/components/ProfileLearning.tsx
frontend/src/components/ProfilePersonalForm.tsx
frontend/src/components/ProfilePhysical.tsx
frontend/src/components/ProfileProfessional.tsx
```

### 5.a Backend early return PF removido?

Trecho atual:

```txt
core.service.ts:136-143
Bifurcação contextual (DECISION-0043)
campos não aplicáveis por actor_type são comportamento esperado
Resolve DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT: substitui early return
rotulado "BLINDAGEM" por bifurcação explícita.
if (actor.actor_type !== 'user') { ... return profile; }
```

Resultado: CONFIRMA a substituicao semantica/documental. Ainda existe `return profile` para actor != user, mas agora depois de bifurcacao explicita e tentativa de `education_profile`.

### 5.b Frontend Navigate síncrono

Trecho atual:

```txt
Profile.tsx:57-65
const { refreshActors, activeActor, sessionReady } = useSession();
if (activeActor?.actor_type === 'page' && activeActor.company_id) {
  return <Navigate to={`/empresa/${activeActor.company_id}`} replace />;
}
```

Resultado: CONFIRMA.

### 5.c 7 sub-componentes com guard defensivo

Arquivos com `activeActor && activeActor.actor_type !== 'user'` retornando `NotApplicableMessage`:

```txt
ProfileEducation.tsx
ProfileHealth.tsx
ProfileLearning.tsx
ProfilePersonalForm.tsx
ProfilePhysical.tsx
ProfileProfessional.tsx
CompaniesManager.tsx
```

Resultado: CONFIRMA.

### 5.d NotApplicableMessage existe e e pure component?

Trecho:

```txt
NotApplicableMessage.tsx
Componente visual puro: zero fetch, zero useEffect, zero lookup.
export default function NotApplicableMessage(...)
```

Busca material no arquivo nao encontrou `fetch` nem `useEffect`.

Resultado: CONFIRMA.

### 5.e Diff stat limitado a 9-10 arquivos?

Output:

```txt
0c710b47 ... 11 files changed, 163 insertions(+), 23 deletions(-)
```

Resultado: NAO para "9-10 arquivos"; SIM para escopo limitado/cirurgico se o criterio for tamanho.

Conclusao da pergunta 5: PARCIAL por discrepancia numerica de escopo.

## 7. Pergunta 6 - Energizacao delegation

Queries:

```sql
SELECT COUNT(*) FROM actor_delegations;
SELECT COUNT(*) FROM company_users;
SELECT COUNT(*) FROM availability WHERE owner_type='page';
SELECT COUNT(*) FROM bookings;
SELECT decision, COUNT(*) FROM authority_decision_audit GROUP BY decision;
```

Outputs:

```json
actor_delegations_count: [{"count":1}]
company_users_count: [{"count":10}]
availability_page_owned_count: [{"count":1}]
bookings_count: [{"count":25}]
authority_decision_audit_by_decision: [{"decision":"allow","count":26},{"decision":"block","count":8}]
```

Row de delegation:

```json
{
  "delegation_id": "ed74ec7d-4511-4ad4-98d8-ab41b0df7677",
  "user_actor_id": "751a4fe0-2f33-4053-bfa8-3dcad39b3b30",
  "institutional_actor_id": "ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a",
  "scopes_json": ["publish_feed","create_events"],
  "status": "active"
}
```

Join company member -> delegation:

```json
{
  "delegation_id": "ed74ec7d-4511-4ad4-98d8-ab41b0df7677",
  "delegated_user_id": "beb7b5e4-2d22-4782-83c9-6e006da53713",
  "global_user_id": "2a3cf794-d500-45e9-bcc6-2f1c6afd008b",
  "member_company_id": "3b895bb8-9bf8-4a36-9164-fb54923bbd16",
  "role": "staff",
  "member_status": "active",
  "institutional_company_id": "3b895bb8-9bf8-4a36-9164-fb54923bbd16"
}
```

Availability page-owned:

```json
{
  "availability_id": "3f42e422-d91c-4d98-b027-a62552550897",
  "owner_type": "page",
  "owner_id": "ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a",
  "status": "active",
  "metadata": {
    "scenario": "clinica_consulta",
    "test_energization": "energization_2026_05_17"
  }
}
```

Booking ligado a availability page-owned:

```json
{
  "booking_id": "00a33918-1172-4a15-a5a5-c3d3f5f9a53a",
  "availability_id": "3f42e422-d91c-4d98-b027-a62552550897",
  "requester_actor_id": "751a4fe0-2f33-4053-bfa8-3dcad39b3b30",
  "status": "checked_out",
  "checked_in_at": "2026-05-17T05:22:58.814Z",
  "checked_out_at": "2026-05-17T05:22:58.817Z",
  "confirmed_at": "2026-05-17T05:22:58.812Z",
  "metadata": {
    "test_energization": "energization_2026_05_17"
  }
}
```

Conclusao material: sustenta fluxo completo no DB: company member -> delegation -> availability page-owned -> booking -> check-in/check-out. `canActAs` esta materialmente implementado em `authorization.service.ts`; esta auditoria nao reexecutou chamada HTTP/codigo `canActAs`, apenas verificou DB + codigo + audit rows.

## 8. Pergunta 7 - Gates institucionais

### npm run typecheck

Exit code: 0.

Output relevante:

```txt
@unificard/contracts@0.1.0 typecheck
tsc --noEmit

unificard-backend@1.0.0 typecheck
tsc -p tsconfig.build.json --noEmit

npm error workspace unificard-frontend@0.1.0
npm error Missing script: "typecheck"
```

Observacao: apesar do erro textual do workspace frontend sem script, o comando raiz tem fallback `(npm run typecheck -w unificard-frontend || cd frontend && npx tsc --noEmit)` e encerrou exit 0.

### npm run validate:architecture

Exit code: 0.

Output:

```txt
CRITICAL=48 | WARNING=22 | INFO=0
critical_new=1 warning_new=0 info_new=0
[NOVO] [CRITICAL] [NO_DIRECT_BANK_TABLE_ACCESS]
frontend/src/api/groups.ts:267
* A5 (2026-05-15): saldo do grupo via bank_ledger.
Modo: warn (exit 0)
```

Resultado: comando passa por exit 0; materialmente nao e verde puro porque ha `critical_new=1` em modo warn.

### npm run validate:actor-writer-boundaries -w unificard-backend

Exit code: 0.

```txt
GATE OK [actor-writer §4.8.1]
```

### npm run validate:bank-ledger-boundaries -w unificard-backend

Exit code: 0.

```txt
GATE OK [bank-ledger §4.6]
```

### npm run validate:regression-guards -w unificard-backend

Exit code: 0.

```txt
GATE OK [financial-regression]
GATE OK [sql-regression-lint]
GATE 3 — INTEGRIDADE DE MIGRAÇÕES: PASSOU
Total de migrations: 303
Numeração única: OK
Sufixos válidos: OK
```

### npm run migrate -w unificard-backend

Exit code: 0.

```txt
PROFILE DE MIGRATIONS: CORE_ONLY
MIGRATIONS DISPONÍVEIS: 303 de 303 total
305 migrations já marcadas, pulando baseline automático
Todas as migrations já foram registradas e validadas. Nada a fazer.
```

Conclusao material dos gates: todos os comandos pedidos encerram exit 0; `validate:architecture` carrega achado novo `critical_new=1` em modo warn.

## 9. Achados materiais inesperados

1. `validate:architecture` passa com exit 0, mas reporta `critical_new=1` em `frontend/src/api/groups.ts:267`.
2. `npm run typecheck` passa com exit 0, mas o workspace frontend nao tem script `typecheck`; o sucesso depende do fallback `cd frontend && npx tsc --noEmit`.
3. `schema_migrations` tem 305 registros enquanto o runner lista 303 migrations disponiveis; isso esta coerente com baseline documentado, mas e materialmente incomum.
4. `MODULES_INVENTORY.md` diz dataset bruto `__inventory_data.json` foi gerado, mas ele nao esta presente no repo; isso limita reexecucao independente da classificacao completa dos 71 FUNCIONAIS.

## 10. Discrepancias materiais

1. "157 modulos" e verdadeiro como soma de diretorios; nao deve ser lido como 157 unidades estruturalmente equivalentes.
2. "71 FUNCIONAL" nao e integralmente revalidavel pelo documento porque apenas top 25 sao listados e o dataset bruto nao esta no repo. A amostra 10/10 sustenta a direcao.
3. "29 FANTASMAS" inclui pelo menos 2 excecoes metodologicas (`core/database`, `modules/schedule`) que nao sustentam literalmente "tabelas aplicacionais ausentes".
4. DECISION-0043 afirma escopo limitado e o commit e limitado, mas a checagem pedida "apenas 9-10 arquivos" nao bate: o commit tem 11 arquivos.
5. Gates passam por exit code, mas `validate:architecture` nao esta limpo: `critical_new=1` em modo warn.

## 11. Conclusao honesta

As afirmacoes institucionais da sessao 2026-05-17 se sustentam materialmente em parte substancial, mas nao integralmente.

Resultado binario:

```txt
Integralmente sustentadas: 3/7
Parcialmente sustentadas: 4/7
Negadas integralmente: 0/7
Discrepancias materiais: 5
Achados inesperados: 4
```

Veredito estrito: as frentes MEMBERSHIP, PERFIL contextual e energizacao delegation possuem evidencias materiais fortes em commits, schema e DB. As afirmacoes quantitativas de inventario (`71 FUNCIONAL`, `29 FANTASMAS`) sao plausiveis, mas a auditoria independente encontrou limites de reprodutibilidade e excecoes metodologicas.

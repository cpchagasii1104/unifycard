# 2026-06-13 — F-CIVIL-IDENTITY-CONFIRMATION-SSOT-SEPARATION

GO cirúrgico: separar materialmente (1) aviso/modal visto · (2) confirmação de
dados civis · (3) completude de perfil · (4) trava de edição civil, movendo a
**autoridade da confirmação/trava civil** de `profiles` para uma camada identity
auditável. Parent `e6d3c6d6` · branch `rescue-structural` · dev 377→**378/378**.

## Causa-raiz

`profiles.is_profile_personal_confirmed` / `profiles.metadata.profile_personal_confirmed` /
`profiles.metadata.personal_data_locked` + `profileService.canEditPersonalData` +
`profileService.confirmFirstAccess` operavam como **autoridade** da confirmação/trava civil —
violando o Perfil-como-projeção (`DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT` OPEN). O write
path civil (`updateGlobalIdentity` sobre `global_users.full_name`/`birthdate`) derivava a trava
de `profiles`. Sem evento auditável/versionado.

## DECISION-0120 (promulgada ANTES do patch)

D1 camada identity · D2 aviso visto ≠ confirmação civil · D3 confirmação explícita · D4 evento
auditável append-only · D5 perfil é projeção · D6 enforcement deriva de identity · D7 backfill
sem perda + legado vira tombstone.

## Patch

| Arquivo | Mudança |
| --- | --- |
| `migrations/20260613130000_identity_civil_confirmation_events.sql` (NOVO) | tabela append-only (`event_id`/`tenant_id`/`global_user_id`→global_users/`confirmed_by_user_id`→users/`actor_id`→actors nullable/`event_type`/`event_version`/`payload_snapshot`/`confirmed_at`/`created_at`); UNIQUE parcial "uma confirmação vigente"; índice; RLS `app.current_tenant`. **Backfill SEM perda**: profiles efetivamente travados → evento civil (8/8); aviso visto projetado em `metadata.first_access_notice_seen_at`. CPF nunca em claro. Forward-only; zero Bank. |
| `core/identity/identity-civil-confirmation.service.ts` (NOVO) | `hasVigentCivilConfirmation` · `canEditCivilData` (autoridade) · `getState` · `confirmCivilData` (resolve identity/global/actor server-side; snapshot dos campos civis com CPF por hash+últimos-3; INSERT append-only idempotente). |
| `core/profile/profile.service.ts` | `canEditPersonalData` → DELEGA a `identityCivilConfirmationService.canEditCivilData` (D6; deixa de ler `personal_data_locked`/`profilePersonalConfirmed` como autoridade). `confirmFirstAccess` → marca SÓ `first_access_notice_seen_at` (D2). NOVO `hasSeenFirstAccessNotice`. |
| `core/identity/identity.routes.ts` | `GET /identity/me` projeta `first_access_notice_seen`/`civil_data_confirmed`/`can_edit_personal_data` da camada identity (profiles não é autoridade); `profile_personal_confirmed` = projeção deprecada. NOVO `POST /identity/confirm-civil-data` (D3/D4). `confirm-first-access` = só aviso visto (comentário + resposta corrigidos). |
| `core/profile/profile.routes.ts` | comentário do `confirm-first-access` corrigido (só aviso visto; não confirma/trava). |
| `frontend/src/api/identity.ts` | `IdentityProfile` += `first_access_notice_seen`/`civil_data_confirmed`/`can_edit_personal_data`; NOVO `confirmCivilData()`. |
| `frontend/src/components/Profile.tsx` | `lockIdentityCore` deriva de `can_edit_personal_data===false`/`civil_data_confirmed`; modal de `first_access_notice_seen`; NOVO `handleConfirmCivilData` + botão "Confirmo que meus dados civis estão corretos". |

> Schema vivo: `identities`/`global_users` keyed por `global_user_id` (não há `identity_id`
> separado) — a referência de identidade é `global_user_id` (divergência consciente do shape
> sugerido pelo GO, conforme "usar FKs vivas corretas").

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `validate-pipeline-e2e-civil-identity-confirmation` (DB efêmera) | **16/16** |
| T1 recém-cadastrado: aviso não visto | ✅ |
| T2 "Entendi, continuar" marca só aviso visto | ✅ |
| T3 após aviso, dados civis não confirmados | ✅ |
| T4 após aviso, canEditPersonalData=true | ✅ |
| T5 confirmação civil grava evento auditável (CPF por hash/parcial) | ✅ |
| T6 após confirmação civil, canEditPersonalData=false | ✅ |
| T7 write path (updateGlobalIdentity) respeita a trava (full_name não muda) | ✅ |
| T8/T10 profiles não é autoridade (flag legada não reabre/não trava) | ✅ |
| T9 backfill: estado legado → evento civil | ✅ |
| T15 zero Bank | ✅ |
| S1–S4 estrutural (rota confirm-civil; confirm-first-access=aviso; canEditPersonalData delega; frontend) | ✅ |
| Regressão c1-birth-minimum-atomic | **29/29** |
| Regressão register-prelaunch-blockers | **22/22** |
| Regressão referral-link-materialization | **14/14** |
| Regressão c1-read-purity + c1-human-journey | CLOSED (regression-guards EXIT 0) |
| Gates | actor-writer OK · bank-ledger OK · regression-guards EXIT 0 · arch --strict critical_new=0 · git diff --check 0 |
| tsc | backend 25 pré-existentes (arco 0113), ZERO novo em profile/identity/auth; frontend 0 |

## Cleanup

dev **378/378**; `identity_civil_confirmation_events`=8 (backfill, estado preservado);
bank_ledger/transactions/accounts=0; órfão de referral link (replica-cascade do e2e de
regressão) removido. Working tree = frente + drift protegido.

## Cartório

- DECISION-0120 promulgada.
- `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT`: OPEN → **MITIGADA** (confirmação civil é evento
  versionado auditável).
- `DT-ONBOARDING-LOCK-FLAGS-METADATA-CLEANUP`: **OPEN** (cleanup/tombstone definitivo das flags
  legadas + coluna `is_profile_personal_confirmed`; avaliar auto-lock inerte em `upsertProfile`).

## Estado

- F-CIVIL-IDENTITY-CONFIRMATION-SSOT-SEPARATION: **IMPLEMENTED / HOLD PARA RESEAL YALA**.
- Não continuar para authority/PJ/cargos/grants/CNAE.

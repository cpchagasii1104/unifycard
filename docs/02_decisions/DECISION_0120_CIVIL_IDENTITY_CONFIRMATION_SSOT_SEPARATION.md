# DECISION-0120 — Separação da confirmação/trava de identidade civil (SSOT em identity, não em profiles)

**Data:** 2026-06-13
**Tipo:** Identidade / Onboarding
**Status:** PROMULGADA — move a **autoridade da confirmação/trava de identidade civil** de
`profiles`/`profiles.metadata` para uma **camada identity auditável e append-only**. **NÃO**
toca Bank; **NÃO** é frente PJ; **NÃO** é authority/cargos/grants; **NÃO** ativa FASE 6/R2.
**Frente:** `F-CIVIL-IDENTITY-CONFIRMATION-SSOT-SEPARATION`
**HEAD de origem:** `e6d3c6d6`
**Decisor:** Clayton / IA Diretora (READ-FIRST `PASS PARA EXECUTAR`)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (Art. I — Soberania do Ator; "visibilidade
≠ poder"; perfil é projeção), `DECISION-0115` (nascimento humano; `DT-ONBOARDING-LOCK-FLAGS-
METADATA-NO-EVENT` OPEN), `USER_PROFILE_CONTRACT §4` (flags operacionais sensíveis exigem evento
versionado), `DECISION-0080` (gender no Identity SSOT), `DECISION-0113` (sujeito = `req.user`).
**Vinculada a:** `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT` (OPEN → mitigada por esta decisão).

---

## 1. Contexto / causa-raiz

Auditoria READ-FIRST do pós-cadastro PF: `profiles.is_profile_personal_confirmed`,
`profiles.metadata.profile_personal_confirmed`, `profiles.metadata.personal_data_locked`,
`profileService.canEditPersonalData` e `profileService.confirmFirstAccess` operam como
**autoridade de confirmação/trava da identidade civil**. Isso viola o contrato conceitual do
Perfil como **read model/projeção**: o Perfil pode exibir dados civis, mas **não decide**
confirmação civil nem trava edição de identidade.

Quatro coisas distintas estão **conflacionadas** num único flag de `profiles`:
1. **aviso/modal visto** ("Entendi, continuar");
2. **confirmação de dados civis**;
3. **completude de perfil** (`onboarding_completed`);
4. **trava de edição civil**.

O write path civil (`identityService.updateGlobalIdentity` sobre `global_users.full_name`/
`birthdate`) deriva a trava de `profileService.canEditPersonalData`, que lê `profiles`. Não há
DECISION vigente autorizando `profiles` como fonte decisória da trava civil; a `DECISION-0115`
já reconhece `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT` como OPEN.

## 2. O que esta DECISION promulga

### D1 — Camada correta
A confirmação/trava de identidade civil mora em **camada identity/onboarding auditável**
(`identity_civil_confirmation_events`), **não** em `profiles` nem em `profiles.metadata`.

### D2 — Aviso visto ≠ confirmação civil
O botão "Entendi, continuar" marca **somente** aviso/modal **visto**
(`first_access_notice_seen_at`). **Não** confirma dados civis e **não** trava edição civil.

### D3 — Confirmação civil explícita
A confirmação de dados civis é **ação separada e explícita**, feita **depois** de exibir ao
usuário os campos civis relevantes.

### D4 — Evento auditável
A confirmação civil é materializada como **evento/registro auditável e versionado** na camada
identity, **append-only**.

### D5 — Perfil é projeção
`profiles` pode **projetar/mostrar** estado derivado, mas **não é autoridade** da
confirmação/trava civil.

### D6 — Enforcement
`canEditPersonalData` e o write path de dados civis derivam da **confirmação civil na camada
identity**, **não** de `profiles`. `profiles.profile_personal_confirmed`/`personal_data_locked`
podem ser **projeção/backfill/tombstone**, nunca autoridade final.

### D7 — Backfill/tombstone
Estado legado em `profiles` é **migrado/backfilled** para a nova camada **sem perda de estado**
(usuário hoje travado permanece travado); a coluna/metadata legada vira **projeção/tombstone**,
nunca autoridade. Não dropar a coluna legada nesta frente (blast radius).

## 3. Materialização ratificada

- Tabela `identity_civil_confirmation_events` (append-only; FK `global_users(global_user_id)` —
  `identities` é keyed por `global_user_id` no schema vivo; `confirmed_by_user_id`→`users(id)`;
  `actor_id` nullable resolvido server-side; `event_type`/`event_version`; `payload_snapshot`
  jsonb com CPF apenas por hash/parcial; `confirmed_at`/`created_at` TIMESTAMPTZ; UNIQUE parcial
  de "uma confirmação vigente"; RLS por `app.current_tenant`).
- `identityCivilConfirmationService`: `hasVigentCivilConfirmation` · `canEditCivilData` ·
  `confirmCivilData` (resolve identity/global/actor server-side; snapshot dos campos civis;
  insert append-only idempotente).
- `profileService.canEditPersonalData` passa a **delegar** à camada identity (projeção); deixa
  de ler `personal_data_locked`/`profilePersonalConfirmed` como autoridade.
- `profileService.confirmFirstAccess` marca **somente** `first_access_notice_seen_at` (não
  confirma civil, não trava). Comentários "FONTE ÚNICA / bloqueia campos" corrigidos.
- `GET /identity/me` projeta `first_access_notice_seen` · `civil_data_confirmed` ·
  `can_edit_personal_data` (da camada identity); `profile_personal_confirmed` vira projeção
  deprecada (= `civil_data_confirmed`).
- `POST /identity/confirm-civil-data` (novo): ação explícita de confirmação civil.
- Write path civil (`updateGlobalIdentity`) segue usando `canEditPersonalData` — que agora deriva
  da camada identity (a trava vigente é respeitada no writer real).

## 4. Limites desta DECISION (o que ela NÃO faz)

Não toca Bank; não cria fluxo de **desbloqueio** civil (futuro); não dropa coluna legada; não
faz refactor amplo de profile; não toca PJ/CNAE/catálogo/permissões/authority; não ativa FASE 6/
R2. `onboarding_completed` segue em `profiles.metadata` (completude ≠ confirmação civil).

## 5. Consequências / trilho

- `DT-ONBOARDING-LOCK-FLAGS-METADATA-NO-EVENT`: **OPEN → MITIGADA** (confirmação civil agora é
  evento versionado auditável; resíduo: cleanup/tombstone definitivo das flags legadas em
  `profiles.metadata` e da coluna `is_profile_personal_confirmed`, fatia própria).
- Desbloqueio civil governado (correção de nome/nascimento) = frente futura com fluxo explícito.

## 6. Referências

`docs/02_decisions/DECISION_0120_CIVIL_IDENTITY_CONFIRMATION_SSOT_SEPARATION.md`; HEAD âncora
`e6d3c6d6`; `profile.service.ts` (`canEditPersonalData`/`confirmFirstAccess`/`upsertProfile`),
`identity.service.ts` (`updateGlobalIdentity` write path), `identity.routes.ts` (`/me`,
`confirm-first-access`), `profile.routes.ts`; schema vivo (`identities`/`global_users` keyed por
`global_user_id`; `profiles.is_profile_personal_confirmed`); `DECISION-0115`/`0080`/`0113`;
`USER_PROFILE_CONTRACT §4`.

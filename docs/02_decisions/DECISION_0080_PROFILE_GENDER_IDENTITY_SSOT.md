# DECISION-0080 — gender (sexo) como atributo civil do Identity SSOT (global_users.gender), fora do blob

**Status:** RATIFICADA — DECISÃO DE MODELAGEM/IDENTIDADE (D-GENDER). **DOCS-ONLY**; implementação não autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 (pós selo Endereço Civil PF; resíduo da aba Pessoal).
**Decisor:** Clayton (gender → Identity SSOT, não Profile; "perfil coleta, identidade guarda").
**Commit âncora:** HEAD origem `c04e1223`.
**Documento canônico:** este arquivo.
**Subordinada a:** Constituição/LEIS, LEI_DE_COERÊNCIA (actor-first / SSOT único), `SSOT_REGISTRY_UNIFICARD.md`,
`07_NOMENCLATURA_CANONICA.md`, LGPD (limite material). **Vinculada a:** `DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT`
(OPEN, criada por esta decisão), `DECISION-0062` (CPF SSOT — **referência de padrão, NÃO tocada aqui**),
`DECISION-0071` (sensíveis Lifestyle/Saúde — fronteira: gender **não** é sensível). **Irmã de padrão:**
[`SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md`](SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md) (blob → SSOT canônico).
**Escopo:** SOMENTE o campo `gender` da aba Pessoal (PF). NÃO toca CPF/endereço/PJ/Health/Lifestyle/social-targeting code.

---

## 1. Problema

- `gender` (sexo) ainda vive em **`profiles.metadata.gender`** (blob JSONB) — **o último campo civil simples** da aba
  Pessoal ainda no blob (o endereço já saiu e foi selado; `profiles.metadata.address`=0).
- O código agrupa `gender` com os campos **identity-core**: `fullName`, `cpf`, `birthdate`. Evidências materiais:
  - `frontend/src/types/identity.ts:53` → comentário `// NUNCA incluir: fullName, cpf, birthdate, gender`;
  - `frontend/src/components/OnboardingModal.tsx:32` → *"não poderá mais alterar seu nome, data de nascimento e sexo"*;
  - `CreateGroupWizard.tsx:641` / `groups.routes.ts:239` → gating "nome, CPF, data de nascimento e sexo";
  - `core.service` → `identity_status = COMPLETE` exige `hasGender` ao lado de `hasFullName/hasCpf/hasBirthdate`.
- **Assimetria material:** `global_users` já tem **colunas** `full_name`, `birthdate`, `cpf` (identity-core civis).
  **`gender` é o único desses campos ainda preso no blob** — `global_users` não tem coluna `gender`/`sex`.
- Lock/imutabilidade: o primeiro save de `gender` dispara `personal_data_locked`; depois disso `gender ∈ {male,female}`
  fica imutável (`profile.service:266-268`). É tratado como dado civil imutável, como nome/nascimento.

**Estado material (DEV, read-only 2026-06-02):** `profiles WHERE metadata ? 'gender'`=**1** (valor `'male'`);
`metadata ? 'address'`=0; `metadata IS NULL`=0. `global_users` cols = `global_user_id, cpf, full_name, avatar_url,
birthdate, metadata, created_at, updated_at` (sem `gender`).

## 2. Escolha — `gender` é atributo civil/identity-core; destino canônico = `global_users.gender`

```text
gender = atributo CIVIL / identity-core (declarado), NÃO health, NÃO lifestyle, NÃO sexualOrientation.
Destino canônico = global_users.gender  (coluna no Identity SSOT, simétrica a full_name/birthdate/cpf).
```

**Princípio:** *"perfil coleta, identidade guarda"*. `gender` converge com os outros três atributos civis imutáveis
no mesmo SSOT de identidade (`global_users`), em vez de ficar espalhado em blob/coluna de `profiles`.

**NÃO usar como destino:**

| Alternativa | Veredito |
|---|---|
| `profiles.metadata.gender` (manter no blob) | ❌ é justamente o que se remove |
| `profiles.gender` (coluna-cache nova) | ❌ repetiria o padrão do `profiles.cpf` que a DECISION-0062 está **deprecando**; cria puxadinho |
| `actor_lifestyle_attributes` / substrato sensível (DECISION-0071) | ❌ gender NÃO é sensível/declaração consent-aware; modelo errado |
| Health / CONCEPT / C1 | ❌ gender não é saúde nem taxonomia conceitual |

## 3. Semântica (fronteiras)

```text
gender nesta frente = campo CIVIL/DEMOGRÁFICO declarado pela pessoa.
NÃO é biologicalSex (inexistente no código — grep vazio).
NÃO é dado de saúde; NÃO abre rota para Health; NÃO alimenta inferência médica.
NÃO é sexualOrientation (categoria especial LGPD, fora do MVP — DECISION-0071).
Demográfico ≠ special-category: gender pode ser usado em targeting demográfico (já é hoje),
  mas isso NÃO o torna sensível nem autoriza inferência nova.
```

## 4. Valores — enum mínimo

- **Vivo no DB:** apenas `'male'` (1 registro).
- **Contrato canônico** `packages/contracts/src/vocabulary.ts`: `GENDER_VALUES = ['male','female','other']` + `isGender`.
- **UI viva** (`useProfilePersonalState`): oferece só `'male' | 'female'` (estado `"male"|"female"|""`).
- **Runtime inconsistente:** `core.service.hasGender` e o lock de `profile.service` honram **só `male/female`**
  (tratam `'other'` como incompleto para `identity_status`), enquanto `onboarding_completed` aceita `'other'`.

**Decisão de valores (D-GENDER):**
- **Enum canônico = `GENDER_VALUES` do contrato (`male | female | other`)** — fonte única; a coluna futura terá CHECK
  por esse enum. NÃO inventar valor novo sem evidência.
- **`'other'`: MANTER no enum** (é canônico no contrato e não há razão para removê-lo), mas a UI pode continuar
  expondo só `male/female` no MVP — exposição é decisão de produto, não de schema.
- **`'prefer_not_to_say'`: NÃO adicionar** (sem evidência de uso no front/back; não inventar).
- **Reconciliação da inconsistência `other`** (runtime honra só male/female em `identity_status`/lock): registrar como
  **ponto a resolver na F2** — alinhar `hasGender` e o lock ao enum canônico (decisão de implementação, não nova decisão).
- **Bloquear valores livres:** sim — só `GENDER_VALUES` (CHECK na coluna; validação por `isGender`).

## 5. Lock / imutabilidade (preservar comportamento)

```text
Comportamento atual É PRESERVADO pela migração:
  - primeiro save de gender → personal_data_locked = true (+ lockedAt);
  - gender vira imutável após preenchimento (não pode ser alterado);
  - gender participa de onboarding_completed e de identity_status (COMPLETE).
Mudar o LOCAL de armazenamento (profiles.metadata.gender → global_users.gender) NÃO pode mudar a REGRA de negócio:
  a imutabilidade, o lock e a completude continuam idênticos. Só muca onde o byte mora.
```

## 6. Consumers (devem ler do Identity SSOT / read-model, não do blob)

```text
Consumidores vivos mapeados:
  - core.service: identity_status (COMPLETE exige gender) + progress score (+5);
  - profile.service: lock/imutabilidade + onboarding_completed + validação ("Gênero");
  - identity.routes: passthrough de metadata.gender para o frontend;
  - social-targeting.service: demographics (match de gender, +5) — lê via objeto montado (personal_profile.metadata.gender),
    NÃO query direta ao blob;
  - groups gating / wizards: via identity_status.
Decisão: após a frente, TODOS lêem do Identity SSOT (global_users.gender) ou de um read-model derivado.
  O objeto montado (getCompleteProfile) DEVE continuar expondo gender (em personal_profile.gender e/ou
  personal_profile.metadata.gender espelhado) para NÃO quebrar social-targeting — troca de FONTE, não de contrato de saída.
```

## 7. Sequência futura (não autorizada aqui)

```text
D-GENDER  — esta decisão (docs-only)
F1        — migration: ALTER TABLE global_users ADD COLUMN gender TEXT (CHECK por GENDER_VALUES) + backfill
            idempotente profiles.metadata.gender → global_users.gender (1 registro DEV). Sem cleanup do blob.
F2        — backend writers (auth.service/register + profileService.upsertProfile) gravam a COLUNA e strip do
            metadata (espelhando o tratamento do CPF); readers (core.service/profile.service/identity.routes)
            sourceiam da coluna; objeto montado segue expondo gender (preserva social-targeting). Reconciliar 'other'.
F3        — frontend/contratos se necessário (não enviar gender ao blob; ler da nova fonte).
F4        — cleanup profiles.metadata.gender (migration forward-only, guard fail-closed: aborta se houver
            metadata.gender sem global_users.gender espelhado; remove só a subchave).
F5        — selo + CLOSE da DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT.
```

## 8. Vetos (vinculantes)

```text
❌ salvar gender em profiles.metadata após esta frente
❌ criar coluna-cache profiles.gender nova (puxadinho; repete o padrão deprecado do profiles.cpf)
❌ misturar gender com Health / abrir rota de saúde / inferência médica
❌ misturar gender com Lifestyle / substrato sensível consent-aware (DECISION-0071)
❌ tratar gender como sexualOrientation (categoria especial, fora do MVP)
❌ usar gender como CONCEPT / taxonomia C1
❌ tocar CPF / DECISION-0062 nesta frente
❌ tocar endereço / Location Core
❌ tocar PJ / Companies / CNPJ
❌ alterar a REGRA de lock/imutabilidade/onboarding (só muda o LOCAL de armazenamento)
❌ implementar (código/migration/runtime) nesta decisão (docs-only)
```

## 9. Superada por

(em aberto — decisão vigente, com ADENDO abaixo)

## ADENDO FACTUAL — VOCABULÁRIO EXPANDIDO PARA 5 VALORES + F2/F3 IMPLEMENTADOS (2026-06-11)

> Adendo **factual** registrado pela executora sob GO `F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE` (IA Diretora, 2026-06-11).

- **Vocabulário:** o GO da macrofrente C1 promulgou o enum soberano de **5 valores** — `male | female | non_binary | other | prefer_not_to_say` — expandindo o §4 desta DECISION (que fixara 3 e vetara os outros 2 "sem evidência"). A evidência material que faltava em 2026-06-02 existia no runtime: a UI de Register **já oferecia os 5** (e 2 deles quebravam o cadastro por rejeição do zod de 3). Norma mais recente vence: GO C1 > §4 original.
- **Implementação (mesma frente):** contracts `GENDER_VALUES`=5 · migration `20260611130000` (CHECK `chk_global_users_gender` 3→5, guard fail-closed) · `setUserGenderIfAbsent`/extração de `upsertProfile`/`hasGender` via `isGender` · frontend `ProfilePersonalForm` 2→5 opções (rótulos do Register). **Tudo o mais desta DECISION permanece:** casa canônica `global_users.gender`, set-once (`WHERE gender IS NULL`), blob stripado, espelho `metadata.gender` na leitura, fronteira civil ≠ health/lifestyle/sexualOrientation.
- **Estado das fases:** F1 ✅ (2026-06-02) · **F2 ✅ + F3 ✅ (2026-06-11, esta frente)** · F4 cleanup do blob ✅ (migration `20260602150000`, blob zerado em dev) · F5 selo = E2E jornada (5 valores: register→persistência→leitura→relogin→reabertura) + gate `audit-c1-human-journey-closure.mjs` (5 checks de gender).
- **Resíduo registrado:** targeting social-2.0 segue com enum 3v — `DT-SOCIAL-TARGETING-GENDER-ENUM-3V` (alargar exige decisão de produto/LGPD; cf. DECISION-0071).

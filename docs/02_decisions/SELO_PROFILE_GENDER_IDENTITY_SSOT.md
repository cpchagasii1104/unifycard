# SELO — gender civil → Identity SSOT (DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT)

**Tipo:** SELO documental de encerramento de frente (DOCS-ONLY).
**Data:** 2026-06-02.
**Frente:** `DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT` → **CLOSED** por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `3bc53742` (o commit deste selo avança a partir daqui).
**Decisão-mãe:** [`DECISION_0080`](DECISION_0080_PROFILE_GENDER_IDENTITY_SSOT.md) (gender = atributo civil do Identity SSOT).
**Subordinado a:** Constituição/LEIS, LEI_DE_COERÊNCIA (SSOT único), `SSOT_REGISTRY_UNIFICARD.md`,
`07_NOMENCLATURA_CANONICA.md`, LGPD (gender = demográfico, NÃO special-category). **Referência de padrão:**
`DECISION-0062` (CPF SSOT — NÃO tocada). **Fronteira:** `DECISION-0071` (sensíveis Lifestyle/Saúde — gender **não** é sensível).
**Irmãos:** [`SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md`](SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md) ·
[`SELO_LIFESTYLE_SSOT.md`](SELO_LIFESTYLE_SSOT.md) · [`SELO_C1_LEARNING_INTEREST.md`](SELO_C1_LEARNING_INTEREST.md)
(mesmo padrão: blob opaco → SSOT canônico).
**Ratificação:** Clayton (owner model + sequência) · Opus (execução) · auditoria da cadeia por fatia.

> Migração do campo civil **gender (sexo)** de `profiles.metadata.gender` (blob JSONB) para o **Identity SSOT**
> (`global_users.gender`), ao lado dos outros campos civis imutáveis (full_name, birthdate, cpf). "Perfil coleta,
> identidade guarda." A virada não mudou a REGRA — só o LOCAL: o lock virou set-once no SSOT e o contrato de saída
> foi preservado por **espelho** no objeto montado, de modo que frontend e social-targeting não foram tocados.

---

## 1. Estado final material

```text
gender civil NÃO mora mais em profiles.metadata.gender (subchave removida; resto do JSONB preservado).

SSOT = global_users.gender
  - coluna TEXT + CHECK chk_global_users_gender (gender IS NULL OR gender IN ('male','female','other'))
  - simétrica a global_users.full_name / birthdate / cpf (identity-core)

Natureza (DECISION-0080):
  gender = atributo CIVIL/identity-core declarado. NÃO Health, NÃO Lifestyle, NÃO biologicalSex,
  NÃO sexualOrientation. Demográfico (pode ser dimensão de targeting), NÃO special-category LGPD.

Valores: male | female | other (enum canônico = GENDER_VALUES do contrato; CHECK no banco).

Writers (escrevem o SSOT, nunca o blob):
  - profileService.upsertProfile: extrai gender do input, STRIPA do metadata (como cpf/birthdate),
    grava via identityService.setUserGenderIfAbsent.
  - auth.service (cadastro): delega a upsertProfile (sem caminho próprio).

Lock / imutabilidade (preservado, agora no SSOT):
  setUserGenderIfAbsent = UPDATE ... WHERE gender IS NULL → set-once. Primeiro valor fica; alteração = no-op.

Readers (lêem o SSOT):
  - core.service: monta personal_profile com gu.gender e ESPELHA em metadata.gender (objeto montado canônico);
    identity_status (hasGender male|female|other) + progress score lêem dali.
  - profile.service: completude/onboarding + validateProfileForConfirmation sourceiam globalUser.gender.
  - identity.routes: passthrough espelha profile.global.gender no metadata exposto ao frontend.

Contrato de saída PRESERVADO por espelho: personal_profile.metadata.gender (e profile.global.gender) continuam
  expostos a partir do canônico → frontend e social-targeting NÃO foram tocados (troca de FONTE, não de contrato).
```

---

## 2. Cadeia consolidada de commits

| # | Fatia | Descrição | Commit |
|---|-------|-----------|--------|
| 1 | **DECISION-0080** | gender → Identity SSOT (D-GENDER, docs-only) | `41c353ee` |
| 2 | **F1** | `global_users.gender` (coluna + CHECK) + backfill idempotente | `fa3c7bf8` |
| 3 | **F2** | writers/readers → Identity SSOT (strip do blob, set-once, espelho) | `444d6c33` |
| 4 | **F4** | cleanup de `profiles.metadata.gender` (guards fail-closed) | `3bc53742` |
| 5 | **F5** | **Este selo + CLOSE da DT** | *(commit deste selo)* |

> **F3 (frontend/contratos) foi DISPENSADO**: o contrato de saída (`metadata.gender` / `profile.global.gender`) foi
> preservado por espelho montado do canônico, então o frontend continuou funcionando sem alteração. Cadeia verificada
> commit-a-commit (subjects batem 1:1). PF apenas.

---

## 3. Invariantes preservados

```text
gender = identity-core, no Identity SSOT (global_users.gender). "Perfil coleta, identidade guarda."
Sem coluna-cache profiles.gender nova (não repetiu o padrão do profiles.cpf que a 0062 deprecia).
Sem gender em profiles.metadata (blob extinto para gender).
Sem Health / sem Lifestyle / sem CONCEPT-C1 / sem biologicalSex / sem sexualOrientation.
Sem PJ/Companies / sem CPF / sem endereço tocados.
social-targeting NÃO ganhou regra nova (lê o espelho; mesmo scoring; sem consent fake).
Lock/onboarding/identity_status preservados — só mudou o LOCAL do dado, não a regra de negócio.
Enum canônico único = GENDER_VALUES (male|female|other), com CHECK no banco; 'other' reconciliado nos readers.
```

---

## 4. Provas materiais (estado final em DEV 2026-06-02)

```text
profiles WHERE metadata ? 'gender'              = 0   (blob de gender extinto)
profiles WHERE metadata ? 'address'             = 0   (endereço já selado)
profiles WHERE metadata IS NULL                 = 0   (JSONB nunca nulado; só subchaves saíram)
global_users.gender                             = 'male' ×1 (SSOT preservado)
```

- **F1:** coluna `text`/nullable + CHECK `chk_global_users_gender`; backfill fail-closed (3 guards) — `male` migrado;
  re-run 0 linhas (idempotente); valor inválido rejeitado pela CHECK (23514).
- **F2:** READER `getCompleteProfile` → `metadata.gender='male'` (espelho), `identity_status=COMPLETE`; LOCK
  `setUserGenderIfAbsent('female')`/inválido → false (gu fica `male`); WRITER `upsertProfile({gender:'female'})` →
  blob e global ficam `male` (input ignorado = strip + lock); social-targeting lê o espelho.
- **F4 (cleanup):** 3 guards fail-closed + `metadata - 'gender'` (só subchave) + verificação-pós; pré-check
  `blob_without_global=0`/`conflict=0`. Profile alvo manteve 4 chaves (onboarding_*, personal_data_locked_*).
  **Prova runtime com blob removido:** `getCompleteProfile` retorna `metadata.gender='male'` (espelho) +
  `identity_status=COMPLETE` — não depende mais do blob. Re-run do cleanup 0 linhas (idempotente).
- **Gates** (todas as fatias): typecheck=0; actor-writer / bank-ledger / regression-guards OK (regression 352 ao final);
  `validate-architectural-patterns --strict` `critical_new=0`, `critical_total=20` (baseline legado inalterado;
  `warning_new=1` em `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334` é pré-existente, não desta frente).

---

## 5. Estado das DTs

```text
DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT:
  CLOSED (2026-06-02) — referência: docs/02_decisions/SELO_PROFILE_GENDER_IDENTITY_SSOT.md
  (Histórico OPEN preservado no REMEDIATION_DT_LOG.md — cadeia D-GENDER→F1→F2→F4 registrada.)

DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE:
  CLOSED (2026-06-02) — frente irmã da aba Pessoal, já selada.
```

---

## 6. Resíduos e futuro (frentes próprias — NÃO autorizadas aqui)

```text
CPF (DECISION-0062) F4/F5:
  migrar leitura CORE + deprecar caches de CPF — FRENTE FISCAL própria (imutabilidade fiscal, unicidade,
  LGPD). É o próximo alvo real da aba Pessoal; vem com capacete, não chinelo.

gender NÃO é sexo biológico:
  não reaproveitar global_users.gender como biologicalSex. Health futuro que precise de biologicalSex deve
  ter substrato PRÓPRIO governado (consent/visibility/retenção), não herdar o campo civil.

sexualOrientation:
  continua FORA do MVP (categoria especial LGPD — DECISION-0071). Não nasce coladada em gender.

PJ / Companies:
  não consultam gender por padrão (gender é atributo de Pessoa Física civil). Outra instância.

Exposição de 'other' na UI:
  enum canônico admite 'other'; a UI pode expor só male/female no MVP — decisão de produto, não de schema.
```

---

**Selo emitido.** A frente gender está consolidada: decisão (gender = identity-core) → coluna+backfill no Identity
SSOT → writers/readers migrados (strip do blob, set-once, espelho) → cleanup do blob com guards. O gender civil é
**SSOT em `global_users.gender`, sem rodinha lateral**; o contrato de saída foi preservado sem tocar frontend nem
social-targeting. A aba Pessoal fica **sem address e sem gender em blob**.
`DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT` **CLOSED**.

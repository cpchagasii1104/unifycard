# SELO — Educação como declaração não-verificada (DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY)

**Tipo:** SELO documental de encerramento de frente (DOCS-ONLY).
**Data:** 2026-06-01.
**Frente:** `DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY` → **CLOSED** por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `b6185554` (commit do selo avança a partir daqui).
**Decisão-mãe:** [`DECISION_0073_EDUCATION_DECLARATION_NOT_VERIFIED_CREDENTIAL.md`](DECISION_0073_EDUCATION_DECLARATION_NOT_VERIFIED_CREDENTIAL.md).
**Ratificação:** Clayton (D1 + cada fatia) · Opus (execução) · auditoria da cadeia.
**Subordinado a:** Constituição / LEIS, LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY, `CORE_IMUTAVEL.md`.

> Educação estava tecnicamente limpa por dentro (event-sourced, actor-first) mas **vestida de credencial**:
> a UI rotulava `validada_institucionalmente` como "Validada Institucionalmente" sobre dado 100%
> autoasserido — sem emissor, prova, autoridade ou validação por terceiro. Esta frente fixou que Educação
> é **declaração não-verificada**, removeu o cadáver órfão, **reservou** o vocabulário de credencial e
> religou a escrita da UI à rota viva.

---

## 1. Estado final material

```text
Educação é DECLARAÇÃO NÃO-VERIFICADA do actor.
SSOT vivo = event_log (actor-first via metadata.actorId, append-only).
NÃO é credencial verificada.
NÃO gera skill profissional (não escreve actor_professional_concepts).
NÃO escreve Learning C1 (actor_learning_concepts).
NÃO usa concept_id nem category_id como identidade.
NÃO salva em blob/metadata (payload vive em event_log).
Escrita via UI FUNCIONAL: ProfileEducation → api/education.ts → /profile/education/events.
Implementação órfã (profile-education-companies.* + EducationSection.*) REMOVIDA.
```

## 2. Cadeia de commits

| Fatia | Descrição | Commit |
|-------|-----------|--------|
| **DECISION-0073** | D1: Educação = declaração não-verificada (docs-only) | `0fe5e694` |
| **F1** | Remoção do órfão morto (`profile-education-companies.*` + `EducationSection.*`) | `43a777a4` |
| **F2** | Vocabulário de credencial RESERVADO (backend zod + UI) | `4a6b830b` |
| **F2.1** | Correção do path do client (`/education/events` → `/profile/education/events`) | `b6185554` |

## 3. Invariantes preservados

```text
actor-first (actor resolvido por tenant_id+user_id+actor_type='user'; metadata.actorId).
append-only (eventos imutáveis; sem UPDATE/DELETE no fluxo).
declaração não-verificada (o actor declara; o sistema não verifica).
sem emissor / prova / autoridade / validação por terceiro no MVP.
sem "validada_institucionalmente"/"confirmada"/"contestada" no fluxo VIVO
  (RESERVADOS: fora do dropdown e rejeitados pelo backend com 400).
sem validator/evidence no schema de escrita (removidos do contrato).
sem user_education / user_companies (tabelas ausentes; órfão removido).
sem category-as-identity.
sem IA criando categoria para Educação viva (createCategoryWithAI saiu com o órfão).
Educação ≠ Learning ≠ Professional ≠ credencial verificada.
```

## 4. Provas materiais

- **Rota viva:** `POST/GET /profile/education/events` + `GET /profile/education` (read-model). Backend
  `profile-education.routes.ts` registrado em `profile.routes.ts` (prefixo `/profile`).
- **Client correto (F2.1):** `frontend/src/api/education.ts` usa `/profile/education/events` (listar/criar) e
  `/profile/education` (read-model). Provado HTTP: GET `/profile/education/events` → **200** (era 404 antes
  da F2.1); path antigo `/education/events` → **404**.
- **Vocabulário reservado (F2):** `CANONICAL_EVENT_TYPES` = 4 declarativos (`declarada`/`iniciada`/`concluida`/
  `abandonada`); backend zod aceita só esses; POST `educacao.validada_institucionalmente`/`confirmada`/
  `contestada` → **400**; `THIRD_PARTY_EVENTS` vazio; UI com copy honesta "Informações autodeclaradas, não
  verificadas pelo sistema".
- **Órfão removido (F1):** `profile-education-companies.{routes,service}.ts` + `EducationSection.{tsx,css}`
  deletados; grep pós = zero referências; `user_education`/`user_companies` seguem AUSENTES.
- **Gates** (fatias de código): typecheck=0 (front+back conforme tocado); actor-writer / bank-ledger /
  regression-guards OK; `architectural-patterns --strict` `critical_new=0`, `critical_total=20` (baseline
  legado; `warning_new=1` pré-existente, não desta frente).
- **Resíduo DEV aceito:** o probe da F2 criou **1 evento `educacao.declarada` de teste** em `event_log`; o
  cleanup exigia DML em `event_log` (vetado pelo escopo das fatias) → permanece como ruído DEV menor,
  por decisão de Clayton; não bloqueia o selo.

## 5. Estado da DT

```text
DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY:
  CLOSED (2026-06-01) — referência: docs/02_decisions/SELO_EDUCATION_DECLARATION.md
```

## 6. Resíduos e futuro (frentes próprias — NÃO autorizadas aqui)

```text
Credencial verificada REAL:
  frente futura própria, puxa emissor + prova + autoridade + validação por terceiro + audit.
  NÃO nasce implicitamente do vocabulário; os event types reservados só voltam com esse substrato.

Evento DEV de teste (1x educacao.declarada da F2):
  pode ser limpo em janela autorizada de DML; não bloqueia nada.

DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION:
  segue DEFERRED — para o resíduo VIVO de Profissional/IA (ProfileProfessional), NÃO para Educação
  (o caller de Educação/Empresa morreu com o órfão removido na F1).
```

---

**Selo emitido.** Educação está consolidada como **declaração não-verificada actor-first** sobre `event_log`:
o cadáver órfão saiu (F1), o vocabulário de credencial foi reservado (F2), a escrita via UI religada à rota
viva (F2.1). Nenhuma autodeclaração se apresenta mais como "verificada institucionalmente". Credencial real é
frente futura com emissor/prova/autoridade. `DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY` **CLOSED**.

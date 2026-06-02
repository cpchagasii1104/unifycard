# DECISION-0073 — Educação no MVP é declaração não-verificada do actor (não credencial verificada)

**Status:** RATIFICADA — DECISÃO DE PRODUTO/ARQUITETURA. **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-01).
**Sessão:** 2026-06-01 (pós auditoria READ-ONLY de Educação).
**Decisor:** Clayton.
**Commit âncora:** HEAD origem `89c475a3`.
**Documento canônico:** este arquivo.
**Subordinada a:** Constituição / LEIS, LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY, `CORE_IMUTAVEL.md`.
**Vinculada a:** `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (DEFERRED — expansão IA/category de
Educação/Empresa; **não** entra no MVP event-sourced), DECISION-0070 (category-as-identity), `SELO_C1_LEARNING_INTEREST.md`.

---

## 1. Contexto (auditoria read-only, HEAD `89c475a3`)

Existem **duas** implementações de Educação:
- **VIVA (event-sourced):** `profile-education.{routes,service}.ts`, registrada (`profile.routes.ts:37`).
  `POST/GET /education/events` + `GET /profile/education` (read-model). Grava em **`event_log`** via outbox,
  **actor-first** (`metadata.actorId`, actor resolvido por `tenant_id+user_id+actor_type='user'`),
  **append-only**. **Não** usa `metadata`-blob, **não** usa `category_id`/`concept_id`, **não** mistura com
  Learning C1 nem gera Professional C1. SSOT = `event_log`. Em DEV: **0 eventos** (wired mas dormente).
- **ÓRFÃ/MORTA:** `profile-education-companies.{routes,service}.ts` — **não registrada** em rota nenhuma;
  opera sobre `user_education`/`user_companies` **AUSENTES** (`to_regclass`=null); `global_user_id`-keyed;
  **`category_id` como identidade**; `createCategoryWithAI({context:'education'})`. Também morto:
  `EducationSection.tsx` (componente não-renderizado, helper local sem API).

**Risco material — semântico, não de banco:** o caminho vivo tem ciclo **com forma de credencial**
(`educacao.declarada → iniciada → concluida → abandonada → contestada → confirmada → validada_institucionalmente`)
+ payload `validator`/`evidence`, e a UI rotula `educacao.validada_institucionalmente` como **"Validada
Institucionalmente"** (`useProfileEducationLogic.ts:61`). Porém **tudo é autoasserido pelo próprio actor**:
**sem emissor, sem prova, sem autoridade, sem validação por terceiro**. É declaração vestida de credencial.

## 2. Escolha

**Educação, no MVP atual, é DECLARAÇÃO NÃO-VERIFICADA do actor.** Event-sourced, append-only, actor-first.
**NÃO é credencial verificada.** Credencial verificada real (com emissor/prova/autoridade/validação por
terceiro) é **frente própria futura** — não nasce implicitamente do vocabulário atual.

## 3. SSOT atual

```text
event_log
actor-first (metadata.actorId)
append-only
sem metadata-blob, sem category_id, sem concept_id no caminho vivo
```

## 4. Fronteiras (vinculantes)

```text
Educação ≠ Learning          (Learning = intenção/exploração, C1 actor_learning_concepts)
Educação ≠ Professional      (não gera actor_professional_concepts; diploma NÃO vira C1)
Educação ≠ credencial verificada
Educação NÃO gera skill profissional automaticamente
Educação NÃO concede capability/authority
Educação NÃO usa category_id como identidade
Educação NÃO usa concept_id no caminho vivo atual
```

## 5. Veto permanente

❌ **Nenhum evento ou UI pode apresentar uma formação como "verificada" / "institucionalmente validada"
sem emissor, prova, autoridade e validação por terceiro.** Apresentar autoasserção como verificada é
informação enganosa (e, num sistema que projeta confiança/reputação, é bomba-relógio).

## 6. Vocabulário de risco (registro)

Hoje são **autoasseridos / texto livre** e **NÃO** equivalem a credencial verificada:

```text
educacao.validada_institucionalmente   (rotulada na UI como "Validada Institucionalmente")
educacao.confirmada
educacao.contestada
payload.validator                       (nome em texto livre, preenchido pelo próprio actor)
payload.evidence                        (texto livre, sem anexo/verificação)
```

`isThirdPartyEvent(...)` é apenas rótulo de UI — **não há terceiro real** emitindo o evento.

## 7. Decisão sobre esses termos

**Reservar/desabilitar os eventos de aparência de credencial real até existir substrato de credenciais**
(emissor/prova/autoridade/validação por terceiro). Concretamente, na fatia de implementação futura (F2):
- remover/desabilitar da UI e do contrato os eventos `educacao.validada_institucionalmente`,
  `educacao.confirmada`, `educacao.contestada` (e o caminho `validator`/`evidence`), **OU**
- se mantidos temporariamente, **rebaixar semanticamente** para rótulos honestos de **autodeclaração**
  (ex.: "Concluída (autodeclarada)"), sem qualquer texto que sugira verificação por terceiro.

A escolha entre **reservar** (preferida) e **rebaixar** é decisão de produto a executar na F2. **Esta DECISION
é docs-only e NÃO implementa** (não altera event types, rotas, UI nem schema).

## 8. Implementação órfã

```text
profile-education-companies.* é ÓRFÃO/MORTO:
  - sem tabela viva (user_education / user_companies AUSENTES)
  - sem rota registrada (grep global = zero)
  - sem caller frontend
  - global_user_id-keyed (anti DECISION-0069)
  - category_id como identidade (anti DECISION-0070)
  - createCategoryWithAI({context:'education'/'company'})
Também morto: EducationSection.tsx (não-renderizado).
```

**Destino futuro:** **F1 — neutralização/quarentena** do órfão morto (classificar por §4-A antes; baixo risco
por ser inalcançável). **Não** apagar nesta fatia.

## 9. Relação com DECISION-0070

A **expansão IA/`category` de Educação/Empresa** pertence a `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION`
(DEFERRED) e à DECISION-0070 (category não é identidade semântica). **Permanece DEFERRED** e **não entra** no
MVP de Educação event-sourced. Esta DECISION apenas referencia; não reabre nem amplia aquele escopo.

## 10. Sequência de fatias (não autorizada aqui)

```text
D1 (esta) — decisão docs-only: Educação = declaração não-verificada
F1 — neutralizar/quarentenar o órfão morto (profile-education-companies.* + EducationSection.tsx)
F2 — ajustar vocabulário/UI/event types (reservar ou rebaixar os eventos de credencial)
F3 — selo Educação + (eventual) CLOSE das DTs pertinentes
```

## 11. Superada por

(em aberto — decisão vigente)

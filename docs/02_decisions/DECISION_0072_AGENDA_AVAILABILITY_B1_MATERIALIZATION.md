# DECISION-0072 — Agenda/Availability: materialização B1 no `unified_availability`

**Status:** RATIFICADA — DECISÃO DE MODELAGEM (F0). **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-01).
**Sessão:** 2026-06-01 (pós F-AGENDA-DESENHO READ-ONLY).
**Decisor:** Clayton (escolha B1 sobre B2).
**Commit âncora:** HEAD origem `6ed6e5f3`.
**Documento canônico:** este arquivo.
**Subordinada a:** `SSOT_REGISTRY_UNIFICARD.md` §SSOT TEMPORAL (autoridade única `unified_availability`),
Constituição Art. II / `CORE_IMUTAVEL.md`, `CORE_TEMPORAL_CONTRACT.md`, LEI_DE_COERÊNCIA §4.8 (actor-first).
**Vinculada a:** `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` (**OPEN** — decisão tomada, implementação pendente),
`DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE` (caller HTTP vivo do PUT 501).

---

## 1. Contexto (auditoria F-AGENDA-DESENHO, read-only)

A aba **Agenda** (`frontend/src/components/ProfileAgenda.tsx`) tem **write vivo quebrado**: persiste o schedule
semanal via `updateProfessionalProfile({ availability })` (`:165`) → `PUT /profile/professional`
(`api/categories.ts:290`) → endpoint que agora retorna **501** (`PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED`,
corte da frente Profissional→C1). O debounce de 700ms dispara, recebe 501, marca `error` e **perde o dado**.

A **leitura** já é canônica: `GET /availability` (tabela `availability` = "unified availability"), actor-first
(`owner_id = activeActor.actor_id`). Achado adicional: a leitura faz **`setSchedule({})`** (`≈:95`) — a grade
semanal **nunca é lida de volta** (write-only sem read-back, mesmo antes do 501).

**Mismatch de modelo:** a UI produz um **template semanal declarativo** (`AvailabilitySchedule = { [dayOfWeek]:
string[] }`, ex. `{ monday: ["09:00-12:00"], specific: ["2024-12-25:09:00-12:00"] }`), mas o SSOT temporal
`unified_availability` armazena **janelas datadas concretas** (`start_datetime`/`end_datetime` TIMESTAMPTZ,
`timezone`, `availability_type` ∈ fixed/recurring/on_demand). **Nenhuma tabela viva** tem coluna de recorrência
semanal (sem `day_of_week`/`rrule`).

**Restrição normativa decisiva (SSOT_REGISTRY §SSOT TEMPORAL):** `unified_availability` (+ `unified_bookings`)
é o **SSOT temporal único**. `schedules`/`schedule_slots` são **LEGADO** com WRITE = **violação crítica C63**.
**"Nenhuma outra tabela ou módulo pode persistir estado temporal."** Logo: tabela temporal nova paralela
(`actor_availability_templates` etc.) = **VETADA**; `metadata`/`professional` = vetados (guard 400 rejeita
`schedule` em `availability.metadata`; professional é 501).

## 2. Decisão (escolha de Clayton)

**B1 — Materializar a grade semanal declarativa em janelas concretas dentro de `unified_availability`.**

A grade semanal da UI permanece **template declarativo de entrada**, mas a **verdade persistida** são janelas
concretas em `unified_availability` (`availability_type='recurring'` ou equivalente vivo), geradas por
expansão da recorrência sobre um **horizonte finito**. `unified_availability` continua a **única** verdade
operacional temporal.

**B2 — recorrência nativa** (representação de regra de recorrência *na própria* `unified_availability`) fica
como **possibilidade futura**, NÃO entra agora.

### Justificativa
- Respeita o SSOT_REGISTRY (não cria tabela temporal nova; não usa legado; não usa metadata/professional).
- Resolve o write quebrado com **menor risco** e **sem schema novo** (usa `POST /availability` existente).
- Mantém `availability` como única verdade operacional temporal.
- Não reativa `/profile/professional` (segue 501).

## 3. Invariantes da decisão (vinculantes)

1. **`unified_availability` é o único SSOT temporal permitido** (SSOT_REGISTRY §SSOT TEMPORAL).
2. O **schedule semanal da UI é template declarativo**, mas será **materializado em janelas concretas**.
3. Materialização usa **`availability_type='recurring'`** (ou o equivalente já existente no schema vivo),
   nunca um tipo inventado.
4. **Timezone** vem do **actor/user/contexto disponível**, **nunca** implícito/silencioso (a coluna
   `availability.timezone` existe; default `America/Sao_Paulo` não substitui a resolução explícita).
5. **Horizonte inicial finito e explícito** — recomendado **8–12 semanas** como primeira janela, salvo melhor
   padrão vivo descoberto na F1.
6. **Regeneração não pode fazer replace cego** — diff incremental, nunca `DELETE` em massa de availability.
7. **Janelas com booking/participant/conflito ativo NÃO podem ser apagadas** pela regeneração.
8. **Exceções `specific`** viram **janelas concretas ou overrides dentro de `availability`**, nunca metadata.
9. **`schedules`/`schedule_slots` continuam PROIBIDOS** para novo write (C63).
10. **`/profile/professional` continua 501** — não reativar.
11. **Profile / Professional C1 NÃO guardam disponibilidade** (separação competência × tempo).
12. **Financeiro fora de escopo.**

## 4. Vetos permanentes (vinculantes)

- ❌ Tabela temporal nova paralela (`actor_availability_templates` ou similar) — viola "nenhuma outra tabela
  persiste estado temporal".
- ❌ Schedule em `availability.metadata` (guard 400 já rejeita) ou em qualquer blob.
- ❌ WRITE em `schedules`/`schedule_slots` (C63 crítico).
- ❌ Reativar `PUT /profile/professional`; persistir agenda em Professional C1.
- ❌ Replace cego / `DELETE` de availability como "limpeza de cache".
- ❌ Apagar janela com booking/participant/conflito ativo.
- ❌ Timezone implícito silencioso.

## 5. Consequências / sequência de fatias (não autorizadas aqui)

- **F0 (esta DECISION):** modelagem B1 ratificada. DOCS-ONLY.
- **F1 — backend materializador seguro:** gerar janelas concretas `availability` (actor-first via
  `actionContext.actorId`; `availability_type='recurring'`; TZ explícita; horizonte 8–12 semanas; diff
  incremental que **não** apaga janela com booking/participant/conflito ativo; exceções `specific` →
  janelas/overrides). Sem migration (usa POST/PUT `/availability` existentes), salvo necessidade material
  comprovada na própria fatia.
- **F2 — frontend:** ProfileAgenda write → endpoint temporal canônico; **corrigir o read-back**
  (`setSchedule({})` → carregar o materializado do SSOT).
- **F3 — cleanup do uso morto:** remover `updateProfessionalProfile({ availability })` da Agenda + retirar o
  campo `availability?` do client legado (morto).
- **F4 — testes + selo + CLOSE** de `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT`.

> **Ordem:** backend materializador seguro **antes** do frontend. Nada de `DELETE` em massa de availability.
> A DT permanece **OPEN** até a F4 (selo/close).

## 6. Superada por

(em aberto — decisão vigente; B2 pode estender no futuro sem revogar B1)

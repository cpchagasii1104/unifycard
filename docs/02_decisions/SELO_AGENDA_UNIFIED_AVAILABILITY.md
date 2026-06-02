# SELO — Agenda/TEMPO sobre `unified_availability` (DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT)

**Tipo:** SELO documental de encerramento de frente (DOCS-ONLY).
**Data:** 2026-06-01.
**Frente:** `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` → **CLOSED** por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `e2e93573` (commit do selo avança a partir daqui).
**Decisão-mãe:** [`DECISION_0072_AGENDA_AVAILABILITY_B1_MATERIALIZATION.md`](DECISION_0072_AGENDA_AVAILABILITY_B1_MATERIALIZATION.md).
**Ratificação:** Clayton (modelagem B1 + cada fatia) · Opus (execução) · auditoria da cadeia.
**Subordinado a:** `SSOT_REGISTRY_UNIFICARD.md` §SSOT TEMPORAL (autoridade única `unified_availability`),
Constituição Art. II / `CORE_IMUTAVEL.md`, `CORE_TEMPORAL_CONTRACT.md`, LEI_DE_COERÊNCIA §4.8 (actor-first).

> A Agenda era TEMPO escrito num cabo morto: `ProfileAgenda` salvava em `PUT /profile/professional`
> (que virou 501) → dado perdido, e nunca lia a grade de volta (`setSchedule({})`). Esta frente
> religou a escrita/leitura ao **único SSOT temporal permitido — `unified_availability`** — via
> materialização B1 da grade semanal declarativa em janelas concretas, sem inventar segundo SSOT.

---

## 1. Estado final material

```text
Agenda é TEMPO.
SSOT temporal = unified_availability / tabela `availability` (+ bookings/participants).
ProfileAgenda salva em PUT /availability/weekly-template.
A grade semanal declarativa é MATERIALIZADA em janelas concretas (availability_type='recurring';
  `specific` -> 'fixed').
Read-back reconstrói a grade a partir de `availability` (janelas marcadas como template, ativas).
Nada salva em /profile/professional (legado 501; client morto removido).
Nada salva em Professional C1.
Nada salva em metadata.schedule (guard 400 do Core).
Nada escreve em schedules/schedule_slots (legado C63).
```

---

## 2. Cadeia de commits

| Fatia | Descrição | Commit |
|-------|-----------|--------|
| **DECISION-0072** | Modelagem B1 (materializar no `unified_availability`), docs-only | `3eb65faa` |
| **F1** | Backend materializador (`PUT /availability/weekly-template`) + fix off-by-one do repo `updateAvailability` | `29de8ef0` |
| **F2** | Frontend ProfileAgenda → endpoint temporal + read-back reconstruído do SSOT | `20ac9756` |
| **F3** | Cleanup do client legado `updateProfessionalProfile` (+ campo `availability?`) | `e2e93573` |

---

## 3. Invariantes preservados

```text
unified_availability é o SSOT temporal ÚNICO (SSOT_REGISTRY §SSOT TEMPORAL).
owner é governado por actor_id resolvido via actionContext (actor-first); cliente não escolhe owner.
timezone EXPLÍCITA (IANA; sem fallback silencioso — frontend usa Intl, backend valida com luxon).
horizonte FINITO (8 semanas; clamp 8–12); sem recorrência infinita.
diff INCREMENTAL: cria faltantes / mantém equivalentes / reativa pausadas idênticas.
sem replace cego; retirada é SOFT (status='paused'), NUNCA DELETE.
janelas com booking/participant/conflito ativo são PROTEGIDAS (nunca apagadas/retiradas).
`specific` vira janela concreta datada/override em `availability`, nunca metadata.
metadata.source='profile_weekly_template' é MARCADOR DE PROCEDÊNCIA (não o blob de schedule).
metadata.schedule continua VETADO (guard 400 do Core).
schedules/schedule_slots continuam LEGADO proibido para novo write (C63).
financeiro fora de escopo.
```

---

## 4. Provas materiais (consolidação das fatias)

- **F1 (probe interno):** materializa 8 janelas/8 semanas (`recurring`, tz, `source`); re-run **idempotente**
  (`created=0, kept=8`, sem duplicar); troca de grade **retira 7 órfãs soft + protege a janela com booking**
  (segue `active`), `0 DELETE`; `specific` válido cria / inválido rejeita; tz inválida → 400; `schedules`/
  `schedule_slots` **0→0**. Fix colateral: off-by-one em `repository.updateAvailability` (quebrava todo update,
  inclusive `PUT /:id` vivo) corrigido.
- **F2 (HTTP, backend 3010):** `PUT /availability/weekly-template` → **200 (não 501)**, `created=16`
  (monday+wednesday/8sem); `GET /availability` → 16 janelas template (recurring/active/source); **read-back
  reconstrói** exatamente `{monday:09:00-12:00, wednesday:14:00-16:00}`; 16 rows em `availability` (não em
  profile).
- **F3 (grep):** `updateProfessionalProfile` **removido** do client (zero caller vivo antes da remoção);
  `availability?:` zero em `categories.ts`; ProfileAgenda usa `putWeeklyAvailabilityTemplate`.
- **Gates** (todas as fatias de código): typecheck=0 (front+back conforme tocado); actor-writer / bank-ledger /
  regression-guards OK; `architectural-patterns --strict` `critical_new=0`, `critical_total=20` (baseline
  legado inalterado; `warning_new=1` em `validate-pipeline-e2e-c3-...:334` é pré-existente, não desta frente).

---

## 5. Estado da DT

```text
DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT:
  CLOSED (2026-06-01) — referência: docs/02_decisions/SELO_AGENDA_UNIFIED_AVAILABILITY.md
```

---

## 6. Resíduos e futuro (frentes próprias — NÃO autorizadas aqui)

```text
B2 — recorrência NATIVA em unified_availability (coluna de regra na própria tabela-SSOT):
  possibilidade futura, só se o produto exigir template recorrente persistido (não materializado).
  NÃO entra agora; B1 (materialização) é o corte vigente.

C63 — write-paths legados em schedules/schedule_slots (events/employee/SlotGenerator etc.):
  dívida CRÍTICA SEPARADA, rastreada no SSOT_REGISTRY; não tocada por esta frente; frente própria.

getProfessionalProfile + interface ProfessionalProfile (leitura legada do /profile/professional 501):
  faxina cosmética própria futura; fora desta frente.

Comentário explicativo do 501 em ProfileAgenda:
  honesto (não sugere caminho morto); mantido.
```

---

**Selo emitido.** A Agenda está consolidada sobre o SSOT temporal `unified_availability`: a grade semanal
declarativa materializa em janelas concretas (B1), o read-back reconstrói do SSOT, o cabo morto
(`/profile/professional`) saiu, e nenhuma escrita temporal vaza para `metadata.schedule` ou `schedules/
schedule_slots`. `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` **CLOSED**.

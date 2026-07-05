# IA-08 — Tempo/Booking

## 1. Carimbo

* **HEAD:** `aaeb50b5` (branch `rescue-structural`) — revalidado de 1ª mão (`git rev-parse`); último commit `docs(orchestration): add systemic x-ray consolidation`. (Os prompts/decisions citavam `dd270f41`/`bca473fa`/`891dfa87` — **STALE**; o disco moveu e venceu.)
* **Data/hora:** 2026-06-21 (sessão RAIO X).
* **Git status:** working tree com `docs/memorias/*` modificados + untracked (PNGs/outputs/planos) — **FORA do escopo** (loose/memórias; preflight METODO). Código core do eixo temporal **não** tem alteração não-commitada relevante.
* **READ-ONLY confirmado:** SIM. Nenhuma edição de código/migration/frontend/normas/decisions/cartório. Nenhum commit. Só leitura + introspecção.
* **Arquivo criado/atualizado:** `docs/memorias/IA-08-TEMPO-BOOKING.md` (este).
* **Memória lida:** `docs/memorias/MINHA_MEMORIA_TEMPO.md` (ENCONTRADA) — usada como histórico, não como verdade final.
* **Banco/schema consultado:** schema via **migrations** (verdade primária neste run). Rowcounts/REVOKE-aplicado/FK-viva/drift `schema_migrations` = **INCONCLUSIVE → IA-BANCO** (não rodei SQL mutável; introspecção viva delegada).
* **Comandos/probes usados:** `git rev-parse`/`log`/`status`; `rg`/grep em `backend/src/core/availability/**`, `backend/migrations/**`, `frontend/src/**`; Read de migrations, types, repository, service, routes, owner-authority, temporal-purpose, DECISION-0132/0146, e2e-offer-journey-pre-money. **Método:** workflow de 9 leitores READ-ONLY paralelos + 8 verificações adversariais (todas CONFIRMED) + releitura independente do guard pela IA-TEMPO.

## 2. Escopo

**Auditado (eixo Tempo/Booking):** agenda/perfil temporal · `availability` (schema+semântica) · `owner_type`/`owner_id` polimórfico · `purpose_concept_id` (DECISION-0132) · `is_bookable` · `service_offering` como owner temporal contratável · `bookings` (lifecycle/estados) · provider derivation · conflict guard (F-OFFER-5/6) · concorrência (advisory lock/race) · legado temporal (schedules/schedule_slots/rides/service-feed) · contrato frontend (superficial) · dinheiro-fora (prova de ausência).

**Fora (handoff):** perfil/SSOT inteiro · actor/autoridade global · oferta completa · marketplace/jornada completa · frontend inteiro · dinheiro/ledger/split/payout · semântica global · presença · logística.

## 3. Memória histórica vs estado vivo

`MINHA_MEMORIA_TEMPO.md` — **ENCONTRADA**. Âncora da memória = HEAD `20fe30cc` (2026-06-14). Comparação:

| Ponto da memória | Classificação | Evidência viva (HEAD `aaeb50b5`) |
|---|---|---|
| `detectConflicts` = STUB | **CONFIRMADA** | `migrations/20260530491000:61-78` (`detect_availability_conflicts` `RETURN;`); chamada como ALERTA pós-booking (`service.ts:186`) |
| policy 6/6 owner_types viva | **CONFIRMADA** | `availability-owner-authority.ts:53-103` (user/page/service/event/group/service_offering) |
| `owner_type='service_offering'` = âncora da oferta | **CONFIRMADA + CORRIGE memória anterior** | fonte = **DECISION-0117 D** (enum `types.ts:24`), **não** 0132 (0132 = `purpose_concept_id`) |
| C63 WRITE paths legados | **CONFIRMADA (contidos)** | SlotGenerator/EventScheduleService/EmployeeService = tombstone (throw) |
| "spoof/e2e de oferta existe" (§INSUMO 0131) | **STALE→agora VIVO** | `e2e-offer-journey-pre-money.ts` é NOVO (commit `3cee7d1c`, 2026-06-21); não existia em `20fe30cc` |
| F-OFFER-5/6 "faltam garantias temporais" (meu read-first PARTIAL @ `891dfa87`) | **CONTRADITA/SUPERADA** | guard **EXECUTADO**: `confirmBookingWithProviderLock` (`repository.ts:360-410`) |
| REVOKE C63 `20260428200000` aplicado? | **INCONCLUSIVE** | arquivo existe; aplicação no banco → IA-BANCO |

## 4. Mapa macro temporal

```
agenda/perfil          → FECHA (ProfileAgenda + weekly-template + purpose UI vivos; declarativo)
  → availability       → FECHA (SSOT único; TIMESTAMPTZ; sem EXCLUDE; owner polimórfico c/ policy)
  → owner=service_offering → FECHA (enum+CHECK+policy→provider_actor_id; DECISION-0117 D)
  → purpose_concept_id → FECHA (FK→concepts; 4 concepts; gate booking 0132)
  → booking requested  → FECHA (nasce 'requested' hardcoded; sem dinheiro)
  → booking confirmed  → FECHA (transição owner-only; requested→confirmed)
  → conflict guard     → FECHA (provider rollup, advisory lock, [start,end), fail-closed 409)
  → estados pós-confirm→ FECHA (checked_in exige confirmed; checked_out exige checked_in)
  ── frontend wiring   → FECHA_COM_RISCO (B1/B2: sem UI service_offering-availability; DTO legado coexiste)
  ── legado temporal   → FECHA_COM_RISCO (tombstones OK; REVOKE-aplicado INCONCLUSIVE; owner='service' legado)
```

## 5. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| agenda frontend | FECHA_COM_RISCO | `frontend/src/components/ProfileAgenda.tsx`; `AvailabilityScheduleEnhanced.tsx` | não-MTP | conflitos calculados não exibidos (B3) | HANDOFF_FRONTEND | MODO B |
| weekly-template | FECHA | `frontend/src/api/availability.ts:177`; `weekly-template-materializer.service.ts` | não | — | — | — |
| availability | FECHA | `migrations/20260530491000:3-28`; TIMESTAMPTZ; sem EXCLUDE | não | — | — | — |
| owner_type | FECHA | `types.ts:18-25` (6); CHECK `20260612110000` | não | — | — | — |
| owner_id | FECHA_COM_RISCO | `owner_id UUID NOT NULL` **sem FK** (polimórfico) | não-MTP | integridade fraca (órfão possível) | IA-BANCO | DECISION/MODO B |
| service_offering owner | FECHA | `availability-owner-authority.ts:72-80`→`provider_actor_id` | não | — | — | — |
| purpose_concept_id | FECHA | `migrations/20260616120100` (FK RESTRICT); `temporal-purpose.ts` | não | — | — | — |
| is_bookable | FECHA (ausente por desenho) | sem coluna; bookability = derivada da finalidade (0132 §4) | não | — | — | — |
| schedules/schedule_slots legado | FECHA_COM_RISCO | REVOKE `20260428200000`; SlotGenerator/EventScheduleService/EmployeeService = throw | não-MTP | REVOKE-aplicado INCONCLUSIVE | IA-BANCO | MODO B |
| metadata.schedule | FECHA | rejeitado/declarativo; verdade em `availability` | não | — | — | — |
| createBooking | FECHA | `repository.ts:298-349` (status hardcoded `requested`) | não | — | — | — |
| booking requested | FECHA | nasce `requested`; `CreateUnifiedBookingInput` sem status | não | — | — | — |
| confirm booking | FECHA | `repository.ts:360-410` `confirmBookingWithProviderLock`; rota owner-only | não | — | — | — |
| status CHECK/enum | FECHA | `UnifiedBookingStatus` 6 valores (`types.ts:51-58`) | não | — | — | — |
| conflict guard | FECHA | `repository.ts:374-391`; rollup `provider_actor_id`; fail-closed 409 | não | — | — | — |
| overlap | FECHA | `[start,end)` `a2.start<$end AND a2.end>$start` | não | — | — | — |
| back-to-back | FECHA (passa) | meio-aberto: fim=início NÃO conflita | não | — | — | — |
| provider diferente | FECHA (passa) | guard escopa `so2.provider_actor_id=$2` | não | — | — | — |
| checked_in/checked_out | FECHA | `service.ts:394` (check-in exige confirmed); bloqueantes | não | — | — | — |
| advisory lock | FECHA | `pg_advisory_xact_lock(hashtextextended('tenant:provider'))` (`repository.ts:371`) | não | — | — | — |
| race proof | FECHA | `e2e-offer-journey-pre-money.ts` (2º confirm sobreposto → 409) | não | E2E aplicada no banco = IA-BANCO | — | — |
| Caminho B1 | FECHA | `e2e-offer-journey-pre-money.ts` 9/9 PASS (commit `3cee7d1c`) | não | rodar no HEAD atual = IA-BANCO | — | — |
| dinheiro fora | FECHA | zero payment/ledger/split/payout em qualquer caminho de booking | não | — | HOLD_FINANCEIRO | HOLD |
| testes/guards | FECHA | `audit-temporal-legacy-tombstone.mjs`; validate:regression-guards | não | execução viva = IA-BANCO | — | — |

## 6. Achados críticos

**CONFLICT-01 — Guard de conflito por provider VIVO e correto** (era gap no meu read-first @ `891dfa87`; agora EXECUTADO).
- Evidência: `unified-availability.repository.ts:360-410` `confirmBookingWithProviderLock`. Incide na **transição CONFIRM** (G11), advisory xact-lock por `tenant:provider` (G7), bloqueantes `{confirmed,checked_in,checked_out}` (G4), rollup por `provider_actor_id` via `booking→availability→service_offerings` (G3/G9), intervalo `[start,end)` meio-aberto (G8), self-exclusion `booking_id<>$3`, check+UPDATE na mesma tx (atômico), fail-closed `ConflictError BOOKING_PROVIDER_TIME_CONFLICT` 409 (Art. II: não auto-resolve).
- Impacto: fecha o double-booking econômico. **Bloqueia MTP? NÃO.** Bloqueia público? NÃO. Bloqueia dinheiro? NÃO. DECISION? já (0146). YALA? recomendado reseal de execução. Modo: FAST-PATH/MODO B (cleanup). Handoff: — .

**AVAIL-01 — `owner_id` polimórfico SEM FK** (integridade fraca).
- Evidência: `migrations/20260530491000`/`20260427120000` — `owner_id UUID NOT NULL`, sem FK; integridade só por CHECK de `owner_type` + policy app-level (`availability-owner-authority.ts`).
- Impacto: availability órfã possível (sem `ON DELETE`); offering apagada deixaria janela pendurada. **Bloqueia MTP? NÃO** (virgem, 0 rows). Risco material com dado real. DECISION? possível (FK condicional vs guard). YALA? sim se materializar. Modo: MODO B / DECISION. Handoff: **IA-BANCO** (custo/forma) + **IA-OFERTA**.

**LEGACY-TIME-01 — REVOKE C63 aplicado = não-provado.**
- Evidência: `migrations/20260428200000_schedules_revoke_write.sql` existe; writers tombstoned (throw). Aplicação no banco vivo = INCONCLUSIVE.
- Impacto: se REVOKE não aplicado, WRITE legado em `schedules`/`schedule_slots` fisicamente possível (mas writers de código já lançam erro). **Bloqueia MTP? NÃO.** DECISION? não. YALA? não. Modo: INCONCLUSIVE→prova. Handoff: **IA-BANCO**.

**FRONT-TIME-01 — Wiring B1/B2 incompleto (DTO temporal legado coexiste).**
- Evidência: `frontend/src/api/service-availability.ts` (DTO legado `ServiceAvailability` por `serviceId`) ainda usado por `EventServiceBookingRequestModal.tsx:93`, enquanto `ProfileAgenda` usa o canônico `availability.ts` (`ownerType/ownerId`). Sem UI para candidato declarar disponibilidade de `service_offering`; sem modal de decisão prestador-side; `detectConflicts` calculado e não exibido (B3).
- Impacto: jornada `requested→confirmed` depende de ação fora do frontend; dois DTOs paralelos. **Bloqueia MTP? PARCIAL** (depende do recorte de MTP do produto). DECISION? não. YALA? na fatia de wiring. Modo: MODO B. Handoff: **IA-FRONTEND-UX-CONTRATOS** + **IA-MARKETPLACE-JORNADA**.

**MONEY-OUT-01 — Dinheiro FORA confirmado.**
- Evidência: schema `bookings` sem campos de pagamento; `createBooking`/`confirmBookingWithProviderLock`/check-in/out sem chamada a payment/ledger/split/payout/recovery.
- Impacto: nenhum (correto). **DINHEIRO_FORA.** Handoff: **IA-DINHEIRO** (ponte futura, HOLD).

**PURPOSE-01 — `purpose_concept_id` materializado e enforçado.**
- Evidência: `migrations/20260616120000` (seed 4 concepts) + `20260616120100` (ADD COLUMN + FK RESTRICT→concepts + index); `temporal-purpose.ts` (resolve slug→concept_id server-side); gate `service.ts:152-163` (estudo/cuidados/lazer → 400 `AVAILABILITY_PERSONAL_PROTECTED`; trabalho/NULL bookáveis).
- Impacto: nenhum (correto, semântica via CONCEPT). Sem coluna `is_bookable` (bookability derivada). Handoff: —.

## 7. Gaps de conexão

- **perfil→availability:** ProfileAgenda só para `actor_type='user'`; não há `CandidateAgendaForm`/UI de availability para `service_offering` (FRONT-TIME-01).
- **oferta→availability (frontend):** backend pronto (`owner_type='service_offering'`), frontend não chega na janela da offering pela UI canônica; usa DTO legado `service-availability` em alguns fluxos.
- **booking decision prestador-side:** backend tem `service-booking-decisions`; sem UI que dispare aceite/recusa (B2).
- **conflito UX:** `detectConflicts` (alerta) computado e descartado no front (B3).
- **owner_id→recurso:** sem FK; integridade referencial ausente (AVAIL-01).
- **dinheiro:** ponte booking→ledger intencionalmente ausente (HOLD).

## 8. Handoffs para outras IAs

- **IA-PERFIL-SSOT:** `professional_profile.availability` é INPUT DECLARATIVO (não SSOT temporal); bridge declarativo→`availability` é frente própria (DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING).
- **IA-OFERTA:** owner-vocabulário `service`(legado)×`service_offering`(canônico); `service_offerings.provider_actor_id` é a âncora do guard; draft/active × janelas.
- **IA-AUTORIDADE/IA-ACTOR:** `canRepresentActor` em writes/confirm (owner-only); provider derivado server-side; 5 canais 0113.
- **IA-FRONTEND-UX-CONTRATOS:** B1/B2/B3 (UI service_offering-availability; modal decisão; exibição de conflito; DTO legado a aposentar).
- **IA-MARKETPLACE-JORNADA:** wiring da jornada `discover→offering→availability→booking→confirm` no frontend.
- **IA-BANCO:** REVOKE `20260428200000` aplicado? FK em `owner_id`? rowcounts por owner_type? drift `schema_migrations`×disco? CHECK `chk_availability_owner_type` aplicado? rodar `e2e-offer-journey-pre-money` no HEAD atual.
- **IA-DINHEIRO:** ponte booking→`bank_ledger` (HOLD; fora do eixo).
- **IA-DECISOES-DT:** registrar formalmente AVAIL-01 (owner_id sem FK) e LEGACY-TIME-01 (REVOKE prova-viva) se virarem DT.

## 9. Riscos para MTP

- **Bloqueia MTP:** NADA no eixo temporal backend. Cadeia `availability→booking→confirm→conflict guard` está FECHADA e provada (Caminho B1 9/9 @ `3cee7d1c`).
- **Não bloqueia MTP mas corrigir:** wiring frontend B1/B2 (FRONT-TIME-01) se o recorte de MTP exigir jornada de contratação 100% pela UI.
- **V2:** UI de conflito (B3); modo FIXED/CLT; rest_periods visuais.
- **Cleanup:** aposentar DTO `service-availability` legado; conter `owner_type='service'`; FK de `owner_id`.
- **Decisão de produto/arquitetura:** FK condicional de `owner_id` (vs guard); política de remarcação (fora 0146); multi-recurso/capacidade (>1) é entidade futura.

## 10. Riscos para público e dinheiro

- **Blockers antes de público:** wiring frontend da jornada de booking (B1/B2) — caso público exija contratar pela UI.
- **Blockers antes de dinheiro:** nenhum no eixo temporal; a ponte é HOLD deliberado (DINHEIRO_FORA confirmado).
- **Blockers de legado temporal:** nenhum material (tombstones throw); REVOKE-aplicado = INCONCLUSIVE (IA-BANCO).
- **Blockers de frontend:** B1/B2/B3 + DTO legado coexistindo.
- **Blockers que exigem DECISION:** FK de `owner_id` (AVAIL-01); política de remarcação; multi-recurso.
- **Permanece HOLD:** dinheiro/ledger/split/payout no booking.

## 11. Veredito final

**FECHA_COM_RISCO.**
O núcleo temporal backend **FECHA**: availability=declaração (sem hard-block, sem EXCLUDE), booking=compromisso, guard de conflito por provider vivo/transacional/fail-closed, `[start,end)` correto, provider server-side, purpose via CONCEPT, dinheiro fora — **8/8 verificações adversariais CONFIRMED** + releitura independente do guard. O **RISCO** é periférico e não-MTP: (1) wiring frontend B1/B2/B3, (2) `owner_id` sem FK, (3) REVOKE C63 aplicado = INCONCLUSIVE, (4) DTO temporal legado coexistindo. Nenhum deles bloqueia MTP backend; todos são MODO B/cleanup/IA-BANCO.

## 12. Próxima frente recomendada

**MODO B — MODO_B_FRONTEND_TIME_WIRING** (primário): fechar B1/B2 (UI service_offering-availability + decisão prestador-side) — único item com potencial de blocker conforme o recorte de MTP. Handoff IA-FRONTEND-UX-CONTRATOS + IA-MARKETPLACE-JORNADA.
**Secundárias (não-bloqueantes):** prova-viva IA-BANCO (REVOKE/FK/rowcounts/e2e no HEAD) → depois **MODO_B_LEGACY_TIME_CONTAINMENT** (aposentar DTO legado + conter owner='service') e **DECISION** sobre FK de `owner_id`. **HOLD_FINANCEIRO** mantido.
Justificativa: o backend temporal está fechado e provado; o trabalho restante é wiring/cleanup/prova-viva, não correção de causalidade. Cirurgia macro não cabe — o eixo já encaixou na engrenagem.

## 13. Resumo executivo

* HEAD vivo `aaeb50b5` (prompts citavam hashes stale — revalidei de 1ª mão).
* **F-OFFER-5/6 EXECUTADO**: o double-booking que eu mapeara como gap aberto em `891dfa87` está **fechado** — `confirmBookingWithProviderLock` (`repository.ts:360-410`).
* Guard correto: CONFIRM-time, advisory lock tenant:provider, bloqueantes `{confirmed,checked_in,checked_out}`, rollup por `provider_actor_id`, `[start,end)` (back-to-back passa), self-exclusion, atômico, fail-closed 409.
* availability = **DECLARAÇÃO** (sem EXCLUDE; `detect_availability_conflicts` STUB = alerta, Art. II preservado).
* booking nasce **`requested`**; compromisso só na transição CONFIRM (owner-only).
* `purpose_concept_id` materializado (FK→concepts, 4 concepts, gate 0132); sem `is_bookable` (derivado).
* `owner_type='service_offering'` âncora = **DECISION-0117 D** (NÃO 0132); provider derivado server-side.
* **Dinheiro FORA** confirmado em todos os caminhos de booking.
* Legado **contido** (tombstones throw; REVOKE existe); **INCONCLUSIVE**: REVOKE-aplicado, FK de `owner_id`, rowcounts → IA-BANCO.
* Frontend **PARCIAL** (B1/B2/B3 + DTO legado) → MODO_B_FRONTEND_TIME_WIRING.
* **8/8 verificações adversariais = CONFIRMED.** Veredito: **FECHA_COM_RISCO**; eixo temporal **NÃO bloqueia MTP**.

---
*RAIO X READ-ONLY · IA-08 TEMPO/BOOKING · HEAD `aaeb50b5` · método: 9 leitores + 8 verificadores adversariais (workflow) + releitura independente do guard. Nenhuma edição de código/runtime; nenhum commit. Análise = INSUMO.*

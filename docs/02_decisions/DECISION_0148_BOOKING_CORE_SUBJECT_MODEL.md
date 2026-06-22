# DECISION-0148 — Booking Core Subject Model · F-BOOKING-CORE-SUBJECT-MODEL-DECISION (Opção B)

**Status:** **PROMULGADA / DOCS-ONLY / DECISÃO ARQUITETURAL (CONTRATO DO CORE) / BOOKING CORE SUBJECT MODEL** (Clayton 2026-06-22; ChatGPT ratificado).
**NÃO** altera `docs/01_normative`. **NÃO** toca runtime/migration/frontend/backend. Precede a execução material (`F-BOOKING-CORE-SUBJECT-MODEL-MATERIALIZATION`, Fatia 1), que só roda após GO próprio (**MODO B/C**).

**Data:** 2026-06-22 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `141870d1` · **Tipo:** arquitetural / contrato-de-core (docs-only) · **Frente:** F-BOOKING-CORE-SUBJECT-MODEL-DECISION
· **Responsável:** Clayton (decisão soberana) / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
· **READ-FIRST (3 ângulos, READ-ONLY):** id-types reais provam `userId` poluído (actorId/user_id/global_user_id por caller) · o bound-subject já existe e está vivo (`bindWriteActor` → `{userId, actorId}`) · **NÃO existe caller de sistema** criando booking (provado de 1ª mão) → `systemSubject` desnecessário; C adiada.

**Deriva de / subordinada a:** DECISION-0113 (channel-1: actorId declarado = HINT; binding ao principal autenticado server-side) · DECISION-0118 D2 (autoridade resolvida server-side; recurso ≠ actor) · DECISION-0121 (authority binding booking→decision→service_order). **Vinculada a:** [[DT-BOOKING-CORE-USERID-SUBJECT-POLLUTION]] (esta DECISION é sua resolução prevista).

---

## §0 — Natureza e contexto
`unifiedAvailabilityService.createBooking(tenantId, userId, input)` valida que `requesterActorId` **existe**, mas **não revalida autoridade** — confia no caller (desenho DECISION-0113 channel-1: rota gateia, core confia). O READ-FIRST provou que o 2º parâmetro `userId` é **semanticamente poluído**: a rota canônica passa **actorId**, checkout-ticket passa **global_user_id**, service-hire/bundle/event-rfq passam **user_id**. Como `canRepresentActor(tenant, userId, actorId)` casa por `actor.user_id === userId`, **inserir `canRepresentActor` direto no core com o `userId` atual seria fail-closed que quebra fluxos legítimos** (Opção A). A correção é de **contrato**, não de `if`: o core deve parar de receber um `userId` ambíguo e passar a receber um **subject normalizado** que ele próprio revalida.

## §A — A DECISÃO (soberana de Clayton, 2026-06-22 · Opção B)

**Opção escolhida: B — o core de booking recebe um subject NORMALIZADO e REVALIDA autoridade.** (A descartada · C adiada · D já executada como piso interim.)

1. `unifiedAvailabilityService.createBooking(...)` **NÃO** deve mais depender de um `userId` genérico.
2. O core de booking recebe um **subject normalizado**:
   `BookingSubject = { subjectUserId: string, requesterActorId: string }`.
3. **`subjectUserId`** = exclusivamente o id real do **principal humano** autenticado/derivado server-side — o mesmo valor que casa com `actors.user_id` em `canRepresentActor`. **NÃO** é `actorId`, **NÃO** é `global_user_id`.
4. **`requesterActorId`** = o actor **em nome de quem** o booking é criado.
5. O core **REVALIDA**: `canRepresentActor(tenantId, subject.subjectUserId, subject.requesterActorId)` → **fail-closed** se `false` (defesa-em-profundidade; o core deixa de depender só do caller).
6. **PROIBIDO** no contrato do core: passar `actorId` como `subjectUserId`; passar `global_user_id` como `subjectUserId`; passar `requesterActorId` cru do body sem binding; qualquer `userId` ambíguo.
7. **Callers normalizam ANTES de chamar o core:**
   - unified route: `req.user.userId` real + `requesterActorId` bindado (mantém `canRepresentActor` na rota; o core revalida = defesa-em-profundidade);
   - bundle: subject vindo de `bindWriteActor`;
   - hire: subject real ao reabrir o firewall (DECISION-0110);
   - checkout-ticket: resolver `global_user_id → user_id` antes de montar o subject;
   - event/rfq: usar `organizer` `user_id` real;
   - e2e/scripts: adaptar ao novo contrato.
8. **NÃO existe `systemSubject` nesta decisão.** O READ-FIRST provou **zero caller de sistema** criando booking; qualquer booking de sistema futuro exige **DECISION própria** (não improvisar subject de sistema).
9. **Opção A descartada:** `canRepresentActor` direto com o `userId` atual é inseguro (parâmetro poluído → quebra canonical + checkout).
10. **Opção C adiada:** split `createBookingForRepresentedActor` / `createSystemBooking` só será considerado se surgir caller de sistema real (reabre via nova DECISION).
11. **Opção D já executada:** guard interim `audit-booking-caller-authority.mjs` (commit `e0d8ba3f`) — **piso de proteção** (congela a disciplina dos callers), **não** o destino final.
12. **Dinheiro permanece FORA:** esta decisão é **pré-dinheiro** e **não** autoriza checkout, payout, fee-bps, ledger, RLS-runtime ou qualquer flag financeira. Os callers que tocam dinheiro o fazem **downstream**, já contidos por firewall.

## §B — Vocabulário canônico
- `BookingSubject` (ou `BoundBookingSubject`) = `{ subjectUserId, requesterActorId }`. **`userId` deixa de ser vocabulário válido** no core de booking: ou é `subjectUserId` (principal humano) ou `requesterActorId` (actor).
- `subjectUserId` é **obrigatório** e **não** pode ser ambíguo (sempre o `user_id` humano).
- `requesterActorId` é **obrigatório** e validado pelo binding + revalidado pelo core.
- **Proibido:** `userId` genérico; `actorId`/`global_user_id` no lugar de `subjectUserId`; requester cru do body.

## §C — Plano de materialização (NÃO executa aqui; GO próprio)
- **Fatia 1:** tipo `BookingSubject` + assinatura `createBooking(tenantId, subject, input)` + revalidação `canRepresentActor` no core; migrar os 5 callers (normalizar `subjectUserId`; checkout `global_user_id→user_id`).
- **Fatia 2:** atualizar guard D para exigir o contrato novo (core revalida; sem `userId` cru; checkout normalizado).
- **Provas:** e2e por caller (canonical/bundle/checkout-self/rfq-self passam) + negativo (subject inválido → fail-closed) + B1 e2e 9/9 intacto + guard/NP.
- **Modo:** B/C · **YALA** reseal · **cartório** · **ZERO** dinheiro/migration.

## §D — STOPs
- Esta DECISION é **docs-only**; **não** altera `createBooking`, guard, rotas, testes, runtime, migration, dinheiro.
- A execução material (Fatia 1) exige **GO próprio**.
- `systemSubject` é **proibido** até DECISION própria.
- Opção A permanece **descartada**; C **adiada**.

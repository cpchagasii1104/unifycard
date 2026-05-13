# F8 — event-economy.processCheckout absorve runtime soberano via delegação a bank-integration.processEventTicketPayment

**Data:** 2026-05-13
**Modo:** EXECUTOR autônomo (autorizado por Clayton + IA externa após investigação GUARDIÃO executei_23)
**Branch:** `rescue-structural`
**HEAD anterior:** `8f85ba31` (F7 — fixes dinâmicos cascade)
**HEAD pós-execução:** TBD
**Diretiva institucional vinculante:** "absorver legado, não criar verdade paralela"

---

## 1. Origem material

Investigação GUARDIÃO executei_23 confirmou:

| Sistema | Estado material |
|---|---|
| **Runtime soberano real** | `bank-integration.processEventTicketPayment` — 928 linhas, 8+ métodos process* irmãos, C2 remediation aplicada |
| **Canônico declarado (FASE 7+10)** | `event-economy.processCheckout` — design declarado mas escopo narrow; FASE 10 (escrow) não implementada |
| **Verdade paralela em F7** | F7 reproduziu PARCIALMENTE bank-integration em event-economy; amputou 4-5 capacidades operacionais |

5 capacidades operacionais que F7 amputou (e F8 restaura via delegação):
1. Validação de limite diário (`bankLimitService.validateLimit('payment_out')` fail-closed)
2. Autoria financeira via `ownership` (não `system` bypass)
3. Idempotência via `idempotencyKey || uuidv4()` fallback
4. `ensureUserActor` (cria actor se não existir)
5. Suporte a organizer `'user'` E `'page'`/`'company'` (via `resolveEventOrganizerAccount`)

## 2. Refactor aplicado em event-economy.processCheckout

`backend/src/core/events/event-economy.service.ts` — substituição da implementação inline (F7) por wrapper de delegação fina, **análogo a `events-payment.processEventPayment`**:

**Antes (F7):** ~95 linhas de lógica inline reproduzindo parte de bank-integration.

**Depois (F8):** ~60 linhas total: validações + tradução semântica + delegação + mapeamento.

Estrutura conceitual:

```ts
async processCheckout(tenantId, input): Promise<CheckoutResult> {
  // 1. Validações específicas do domínio HTTP
  if (quantity < 1 || quantity > 10) throw BadRequestError(...);
  const event = await eventService.getEvent(tenantId, eventId);
  if (!event) throw NotFoundError(...);
  const totalAmountCents = event.ticketPriceCents * quantity;
  if (totalAmountCents <= 0) throw BadRequestError(...);

  // 2. Tradução semântica HTTP→domain (attendee_actor_id → buyer_user_id)
  const actorRow = await runQueryWithTenant(
    tenantId,
    `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, attendeeActorId]
  );
  const attendeeUserId = actorRow?.user_id;
  if (!attendeeUserId) throw BadRequestError(...);

  // 3. DELEGAÇÃO para runtime soberano
  //    Preserva: limite diário, autoria ownership, idempotência,
  //    ensureUserActor, resolveEventOrganizerAccount (user+page+company).
  const bankIntegration = bankPortsRegistry.getBankIntegration();
  const result = await bankIntegration.processEventTicketPayment(tenantId, {
    eventId,
    buyerUserId: attendeeUserId,
    amountCents: totalAmountCents,
    currency: 'BRL',
    metadata: { quantity, attendeeActorId },
  });

  // 4. Mapeamento para tipo CheckoutResult
  return { eventId, attendeeId, transactionId, totalAmountCents, splitResult };
}
```

**Removido:** resolução de organizerAccount inline, construção manual de authorship com `'system'`, chamada direta a bankTransactionService, assertion event.actorType !== 'user', checkoutEventId uuid próprio.

**Preservado:** validação quantity 1-10, validação ticket_price, NotFoundError event, tipo CheckoutResult.

## 3. Bug latente corrigido no legacy (DURANTE execução dinâmica)

Smoke v3 pós-F8 revelou **bug latente em bank-integration.service.ts:99-100** (`resolveEventOrganizerAccount`):

**Antes:**
```ts
if (event.actor_type === 'user') {
  return await resolveUserAccount(tenantId, event.actor_id, currency);
  //                                          ^^^^^^^^^^^^^
  // events.actor_id é actor_id (não user_id); resolveUserAccount espera user_id
  // → CHECK violation bank_accounts_actor_required_for_actor_owner
}
```

**Depois (F8):**
```ts
if (event.actor_type === 'user') {
  // Tradução semântica obrigatória: events.actor_id é actor_id (não user_id).
  // resolveUserAccount espera user_id porque getOrCreateAccount({ownerType: 'user'})
  // busca via actors.user_id no repository.
  const { runQueryWithTenant } = await import('@core/database/pool');
  const actorRow = await runQueryWithTenant<{ user_id: string | null }>(
    tenantId,
    `SELECT user_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, event.actor_id]
  );
  const organizerUserId = actorRow?.user_id;
  if (!organizerUserId) return null;
  return await resolveUserAccount(tenantId, organizerUserId, currency);
}
```

**Lição institucional:** mesmo o legacy "soberano" tem bugs latentes que só aparecem em runtime real. Bugs não exercitados sobrevivem em código. **Smoke fundacional dinâmico É o teste material que expõe esses bugs.**

`resolveEventOrganizerAccount` é usado por TODOS os callers de event-related payment (event_ticket, event_consumption). Fix nesta função beneficia:
- event-economy.processCheckout (via delegação F8)
- CheckoutService.processCheckout (módulo EVENT_TICKET/EVENT_CONSUMPTION)
- events-payment.processEventPayment (wrapper)
- Qualquer caller futuro

Alinhado com diretiva "absorver legado": fix no próprio legado preserva memória operacional consolidada.

## 4. Smoke v3 dinâmico pós-F8 — progresso material

| Passo | Antes F8 (F7) | Pós-F8 |
|---|---|---|
| P1-P8 | ✅ PASS | ✅ PASS |
| P9 (checkout fundacional) | ❌ FAIL em B5 (Target account not specified for split type revenue_share) — event-economy inline incompleto | ❌ FAIL em B8 (bank_splits resolveTargetActorId não suporta destinos system) — agora exercitando legacy completo |

**Avanço material:** smoke v3 agora exercita cadeia completa `event.routes → event-economy(wrapper) → bank-integration.processEventTicketPayment → bankTransactionService.createTransactionWithSplit → bankSplitEngine.calculateSplits → bank-split.repository.createSplitWithAuthorship`. Falha em ponto **arquitetural** mais profundo (B8) que já era conhecido.

**Stack trace pós-F8 confirma delegação:**
```
event.routes.ts:921
  → EventEconomyService.processCheckout (event-economy.service.ts:79)   ← delegação ativa
    → BankIntegrationService.processEventTicketPayment (bank-integration.service.ts:196) ← legacy soberano exercitado
      → BankTransactionService.createTransactionWithSplitAndAuthorship (bank-transaction.service.ts:1358)
        → BankSplitRepository.createSplitWithAuthorship (bank-split.repository.ts:203)
          → resolveTargetActorId (bank-split.repository.ts:50)           ← B8 bug arquitetural
```

## 5. Verdade paralela eliminada

| Capacidade | Pré-F8 status | Pós-F8 status |
|---|---|---|
| Validação limite diário | ❌ amputada em event-economy | ✅ exercitada via delegação a bank-integration |
| Autoria ownership | ❌ event-economy usava `'system'` | ✅ delegação usa `buildFinancialAuthorshipFromRequest(authoritySource: 'ownership')` |
| Idempotência (idempotencyKey fallback) | ❌ event-economy uuid sempre novo | ✅ delegação usa `idempotencyKey || uuidv4()` |
| `ensureUserActor` para actor novo | ❌ event-economy não chamava | ✅ delegação chama ensureUserActor |
| Suporte organizer 'page'/'company' | ❌ event-economy rejeitava | ✅ delegação via resolveEventOrganizerAccount suporta page+company |
| Helpers reutilizados (consistência cross-context) | ❌ event-economy inline | ✅ resolveUserAccount, resolveEventOrganizerAccount, buildFinancialAuthorshipFromRequest reutilizados (mesma lógica que processEventConsumptionPayment, processServiceBookingPayment, processRidePayment, processGroupContribution, etc.) |

**5 capacidades restauradas via absorção do legado.** Verdade paralela criada em F7 eliminada.

## 6. Verificação institucional

| Gate | Resultado |
|---|---|
| TSC backend | 0 erros |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] |
| `validate:regression-guards` | GATE OK [financial + sql-lint + 299 migrations] |
| `validate:architectural` | baseline preservado (não rodado nesta frente; baseline é frontend-vs-backend independente; F8 edits são em backend mas não tocam regras de profile/categories baseline) |

Smoke v3 dinâmico:
- P1-P8: ✅ PASS
- P9: ❌ FAIL em B8 (bug arquitetural conhecido — DECISION pendente)
- P10-P14: não atingidos (bloqueados por B8)

## 7. Bugs causais ainda em aberto pós-F8

| Bug | Status | Próximo passo |
|---|---|---|
| **B8 — bank_splits.resolveTargetActorId rejeita destinos system** | OPEN, ARQUITETURAL | DECISION arquitetural dedicada (3 opções identificadas em F7: relaxar resolveTargetActorId / usar target_account_id direto / DT formal) |
| B6 — referrals (tabela ausente) | OPEN, try/catch tolera operacionalmente; verdade material a registrar como DT | DT formal documentando que `referrals` (nova) é proposta abandonada; `user_referral_links` (legacy) é canônico atual |
| B7 — split engine step 4 double-counting | OPEN, fix em working tree não commitado | Sessão dedicada com testes unitários antes de commitar |
| B9 — handler social posts.global_user_id | OPEN, não-bloqueante | Schema fix ou refactor do handler em frente separada |
| ReconciliationWorker / SlaMonitorWorker (pi.status, status ausentes) | OPEN, workers separados | Schema drift payment_intents — frente separada |

## 8. Lições estruturais desta frente

### Lição 1 — absorver legado é fix mais barato que reproduzir

F7 adicionou ~95 linhas inline em event-economy para "implementar" lógica que bank-integration já tinha. **F8 substituiu por ~20 linhas de delegação preservando 100% das capacidades + corrigindo 1 bug latente do próprio legado**. Custo total F8 < F7 + valor material muito maior.

### Lição 2 — legacy soberano não é perfeito mas é a base material correta

`resolveEventOrganizerAccount` em bank-integration tinha bug latente (passar actor_id como user_id) há quem-sabe-quanto-tempo. Não foi exercitado em runtime real até smoke v3 fundacional. Fix no próprio legado preserva memória operacional + corrige integração para todos os callers.

### Lição 3 — runtime soberano se identifica por concentração de causalidade validada

bank-integration tem: validação de limite, autoria ownership, idempotência, ensureUserActor, helpers cross-context, C2 remediation. **Concentração de invariantes financeiras = sinal arquitetural de "este é o runtime real".** Arquivos canônicos declarados mas com escopo narrow são candidatos a wrapper/orchestrator, não substitutos.

### Lição 4 — diretiva "absorver legado" é estratégia operacional concreta

Não é princípio abstrato. É decisão de:
- antes de adicionar lógica para resolver bug, mapear se padrão paralelo já implementa
- se sim: delegar (preserva memória operacional)
- se ambíguo: investigação GUARDIÃO read-only material
- nunca: reproduzir parcialmente legado no novo (cria verdade paralela amputada)

## 9. Aderência ao protocolo

- §2.2.2 prova de rastreabilidade — cada capacidade absorvida com arquivo:linha
- §29 git add específico (event-economy.service.ts + bank-integration.service.ts + log)
- §25 pendências preservadas com critério de convergência (B8 arquitetural, B6 DT material, B7 testes unitários, B9 handler async)
- §10 não toquei norma
- **Diretiva "absorver legado, não criar verdade paralela"** honrada — F8 elimina verdade paralela criada em F7
- §28 ausência de drift (nenhuma migration tocada)
- Calibração 2026-05-13 — material primeiro (executei_23 antes de F8); reconhecimento honesto do erro #4 reconhecido em F7 corrigido em F8
- Aprendizado institucional: erro #4 sistematizado como heurística futura

## 10. Estado pós-F8

| Item | Estado |
|---|---|
| event-economy.processCheckout | ✅ Wrapper de delegação (~60 linhas total) |
| Verdade paralela F7 → F8 | ✅ ELIMINADA |
| 5 capacidades operacionais legadas | ✅ PRESERVADAS via delegação |
| bug latente legacy resolveEventOrganizerAccount | ✅ CORRIGIDO no próprio legado (beneficia 3+ callers) |
| Smoke v3 P1-P9 progresso | P1-P8 ✅ PASS; P9 ❌ FAIL em B8 (bug arquitetural conhecido) |
| TSC backend + 3 gates | 0 erros + 3 PASS |
| DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO | OPEN — convergência avançou (cadeia delegação validada); P10-P14 bloqueados por B8 |

## 11. Próximo passo recomendado

**DECISION arquitetural sobre B8** (`bank_splits.resolveTargetActorId` rejeita destinos system). Categoria distinta:
- 3 opções identificadas em F7 (relaxar resolveTargetActorId / usar target_account_id direto / DT formal)
- Audit multi-AI análogo a DECISION-0031 viável
- Smoke v3 P10-P14 desbloqueados ao resolver B8

Pendências secundárias (não bloqueiam B8):
- B6 (DT formal sobre referrals abandonado)
- B7 (testes unitários antes do commit step 4)
- B9 (schema fix posts.global_user_id)

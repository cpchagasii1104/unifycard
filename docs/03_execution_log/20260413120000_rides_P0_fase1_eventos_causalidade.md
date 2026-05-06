# Execução — Rides P0 Fase 1 (ordem causal de eventos)

**Modo:** EXECUTOR  
**Data:** 2026-04-13  
**Norma:** `00_AGENT_PROTOCOL.md` §2.3.2 (cadeia causal); RFC `RFC_RIDES_DOMAIN_BOUNDARIES_AND_GOVERNANCE.md` §7 (evento após estado/dinheiro quando aplicável)

## Objetivo

Correção **mínima** das violações de causalidade identificadas na auditoria GUARDIÃO:

- `pricing.service.ts` — `emit` antes do commit / estado final em fluxos de conclusão.
- `rides.service.ts` — `rides.ride.completed` antes de `processRidePayment`.

## O que foi feito

1. **`backend/src/modules/rides/shared/publish-ride-event.ts`** (novo)  
   - `publishRideEventSafe` encapsula `eventBus.emit` (preparação para outbox futura, sem alterar contratos públicos).

2. **`pricing.service.ts`**  
   - Terceiro parâmetro opcional `options?: { skipEmit?: boolean }` em `calculateFinalPrice`.  
   - Com `skipEmit: true`, não publica `rides.pricing.calculated` dentro do método.  
   - Emissões quando `skipEmit` é falso passam por `publishRideEventSafe`.

3. **`lifecycle/lifecycle.routes.ts`** (`POST /complete`)  
   - `calculateFinalPrice(..., { skipEmit: true })` dentro da transação.  
   - Transação devolve `{ ride, pricing }`.  
   - Após `processRidePayment`: `rides.pricing.calculated` e depois `rides.ride.completed` via `publishRideEventSafe`.  
   - Demais `emit` do ficheiro redireccionados para `publishRideEventSafe`.

4. **`rides/rides.service.ts`** (`completeRide`)  
   - `calculateFinalPrice` com `skipEmit: true`.  
   - Ordem: `UPDATE` → `processRidePayment` → `rides.pricing.calculated` → `rides.ride.completed` → `rides.ride.paid`.  
   - Demais `emit` do ficheiro via `publishRideEventSafe`.

## O que não foi feito (conforme instrução)

- Sem migrations.  
- Sem outbox transaccional completo.  
- Sem alteração a `distribution.service.ts` (continua a emitir `rides.payment.completed` após Bank).  
- Sem fases P2–P4 (authority, tempo, dinheiro semântico).

## Ficheiros alterados

- `backend/src/modules/rides/shared/publish-ride-event.ts` (novo)  
- `backend/src/modules/rides/pricing/pricing.service.ts`  
- `backend/src/modules/rides/lifecycle/lifecycle.routes.ts`  
- `backend/src/modules/rides/rides/rides.service.ts`

## Verificação

- `npx tsc --noEmit -p backend/tsconfig.json` — **PASS** (exit 0).

## Status

**SUCESSO** — Fase 1 (eventos críticos de conclusão de corrida) aplicada.

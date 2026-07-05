# Q3_E2E_V2_PLAN.md — Smoke Econômico Fundacional

**Branch:** rescue-structural
**Data:** 2026-05-12
**Supera:** Q3-E2E v1 (executei_6.md) — DEPRECADO
**Fundamentação:** DECISION-0031

**ATENÇÃO: NÃO EXECUTAR AINDA.** Sessão dedicada futura com aprovação explícita.

---

## Por que v1 falhou

Q3-E2E v1 tentou mint via `createSimpleTransaction(fromAccountId: undefined)`, que
cria `system:liquidity_issuance:{tenantId}` automaticamente. O trigger
`check_coverage_before_credit` bloqueou: `execution_capacity_cents = 0` em tenant novo
→ `COVERAGE_EXCEEDED: 100.00`.

V1 pressupunha que o sistema deveria aceitar mint direto num tenant sem histórico
econômico. DECISION-0031: o sistema está correto. V1 não é caminho fundacional.

---

## Caminho fundacional canônico (v2)

```
Tenant criado
    → ensurePlatformAccounts (liquidity_issuance + fee_collection + atl_reserve)
    → Primeiro event_ticket vendido
    → split engine: 17% → system reserve
    → execution_capacity_cents > 0
    → Coverage < 100% → créditos a usuários desbloqueados
    → P2P possível
```

---

## Plano de execução v2 (rascunho — requer aprovação antes de sessão)

### Pré-requisito: arquitetura do split engine para event_ticket

Antes de executar, confirmar:
1. Qual rota cria `event_ticket`?
2. Qual rota dispara split engine para evento?
3. Split engine deposita na conta system reserve automaticamente?
4. Qual `concept_id` é usado para o depósito de reserve?
5. `execution_capacity_cents` muda após split?

Arquivos a auditar:
- `src/modules/events/` — rotas de evento e ticket
- `src/core/unifybank/bank-split.service.ts` — split engine
- `src/modules/bank/bank-transaction.service.ts` — createSimpleTransaction

### Passos propostos (a detalhar antes da sessão)

1. Build + backend UP (igual v1 — gates 1 e 2)
2. Registrar Usuário A e B (igual v1 — mesmo tenant via x-tenant-id)
3. Contas bancárias A e B (igual v1)
4. Criar evento (`POST /events` ou equivalente) — com ticket price
5. Comprar ticket do evento como Usuário A — dispara split engine
6. Validar system reserve: `execution_capacity_cents > 0` (psql)
7. Validar coverage: `ratio_pct < 100` (psql)
8. P2P transfer A → B (100 centavos)
9. Validar double-entry: 2 ledger entries, net = 0 por transação
10. Validar saldos finais (psql)
11. Validar `pg_typeof(amount_cents) = bigint` no ledger v2

### Gates (tabela de resultado)

| Passo | Gate | Critério |
|-------|------|---------|
| Build | PASS/FAIL | `BUILD_EXIT: 0` |
| Backend UP | PASS/FAIL | `/health` → `bank: ok` |
| Register A + B | PASS/FAIL | 201, mesmo tenant |
| Contas A + B | PASS/FAIL | accountId retornado |
| Criar evento | PASS/FAIL | eventId retornado |
| Comprar ticket | PASS/FAIL | ticketId + split engine executado |
| Reserve fundada | PASS/FAIL | `execution_capacity_cents > 0` |
| Coverage < 100% | PASS/FAIL | `ratio_pct < 100` |
| P2P A → B | PASS/FAIL | 200, saldos corretos |
| Double-entry net=0 | PASS/FAIL | net = 0 por transação |
| pg_typeof bigint | PASS/FAIL | tipo real no runtime |

---

## DT observada (investigar antes de v2)

`DT-q3-e2e-v2-service-booking-sem-reserve` — split engine de `service_booking` não inclui
reserve por default. Somente `event_ticket` tem reserve (17% hardcoded). Pode ser design
consciente (arrecadação coletiva vs liquidação bilateral). Ver REMEDIATION_DT_LOG.md.

---

## O que v2 NÃO prova

- Split engine para service_booking (reserva)
- Reconciliação (settlement workers)
- Estorno (reversal flow)
- Limites diários ATL/KYC/GUARDA no caminho P2P
- event_outbox / bus de eventos

---

## Pré-aprovação necessária

Antes de sessão dedicada v2:
1. Clayton confirma rota canônica de criação de evento + ticket
2. Confirmar se split engine dispara automaticamente ou requer call explícito
3. Confirmar CPFs únicos (não reutilizar 81694901890 / 41672921066 do v1)

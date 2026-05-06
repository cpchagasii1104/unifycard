# Execução — Prompt 53 — Risk & Identity Engine

**Data:** 2026-03-18  
**Modo:** AGENT

## Objetivo

**Identidade (`actor_id` / CPF vinculado ao actor)** como memória permanente; **risco comportamental** (score, nível, flags) sem mover dinheiro nem alterar ledger.

## Regras

- Risk Engine **não** altera `bank_ledger`, `bank_transactions`, saldos.
- Decisões afetam **permissões** (ex.: P2P bloqueado se `blocked`), **step-up** (`high`), **limites** (`medium`).
- Eventos append-only em `actor_events` (histórico não apagado pelo motor).

## Artefatos

| Item | Caminho |
|------|---------|
| Migration | `backend/migrations/0056_actor_risk_identity_engine.sql` |
| Perfil | `backend/src/modules/risk-identity/actor-risk.repository.ts` |
| Eventos | `backend/src/modules/risk-identity/actor-events.repository.ts` |
| Motor | `backend/src/modules/risk-identity/risk-engine.service.ts` → `evaluateActorRisk` |
| Permissões | `backend/src/modules/risk-identity/risk-permissions.ts` → `checkActorPermissions`, `assertActorFinancialPermission` |
| Hooks | `backend/src/modules/risk-identity/risk-hooks.ts` |
| Testes | `backend/tests/unit/risk-engine.test.ts` |

## Integrações (somente observabilidade + enforcement leve)

| Evento | Onde |
|--------|------|
| `reversal_executed` | `reversal.service.ts` (pós-commit) |
| `payment_failed` | `payment-execution.service.ts` (após fail intent) |
| `payout_failed` | `payout.service.ts` → actor beneficiário do order |
| `governance_action_failed` | `governance-financial-action-repository.ts` (payload `actor_id` / `target_actor_id` / `actorId`) |
| `cancellation_requested` | `order.service.ts` → `buyerActorId` |
| Bloqueio P2P | `bank-p2p-transfer.service.ts` → `assertActorFinancialPermission` se `actor_id` resolvido |

**PaymentIntent pipeline:** apenas hook assíncrono após falha; não bloqueia criação de intent.

## Níveis (score após `evaluateActorRisk`)

- 0–20 → `low`  
- 21–50 → `medium`  
- 51–80 → `high`  
- 81+ → `blocked`  

## Contas

- `CHECK NOT VALID`: novas linhas `owner_type = 'actor'` exigem `actor_id`; backfill tenta preencher a partir do prefixo UUID de `owner_id`.

## Aplicar

```bash
# após migrations anteriores (ex.: 0053–0055)
pnpm run migrate   # ou aplicar 0056 manualmente em ambientes com drift
```

## Auditoria — aprovação parcial

Base (identidade + `actor_events` + perfil + hooks) **aprovada**. Pendências fechadas em **PROMPT 53.1**: backfill `actor_id` + `VALIDATE CONSTRAINT`, enforcement uniforme em fluxos financeiros, score derivado/job, estrutura de limites. Ver **[PROMPT_53_1_RISK_ENFORCEMENT_HARDENING.md](../02_decisions/PROMPT_53_1_RISK_ENFORCEMENT_HARDENING.md)**.

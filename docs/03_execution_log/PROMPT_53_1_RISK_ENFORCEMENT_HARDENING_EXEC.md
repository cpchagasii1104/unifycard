# Execução — Prompt 53.1 — Risk Enforcement Hardening

**Data:** 2026-03-18

**Auditoria constitucional (2026-03-18):** ✔ APROVADO — hardening completo; fase estrutural (financeiro + identidade + risco) **encerrada**.

## Entregue

| Item | Caminho |
|------|---------|
| Migration | `0057_risk_enforcement_hardening.sql` — backfill `actor_id`, `VALIDATE CONSTRAINT`, `risk_financial_limits_by_level`, `risk_rules_version` em perfil |
| Gate único | `risk-financial-gate.ts` → `requireFinancialRiskClearance` |
| Limites | `risk-limits.repository.ts` |
| Worker | `risk-identity-reconcile.worker.ts` (default 15min) |
| Touchpoints | `FINANCIAL_RISK_ENFORCEMENT_TOUCHPOINTS.md` |

## Política de score

- **Síncrono:** cada `requireFinancialRiskClearance` chama `evaluateActorRisk` (materialização alinhada a eventos).
- **Assíncrono:** worker reprocessa actors com eventos nos últimos 14 dias.

## Aplicar migration

⚠️ Falha se existir `bank_accounts` com `owner_type = 'actor'` e `actor_id` NULL após backfill — corrigir dados antes.

```bash
# aplicar 0057 após 0056
```

# F-ACTOR-WALLET-PAYOUT-GOLIVE-DECISION-PACK-CLOSEOUT — EXECUTION (DOCS-ONLY · decisão soberana Clayton = HOLD go-live)

Consolida as três paralelas READ-ONLY do `F-ACTOR-WALLET-PAYOUT-GOLIVE-DECISION-PACK` e fixa a **decisão soberana de
Clayton**: payout interno provado (controlado) **OK**, mas **go-live em HOLD** — nenhum dinheiro sai do sistema enquanto
PORTA-1, rail externo, kill-switch, KYC/ATL execute-time e RLS/DB-role não estiverem decididos e provados.
**DOCS-ONLY: zero código, migration, runtime, DB write, seed, worker, external payout, HTTP execution.**

- **HEAD before:** `c18473f1` · **HEAD after:** (este commit) · **branch:** `rescue-structural`
- **working tree before:** limpo no escopo material (docs/memorias + untracked alheios pré-existentes)
- **working tree after:** limpo (cartório committado)
- **migrations:** 394/394 (NENHUMA) · **modo:** EXECUTOR · **natureza:** docs-only / decision-pack closeout / HOLD-GOLIVE

## READ-FIRST
Normativos (00_AGENT_PROTOCOL, 07_NOMENCLATURA_CANONICA, SSOT_EXCLUSIVE_BANK_RULE, SSOT_CONTRACT,
SSOT_REGISTRY_UNIFICARD, PROHIBITED_STRUCTURES, LEIS_OPERACIONAIS), REMEDIATION_DECISIONS_LOG, REMEDIATION_DT_LOG,
STATUS_EXECUCAO_GLOBAL, GO-READINESS-CLOSEOUT, + DECISION_0128/0129/0130/0131. Re-verificação fail-closed READ-ONLY:
payout dormente (HTTP 403/disabled · worker default-off · PORTA-1 não semeada · external NOT AUTHORIZED); nenhum STOP.
(Não havia logs prévios de discovery/decision-pack no repo — este é o primeiro artefato a registrar A/B/C.)

## Paralelas READ-ONLY (verdicts + achados)

### Paralela A — PORTA-1 / seed authority → **A_VERDICT = READY_FOR_DECISION**
- PORTA-1 está **substrato-pronta e auto-limitante**; `financial_approval_policies`/`authorities` = **0/0**; operador é `users.id`.
- O menor seed seguro exigiria: tenant piloto, operador(es), limites, **4-olhos**, revogação, **kill-switch** e escopo.
- kill-switch runtime, audit de arming e rollback compensatório ainda são **MATERIAL_REQUIRED**.
- **Não autoriza seed.**

### Paralela B — rail externo / RLS → **B_VERDICT = HOLD_FOR_EXTERNAL_RAIL + HOLD_FOR_RLS**
- Rail externo/outbound **inexiste**; `destination_type` só aceita `internal_settlement`; PIX atual é **mock/inbound**, não PIX-out.
- Sem ordem externa, status externo, idempotência externa, webhook, conciliação ou compensação.
- App conecta como **postgres/superuser/BYPASSRLS** → **RLS é teatro no runtime atual**; RLS payout/approval/recovery = `false`.
- **DB role/RLS hardening é pré-condição antes de dinheiro real.**

### Paralela C — rollback / TOCTOU / E2E → **C_VERDICT = HOLD_FOR_ROLLBACK + HOLD_FOR_TOCTOU + HOLD_FOR_E2E**
- Sem `external_pending`/outbox/DLQ/retry/backoff/conciliação/compensação; **kill-switch runtime não existe**.
- **Três TOCTOU reais:** (1) KYC intermediário (approval→execute); (2) envelope de risco divergente (transfer genérico vs payout); (3) recovery `pending_approval` entre approval e execute.
- Guards internos fortes, mas **não cobrem rail externo inexistente**.
- **Não autoriza go-live.**

## DECISÃO CLAYTON — PAYOUT ACTOR_WALLET GO-LIVE
- Payout interno: **prova controlada OK** (fluxo actor_wallet → bank_settlement provado em DB efêmero, F2/F3/C3/C7).
- Go-live: **HOLD** · Payout externo: **NOT AUTHORIZED** · PORTA-1: **NOT SEEDED** · Worker: **DEFAULT-OFF** ·
  HTTP execution: **disabled / 403** · External payout: **NOT AUTHORIZED**.
- **Nenhum dinheiro sai do sistema** enquanto PORTA-1, rail externo, kill-switch, KYC/ATL execute-time e RLS/DB-role não
  estiverem **decididos e provados**.

## Bloqueadores (consolidados)
1. **DB role/RLS theatre** — app como superuser/BYPASSRLS; RLS payout/approval/recovery efetivamente inativa.
2. **Rail externo inexistente** — sem PIX-out/TED/PSP, sem ordem/idempotência/webhook/conciliação externos.
3. **Rollback/DLQ/retry/conciliação ausentes** + **kill-switch runtime inexistente**.
4. **TOCTOU** — KYC execute-time, envelope de risco, recovery `pending_approval`.

## Ordem macro aprovada (antes de qualquer go-live)
1. **F-DB-ROLE-AND-RLS-HARDENING** — app role não-superuser; sem BYPASSRLS; grants mínimos; ENABLE/FORCE RLS em
   payout/approval/recovery; boot pre-flight **fail-closed** contra role insegura. **(próxima macro material)**
2. **F-PAYOUT-TOCTOU-SAFETY-HARDENING** — KYC execute-time simétrico ao approval; risco via envelope de payout (não
   transfer genérico); recovery `pending_approval` tratado antes de execution; guards/E2Es específicos.
3. **F-ACTOR-WALLET-PAYOUT-EXTERNAL-RAIL-DESIGN** — PIX-out/TED/PSP/stub; external payout order; outbox; idempotência
   externa; webhook; reconciliation; compensation/reversal; DLQ/retry/backoff; E2Es sem dinheiro real.
4. **Só depois:** decisão soberana de PORTA-1 seed; eventual worker arming; external payout real, se aprovado.

## Campos (status)
- **payout status:** internal proof OK; external go-live **HOLD** · **PORTA-1 status:** NOT SEEDED ·
  **worker status:** DEFAULT-OFF · **external payout status:** NOT AUTHORIZED · **HTTP execution status:** disabled / 403.
- **DB role/RLS status:** NOT HARDENED (superuser/BYPASSRLS; RLS teatro) — bloqueador #1 · **TOCTOU status:** NOT HARDENED
  (3 janelas) · **external rail status:** INEXISTENTE (design pendente).

## Arquivos alterados (docs-only)
- `REMEDIATION_DT_LOG.md` — entrada do decision-pack (CLOSED / HOLD-GOLIVE) + ordem macro.
- `STATUS_EXECUCAO_GLOBAL.md` — entrada de closeout no topo.
- `docs/03_execution_log/F-ACTOR-WALLET-PAYOUT-GOLIVE-DECISION-PACK-CLOSEOUT.md` — este log (novo).

## DTs ainda abertas
`DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` → **OPEN** (inalterada).

## Gates (docs-only, re-rodados)
actor-writer OK · bank-ledger OK · regression-guards 75 OK/0 FAIL · arch `--strict` critical_new=0 · check:migrations
394/394 · baseline 0113 = 0.

## Commit
`docs(remediation): close payout golive decision pack`

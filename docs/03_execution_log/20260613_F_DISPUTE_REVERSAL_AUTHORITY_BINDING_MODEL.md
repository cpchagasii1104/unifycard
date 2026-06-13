# 2026-06-13 — F-DISPUTE-REVERSAL-AUTHORITY-BINDING-MODEL (MODO: EXECUTOR → DECISION_REQUIRED)

Macrofrente controlada para desenhar o modelo definitivo de autoridade dispute/reversal HTTP. Parent
`794a3b62` · branch `rescue-structural` · dev **380 (inalterado)** · **sem migration · zero código de
rota/Bank tocado**. DECISION-0123.

## Bootstrap normativo

Mesmo substrato sensível (FINANCEIRO/AUTORIDADE) das frentes desta sessão. Lidos p/ esta decisão:
`CORE_ESTORNOS_FINANCEIROS_CANONICO`, DECISION-0052/0111/0113, `reconciliation-dispute.{routes,service,
types,repository}`, `reversal.service`/`requestAndExecuteReversalSync`, `authority.service`/
`authorization.service`/`permission-keys.ts`, schemas reconciliation_disputes/_events/reversals, DTs.

## READ-FIRST — 10 respostas

1. **Rotas seguem disabled** (nenhuma reabilita com segurança agora). 2. P1 = estado puro (zero dinheiro);
P0 move dinheiro real (`requestAndExecuteReversalSync`→`bank_transactions`). 3. **NÃO** há admin/support
real fora do RBAC V2; `ALLOWED_CREATION_KINDS` é validação service-layer sem permission-key. 4. `company_
users` poderia participar, mas disputa é operacional/sistêmica (sem actor party); escopo não decidido.
5. **`system` NÃO** vem de rota HTTP humana (CORE_ESTORNOS). 6. **`/reversal` NÃO** reabilita sem Core de
Aprovação Financeira (conflito de taxonomia — caminho é job/evento interno). 7. P1 não reabre antes/sem
decisão de permission-key+política. 8. Trilha auditável existe (`_events` actor_kind/actor_id) mas exige
actor server-side real inexistente hoje. 9. Conter **não** exige migration; reabilitar exige decisão. 10.
P0 toca Bank/engine (STOP); P1 exige decisão de política (STOP).

## Decisão

**DECISION_REQUIRED / HOLD** — documentado o modelo (DECISION-0123); **nada reabilitado**; **zero código
de rota/Bank/engine/migration alterado**. P0 e P1 seguem 403. Reabilitação depende de decisão de produto
(Core de Aprovação Financeira p/ P0; permission-key + política de reconciliação manual + escopo p/ P1).

## Arquivos alterados (docs + e2e; ZERO produção)

| Arquivo | Mudança |
| --- | --- |
| `docs/02_decisions/DECISION_0123_DISPUTE_REVERSAL_AUTHORITY_BINDING_MODEL.md` (novo) | modelo + decisão requerida |
| `src/scripts/validate-pipeline-e2e-dispute-reversal-authority-model.ts` (novo) + wrapper (novo) | prova de contenção 10/10 |
| `REMEDIATION_DECISIONS_LOG.md` · `REMEDIATION_DT_LOG.md` · `STATUS_EXECUCAO_GLOBAL.md` | cartório |

## Provas

| Prova | Resultado |
| --- | --- |
| e2e `dispute-reversal-authority-model` (DB efêmera) | **10/10** |
| 4 rotas seguem 403 (P1 ×3 MUTATION + P0 REVERSAL); body.actor IGNORADO | ✅ |
| body.actor não alcança service (sem parseActor/service de mutação nos handlers) | ✅ |
| zero linha em reconciliation_disputes/_events | ✅ |
| zero linha em reversals/bank_ledger/bank_transactions | ✅ |
| contenções (3× mutation + 1× reversal) + GET /events preservados | ✅ |
| Gates | actor-writer OK · bank-ledger OK · regression-guards rc=0 · arch --strict critical_new=0 |
| tsc backend | 25 (baseline arco 0113), zero novo | sem migration · dev 380 |

## Hard stops respeitados

Zero toque em bank_ledger/bank_transactions/reversal.service/requestAndExecuteReversalSync/CHECKs de
reversals/migration financeira; `authoritySource='system'` não usado em rota humana (nada reabilitado);
body.actor não aceito; RBAC V2/FASE6/R2/PJ/CNAE/frontend não tocados; `/reversal` não reaberto; POST
/service-orders não reaberto.

## Cartório

- DECISION-0123 + REMEDIATION_DECISIONS_LOG.
- `DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED`: P0 CONTAINED + **modelo/decisão registrada** (Core de Aprovação Financeira).
- `DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY`: P1 CONTAINED + **modelo/decisão registrada** (permission-key + política).

## Estado

F-DISPUTE-REVERSAL-AUTHORITY-BINDING-MODEL: **DECISION_REQUIRED / HOLD**.

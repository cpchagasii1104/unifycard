# EXECUTION LOG — Correção do fixture pelo writer Fase C · Runner 191/191 · Selos autorizados (2026-07-18)

> **MODO: EXECUTOR.** GO material para: (1) trocar o INSERT direto do E2E pelo writer canônico da Fase C; (2) reexecutar o runner; (3) se 191/191, registrar os 2 selos autorizados. **RESULTADO: runner 191/191 (exit 0) — os DOIS selos foram registrados.**

**HEAD inicial:** `5f2e5f7e8` · **HEAD final:** `6e31400f3`.
**Âncoras:** `YALA_FINAL_REGULARIZACAO_R1_R10_2026-07-18.md` · `EXECUTION_LOG_F1_F3_O1_RUNNER_STOP_2026-07-18.md`.

## 1. Causa do STOP anterior
Após F-1 desbloquear o guard C1 (posição 13), o runner avançou e falhou na **posição 178** — `audit-actor-territorial-assignment-foundation` (D2): o E2E `validate-pipeline-e2e-regional-fund-residence-reader.ts` (Fatia D) semeava a residência actor-scoped por `INSERT INTO address_assignments (... actor_id ...)` direto, que o guard barra como "writer aberto antes da Fase C". Bloqueador latente, imputável à Fatia D.

## 2. Via escolhida: WRITER CANÔNICO (allowlist expressamente PROIBIDA)
- **Writer utilizado:** `setActorTerritorialAddress(auth, input)` de `src/core/location/actor-territorial-address-writer.service.ts` — o **writer SELADO da Fase C**, o MESMO entrypoint governado que a rota `POST /actors/:actorId/territorial-address` usa (API_CONTRACT_GOVERNANCE §5). Prova de que é o entrypoint canônico: a rota o chama EXCLUSIVAMENTE; o guard territorial o tem na allowlist de CAMINHO EXATO (`FASEC_SVC`); ele prova Authority por `canRepresentActor`, valida purpose→role, cria endereço + assignment atomicamente com idempotência.
- **Por que não o onboarding service (`setResidenceAddress`)?** Ele re-resolve o CEP (Fase B) e só aceita cidades CEP-resolvíveis reais; o E2E precisa de múltiplas cidades sintéticas (Curitiba/SP/sem-fundo/sem-cidade) para provar ISOLAMENTO — usá-lo REDUZIRIA a cobertura (§3 proíbe). O writer da Fase C aceita `cityId` canônico direto, preservando a cobertura. `TerritorialAddressInput.cityId` é nullable → cobre `canonical_city_missing`.
- **Allowlist NÃO ampliada** (expressamente proibido pela missão): o guard `audit-actor-territorial-assignment-foundation.mjs` está **byte-intacto**; a correção foi no E2E.

## 3. Remoção do INSERT + cobertura preservada
- Removido o `INSERT INTO address_assignments (... actor_id ...)` direto (e o `createAddress` avulso) de `setActorResidence`; agora chama `setActorTerritorialAddress` (Authority por ownership do user-actor: `operatorUserId=userId`, `actorId`=actor do próprio user). Sem pré-inserção, sem simular sucesso, sem desabilitar trigger/RLS/guard. O legado `owner_type='profile'` (caso E) permanece via `assignAddress` (não contém `actor_id` — não é o alvo do guard).
- **Nova asserção G** (§3): prova o caminho canônico por evidência de contrato — `WriteResult.operation==='set'` + `role==='RESIDENCE'` + `assignmentId` uuid + o evento `actor_territorial_address_set` em `actor_events` (que **só** o writer emite; um INSERT direto não emitiria). Sem criar campo de auditoria novo.
- **Commit monotemático:** `dac87f91e`.

## 4. Testes isolados (todos verdes)
- typecheck do arquivo (tsconfig.build): 0 erros.
- E2E `regional-fund-residence-reader`: **7/7** (A–F originais preservados: fund_available Curitiba, ISOLAMENTO SP≠Curitiba, regional_fund_not_provisioned, canonical_city_missing, residence_missing legado, **Δbank=0**; + **G** caminho canônico).
- `audit-actor-territorial-assignment-foundation`: **GATE OK**.
- `audit-regional-fund-contract`: **GATE OK** (4 consumidores repo-wide).
- `audit-c1-human-journey-closure`: **GATE OK**.
- guards de fronteira Bank (`financial-approval-core-boundary`, `bank-http-authority-binding`, `reversal-containment`): **GATE OK**.
- `git diff --check`: limpo.
- **Prova negativa:** reintroduzir o INSERT actor-scoped direto no E2E → `audit-actor-territorial-assignment-foundation` **MORDE** (D2); restauração byte-exata (GATE OK de novo).

## 5. Runner canônico — 191/191
```text
comando:  node scripts/run-regression-guards.mjs   (PATH += node_modules/.bin p/ guards tsx)
dir:      C:\unificard\backend · node v22.16.0 · commit dac87f91e
duração:  ~97s · CMDS=191
RESULTADO: 191/191 · exit 0 · 0 GATE FAIL
warnings: 1 (honesto) — fiscal-tax-catalog: "hardcode ausente mas DT-INVOICING segue OPEN" (esperado; DT reaberta em R-1, não fechável)
dev antes==depois: migrations=520 · bank(ledger/tx)=0/0 · invoices/invoice_items=NULL (ghost)
Δbank=0 · migrations aplicadas=0
```

## 6. Selos registrados (commit de cartório `6e31400f3`)
- **SELO A · REGULARIZAÇÃO PROCESSUAL — SELADA PELA YALA** (YALA FINAL §2/§10).
- **SELO B · FATIA C CONTENÇÃO FAIL-CLOSED — SELADA PELA YALA** (YALA FINAL §4.1): módulo Invoicing NÃO materializado; invoices/invoice_items ausentes; contenção 503 antes do schema-ghost; **DT-INVOICING permanece OPEN · PARCIALMENTE REMEDIADA**; nenhum documento fiscal oficial; nenhum default fiscal; selo restrito à contenção.

## 7. Estado que permanece (não selado / aberto)
- **Fatia A** = CONDICIONAL / AGUARDANDO YALA (prova FULL bloqueada por R-7 — perfil efêmero governado).
- **Fatia D** = CONDICIONAL / AGUARDANDO YALA (F-2/R-8 — fronteira Bank de `core/unifybank` sem jurisdição promulgada). O bloqueador do E2E foi corrigido, mas isso NÃO sela a Fatia D.
- **DT-INVOICING-HARDCODED-TAX-RATE** = 🔴 OPEN · PARCIALMENTE REMEDIADA.
- **R-7** (`DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED`) e **R-8** (`DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`) = OPEN (não tocadas).
- D9.2-B / B-CITY-2 / PORTA 01: não tocados; fechados/STOP.
- `unificard_dev` intocado; **migrations=0**; **Δbank=0**; N0/N1/N2/ontologia intactos; `02_decisions_FULL.txt` intocado.

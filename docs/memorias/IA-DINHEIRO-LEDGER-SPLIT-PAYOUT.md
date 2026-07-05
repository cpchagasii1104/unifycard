# IA-16 — Dinheiro / Ledger / Split / Payout

> RAIO X READ-ONLY do eixo financeiro do Unificard. Insumo para a IA-DIRETORA/Clayton. **NÃO é GO, não autoriza execução, não move dinheiro.** Disco vence narrativa.

## 1. Carimbo

- **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d` — "docs(orchestration): add systemic x-ray consolidation"
- **Branch:** `rescue-structural` · **migrations no disco:** 400 (`.sql`)
- **Data/hora:** 2026-06-22 (sessão IA-DINHEIRO)
- **READ-ONLY confirmado:** SIM. Nenhum INSERT/UPDATE/DELETE/migration/endpoint financeiro executado.
- **Arquivo criado/atualizado:** `docs/memorias/IA-16-DINHEIRO-LEDGER-SPLIT-PAYOUT.md` (este; único alvo de escrita).
- **Memória lida:** `docs/memorias/MINHA_MEMORIA_DINHEIRO.md` — **ENCONTRADA** e lida integralmente (92 KB, append-only, até ponteiro F-ACTOR-SCOPED-REFERRAL-EARNINGS-AUDIT). Também `docs/memorias/README.md` (protocolo).
- **Backend/schema/docs consultados:** `backend/src/modules/{bank,wallet,financial-recovery,reversal,payments,services,marketplace,payout,events,reconciliation}`, `backend/migrations/*.sql`, `backend/scripts/audit-*.mjs`, `backend/package.json`, `docs/02_decisions/DECISION_0140/0141`, `PLANO-DEFINITIVO-0131-EXECUTORA.md`.
- **Banco consultado:** NÃO (nenhuma query ao `unificard_dev`). Schema lido pelo disco (migrations = fonte de verdade on-disk). Estado runtime-aplicado declarado **INCONCLUSIVO** → IA-BANCO.
- **Comandos/probes usados:** workflow ultracode de **12 auditores READ-ONLY paralelos** (ledger · tx · intents · splits · wallets · recovery · refund · payout · fees · settlement · po_spr · rls_gates), 322 tool-uses, ~1M tokens; + cross-check adversarial próprio (rg/grep/git em ledger append-only, splits UPDATE, availableBalanceCents, FOR UPDATE, fee_rate_bps, payout 403).
- **Confirmação de que nenhum fluxo financeiro foi executado:** SIM — só leitura/prova estática. Nenhum worker ligado, nenhum POST/PUT, nenhum script de escrita rodado.

## 2. Escopo

**Auditado (eixo dinheiro):** `bank_ledger`, `bank_transactions`, `bank_splits`, `payment_intents`, wallets (`actor_wallet`/`user_wallet`), recovery (obligations/entries/finalize/debit), refund/reversal, payout (canonical actor_wallet + legado seller_available/seller_payout), fees (`economic_policy_lines.bps` / fee_rate_bps / DECISION-0140/0141), settlement (core/event/bank-worker), PO/SPR/AP/AR/region-account, RLS, boundary gates, frontend financeiro (superficial), e dinheiro chamado por outros eixos (handoff).

**Fora do escopo (handoff):** cadastro/auth, perfil/SSOT, actor model completo, autoridade global (exceto autoridade *financeira*), empresa/PJ, semântica, oferta, tempo/booking, marketplace não-financeiro, produtos/estoque, locações, assinaturas, logística, frontend completo, schema geral não-financeiro.

## 3. Memória histórica vs estado vivo

`MINHA_MEMORIA_DINHEIRO.md` **ENCONTRADA**. Comparação com código/schema vivo `aaeb50b5`:

| Afirmação da memória | Classificação | Nota |
|---|---|---|
| bank_ledger é SSOT; saldo só do ledger; append-only | **CONFIRMADA** | triggers `0021/0027`; SUM(credit−debit) `bank-ledger.repository.ts:198-215`; sem balance armazenado |
| availableBalanceCents = projeção, não autoriza saque (DECISION-0053) | **CONFIRMADA** | `actor-wallet-balance-projection.ts:40`; payout recalcula in-TX |
| Split imutável após ledger | **PARCIAL/CONTRADITA** | imutável **de-facto** (zero writer prod), mas **SEM trigger DB append-only** em `bank_splits` (≠ ledger) → SPLIT-01 |
| Payout toctou hardening + FOR UPDATE + worker default-off + HTTP 403 (`dd270f41`) | **CONFIRMADA** | `actor-wallet-payout.service.ts:482-743`; `payout.routes.ts:17-22` |
| Recovery síncrono material (debit/withholding/finalize/obligations) | **PARCIAL** | máquina implementada e provada; **genesis da obrigação ausente em runtime** → RECOVERY-01 |
| user_wallet = destino canônico de recovery ao payer (DECISION-0056) | **CONFIRMADA (resolver)** | `recovery-creditor-resolver.service.ts:51-81` fail-closed; seeding vivo INCONCLUSIVE |
| reversal tradicional bloqueado quando recovery governa | **CONFIRMADA** | `reversal.service.ts:50-92,220,441` |
| DT-RECONCILIATION-OBSERVABILITY-WINDOWS / payout HOLD-GOLIVE | **CONFIRMADA** | workers default-off; cadeia sealed |
| fee-bps pendente (0140/0141 DOCS-ONLY) | **CONFIRMADA** | `fee_rate_bps` em **0 migrations**; SSOT = `economic_policy_lines.bps` (`20260530561000`) |
| RLS migration committed mas talvez não aplicada (DRIFT) | **CONFIRMADA-COMO-INCONCLUSIVE** | 14 tabelas RLS no disco (`20260516100000`+`20260620120000`); aplicação viva → IA-BANCO |
| Delta dd270f41→aaeb50b5 toca dinheiro? | **CONFIRMADA: NÃO** | 5 migrations + commits = só semântica/oferta (F-OFFER, DECISION-0142..0146). Money axis inalterado. |

**Conclusão:** a memória está majoritariamente **CONFIRMADA**; a única correção material é a **imutabilidade de split** (memória dizia "imutável após ledger" como fato pleno; o vivo mostra imutável só por disciplina de código, sem trava DB).

## 4. Mapa macro financeiro

```
payment_intent ─→ bank_transaction ─→ bank_ledger ─→ split ─→ wallet projection ─→ recovery/refund ─→ payout ─→ evento/auditoria
   FECHA            FECHA_C/RISCO      FECHA          FECHA_C/RISCO   FECHA              FECHA_C/RISCO       HOLD_FINANCEIRO   FECHA
```

- **payment_intent → FECHA:** amount_cents BIGINT; status coerente (CHECK == TS); `refunded_via_recovery`/`released_to_actor_wallet` materializados; partes server-derived; sem spoof.
- **bank_transaction → FECHA_COM_RISCO:** atômico com ledger **só na aplicação** (mesma TX/ROLLBACK); `transaction_id` é FK **NULLABLE**, sem constraint DB de pareamento (TXN-01). Idempotência forte.
- **bank_ledger → FECHA:** SSOT; BIGINT; append-only por trigger; balance derivado; sem writer indevido em prod.
- **split → FECHA_COM_RISCO:** criado na mesma TX do ledger com validação SUM==tx; mas **sem trigger append-only** (SPLIT-01).
- **wallet projection → FECHA:** projeção pura sobre ledger; availableBalanceCents não autoriza; sem writer direto; cached_balance NO-OP.
- **recovery/refund → FECHA_COM_RISCO:** máquina sólida e double-refund-blocked; mas **nenhum path cria a obrigação** (RECOVERY-01).
- **payout → HOLD_FINANCEIRO:** canonical chain selada (request 403-exec / approve / worker system-only default-off); go-live em HOLD; legado contido em simulador prod-disabled.
- **evento/auditoria → FECHA:** outbox na mesma TX no core (OUTBOX_ATOMICITY); workers de settlement emitem evento; resíduo: `recordReversalPaymentIntent` best-effort fora da TX (REFUND-02, observabilidade).

## 5. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| bank_ledger SSOT | FECHA | `bank-ledger.repository.ts:198-215`; `0003:73` | — | baixo | — | FAST-PATH |
| ledger append-only | FECHA (disco) | trigger `0021/0027`; aplicado-vivo? | — | LEDGER-02 | verificar aplicação | MODO B |
| ledger writers | FECHA_C/RISCO | `createEntry` authorship-mandatory `:68-70`; `insertMaintenanceLedgerDebit` sem authorship `:274-291` | — | LEDGER-01 | tombstone maint writer | MODO C |
| bank_transactions | FECHA_C/RISCO | `0003:44-59`; atomicidade app-only | — | TXN-01 | constraint pareamento | DECISION |
| payment_intents | FECHA | `0004:14`; CHECK == TS; partes server-side | — | baixo | — | FAST-PATH |
| payment status | FECHA | `payment-intent-repository.ts:13` | — | baixo | — | FAST-PATH |
| splits | FECHA_C/RISCO | mesma TX + SUM==tx `bank-transaction.service.ts:1583-1655` | — | SPLIT-03 | idempotência caller | MODO C |
| split immutability | NÃO_FECHA | **sem trigger append-only** (`0022` só inflation guard) | — | **SPLIT-01** | trigger append-only em bank_splits | MODO B |
| actor_wallet | FECHA | `bank-account.service.ts:308-320` | — | baixo | — | FAST-PATH |
| user_wallet | FECHA | resolver fail-closed `recovery-creditor-resolver.service.ts:51-81` | — | seeding INCONCLUSIVE | — | FAST-PATH |
| availableBalanceCents | FECHA | `actor-wallet-balance-projection.ts:40`; recalcula in-TX | — | nenhum | — | FAST-PATH |
| recovery obligations | FECHA_C/RISCO | substrato `20260530570000`; BIGINT; append-only entries | — | RECOVERY-01 | wiring de genesis | MODO C |
| recovery entries | FECHA | `20260530570000:113-127` | — | baixo | — | FAST-PATH |
| debitActorWalletForRecovery | FECHA | `actor-wallet-debit.service.ts:89-193` | — | RECOVERY-02 | — | FAST-PATH |
| finalizeRecoveryCase | FECHA | `recovery-finalization.service.ts:89-157` idempotente | — | baixo | — | FAST-PATH |
| refund/reversal | FECHA | UNIQUE original_tx `0051:23`; double-block | — | REFUND-03 | — | FAST-PATH |
| payout HOLD | FECHA | `payout.routes.ts:17-22` 403; worker default-off | go-live | baixo | — | HOLD |
| seller_available legado | FECHA_C/RISCO | só via simulador prod-403 `financial-simulator.controller.ts:23-29` | — | PAYOUT-01 | tombstone legado | MODO C |
| seller_payout legado | FECHA_C/RISCO | `payout-worker.ts:101-111` tombstone | — | PAYOUT-01 | tombstone legado | MODO C |
| payout locks | FECHA | `actor-wallet-payout.service.ts:487-609` FOR UPDATE | — | baixo | — | FAST-PATH |
| obligations SELECT FOR UPDATE | FECHA | drain FIFO `:597-632` | — | baixo | — | FAST-PATH |
| fee_bps | NÃO_FECHA | `fee_rate_bps` em 0 migrations; fee não toca ledger | dinheiro real | **FEE-01/02** | material fee migration | DECISION + 3 paralelas |
| settlement | FECHA_C/RISCO | core proxy-dead + 403; event-settlement no-ledger; bank-worker off | — | SETTLE-01/02 | — | HOLD |
| accounts_payable | FECHA | proxy reject + 403 + ghost table | — | AP-AR-02 | — | HOLD |
| accounts_receivable | FECHA | proxy reject + 403 + ghost table | — | AP-AR-02 | — | HOLD |
| purchase-order receive | FECHA | route 403 + service hard-stop `:186-201` | — | PO-RECV-03 | — | HOLD |
| service-payment-request | FECHA_C/RISCO | create/read OK; **/execute sem canRepresentActor** | reopen | **SPR-EXEC-01** | authority binding /execute | DECISION + 3 paralelas |
| RLS 395/critical | INCONCLUSIVE | 14 tabelas no disco; aplicação viva? | dinheiro real | **RLS-01** | apply+verify RLS vivo | MODO B (IA-BANCO) |
| bank-ledger-boundaries gate | FECHA_C/RISCO | `audit-bank-ledger-boundaries.mjs` só INSERT/UPDATE raw | — | GATE-01 | ampliar gate | MODO C |
| actor-writer-boundaries gate | FECHA_C/RISCO | fora do `regression-guards` chain | — | GATE-02 | wire no chain | MODO C |
| regression guards | FECHA | `package.json:77` ~80 audits | — | baixo | — | FAST-PATH |
| frontend wallet/payout | FECHA_C/RISCO | sem availableBalanceCents; botões payout → 403 | — | FE-01 | handoff FE | MODO C |
| dinheiro em booking | DINHEIRO_FORA | service-payment via firewall OFF | — | — | — | HOLD |
| dinheiro em marketplace | HOLD_FINANCEIRO | checkout in-memory; executePayout orphan/proxy | — | XAXIS-01 | — | HOLD |
| dinheiro em produto | DINHEIRO_FORA | price_cents BIGINT; sem ledger no checkout | — | — | — | INCONCLUSIVE |
| dinheiro em locação | DINHEIRO_FORA | rental = stub (IA-13) | — | — | — | HOLD |
| dinheiro em assinatura | INCONCLUSIVE | billing fantasma (handoff) | — | — | — | INCONCLUSIVE |
| dinheiro em logística | DINHEIRO_FORA | greenfield (IA-15) | — | — | — | HOLD |

## 5b. Perguntas obrigatórias — respostas explícitas (1–22)

1. bank_ledger é a única fonte de verdade de saldo? **SIM** (`bank-ledger.repository.ts:198-215`; sem coluna balance).
2. Existe saldo inferido fora de bank_ledger? **NÃO** (saldo de conta sempre do ledger; `region_accounts`/`regional_funds` dual-truth é dormante/proxy-morto, não fonte de saldo de conta).
3. Todo dinheiro material usa amount_cents/price_cents BIGINT? **PARCIAL** (core ledger/tx/split/payout = BIGINT; resíduos NUMERIC fora do ledger: `social_impact.balance`, `product_prices.price` legado).
4. Existe NUMERIC/decimal para dinheiro material? **RISCO** (no cofre NÃO; resíduos legados/ghost fora do ledger; não afetam saldo realizado).
5. Split é imutável após ledger? **PARCIAL** (de-facto sim; **sem trigger DB append-only** — SPLIT-01).
6. payment_intent está causalmente protegido? **SIM** (partes server-side, status coerente, terminal states, sem spoof).
7. Refund/recovery evita double refund? **SIM** (UNIQUE original_tx + FOR UPDATE + paths mutuamente exclusivos).
8. Recovery está material e seguro? **PARCIAL** (máquina sim; **genesis de obrigação ausente** — RECOVERY-01).
9. user_wallet é destino canônico de recovery ao payer? **SIM** (resolver fail-closed DECISION-0056; seeding vivo INCONCLUSIVE).
10. availableBalanceCents é usado apenas como leitura? **SIM** (pre-check; execução recalcula in-TX).
11. Payout está HOLD e protegido? **PARCIAL** (protegido: HTTP 403 + worker default-off + toctou; go-live/external rail em HOLD).
12. Payout impede saque de dinheiro comprometido por recovery? **SIM** (drain FIFO FOR UPDATE + pending_approval block in-TX).
13. Existe trilho legado seller_available/seller_payout perigoso? **RISCO** (presente; reachable só via simulador 403-em-produção; worker tombstone).
14. Fees/fee_bps estão resolvidos? **NÃO** (régua DOCS-ONLY; `fee_rate_bps` em 0 migrations; fee não toca ledger; DT OPEN).
15. RLS financeiro está aplicado no banco vivo? **INCONCLUSIVE** (14 tabelas no disco; aplicação+role de runtime → IA-BANCO).
16. Rotas financeiras internas perigosas estão fail-closed? **PARCIAL** (a maioria 403/proxy; `/execute` sem `canRepresentActor` atrás de firewall — SPR-EXEC-01).
17. purchase-order/service-payment-request têm autoridade financeira correta? **PARCIAL** (PO + SPR create/read OK; `/execute` GAP — SPR-EXEC-01).
18. Gates pegam violações financeiras relevantes? **PARCIAL** (bank-ledger gate só INSERT/UPDATE raw; sem NUMERIC/split-mutation/legacy-payout; actor-writer fora do chain).
19. Algum eixo pré-dinheiro chama dinheiro hoje? **NÃO** (payout/unifycard/services 403; checkout in-memory; marketplace executePayout órfão).
20. O eixo bloqueia MTP? **NÃO_BLOQUEIA** (dinheiro fora do MTP; jornada pré-money fechada).
21. O eixo bloqueia público? **NÃO_BLOQUEIA** (nada move dinheiro via HTTP).
22. O eixo bloqueia dinheiro real? **HOLD_FINANCEIRO** (cofre sólido; liberação travada por 5 blockers).

## 6. Achados críticos

### SPLIT-01 — bank_splits sem trigger DB append-only (assimetria com bank_ledger)
- **Descrição:** `bank_splits` confia só em `validate_split_total` (`0022`), que permite UPDATE desde que SUM ≤ tx amount. Não há trigger `no_update/no_delete` como no ledger (`0021/0027`). Splits são imutáveis **só porque nenhum writer de produção os muta**.
- **Evidência:** `backend/migrations/0022_split_invariant.sql:24-45` vs `0021_ledger_append_only.sql:8-13`. Zero UPDATE/DELETE prod em `bank_splits` (confirmado por mim + agente).
- **Impacto:** UPDATE manual/rogue ou writer futuro poderia divergir split do ledger sem rejeição DB.
- **Bloqueia MTP?** Não · **Bloqueia público?** Não · **Bloqueia dinheiro real?** Não hoje (HOLD: endurecer antes de liberar) · **DECISION?** Não · **3 paralelas?** Recomendado se virar fatia material · **YALA?** Sim · **Modo:** MODO B (migration forward-only de trigger append-only).

### SPR-EXEC-01 — POST /services/.../execute sem `canRepresentActor` (privilege bypass latente atrás do firewall)
- **Descrição:** a rota `/execute` gateia só no firewall DECISION-0110 (default OFF) + auth; **não** chama `canRepresentActor`, e `createExecution()` não amarra autoridade do caller (deriva payer/receiver do payment_request e move o wallet do payer).
- **Evidência:** `service-payment-execution.routes.ts:39-78` (sem canRepresentActor) vs `:106-113` (read tem); `service-payment-execution.service.ts:411-472`; firewall `service-financial-firewall.ts:17-20`.
- **Impacto:** se a flag `SERVICE_FINANCIAL_RUNTIME_ENABLED='true'`, qualquer user autenticado do tenant executaria qualquer payment_request pendente e debitaria o payer.
- **Bloqueia MTP?** Não · **público?** Não · **dinheiro real?** Não hoje (contido por flag OFF) — **bloqueia o REOPEN da flag** · **DECISION?** Sim (autoridade de execução de serviço) · **3 paralelas?** SIM · **YALA?** Sim · **Modo:** DECISION + 3 paralelas. **Cross-eixo IA-ACTOR/IA-AUTORIDADE.**

### RECOVERY-01 — nenhum path de produção CRIA uma obrigação de recovery
- **Descrição:** toda a máquina (debit, drain FIFO, finalize, gate de payout, bloqueio de reversal pós-D-money) está implementada e wired, mas **não existe runtime que faça INSERT em `actor_wallet_recovery_obligations`** — `resolveRecoveryCreditor` não tem caller que materialize; só E2E scripts inserem.
- **Evidência:** grep `INSERT INTO actor_wallet_recovery_obligations` → só `backend/src/scripts/*`; `recovery-creditor-resolver.service.ts:34` sem caller prod.
- **Impacto:** após reversal pós-D-money ser bloqueado (apontando para o fluxo de recovery), não há handler que abra a obrigação. Recovery é **não-funcional ponta-a-ponta** sem INSERT manual. NÃO corrompe ledger; o fluxo de devolução é que não nasce.
- **Bloqueia MTP?** Não · **público?** Não · **dinheiro real?** INCONCLUSIVE (bloqueia a *política* de recovery, não o cofre) · **DECISION?** Talvez (onde nasce a obrigação) · **3 paralelas?** Sim se virar fatia · **YALA?** Sim · **Modo:** MODO C (wiring resolver→INSERT). **Confirmar com IA-DIRETORA se há entry-point fora de `backend/src`.**

### FEE-01 / FEE-02 — fee resolvido nunca toca o ledger; fee_rate_bps não materializado
- **Descrição:** no path marketplace o gross inteiro vai para escrow; o `feeAmountCents` só alimenta `settlementService.createFromPayment`, cujo repo é Proxy fail-fast (throw) capturado e logado. Fee = audit-snapshot. `fee_rate_bps` (DECISION-0140) não existe em migration; SSOT vivo é `economic_policy_lines.bps`. DTs OPEN/MATERIAL_REQUIRED.
- **Evidência:** `payment-execution.service.ts:418,707`; `settlement.service.ts:11`; `20260530561000:71`; `DECISION_0140/0141`.
- **Impacto:** receita de plataforma/fundo regional **não capturada** no ledger realizado (incompletude, não vazamento). Path legado `bank-split-engine` usa float % (não bps) mas **escreve** no ledger via `createTransactionWithExplicitSplitLines` (FEE-04).
- **Bloqueia dinheiro real?** Não (não há débito incorreto), mas economia de fee é inerte · **DECISION?** Sim (modelo de fee) · **3 paralelas?** SIM · **YALA?** Sim · **Modo:** DECISION_FEE_MODEL + 3 paralelas (Evidence Pack + E2E 299¢ + negative-proof `/100`).

### RLS-01 — eficácia da RLS depende do role de runtime ser `unificard_app` (não verificável no disco)
- **Descrição:** 14 tabelas declaram ENABLE+FORCE RLS + role `unificard_app` NOSUPERUSER/NOBYPASSRLS no disco; mas RLS é "teatro" se o runtime conectar como postgres/superuser. Preflight é fail-closed **só em produção** (dev não).
- **Evidência:** `20260516100000` + `20260620120000`; `db-role-rls-preflight.ts:139-165`; reseal `e0fe89b9` (WM1: migration committed, **não aplicada no dev**; 7 tabelas RLS OFF em dev).
- **Impacto:** isolamento cross-tenant do ledger/substrato depende do role vivo. Em dev, ainda pode rodar superuser silenciosamente.
- **Bloqueia dinheiro real?** HOLD (isolamento é pré-condição de dinheiro real) · **DECISION?** Não · **3 paralelas?** Não (verify), Sim se aplicar migration material · **YALA?** Sim · **Modo:** MODO B (apply+verify) — **prova-viva = IA-BANCO.**

### TXN-01 — atomicidade transaction↔ledger é só de aplicação; sem constraint DB
- **Descrição:** os 4 writers escrevem tx+ledger na mesma TX com ROLLBACK, mas `bank_ledger.transaction_id` é FK **NULLABLE** e nenhum trigger força pareamento débito+crédito balanceado por transação.
- **Evidência:** `0003_bank_core.sql:67-77`; `bank-transaction.service.ts:519-665`.
- **Impacto:** writer futuro/SQL direto poderia criar tx sem ledger (ou ledger órfão). Latente, não ativo.
- **Bloqueia dinheiro real?** Não hoje · **DECISION?** Não · **Modo:** DECISION/MODO C (NOT NULL + reconciliation job). **IA-BANCO: probe de integridade vivo (tx sem ledger balanceado).**

### Achados MÉDIOS/BAIXOS (resumo)
- **LEDGER-01 (M):** `insertMaintenanceLedgerDebit` escreve ledger sem authorship; caller único = backfill offline E2E. Tombstone recomendado.
- **PAYOUT-01 (M):** movers legados `seller_available→seller_payout` vivos, reachable só via simulador `403-em-produção`; worker legado tombstone. Depende de NODE_ENV correto.
- **XAXIS-01 (M):** `marketplace/payout.service.ts.executePayout` mantém lógica real de dinheiro atrás de Proxy morto + sem rota; cliente FE órfão. Risco de reativação.
- **GATE-01 (M):** `audit-bank-ledger-boundaries.mjs` só pega INSERT/UPDATE raw — não pega chamadas de service-method de outros módulos, SELECT, NUMERIC, mutação de split, payout legado.
- **GATE-02 (B):** `audit-actor-writer-boundaries` fora do chain `validate:regression-guards`.
- **SETTLE-01 (M):** event-settlement grava `settled_at=NOW()` + `settlement_id` morto **sem** movimento de ledger/callback — SETTLED é flag sem lastro.
- **SETTLE-02 (M):** `bank-settlement-worker` é executor de ledger vivo, inerte só por default-off + fila vazia (sem `createBankSettlement` caller).
- **REFUND-02 (B):** `recordReversalPaymentIntent` best-effort fora da TX (observabilidade, não dinheiro).
- **REFUND-03 (M):** `executeDisputeFinancialReversal` ainda deriva actorId do body; vivo só barrado por 403 de rota + guard (DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED).
- **SPLIT-02/03 (M):** DB só garante SUM ≤ tx (não ==); writer context-based sem idempotência interna por referência.
- **NUMERIC residual (B/RISCO):** core ledger/tx/split = BIGINT limpo; resíduos NUMERIC fora do ledger: `social_impact.balance NUMERIC(12,4)` (`20260530340000:24`), `product_prices.price NUMERIC(20,2)` (`20260415120000:14`, legado em migração), `economic_guardianship.limit_amount NUMERIC` (já tem `_cents` BIGINT por `20260513100000`). Não material no cofre.

## 7. Gaps de conexão

- **Recovery genesis ↔ reversal block:** o bloqueio pós-D-money aponta para "use o fluxo de recovery", mas o fluxo de recovery não tem porta de entrada de criação (RECOVERY-01). Gap autoridade↔dinheiro↔estado.
- **Fee ↔ ledger:** fee é decidido (`economic_policy_lines.bps`) mas não liquidado no ledger (settlement proxy morto). Gap dinheiro↔evento.
- **/execute ↔ autoridade:** execução de serviço não amarra `canRepresentActor` (SPR-EXEC-01). Gap dinheiro↔autoridade (cross-eixo IA-ACTOR/IA-AUTORIDADE).
- **RLS ↔ runtime:** trava declarada no disco, eficácia depende do role vivo (RLS-01). Gap dinheiro↔banco (IA-BANCO).
- **Splits ↔ imutabilidade:** invariante de imutabilidade existe no ledger, não em splits (SPLIT-01). Gap estado↔dinheiro.
- **FE payout ↔ backend HOLD:** FE oferece botões de execução de payout que sempre 403 (FE-01). Gap frontend↔contrato.

## 8. Handoffs para outras IAs

- **IA-ACTOR + IA-AUTORIDADE:** SPR-EXEC-01 (autoridade de `/execute`); REFUND-03 (actorId do body no dispute reversal); statement service delega ownership à rota (WALLET-03) — confirmar binding `req.user`/`canRepresentActor` em todo caller.
- **IA-BANCO:** **(crítico)** confirmar no `unificard_dev` vivo: (1) RLS aplicada+forçada nas 14 tabelas e role de runtime (`unificard_app` vs superuser) — RLS-01/LEDGER-02; (2) migrations `0021/0027/0023/20260530570000/572000/573000/561000` aplicadas; (3) integridade: tx sem ledger balanceado / ledger órfão (TXN-01); (4) rowcounts de obligations/reversals reais; (5) existência de tabelas-fantasma (`accounts_payable/receivable/region_account/event_settlements/payment_methods`); (6) `ENABLE_PAYOUT_WORKER`/`ENABLE_BANK_SETTLEMENT_WORKER`/`SERVICE_FINANCIAL_RUNTIME_ENABLED`/`NODE_ENV` em runtime.
- **IA-DECISOES-DT:** registrar/atualizar DTs: SPLIT-01 (novo, append-only splits), RECOVERY-01 (genesis), DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION (fee material), DT-DISPUTE-REVERSAL-AUTHORITY-CLIENT-DECLARED, GATE-01/02; DECISIONs de modelo (fee, /execute authority).
- **IA-DOCUMENTOS:** onde registrar estes achados sem virar norma; precisão cartorial de 0140/0141 (DOCS-ONLY) vs material.
- **IA-FRONTEND-UX-CONTRATOS:** FE-01 (botões payout/execute que 403); FE não usa availableBalanceCents (bom) e mostra saldo como read-projection do backend (correto) — manter.
- **IA-COMERCIO-CONTRACT / IA-MARKETPLACE-JORNADA:** checkout in-memory (DINHEIRO_FORA); XAXIS-01 (executePayout marketplace órfão).
- **IA-ASSINATURAS-RECORRENCIA:** billing fantasma — classificar se chama dinheiro (INCONCLUSIVE).
- **IA-YALA:** qualquer fatia material que tocar ledger/split/payout/recovery/fee exige reseal adversarial.

## 9. Riscos para MTP

- **Bloqueia MTP:** NADA do eixo dinheiro. A jornada pré-money (Caminho B1) já fecha sem mover dinheiro; firewall/HOLD mantêm o cofre fora do MTP.
- **Não bloqueia, mas corrigir:** FE-01 (botões placebo de payout), GATE-01/02 (cobertura de gate), SETTLE-01 (SETTLED sem lastro = semântica enganosa).
- **V2:** external rail de payout (PIX/TED), fee material, recovery genesis, cartão físico.
- **Cleanup:** tombstone de `insertMaintenanceLedgerDebit`, legado `seller_available`/`seller_payout`, `marketplace/payout.service.executePayout`.
- **Exige decisão de produto/arquitetura:** modelo de fee (DECISION_FEE_MODEL), autoridade de `/execute` (DECISION), onde nasce a obrigação de recovery, NOT NULL+constraint de pareamento tx↔ledger.
- **Exige 3 paralelas:** toda materialização que toque ledger/split/payout/recovery/fee/checkout.

## 10. Riscos para público e dinheiro real

- **Blockers antes de público:** nenhum do eixo dinheiro (nada move dinheiro via HTTP hoje).
- **Blockers antes de dinheiro real (todos a fechar):**
  - **Ledger:** TXN-01 (constraint pareamento) — endurecer; LEDGER-01 (maint writer) — tombstone.
  - **Split:** SPLIT-01 (trigger append-only) — **obrigatório** antes de dinheiro real.
  - **Payout:** confirmar worker default-off vivo + external rail é DECISION própria; manter HOLD-GOLIVE.
  - **Recovery:** RECOVERY-01 (genesis) — recovery deve ser funcional ponta-a-ponta antes de prometer devolução.
  - **Refund:** REFUND-03 (autoridade dispute) antes de reabrir dispute HTTP.
  - **Wallet:** WALLET-03 (ownership no statement) confirmar no route layer.
  - **Fees:** FEE-01/02 (fee material no ledger) — DECISION_FEE_MODEL + 3 paralelas.
  - **RLS:** RLS-01 — aplicar+verificar role vivo (IA-BANCO) antes de tratar RLS como fronteira de dinheiro real.
  - **Autoridade financeira:** SPR-EXEC-01 antes de reabrir o firewall; `financial_approval_*` seed = ato soberano (PORTA-1).
  - **Gates:** GATE-01/02 ampliar/wire.
  - **E2Es + YALA:** por cadeia, fail-first.
- **Blockers que exigem DECISION:** modelo de fee, autoridade `/execute`, genesis de recovery, pareamento tx↔ledger, PORTA-1 (seed do cofre).
- **Blockers que exigem MODO C:** recovery wiring, tombstones legados, gates.
- **Blockers que exigem 3 paralelas:** fee material, `/execute` authority, qualquer fatia ledger-touching.
- **Deve permanecer HOLD:** payout go-live/external rail, settlement workers, AP/AR reactivation, dispute reversal HTTP, fee material, cartão físico, PORTA-1.

## 11. Veredito final

**HOLD_FINANCEIRO.**

O **cofre (núcleo Bank)** está **materialmente sólido**: `bank_ledger` é SSOT único de saldo (BIGINT, append-only por trigger, balance derivado, sem writer indevido em produção); transações/splits escrevem na mesma TX com validação de soma; `payment_intents` deriva partes server-side sem spoof; recovery e refund têm máquina correta e double-refund bloqueado; payout está hardened (toctou execute-time, FOR UPDATE, worker system-only default-off, HTTP 403) e o legado está contido. **Nenhum fluxo move dinheiro real via HTTP hoje** — tudo selado (403/proxy-morto/firewall-OFF/worker-off).

Mas **dinheiro real NÃO é liberável** por um conjunto de blockers reais: imutabilidade de split não trava em DB (SPLIT-01), recovery não tem genesis de obrigação (RECOVERY-01), fee não chega ao ledger e fee_rate_bps não é material (FEE-01/02), `/execute` não amarra autoridade do caller (SPR-EXEC-01), e a eficácia da RLS no banco vivo é INCONCLUSIVE (RLS-01). Portanto: **cofre fecha; liberação de dinheiro real está em HOLD** até esses blockers fecharem com três paralelas + E2E + YALA.

## 12. Próxima frente recomendada

**Imediata (decisão-independente, mais barata, destrava o maior INCONCLUSIVE): MODO_B_RLS_395_APPLY_VERIFY** — confirmar com **IA-BANCO** se as migrations RLS (`20260516100000` + `20260620120000`) estão aplicadas no `unificard_dev` e se o runtime conecta como `unificard_app` (não superuser); sem isso a RLS é "teatro" e nenhuma fronteira de dinheiro real é confiável.

Em paralelo/sequência (todas **gated, exigem decisão de Clayton + 3 paralelas**):
- **DECISION_FEE_MODEL** → fee material no ledger (FEE-01/02) — Evidence Pack + E2E 299¢ + negative-proof `/100`.
- **DECISION_FINANCIAL_AUTHORITY** → autoridade de `/execute` (SPR-EXEC-01) antes do reopen do firewall.
- **MODO_C_RECOVERY_HARDENING** → genesis da obrigação (RECOVERY-01).
- **MODO B** cirúrgico → trigger append-only em `bank_splits` (SPLIT-01).

**Justificativa de modo:** o cofre não precisa de FAST-PATH (já sólido); o que falta é decisão de produto/modelo + endurecimento, não conserto de bug ativo. Logo o eixo é **HOLD + DECISION/3 paralelas**, com um único MODO B barato e decisão-independente (RLS verify) como primeiro passo.

### REGRA ESPECIAL — exige_3_paralelas
**exige_3_paralelas = SIM** para qualquer frente que materialize fee, `/execute` authority, recovery genesis, split-immutability migration, ou qualquer toque a `bank_ledger`/`bank_transactions`/`bank_splits`/`payment_intents`/payout/recovery/refund/wallet debit-credit/checkout. Divisão:
- **Paralela A — norma/autoridade:** Constituição/Lei 5 (SSOT), DECISIONs (0024/0046/0047/0048/0052/0053/0056/0110/0114/0117/0128/0130/0140/0141), nomenclatura (`_cents` BIGINT / bps), DTs. Donos: IA-DECISOES-DT + IA-AUTORIDADE (autoridade) + IA-ACTOR (representabilidade).
- **Paralela B — schema/código/legado:** `bank_ledger`/wallets/payout/recovery runtime, migrations, ghost tables, RLS, fee engine. Donos: IA-DINHEIRO + IA-BANCO.
- **Paralela C — concorrência/idempotência/gates/E2E/blast radius:** locks FOR UPDATE, idempotency keys, `validate:bank-ledger-boundaries`/`regression-guards`, E2E fail-first + `money-live` + `canal3-money`, reseal YALA.

## 13. Plano mínimo de segurança antes de qualquer dinheiro real

1. **bank_ledger boundaries:** gate ampliado (GATE-01: pegar service-method writes de não-bank + scan NUMERIC-money) + confirmar boundary vivo.
2. **actor authority:** `canRepresentActor` em `/execute` (SPR-EXEC-01); statement ownership no route layer (WALLET-03); dispute reversal authority (REFUND-03).
3. **split immutability:** trigger DB append-only em `bank_splits` (SPLIT-01).
4. **recovery:** genesis de obrigação wired (RECOVERY-01) + funcional ponta-a-ponta.
5. **payout lock:** manter FOR UPDATE + revalidação in-TX + worker default-off; external rail = DECISION própria.
6. **idempotency:** confirmar idempotência de todos os writers (SPLIT-03 caller-side).
7. **RLS:** aplicada + role `unificard_app` (não superuser) no runtime vivo (RLS-01) — IA-BANCO.
8. **fee model:** fee material no ledger via `economic_policy_lines.bps`, nunca `/100`/`fee_percentage` (FEE-01/02).
9. **gates:** wire `actor-writer-boundaries` no chain (GATE-02); ampliar bank-ledger gate.
10. **E2Es:** por cadeia, fail-first + `money-live` + `canal3-money`.
11. **YALA:** reseal adversarial de toda fatia material; nada "fechado" sem selo + prova.
12. **tx↔ledger:** constraint de pareamento / NOT NULL `transaction_id` + reconciliation (TXN-01).

## 14. Resumo executivo

- **Cofre sólido:** `bank_ledger` é SSOT único (BIGINT, append-only por trigger, saldo derivado, sem writer indevido); tx/split/payment_intent corretos e atômicos na aplicação.
- **Nada move dinheiro real via HTTP hoje:** payout 403, unifycard capture/settle 403, services `/pay` 403, AP/AR/region/settlement proxy-morto, checkout in-memory, workers default-off. Estado = **selado**.
- **availableBalanceCents** é projeção e nunca autoriza saque; payout recalcula saldo in-TX com `SELECT FOR UPDATE` (toctou-safe).
- **Recovery/refund** corretos e com double-refund bloqueado; reversal tradicional fail-closed quando recovery governa.
- **5 blockers reais antes de dinheiro real:** SPLIT-01 (split sem trigger append-only), RECOVERY-01 (sem genesis de obrigação), FEE-01/02 (fee não toca ledger; fee_rate_bps não material), SPR-EXEC-01 (`/execute` sem `canRepresentActor`), RLS-01 (eficácia RLS viva INCONCLUSIVE).
- **Risco mais latente:** reativar firewall/flag (`SERVICE_FINANCIAL_RUNTIME_ENABLED`/`ENABLE_*_WORKER`/`NODE_ENV`) sem fechar autoridade — contenção depende de flags corretas em runtime.
- **fee-bps:** DECISION-0140/0141 são régua DOCS-ONLY; `fee_rate_bps` em 0 migrations; SSOT vivo = `economic_policy_lines.bps`; DT material OPEN.
- **Memória vs vivo:** majoritariamente CONFIRMADA; única correção = imutabilidade de split (de-facto, não DB-enforced).
- **Veredito:** **HOLD_FINANCEIRO**. Próxima frente: **MODO_B_RLS_395_APPLY_VERIFY** (IA-BANCO) + DECISIONs de fee/authority/recovery, todas **exige_3_paralelas=SIM**.
- **Prova-viva pendente (IA-BANCO):** RLS aplicada + role de runtime, migrations aplicadas, integridade tx↔ledger, rowcounts, tabelas-fantasma, valores de env/flags.

---

_IA-16 / IA-DINHEIRO — RAIO X READ-ONLY em HEAD `aaeb50b5`. Insumo para IA-DIRETORA/Clayton. Não autoriza execução. Nenhum fluxo financeiro executado; nenhum código/schema/runtime/cartório alterado; sem commit._

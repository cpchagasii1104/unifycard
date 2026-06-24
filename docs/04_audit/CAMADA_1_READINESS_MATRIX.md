# MATRIZ CONSOLIDADA DE PRONTIDÃO — CAMADA 1

**Tipo:** cartório de auditoria (docs-only — este arquivo NÃO executa nada) · consolidação READ-FIRST (Passo 4) · **HEAD `cbad2906`** · branch `rescue-structural` · 2026-06-24.
**Origem:** consolidação das 3 paralelas READ-ONLY de Camada 1 — **A** (Identidade/Autoridade/Guarda · IA-AUTORIDADE), **B** (Semântica/Oferta/Evento Econômico · IA-SEMANTICA), **C** (Bank/Split/Referral/Recovery/Payout · IA-DINHEIRO+YALA) — reconciliadas contra HEAD de 1ª mão pela consolidadora.
**Regra de classificação:** em conflito, vence a **mais restritiva**: `DESCARTE < PROVA < GATE NECESSÁRIO < DECISÃO PENDENTE < EXIGE 3 PARALELAS + DECISÃO CLAYTON`. **OVERLAP ≠ achado novo.** Achado financeiro material **nunca** vira fix direto.

---

## 1. VEREDITO
**CAMADA 1 = READY_FOR_DECISION / NÃO READY_FOR_EXECUTION.** Substrato pré-money **provado e contido**: `bank_ledger` SSOT íntegro (append-only DB-enforced, saldo derivado, BIGINT); splits append-only; significado ancorado em `concept_id` (ledger fail-closed, zero fallback por categoria); fee em **bps** canônico; referral Modelo B = vínculo pré-money sem authority (Δbank=0 provado); rental pré-money com resource-lock; actor_wallet≠user_wallet; payout chain selada (request→approve 4-olhos→execute worker-only/TOCTOU). **Toda execução de dinheiro real está atrás de firewalls OFF + workers default-off + HTTP 403 + RLS físico não-virado.** A reconciliação derrubou o único blocker "duro" alegado (**BODY-01 está contido 501**). Nenhum fluxo de Camada 1 move dinheiro real hoje. O que falta é **decisão soberana + ato OPS + alguns gates de cobertura/autoridade** — não código pré-money.

## 2. ESTADO OPERACIONAL CONSOLIDADO
```
RLS-live ............ PROVADO/READY_FOR_OPS · físico NÃO VIRADO (gargalo estrutural — ato OPS Clayton)
PORTA-1 ............. NÃO semeada (0/0/0 fail-closed) · HOLD/decisão soberana
dinheiro real ...... HOLD (firewalls OFF + workers off + 403)
payout ............. request/approve PROVADO-contido · execute HOLD (worker default-off, TOCTOU selado) · externo INEXISTENTE
referral financeiro  Model B intent-only PROVADO (Δbank=0) · earning material HOLD+3P
recovery ........... máquina PROVADA (debit/drain/finalize FIFO, approval-gated) · GENESIS ausente (GHOST em prod)
fee ................ unidade bps PROVADA · captura no ledger INERTE (settlement proxy-dead) → DECISÃO+3P
settlement ......... core/region DEAD (proxy "migrated to Bank") · event_settlements GHOST (status-only, sem lastro)
votes/ghosts ....... votes contido 501 · seller_payout/AP-AR/marketplace-referral DEAD/tombstone
rental pré-money ... LIVE/PROVADO (rentable_resources + resource-lock; e2e 6/6) · caução/multa/checkout HOLD
booking-confirm locks PROVADO (provider+resource advisory-lock, 409; double-spend pré-money fechado)
```

## 3. MATRIZ CONSOLIDADA ÚNICA
Origem: **A**=autoridade · **B**=semântica · **C**=cofre · **OVL**=overlap. Classe = mais restritiva.

| # | item / fluxo | orig | SSOT | estado | classe | C1? | 3P? | RLS-fís? | P1? | próxima ação |
|--|--|--|--|--|--|--|--|--|--|--|
|1|bank_ledger SSOT + append-only|C|bank_ledger|LIVE|**PROVA**|n|—|—|—|manter|
|2|bank_splits append-only|C|bank_splits|OPS-proven|**PROVA**|n|—|—|—|aplicar no dev (com RLS)|
|3|calculateSplits (engine)|OVL A·B·C|bank_splits|LIVE/HOLD|**PROVA+HOLD**|n|sim(earning)|—|—|resíduo float% event/p2p = DECISION-0048|
|4|actor_wallet × user_wallet|OVL A·C|bank_accounts|LIVE|**PROVA**|n|—|—|—|—|
|5|availableBalanceCents (projeção)|OVL A·C|(read-model)|LIVE|**PROVA**|n|—|—|—|—|
|6|payment_intents · intent_type→concept|OVL B·C·A|concepts/ledger|LIVE|**✅ FECHADO**|n|—|—|—|guard `audit-concept-coverage-financial` (`32c9b4b6`): ledger exige concept_id→resolver fail-closed→UUID seeded; 6 literais seeded+vivos; intent_type não vira concept; NP 2×|
|7|recovery máquina (debit/drain/finalize)|OVL A·C|bank_ledger|LIVE-máquina|**DECISÃO PEND.**|n|sim|—|—|HOLD; só executa com decisão|
|8|recovery **genesis** (criar obrigação)|OVL A·C|—|GHOST(prod)|**GATE**|n|sim|—|—|wiring resolver→INSERT antes de exercer|
|9|payout request/approve|OVL A·C|approval_*|LIVE-contido|**PROVA**|n|sim|—|—|—|
|10|payout **execute** + worker|OVL A·C|bank_ledger|HOLD(off)|**DECISÃO PEND.**|n|sim|sim|sim|só pós RLS-físico+PORTA-1|
|11|payout externo / actor_bank_destination|OVL A·C|—|GHOST/HOLD|**DECISÃO PEND.**|n|sim|sim|—|frente própria (rail)|
|12|fee bps unidade|OVL B·C|economic_policy_lines.bps|LIVE|**PROVA**|n|—|—|—|—|
|13|fee material / captura no ledger|OVL B·C|bank_ledger|INERTE|**DECISÃO PEND.**|n|sim|—|—|DECISION_FEE_MODEL + E2E 299¢|
|14|regional-fund-governance (exec)|C|bank_ledger|LIVE-gov|**DECISÃO PEND.**|n|sim|—|—|confirmar DECISION-0114 + flag|
|15|referral Model B intent|OVL A·B·C|user_referral_links|LIVE-intent|**PROVA**|n|—|—|—|Δbank=0 provado|
|16|referral earning material|OVL A·C|bank_splits/wallet|HOLD|**DECISÃO PEND.**|n|sim|sim|—|cascade actor→owner-user = financeiro|
|17|3 workers observabilidade|OVL A·C|—|HOLD(off)|**HOLD**|n|—|sim(tenant-loop)|—|tenant-loop pós-flip antes de ligar|
|18|PIX/webhook + payment-event-resolver|C|gateway_*/ledger|LIVE-ingest|**✅ FECHADO (G1)**|n|—|—|—|fechado junto com #35: dedup mapeado+provado; ghost SPRINT-85 DISCARD (D1)|
|19|**RLS-live física**|OVL A·C|62 RLS tables|OPS|**OPS / DECISÃO**|**sim**|sim|**sim**|—|ato OPS Clayton (runbook)|
|20|**PORTA-1**|OVL A·C|financial_approval_*|HOLD|**DECISÃO PEND.**|sim(payout)|sim|—|**sim**|decision pack pós RLS-físico|
|21|referral binding/codes/getActiveReferral (não-authority)|A|actor_referral_codes|LIVE|**PROVA**|n|—|—|—|confirmado todas superfícies|
|22|canRepresentActor (createService/payout/availability owner)|A|canRepresentActor|LIVE|**PROVA**|n|—|—|—|—|
|23|**BODY-01** /internal financeiro|A→disco|—|**CONTIDO 501**|**PROVA(contido)**|**n**|—|—|—|⚠ A=stale; já contido (P1)|
|24|ACTIONCTX-01 events-sprint76|A|canRepresentActor|LIVE|**✅ FECHADO**|n|—|—|—|drenado em `55814a59`: 3 writes bindam canRepresentActor(req.user.userId, actionContext.actorId)+403; conflação actorId↔userId corrigida; guard audit-events-sprint76-actor-authority (NP 2×)|
|25|TENANT-01 services availability|A|canRepresentActor|stale-confirmado|**✅ STALE**|n|—|—|—|services já bound (service-order/bundle); único resíduo = confirm-financial-terms (FINANCEIRO atrás de 503, DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF → frente financeira)|
|26|canRepresentActor ramo-4 legado (AUTH-02)|A|—|LIVE|**GATE**|n|—|—|—|cleanup já deferido 0144 §B|
|27|actor_has_permission stub (FASE 6)|A|—|HOLD|**HOLD**|n|—|—|—|religar = ato soberano (0113)|
|28|concept_id ledger fail-closed|B|concepts|LIVE|**PROVA**|n|—|—|—|—|
|29|service/offering/discovery por concept|B|canonical_services.concept_id|LIVE|**PROVA**|n|—|—|—|—|
|30|category↔concept (70 órfãs nav-only)|B|concepts|LIVE|**PROVA**|n|—|—|—|guard anti-categoria ativo|
|31|booking-confirm locks (provider+resource)|seam A∩C|unified_availability|LIVE|**PROVA**|n|—|—|—|double-spend pré-money fechado (e2e 6/6)|
|32|rental pré-money (rentable_resources)|B→disco|rentable_resources|LIVE|**PROVA**|n|—|—|—|⚠ B=stale; existe+aplicada|
|33|tx↔ledger atomicidade (FK nullable)|C|bank_transactions|LIVE|**GATE**|n|sim|—|—|constraint de pareamento + reconciliação|
|34|cross-tenant tenant-loop (0149)|seam|tenants registry|OPS|**OPS**|n|—|sim|—|surface pós-flip, ≠ worker-off|
|35|idempotência/outbox/event_log|seam|event_log|LIVE|**✅ FECHADO (G1)**|n|—|—|—|F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1: dedup por (tenant,reference_type,reference_id) — advisory lock + SELECT FOR UPDATE + 23505 idempotente (transfer); ingestão ON CONFLICT(provider,reference_id); guard `audit-webhook-resolver-idempotency` (NP 3×); E2E contido 3/3 (Δbank=0); D1 ghost SPRINT-85 DISCARD. **Ressalva (Clayton):** FECHADO COMO PROVA CONTIDA / SEM BANK WRITE — resolver→transfer provado por leitura estrutural + guard, não por execução runtime insert+rollback. **Requisito diferido** (quando Camada 1 material abrir): E2E efêmero de replay do transfer (1ª cria efeito em DB efêmero · 2ª idempotente · zero 2ª bank_transaction/ledger · rollback). NÃO é para agora.|

**DESCARTE (ghost/dead/tombstone — não reviver sem decisão):** settlement core/region (proxy-dead) · event_settlements (GHOST status-only) · seller_payout/seller_available legado (tombstone, 403-prod) · marketplace/referral_codes (archive 0073) · AP/AR (proxy+403) · rides_referral_earnings (sem concept, legado) · concepts treasury/reversal/seller-funds seeded-sem-uso · channel_commission · actor_capability_grants (dormant) · external-payment-provider.mock · fee_rate_bps coluna (inexistente) · regional_fees archive (NUMERIC).
**REVIVAL_REQUIRED:** regional fund (flag `USE_BANK_REGIONAL_FUND`) · settlement/event_settlements · qualquer item DESCARTE se reaberto.

## 4. BACKLOG ORDENADO
- **A. PROVAS JÁ SUFICIENTES (não tocar):** ledger/splits append-only · concept_id ledger · fee bps unidade · service/offering/discovery · referral Model B intent · rental+booking-confirm locks · wallet separation · availableBalance projeção · payout request/approve · canRepresentActor core · BODY-01 contido.
- **B. GATES NECESSÁRIOS (decisão-independentes, eixo técnico):** (1) intent_type/order→concept coverage guard; (2) tx↔ledger constraint de pareamento; (3) recovery genesis wiring; (4) ACTIONCTX-01 + TENANT-01 authority binding + guard; (5) idempotência/outbox replay proof; (6) AUTH-02 cleanup ramo-4.
- **C. DECISÕES CLAYTON:** régua de autoridade pré-reabertura dos firewalls financeiros (MONEY-AUTH-01) · régua de ativação PF (KYB/trust) · DECISION_FEE_MODEL (captura) · DECISION regional-fund (0114/flag) · PORTA-1 pack.
- **D. EXIGE 3 PARALELAS + DECISÃO CLAYTON:** recovery execução · payout execute/worker/externo · referral earning material · fee captura · regional-fund execução · calculateSplits material · reabertura firewall checkout/serviço.
- **E. OPS / RLS-LIVE:** virada física RLS (#19) — **o gargalo** · aplicar bank_splits no dev sob RLS · tenant-loop pós-flip (#34).
- **F. DESCARTES:** lista acima.
- **G. REVIVAL_REQUIRED:** regional fund · settlement/event_settlements · qualquer ghost reaberto.

## 5. CONFLITOS ENTRE PARALELAS + RESOLUÇÃO
```
BODY-01: A=blocker crítico vivo  vs  disco=501 CONTIDO  → resolvido por 1ª mão: CONTIDO (A stale). Não-blocker.
recovery: A=PROVA(gated) vs C=DECISÃO PENDENTE → mais restritiva: DECISÃO PENDENTE.
payment_intent: A=PROVA C=PROVA vs B=GATE(concept) → mais restritiva: GATE.
event_settlements: B=GHOST/DESCARTE vs C=PROVA(non-money) → DOC_ONLY/GHOST c/ caveat revival (risco SETTLED sem lastro).
fee: B/C=PROVA(unidade) vs C=DECISÃO(captura) → split em 2 linhas (#12 PROVA, #13 DECISÃO).
referral: A(autoridade)+B(semântica)+C(earning) → OVERLAP, 1 item intent (PROVA) + 1 earning (DECISÃO), não somados.
```

## 6. ITENS STALE DETECTADOS
```
A · BODY-01 ............. handlers 501 não vistos (contidos no HEAD) — refutado de 1ª mão
A · TENANT-01 .......... path services.service.ts inexistente → re-localizar antes de agir
B · rental_resource .... "AUSENTE" — na verdade rentable_resources existe+aplicada (mig 20260624120000)
A/B · hashes citados ... ambas reconheceram hashes antigos; HEAD real = cbad2906 (corrigido)
```

## 7. ITENS QUE **NÃO** VÃO PARA EXECUTORA (agora)
RLS-live física (OPS Clayton) · PORTA-1 (decisão) · payout execute/worker/externo · recovery execução · fee captura · regional-fund execução · referral earning material · reabertura de firewalls · religar FASE 6/ramo-4 · qualquer DESCARTE/REVIVAL. **Nenhum achado financeiro vira fix direto.**

## 8. PRÓXIMOS PROMPTS POSSÍVEIS (sem execução financeira)
```
Decisão-independentes (eixo técnico, podem ir antes do dinheiro, MODO B + guard + E2E):
  • intent_type/order→concept coverage guard (#6)        • tx↔ledger constraint (#33)
  • ACTIONCTX-01 + TENANT-01 binding + guard (#24/#25)    • idempotência/outbox proof (#35)
  • recovery genesis wiring (#8) — toca substrato fin. → 3 paralelas mesmo sendo "wiring"
Dependentes (só pós RLS-físico + decisão Clayton + 3 paralelas):
  • tudo no bucket D.
OPS:
  • RLS-live física (#19) — o gargalo estrutural.
```

## COSTURAS (classificadas)
1. **Booking-confirm locks** — A∩C, **PROVA**, double-spend pré-money fechado (provider+resource advisory-lock+409; e2e 6/6).
2. **Cross-tenant tenant-loop (0149)** — **OPS**, surface pós-flip distinta de worker-off; exige RLS-físico.
3. **Idempotência/outbox/event_log** — **✅ FECHADO (G1, 2026-06-24)**, replay/dedup mapeado+provado em webhook→resolver→bank (dedup por reference; ingestão ON CONFLICT; guard+NP3×+E2E 3/3 Δbank=0). Ghost SPRINT-85 (`/webhooks/pix/:provider`+`pix_webhook_events`) **DISCARD (D1)**; canônico `/gateway/pix/webhook` vivo. Outbox transacional (event_outbox/event_log/handler_failures) já era PROVA-por-construção (read-first #35).
4. **Referral** — intent **PROVA**; earning material **HOLD+3P**.
5. **Fee** — bps vivo **PROVA**; captura/settlement/regional = revival/decisão própria.
6. **Recovery** — máquina **PROVA**; reversal-pós-D-money proibido por design (mantém); genesis **GATE**.
7. **Payout** — request/approve **PROVA**; execute/worker/externo/PORTA-1/TOCTOU **HOLD+3P+RLS-físico**.
8. **Wallets** — actor/user separados, availableBalance projeção, ledger SSOT — **PROVA**.
9. **settlement/release workers (35p)** — **✅ CLOSED / DEFAULT-OFF CONTAINED / RLS PREFLIGHT PASS** (F-RLS-PREFLIGHT-SETTLEMENT-RELEASE-WORKER-DEFAULT-OFF, 2026-06-24). `settlement-worker` (BOOT:216) e `release-worker` (BOOT:225) eram **default-ON e UNGATED**; agora **gateados default-OFF** via `isFinancialWorkerEnabled('ENABLE_SETTLEMENT_WORKER')` / `('ENABLE_RELEASE_WORKER')` (mesmo helper estrito `=== 'true'` de payout/reversal/bank-settlement). Guard `audit-financial-workers-dormancy` estendido (WORKERS += settlement/release; NP 3×). Achado-base (live-DB 2026-06-24): `payment_intents` **RLS enabled=false/forced=false** → o flip RLS-físico NÃO os tornava inertes; inércia anterior = tabela vazia (firewall checkout), não estrutural. **Agora contido estruturalmente** (não dependem mais de tabela vazia). **RESÍDUO (HOLD / REVIVAL_REQUIRED / #34):** o claim cross-tenant de `payment_intents` ANTES do `set_config('app.current_tenant')` permanece — quando os workers forem RELIGADOS no futuro, exige a correção de tenant-loop (#34 / DECISION-0149) + RLS em payment_intents. **NÃO prontos para execução material.** NÃO corrigido nesta fatia (só dormência).

**10. worker-dormancy SWEEP (preflight RLS)** — **✅ CLOSED / DEFAULT-OFF CONTAINED / RLS PREFLIGHT PASS** (F-RLS-PREFLIGHT-WORKER-DORMANCY-SWEEP, 2026-06-24). Varredura exaustiva de escrita de dinheiro em TODOS os workers: só **governance-funding-commitment** restava **default-ON escrevendo bank_ledger** (transfer treasury→escrow, claim cross-tenant) → agora **default-OFF** (`ENABLE_GOVERNANCE_FUNDING_COMMITMENT_WORKER`). **Observabilidade/SLA financeira** (alert/metrics/risk/sla) — default-ON lendo financeiro cross-tenant, runbook §1.7 era inefetivo (BOOT não lia as flags) — agora **default-OFF** (DECISION-0149). Guard `audit-financial-workers-dormancy` estendido (NP 4×). Demais default-ON classificados e mantidos (pré-money/orquestração/infra/outbox — não escrevem ledger). Resíduo claim cross-tenant → **HOLD/REVIVAL_REQUIRED/#34**. **Nenhum money-writer default-ON resta** → preflight de workers PASSA. Não toca tenant-loop/dinheiro/migração.

---

**LEMBRETE:** DINHEIRO FORA · RLS provado, não virado · PORTA-1 HOLD · payout HOLD · esta matriz é **mapa, não execução**.
**Próximo recomendado:** OPS RLS-live física (#19) — o gargalo. GATES decisão-independentes fechados: #6 concept-coverage · #24/#25 ACTIONCTX/TENANT · **#35/#18 idempotência/outbox (G1)**. Restam no eixo técnico: #33 tx↔ledger constraint (encosta em cofre/schema — avaliar) · #8 recovery genesis (toca substrato financeiro → 3 paralelas). NÃO abrir bucket D sem RLS-físico + decisão Clayton.

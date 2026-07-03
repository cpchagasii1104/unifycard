# AUDITORIA — RAIO X FORENSE INSTITUCIONAL DO UNIFICARD

**Data da entrega:** 2026-07-02
**HEAD âncora:** `a9c301a56` (`docs(availability): close DT-AVAILABILITY-CONFLICT-DETECTION-STUB`, 2026-07-02 17:07 -0300 — re-confirmado via `git rev-parse HEAD` no momento da entrega)
**Branch:** `rescue-structural` · **Working tree:** 79 arquivos modificados/untracked
**Modo:** READ-ONLY absoluto — nenhum arquivo alterado, nenhuma escrita no banco, nenhum commit. Único artefato criado: este documento.
**Método:** 6 frentes de auditoria paralelas e independentes (backend/autoridade, banco/migrations, frontend/gaps, docs vs código, testes/gates, fluxo ponta-a-ponta), com cruzamento obrigatório documentação↔schema↔backend↔frontend↔rotas↔DTOs↔testes↔fluxo↔dependências, mais re-medição direta dos números concretos no momento da entrega.

**Limitação declarada:** conexão viva ao banco `unificard_dev` **BLOCKED** — `backend/.env:5` tem a senha redigida (`21estePDZ...`) e `psql` falha autenticação. Toda asserção sobre schema/RLS/dados é evidência **estática** (migrations + código). Onde isso reduz certeza, o item está marcado INCONCLUSIVE ou com confiança rebaixada.

**Contexto temporal crítico:** o sistema mudou embaixo da auditoria — **11 dívidas técnicas foram fechadas em 2026-07-02** (a própria data da coleta), pela sessão executora paralela. Os 9 HEADs materiais alegados no `REMEDIATION_DT_LOG.md` (`e19cdfe98`, `d009310d0`, `511330bdf`, `f42d2692c`, `8ec503581`, `ab3e6a85f`, `88c009bdd`, `6bbfde728`, `b053a474d`) foram **confirmados um a um no git** com mensagens idênticas. Nenhuma frente fechada hoje é reportada aqui como achado novo.

---

## 0. NOTA DE ATUALIZAÇÃO PÓS-LAUDO (2026-07-02/03) — LER ANTES DO RESTO DO DOCUMENTO

> O corpo deste laudo (seções 1–9, abaixo) é o **artefato original**, congelado como foi entregue — não foi reescrito. Esta nota resume o que aconteceu **depois** da entrega: a campanha de remediação que respondeu aos 9 blockers (B1–B9), com re-auditoria independente em 3 rodadas + 1 auto-auditoria. Fonte completa e rastreável: `REMEDIATION_DECISIONS_LOG.md` (DECISION-0157, DECISION-0158) + `REMEDIATION_DT_LOG.md` (DTs fechadas com commit+prova) + `STATUS_EXECUCAO_GLOBAL.md` (cartório cronológico).

### O que foi feito (9 blockers do laudo → estado atual)

| Blocker | Veredito do laudo | Estado após a remediação |
|---|---|---|
| **B1** — rides sem firewall | FAIL | ✅ **FECHADO** — firewall de runtime gate-duplo (sink+caller), default-off |
| **B2** — `event_settlements` ghost | FAIL | ✅ **CONTIDO** — 3 superfícies fail-closed; materializar a tabela = decisão de PORTA-1 |
| **B3** — RLS ausente (2 tabelas) | FAIL | ✅ **FECHADO E AMPLIADO** — 23/25 tabelas financeiras com RLS+FORCE (as 2 do laudo + 15 do Grupo A + 6 do Grupo B/tenant-loop, DECISION-0149); GUC de contexto-tenant corrigido (2 bugs de segundo grau achados pela re-auditoria) |
| **B4** — 3 gates vermelhos | FAIL | ✅ **FECHADO** — typecheck do gate **35→0** (drenado de verdade, não só baseline); `financial-vocabulary`/`financial-ssot` com **baseline formal ratificado + guard-catraca** (DECISION-0158): número só pode descer, violação nova derruba o pipeline |
| **B5** — 404 CRM / My-Orders | FAIL | ✅ **FECHADO** — prefixo de rota corrigido nos 2 clientes |
| **B6** — `actor_type` fragmentado | FAIL | ✅ **CONTIDO** — vocabulário canônico ratificado (DECISION-0157/D-C2) + guard de freeze (nenhum writer legado novo em produção/seed); **drenagem dos 10 valores legados existentes é frente futura**, não fechada |
| **B7** — tríade de identidade + FK trocada | FAIL | 📋 **DOCUMENTADO, NÃO EXECUTADO** — único item que o laudo original marca "Dinheiro SIM" (KYC/payout dependem de identidade unívoca) ainda sem correção material. Execução (DECISION-0062 F4/F5 + renomear a FK que mente) exige GO explícito + revisão adversarial — não foi feita sem confirmação por tocar o substrato de identidade, o mais sensível do projeto. **Não bloqueia começar a pensar em PORTA-1**; é dependência a sequenciar dentro do próprio decision pack (relevante especificamente para os fluxos de KYC/payout, não para a conversa de decisão em si). |
| **B8** — split engine stub | — | ⛔ **Intocado de propósito** — É a própria PORTA-1 |
| **B9** — payout sem execução/rail externo | — | ⛔ **Intocado de propósito** — É a própria PORTA-1 |

**Disciplina aplicada:** cada fechamento teve commit material separado de commit de cartório (docs), negative-proof (guard testado em estado de falha antes de confirmar sucesso), e DECISION formal quando a escolha era arquitetural (DECISION-0157 para B6, DECISION-0158 para B4). 3 rodadas de re-auditoria independente (Fable 5 separado) + 1 auto-auditoria acharam e corrigiram 4 bugs introduzidos pelas próprias correções (vazamento de autoridade cross-tenant, degradação de auditoria financeira, fixture fora do freeze, resíduos de baixo risco) — severidade decrescente a cada rodada, nenhum resíduo classificado acima de LOW na auto-auditoria final.

### O que ficou faltando

1. **B7 — execução da tríade de identidade** (única pendência "Dinheiro SIM" não fechada). Requer GO + revisão adversarial na renomeação da FK.
2. **Drenagem real das ~4.4 mil violações financeiras** (`financial-vocabulary` + `financial-ssot`) — hoje contidas sob teto (DECISION-0158), não eliminadas.
3. **Drenagem dos 10 valores legados de `actor_type`** já existentes em produção — o freeze (DECISION-0157) impede crescer, não encolhe o que já existe.
4. Itens de higiene do laudo nunca classificados como blocker: 4 rotas de borda de autoridade a confirmar, ~40 componentes/páginas órfãs no frontend, `MarketplaceSegmentPage` com mock em rota pública, prefixo `/api/events` triplicado, DECISIONs 0154–0157 sem arquivo em `02_decisions/`, cobertura de teste frontend quase zero.

### O que NÃO ficou faltando (marco fechado)

**Todos os pré-requisitos técnicos de PORTA-1 que o laudo listou em §2 (B1–B5) estão fechados ou contidos.** B6 está contido (não bloqueava dinheiro diretamente). B7 é a única dependência "Dinheiro SIM" que segue aberta, mas não trava o início da conversa de decisão — trava a execução de KYC/payout dentro dela. B8/B9 nunca foram para serem tocados agora: são a própria PORTA-1, aguardando o decision pack soberano com a IA-DINHEIRO.

---

## 1. VEREDITO

# **FECHA_COM_RISCO**

**O sistema fecha ponta-a-ponta na jornada pré-dinheiro** (cadastro → auth → actor → authority → empresa → serviço → oferta → discovery → agenda → booking), com autoridade server-side real (DECISION-0113 honrada no núcleo), fail-closed disciplinado e prova por E2E/guards. **O dinheiro está deliberadamente contido** (workers default-off fail-closed, payout sem entrypoint HTTP de execução, split stub) — isso é design ratificado (HOLD/PORTA-1), não defeito.

**Os riscos que impedem um FECHA pleno:**
1. Trilho **rides** toca `bank_ledger` sem firewall de runtime (única exceção ao padrão dos demais trilhos; mitigado por guard anti-revival, dívida PRE-PORTA1 reconhecida).
2. **`event_settlements`**: código escreve numa tabela sem migration viva (ghost mascarado pelo firewall desligado).
3. **RLS ausente** em `payment_intents` e `governance_funding_commitments` (+ correlatas prováveis).
4. **3 gates vermelhos vivos** no momento da entrega: typecheck (35 erros strict-off / 47 strict-on), `financial-vocabulary` FAIL (3.814 violações), `financial-ssot` FAIL (577 violações).
5. **2 quebras de contrato frontend→backend** em rotas de UI vivas (CRM e My-Orders → 404 por prefixo).
6. Fragmentação estrutural de identidade (`actor_type` com 3+ vocabulários; tríade `user_id`/`global_user_id`/`actor_id`; FK trocada em `event_reservations`).

## 2. RECOMENDAÇÃO

# **DECISION**

A próxima fronteira material é **PORTA-1 (abertura do dinheiro)** — decisão soberana de Clayton com decision pack (IA-DINHEIRO), **não** frente executora autônoma. Pré-condições técnicas que o decision pack deve endereçar antes de qualquer GO: firewall de rides, migration/decisão sobre `event_settlements`, RLS nas duas tabelas financeiras nuas, zeragem (ou baseline formal) dos 3 gates vermelhos, e rail bancário externo (hoje inexistente — payout liquida em settlement account interna). Paralelamente, os 2 FAILs de contrato frontend são correções de 1 linha cada (fora do escopo desta auditoria) e não exigem DECISION.

---

## 3. MAPA DE FLUXO REAL

```
Cadastro ────────── VIVO   POST /auth/register — nascimento atômico em 1 transação
   ↓                       (global_users → dedup CPF fail-closed → users → profiles →
   ↓                       identity ANTES do actor → ensureUserActorTx) auth.service.ts:293-382
Auth (JWT) ──────── VIVO   JWT_SECRET obrigatório (auth.service.ts:44); arquivo marcado
   ↓                       "LEGADO PRÉ-GATE-0 CONGELADO" porém operante
Actor ───────────── VIVO   writer soberano único actor-writer.service.ts:30-37
   ↓
Authority ───────── VIVO   canRepresentActor fail-closed em 195 arquivos; actorId de
   ↓                       cliente = HINT (action-context.middleware.ts:27-36)
Empresa/KYB ─────── PARCIAL  nasce DRAFT sem gate KYB (companies.service.ts:387);
   ↓                       KYB deslocado para a ativação de oferta
Service ─────────── VIVO   discovery casa por concept_id (services-discovery.service.ts:385)
   ↓
Offering ────────── VIVO-GATED  ativação fail-closed: PJ exige KYB approved, PF exige
   ↓                       civil-minimum (services-offering-activation-gate.ts:67-101)
Marketplace ─────── PARCIAL  busca funciona, ordenação = ORDER BY created_at ASC puro
   ↓                       (services.repository.ts:257) — FIFO sem ranking (HOLD ratificado)
Availability ────── VIVO   gate de finalidade + autoridade revalidada no core
   ↓                       (unified-availability.service.ts:187-212)
Booking ─────────── VIVO   SERVICE_BOOKING_REQUESTED emitido no create canônico via
   ↓                       event_outbox, idempotente (unified-availability.service.ts:233-280)
Ledger ──────────── VIVO como substrato  bank_ledger append-only, tocado só pelo
   ↓                       executor selado (actor-wallet-payout.service.ts:702-718)
Split ━━━━━━━━━━━━ ✂ STUB — PRIMEIRO ELO NÃO-VIVO
   ↓                       distribution.service.ts:23-80: cálculo puro em memória, fees
   ↓                       hardcoded 2.5/1.0/0.5%, getFeeConfig = TODO, nada persiste
Payout request ──── CONTIDO  cria pending_approval, NUNCA executa (payout-request.routes.ts:81)
   ↓
Payout approve ──── CONTIDO  4-olhos requester≠approver fail-closed
   ↓                       (payout-decision.routes.ts:91-95); aprovar NÃO executa
Payout execute ━━━ ⛔ BARREIRA DURA DO DINHEIRO
                           (a) sem entrypoint HTTP (execution-seal); só worker system-only
                           (b) worker DEFAULT-OFF (actor-wallet-payout-worker.ts:90-92,
                               ENABLE_PAYOUT_WORKER !== 'true' → não consome fila)
                           (c) mesmo ligado: transfer move p/ settlement account INTERNA —
                               NÃO existe egress para rail bancário externo (PIX/banco real)
```

**Ponto exato de quebra:** o fluxo funcional quebra no **Split** (stub); o dinheiro real para em **três contenções em série** no payout execute. Tudo acima do Split fecha e está provado por E2E (`e2e-offer-journey-pre-money.ts` 9/9: "JORNADA FECHA").

---

## 4. MATRIZ FINAL

| Item | Status | Evidência | Blocker | Impacto | Próxima Frente | Modo |
|---|---|---|---|---|---|---|
| Register (nascimento atômico identity-before-actor) | PASS | `auth.service.ts:293-382` | — | Fundação PF sólida | — | — |
| Auth/JWT | PASS | `auth.service.ts:44`; arquivo "LEGADO CONGELADO" | — | Operante; rótulo legado | higiene futura | FAST-PATH |
| Actor writer soberano | PASS | `actor-writer.service.ts:18-37` | — | SSOT de actor respeitado | — | — |
| Authority binding (DECISION-0113) | PASS núcleo / PARTIAL borda | middleware `action-context.middleware.ts:27-36`; 407 ocorrências de binding; 4 rotas de borda a confirmar (`social-2.0`, `marketplace-categories`, `event.routes`, `marketplace-identity`) | — | Núcleo selado; borda auditável | varredura das 4 rotas | MODO B |
| Empresa (criação/lifecycle) | PARTIAL | `companies.service.ts:302,387` (nasce DRAFT, limite 3/CPF) | — | KYB deslocado p/ oferta (design) | — | — |
| KYB gate | PASS (na oferta) | `services-offering-activation-gate.ts:67-101` | — | PJ sem KYB não publica | — | — |
| Service/concepts (catálogo canônico) | PASS | `services-discovery.service.ts:385-390`; DECISION-0142/0144 | — | Vocabulário controlado real | expansão verticais (pack pronto, HOLD) | DECISION |
| Offering + ativação | PASS | `service-offering.service.ts:201` | — | Fail-closed provado | — | — |
| Discovery/busca | PARTIAL | `services.repository.ts:257` (`created_at ASC` FIFO) | — | Privilégio de incumbente em escala | F-SERVICE-RANKING (design ratificado, HOLD) | HOLD |
| Availability/agenda | PASS | `unified-availability.service.ts:187-212` | — | SSOT temporal consolidado | — | — |
| Booking + effect | PASS | `unified-availability.service.ts:233-280` (commit `24a2ffbc9`) | — | Outbox idempotente | — | — |
| Ledger (bank_ledger) | PASS substrato | RLS+FORCE (`20260516100000_rls_critical_tables.sql:25-74`); executor selado único | — | Verdade financeira única | — | — |
| **Split/distribution** | **STUB** | `distribution.service.ts:23-80` fees hardcoded, `getFeeConfig` TODO | **B8** | Sem split real não há PORTA-1 | decision pack PORTA-1 | DECISION |
| Payout request→approve | PASS (contido) | `payout-request.routes.ts:40-81`; `payout-decision.routes.ts:91-130` | — | Fail-closed, 4-olhos | — | — |
| **Payout execute** | **BLOCKED (por design)** | `actor-wallet-payout-worker.ts:88-93` + `financial-worker-gate.ts:17,38-41` | **B9** | Dinheiro não sai (intencional) | PORTA-1 | DECISION |
| Rail bancário externo | **AUSENTE** | `actor-wallet-payout.service.ts:707` (settlement interna); `payout.service.ts:330` "mock" | **B9** | Dinheiro nunca chega fora | PORTA-1 | DECISION |
| **Rides money (processRidePayment)** | **FAIL (gap de padrão)** | `bank-integration.service.ts:912`; grep firewall em `modules/rides` = 0; guard `audit-rides-money-antirevival-guard.mjs` mitiga | **B1** | Único trilho sem kill-switch | F-RIDES-FINANCIAL-FIREWALL-* | DECISION |
| **event_settlements ghost** | **FAIL** | `event-settlement.repository.ts:64,104` escreve; CREATE só em `migrations_archive/0215` | **B2** | Quebra se firewall ligar | migration ou aposentadoria formal | DECISION |
| **RLS payment_intents / governance_funding_commitments** | **FAIL** | `0030_payment_intents.sql` / `0048_...sql` sem nenhuma linha RLS; grep ENABLE/FORCE não as lista | **B3** | Defesa-em-profundidade furada | F-RLS residual (DECISION-0149 tenant-loop) | DECISION |
| RLS demais financeiras | PASS | `20260516100000` + `20260620120000_db_role_rls_hardening.sql:69-166` | — | bank_* isolado | — | — |
| RLS-live runtime | PASS (histórico verificado) | virada 2026-06-24, `unificard_app` NOSUPERUSER; catálogo RLS `20260702130000` | — | — | — | — |
| **Typecheck** | **FAIL** | re-medido na entrega: **35 erros** (`tsc -p tsconfig.build.json`, strict OFF) / **47 erros** (`npx tsc --noEmit`, strict ON); "25" = fotografia 2026-06-17 (`output_7.txt`), superada | **B4** | Gate vermelho tolerado | zerar ou baseline formal | MODO B |
| **financial-vocabulary** | **FAIL** | re-rodado na entrega: EXIT=1, **3.814 violações** fora de `src/core/bank` | **B4** | Vocabulário financeiro vazando do domínio | baseline + drenagem | MODO B |
| **financial-ssot** | **FAIL** | re-rodado na entrega: EXIT=1, **577 violações** (240 FINANCIAL_REPOSITORY, 65 PROHIBITED_STRUCTURE_NAME) | **B4** | Persistência financeira fora do Bank | drenagem pré-PORTA-1 | DECISION |
| Regression guards | PASS | 143 passos verdes (`gate3_output.txt`, re-runs); 3 guards críticos lidos linha a linha e mordem | — | Anti-revival real | — | — |
| Guards fora da cadeia | PARTIAL | 165 `audit-*.mjs` existem, 140 na cadeia; 25 fora (maioria one-off) | — | Proteção não-contínua p/ alguns | religar os que valem | FAST-PATH |
| E2E jornada de serviço | PASS | `e2e-offer-journey-pre-money.ts` 9/9; yala_* 10 arquivos todos verdes (15/15, 25/25, 21/21, 22/22, 23/23, 20/20…) | — | Jornada provada | — | — |
| Testes skipados | STALE | 11 skips; `split-engine.test.ts:18` + `financial-hardening.test.ts:210,356` "DEPRECADO aguardando migração p/ split.service" que nunca ocorreu | — | Cobertura dormente no split | fatia própria | MODO B |
| Testes frontend | PARTIAL | 2 arquivos de teste vs 581 fontes | — | Quase zero cobertura FE | — | MODO B |
| **Contrato CRM frontend** | **FAIL** | `api/crm.ts` bate `/crm/*`; backend vive em `/marketplace/crm/*` (`marketplace.routes.ts:133`); rota UI viva `App.tsx:341` → **404** | **B5** | Timeline/notes/tags/consents quebrados | fix 1 linha | FAST-PATH |
| **Contrato My-Orders frontend** | **FAIL** | `api/my-orders.ts:92,100` bate `/my-orders`; backend em `/api/my-orders` (`my-orders.module.ts:8`); rotas UI vivas `App.tsx:318-319` → **404** | **B5** | Página viva quebrada | fix 1 linha | FAST-PATH |
| Lei "frontend nunca cria verdade" — storage | PASS | 92 call-sites, só 7 chaves (token/tenant/actor/UX); zero capability/saldo | — | Lei cumprida | — | — |
| — autorização local | PARTIAL | `GrupoDetailPage.tsx:169-193` `isOwnerOrAdmin` por fuzzy `.includes()` no cliente | — | Affordance decidido no cliente | trocar por API de permissões | FAST-PATH |
| — taxonomia hardcoded | PARTIAL | `EventNeedsWizard.tsx:35` (8 categorias); `DomainSelector.tsx:17` ×2 | — | Violação leve auto-admitida | drenar p/ backend | FAST-PATH |
| Navegação = projeção | PASS | `GlobalSidebar.tsx:4-7` ← `GET /navigation/modules` | — | — | — | — |
| Página pública com mock | FAIL leve | `MarketplaceSegmentPage.tsx:67-68` mock data em rota pública viva (`App.tsx:227`) | — | Dado falso ao público | fix pontual | FAST-PATH |
| Componentes órfãos FE | ORPHAN | ~40 componentes com 0 importadores (amostra verificada: NotificationBell, DatePicker, ActorSelector… = 0 usos) + 4 páginas órfãs | — | Peso morto | limpeza | FAST-PATH |
| Rotas FE frozen | STALE intencional | `App.tsx` comenta votes/subscriptions/loyalty/payouts/invoices/risk com justificativa (DT-MODULE-*-FANTASMA / DECISION-0041) | — | Honesto e documentado | — | — |
| Rotas backend mortas/ghost | STALE contido | webhook PIX ghost DISCARD (`app.builder.ts:203-207`, DECISION-0154 + guard); `category.routes` e `company-canonical.*` aposentados; `payout-worker.ts` TOMBSTONED | — | Anti-revival guardado | — | — |
| Duplicação de prefixo rotas | PARTIAL | 3 módulos em `/api/events` (`app.builder.ts:489-547`, 🔴 auto-admitido); unifybank em `/bank`+`/admin` | — | Risco FST_ERR_DUPLICATED_ROUTE | consolidação | MODO B |
| Discovery request-track 403 | PASS (CONTAINED intencional) | `service-discovery-request-track-retirement.ts:28-39` + E2E 8 rotas 403 (DECISION-0156, Lei 2 forward-only) | — | Não é bug | — | — |
| `getClientWithPlatformAdmin` | PASS c/ observação | `pool.ts:159-168`; rotas de curadoria todas atrás de `requireRole(['admin'])` (`catalog-governance.routes.ts:224-356`); helper NÃO verifica role (convenção-de-caller documentada) | — | Design ratificado; enforcement é da rota | — | — |
| Migrations (runner) | PASS | 417 vivas + 313 archive + 8 resetadas; fail-closed pending-final (`migrate.ts:418-429`); MIGRATION_STOP_BEFORE extraído p/ test-only | — | — | — | — |
| Auto-baseline do runner | PARTIAL | `migrate.ts:107-213` marca 001–088 executadas sem rodar SQL em banco populado | — | Pode mascarar divergência | verificação viva c/ credencial | MODO B |
| **actor_type fragmentado** | **FAIL (DT confirmada)** | CHECK final = 10 valores (`0064_add_user_id_to_actors.sql:15-28`) unindo 3 vocabulários; +2 paralelos (`economic_identities` 0013:14, `audit_events`); triggers ramificam pelos 3 (`20260510100000:28,38`) | **B6** | Identidade estrutural ambígua | DECISION D-C2 | DECISION |
| **Tríade de identidade** | **FAIL** | `users.user_id`+`users.global_user_id` (`0058:15,38`); `actors` com 3 chaves; **FK trocada**: `event_reservations.global_user_id REFERENCES actors(id)` (`20260530470000:41`) | **B7** | Mapper mental obrigatório; FK mente | F4/F5 da DECISION-0062 | DECISION |
| CPF/CNPJ SSOT (DECISION-0062) | PARTIAL | canonicidade aprovada, convergência incompleta; `DT-CPF-SSOT-DUAL-WRITE` OPEN; backfill iniciado | — | Dual-write vivo | continuar drenagem | MODO B |
| Metadata JSONB blobs | PARTIAL | 85 colunas `metadata JSONB` em migrations vivas; `companies.metadata` era GHOST (coluna nunca existiu — fechado hoje `511330bdf`) | — | Risco de verdade paralela | vigilância contínua | MODO B |
| Saldo fora do ledger | PARTIAL | `social_impact.balance NUMERIC(12,4)` (`20260530340000:24`) | — | Violação pontual da regra de ouro | avaliar (não-bank) | MODO B |
| Nomenclatura TIMESTAMPTZ | PASS | 0 `TIMESTAMP` sem tz nas migrations vivas | — | — | — | — |
| Nomenclatura amount_cents | PARTIAL | violações legadas em remediação ativa (`0112:14`, `0122:11` NUMERIC); resíduo vivo `social_impact.balance` | — | Trilha de remediação existe | — | — |
| DECISIONs 0154–0156 sem arquivo | PARTIAL | vivem só no `REMEDIATION_DECISIONS_LOG.md` (:7466, :7502), sem arquivo em `02_decisions/` | — | Rastreável mas fora do lugar canônico | criar arquivos | FAST-PATH |
| Fantasmas documentais | ORPHAN | `economic_regions` (0 CREATE TABLE, só comentários de plano `…516000:18`); `subscription` (HOLD por DECISION-0152, sem tabela) | — | Documentado sem implementação (por design) | — | HOLD |
| Drift documental na raiz | LEGACY | cluster 0131 = rascunhos pré-promulgação superados por `DECISION_0131_AUTHORITY_GRAMMAR.md`; `dividas.md` §0 auto-declarado STALE; `opus.md` 815 KB privado; `backend/.ts` 0 bytes; dezenas de `*_output.txt` untracked | — | Ruído institucional | arquivar/limpar | FAST-PATH |
| DTs (registro) | PASS | `REMEDIATION_DT_LOG.md` 2 MB append-only: 139 CLOSED / 61 OPEN / 10 PARTIAL / 4 MITIGATED (579 IDs); CLOSED citam commit+Yala+Δbank=0 | — | Disciplina de cartório real | — | — |
| Dívida em código (busca obrigatória) | FAIL volume | backend: TODO **202**/114 arquivos, LEGACY/DEPRECATED/OBSOLETE **63**/42, fallback/compat/bridge/shim/experimental **251**/127, FIXME/HACK/XXX ≈ **0** reais; frontend: TODO 24, LEGACY 54, DEPRECATED 9, mock 3 | — | Alta mas majoritariamente anti-revival comentado | drenagem contínua | MODO B |

---

## 5. BLOCKERS

### B1 — Trilho rides toca dinheiro sem firewall de runtime
- **Descrição:** `processRidePayment` (split 3%/97% via bank_ledger) é chamado sincronamente em rotas registradas de rides, sem o kill-switch `*_FINANCIAL_RUNTIME_ENABLED` que todos os outros trilhos têm (services, checkout, PDV, event-settlement).
- **Evidência:** `bank-integration.service.ts:912`; callers vivos `lifecycle.routes.ts:534`, `rides.service.ts:249`; grep `FINANCIAL_RUNTIME_ENABLED|firewall` em `modules/rides` = 0 matches. Mitigação existente: `audit-rides-money-antirevival-guard.mjs` (na cadeia de regressão) congela o estado-morto.
- **Impacto:** se tráfego de rides existir, dinheiro se move sem gate de dormência. **Origem:** trilho rides é anterior ao padrão de firewalls (DECISION-0110/0128). **Dependências:** F-RIDES-FINANCIAL-FIREWALL-* (frente nomeada, nunca aberta). **Risco técnico:** médio. **Operacional:** baixo hoje (rotas financeiras de rides mortas + guard). **Arquitetural:** alto (exceção ao padrão). **Financeiro:** alto se reativado. **Segurança:** médio. **Bloqueia:** MVP não · MTP não · Piloto não · **Público SIM (se rides ativar)** · **Dinheiro SIM**. **Exige DECISION:** sim (já classificada MITIGATED_BY_GUARD/PRE-PORTA1). **Auditoria adversarial:** sim, antes de reativar rides.

### B2 — `event_settlements` escrita sem migration viva
- **Descrição:** o repository de settlement de eventos faz INSERT/UPDATE numa tabela cujo CREATE só existe no archive (não aplicado pelo runner produtivo).
- **Evidência:** `event-settlement.repository.ts:64,104`; único CREATE em `migrations_archive/0215_event_settlements.sql`; firewall `event-settlement-financial-firewall.ts:17` default-off mascara.
- **Impacto:** ligar o firewall quebra em runtime (tabela inexistente) — gap invisível até o pior momento. **Origem:** archive/reset de migrations sem reconciliar consumidores. **Dependências:** decisão organizer-billing SaaS-vs-split (OPEN desde 0113-baseline). **Riscos:** técnico alto, operacional baixo hoje, arquitetural médio, financeiro médio, segurança baixo. **Bloqueia:** MVP não · MTP não · Piloto não · Público não · **Dinheiro SIM (trilho eventos)**. **Exige DECISION:** sim. **Adversarial:** sim (confirmar contra DB vivo quando houver credencial). Confiança 85% (estático).

### B3 — RLS ausente em `payment_intents` e `governance_funding_commitments`
- **Descrição:** duas tabelas financeiras sem nenhuma linha de ROW LEVEL SECURITY em migration viva, num sistema onde RLS-live é a blindagem de isolamento por tenant.
- **Evidência:** `0030_payment_intents.sql` e `0048_governance_funding_commitments.sql` sem RLS; grep ENABLE/FORCE ROW LEVEL SECURITY não as lista. Correlatas prováveis sem RLS (70%): `payout_requests` (0031), `bank_settlements` (0032), `treasury_*` (0044/0045). Nota: `b2b_payment_intents` (distinta) TEM RLS.
- **Impacto:** isolamento por tenant furado nessas superfícies. **Origem:** já registrada como resíduo REVIVAL_REQUIRED/#34 do arco RLS-live. **Dependências:** DECISION-0149 (tenant-loop) para religar worker cross-tenant. **Riscos:** técnico médio, operacional baixo (workers off), arquitetural médio, financeiro alto, **segurança alto**. **Bloqueia:** MVP não · MTP não · Piloto não · **Público SIM** · **Dinheiro SIM**. **Exige DECISION:** sim. **Adversarial:** sim (verificação viva de `pg_class.relrowsecurity`).

### B4 — Três gates vermelhos vivos (typecheck + financial-vocabulary + financial-ssot)
- **Descrição:** no momento da entrega, o typecheck falha (**35 erros** no config do gate strict-off; **47** no config dev strict-on) e os dois validadores financeiros falham (**3.814** violações de vocabulário fora de `src/core/bank`; **577** de SSOT financeiro, sendo 240 FINANCIAL_REPOSITORY e 65 PROHIBITED_STRUCTURE_NAME). Os regression guards passam verdes ao mesmo tempo — ou seja, a suíte estrutural não enxerga esses vermelhos.
- **Evidência:** re-execução direta em 2026-07-02 (EXIT=1 nos três); histórico em `output_4.txt`/`output_5.txt`/`output_7.txt` (2026-06-17, quando eram 25 erros — número superado). `tsconfig.build.json:6` roda com `strict: false` e exclui testes do typecheck.
- **Impacto:** dívida vermelha convive com pipeline "verde" — ponto cego institucional. **Origem:** tolerância acumulada (padrão `req.tenant possibly null` e vocabulário legado espalhado). **Dependências:** nenhuma externa. **Riscos:** técnico médio, operacional médio, arquitetural médio, financeiro médio (vocabulário vazando é sintoma de SSOT financeiro difuso), segurança baixo. **Bloqueia:** MVP não · MTP não · Piloto não · Público **com risco** · **Dinheiro SIM** (financial-ssot RED já é blocker declarado de frente financeira: `DT-FINANCIAL-SSOT-RED-SERVICE-PAYMENT-EXECUTION-REPOSITORY` OPEN). **Exige DECISION:** parcial (baseline formal vs zeragem). **Adversarial:** não.

### B5 — Quebras de contrato frontend→backend em rotas vivas (CRM, My-Orders)
- **Descrição:** duas páginas com rota de UI viva batem endpoints com prefixo errado e recebem 404: `api/crm.ts` chama `/crm/*` (real: `/marketplace/crm/*`); `api/my-orders.ts` chama `/my-orders*` (real: `/api/my-orders*`).
- **Evidência:** `CrmContactDetailPage.tsx:23` + `App.tsx:341` vs `marketplace.routes.ts:133`; `my-orders.ts:92,100` + `App.tsx:318-319` vs `my-orders.module.ts:8`. Client sem proxy/rewrite (`client.ts` com API_BASE_URL absoluto) — o path do front é o path real.
- **Impacto:** funcionalidade visível quebrada para o usuário (timeline/notas/tags/consents de contato; página de pedidos). **Origem:** mismatch de prefixo em módulos montados por barril. **Dependências:** nenhuma. **Riscos:** técnico baixo, operacional médio (UX), arquitetural baixo, financeiro nulo, segurança nulo. **Bloqueia:** MVP **SIM (nas superfícies afetadas)** · MTP sim nas mesmas · Piloto sim se essas telas estiverem no roteiro · Público sim · Dinheiro não. **Exige DECISION:** não — correção de 1 linha cada. **Adversarial:** não.

### B6 — Fragmentação do vocabulário `actor_type`
- **Descrição:** o CHECK final de `actors.actor_type` aceita 10 valores — a união de 3 gerações de vocabulário (`person/company/system`, `actor_human/actor_organizational/actor_system`, `user/page/group/channel`) — e há 2 vocabulários paralelos em outras tabelas; triggers ramificam pelos 3 simultaneamente (prova de que estão vivos, não legados). `'channel'` está no CHECK com zero writers.
- **Evidência:** `0002_identity.sql:22`; `0012_unify_actor_and_kyc_ontology.sql:6-18`; `0064_add_user_id_to_actors.sql:15-28`; `0013_economic_identity.sql:14`; `20260510100000_actor_responsibility.sql:28,38`; decisão pendente D-C2 citada em `seed-dev-test-actors.ts:13`.
- **Impacto:** toda pergunta "que tipo de actor é?" tem 3 respostas possíveis — fragilidade transversal em queries, triggers e projeções. **Origem:** DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION (OPEN desde DECISION-0062 F3.1). **Dependências:** decisão ontológica D-C2. **Riscos:** técnico alto, operacional médio, **arquitetural alto**, financeiro baixo, segurança médio. **Bloqueia:** MVP não · MTP não · Piloto não · Público **com risco** · Dinheiro não diretamente. **Exige DECISION:** **SIM (D-C2)**. **Adversarial:** não.

### B7 — Tríade de identidade + FK trocada
- **Descrição:** um mesmo humano é endereçável por `users.user_id`, `users.global_user_id`, `actors.id`, `actors.user_id` e `actors.global_user_id`, sem mapper canônico único; e existe uma coluna chamada `global_user_id` que na verdade referencia `actors(id)`.
- **Evidência:** `0058_users_global_users_profiles_app.sql:15,38`; `0064:33-36`; **`20260530470000_fix_occupancy_schema.sql:41`** (`event_reservations.global_user_id UUID REFERENCES actors(id)`).
- **Impacto:** a FK mente sobre a semântica — qualquer join "óbvio" por nome está errado nessa tabela; a tríade impõe conhecimento tribal. **Origem:** DECISION-0062 (F4/F5 pendentes — migrar leitura CORE, deprecar caches); 94 atores legados com `global_user_id NULL`. **Dependências:** DECISION-0062 continuação. **Riscos:** técnico alto, operacional médio, arquitetural alto, financeiro médio (identidade é pré-condição de payout), segurança médio. **Bloqueia:** MVP não · MTP não · Piloto não · Público com risco · **Dinheiro SIM (KYC/payout dependem de identidade unívoca)**. **Exige DECISION:** já existe (0062) — exige **execução das fases restantes**. **Adversarial:** recomendável na renomeação da FK.

### B8 — Split engine é stub
- **Descrição:** a distribuição canônica de economia calcula fees em memória com percentuais hardcoded (2.5/1.0/0.5%), `getFeeConfig` é TODO e nada persiste; motores paralelos (`bank-split-engine.service.ts`, `payment-split.service.ts`) existem mas os settlements estão atrás de firewall default-off.
- **Evidência:** `core/economy/distribution/distribution.service.ts:9-13,23-48,68-80`.
- **Impacto:** zero=zero e repasse regional (tese central do produto) não têm motor executável. **Origem:** HOLD deliberado do dinheiro. **Dependências:** PORTA-1. **Riscos:** técnico baixo (é stub honesto), operacional nulo hoje, arquitetural médio, financeiro alto quando ligar, segurança baixo. **Bloqueia:** MVP não · MTP não · Piloto não · Público não · **Dinheiro SIM**. **Exige DECISION:** sim (PORTA-1 pack). **Adversarial:** sim, quando materializar.

### B9 — Payout sem execução e sem rail externo
- **Descrição:** a cadeia request→approve é fail-closed e selada, mas a execução (a) não tem entrypoint HTTP, (b) depende de worker default-off, e (c) mesmo ligada liquidaria numa settlement account **interna** do próprio ledger — não existe integração com trilho bancário real (PIX/banco); o caminho "manual" legado é mock declarado.
- **Evidência:** `actor-wallet-payout-worker.ts:88-93`; `financial-worker-gate.ts:38-41`; `actor-wallet-payout.service.ts:702-718`; `payout.service.ts:330-332` ("mock, sem integração bancária real"); `BOOT.ts:295-337`.
- **Impacto:** nenhum real sai do sistema — é a definição operacional do HOLD. **Origem:** DECISION-0128 / F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL (design, não defeito). **Dependências:** PORTA-1 + contratação/integração de rail. **Riscos:** todos baixos hoje; altos no GO. **Bloqueia:** MVP não · MTP não · Piloto não (pré-dinheiro) · Público não (pré-dinheiro) · **Dinheiro SIM — é o próprio gate**. **Exige DECISION:** **SIM — PORTA-1 é decisão soberana**. **Adversarial:** sim, obrigatória no GO.

---

## 6. ACHADOS POR CAMADA (síntese com classificação e confiança)

### 6.1 Backend (2.107 arquivos TS; 270 arquivos de rotas em ~60 módulos-barril)
- Autoridade: **PASS** núcleo / **PARTIAL** borda (85%) — middleware não infere autoridade; hint→prova em 77 arquivos/407 ocorrências; 61 ocorrências de `req.body.actorId`/`x-actor-id` são majoritariamente scripts de teste; 4 rotas reais de borda a confirmar individualmente.
- Contenção 501/403: **PASS** (90%) — ~13 pontos 501 deliberados (companies, transactions, distribution, reputação, recouple legado); rentals = STUB de navegação honesto; discovery request-track = 403 por DECISION-0156 (intencional).
- Entrypoint real: `app.builder.ts` (não `server.ts`); boot de workers em `backend/BOOT.ts` (raiz); `src/BOOT.ts` vazio e `server-TESTE.ts` = resíduo ORPHAN.
- Dinheiro: **PASS** HOLD estrutural (workers 12/12 default-off fail-closed, sem NODE_ENV, sem fail-open) / **FAIL** rides (B1).
- Dívida: **FAIL** em volume (202 TODO, 314 LEGACY/fallback/compat), **PASS** em higiene aguda (FIXME/HACK/XXX ≈ 0). Grande parte é anti-revival comentado deliberado.

### 6.2 Banco (417 migrations vivas, 313 archive, 8 "resetadas", 287 CREATE TABLE)
- Runner fail-closed **PASS** (90%); hook de truncamento extraído para test-only com E2E de isolamento; auto-baseline 001–088 é risco residual **PARTIAL**.
- `event_settlements` ghost **FAIL** (B2); `unified_availability` = divergência de nome código↔tabela (`availability`), **STALE-NAMING**, não gap; `actor_self_facts` não existe em lugar nenhum (nome de memória sem lastro — o laboratório é `C:\teste`, sistema separado).
- RLS: financeiro-core blindado **PASS**; `payment_intents`/`governance_funding_commitments` nuas **FAIL** (B3).
- Identidade: tríade + FK trocada **FAIL** (B7); `actor_type` 10 valores **FAIL** (B6); 85 colunas `metadata JSONB` **PARTIAL**; `social_impact.balance` fora do ledger **PARTIAL**.
- Nomenclatura: TIMESTAMPTZ **PASS** (0 violações); amount_cents **PARTIAL** (legado em remediação ativa).

### 6.3 Frontend (581 arquivos; ~110 páginas; router único em `App.tsx`)
- Leis: storage **PASS** (7 chaves, zero verdade material); navegação = projeção **PASS**; autorização local **PARTIAL** (1 caso fuzzy real); taxonomia hardcoded **PARTIAL** (2 componentes).
- Contratos: 18 clientes amostrados — 10 **PASS**, 2 **FAIL** materiais (B5), 5 **STALE** coerentes com rotas frozen, 1 **INCONCLUSIVE** (calendar).
- Fluxos vivos confirmados: jornada B2 discovery→oferta→booking **PASS** (95%); produtor `/services/new` cadeia canônica completa **PASS** (95%); `companyId` derivado server-side **PASS** (92%) — frontend não envia companyId.
- Código morto: ~40 componentes + 4 páginas **ORPHAN**; ~20 páginas frozen **STALE intencional** documentado.
- Pior débito vivo: `MarketplaceSegmentPage` pública servindo mock **FAIL leve**.

### 6.4 Documentação (1.735 arquivos .md; 98 arquivos DECISION 0064–0153; log-mestre 0001–0156)
- Cânone localizado e vigente (Constituição, Leis, Lei de Coerência, 07_NOMENCLATURA, AUTHORITY_LAW).
- DECISIONs amostradas: 0020 **PASS** (Location Core re-materializado), 0062 **PARTIAL** (convergência em curso), 0071 **PASS** (saúde 501 honesto; targeting não lê sensível), 0113 **PASS-vivo** (ver reconciliação §7), 0131 **PASS** (promulgada + ~20 selos WAVE1), 0144 **PARTIAL** (gate na ativação; busca não é eligibility-por-viewer), 0154 **PASS** (discard material + guard), 0156 **PASS** (ver §7).
- DTs: cartório com rastreabilidade material real (**PASS** 90%) — CLOSED citam commit+Yala+Δbank=0; estado líquido: 139 CLOSED / 61 OPEN / 10 PARTIAL / 4 MITIGATED.
- Fantasmas: `economic_regions` **ORPHAN** (85%), `subscription` **HOLD por DECISION-0152**; rental **deixou de ser fantasma** (substrato `20260624120000` + E2E).
- Drift: cluster de rascunhos na raiz **LEGACY** (nenhum é norma vigente; 0131 da raiz superado pela promulgada); DECISIONs 0154–0156 sem arquivo canônico **PARTIAL**; duplicação `docs/03_technical`↔`docs/06_technical` (resíduo reconhecido pela executora).

### 6.5 Testes e gates (55 Jest + 275 scripts E2E + 143 passos de guard)
- Guards críticos lidos linha a linha e mordem de verdade: rides-antirevival, webhook-idempotency, workers-dormancy — **PASS** (98%).
- Fotografia de execução 2026-06-17: gates estruturais verdes + 3 vermelhos (B4) — **PARTIAL**; vermelhos re-confirmados vivos em 2026-07-02.
- E2E: offer-journey 9/9; yala_* 10 suítes todas verdes; cadeia PJ ~48-56 scripts (rótulo "52/52" não localizado literalmente — INCONCLUSIVE quanto ao rótulo, cobertura confirmada).
- 11 testes skipados **STALE** (split/escrow dormentes); 25/165 guards fora da cadeia **PARTIAL**; frontend 2 testes **PARTIAL**.
- `backend/.ts` = 0 bytes, lixo acidental **ORPHAN** (99%).

---

## 7. RECONCILIAÇÕES (divergências entre fontes, resolvidas pela evidência mais forte)

1. **DECISION-0156**: a leitura "DOCUMENTADO_SEM_IMPLEMENTACAO / 7 drifts vivos" reflete o registro **da promulgação** (docs-only à época). A evidência mais forte e mais recente — topo do `REMEDIATION_DT_LOG.md` + 9 commits confirmados no git — mostra a cadeia **fechada materialmente até 2026-07-02** (inclusive `detect_availability_conflicts` materializado em `7903224c1` com cartório em `a9c301a56`). Estado vivo: **CLOSED**.
2. **DECISION-0113 "DT-mãe reaberta"**: essa leitura vem do `dividas.md` §0, que **se autodeclara STALE**. O estado vivo é o baseline-zero de 2026-06-19 (DT-mãe CLOSED_WITH_CONTAINED_RESIDUALS), com a higiene residual B1/B2/B3 da triagem fechada em 2026-07-02 (`8ec503581`, `f42d2692c`). Prevalece a evidência operacional.
3. **TENANT_ID_REQUIRED "na publicação de serviço"** (registro de memória): o único emissor real do literal é o **WebAuthn** (`webauthn.routes.ts:56,169,289`, header `x-tenant-id` ausente). A publicação de serviço não lança esse código. Registro de memória superado.
4. **"typecheck 25 erros"**: número da fotografia 2026-06-17. Vivo na entrega: **35** (config do gate) / **47** (config dev strict). O "tsc 25 pré-0113" da memória era outro contexto.
5. **Rotas discovery em 403 / `getClientWithPlatformAdmin`**: alegações da executora, verificadas por evidência direta — contenção intencional (Lei 2) e design ratificado com gate na rota, respectivamente. Não são achados de violação.
6. **Contagem de migrations**: 420 itens no diretório vs **417 `*.sql`** vivas (3 itens não-SQL). O número institucional é 417.

---

## 8. COBERTURA

| Dimensão | Cobertura | Base |
|---|---|---|
| Backend | ~85% | Entrypoint/builder/barris lidos; 270 rotas inventariadas; autoridade, dinheiro, stubs e dívida varridos; cross-check exaustivo rota-a-rota dos 60 barris não realizado |
| Frontend | ~80% | Router completo, 18 clientes de API cruzados com backend, leis verificadas, órfãos por amostragem com grep individual |
| Banco (estático) | ~90% | 417 migrations + archive + runner + RLS + vocabulários |
| Banco (vivo) | **0%** | Credencial indisponível (BLOCKED) — RLS/tabelas/dados reais não confirmados em runtime |
| Schema/Migrations | ~90% | Contagens exatas, runner, fail-closed, ghosts |
| Documentação | ~75% | Cânone + 8 DECISIONs dirigidas + DTs + fantasmas; 1.735 arquivos não lidos um a um |
| Contratos | ~70% | 18 clientes amostrados de ~30+; DTOs por amostragem |
| Fluxos | ~95% | Cadeia completa cadastro→payout traçada elo a elo com arquivo:linha |
| Testes | ~90% | Inventário completo, 3 guards críticos linha a linha, todos os outputs de execução lidos |
| Integrações externas | ~60% | PIX gateway/webhook e rail bancário verificados por código; nenhuma integração exercitada |
| **Total estimado** | **~82%** | Limitações: DB vivo bloqueado; runtime não exercitado (read-only); barris e docs por amostragem dirigida |

---

## 9. NOTA FINAL

O UnifiCard, nesta fotografia, é um sistema **institucionalmente disciplinado e operacionalmente honesto**: o que está desligado está desligado por decisão registrada e guardada por código que morde; o que está vivo está provado por E2E; e as violações encontradas estão, em maioria, já classificadas pelo próprio cartório de dívidas do projeto. Os riscos reais concentram-se exatamente onde o projeto já sabe que estão — a fronteira do dinheiro (PORTA-1) — mais um punhado de gaps estruturais silenciosos (rides sem firewall, `event_settlements` ghost, RLS parcial, gates vermelhos tolerados, dois 404 de contrato) que este laudo eleva de "conhecimento difuso" a **itens nominais com evidência**.

**Veredito: FECHA_COM_RISCO. Recomendação: DECISION (PORTA-1 decision pack, com os blockers B1–B4 e B9 como pré-condições nominais).**

*Laudo produzido em modo READ-ONLY. Toda conclusão referencia evidência viva (arquivo:linha, commit, ou execução de validador no momento da entrega). Itens sem evidência suficiente estão marcados INCONCLUSIVE.*

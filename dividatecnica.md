# DÍVIDA TÉCNICA — rastreador vivo (atualizar toda sessão)

> **Propósito:** este arquivo é o painel único de progresso rumo a **zero dívida executável**.
> Toda sessão que tocar dívida técnica: (1) lê o placar abaixo, (2) trabalha, (3) atualiza o
> placar + a checklist do lote tocado, (4) anexa uma linha no changelog (nunca reescreve o
> histórico). Nenhuma sessão termina sem atualizar este arquivo.
>
> **Relação com artefatos (revista 2026-07-06):** `PLANO_ZERAGEM_DT.md` é agora a **v2 — o PLANO
> ESTRATÉGICO vivo** (ordem dos lotes + grafo de dependências + recomendações de decisão). ESTE
> arquivo é o **rastreador do dia-a-dia** (placar + checklist por sessão). Os dois se apontam, não
> se duplicam: mudança de estratégia → PLANO; mudança de progresso → aqui.
> `LOTE_L2_DELEGACAO_R2.md` e `LOTE_L5_FROZEN_FANTASMA.md` são os pacotes de decisão detalhados
> de cada lote — ficam à parte, este arquivo só resume o status.

---

## 🔴🔴 LEI NORMATIVA — LER ANTES DE ESCREVER QUALQUER LINHA (não repetir os erros do passado)

> **Por que este bloco vem primeiro:** já cometemos exatamente este erro nesta frente. A Fatia C1
> (compositor) inventou um vocabulário de intents PARALELO + um campo `economicFlow` não-governado —
> passou em TODOS os guards de segurança e mesmo assim violava o SSOT. Só foi pego porque Clayton
> revisou no olho. Depois, a auditoria normativa achou 4 dívidas em R2 (vocabulário jurídico não
> registrado no cânone, tokens colidindo, derivação 1:1). **A causa-raiz das duas foi a mesma:
> construir superfície nova ENUMERANDO/CLASSIFICANDO por conta própria, em vez de COMPOR do
> vocabulário governado que já existia.** Isso não pode se repetir.

**Antes de criar QUALQUER tabela, coluna, enum, CHECK, registry, contrato ou classificação, siga o
`docs/01_normative/00_AGENT_PROTOCOL.md` — é o trilho que existe exatamente para isto:**

1. **§2.2 — Leitura normativa contextual:** identificar o pilar da tarefa e LER as normas congeladas
   aplicáveis em `docs/01_normative/` ANTES de agir. Nunca presumir; nunca por comentário de commit.
2. **§2.3.2 — GATE antes de alteração:** responder por escrito — qual pilar? qual SSOT governa? já
   existe estrutura/vocabulário? risco de duplicar verdade? Se qualquer resposta for incerta → ABORTAR
   e perguntar, não "implementar e alinhar depois".
3. **Procurar o vocabulário GOVERNADO primeiro** (a lição do C1): grep em `docs/01_normative/`
   (contratos `*_ACTOR_CONTRATO.md`, `18_DOMAIN_ONTOLOGY`, `SSOT_REGISTRY`, `07_NOMENCLATURA`) +
   no código vivo (enums, validadores centrais). Ele quase sempre já existe. **PROJETAR/COMPOR dele;
   NUNCA inventar chave/classificação própria.** O único conhecimento local permitido é PROJEÇÃO/UX
   (label de exibição, deeplink, ordem) — nunca a IDENTIDADE nem a AUTORIDADE.

**As camadas que NÃO se negociam (e onde cada verdade vive):**
| Camada | O que é | Onde vive | Regra |
|---|---|---|---|
| **CONCEPT** (LAYER 1) | identidade semântica de produto/serviço | `concepts` + `canonical_*` | SSOT semântico; NUNCA slug/nome/enum como identidade (Lei 7) |
| **N0 / N1 / N2 / TREE** | domínios + navegação | `domains`/`n1_nodes`/`n2_nodes`/`categories` | navegação ≠ identidade; N1/N2 não substituem `categories`; nenhuma árvore paralela |
| **INTENT** (LAYER 4) | ação do usuário | enum `ActorIntent` + `validateIntent` | vocabulário GOVERNADO; UI/módulo NÃO decide intent |
| **AUTORIDADE** (§5.16) | quem pode agir como quem | `actor_delegations` + `canRepresentActor` | uma só SSOT de delegação; vocabulário de tipo = CHECK, registrado no cânone |
| **DINHEIRO** (Lei 5) | saldo/transação/split | `bank_ledger`/`bank_*` | SSOT único; SQL só em `modules/bank/`; nenhum ledger paralelo |
| **Nomenclatura** (07) | nomes | — | snake_case plural · `_at` timestamps · `_id` FKs (com FK real) · tipo-vocab = CHECK, NÃO concepts nem tabela nova |

**Prova de coerência OBRIGATÓRIA (Lei de Coerência §5):** se a superfície nova responde a uma pergunta
que outra parte do sistema já responde ("pode criar X?", "qual o tipo?"), o E2E DEVE provar que as duas
respondem IGUAL (ex.: `composer.enabled == validateIntent().valid`). Se duas partes podem divergir, a
arquitetura está quebrando. Um guard que confronte vocabulário novo contra o governado deve nascer junto.

**Se a ideia nova não tem lar governado** (ex.: a categorização econômica entrada/saída/social do
APRENDIZADO): ela NÃO entra hardcoded numa superfície viva. Vai por governança apropriada
(CONCEPT.pillars, dimensão da ontologia via RFC) — ideia de produto ≠ verdade governada.

> **Conformidade normativa é passo de VERIFICAÇÃO, não sorte.** Os guards de segurança (atomicidade,
> autoridade, RLS) NÃO pegam violação de norma. Toda fatia estrutural precisa da checagem normativa
> explícita (auto-auditoria contra `docs/01_normative/` + selo Yala normativo nos casos sensíveis),
> além dos guards de segurança.

---

## 🔴 O QUE SIGNIFICA "ZERO" AQUI (ler antes de entrar em pânico com os números)

Zero **não** significa 0 linhas no `REMEDIATION_DT_LOG.md` — significa:
- Zero DTs no bucket **executável sem decisão** (C_CLEANUP/D_FIX) — **JÁ ATINGIDO**.
- Zero módulos expostos batendo em schema-ghost sem contenção — **JÁ ATINGIDO** (Lote L5).
- Zero itens em **A_DECISION** sem uma decisão registrada (podem seguir HOLD por escolha
  soberana — o que conta é ter sido decidido, não estar fechado).
- PORTA-1 com o mecanismo provado e a decisão de escopo (semear ou não) registrada —
  **mecanismo ATINGIDO**; semear é ato soberano, pode nunca "zerar" por escolha, e tudo bem.
- Os buckets B_MONEY/E_BLOCKED/F_LATENT **não zeram por execução** — zeram quando a frente-mãe
  (produto, dinheiro, identidade) abrir. Este arquivo rastreia até aí.

---

## 📊 PLACAR (atualizar a cada sessão)

| Métrica | Valor | Data |
|---|---|---|
| DTs distintas no cartório | **540** (medido: headers `## DT-/F-` únicos) | 2026-07-06 |
| Cross-links `[[...]]` (grafo de dependência) | 241 | 2026-07-06 |
| **Abertas (estimativa reconciliada)** | **~150–170** (inalterado — a frente de split fechou CONTENDO/RETIRANDO paralelos, não zerou DTs A_DECISION; ver nota) | 2026-07-09 |
| Contidas/mitigadas (latência viva) | ~50 | 2026-07-06 |
| Typecheck backend (build **e** dev config) | ✅ **0 / 0 erros** (medido 2026-07-09) | 2026-07-09 |
| Suite `validate:regression-guards` | ✅ **163 GATE OK / RC=0** (medido 2026-07-11 via `npm run`, `set -o pipefail`; +audit-actor-capability-grant-tenant-coherence na N2-D.2-R2) | 2026-07-11 |

**🟢 Sessão 2026-07-11 — F-NEIGHBORHOOD-CANONICAL-IDENTITY N0/N0.1/N0.2 ✅ SELADA PELA YALA · SELO COMPLETO (DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER FECHADA):** contenção dos 3 vetores conhecidos de identidade de bairro por texto livre — (1) criação SQL por nome (N0, `a81f004ea`); (2) resolução SQL de `neighborhood_id` por nome (N0.1, `7fcf407cd`); (3) resolução EM MEMÓRIA no `resolveCep` (N0.2, `c53e044dc`, remediação da REPROVAÇÃO intermediária da Yala ao N0.1). Guard `audit-neighborhood-freetext-writer-containment.mjs` cobre os 3 vetores + mutation 7/7 (M6=padrão exato da reprovação, M7=variante); suíte 155, typecheck 0, Δbank=0; `CANONICAL_WRITER_ALLOW` vazia. **Efeito na contagem:** DT FECHADA/CONTIDA/SELADA — sai do bucket de risco vivo. **Próximo passo autorizado (não iniciado):** N1 docs-only (DECISION de identidade canônica de bairro). N2/schema/seed/writer canônico seguem TRANCADOS; HOLDs 501 do Bank preservados.

**🟢 Sessão 2026-07-09 — F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM FECHADA:** frente de
consolidação do pipeline financeiro (sistema virgem, DECISION-0165). 8 fatias + 1 correção, todas
provadas e commitadas (typecheck 0 · suíte 151 GATE OK · guard anti-revival c/ stripComments testado
por mutação · Δbank=0 · working tree limpo). **Efeito na contagem:** NÃO altera a estimativa de
abertas — a frente RETIROU/CONTEU caminhos financeiros paralelos vivos (não eram DTs A_DECISION
abertas; eram superfície de risco no bucket dinheiro/PORTA-1). O número de suíte caiu 196→151 porque
o inteiro anterior estava desatualizado; 151 é a medida viva de hoje. Bucket L1/dinheiro: mais limpo
(um só pipeline de split), mas NÃO fechado — PORTA-1 e o cutover do `bankSplitEngineService` legado
(vivo p/ group_contribution) seguem HOLD.

**🔴 Método da contagem (auditoria Fable 5, 2026-07-06):** o inteiro EXATO de abertas não é
derivável por query — o cartório fecha DTs de formas heterogêneas (CLOSED/CONTAINED/CONTIDO/
FROZEN/501/tombstone/corpo). Varredura estrita de header dá 301 "sem fechamento no header"; a
reconciliação manual dá ~156; a diferença são fechamentos-no-corpo/convenção-antiga. Para
planejamento o inteiro é irrelevante — a estrutura (bucket executável = VAZIO; resto = 6 lotes de
decisão + PORTA-1 + cauda contida) é firme. A disciplina §7 (só fecha com re-carimbo no header)
existe para matar essa ambiguidade daqui pra frente. **Bucket executável-sem-decisão confirmado
VAZIO por git** (Ondas 1–5 + L5, commits verificados).

---

## ✅ FEITO (buckets executáveis sem decisão — ESGOTADOS)

- [x] Onda 1 — C_CLEANUP (20/20 processados, 2026-07-05)
- [x] Onda 2 — D_FIX esforço S (12/12 processados, 2026-07-05)
- [x] Onda 3 — D_FIX esforço M/L (21/21 processados, 2026-07-05)
- [x] Onda 4 — higiene cartorial (12 carimbos, commit `a898d80c2`, 2026-07-06)
- [x] Onda 5 — typecheck backend 48→0 erros (commit `794d51dba`, 2026-07-06)
- [x] Divergência `organizers` resolvida por verificação (commit `2a2002837`, 2026-07-06)
- [x] Reconciliação APRENDIZADO↔sistema — 7/12 gaps já tinham resposta (commit `5017c5c18`)
- [x] R2.0 auditoria read-only de delegação executada (commit `14334d27b` — `LOTE_L2_DELEGACAO_R2.md`)
- [x] PORTA-1 passo 4 (mecanismo) provado em DB efêmera, 9/9 PASS (commit `8fd1e63fa`)
- [x] **Lote L5 — contenção 501 dos 4 módulos expostos** (venue/work-instant/policy-engine/
      residence), guard+E2E 44/44, suite 195 GATE OK (commit `c6f412b4c`, 2026-07-06)

**Não há mais housekeeping autônomo disponível.** Tudo que resta pede decisão (lotes) ou é
dinheiro soberano (PORTA-1 §4).

---

## 🟡 LOTES DE DECISÃO (aguardando Clayton)

### L1 — PORTA-1 / dinheiro (~35 DTs) — MECANISMO PRONTO, escopo em aberto
- [x] Passo 1: Core de Aprovação confirmado (já existia, DECISION-0128/0129/0130)
- [x] Passo 2: firewall no sink (4 entrypoints, commit da Fatia 9 passo 2)
- [x] Passo 3: split-mecanismo + PF resolver (commit da Fatia 9 passo 3)
- [x] Auditoria Yala rodou 2× — PASS, bloqueador P2P fechado
- [x] Passo 4 mecanismo provado em efêmera (2026-07-06, 9/9 PASS)
- [x] **✅ F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM FECHADA (2026-07-09, DECISION-0165):**
      consolidação do pipeline de split ANTES de abrir PORTA-1 (sistema virgem → excisar paralelos, não
      conter por flag). 8 fatias + 1 correção, todas provadas (typecheck 0 · suíte 151 GATE OK · Δbank=0):
      1A work-assignment split paralelo excisado (+1A-R fail-close antes de mutação) · 1B `transferP2P`+
      donation aposentados (rotas desmontadas; **fecha `DT-P2P-TRANSFER-ACTOR-RESOLUTION-USERID-VS-ACTORID`
      por retirada do caminho**) · 1C `processServiceBookingPayment` legado removido (canônico preservado) ·
      1D 3 sinks event_ticket/consumption/ride_payment → `*_PAYMENT_RETIRED` · 1E-1/1b treasury-split +
      treasury-distribution workers gateados default-OFF (bootavam ungated) · 1E-2 sweep de mortos
      (post-event-split.job, event-scheduler, core/economy/split.service, resolveBankAccountForServiceActor) ·
      1F guard anti-revival `audit-bank-split-pipeline-consolidation.mjs` (stripComments, testado por
      mutação, na suíte) + reconciliação de 2 guards B1 (aceitam RETIRED = mais forte que firewall).
      **Um só pipeline vivo:** economic_policy_engine decide → bank-transaction.service executa → bank_splits.
- [ ] **Passo 4 semear saldo REAL** — Clayton escolheu "só mecanismo" por ora; reabrir quando quiser
- [ ] **HOLD/resíduo p/ próxima frente (`F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION`):** `bankSplitEngineService`
      (`modules/bank/bank-split-engine.service.ts`) segue VIVO servindo `group_contribution` (context legado
      via `bank-transaction.service:1313`), contido pelo sink firewall — **NÃO fechado nesta frente**, é o
      cutover da frente do split configurável. Também HOLD: donation (migrar ao canônico); ratchet-down
      `financial-ssot` 592→587 (DECISION-0158, aviso não-bloqueador).
- Ver `READINESS_PORTA1.md` para o mapa completo.

### L2 — Delegação/R2 + risco PJ (~12 DTs) — **DECIDIDO · R2.1 EXECUTADO**
- [x] R2.0 auditoria read-only executada (substrato existe, 9 delegações todas revogadas)
- [x] **D1** = SIM (abrir R2) · **D2** = dois eixos (jurídico via CHECK + departamento em scopes_json)
      · **D3** = tabela `actor_delegation_events` · **D4** = financeiro fora · **D5** = risco depois
- [x] **R2.1 schema** executado (migration `20260706120000`, efêmera 11/11, dev vivo, 9 legadas
      preservadas, commit abaixo) — `relationship_type`+`granted_by`+`previous_link_id`+events append-only
- [x] **R2.2 writer governado** — EXECUTADO + 3 ressalvas Yala fechadas (Q3 autoria + RLS + unique).
- [x] **RE-SELO YALA = ✅ APROVADO** (2026-07-06, commit fix `341aa961e`): Q3 materialmente fechada,
      zero bloqueador. **R2 (R2.1+R2.2+fix) = CLOSED.** Closeout `F-R2-DELEGATION-GOVERNED-LINKS`.
- [x] **R2.3 reconciliar leitura** — EXECUTADO: actor-capabilities projeta `relationshipType` (2 ramos);
      `updateMember` re-deriva a delegação ao mudar role (fecha DT-R2-...-STALE) → PUT virou escritora de
      autoria e ganhou o gate Q3 (guard minCalls 2→3). E2E 10/10, negative-proof morde, suite 196 GATE OK.
      **R2 COMPLETO** (só falta R2.4 risco, adiado por Clayton).
- [ ] **R2.4 camada de risco** (D5 — sub-frente própria; Clayton adiou explicitamente)

### L3 — Catálogo/serviços/marketplace (~15 DTs) — **PACOTE PRONTO PRA DECIDIR**
- [x] Fatia 1: mapa DECISION-0106 materializado (MarketplaceDomain→N0) — commit `3e9f1d2df`
- [x] Fork MarketplaceDomain morto de ponta a ponta (6 cópias → 1 símbolo em contracts) — `c3efb91b1`
- [x] **Pacote de decisão montado** (`LOTE_L3_CATALOGO_MARKETPLACE.md`, read-first vivo): D1 ratificar
      Opção C (método já provado 2× — BELEZA completa + LIMPEZA slice A) · D2 próximas verticais ·
      D3 tríade+aliases atômico · D4 hardening curadoria→UI (D4-RLS já corrigido!) · D5 W2 produto
      (actor-first norte, ramo MVP) · D6 GO hybrid dois-trilhos. ← **CLAYTON DECIDE**
- [ ] Execução das decisões D1-D6 (sequência: carimbos → seed verticais → curadoria → hybrid → W2-frente)
- [ ] Adjacente (bug, não decisão): `DT-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH` — diagnose-first

### L4 — Social/feed/votes (~10 DTs) — não iniciado
- [ ] Follow mechanics (decisão arquitetural pendente)
- [ ] Feed post-id drift (risco de verdade paralela)
- [ ] CTAs zumbi no frontend
- [ ] Votes eligibility (quem pode votar/criar votação)
- [ ] `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ` (precondição da Fase 2 de descoberta)
- Pacote de decisão ainda não montado.

### L5 — Módulos frozen/fantasma (~10 DTs) — **CONTENÇÃO EXECUTADA, resíduo de decisão**
- [x] Saúde, automation, organization — já resolvidos, documentados no cartório
- [x] Venue, work-instant, policy-engine, core/residence — **contidos 501** (2026-07-06)
- [ ] Presence — decisão P4 (SSOT entre 9 modelos paralelos) ainda não tomada
- [ ] Bank-satellite — arquivar `core/intent` formalmente (único caso simples do bloco de 16)
- [ ] Operational-binding-fragmentation — investigar origem das 9 delegações revogadas (liga ao L2)
- [x] Aspirational-vs-runtime — path do `MODULES_INVENTORY.md` corrigido (nota autoritativa no cartório:
      está em `docs/99_archive/raiz_2026-05-31/`, defasado ~2 meses, = registro histórico não SSOT vivo)
- Ver `LOTE_L5_FROZEN_FANTASMA.md` para o detalhe completo (12 itens originais).

### L6 — Identidade/nascimento C1 (~8 DTs) — não iniciado
- [ ] DECISION-0115 D1/D2 (tenant-por-signup, identity/actor best-effort silencioso)
- [ ] Tríade CPF F4/F5 (deprecar caches `user_profiles.cpf`/`profiles.cpf`)
- [ ] `pilot_invites` ausente em dev
- [ ] Actor institucional de sistema (decisão pendente)
- [ ] `DT-ONBOARDING-METADATA-STORAGE-DECISION` (4 opções de storage)
- Pacote de decisão ainda não montado.

**Ordem recomendada — RATIFICADA POR DEPENDÊNCIA (auditoria Fable 5, 2026-07-06):**
resíduo-L5 → **L2** → **L3** → **L4** → (**L6 em paralelo lento**) → **L1**.
Racional (não é "cheapness" — é alavancagem de dependência, ver `PLANO_ZERAGEM_DT.md` §2/§3):
- **L2 é a RAIZ** (`F-ACTOR-RELATIONSHIP-TYPED-EDGE` 7 refs; `DT-OPERATOR-GRANT-OPEN-ORDER-UX` 12
  refs = nó mais referenciado do cartório). Retorno DUPLO: o typed-edge fecha parte de L4 (follow =
  aresta actor→actor) E parte de L1 (autoridade de aprovação de payout em nome da empresa).
- **L3** é o cluster `DT-SERVICE-*` mais denso — semear catálogo+discovery+companyId colapsa ~15 DTs
  juntas (E3).
- **L4** depende de L3 (discovery Fase 2); parte já morre com L2.
- **L6 em PARALELO** (não serial): upstream porém norm-blocked (0062 D9/D10) + exige DB vivo — segurá-lo
  na fila pararia tudo à toa.
- **L1 por ÚLTIMO** (soberano, irreversível): E1 = firewall-no-sink mata V3+P2P+≥8 callers num corte só,
  na janela da PORTA-1.

---

## 🔵 SIGN-OFFS PENDENTES (não são dívida técnica — são validação sua)

- [ ] Fatia 6 (Chamado) — frontend entregue, aguarda teste visual
- [ ] Fatia 7 (CRM projetado) — frontend entregue, aguarda teste visual
- [ ] Fatia 8 (ERP composto) — frontend entregue, aguarda teste visual

---

## 📜 DISCIPLINAS VINCULANTES (herdadas — não renegociar sem motivo)

1. PJ, grupo, Bank e marketplace **nunca** na mesma execução.
2. Money/grupo/split/payout só com **três paralelas** + E2E fail-first.
3. SQL a `bank_*` só dentro de `backend/src/modules/bank/`.
4. Nada é "fechado" sem prova material (guard + negative-proof + E2E quando aplicável).
5. Reconfirmar HEAD/migrations no início de cada fatia.
6. **Fim de cada sessão:** atualizar o placar deste arquivo + reportar contagem a Clayton.
7. Fechamento de DT só vale com **re-carimbo no header do `REMEDIATION_DT_LOG.md`** — evita os
   headers mentirosos que a Onda 4 encontrou.
8. Modelo por tipo de tarefa: **Sonnet 5/alto** para verificação mecânica e higiene; **Fable
   5/extra** para julgamento arquitetural e reconciliação; **Fable 5/ultracode** reservado para
   execução de alto risco (PORTA-1, R2 writer).
9. Nunca rotular achado externo como "falso" sem checar `git log`/`git show` da história do
   arquivo — absença no presente ≠ nunca existiu.
10. Verdade está sempre no backend — nunca aceitar "frontend não chama mais" como garantia de
    segurança.

---

## 📚 DOCUMENTOS-FONTE (não duplicar aqui, só apontar)

- `REMEDIATION_DT_LOG.md` — cartório completo (fonte de verdade de cada DT individual)
- `MAPA_DE_FECHAMENTO.md` — retrato do cluster autoridade (esgotado) vs dinheiro (PORTA-1)
- `READINESS_PORTA1.md` — read-first completo do cluster de dinheiro
- `LOTE_L2_DELEGACAO_R2.md` — pacote de decisão da frente de delegação
- `LOTE_L5_FROZEN_FANTASMA.md` — pacote de decisão dos módulos frozen/fantasma
- `GUIA_MESTRE_ACOPLAMENTO_CRM_ERP_PDV.md` — trilho da missão de acoplamento (Fatias 1-9)
- `APRENDIZADO.md` — visão do Compositor + reconciliação contra o sistema vivo
- `PLANO_ZERAGEM_DT.md` — **v2, PLANO ESTRATÉGICO vivo** (ordem + grafo de dependências + decisões)

---

## 📝 CHANGELOG (mais recente no topo — append-only, nunca reescrever)

### 2026-07-13 (89) — F-NEIGHBORHOOD N3: remediação guard-only J1+J2 (papéis sintáticos de process.argv/process.exit)
- 7º veredito Yala B: H1 validava o MEMBRO mas não o PAPEL — argv.push('--apply','N3-LOAD-CURITIBA') pré-derivação e process.exit=()=>{}  passavam.
- Fix guard-only (commit cec391f9d; produto/DB intactos): J1 argv SOMENTE LEITURA (slice/includes/indexOf/join/[i]-lido/length-lido; atribuição/mutadores/++--/delete/spread/alias/passagem-como-valor/optional mordem; fail-closed); J2 exit SOMENTE chamada direta canônica colada exit(0|1|failed?1:0) (substituição/delete/alias/?.()/call-apply-bind/void/código-não-canônico mordem).
- Pontos centrais provados (ambos mordem). 48 provas; preservação H1/F2/E/D/V intacta; zero regex paralela. 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-13 (88) — F-NEIGHBORHOOD N3: remediação guard-only H1 (allowlist estrutural de process)
- 6º veredito Yala B: bloqueio de process era DENYLIST — process.binding/_linkedBinding/dlopen passavam.
- Fix guard-only (commit 807ad5582; produto/DB intactos): H1 allowlist POSITIVA {process.argv, process.exit} em acesso-ponto direto exato; qualquer outro membro (atual ou FUTURO — P24 process.futureLoader morde), computed/optional (mesmo p/ permitidos), alias (incl. de membro permitido), desestruturação, shadowing, globalThis/global = mordem. Uso legítimo (argv.slice/argv[i]/exit(0)) e palavras em string/comentário passam.
- F2 preservado (zero regex paralela; C1/C2/C3 pelo inventário). 31 provas (17 P + benignos + preservação F2/E1/E2/E3/V1/V2). 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-13 (87) — F-NEIGHBORHOOD N3: remediação guard-only (bloqueio getBuiltinModule F1 + inventário unificado C1/C2 F2)
- 5º veredito Yala B: falso PASS por process.getBuiltinModule/globalThis/computed; falso FAIL porque C1/C2 usavam regex textual paralela (texto de chamada em string/template contava como COMMIT/ROLLBACK).
- Fix guard-only (commit 31858a049; produto/DB intactos): F1 proíbe getBuiltinModule/globalThis/process[...]/alias/desestruturação de process; F2 unifica C1/C2/C3 + contagem BEGIN=1/COMMIT=1/ROLLBACK=2 no INVENTÁRIO ESTRUTURAL único de call-sites (removida a regex textual paralela → texto benigno não conta).
- Loader vivo: 19 call-sites. 22/22 mutations (F1 G01-G08; F2 C01-C07/R01-R03; benignos template/string/log/comentário; preservação E1/E2/E3/V1/V2). 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-13 (86) — F-NEIGHBORHOOD N3: remediação guard-only (completude E1 + anti-reflexão E2 + lexer SQL por statement E3/E4)
- 4º veredito Yala B: falso PASS (prototype/getPrototypeOf/helper importado) + falso FAIL (CASE...END, "COMMIT" ident, dollar-quoted, template-texto).
- Fix guard-only (commit 56dcc738b; produto/DB intactos): E1 allowlist exata de imports (sem helper/require/import-dinâmico/símbolo extra); E2 reflexão/prototype/call/apply/bind/Reflect/Proxy/Function/eval proibidos; E3 classificador SQL por statement (dollar-quote/quoted-ident/comentário/CASE-END aware; só 1º token classifica; START/SAVEPOINT/RELEASE/ABORT/END/composto mordem); E4 contagem sobre visão blankada.
- Loader vivo: 19 call-sites, BEGIN=1/COMMIT=1/ROLLBACK=2. 25/25 mutations (E1/E2/E3 + benignos B01-B14 + preservação). 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-13 (85) — F-NEIGHBORHOOD N3: remediação guard-only (inventário transacional exaustivo)
- 3º veredito Yala B: guard controlava só COMMIT literal — permitia variável (command='COMMIT'), SQL composto ('SELECT 1; COMMIT'), desestruturação/alias/bind/call/apply/computed/optional/config-object/concat/helper.
- Fix guard-only (commit 937056d0a; produto/DB intactos): D1 toda .query( enumerada, receiver=client, 1º arg LITERAL terminando em ','/')' ; D2 literal transacional deve ser BEGIN|COMMIT|ROLLBACK puro (comentários/strings SQL descontados; composto morde), contagem global BEGIN=1/COMMIT=1/ROLLBACK=2; D3 aliases/indireções proibidos.
- 27/27 mutations (Q/S/A + preservação V1/V2/C1/C2 + benignos incl. 'COMMIT' como dado SQL). 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-13 (84) — F-NEIGHBORHOOD N3: remediação guard-only FINAL (exclusividade do COMMIT + alcançabilidade do ROLLBACK)
- Veredito Yala B residual (V1/V2 fechadas): C1 COMMIT não provado exatamente-1-e-só-no-gate; C2 ROLLBACK aceito sob if(false); C3 else não associado estruturalmente ao gate.
- Fix guard-only (commit d6e2ce9bd; produto/DB intactos): skeleton com strings blanked + brace-matching real; gate único localizado por estrutura; exatamente 1 client.query('COMMIT') no arquivo, dentro do bloco do gate; alias do client proibido; else PAR do mesmo if; blocos constante-falsos excisados antes da prova de ROLLBACK alcançável (pré-return/throw/exit); nenhum COMMIT no dry-run.
- 22/22 mutations (K exclusividade; L alcançabilidade; E estruturais; V1/V2 preservadas; benignos incl. braces em template). 171 guards; typechecks/build/invariants verdes; DB 75/150/2, addr=37/nb=0, Δbank=0; sem recarga/2º apply.
- **STATUS:** remediação final executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-12 (83) — F-NEIGHBORHOOD N3: remediação guard-only (conjunto exato + schema por item + rollback vivo)
- Veredito Yala B (produto correto; guard incompleto): F1 conjunto dos 75 não fixado (troca/acento/substituição com count=75 passavam); F2 campos extras por item não proibidos; F3 prova de ROLLBACK casava log, não a chamada.
- Fix guard-only (commit c8709b012; manifest/loader/DB byte-intactos; sem recarga/2º apply): V1 sha256 fixado da projeção [ordinal,name] (3ee1ed83…21bc3, Unicode-exato, ordem exata; hash da projeção → formatação benigna); V2 item = exatamente {ordinal,name}; V3 chamada real client.query('ROLLBACK') no else/dry-run antes do catch + COMMIT proibido nesse ramo; overclaim "ROLLBACK vivo" corrigido.
- 19/19 mutations (S/I/R; R01 ROLLBACK→COMMIT com log intacto MORDE); 171 guards verdes; typechecks/build/invariants verdes; DB preservado (75/150/2; addr=37/nb=0; Δbank=0).
- **STATUS:** remediação executada e provada; N3 CONTINUA NÃO SELADA (aguarda reauditoria final Yala).

### 2026-07-12 (82) — F-NEIGHBORHOOD N3: catálogo canônico de Curitiba — 75 bairros (EXECUTADA E PROVADA, não selada)
- GO de Clayton com fonte oficial (IPPUC "Nosso Bairro"/75 + GeoCuritiba). Escopo Curitiba integral; demais RMC fora (sem grant).
- CAMINHO A: manifest curitiba-neighborhoods-manifest.json (75, government_official, city/tenant/actor ratificados) + loader one-shot n3-load-curitiba-neighborhoods.mjs (dry-run/apply token; cada bairro SÓ via writer N2-E fn_create_canonical_neighborhood, nome parametrizado seguro p/ acentos; advisory lock; estado-zero; sem INSERT direto). Guard audit-n3-curitiba-catalog (runner 170→171); 11 mutations.
- Commit material 4248075b8 + apply real. Persistido: neighborhoods=75 (Curitiba, ativos+vigentes, valid_until NULL, government_official; 75 name_normalized distintos; acentos ok); 150 eventos curadoria; aliases=0; succession=0. Readers de vigência listam os 75; D3 resolve; rerun fail-closed; addresses=37/addr_nb=0; grants intactos; Δbank=0.
- Provas: dry-run 16/16; apply 16/16; 171 guards verdes; typecheck/build/invariants verdes.
- **STATUS:** N3 EXECUTADA E PROVADA · NÃO SELADA (aguarda Yala). Nenhum address vinculado (frente própria); sem rota/painel/CEP/Social/Bank. N2-D/E/F/G+PORTA+N3-PRE+higiene+contracts seladas.

### 2026-07-12 (81) — F-NEIGHBORHOOD N3-PRE: SELADA PELA YALA (SELO COMPLETO)
- Auditoria read-only (Yala) sobre 33d7dc79f→989817447→021b907cb. Veredito A · SELO COMPLETO. N3-PRE selada.
- Confirmado: os 3 readers aplicam o predicado de vigência via NEIGHBORHOOD_CURRENT_SQL (is_active + valid_from<=now + valid_until NULL/futuro); prova composta teste+guard Classe B suficiente; guard liveness (mutations mordem); contracts intactos; runner=170; typechecks/build/invariants verdes; neighborhoods=0; addresses=37 sem neighborhood; 2 grants+2 eventos intactos; D3 resolve ambos; Δbank=0.
- Entrada anterior da N3-PRE SUPERADA por este selo, sem reescrita.
- Precisão: N3 REAL não executada; catálogo dos 75 bairros/manifest não criados; depende de novo GO (manifest+one-shot).
- **STATUS:** N3-PRE SELADA PELA YALA · SELO COMPLETO. N3 real TRANCADA; Social/Bank fora; N2-D/E/F/G+PORTA+higiene+contracts seladas.

### 2026-07-12 (80) — F-NEIGHBORHOOD N3-PRE: vigência nos readers de neighborhoods (EXECUTADA E PROVADA, não selada)
- GATE N3 apontou risco Classe C: os 3 readers (findNeighborhoodsByCity/findNeighborhoodById/validateNeighborhoodBelongsToCity) não filtravam is_active/valid_from/valid_until.
- Fix (commit 989817447): fonte única NEIGHBORHOOD_CURRENT_SQL interpolada nos 3 readers — is_active=true AND valid_from_at<=CURRENT_TIMESTAMP AND (valid_until_at IS NULL OR >CURRENT_TIMESTAMP); assinaturas inalteradas. Teste DB 11/11 (temp table, ROLLBACK, neighborhoods=0). Guard audit-neighborhood-reader-vigency (comment-aware+liveness; runner 169→170); 10 mutations mordem.
- 170 guards verdes; backend/frontend typecheck 0; build/invariants verdes; grants/eventos territoriais intactos; Δbank=0.
- Martelos futuros da N3 já ratificados (registro): fonte IPPUC "Nosso Bairro/75 bairros" + GeoCuritiba; escopo integral; count 75; government_official; manifest JSON; transação única; aliases/succession fora; manifest+one-shot.
- **STATUS:** N3-PRE executada e provada · NÃO SELADA (aguarda Yala). N3 (carga real dos 75) NÃO executada — aguarda selo desta remediação + GO do envelope. N2-D/E/F/G+PORTA seladas; Social/Bank fora.

### 2026-07-12 (79) — PORTA-TERRITORY-1: SELO COMPLETO FINAL PELA YALA
- Reauditoria final read-only (Yala) sobre a75c2ea60→43a04b715→7c4478554. Veredito A · SELO COMPLETO FINAL. PORTA SELADA.
- Confirmado: writer territorial governado (SECDEF vivo, ACL owner-only, platform_bootstrap, não-circular); 2 grants reais (create 3e5cebe6, approve 44c9dc03) p/ Actor de Clayton 213f4903 em Curitiba 9d431002, active, valid_until NULL; 2 eventos (ed9a5240/b2afe9fa); D3 resolve ambos; one-shot dry-run/apply/rerun fail-closed; reconciliação N2-D.1/D.2 nominal; família comment-awareness/liveness fechada; 169 guards; typecheck/build/invariants verdes; neighborhoods=0; Δbank=0.
- Entradas anteriores da PORTA (ativação real + remediação guard-only) SUPERADAS por este selo, sem reescrita.
- Precisão: a PORTA só estabeleceu a autoridade territorial inicial de Curitiba (2 grants); não criou neighborhood/rota/painel/Social/autoridade-financeira; NÃO iniciou nem autorizou N3.
- **STATUS:** PORTA-TERRITORY-1 SELADA PELA YALA · SELO COMPLETO FINAL. N3 TRANCADA (abertura exige NOVO GO explícito); Social/Bank fora; N2-D.1/D.2/D.3/E/F/G + higiene + contracts seladas.

### 2026-07-12 (78) — PORTA-TERRITORY-1: remediação guard-only (comment-awareness + liveness do guard da PORTA)
- Veredito Yala B (produto correto; 4 evasões no guard audit-territorial-grant-bootstrap): SECURITY DEFINER comentado; CONFIRMED=true; COMMIT if(true); ROLLBACK dry-run removido (catch mascarava).
- Fix guard-only (commit 43a04b715; produto byte-intacto): comment-stripping léxico SQL+JS preservando strings; R-2 SECDEF no cabeçalho vivo; R-3 CONFIRMED derivado do token exato (sem =true/||=/??true/reatribuição); R-4 COMMIT dominado por (APPLY&&CONFIRMED&&!failed) (rejeita if(true)); R-5 ROLLBACK vivo no else/dry-run antes do catch.
- Mutations L01-L20/C01-C10 mordem; benignos passam; 169 guards verdes; N2-D.1/D.2 OK; typecheck/build/invariants verdes.
- Grants reais intactos (3e5cebe6, 44c9dc03); nenhuma reaplicação; neighborhoods=0; Δbank=0.
- **STATUS:** remediação guard-only executada e provada; PORTA-TERRITORY-1 CONTINUA NÃO SELADA (aguarda reauditoria final Yala). N3 trancada; Social/Bank fora.

### 2026-07-12 (77) — PORTA-TERRITORY-1: primeira autoridade territorial real de Curitiba (EXECUTADA E PROVADA, não selada)
- Martelos M-1..M-6: grantee=Actor Clayton 213f4903; city=Curitiba 9d431002; só create+approve; valid_until NULL; mecanismo B+A; issuer=Clayton (authority_source=platform_bootstrap).
- Lacuna fechada: criado writer governado fn_grant_territorial_capability (migration 20260712120000, SECURITY DEFINER, só territory-scope tenant NULL/scope_actor NULL/city obrigatório/active, grant+evento atômico, sem ON CONFLICT; ACL REVOKE de PUBLIC+unificard_app).
- Operação one-shot porta-territory-1-bootstrap-curitiba.mjs (dry-run default / --apply com token; advisory lock; estado-zero fail-closed; recusa unificard_app). Guard dedicado audit-territorial-grant-bootstrap (runner 168→169; 14+ mutations). Reconciliação nominal mínima dos guards selados N2-D.1/N2-D.2 (que já antecipavam a PORTA), sem enfraquecer.
- Commit material 0e0b4ab5c + apply real. Grants persistidos: create 3e5cebe6, approve 44c9dc03; eventos ed9a5240/b2afe9fa. D3 resolve ambos. Rerun fail-closed. neighborhoods=0; Δbank=0.
- Provas: dry-run 12/12; 169 guards verdes; typecheck/build/invariants verdes; D3 ok.
- **STATUS:** PORTA-TERRITORY-1 EXECUTADA E PROVADA · NÃO SELADA (aguarda Yala). N3 TRANCADA (depende de selo + novo GO); sem rota/painel/CEP/Social/Bank/fundo; N2-D/E/F/G seladas.

### 2026-07-12 (76) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-G: SELO COMPLETO PELA YALA
- Auditoria read-only (Yala) sobre 71ba59c15→0749d96de→aeaa6a29c. Veredito A · SELO COMPLETO. N2-G SELADA.
- Confirmado: prova integrada N2-E×N2-F versionada/transacional/reproduzível; writer canônico real; create+approve distintos; 2 grant_ids; 2 eventos; token consumido; neighborhood efêmero; address coerente; falhas compostas (FK composta/CHECK/FK inexistência); display_text=evidence; HOLD de DML direto; rollback; resíduo zero; guard agregador; 168 guards; typechecks/build/invariants verdes; Δbank=0.
- Não-bloqueantes (polimento, sem remediação): SQL integrado executado separadamente do guard estrutural; redundâncias formais do guard.
- Precisão: prova token consumido (não reuso ativo); CEP/provider cobertos pela contenção textual já selada, não pelo teste N2-G. Selo NÃO abre PORTA/N3.
- Entrada anterior da N2-G (executada-e-provada/não-selada/aguarda-Yala) SUPERADA por este selo, sem reescrita.
- **STATUS:** N2-G SELADA PELA YALA · SELO COMPLETO. PORTA-TERRITORY-1/N3 permanecem TRANCADAS (dependem de novo GO explícito); Social/Bank fora; N2-D.*/N2-E/N2-F/higiene/contracts seladas.

### 2026-07-12 (75) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-G: prova integrada N2-E×N2-F (EXECUTADA E PROVADA, não selada)
- CAMINHO A do GATE consolidado: materializa a única lacuna (prova versionada compondo writer N2-E + address N2-F num só fluxo). Commit material 0749d96de + cartório docs-only.
- Teste DB integrado (transacional, ROLLBACK, resíduo ZERO): writer canônico REAL cria neighborhood (create+approve, 2 grant_ids, 2 eventos, token consumido) → address coerente o referencia; falhas compostas: city incorreta→FK, sem-city→CHECK, inexistente→FK, display_text não vira identity; INSERT direto→HOLD; atomicidade + resíduo zero (neighborhoods=0…addresses=37…actors=6). 16/16 G-checks.
- Guard agregador (runner 167→168) prova forma executável/liveness (writer real, não INSERT direto; ROLLBACK real não comentado; sem COMMIT/DELETE-cleanup/Bank; wiring); 13 mutations (10 hostis mordem, 3 benignos).
- Provas: 168 guards verdes; backend/frontend typecheck 0; build verde; invariants 5/5; banco intacto; Δbank=0. ZERO mudança de produto.
- **STATUS:** N2-G EXECUTADA E PROVADA · NÃO SELADA (aguarda Yala). PORTA-TERRITORY-1/N3 trancadas; N2-E/N2-F/higiene/contracts seladas; Social/Bank fora.

### 2026-07-12 (74) — F-REPOSITORY-DEPENDENCY-HYGIENE + F-CONTRACTS-DIST-INTEGRITY: SELO COMPLETO CONSOLIDADO PELA YALA
- Auditoria consolidada read-only (Yala) sobre bb4c9989e→5d90d8775→1fa86db5c→1c3a9cfc5→cda77e335. Veredito A · SELO COMPLETO CONSOLIDADO. As DUAS frentes seladas conjuntamente.
- Confirmado: node_modules tracked=0 (68.128 desversionados) e físico ignorado; toolchain canônica (pnpm --frozen-lockfile); manifests/lockfile byte-intactos; worktree-safety fail-closed (19/19); contracts/dist completo e determinístico (vocabulary+marketplace); @unificard/contracts resolve runtime+tipos; 4 erros de auth eliminados pela causa sem tocar auth/zod/tsconfig; guard INV7 (8/8 mutations); 167 guards verdes; backend/frontend typecheck 0; build verde; invariants 5/5; banco intacto; Δbank=0.
- Entradas anteriores dessas duas frentes (checkpoint/aguarda-Yala/bloqueada/executada-e-provada) SUPERADAS por este selo, sem reescrita.
- Não-bloqueantes (sem abrir frente): dist versionado por force-add (desversionar=frente arquitetural própria); .d.ts.map não é invariante do guard; stash C65-distribution-amount-rename fora do arco.
- **STATUS:** AMBAS SELADAS PELA YALA · SELO COMPLETO CONSOLIDADO. N2-E/N2-F seladas; N2-G liberada como próxima fase possível, NÃO iniciada; PORTA-TERRITORY-1/N3 trancadas; Social/Bank fora.

### 2026-07-12 (73) — F-CONTRACTS-DIST-INTEGRITY: reconstrução de packages/contracts/dist (corrige os 4 erros de auth.routes; desbloqueia a higiene)
- Causa dos 4 erros de auth.routes.ts (diagnóstico read-only): NÃO era zod/moduleResolution/código auth (bundler mantinha os erros; repro isolado passava). Era packages/contracts/dist INCOMPLETO — faltavam vocabulary/marketplace (.js/.d.ts) que dist/index reexporta/requer → GENDER_VALUES/Gender viram any → registerSchema.data=unknown. Runtime também quebrava: require('@unificard/contracts') → MODULE_NOT_FOUND './vocabulary'.
- Preexistente (dist commitado incompleto; dist/ é .gitignored, 18 arquivos force-added); exposto pela recuperação do incidente (git-restore do dist parcial).
- Fix (commit 1c3a9cfc5): rebuild canônico pnpm --filter @unificard/contracts build (tsc -b), determinístico (18 antigos byte-idênticos); force-add dos 6 ausentes (M-2 dist versionado). Guard estendido INV7 (completude src↔dist + resolução re-exports + vocabulary/marketplace + require runtime); 8/8 mutations mordem.
- Provas: backend typecheck 0 (sem tocar auth.routes.ts/zod/tsconfig/lockfile); suíte 167 verde; frontend typecheck 0/build/invariants 5/5; runtime OK; DB intacto; Δbank=0.
- **STATUS:** EXECUTADA E PROVADA · NÃO SELADA. Desbloqueia F-REPOSITORY-DEPENDENCY-HYGIENE (revalidada 167 + typecheck 0); ambas aguardam UMA Yala consolidada. N2-G não iniciada; PORTA/N3 trancadas.

### 2026-07-12 (72) — F-REPOSITORY-DEPENDENCY-HYGIENE CHECKPOINT: node_modules desversionado + safety de worktree (NÃO SELADA, bloqueada por typecheck)
- Incidente: remoção de worktree seguiu junction/symlinks pnpm → apagou node_modules + packages/contracts no main tree. Recuperado por restauração exata de HEAD.
- Higiene (martelos M-1..M-5): 68.128 paths node_modules removidos do INDEX (todos com segmento exato node_modules; 0 fora); .gitignore JÁ cobria (não editado, provado por check-ignore); limpeza física segura (ferramenta worktree-safety.mjs, nunca segue link, testes 19/19); pnpm install --frozen-lockfile de árvore limpa (added 1013, exit 0); manifests+lockfile byte-idênticos; node_modules agora ignorado (git ls-files=0); guard audit-repository-dependency-hygiene.mjs GATE OK, runner 166→167.
- Commit material 5d90d8775 + cartório docs-only. NÃO É SELO; sem Yala.
- 🔴 BLOQUEIO (não corrigido, frente separada): backend tsc EXIT 2, 4 erros PREEXISTENTES em auth.routes.ts (inferência zod: safeParse().data = unknown; TS2345×2, TS2339×2). Envelope não tocou auth.routes/tsconfig/zod/package.json/lockfile; install canônico REVELOU incompatibilidade latente antes mascarada pelo node_modules versionado. Correção (moduleResolution? tipagem? schema?) NÃO ratificada — GATE próprio.
- Frontend typecheck 0. Suíte 167 não executada integralmente (guards tsc-dependentes falhariam pelos mesmos erros). packages/contracts com ' M' stat-only (conteúdo == HEAD). Banco intacto; Δbank=0.
- **STATUS:** EXECUTADA ESTRUTURALMENTE · CHECKPOINT COMMITADO · NÃO SELADA · BLOQUEADA. N2-E/N2-F seladas; N2-G não iniciada; PORTA-TERRITORY-1/N3 trancadas; Social/Bank fora.

### 2026-07-12 (71) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-F INTEGRADA À rescue-structural (merge NO-FF, arco selado preservado)
- Integração controlada da N2-F (já selada pela Yala) do branch isolado n2f-address-composite-coherence para rescue-structural.
- Arco selado preservado: 1e5ee8796 → 4f3c6df6d → 39df72855 → 8049f2be7. Frontend concorrente estabilizado em 58362a64b (disjunto).
- merge-base = 1e5ee8796; avanço disjunto → merge normal NO-FF (sem rebase/squash/cherry-pick/reset/stash). A∩B = ∅; zero conflito.
- Merge commit c399846b0 (pais 58362a64b + 8049f2be7). Produto material byte-idêntico a 4f3c6df6d (9/9); frontend byte-idêntico a 58362a64b.
- Higiene line endings: commit 20d8a6133 normalizou CRLF→LF em REMEDIATION_DT_LOG.md e dividatecnica.md — hash semântico idêntico
  (da7435dd2e89df8a / 7f01eb7a1bdf0b4f), mesmas 17688 / 1630 linhas, git diff --ignore-space-at-eol sem alteração textual, só os 2 docs.
- Provas pós-integração (conforme selo, revalidadas): 166 guards; typecheck 0; addresses=37; neighborhoods=0; grants=0; zero resíduo; Δbank=0.
- Worktree C:\unificard-n2f-wt removido após integração; branch de auditoria preservada.
- **STATUS:** N2-F SELADA E INTEGRADA. rescue-structural contém 8049f2be7. PORTA-TERRITORY-1/N2-G/N3 trancadas; nenhum grant/bairro
  territorial real; Social/Bank fora.

### 2026-07-12 (70) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-F SELADA PELA YALA (SELO COMPLETO) — coerência composta de addresses, fechamento por envelope
- Auditoria final por envelope (Yala read-only). Arco 1e5ee8796 → 4f3c6df6d → 39df72855. Veredito A · SELO COMPLETO.
- Executada em worktree isolado (branch n2f-address-composite-coherence); branch AINDA NÃO integrada à rescue-structural.
- Confirmado: candidate key UNIQUE(city_id,neighborhood_id) + CHECK ck_addresses_neighborhood_requires_city +
  FK composta fk_addresses_city_neighborhood (MATCH SIMPLE/RESTRICT/NO ACTION); FK simples removida; índice;
  zero backfill textual; rentals/events protegidos; mapper por constraint exata; FK não-territorial e infra PROPAGAM.
- Provas: DB 17/17; runtime TS 8/8; 32 mutations; 166 guards; typecheck 0; addresses=37; neighborhoods=0;
  grants=0; zero resíduo; Δbank=0.
- Pendência (não-bloqueante): higiene de line endings (docs reencodados p/ CRLF no 39df72855) a tratar em
  procedimento SEPARADO antes da integração; nenhuma integração/normalização global autorizada no selo.
- **STATUS:** N2-F SELADA · SELO COMPLETO · FECHAMENTO POR ENVELOPE. Branch isolado não integrado. Oficialmente
  encerrada. PORTA-TERRITORY-1/N2-G/N3 trancadas; nenhum grant/bairro territorial real; Social/Bank fora.

### 2026-07-12 (69) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-F MATERIAL — coerência composta de addresses (worktree isolado, aguarda auditoria Yala por envelope)
- GO material (martelos M-1..M-4; base congelada 1e5ee8796). Executada em WORKTREE LIMPO (branch
  n2f-address-composite-coherence), frontend concorrente intocado. Material `4f3c6df6d`. NÃO integrar antes de Yala.
- Migration `20260711220000`: candidate key UNIQUE(city_id,neighborhood_id) em neighborhoods (M-1);
  CHECK ck_addresses_neighborhood_requires_city (D-F1); FK composta fk_addresses_city_neighborhood
  (city_id,neighborhood_id)→neighborhoods MATCH SIMPLE/ON DELETE RESTRICT/ON UPDATE NO ACTION (D-F2/M-3);
  FK simples addresses_neighborhood_id_fkey removida (D-F3); índice; validação imediata; ZERO backfill (D-F4).
- Writers (M-2): mapper address-territorial-errors.ts (reusa HttpError) — assertNeighborhoodRequiresCity
  (nb-sem-city→400 antes do INSERT) + mapAddressTerritorialConstraintError (mapeia SÓ ck_/fk_ por nome exato→
  400/409; FK não-territorial e infra PROPAGAM). Aplicado a rentals (create+update) e events (venue).
- Provas: migration auto-prova; DB 17/17 (matriz nulabilidade, coerência mesma-cidade, Centro-em-2-cidades,
  display_text sem nb, RESTRICT, rollback resíduo 0); TS runtime 8/8; mutations 32 (29 hostis+3 benignos).
  Guard novo (runner 165→166). typecheck 0; suíte 166; addresses=37/neighborhoods=0; Δbank=0.
- Nota: worktree checkout com CRLF normalizado para LF (autocrlf=false + checkout do blob) — git status só as
  9 mudanças reais, zero ruído de line-ending, zero frontend.
- **STATUS:** N2-F EXECUTADA — AGUARDA AUDITORIA YALA POR ENVELOPE. PORTA/N2-G/N3 trancadas; nenhum
  grant/bairro territorial real; Social/Bank fora.

### 2026-07-12 (68) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-E SELADA PELA YALA (SELO COMPLETO) — primeiro writer canônico, fechamento por envelope
- Auditoria final por envelope (Yala read-only) sobre o arco: base d2bd016cf → material 3002d174e → cartório
  0d18de5ce → remediação guard-only 9d128c28a → cartório 859df2a4e. Veredito A · SELO COMPLETO.
- Produto material byte-intacto desde 3002d174e (inclusive durante a remediação). Writer atômico create+approve,
  ownership-direto (barreira SQL FOR SHARE), 2 grant_ids + 2 eventos, token transacional one-use não-sobrevivente,
  HOLD bloqueia INSERT-sem-token/UPDATE/DELETE, ACL correta, auditoria append-only, service/repository corretos.
- R-1 liveness do HOLD + R-2 liveness do consumo do token + R-3 cobertura de DML da migration: fechadas.
  16 invariantes selados. Observação não-bloqueante: hardening futuro opcional do search_path normalize_name/
  unaccent (não condiciona o selo). 165 guards; typecheck 0; zero resíduo; 6 Actors; HOLDs ENABLE ALWAYS; Δbank=0.
- **STATUS:** N2-E SELADA · SELO COMPLETO · FECHAMENTO POR ENVELOPE. Oficialmente encerrada. PORTA-TERRITORY-1/
  N2-F/N2-G/N3 trancadas; nenhum grant/bairro territorial real; Social/Bank fora.

### 2026-07-12 (67) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-E REMEDIAÇÃO — liveness do HOLD/token + cobertura de DML (guard-only, aguarda reauditoria Yala final)
- Reauditoria Yala da N2-E (`3002d174e`): B guard-only. Produto pronto para selo; única família = liveness
  dos triggers + DML da migration. Base `0d18de5ce`; material remediação `9d128c28a` (produto byte-intocado).
- G-1 RETURN antes do RAISE no HOLD → RAISE inalcançável; G-2 RETURN NEW antes do consume → INSERT sem token;
  G-3 DML solta na migration não varrida (guards antigos delegaram a migration inteira ao guard N2-E).
- Guard endurecido com ANÁLISE DE LIVENESS: R-1 (branch INSERT isolado; remanessante sem RETURN/EXCEPTION/IF
  antes de RAISE incondicional); R-2 (ordem DELETE→cardinalidade→gate<>1→RAISE→RETURN NEW, 1 RETURN, sem
  swallow, gate não-enfraquecido); R-3 (remove corpos $func$ das funções canônicas, varre remanescente +
  DO-blocks por DML/CTE/EXECUTE sobre neighborhoods). Técnica: extração nominal + execBody + tokenização.
- Provas: mutations 32 (29 hostis H/T/M/C + 3 benignos); bateria original 41/41 preservada; 2 gaps do guard
  fechados (DML em DO-block → strip só-single-quote; EXECUTE → skel). suíte 165; migration byte-idêntica; Δbank=0.
- **STATUS:** N2-E REMEDIAÇÃO EXECUTADA — AGUARDA REAUDITORIA YALA FINAL. PORTA/N2-F/N2-G/N3 trancadas;
  nenhum grant/bairro territorial real; Social/Bank fora.

### 2026-07-12 (66) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-E MATERIAL — primeiro writer canônico de bairro (aguarda auditoria Yala por envelope)
- GO material (D-A..D-E; base `d2bd016cf`). Material `3002d174e` (migration + repo/service TS + guard + 4
  guards reconciliados + 3 testes). Reutiliza fn_assert_territorial_capability (D.3) + neighborhoods; zero rota/grant.
- Migration `20260711210000`: CHECK forward-only do nome (normalize_name intocado); token transacional de
  uso único (xid+backend, constraint trigger diferido de não-sobrevivência); curation events append-only
  (created/approved, capability↔operation, snapshot); HOLD reescrito (U/D RAISE, INSERT defere a consume
  row-level ENABLE ALWAYS, sem GUC/role); writer fn_create_canonical_neighborhood SECURITY DEFINER
  (ownership-direto FOR SHARE + 2 assertions D.3 create+approve + INSERT único + 2 eventos; retorna só id).
- TS interno sem rota: repository exige TxQueryClient (sem pool, infra propaga); transaction-service separa
  contexto/payload, canRepresentActor = prevalidation gateada (false=deny, throw propaga), withTransaction
  mesmo client. canRepresentActor NÃO é a barreira material (SQL impõe ownership-direto).
- Provas: DB 43/43; concorrência (grant FOR SHARE bloqueia revoke ~1.5s, token não cruza tx/backend,
  mesmo-nome serializa); TS runtime (infra propaga, false→403, happy path atômico, conflito 409); mutations
  41 (37 hostis + 4 benignos); 1 gap do guard fechado (GRANT writer a PUBLIC). Guard novo (runner 164→165);
  guards dml-hold/alias/succession/foundation-D.1 reconciliados nominalmente. typecheck 0; suíte 165; Δbank=0.
- **STATUS:** N2-E EXECUTADA — AGUARDA AUDITORIA YALA POR ENVELOPE. PORTA/N2-F/N2-G/N3 trancadas; nenhum
  grant/bairro territorial real; app sem DML direto; Social/Bank fora.

### 2026-07-12 (65) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-E DECISÕES PRÉ-MATERIAL RATIFICADAS (docs-only, material NÃO iniciado)
- GATE N2-E (read-first, base f64cc46a5) + ADENDO N2-E à DECISION-0172. Zero backend/migration/schema/guard.
- Achados: canRepresentActor NÃO é transaction-aware (sub-leituras em conexões próprias, sem locks);
  normalize_name sem TRIM (edge whitespace, helper compartilhado); HOLD = RAISE incondicional ENABLE ALWAYS
  (sem allowlist); neighborhoods nasce já aprovado (approved_by NOT NULL, sem draft), só is_active boolean.
- D-A representabilidade MVP = ownership-direto (grantee = Actor user do próprio usuário, mesmo tenant, row
  travada; canRepresentActor = prevalidation, não única barreira; company/group/delegation fora).
- D-B create+approve = duas operações explícitas (2 capabilities, 2 grant_ids, 2 eventos, 5 elos por
  operação; mesma pessoa pode ambas no MVP; sem approval implícita).
- D-C CHECK forward-only de neighborhoods.name (rejeita vazio/só-whitespace/borda) no mesmo envelope; não
  alterar normalize_name; input inválido falha (sem trim silencioso).
- D-D substituição estreita do HOLD SEM bypass (GUC/role/tenant/superuser/trigger-disable proibidos); token
  transacional interno fechado, uso único, só da função canônica, consumido pelo trigger, inacessível à app.
- D-E trilha própria append-only neighborhood_curation_events (não actor_capability_grant_events); eventos
  created/approved atômicos com o write; rollback do bairro remove eventos.
- Arquitetura: writer interno sem rota/PORTA; função SECURITY DEFINER via transaction-service na mesma tx;
  tudo (ownership+2 grants+city+token+INSERT+2 eventos) atômico com locks determinísticos; infra PROPAGA.
- **STATUS:** N2-E decisões pré-material ratificadas (docs-only). Material NÃO iniciado. HOLD intacto;
  PORTA/N2-F/N2-G/N3 trancadas; nenhum writer/rota/grant territorial; Social/Bank fora; Δbank=0.

### 2026-07-12 (64) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.3 SELADA PELA YALA (SELO COMPLETO) — resolver territorial, fechamento por envelope
- Auditoria final por envelope (Yala read-only) sobre o arco único: fundação `ed09e9307` (docs `750b5a242`)
  + remediação `ec9f4bfa2` (docs `04aed8ed1`). N2-D.3 SELADA · SELO COMPLETO. Migration/função SQL/repository
  byte-intactos desde a fundação; resolver/guard na versão da remediação.
- Fundação: fn_assert_territorial_capability(uuid,text,uuid)→uuid — SECURITY DEFINER, PUBLIC sem EXECUTE,
  6 keys exatas, Actor tenant-bound, grant global por city (nunca por tenant), lifecycle, ORDER BY+LIMIT 2+
  FOR SHARE (grant e Actor), cardinalidade 0/1/>1 fail-closed, negação uniforme não-vazante; eventos=auditoria.
- Composição TS: key→canRep→gate→SQL; representar Actor e capability são cumulativos; repository não roda sem
  representabilidade. Remediação: false=deny legítimo; erro de infra de canRepresentActor PROPAGA (nunca
  false/null/403); guard rejeita fail-open, infra-swallow e bypasses compostos.
- Fronteira honesta: SQL trava a row do grant, não a representação humana; sem atomicidade completa
  (representação+capability+escrita) — é N2-E. Writer territorial integralmente proibido (mesmo que chame o resolver).
- Observação não-bloqueante O-N2-D3-PURE-RETHROW-GUARD: guard rejeita try/catch{throw error} puro (falso-FAIL
  fail-closed, sem falso PASS); código vivo usa forma sem catch; não condiciona o selo.
- Invariantes selados (16); SQL/ACL/locks intactos; grants/territory/eventos=0; zero writer/rota/grant.
  N2-E = próxima possível (GO próprio). PORTA/N2-E/N2-F/N2-G/N3 trancadas; Social/Bank fora; suíte 164; Δbank=0.

### 2026-07-11 (63) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.3 REMEDIAÇÃO — erro de infra em canRepresentActor (mesmo envelope, aguarda reauditoria Yala final)
- Reauditoria Yala da N2-D.3 (`ed09e9307`): fundação SQL pronta; única família aberta = error-flow de
  canRepresentActor. Base `750b5a242`; material remediação `ec9f4bfa2` (resolver+guard+teste TS;
  migration/função SQL/repository BYTE-INTACTOS).
- Ressalva: o resolver envolvia canRepresentActor em try/catch convertendo QUALQUER erro em canRep=false —
  infra-swallow (timeout/DB tratado como negação de autoridade).
- Correção: removido o try/catch. `const canRep = await canRepresentActor(...); if(!canRep) return null;`.
  false = deny legítimo (null/false/403); erro LANÇADO PROPAGA (nunca false/null/403). Guard endurecido:
  proíbe try/catch/finally/.catch/atribuição literal/fallback em volta da representação; exige gate antes do
  repository + chamada única. Rejeita fail-open E infra-swallow.
- Provas: mutations 31 (27 hostis F/S/G/C + históricas + 4 benignos); TS runtime (fase-1 sem ports: infra
  PROPAGA; fase-2 com ports: false=deny, true+grant=aprova; distintos). typecheck 0; suíte 164; Δbank=0.
- **STATUS:** N2-D.3 (envelope + remediação) EXECUTADA — AGUARDA REAUDITORIA YALA FINAL. PORTA/N2-E/N2-F/
  N2-G/N3 trancadas; nenhum grant territorial existe; Social/Bank fora.

### 2026-07-11 (62) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.3 — resolver/assertion de capability territorial (material, aguarda auditoria Yala por envelope)
- GO material (D1..D8 ratificados; base selo N2-D.2 `da8a85b8e`). Material `ed09e9307`. Fecha a lacuna de
  ENFORCEMENT: existia a casa territorial mas ZERO resolver. Reutiliza actor_capability_grants; zero grant/rota/writer.
- Migration `20260711200000`: `fn_assert_territorial_capability(grantee_actor_id, capability_key, scope_city_id)
  RETURNS uuid` — SECURITY DEFINER; key territorial por conjunto EXATO (sem prefixo); grantee Actor tenant-bound
  travado FOR SHARE (FK CASCADE); grant GLOBAL ativo por city (grantee/key/city/scope='territory'/active/revoked_at
  NULL/valid_from<=now()/valid_until), NUNCA por tenant; cardinalidade 0/1/>1 fail-closed (LIMIT 2, ORDER BY, sem
  LIMIT 1); LEITURA pura (não escreve/evento D4); negação uniforme TERRITORIAL_CAPABILITY_DENIED não-vazante; ACL
  PUBLIC-sem-EXECUTE/app-na-assinatura. 3 auto-provas de negação na migration.
- Wrapper TS `territorial-capability-resolver.ts` (fonte única has/assert): isTerritorialCapabilityKey (match exato)
  + canRepresentActor (tenant server-side, gateado) + função SQL via repository; denial→false/403, infra PROPAGA.
- Guard novo `audit-territorial-capability-resolver.mjs` (runner 163→164). Guards D.1/D.2 reconciliados nominalmente
  (admitem a fatia D.3, como já admitem a D.2). 2 gaps do guard achados/fechados (FOR SHARE na query do grant; gating canRep).
- Provas: DB 16/16 (aprova+nega uniforme+shape impossível+app+PUBLIC+1 assinatura+resíduo 0); concorrência (conn2
  bloqueia ~1.5s sob FOR SHARE, prossegue após liberação, trigger imutabilidade restaurada, resíduo 0); TS runtime
  (repository TS→SQL + composição has/assert); mutations 34 (29 hostis + 5 benignos). typecheck 0; suíte 164; Δbank=0.
- **STATUS:** N2-D.3 EXECUTADA — AGUARDA AUDITORIA YALA POR ENVELOPE. PORTA-TERRITORY-1/N2-E/N2-F/N2-G/N3 trancadas;
  nenhum grant territorial existe; Social/Bank fora.

### 2026-07-11 (61) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R2+R3+R3.1+R3.2 SELADAS PELA YALA (SELO COMPLETO) + N2-D.2 GERAL SELADA — fechamento por envelope
- Auditoria final por envelope (Yala, read-only) sobre a cadeia material: R2 `a7aef8107` (cartório
  `ba237d588`), R3 `6b9757496` (`9c66fe30a`), R3.1 `de642a91e` (`87b461d75`), R3.2 `ecbeb34dc` (`d1d51467e`).
  Produto R2 byte-intacto desde `a7aef8107` ao longo de R3/R3.1/R3.2 (correções guard-only).
- R2 fechou o defeito cross-tenant nas funções SECURITY DEFINER (FKs eram actors(id) sem tenant): fn_grant
  valida grantee/scope/granted_by/executed_by/responsible_human no tenant antes do INSERT; fn_revoke exige
  p_expected_tenant_id (cross-tenant→NOT_FOUND não-vazante; territory→scope mismatch; assinatura antiga
  DROPADA); helper tenant exato+dedup+ORDER BY id+FOR SHARE, ACTOR_TENANT_MISMATCH não-vazante; chamada
  direta como unificard_app não contorna a barreira. R3=liveness+cinco actors; R3.1=classe+payload
  não-vazante; R3.2=egress pré-tenant+posicionais+tokenizador (variável vs texto literal).
- **N2-D.2 GERAL SELADA (SELO COMPLETO):** D.1 (shape actor/territory, city scope, anti-suspended) + D.2
  (12 keys, matriz scope×capability fechada, lifecycle append-only, reason/revoke_reason, 4 funções, ACL) +
  R1 (unicidade Actor user, writers idempotentes) + R2 (coerência tenant×Actors) + guards (durabilidade).
- Invariantes selados: key não é actor+territory simultâneo · grants actor só usam Actors do mesmo tenant ·
  função DB é barreira mesmo com chamada direta · inexistente≡estrangeiro (sem diferença útil) · nada do
  grant estrangeiro transmitido antes do NOT_FOUND · reason≠revoke_reason · grants/eventos append-only sem
  reciclagem · expire/regrant internos · zero grant territorial · canRepresentActor≠capability grant.
- Observação não-bloqueante O-N2-D2-DOLLAR-QUOTE-GUARD: guard pode recusar mensagem NOT_FOUND em dollar-quote
  (falso-FAIL, fail-closed — sem falso PASS, sem bypass, sem vazamento vivo); não condiciona o selo; higiene
  futura só quando o guard for naturalmente revisitado.
- **STATUS:** N2-D.2-R2+R3+R3.1+R3.2 SELADAS · SELO COMPLETO · FECHAMENTO POR ENVELOPE. N2-D.2 GERAL SELADA ·
  SELO COMPLETO. N2-D.3 (resolver/enforcement territorial) autorizada só como próxima fatia possível, NÃO
  iniciada. PORTA-TERRITORY-1/N2-E/N2-F/N2-G/N3 trancadas; grants/eventos=0; Social/Bank fora; Δbank=0.

### 2026-07-11 (60) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R2-R3.2 — egress pré-tenant + payload posicional + falso-positivo de literal (guard-only, aguarda reauditoria Yala final)
- Reauditoria da R3.1 (`de642a91e`): SELO COM RESSALVA guard-only. 3 brechas: (1) vazamento ANTES do
  tenant check (R3.1 só via o branch; RAISE NOTICE/pg_notify/PERFORM/:= na janela pré-tenant exfiltrava);
  (2) parâmetros posicionais ($1/$2 passavam pela allowlist); (3) falso-positivo — palavra v_grant DENTRO
  de um literal era lida como acesso real de variável. Correção guard-only (`ecbeb34dc`); produto R2 byte-intocado.
- Guard endurecido: (a) TOKENIZADOR sqlScan() — literais single/E/dollar-quote esvaziados, comentários→espaço,
  aspas-duplas desaspadas (viram token real p/ allowlist pegar), posicionais coletados; FAIL em dollar-quote
  inacabado. (b) allowlist roda sobre o skeleton + posicionais.length>0 = FAIL. (c) JANELA PRÉ-TENANT: do fim
  do SELECT INTO v_grant até o IF tenant, proíbe RAISE NOTICE/WARNING/LOG/INFO/DEBUG, NOTIFY/pg_notify,
  PERFORM, CALL, EXECUTE, INSERT/UPDATE/DELETE, ASSERT, :=, SELECT...INTO. O3 preservado (RAISE EXCEPTION
  control-flow não é egress; ordem scope-antes-tenant intacta, não corrigida nesta fatia).
- Provas: guard PASS no código real; 30/30 hostis mordem (P1-P13 egress, Q1-Q8 posicional, I1-I6 quoted idents,
  R-preservadas false-AND/tenant-arg/cinco-actors); 11 benignos PASS incl. evasão-E honesta (literal com o texto
  v_grant.tenant_id + classe mantida → passa), aspas-duplas e $1 dentro de literal não confundidos; suíte 163;
  produto R2 byte-intocado (diff a7aef8107 vazio); 6 actors preservados; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2-R2-R3.2 EXECUTADA — AGUARDA REAUDITORIA YALA FINAL LIMITADA. N2-D.2-R2 ainda sem
  SELO COMPLETO; N2-D.2 geral permanece SELO COM RESSALVA. N2-D.3/PORTA/N2-E/N3 trancadas; Social/Bank fora.

### 2026-07-11 (59) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R2-R3.1 — payload não-vazante do erro de revoke (guard-only, aguarda reauditoria Yala final)
- Reauditoria da R3 (`6b9757496`): SELO COM RESSALVA guard-only. "Não vazante" tem 2 garantias: classe
  (NOT_FOUND — R3 protegia) e CONTEÚDO (mensagem não revela tenant/Actor — desprotegido). Evasão:
  conservar NOT_FOUND + incluir v_grant.tenant_id na mensagem. Correção guard-only (`de642a91e`);
  produto R2 byte-intocado.
- Guard endurecido: SHAPE FECHADO do branch (1 RAISE, sem statement executável/atribuição/log antes ou
  depois) + ALLOWLIST POSITIVA do payload (removidos literais, só palavras-chave RAISE + format +
  p_grant_id; qualquer outro token = vazamento). Cobre argumento direto/||/format/row_to_json/to_jsonb/
  ::text/USING MESSAGE-DETAIL-HINT/log-antes/2ª exceção/variável intermediária. Anti-sobreajuste
  (reformulação/multilinha/USING só-literais/com-sem p_grant_id passam).
- Provas: guard PASS no código real; mutations 28/28 (L1-L19 + evasão original L1 e variante USING/format
  + mutations críticas R3 preservadas + L20/B1-B3 benignos); 1 gap do guard fechado (classe NOT_FOUND
  rejeitava USING benigno); suíte 163; produto intocado; 6 actors preservados; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2-R2-R3.1 EXECUTADA — AGUARDA REAUDITORIA YALA FINAL LIMITADA. N2-D.2-R2 ainda sem
  SELO COMPLETO; N2-D.2 geral permanece SELO COM RESSALVA. N2-D.3/PORTA/N2-E/N3 trancadas; Social/Bank fora.

### 2026-07-11 (58) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R2-R3 — liveness do tenant check no revoke (guard-only, aguarda reauditoria Yala final)
- Auditoria da R2 (`a7aef8107`): SELO COM RESSALVA de durabilidade do guard — o guard só verificava a
  PRESENÇA textual do tenant check no fn_revoke; evasão: `false AND`/`IF false THEN` torna a checagem
  inalcançável e o guard passava. Correção **guard-only** (`6b9757496`); produto R2 byte-intocado.
- Guard reescrito: extração NOMINAL brace-aware; LIVENESS do tenant check (branch alcançável, sem
  lógica-morta, IS DISTINCT FROM, erro NOT_FOUND não-vazante, antes do UPDATE); R3-B exige os 5 papéis
  nominais no ARRAY do fn_grant (incl. p_executed_by_actor_id) como elementos reais. Anti-sobreajuste
  (parênteses/quebra de linha/ordem/comentário). NÃO alterou produto (reordenação tenant-antes-de-scope
  não feita; observação territorial fora do escopo).
- Provas: guard PASS no código real; mutations 27/27 (G1-G24 + as 2 evasões originais obrigatórias +
  4 benignos); 2 gaps do próprio guard fechados; suíte 163; produto intocado; 6 actors preservados;
  HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2-R2-R3 EXECUTADA — AGUARDA REAUDITORIA YALA FINAL LIMITADA. N2-D.2-R2 ainda sem SELO
  COMPLETO; N2-D.2 geral permanece SELO COM RESSALVA. N2-D.3/PORTA/N2-E/N3 trancadas; Social/Bank fora.

### 2026-07-11 (57) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R2 — coerência tenant×Actors nos grants (aguarda Yala)
- Última ressalva da N2-D.2 (base selo R1 `5a3db1df6`): FKs são actors(id) sem tenant → fn_grant/fn_revoke
  aceitavam Actor de outro tenant (provado no GATE R0). Material único `a7aef8107`. Barreira DENTRO das
  funções SECURITY DEFINER (app tem EXECUTE); service = defesa antecipada.
- migration 20260711190000: helper fn_assert_actors_in_tenant (tenant EXATO, dedup+ORDER BY id+FOR SHARE,
  ACTOR_TENANT_MISMATCH não-vazante, sem EXECUTE app/PUBLIC); fn_grant valida os 5 actors ANTES do INSERT;
  fn_revoke com assinatura ANTIGA DROPADA + nova exige p_expected_tenant_id (cross-tenant→NOT_FOUND
  não-vazante; territory→scope mismatch); fn_expire/fn_regrant intocadas; tabelas/keys/matriz intocados.
- repository.revoke passa tenant (6 args); service prevalida grantee tenant-scoped. Guard novo (162→163);
  guard D.2 não precisou ajuste (valida a migration D.2, inalterada).
- Provas: rollback residue-0; fn_grant T1-T9 + fn_revoke T11-T16 (nome exato do erro); **T8/T17 chamada
  DIRETA como unificard_app negada** (service não é a única barreira); **§10 lock FOR SHARE provado com 2
  conexões** (UPDATE concorrente de actor lockado bloqueia); mutations 27/27 (3 gaps reais do guard
  fechados); typecheck 0; suíte 163; 6 actors preservados; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2-R2 EXECUTADA — AGUARDA AUDITORIA YALA. Fecha a última ressalva; N2-D.2 geral NÃO
  promovida antes da Yala. N2-D.3/PORTA/N2-E/N3 trancadas; grants territoriais=0; Social/Bank fora.

### 2026-07-11 (56) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R1+R1-FIX+R4 SELADAS PELA YALA (SELO COMPLETO)
- Cadeia: base D.2 `00aa2aa66` → R1 material `fb15000ff`/docs `f62fb82a6` (1ª auditoria: SELO COM
  RESSALVA — global_user_id não validado no early-existing) → R1-FIX material `f7146ff12`/docs
  `ef08bbbcf` (helper único nos 3 caminhos; reauditoria: SELO COM RESSALVA — durabilidade do guard,
  evasão composta helperCalls>=3 gameável) → R4 guard-only `1297f01d2`/docs `319116324` (prova
  branch-local dos 6 ramos; reauditoria final: **SELO COMPLETO**). Todas read-only; zero alteração
  material pela Yala.
- Selado: uq_actors_user (tenant_id,user_id) WHERE actor_type='user'; findByUserId fail-closed sem
  LIMIT 1/ORDER BY; writers idempotentes (ON CONFLICT DO NOTHING no alvo exato, nunca DO UPDATE);
  helper assertCanonicalUserActorAnchor validando os 4 campos nos 6 ramos (existing/insert-returning/
  race-loser × 2 writers), cada um com janela BRANCH-LOCAL própria — contagem global deixou de ser
  prova vinculante.
- Evasões Z1-Z4 seladas como fechadas; O-R4 (if((existing)) pode recusar) = observação não-bloqueante,
  fail-closed, sem ação agora. Correção do harness: "fixtures committadas" era impreciso — harness tsx
  ad hoc, não versionado; proteção durável = o guard.
- **STATUS:** N2-D.2-R1+R1-FIX+R4 SELADAS PELA YALA · SELO COMPLETO. **N2-D.2 geral permanece SELO COM
  RESSALVA (R2 aberta). N2-D.2-R2 autorizada como próxima microfatia possível, NÃO iniciada**
  (coerência tenant×Actors em fn_grant/fn_revoke). N2-D.3/PORTA-TERRITORY-1/N2-E/N2-F/N2-G/N3
  trancadas; grants/eventos=0; Social/Bank fora; Δbank=0.

### 2026-07-11 (55) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R1-FIX-R4 — durabilidade branch-local do guard (aguarda reauditoria Yala final limitada)
- Reauditoria da R1-FIX (`f7146ff12`): SELO COM RESSALVA de durabilidade do guard. Evasão composta:
  `helperCalls>=3` (contagem global) era gameável — remover o helper do race-loser + duplicar no
  existing mantinha 3 e o guard passava. Correção **guard-only** (`1297f01d2`); actor.repository.ts
  byte-intocado (git diff vazio).
- Guard reescrito: extração BRACE-AWARE dos corpos; prova BRANCH-LOCAL dos 6 ramos (existing/insert-
  returning/race-loser × 2 writers) — cada `return <Actor>` exige helper na MESMA janela sobre a mesma
  expressão retornada, antes do return; race-loser exige reselect+cardinalidade. helperCalls>=3
  removido como prova principal. Anti-sobreajuste (tolera renome/temp var/comentário/whitespace).
- Provas: typecheck 0; **mutations 19/19** incluindo evasões Z1-Z3 obrigatórias (agora MORDEM),
  P1-P11 branch-local, H/DO UPDATE/Authority, 3 benignos PASS; suíte 162 (sem novo guard); repo
  intocado; 6 actors preservados; HOLDs 501 intactos; Δbank=0.
- **Correção documental append-only:** "fixtures committadas" (entrada 54) foi imprecisa — o harness
  tsx foi ad hoc, chamou o repository real, NÃO entrou no commit material; a proteção durável
  versionada é o guard, endurecido nesta R4.
- **STATUS:** N2-D.2-R1-FIX-R4 EXECUTADA — AGUARDA REAUDITORIA YALA FINAL LIMITADA. N2-D.2-R1 ainda
  sem SELO COMPLETO; R2 trancada até selo da R1; N2-D.3/PORTA/N2-E/N3 trancadas.

### 2026-07-11 (54) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R1-FIX — cobertura total da âncora canônica (aguarda reauditoria Yala limitada)
- Reauditoria da N2-D.2-R1 (`fb15000ff`): SELO COM RESSALVA — o caminho inicial "Actor já existe"
  retornava sem validar global_user_id (só a corrida perdida validava). Material `f7146ff12`; sem
  migration nova; zero Authority/grants.
- Helper único assertCanonicalUserActorAnchor: pós-condição compartilhada, comparações explícitas
  (===/!==) de actor_type/tenant_id/user_id/global_user_id + actor_id=id; fail-closed
  ACTOR_USER_CANONICAL_ANCHOR_CONFLICT (nunca corrige/funde/recria). Os 2 writers carregam o
  global_user_id canônico ANTES do reuso e validam nos 3 caminhos (existing/criado/corrida). findByUserId
  intocado; cardinalidade LIMIT 2 preservada no reselect.
- Guard endurecido: prova helper (4 campos + fail-closed + sem comparação frouxa) + ≥3 chamadas por
  writer + morde early-return/insert-returning sem validação.
- Provas runtime pelo repository real (tsx): T1-T5 (existing compatível/incompatível fail-closed nos 2
  writers + corrida real); 6 actors restaurados; mutations 13/13; typecheck 0; suíte 162; HOLDs 501
  intactos; Δbank=0.
- **STATUS:** N2-D.2-R1-FIX EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-D.2-R1 ainda sem SELO
  COMPLETO; R2 trancada até selo da R1; N2-D.3/PORTA/N2-E/N3 trancadas.

### 2026-07-11 (53) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2-R1 — unicidade canônica do Actor user (aguarda Yala)
- GATE N2-D.2-R0 (read-only) ratificou Opção A em 2 microfatias (R1 Actors SSOT · R2 Authority). Esta é
  a R1. Material único `fb15000ff` (base `00aa2aa66`); zero Authority/grants tocados.
- migration 20260711180000: UNIQUE parcial uq_actors_user (tenant_id, user_id) WHERE actor_type='user'
  AND ambos NOT NULL — barreira FÍSICA positiva (espelha uq_actors_company_page/uq_actors_group). Zero
  duplicidades no vivo; sem limpeza/merge; user_id NULL fora; mesmo user em tenants distintos permitido.
- findByUserId fail-closed (busca 2 rows; >1→ACTOR_USER_ANCHOR_AMBIGUOUS; sem LIMIT 1/ORDER BY). Os 2
  writers (findOrCreateUserActor + Tx) idempotentes sob corrida: ON CONFLICT DO NOTHING no alvo EXATO +
  reselect + conferência de global_user_id (ACTOR_USER_CANONICAL_ANCHOR_CONFLICT); sem DO UPDATE/reinsert.
- Guard novo (suíte 161→162). Provas: rollback residue-0; T1–T20 DB (nome exato da constraint); **T14
  CORRIDA REAL com 2 conexões + barreira advisory lock → count=1/mesmo Actor/1 vencedor/tx válidas**;
  17 mutations + 3 benignos (20/20, 1 gap real do guard fechado: conferência de identidade explícita);
  typecheck 0; suíte 162; 6 actors vivos preservados; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2-R1 EXECUTADA — AGUARDA AUDITORIA YALA. Fecha SÓ a R1; **R2 (coerência tenant×Actors
  nas funções de grants) permanece ABERTA**; N2-D.2 NÃO promovida a SELO COMPLETO. Observações não-
  bloqueantes O1/O2/O3 registradas, não tocadas. N2-D.2-R2/D.3/PORTA/N2-E/N3 trancadas.

### 2026-07-11 (52) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2 — keys + matriz scope-aware + lifecycle append-only (aguarda Yala)
- Material único `4f09b2e35` (base `d74a5e84f`): 12 keys exatas na existência (6 actor + 6 territory);
  chk_acg_scope_capability_matrix NOVO fecha combinação cruzada (sem prefixo/wildcard); revoke_reason
  separado de reason (nunca sobrescrito); grant imutável pós-criação, DELETE fisico proibido.
- actor_capability_grant_events (molde actor_delegation_events): snapshot validado contra o grant pai,
  append-only, cardinalidade 1-granted + no máx 1 terminal (revoked|expired mutuamente exclusivos).
- 4 funções canônicas SECURITY DEFINER (search_path pinado): fn_grant/fn_revoke públicas actor-only;
  fn_expire/fn_regrant INTERNAS sem rota — regrant DERIVA grantee/key/scope do antigo (prova
  estrutural, sem parâmetro pra divergir); sem ON CONFLICT.
- **Achado do read-first:** default privilege de schema auto-concede EXECUTE/CRUD a unificard_app em
  toda função/tabela NOVA — exigiu REVOKE explícito de unificard_app (não só PUBLIC) nas 2 funções
  internas. Fronteira de escrita fechada: app perde INSERT/UPDATE/DELETE diretos em grants.
- Tri-registry sincronizado (permission-keys.ts + types.ts + CHECK); intersection(actor,territory)=∅,
  union⊆permission-keys provados pelo guard novo (suíte 160→161). Ajuste consciente mínimo do guard
  D.1 (janela nominal de 5 arquivos autorizados).
- Provas: rollback residue-0; T1–T48 DB (matriz/create/revoke/expire/regrant/imutabilidade/ACL via SET
  LOCAL ROLE); 42/42 mutations+controles; typecheck 0; suíte 161; 9 guards de neighborhood+authority
  PASS; 0 grants/0 eventos vivos; dois HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-D.2 EXECUTADA — AGUARDA AUDITORIA YALA. Zero hasTerritorialCapability (D.3)/rota
  territorial/PORTA-TERRITORY-1/grant real/writer de bairro; canRepresentActor puro.

### 2026-07-11 (51) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.1+D.1-R SELADAS PELA YALA (SELO COMPLETO)
- Cadeia: base `e03790d9e` → material D.1 `6f5df7d7d`/`180e1d0c9` (auditoria: SELO COM RESSALVA
  exclusivamente documental, material sólido) → ADENDO D3 `0f218b90b` (matriz scope×capability) →
  reauditoria final: **SELO COMPLETO**. 4 auditorias read-only; zero alteração material pela Yala.
- Material selado: actor_capability_grants casa única; scope_type actor|territory; scope_city_id FK
  real cities RESTRICT; 6 shapes inválidos fail-closed; anti-suspended territorial NASCEU na D.1
  (D.2 só protege); 2 casas de unicidade (actor com tenant; territory sem tenant/now(), colisão
  active-vencido intencional).
- Matriz selada: permission-keys.ts=existência, matriz=onde a key forma grant válido; actor set
  permanece actor-only (inventário na D.2); territory set = as 6 keys territory:*; tabela-verdade
  fechada; prefix inference proibida.
- Obrigação vinculante da D.2: 6 keys+matriz+lifecycle+reason/revoke_reason+revoke+explicit-expire+
  regrant+legado ENTREGUES JUNTOS (sem estado intermediário permissivo); guard prova union⊆
  permission-keys ∧ intersection=∅.
- **STATUS:** N2-D.1+D.1-R SELADAS PELA YALA · SELO COMPLETO. **N2-D.2 autorizada como próxima fatia
  material possível, NÃO iniciada.** D.3/PORTA-TERRITORY-1 trancadas; N2-E bloqueada por
  neighborhoods.name+reuso predecessor+ciclos+authority completa; N3/N2-F/N2-G trancadas; 0 territory
  rows/0 keys territoriais vivo; Social/Bank fora; Δbank=0.

### 2026-07-11 (50) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.1-R — adendo D3: matriz scope×capability (aguarda reauditoria Yala limitada)
- Auditoria Yala da N2-D.1 (`6f5df7d7d`/`180e1d0c9`): **🟡 SELO COM RESSALVA exclusivamente documental**
  — material sólido, nenhuma migration corretiva. Ressalva: CHECK plano de capability_key permitiria
  combinações cruzadas ao ganhar as 6 keys territoriais. ADENDO D3 append-only à DECISION-0173.
- D3 crava: permission-keys.ts = SSOT de EXISTÊNCIA; matriz scope×capability = onde a key pode formar
  grant válido (não é 2º registry). Conjunto vivo pré-D.2 permanece actor-only; SÓ as 6 territory:*
  formam grant territory; nenhuma key nos 2 conjuntos; matriz FECHADA (6 combinações; prefix inference
  PROIBIDA — conjuntos exatos). D.2 materializa CHECK físico scope-aware no MESMO commit das 6 keys
  (lista plana não basta); TS com 2 conjuntos explícitos (união plana só derivação); guard prova
  union⊆permission-keys e intersection=∅ e morde 15 vetores. Zero grant antes da matriz — capacidade
  estrutural da D.1 ≠ autorização operacional.
- Correção documental (D3.9): "COMMIT→ROLLBACK" superada — correto: ensaio descartável BEGIN→corpo→
  inspeção→ROLLBACK (zero resíduo) + aplicação definitiva pelo runner (COMMIT único). Históricos
  preservados.
- **STATUS:** N2-D.1-R EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-D.1 sólida SEM selo completo.
  D.2 trancada até selo; D.3/PORTA-TERRITORY-1/N2-E/N3 trancadas; 0 territory rows vivo; Δbank=0.

### 2026-07-11 (49) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.1 — eixo territorial city-scoped em actor_capability_grants (aguarda Yala)
- Material `6f5df7d7d` (base selo `e03790d9e`): migration 20260711160000 evolui a casa canônica —
  scope_type='actor'|'territory'; scope_city_id UUID FK real cities(city_id) RESTRICT; tenant_id/
  scope_actor_id nullable condicionados; CHECK fechado de shape (6 formatos inválidos falham,
  tabela-verdade auto-provada); **CHECK anti-suspended territorial NASCE nesta fatia (D2.1)**;
  duas casas de unicidade parciais (actor COM tenant, mesmo nome preservado p/ mapeamento 409;
  territory SEM tenant/now() — colisão de active-vencido intencional, D2.4). Zero TS de produto.
- Guard novo `audit-territorial-capability-grant-foundation.mjs` (suíte 159→160). Read-first provou
  que o guard nonfinancial valida a migration ORIGINAL (intocada) ⇒ zero ajuste em guards existentes.
- Provas: rollback residue-0; T1–T18 em transação c/ rollback integral validando o NOME da constraint
  (shape/FK/anti-suspended/unicidades); T19=0 rows pré-existentes (honesto); T20 owner/ACL/RLS iguais;
  **44 mutations mordem + 5 benignos (49/49**, stripComments 2 direções); 2 falsos positivos do próprio
  guard corrigidos antes do commit; typecheck 0; suíte 160; 3 guards authority + 5 neighborhood PASS;
  HOLDs 501 intactos; CANONICAL_WRITER_ALLOW vazia; Δbank=0. Sem HOLD físico territorial novo
  (nenhum decidido — registro honesto).
- **STATUS:** N2-D.1 EXECUTADA — AGUARDA AUDITORIA YALA. Zero key territory:*/grant/lifecycle/resolver/
  enforcement; canRepresentActor puro. N2-D.2/D.3/PORTA-TERRITORY-1 trancadas; N2-E/N3 trancadas;
  grant Curitiba inexistente; writer/bairros inexistentes.

### 2026-07-11 (48) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.0+D1+D2 SELADAS PELA YALA (SELO COMPLETO)
- Cadeia: N2-C `fc539abcd` → N2-D.0 `4f2bbdb2c` (1ª auditoria: SELO COM RESSALVA) → ADENDO D1
  `2118370dd` (reauditoria: SELO COM RESSALVA, 2 lacunas de redação, sem falha material) → ADENDO D2
  `c88b18c75` (reauditoria final: **SELO COMPLETO**). 3 auditorias read-only; zero authority criada.
- Modelo selado: actor_capability_grants segue casa canônica (sem 2ª tabela); permission-keys.ts =
  registry das keys; canRepresentActor puro; composição N2-E de 8 elos fail-closed.
- Shape territorial selado: actor-scoped (tenant+scope_actor NOT NULL/city NULL) vs. territory-scoped
  (tenant NULL/scope_actor NULL/scope_city_id NOT NULL FK cities+efeito global explícito); tenant
  institucional rejeitado; MVP city-only (Curitiba).
- 6 keys territory:{create,approve,correct,deactivate,manage_neighborhood_aliases,
  register_neighborhood_succession} seladas (match exato, criar≠aprovar, zero financeiro,
  sincronização só em D.2). Maker-checker opção C.
- suspended territorial proibido — N2-D.1 cria o CHECK físico territory⇒status<>'suspended' (D.2 só
  protege). Expiração/regrant: active-vencido continua ocupando a unicidade parcial; regrant exige
  emissor governado atômico (expire+evento → só então novo grant+evento). Índice territorial sem
  tenant_id/sem now() no predicado. reason=concessão vs revoke_reason separado; lifecycle append-only.
  5 elos persistidos pelo N2-E.
- **STATUS:** N2-D.0+D1+D2 SELADAS PELA YALA · SELO COMPLETO. **N2-D.1 autorizada como próxima fatia
  material possível, NÃO iniciada** (scope territorial+CHECKs shape+CHECK anti-suspended+índices
  parciais+guard, zero key/lifecycle/grant/enforcement). D.2/D.3/PORTA-TERRITORY-1 trancadas; N2-E
  bloqueada por neighborhoods.name+reuso predecessor+ciclos+authority completa; N3/N2-F/N2-G trancadas;
  Social/Bank fora. Δbank=0.

### 2026-07-11 (47) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.0-R2 — adendo D2 da DECISION-0173 (aguarda reauditoria Yala final limitada)
- Reauditoria Yala do D1 (`2118370dd`): **🟡 SELO COM RESSALVA** — 2 lacunas de redação, sem falha
  material (R1 dono da constraint suspended; R2 fluxo active-vencido→regrant). Adendo D2 append-only,
  complementa D1 SÓ nesses 2 pontos; §§0-13 e resto de D1 intocados.
- **R1 encerrada:** N2-D.1 (não "D.1 ou D.2") cria o CHECK físico `territory⇒status<>'suspended'` no
  MESMO commit que introduz scope_type='territory'; migration prova shapes inválidos; guard da D.1
  valida presença+forma. D.2 só protege a constraint (drop/enfraquecimento), não a cria.
- **R2 encerrada:** grant active+valid_until vencido NÃO autoriza mas continua ocupando a unicidade
  parcial — não pode ser sobrescrito/reciclado. Regrant exige emissor governado: localizar→confirmar→
  status='expired'+evento expired (mesma transação, sem commit parcial)→SÓ ENTÃO nova row active+evento
  granted (mesma transação). Proibido UPDATE sem evento, reciclar valid_until, ON CONFLICT, evento
  retroativo falso. Emissor de expired = operação canônica da N2-D.2, sem rota pública, ainda não
  implementada. Índice territorial reafirmado sem tenant_id/sem now() no predicado.
- **STATUS:** N2-D.0-R2 EXECUTADA — AGUARDA REAUDITORIA YALA FINAL LIMITADA. N2-D.1 trancada até SELO
  COMPLETO; D.2/D.3/PORTA-TERRITORY-1/N2-E/N3 e saneamento de neighborhoods.name bloqueados; Social/Bank fora.

### 2026-07-11 (46) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.0-R — adendo D1 da DECISION-0173 (aguarda reauditoria Yala limitada)
- Auditoria Yala da N2-D.0 (`4f2bbdb2c`): **🟡 SELO COM RESSALVA** — arquitetura principal aprovada
  (casa/keys/Curitiba/AND/PORTA); ressalvas só de lifecycle e tenant/global. Adendo D1 append-only à
  DECISION-0173, docs-only, sem tocar código/grant.
- D1.1 **suspended proibido p/ grants territoriais no MVP (Opção B)** — actor-scoped mantém lifecycle;
  territory sem suspended/resumed/reactivated; invariante física `territory ⇒ status<>'suspended'` =
  obrigação D.1/D.2; primitivo D.3 nega status≠active.
- D1.2 expiração: `valid_until<=now()` = ineficaz imediato no resolver fail-closed (sem UPDATE/job);
  status/evento `expired` só com emissor governado (nenhum autorizado); transição futura = estado+evento
  na mesma transação.
- D1.3 atomicidade estado+evento append-only numa transação (granted/revoked/expired); proibido UPDATE
  sem evento/commit parcial/best-effort/evento assíncrono como única trilha/editar histórico.
- D1.4 reason=concessão; revoke_reason separado; read-first de legado obrigatório antes da D.2 (sem
  fabricar histórico; motivo irrecuperável = preservar valor + registrar limitação).
- D1.5 **tenant_id NULL não é só coluna:** shape (actor tenant+scope_actor / territory city NOT NULL);
  unicidade parcial territorial independente de tenant `(grantee,key,scope_city_id) WHERE territory AND
  active`; repository/types tipados separados; queries territoriais nunca usam tenant da request/COALESCE/
  `tenant=$t OR NULL`; grant global não torna Actor/user/sessão globais; canRepresentActor recebe tenant real.
- D1.6 trilha registra ≥ grant_id/event_type/grantee/key/scope/user_id executor/Actor concedente-revogador/
  humano/motivo/occurred_at/snapshot. D1.7 fatias D.1/D.2/D.3 refinadas; PORTA trancada até selo integral.
- **STATUS:** N2-D.0-R EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-D.1 trancada até SELO COMPLETO;
  D.2/D.3/PORTA-TERRITORY-1/N2-E/N3 e saneamento de neighborhoods.name bloqueados; Social/Bank fora.

### 2026-07-11 (45) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D GATE + N2-D.0 DECISION-0173 (autoridade territorial, aguarda Yala)
- GATE N2-D read-first (HEAD `fc539abcd`, read-only, zero material) → aprovado com 4 ajustes
  vinculantes → **DECISION-0173** docs-only (`docs/02_decisions/DECISION_0173_NEIGHBORHOOD_
  TERRITORIAL_AUTHORITY.md`). Nenhuma capability/grant/key/enforcement/writer criado.
- Substrato: 2 eixos separados — `canRepresentActor` (authorization.service.ts:335) = representação
  pura; `actor_capability_grants` (DECISION-0136) = casa canônica de capability, hoje
  `scope_type='actor'` travado por CHECK, primitivo `hasCapabilityGrant` quarentenado (não wired).
  Registry SSOT das keys = permission-keys.ts. NENHUMA capability territorial existe.
- Defeito vivo comprovado: `repository.revoke` (`reason=COALESCE($4, reason)`) sobrescreve o motivo
  da concessão com o da revogação — sintoma da falta de trilha append-only na casa de capability.
- DECISION-0173 crava (docs-only): evoluir a casa (`scope_type='actor'|'territory'`, canRepresentActor
  puro); tenant/global (actor-grant tenant+scope_actor NOT NULL/city NULL; territorial-grant tenant NULL/
  scope_actor NULL/scope_city_id NOT NULL FK cities + efeito global explícito; **tenant institucional
  REJEITADO**); MVP = SÓ city_id (Curitiba); 6 keys `territory:*` (match exato, criar≠aprovar, zero
  financeiro, sem "propor", sem 7ª key de admin de grants; sincronizadas nos 3 registros só em D.2);
  maker-checker opção C; **PORTA-TERRITORY-1** = bootstrap soberano separado (só após selo N2-D, sem
  super_admin fallback); reason da concessão vs. revogação + trilha append-only (molde
  actor_delegation_events); AND de 8 elos fail-closed no N2-E; 5 elos persistidos pelo N2-E (N2-D só faz
  o primitivo devolver grant_id).
- Sequência: N2-D.1 (scope territorial + CHECKs de shape + guard, zero key/grant) → N2-D.2 (6 keys nos
  3 registros + trilha + correção reason) → N2-D.3 (`hasTerritorialCapability` retorna grant_id, sem
  wiring) → PORTA-TERRITORY-1. Todas TRANCADAS até selo desta N2-D.0.
- **STATUS:** N2-D GATE CONCLUÍDO · N2-D.0 DECIDIDA/PROMULGADA — AGUARDA AUDITORIA YALA. N2-D.1/D.2/D.3
  e PORTA-TERRITORY-1 trancadas; N2-E/N3 e saneamento de neighborhoods.name bloqueados; Social/Bank fora.

### 2026-07-11 (44) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-C SELADA PELA YALA (SELO COMPLETO)
- Cadeia: base N2-B/B.1 `c93acce50` → N2-C fundação de sucessão `62cbeae24`/`e0f7ab486` →
  auditoria material read-only → **SELO COMPLETO**.
- 3 tabelas N:N same-city (events/sources/targets) aprovadas como fundação canônica de linhagem;
  `neighborhood_id` continua SSOT territorial; sucessão não cria identidade. Cardinalidade deferred
  (division 1→N, merger N→1, reorganization N→N >1 num lado, extinction N→0) + append-only + HOLD/
  ACL aprovados. PT↔EN ratificado: division=divisão, merger=fusão, reorganization=reorganização,
  extinction=extinção (split/merge eram só inglês informal de read-first).
- T1–T35 + C1–C40 + 159 guards aprovados; 3 bugs materiais (CASE NEW.id/event_id via to_jsonb;
  search_path→public.*; lacunas do guard fechadas pelas próprias mutations) registrados como
  corrigidos ANTES do commit, não como ressalvas abertas.
- **3 travas vinculantes pré-N2-E registradas (classificação A, sem nova DT):** (1) reuso de
  predecessor — banco permite hoje, decisão formal obrigatória antes do writer (Opção A proibir vs.
  Opção B permitir governado; nenhuma UNIQUE criada agora); (2) ciclos/temporalidade — banco não
  impede nesta fundação, writer deverá detectar ciclo direto/indireto, source já sucedido, eventos
  conflitantes, datas incoerentes; (3) whitespace de `neighborhoods.name` (herdada da N2-B).
  Nenhuma bloqueia N2-C ou o GATE N2-D; todas bloqueiam N2-E; nome do núcleo também bloqueia N3.
- **STATUS:** N2-C SELADA PELA YALA · SELO COMPLETO. **GATE N2-D autorizado como próxima ação
  possível, ainda NÃO iniciado** (read-first de authority, não migration). N2-E bloqueada pelas 4
  travas (whitespace + reuso + ciclos + authority N2-D). N3 bloqueada por writer/authority/nome do
  núcleo/N2-F. Social/Bank fora.

### 2026-07-11 (43) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-C — fundação de sucessão N:N append-only (registro pré-selo, superado pelo selo acima)
- Material `62cbeae24` (DECISION-0171 §9): 3 tabelas GLOBAIS de linhagem territorial —
  neighborhood_succession_events + _sources + _targets; FKs compostas same-city (cross-city
  impossível); cardinalidade governada por CONSTRAINT TRIGGER DEFERRABLE (division 1→N, merger N→1,
  reorganization N→N com >1 num lado, extinction N→0; 1→1 e self-reference proibidos); append-only
  permanente; HOLD I/U/D STATEMENT ENABLE ALWAYS + ACL SELECT-only (REVOKE ALL app+PUBLIC); zero
  efeito automático sobre neighborhoods/addresses (sucessão é linhagem, não reescreve FK).
- Guard novo `audit-neighborhood-succession-foundation.mjs` (suíte 158→159) + ajuste consciente do
  core guard (C_MIG exceção nominal; padrão success\w*).
- Provas: rollback residue-0; **3 bugs reais achados e corrigidos** (CASE NEW.id/event_id via
  to_jsonb; search_path pinado escondia public.* → qualificado; 2 lacunas do guard); DB T1–T35 em
  transações isoladas (deferred exige SET CONSTRAINTS ALL IMMEDIATE, não ROLLBACK TO SAVEPOINT);
  mutation C1–C40 todas mordem (4 lacunas do guard achadas pelas mutations e corrigidas: RLS/
  cardinalidade division+extinction/auto-efeito em migration posterior); benignos + stripComments 2
  direções; typecheck 0; suíte 159; 5 guards; readers vazios; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-C EXECUTADA — AGUARDA AUDITORIA YALA. N2-D exige GATE próprio; N2-E/N3 bloqueadas
  pelo saneamento de neighborhoods.name; N2-F/N2-G trancadas.

### 2026-07-11 (42) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-B + N2-B.1 SELADAS PELA YALA (SELO COMPLETO)
- Cadeia: base N2-A/A.1 `2428e92d5` → N2-B `eb8615815`/`990718d7e` → 1ª auditoria SELO COM
  RESSALVA (R1 whitespace de borda; R2 guard sem TRUNCATE/ownership) → saneamento `c66f91892`/
  `4e9a4740c` → reauditoria limitada **SELO COMPLETO**.
- R1 ENCERRADA: CHECK `chk_neighborhood_aliases_alias_no_edge_whitespace` aprovado; bordas ASCII
  clássicas + NBSP/em-space rejeitadas (observado, não garantido universal); caixa/acento
  deduplicados no mesmo bairro (23505); colisão entre bairros permanece ambiguidade legítima
  (mesmo alias em outro bairro = permitido; consulta ambígua = 2 candidatos sem vencedor).
- R2 ENCERRADA: guard morde `GRANT TRUNCATE/ALL[ PRIVILEGES]/ON ALL TABLES` e
  `ALTER TABLE...OWNER TO` (qualquer grantee). H16 confirmado como mutação de DDL real (não string
  artificial). H1-H16 + regressão B 11/11 sem regressão.
- **Observação vinculante do núcleo (classificação A, sem nova DT):** `normalize_name` também não
  faz trim em `neighborhoods.name` — não invalida N2-A, não bloqueia N2-B/N2-C, mas **BLOQUEIA
  N2-E e N3** até saneamento forward-only próprio (CHECK de borda em `neighborhoods.name`, sem
  alterar `normalize_name()`, com hardening do core guard e nova auditoria) ANTES do writer e do
  seed de Curitiba.
- **STATUS:** N2-B + N2-B.1 SELADAS PELA YALA · SELO COMPLETO. Ressalvas R1/R2 ENCERRADAS.
  **Próximo autorizado, NÃO iniciado:** N2-C (sucessão N:N), GO próprio. N2-D exige GATE próprio.
  **N2-E e N3 travadas pelo saneamento pendente de `neighborhoods.name`** (trava independente e
  obrigatória, além da authority N2-D e da coerência N2-F). Social/Bank fora.

### 2026-07-11 (41) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-B.1 — CHECK de borda + guard TRUNCATE/ownership (aguarda reauditoria)
- Yala deu SELO COM RESSALVA à N2-B (não reprovação; estado vivo seguro): R1 `normalize_name()` não
  faz trim de borda (provado: `normalize_name(' Centro ')<>normalize_name('Centro')`); R2 guard não
  mordia `GRANT TRUNCATE`/troca de ownership. Direção: N2-C trancada até SELO COMPLETO da N2-B.
  `normalize_name()` NÃO alterada (helper único do Location Core); correção fica na coluna alias.
- **Material `c66f91892`:** migration forward-only `20260711140000_neighborhood_aliases_hardening.sql`
  — CHECK `chk_neighborhood_aliases_alias_no_edge_whitespace` (protege início E fim, coexiste com o
  nonempty existente); observação registrada sobre `neighborhoods.name_normalized` ter o mesmo gap
  (não corrigido aqui, decisão própria antes do N2-E). Guard endurecido: valida a B1 + morde
  `GRANT TRUNCATE/ALL[ PRIVILEGES]/ON ALL TABLES` e `ALTER TABLE...OWNER TO` (qualquer grantee) +
  recriação fraca do CHECK.
- Provas: E1–E17 (bordas rejeitadas nos 2 lados, conteúdo/espaços internos aceitos, duplicata
  caixa/acento mesmo bairro=23505, mesmo alias outro bairro=sucesso, ambíguo=2 candidatos) + **bônus:
  NBSP/em-space também rejeitados no locale vivo** (observado, não garantido universal); privilégios
  (app SELECT-only, TRUNCATE/OWNER negados; admin bloqueado pelo HOLD; owner=postgres; zero PUBLIC);
  mutation H1–H16 16/16 + 3 benignos PASS; regressão B 11/11 sem regressão; typecheck 0; suíte 158
  (guard existente endurecido, sem novo); 4 guards irmãos PASS; catálogos 0/0; HOLDs 501 intactos;
  Δbank=0.
- **STATUS:** N2-B.1 EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-C…N2-G e N3 TRANCADAS.

### 2026-07-11 (40) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-B — fundação de aliases (aguarda Yala)
- Material `eb8615815` (DECISION-0171 §8 + 0172 §2): tabela filha GLOBAL `neighborhood_aliases` —
  FK RESTRICT ao pai (SEM city_id redundante), alias_normalized GENERATED via normalize_name, CHECKs
  whitespace robustos, proveniência reusando o vocabulário do núcleo, autoria/aprovação FKs actors,
  is_active/vigência sem defaults, **UNIQUE PISO (neighborhood_id, alias_normalized)** sem UNIQUE
  global — colisão entre bairros = AMBIGUIDADE preservada (T15 sucesso, T16 = 2 candidatos sem
  vencedor); imutabilidade permanente (DELETE/id/pai/texto/creator/created_at); HOLD I/U/D STATEMENT
  ENABLE ALWAYS + ACL SELECT-only; contrato de rename documentado (não implementado).
- Guard novo `audit-neighborhood-alias-foundation.mjs` (suíte 157→158) + ajuste consciente do core
  guard (B_MIG = casa canônica nominal; **fechada a observação do selo N2-A**: count==1 da
  redefinição na A1, B32 morde).
- Provas: rollback residue-0; T1–T23; HOLD admin/app; mutation **B1–B32 todas mordem** (honestidade:
  3 lacunas do guard achadas pelas próprias mutations — NOT NULL/zero-default/seed-posterior —
  corrigidas e re-provadas + bônus B24n); benigno PASS; typecheck 0; suíte 158; 0/0 rows; HOLDs 501
  intactos; Δbank=0.
- **STATUS:** N2-B EXECUTADA — AGUARDA AUDITORIA YALA. N2-C…N2-G e N3 TRANCADAS.

### 2026-07-11 (39) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-A + N2-A.1 SELADAS PELA YALA (SELO COMPLETO)
- Cadeia: N2-pre `37e32924d` → N2-A `e361351d1`/`d97968b29` → 1ª auditoria SELO COM RESSALVA (R1
  btrim aceitava tab/newline-only; R2 guard não mordia DISABLE/ENABLE REPLICA da imutabilidade) →
  saneamento `38c32a65a`/`6698a92d9` → reauditoria limitada **SELO COMPLETO**.
- Aprovado definitivamente: núcleo (8 colunas, zero defaults, FKs actors RESTRICT, catálogo global);
  proveniência (3 kinds fechados, sem taxonomia paralela); imutabilidade permanente (5 bloqueios,
  FOR EACH ROW, tgenabled='O'); R1 encerrada (CHECKs `~'[^[:space:]]'`, provado com bateria de
  whitespace ASCII, sem prometer cobertura Unicode universal); R2 encerrada (guard morde
  DISABLE nomeado/ALL/USER + ENABLE REPLICA + DROP + redefinição fora da A1; ENABLE ALWAYS não
  bloqueado por ser fortalecimento); extinção reconciliada (vigência/desativação, sucessão só com
  relação real, N2-C); racional 'A' (HOLD)/'O' (imutabilidade) cravado, sem prometer imunidade a DDL
  admin.
- Observação não bloqueante registrada (sem DT): a A1 auditada tem uma única redefinição autorizada;
  o guard bloqueia redefinições em migrations POSTERIORES, mas não conta uma 2ª CREATE OR REPLACE
  hipotética dentro do próprio arquivo A1 (editar migration aplicada violaria forward-only — não é o
  ataque real a cobrir agora); endurecimento de contagem fica para a próxima toca consciente do
  guard, antes do N2-E.
- Estado vivo aprovado: CHECKs fortalecidos, função correta, imutabilidade='O', HOLD='A', ACL
  sel=t/demais=f, RLS=false, catálogo 0→0.
- **STATUS:** N2-A + N2-A.1 SELADAS PELA YALA · SELO COMPLETO. Ressalvas R1/R2 ENCERRADAS. Próximo
  autorizado, NÃO iniciado: **N2-B** (aliases subordinados ao mesmo neighborhood_id, sem 2ª
  identidade). N2-C…N2-G TRANCADAS; N2-D exige GATE próprio; N2-F selada antes do N3.

### 2026-07-11 (38) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-A.1 — saneamento das ressalvas Yala (aguarda reauditoria)
- Yala deu SELO COM RESSALVA à N2-A: R1 `btrim(col)<>''` aceita tab/newline-only (provado ao vivo);
  R2 guard não detectava DISABLE/ENABLE REPLICA do trigger permanente de imutabilidade. Notas N1
  (racional 'A' vs 'O') e N2 (extinção não exige sucessor). Direção: N2-B trancada até SELO COMPLETO;
  `tgenabled='O'` aceito como padrão permanente com racional documentado.
- **Material `38c32a65a`:** migration forward-only `20260711120000_neighborhoods_core_hardening.sql` —
  CHECKs recriados com mesmos nomes e `~ '[^[:space:]]'`; redefinição AUTORIZADA da função (lógica
  idêntica, só texto do DELETE: extinção usa vigência/desativação, sucessão só com relação real);
  racional 'A'/'O' documentado; fail-closed pré+pós com auto-prova estrutural. Guard: seção 1b valida
  a A1; morde DISABLE(nomeado/ALL/USER)/ENABLE REPLICA/DROP FUNCTION CASCADE/redefinição fora da A1/
  recriação fraca dos CHECKs; ENABLE ALWAYS não bloqueado (fortalecimento).
- Provas: W1–W10 (whitespace matrix nas 2 colunas) + X1–X10 re-executados (DELETE com mensagem
  corrigida) em BEGIN..ROLLBACK; mutation R1–R16 16/16 + regressão A 11 amostras + benigno; typecheck
  0; suíte 157; HOLD 'A'/immut 'O'/0 rows/ACL/HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-A.1 EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-B…N2-G e N3 TRANCADAS.

### 2026-07-11 (37) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-A — fundação do núcleo neighborhoods (aguarda Yala)
- Material `e361351d1` (DECISION-0171 + 0172 P4/P6): migration `20260711110000_neighborhoods_core_
  foundation.sql` — proveniência governada (source_kind CHECK fechado em 3 valores; source_reference/
  evidence NOT NULL nonempty p/ TODOS os kinds), autoria/aprovação (created_by/approved_by_actor_id FK
  REAL actors(id) RESTRICT; approved_at), vigência (valid_from_at/valid_until_at + CHECK until>from),
  ZERO defaults nas 8 colunas, imutabilidade PERMANENTE (DELETE/id/city/creator/created_at, erros
  estáveis NEIGHBORHOOD_IDENTITY_*, FOR EACH ROW), fail-closed pré+pós-ALTER, HOLD N2-pre intocado.
  Guard novo `audit-neighborhood-core-foundation.mjs` (suíte 156→157; 25 invariantes versionados +
  anti-enfraquecimento posterior).
- Provas: rollback residue-0 pré-aplicação; introspecção completa; testes DB em BEGIN..ROLLBACK (HOLD
  desabilitado só na transação): 23514/23503/erros estáveis/UPDATE name permitido/0 rows+HOLD 'A' pós;
  honestidade: created_at re-testado com timestamp diferente (now() é transaction-stable); readers
  vivos (list/lookup/validate honestos); mutation A1–A21 21/21 + benigno PASS; typecheck 0; suíte 157;
  HOLDs 501 intactos; Δbank=0.
- Limite registrado: read-models devem filtrar atividade/vigência ANTES do N3.
- **STATUS:** N2-A EXECUTADA — AGUARDA AUDITORIA YALA. N2-B…N2-G e N3 TRANCADAS.

### 2026-07-11 (36) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-pre SELADA PELA YALA (SELO COMPLETO)
- Cadeia auditada: N2-0 `438cd83d6` → material `66b5e6117` → cartório `e3975be8f` → 1ª auditoria SELO
  COM RESSALVA (guard sem G2/G3/G5/G8; PASS não distinguia Git de banco vivo) → hardening `5b9a511c9`
  → §0.1 `f3950da46` → correção cartorial `b4779f58b` → reauditoria limitada **SELO COMPLETO**.
- Aprovado definitivamente: função incondicional + trigger BEFORE I/U/D FOR EACH STATEMENT ENABLE
  ALWAYS + REVOKE (SELECT preservado); duas camadas independentes provadas (ACL para unificard_app,
  trigger para admin, incl. WHERE false); guard cobre G1–G10 completos + M1–M12 reexecutadas, todas
  mordem; stripComments provado nas 2 direções; promessa honesta (revival versionado no repo, não DDL
  admin direto — provado por introspecção); DECISION-0172 §0.1 confirmada correta; DT-DRIFT1
  reconfirmada CLOSED (sem DT nova, sem reabertura).
- Observações não bloqueantes registradas (sem DT): check de incondicionalidade é heurístico
  (compensado por introspecção viva); cabeçalho histórico OPEN da DT-DRIFT1 é só fotografia de
  2026-06-20, não alterado.
- Docs-only: DECISION-0172/guard/migration/banco intocados; CANONICAL_WRITER_ALLOW vazia; zero
  Social/Bank; HOLDs 501 preservados; Δbank=0.
- **STATUS:** N2-pre SELADA PELA YALA · SELO COMPLETO. **Próximo autorizado, NÃO iniciado:** N2-A
  (evolução aditiva do núcleo neighborhoods) com GO próprio. N2-B…N2-G e N3 seguem trancadas; N2-D
  exige GATE próprio; N2-F selada antes do N3.

### 2026-07-11 (35) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-pre.1a — correção cartorial (DT-DRIFT1 permanece CLOSED)
- O commit `f3950da46` (N2-pre.1) afirmou por engano que `DT-DRIFT1-RLS-HARDENING-OPS-ROLLOUT-PENDING`
  "segue OPEN / rollout ainda pendente". Erro: o rollout (LOGIN + DATABASE_URL→unificard_app + RLS-live
  DEV PASS) foi EXECUTADO por Clayton em 2026-06-24 e o cartório já a tratava como resolvida/fantasma.
- Correção docs-only: entrada N2-pre.1a + correção append-only das duas redações erradas (nota no corpo
  da DT + entrada N2-pre.1). Estado canônico vigente = **CLOSED**; entrada histórica OPEN (2026-06-20)
  permanece só como linhagem; nenhuma DT nova; nenhuma confirmação runtime/preflight pendente.
- DECISION-0172 §0.1 intocada e correta; guard `5b9a511c9` intocado; migration intocada; zero material;
  HOLDs 501 preservados; Δbank=0.
- **STATUS:** N2-pre.1a CORRIGIDA DOCS-ONLY — AGUARDA REAUDITORIA YALA LIMITADA. DT-DRIFT1 CLOSED.
  N2-A trancada.

### 2026-07-11 (34) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-pre.1 — hardening do guard do HOLD + reconciliação NOLOGIN (aguarda reauditoria Yala)
- Yala deu SELO COM RESSALVA à N2-pre: guard não cobria grant por coluna / a PUBLIC / ENABLE REPLICA /
  DROP FUNCTION CASCADE, e a promessa PASS não distinguia Git de banco vivo; além disso a 0172 dizia
  "unificard_app permanece NOLOGIN" apesar do rollout LOGIN previsto.
- **A (material `5b9a511c9`):** endurecido `audit-neighborhood-dml-hold.mjs` — morde G1 ALL PRIVILEGES,
  G2 grant por coluna, G3 grant a PUBLIC (DML a qualquer grantee, cobre G4 role+membership), G5 ENABLE
  REPLICA/DISABLE ALL|USER, G8 DROP FUNCTION [CASCADE], G10 ALL TABLES a unificard_app/PUBLIC; função
  exigida INCONDICIONAL (sem IF/CASE → mata G7/G9). PASS honesto: bloqueia revival VERSIONADO no repo,
  não DDL admin direto no banco (provado por introspecção).
- **B (docs-only):** DECISION-0172 §0.1 (adendo N2-0.1) — NOLOGIN é estado inicial, não invariante;
  requisito permanente = NOSUPERUSER/NOBYPASSRLS/sem-DDL/grants-mínimos/runtime-controlado; HOLD não
  depende de NOLOGIN. Pendência de rollout LOGIN atualizada na DT existente
  `DT-DRIFT1-RLS-HARDENING-OPS-ROLLOUT-PENDING` (sem DT nova).
- Provas: mutation G1–G10 morde; regressão M-sample morde; stripComments nas 2 direções; migration NÃO
  alterada; role NÃO alterada; introspecção viva inalterada (trigger 'A', app sel=t/ins=f/upd=f/del=f,
  0 rows); typecheck 0; suíte 156 OK; HOLDs 501 intactos; Δbank=0.
- **STATUS:** N2-pre.1 EXECUTADA — AGUARDA REAUDITORIA YALA LIMITADA. N2-A…N2-G e N3 TRANCADAS.

### 2026-07-11 (33) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-pre — HOLD físico de DML em neighborhoods (aguarda Yala)
- Material `66b5e6117` (DECISION-0172 P5): migration `20260711100000_neighborhoods_dml_hold.sql` —
  função `enforce_neighborhoods_canonical_writer_hold` (nega I/U/D incondicional, erro estável
  `NEIGHBORHOOD_CANONICAL_WRITER_HOLD`, sem bypass GUC/role) + trigger `trg_neighborhoods_canonical_
  writer_hold` BEFORE I/U/D **FOR EACH STATEMENT** + **ENABLE ALWAYS** + REVOKE I/U/D de
  `unificard_app` (SELECT preservado) + verificação fail-closed. Guard novo
  `audit-neighborhood-dml-hold.mjs` (suíte 155→156; entende ordem temporal grant-histórico→REVOKE→
  nenhuma reabertura posterior; parsing-failure=FAIL).
- Provas: DML como app role = permission denied (ACL) e como postgres = HOLD (incl. UPDATE/DELETE
  WHERE false — statement-level); readers vivos pelo caminho real (list=[]/lookup=null honestos);
  mutation 12/12 morde; typecheck 0; suíte 156 OK; 0 rows antes/depois; dois HOLDs 501 financeiros
  intactos; Δbank=0.
- Honestidade: `unificard_app` está com `rolcanlogin=t` no dev (criada NOLOGIN pela 20260620120000;
  LOGIN habilitado depois fora do repo) — REVOKE fica mais relevante; trigger segue sendo a barreira
  do runtime postgres; superuser deliberado ainda pode remover trigger via DDL (contenção completa =
  migration+guard+auditoria, como a 0172 P5 registra).
- **STATUS:** N2-pre EXECUTADA — AGUARDA AUDITORIA YALA. N2-A…N2-G e N3 TRANCADAS.

### 2026-07-11 (32) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-0/DECISION-0172 SELADA PELA YALA (SELO COMPLETO)
- Yala auditou a promulgação da DECISION-0172 (`1f056fd75`, sobre base N1/N1.1 selada `c8c9dfecc`).
  Veredito: **SELO COMPLETO** — P1–P6 coerentes; catálogo global preservado (tenant institucional
  rejeitado; FKs reais por nível exigidas); maker-checker MVP sem autoaprovação; HOLD físico
  corretamente definido como trigger (barreira real no dev com role superuser) + REVOKE (defesa p/
  runtime-alvo) + guard; is_active separado de vigência territorial; N2-F obrigatória antes do N3;
  authority antes do writer; guard só muda junto do writer.
- DECISION-0172 promovida a SELADA/SELO COMPLETO. **N2-pre autorizada como próxima fatia, NÃO
  iniciada.** N2-A…N2-G e N3 seguem TRANCADAS; N2-D exige GATE próprio.
- Docs-only: zero material; DECISION-0172 intocada nesta fatia; guard intocado;
  CANONICAL_WRITER_ALLOW vazia; HOLDs 501 preservados; Δbank=0.
- **STATUS:** DECISION-0172/N2-0 SELADA PELA YALA · SELO COMPLETO. Próximo passo autorizado, não
  iniciado: N2-pre (trigger de HOLD DML + REVOKE de unificard_app + guard anti-revival do HOLD +
  prova de que SELECT/readers seguem vivos — nada de catálogo/alias/sucessão/writer/capability nessa
  microfatia).

### 2026-07-11 (31) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-0 — DECISION-0172 promulgada (docs-only)
- GATE read-first N2 executado em HEAD `c8c9dfecc` (3 eixos: schema vivo/usos runtime; padrões
  reutilizáveis; substrato de authority) — veredito soberano: aprovado com 2 correções vinculantes.
  Promulgada **DECISION-0172** (escolhas físicas e de autoridade da fundação de bairro).
- **P1–P6:** escopo territorial tipado com FKs reais (tenant institucional rejeitado) · maker-checker C
  sem autoaprovação implícita (2 operações, 2 capabilities, 5 elos) · multi capability keys domain:action ·
  proveniência híbrida (source_kind governado + reference + evidence; external_code ADIADO) · **N2-pre
  obrigatória = trigger de HOLD + REVOKE + guard** (dev roda com postgres/superuser — trigger é a
  barreira real) · is_active + valid_from/until_at (curadoria = eixo separado; sem status novo).
- **Correções vinculantes:** N2-F coerência de addresses (CHECK + FK composta, FK simples removida,
  zero backfill por display_text) SELADA antes do N3 · allowlist por arquivo REJEITADA (modelo futuro =
  arquivo+check; anti-texto universal; walk cobre scripts).
- **Sequência:** N2-0→N2-pre→N2-A→…→N2-G→N3, cada fatia com GO/provas/Yala próprios.
- Docs-only: zero material; guard intocado; CANONICAL_WRITER_ALLOW vazia; HOLDs 501 preservados; Δbank=0.
- **STATUS:** N2-0 DECIDIDA/PROMULGADA. N2-pre e fatias materiais TRANCADAS.

### 2026-07-11 (30) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N1/N1.1 SELADA PELA YALA (SELO COMPLETO)
- Yala reauditou a correção N1.1 (`7d253d0f9`) sobre a promulgação N1 (`13cd7d84c`). Primeira auditoria
  havia dado SELO COM RESSALVA (canRepresentActor vs. autoridade de curadoria sem separação textual
  inequívoca); §6.1 sanou. Reauditoria limitada (§6.1 + cartório + escopo docs-only): **SELO COMPLETO.**
- Martelos confirmados: representação ≠ curadoria; capability/grant territorial explícito obrigatório além
  da representação; fail-closed sem ela; rastreabilidade humana mesmo representando PJ; 1/N capability keys
  = decisão do GATE N2; nenhuma capability física criada; nenhuma implementação aberta.
- `DECISION-0171 + N1.1` promovidas a SELADA/SELO COMPLETO; ressalva ENCERRADA.
- Observação cosmética não bloqueante registrada (linha 22 mantém mapa textual antigo, não é regra
  operativa — §6/§6.1 prevalecem); nenhuma DT material aberta para isso; commit auditado `7d253d0f9`
  permanece intocado nesta fatia.
- Docs-only: zero backend/src/scripts/frontend; zero migration/schema/seed; guard intocado;
  `CANONICAL_WRITER_ALLOW` vazia; nenhuma capability/grant; HOLDs 501 preservados; Δbank=0.
- **STATUS:** DECISION-0171 + N1.1 SELADA PELA YALA · SELO COMPLETO. **Próximo passo autorizado, não
  iniciado:** GATE read-first do N2. N2 material, schema, writer, seed, authority wiring, guard allowlist,
  Social e Bank permanecem TRANCADOS.

### 2026-07-11 (29) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N1.1 — correção da ressalva Yala (autoridade de curadoria)
- Auditoria Yala da N1 (DECISION-0171, `13cd7d84c`): SELO COM RESSALVA — §6 acoplava `canRepresentActor` à
  autorização de curadoria, deixando implícito que representar um actor já autorizaria curadoria territorial.
- **N1.1 (docs-only):** §6 ajustada + nova §6.1 "Esclarecimento vinculante de autoridade de curadoria" que
  prevalece: representação ≠ curadoria; capability/grant territorial explícito, escopado e vigente é
  obrigatório ALÉM da representação; fail-closed sem ela (nada de tenant admin/role/is_admin/booleano/
  canRepresentActor isolado como substituto); rastreabilidade humana mesmo representando PJ; N2 deve
  distinguir as capacidades (propor/criar/aprovar/corrigir/desativar/sucessão). Nome físico da capability =
  GATE/N2. Sem nova DECISION numérica (esclarecimento interno); redação anterior preservada.
- Docs-only: zero material; CANONICAL_WRITER_ALLOW intocada; nenhuma capability/grant criada; HOLDs 501
  preservados; Δbank=0.
- **STATUS:** DECISION-0171 corrigida — AGUARDA RE-AUDITORIA YALA LIMITADA. N2 GATE não iniciado; N2
  material e N3–N7 trancados.

### 2026-07-11 (28) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N1 — DECISION-0171 promulgada (docs-only)
- Pós-selo N0/N0.1/N0.2, GO de Clayton para formalizar a identidade canônica de bairro. Promulgada
  **DECISION-0171** (`docs/02_decisions/DECISION_0171_NEIGHBORHOOD_CANONICAL_IDENTITY_FOUNDATION.md`;
  próximo número livre — 0170 era o maior).
- Tese: `neighborhoods.neighborhood_id` = identidade territorial canônica; núcleo reutilizado (proibida 2ª
  tabela); bairro sempre sob `city_id`; texto/CEP/provider/display = só exibição/sugestão; Social+Bank
  consomem o mesmo id sem defini-lo. Decisões A–G registradas (curadoria híbrida, sem KYC, id estável,
  aliases tabela-filha, sucessão N:N, PostGIS não-obrigatório, cidade em frente separada). Contratos
  conceituais de proveniência/autoridade/candidatos/aliases/sucessão/resolução-de-endereço/privacidade;
  nomes físicos e capability = requisitos do N2.
- Docs-only: zero código/migration/coluna/enum/seed/writer; `CANONICAL_WRITER_ALLOW` intocada (vazia);
  zero Social/Bank; HOLDs 501 preservados; Δbank=0.
- **STATUS:** N1 DECIDIDA/PROMULGADA. N2 (fundação aditiva) e N3–N7 TRANCADAS — GO próprio por fatia.

### 2026-07-11 (27) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N0/N0.1/N0.2 SELADA PELA YALA (SELO COMPLETO)
- Yala auditou a cadeia N0 (`a81f004ea`) → N0.1 (`7fcf407cd`, reprovada — resolvedor em memória de
  `resolveCep` sobrevivera ao guard) → N0.2 (`c53e044dc`, remediação). Veredito: SELO COMPLETO.
- Confirmado: zero writer runtime de `neighborhoods`; os 3 vetores conhecidos contidos (SQL-criação,
  SQL-resolução-por-nome, resolução-em-memória); `neighborhoodId` de `resolveCep` permanece sempre
  `null` mesmo com bairro homônimo no catálogo; `neighborhoodDisplay` só exibição; país/estado/cidade
  preservados; guard morde M6/M7 (a regressão exata que a Yala achou); suíte 155; typecheck 0;
  `CANONICAL_WRITER_ALLOW` vazia; dois HOLDs 501 preservados; Δbank=0.
- `DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER` promovida a FECHADA/CONTIDA/SELADA PELA YALA.
- **Próximo passo autorizado, NÃO iniciado nesta sessão:** N1 docs-only (DECISION de identidade
  canônica de bairro). Abrir o writer canônico exigirá, em N2/fatia futura: DECISION ratificada +
  alteração consciente do guard (registro em `CANONICAL_WRITER_ALLOW`) + rito de curadoria + prova de
  autoridade + testes + nova auditoria. Bairro textual/CEP/provider seguem só sugestão/exibição.
- STOP: N1 não escrito nesta sessão; N2/schema/seed/writer canônico/Social/Bank TRANCADOS.

### 2026-07-11 (26) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N0.2 — remediação pós-reprovação Yala (resolveCep)
- **Reprovação Yala do N0/N0.1:** permaneceu vivo o resolvedor `location.service.ts::resolveCep` (rota `GET /locations/cep/:cep`) que casava texto de bairro do provider a `neighborhoodId` por matching EM MEMÓRIA (`findNeighborhoodsByCity`+`.find`). Inócuo só por `neighborhoods=0`; 1º seed do N1 reativaria (e o id flui ao front → `addresses.neighborhood_id`). O guard do N0.1 cobria SQL-por-nome/snake_case, não `.find`/camelCase.
- **N0.2:** resolveCep contido (bairro só como `neighborhoodDisplay`; `neighborhoodId` sempre null, campo mantido por retrocompat). Guard ampliado (mesmo guard): matching em memória (findNeighborhoodsByCity+.find/.filter/.some), matching de lista pelo texto de bairro, `id-from-display` em camelCase (janela para em `,}` — falso positivo passthrough eliminado). PASS message reescrita para afirmar só o provado.
- **Provas:** guard baseline PASS; mutation **7/7** (M6=padrão exato Yala, M7=variante indireta) morde→restore→PASS; prova comportamental efêmera com **bairro coincidente semeado** (Sítio Cercado/Curitiba, provider monkeypatchado sem rede) → neighborhoodId=null apesar da linha existir, resíduo 0→0, harness removido pré-commit; typecheck 0; `validate:regression-guards` 155 OK (pipefail); `git diff --check` limpo; grep writers em src=0.
- **Escopo negativo:** zero migration/schema/seed persistente/Social/Bank; dois HOLDs 501 preservados; Δbank=0.
- **STATUS:** N0/N0.1/N0.2 EXECUTADA — AGUARDA RE-AUDITORIA YALA. RFC N1 TRANCADO.

### 2026-07-11 (25) — F-NEIGHBORHOOD-CANONICAL-IDENTITY N0/N0.1 — contenção + blindagem anti-revival do writer de bairro (aguarda Yala)
- **N0 (`a81f004ea`):** rota `POST /locations/enrich-from-cep` / `location-enrichment.service.findOrCreateNeighborhood` criava `neighborhood_id` por igualdade de nome (`INSERT INTO neighborhoods`, único do src) — anti-padrão vetado por DECISION-0079 §6 / DECISION-0166 D4. Neutralizado: bairro do CEP vira só rótulo de exibição; país/estado/cidade preservados.
- **N0.1 (esta sessão):** blindagem durável. Achado extra contido: `address-helpers.convertLegacyAddressToRef` (sem caller) também resolvia `neighborhood_id` por nome — removido. Tripwire do N0 removido (sem caller; garantia migra para o guard). **Guard novo** `audit-neighborhood-freetext-writer-containment.mjs` (registrado no runner; suíte 155): morde INSERT/UPDATE/DELETE neighborhoods, símbolo `findOrCreateNeighborhood`, resolução por nome, `neighborhood_id` derivado de display/provider; não morde leitura por id.
- **Provas:** guard baseline PASS (1762 arquivos); mutation 5/5 morde→restore→PASS; prova comportamental efêmera 7/7 (provider monkeypatchado, Curitiba/PR, neighborhoods 0 antes/depois, removida pré-commit — prova durável no guard); typecheck 0; `validate:regression-guards` 155 OK (pipefail); `git diff --check` limpo; grep final de writers em src = 0.
- **Escopo negativo:** zero migration/schema/seed/Social/Bank; dois HOLDs 501 (`service-payment-execution.service.ts:351`, `bank-account.service.ts:445`) preservados; Δbank=0.
- **STATUS:** N0/N0.1 EXECUTADA — AGUARDA AUDITORIA YALA. RFC N1 (fundação canônica) TRANCADO até selo; escolhas (a)–(f) já ratificadas por Clayton.

### 2026-07-10 (24) — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-3 SELADA PELA YALA (SELO COMPLETO)
- Yala B-3 = SELO COMPLETO (36 confirmações). Rota read-only real, autoridade real (canManageCompany via
  assertCompanyTemplateAuthority), /recommended endurecido, payload fiel à B-2, estados só até
  ready_for_activation, guard T8 + fix de boundary validados, suíte 154, Δbank=0.
- Observações não-bloqueantes: prova 16/16 foi efêmera (recomendação: promover a teste commitado na
  próxima fatia); erro de `npx tsc --noEmit` cru em bank-account.service.ts é PRÉ-EXISTENTE e fora do
  gate governado (typecheck governado passou).
- STOP: frontend/dashboard visual, Fase C, Fase D e 4d-1 seguem TRANCADOS por GO próprio.

### 2026-07-10 (23) — FASE B-3 EXECUTADA: API read-only do checklist fiscal — aguarda Yala
- Material `8c74f676c` + fix `1394893ec`: GET /companies/:companyId/fiscal-template-checklist (fonte única
  checklistForCompany; projeção fiel sem reshape; autoridade assertCompanyTemplateAuthority exportada —
  401/403/404, nunca pública/só-tenant); /templates/recommended ENDURECIDO com a mesma autoridade (achado
  0170 §2, opção a); contrato no API_CONTRACT_GOVERNANCE §5; guard T8 + INVERSÃO CONSCIENTE da trava T7
  no-surface (superfície única = company-templates.routes; segunda superfície = GO próprio).
- Provas: rota 16/16 via fastify.inject com fixtures reais (403/no_template/suggested/fiscal_pending/
  partially_validated com esfera federal-vs-municipal/ready_for_activation; sem provision_cents; sem
  activated_by_accountant; GETs não escrevem; residue-0) · mutation 14/14 (M12 1ª rodada era mutação
  malformada minha — guard certo; M14 exigiu boundary anti-rename, mesma lição do M1 da Fase A) ·
  typecheck 0 · suíte 154 com pipefail nas duas cadeias · Δbank=0.
- Zero frontend/PDV/Bank/motor. Próximas TRANCADAS: dashboard visual (frontend, GO próprio) · Fase C ·
  Fase D · 4d-1. Contagem de DTs inalterada.

### 2026-07-10 (22) — FASE B-3-0 docs-only: DECISION-0170 promulgada (contrato API/dashboard do checklist fiscal)
- Contrato ANTES de rota/frontend (recomendação Yala do selo B-2). Régua: B-2 prepara o dado · B-3 expõe ·
  Fase C ativa · 4d calcula · PDV numérico só pós-motor. Rota GET /companies/:companyId/fiscal-template-
  checklist em company-templates.routes; fonte ÚNICA = checklistForCompany (projeção fiel, nada inventado);
  autoridade = assertCompanyTemplateAuthority (nunca público) + observação honesta: /recommended vivo tem
  gate fraco (só tenant) — B-3 material endurece ou registra DT; payload = shape real da B-2 + disclaimer
  obrigatório; proibições de superfície (sem provision_cents/alíquota-verdade/botão-ativar); estados só até
  ready_for_activation; erros/ausência honesta tabelados; guard T8 exigido na B-3 material (mutações).
- Docs-only; zero código/rota/frontend; B-2 e guards intocados. B-3 material/C/D/4d-1 TRANCADAS.
  Contagem de DTs inalterada.

### 2026-07-10 (21) — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-2 SELADA PELA YALA (SELO COMPLETO)
- Yala Fase B-2 = SELO COMPLETO (34 confirmações), com REPRODUÇÃO INDEPENDENTE (não apoiada no relato
  do executor): 3 guards verdes, suíte 154 com pipefail, 14/14 mutações mordendo em harness próprio,
  e2e independente 11/11 (DB dev real, resíduo zero, catálogo fiscal vazio antes/depois), typecheck 0,
  package.json/lockfile intocados. Read-model puro confirmado: zero migration/rota/frontend/PDV/
  cálculo/Bank/motor; estados derivados até ready_for_activation; activated_by_accountant ausente
  (Fase C); matching heurística runtime; trava de esfera provada (federal não cobre municipal).
- **Recomendação Yala (trava de sequência):** B-2 prepara o dado; B-3 expõe o dado. Por ser a 1ª
  superfície HTTP/dashboard da frente, recomenda-se RFC docs-only ANTES do material da B-3 (mesmo
  rito da transição Fase A→B-0→B-1). Fase C/D e 4d-1 seguem trancadas (GO próprio; 4d-1 por D9.7).

### 2026-07-10 (20) — FASE B-2 EXECUTADA: checklist fiscal read-model até ready_for_activation — aguarda Yala
- Decisão de escopo de Clayton: **B-2 ESTRITA** (backend-only, sem rota/frontend/painel); superfície =
  **B-3 futura** ("B-2 prepara o dado, B-3 expõe, C ativa, 4d calcula, PDV mostra número só pós-motor").
- Material `e1e9cd9b0`: `business-template-checklist.service` READ-ONLY (**zero migration** — read-model
  puro): fórmula 0169 §4 (publicado casado por território + aplicação + regras ativas via
  taxCatalogRepository = pendências/coberturas); matching = heurística de exibição por dimensões
  (cobertura exige MESMA esfera; matchedRuleId só na resposta); platform=not_applicable; ausência =
  "configuração fiscal pendente — validar com contador"; rótulo "configuração sugerida — requer
  validação". Estados derivados §9 até **ready_for_activation** (activated_by_accountant = Fase C,
  guard morde o literal); agregado conservador por empresa.
- Guard T7 estendido (suíte segue 154): anti-escrita/ativação/cálculo/Bank/ROTA/coluna-tabela-de-estado/
  FK-template→tax/motor-lê-checklist/PDV-usa-checklist + contratos do read-model. Classificação
  proativa no pj-closure (lição da B-1 — zero suíte vermelha desta vez).
- Provas: e2e runtime 10/10 (fixtures efêmeras, cleanup replica, resíduo 0, catálogo 0/0; script
  removido pré-commit) · mutation 14/14 MORDE · typecheck 0 · suíte 154 GATE OK **com pipefail na
  cadeia do commit** · Δbank=0.
- B-3/C/D/4d-1 TRANCADAS (GO próprio cada). Contagem de DTs inalterada.

### 2026-07-10 (19) — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-1 SELADA PELA YALA (SELO COMPLETO)
- Yala Fase B-1 = SELO COMPLETO (27 confirmações + 12/12 mutações). Read-only real confirmado (zero
  escrita); ranking CNAE-primário>company_type>CNAE-secundário validado; CNAE = ponte curada (nunca
  certeza); company_type/slug NÃO viram verdade fiscal (disclaimer obrigatório, guard morde remoção);
  conflitos expostos; confidence baixa não pré-seleciona; fallback territorial só exibição; recommendation
  metadata opcional/retrocompatível; applyTemplate não autoaplica nem cria regra fiscal; zero tax_types/
  tax_rules/actor_fiscal_profiles/PDV/motor/Bank/rota nova; disclosure de processo sanada e registrada.
- **Limites de uso registrados:** B-1 NÃO serve para apuração oficial (é sugestão/onboarding, não fonte de
  cálculo). Serve para recomendação/onboarding/checklist futuro (insumo da B-2/Fase C). Para demonstração
  de MVP, exibir sempre com o rótulo "configuração sugerida — requer validação".
- **STOP mantido:** B-2 (checklist até ready_for_activation), Fase C, Fase D e 4d-1 seguem TRANCADAS —
  cada uma exige GO próprio de Clayton.

### 2026-07-10 (18) — FASE B-1 EXECUTADA: sugestão read-only de templates por company_type/CNAE — aguarda Yala
- Material `e199b4ea7` + fix `1c2c3ca92`: rastreio de recomendação em company_template_applications
  (origin CHECK ×5 + confidence/rationale/cnae_code/source, aditivos NULL; cnae exige rationale+source);
  applyTemplate aceita recommendation OPCIONAL (retro-compatível; nada autoaplica); RECOMMENDATION_ORIGINS
  no manifesto (27); business-template-suggestion.service READ-ONLY (ranking cnae-primário>company_type>
  secundário; ponte curada CNAE→concepts→categories.concept_id→composition; disclaimer "não é verdade
  fiscal"; conflito EXPOSTO; fallback territorial só exibição; ausência honesta; ZERO escrita/aplicação/fiscal).
- Provas: serviço 13/13 residue-0 · CHECKs 4/4 rollback · guard T6 estendido · mutation 12/12 MORDE ·
  typecheck 0 · suíte 154 GATE OK (pipefail) · Δbank=0.
- **🔴 Disclosure de processo:** commit material entrou com suíte vermelha (pipe `| tail` engoliu o exit;
  guard pj-closure pedia classificação do serviço novo) — fix imediato `1c2c3ca92` + regra reforçada:
  suíte em cadeia de commit SEMPRE com `set -o pipefail`. 2ª ocorrência da classe 3b.
- Sem rota HTTP nova (sem GO); Fases C/D e 4d-1 TRANCADAS. Próxima pós-Yala: B-2 checklist até
  ready_for_activation. Contagem de DTs inalterada.

### 2026-07-10 (17) — FASE B-0 docs-only: DECISION-0169 promulgada (onboarding/sugestão de templates fiscais)
- RFC da 1ª superfície viva (recomendação da Yala do selo da Fase A): fontes de sugestão ranqueadas com
  REGRA DURA "sugestão não é aplicação"; autoridade reusa assertCompanyTemplateAuthority (zero paralela);
  aplicação segue em company_template_applications (+colunas aditivas propostas p/ B-1: origin/confidence/
  rationale); FRONTEIRA: Fase B não escreve em tax_types/tax_rules/actor_fiscal_profiles — só checklist
  read-model derivado (publicado+aplicação+regras ativas = pendências); fiscal_config_missing segue até a
  Fase C; CNAE = ponte defensável com curadoria (slug nunca infere); desempate sempre humano; território
  com fallback só de exibição; estados derivados (activated_by_accountant = Fase C); 9 riscos bloqueados.
- Docs-only; zero código/schema/seed. B material/C/D/4d-1 seguem TRANCADAS (B-1/B-2 sugeridas na RFC,
  cada uma com GO). Contagem de DTs inalterada.

### 2026-07-10 (16) — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase A SELADA PELA YALA (SELO COMPLETO)
- Yala Fase A = SELO COMPLETO (24 confirmações + 13/13 mutações). R1 fechado (freeze versions), casa fiscal
  do template criada VAZIA (global, published imutável/deprecated terminal/itens congelados/território FK/
  concepts/sem alíquota/sem FK-tax/sem tenant), guard no runner, 4c-3 compatível, Δbank=0.
- **Recomendação Yala (trava de sequência):** Fase B (1ª superfície viva de sugestão/onboarding) exige
  RFC docs-only ANTES do material. Fases C/D e 4d-1 seguem trancadas (GO próprio; 4d-1 por D9.7).

### 2026-07-10 (15) — F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase A EXECUTADA (fundação vazia) — aguarda Yala
- Material `b9ac0e9c0` + fix guard `4f76d72ef` (1 migration + guard + runner; zero TS de produto).
- **Dívida R1 fechada:** business_template_versions com freeze trigger (versão criada = imutável; mudar =
  nova versão; zero UPDATE/DELETE vivo existia → quebra zero; seeds 0117 E intocados).
- Casa fiscal do template criada VAZIA (GLOBAL, padrão referência sem tenant/RLS): fiscal_profiles
  (âncora em business_template_versions + território FK composta + draft/published/deprecated com
  published imutável e deprecated terminal + UMA publicação por versão+território + source obrigatório) e
  fiscal_items (vocabulários governados D9.5/0167 §5; concept_id→concepts; SEM alíquota; SEM FK a
  tax_types/tax_rules; itens congelados sob published).
- Provas 25/25 rollback resíduo-0; guard audit-segment-fiscal-template T1-T5; **mutation 13/13 MORDE**
  (M1 exigiu endurecer o guard com \b — fix próprio, re-rodada completa); suíte 154 GATE OK; typecheck 0;
  Δbank=0. Nota honesta: commit material cita "155", número real da suíte = 154.
- SEM onboarding, SEM ativação fiscal, SEM PDV, SEM motor: 4d-1 segue TRANCADA (D9.7). Próximas com GO:
  Fase B (onboarding/CNAE) → C (ativação contador) → D (preview PDV pós-motor). Contagem de DTs: R1 era
  achado de GATE (não DT nomeada) — fechado nesta fase; demais inalteradas.

### 2026-07-10 (14) — FASE 4d-0A docs-only: DECISION-0168 promulgada (modelos fiscais por segmento)
- Ideia soberana de Clayton (pré-moldados por segmento) virou norma com a trava: template governado =
  SUGESTÃO/draft, nunca verdade fiscal automática. Verdade final = empresa+regime+território+concept+regra
  ativa+versão+validação do contador.
- **Achado do READ-FIRST:** a camada comercial JÁ EXISTE (DECISION-0117 E: business_templates versionados
  imutáveis + company_template_applications auditadas, seeds supermercado/distribuidora/salão) e há 3 noções
  de segmento vivas → D-0: faceta fiscal NASCE de business_templates (não 4ª noção). Ponte CNAE→concept já
  existe com curadoria (cnae_concept_suggestions) → sugestão de template derivável do CNAE.
- Ativação de template escreve pela via canônica da 4c-2 (createDraftRule→activateRule com source do
  contador) — nenhum caminho novo; motor 4d NUNCA lê template (allowlist 0167 §3); sem ativação =
  fiscal_config_missing segue honesto. Piloto: Curitiba (mercado/açougue/hortifruti/mecânica).
- Docs-only; guards 4b/4c-3 intactos; contagem de DTs inalterada. Sequência futura registrada SEM abrir
  (FOUNDATION→ONBOARDING→ACTIVATION→PDV-PREVIEW); 4d-1 segue trancada (D9.7).

### 2026-07-10 (13) — FASE 4d-0 docs-only: DECISION-0167 promulgada (desenho do motor de provisão fiscal)
- GO de Clayton SÓ para desenho (implementação segue trancada por D9.7). `DECISION_0167_FISCAL_PROVISION_
  ENGINE_DESIGN.md` crava: TaxableEvent canônico + regra de acoplamento (NENHUMA vertical entende imposto —
  caminho único CONCEPT+perfil+tax_rules+policy engine) · allowlist fechada de fontes · TaxProvisionResult
  (4d v1 = decisão/LOG, zero dinheiro; tax_reserve = 4e) · 3 bases (gross/commission_gross/distributable, D7) ·
  dois contribuintes em passadas separadas (D9.3) · fiscal_config_missing em 3 comportamentos · arredondamento
  como configuração · superfície com rótulo de estimativa + pendência honesta no onboarding · 11 gaps
  declarados com lar (multi-país/retenção/facilitator/NCM-LC116-VAT/emissão/apuração…) · sequência
  4d-1→4d-2→4e→4f cada uma com GO próprio.
- Docs-only: zero código/schema/Bank; guard 4c-3 intacto. Contagem de DTs inalterada
  (DT-INVOICING-HARDCODED-TAX-RATE segue OPEN; §10 da 0167 registra a convergência dela para o motor).

### 2026-07-10 (12) — 🟢 FASE 4c COMPLETA: 4c-3 SELADA PELA YALA (SELO COMPLETO)
- Yala 4c-3 = SELO COMPLETO (material `66e15464f`, docs `92f56bd71`, selo `<este commit>`). Guard
  audit-fiscal-tax-catalog validado; 30 confirmações + 13/13 mutações; Δbank=0; 4d NÃO aberta; invoicing
  NÃO corrigido; DT-INVOICING-HARDCODED-TAX-RATE segue OPEN (amarrada pelo guard).
- **FASE 4c COMPLETA:** 4c-1 (catálogo vazio tax_types/tax_rules) SELADA · 4c-2 (vocabulário/types/
  repository/resolução) SELADA · 4c-3 (guard final) SELADA. O catálogo fiscal governado está fechado:
  nasce vazio, configurável por contribuinte/contador, versionado/imutável, sem cálculo.
- **STOP:** 4d (motor de cálculo/provisão) permanece TRANCADA — GO próprio e separado obrigatório por D9.7.
  Sequência restante da Fase 4 (só com GO): 4d motor → 4e tax_reserve fim-a-fim → 4f guards finais.

### 2026-07-10 (11) — FASE 4c-3 EXECUTADA: guard final do catálogo fiscal — aguarda Yala
- Material `66e15464f`: guard `audit-fiscal-tax-catalog.mjs` + registro no runner (suíte 152→153).
  Zero código de produto/migration/manifesto/schema — guard é read-only de CI.
- 6 grupos: G1 substrato 4c-1 íntegro + anti-drop/anti-paralelo em migrations futuras · G2 anti-alíquota-
  hardcoded com exceção ÚNICA controlada (5% do invoicing = expected finding ENQUANTO a DT estiver OPEN;
  DT sumir com hardcode vivo = FAIL; hardcode novo = FAIL) · G3 anti-cálculo na 4c · G4 anti-Bank ·
  G5 anti-seed real (ISS/ICMS/PIS/COFINS/CBS/IBS/IPI/IRPJ/CSLL/INSS…) · G6 anti-vocabulário-paralelo
  (TaxRegime redeclarado / const≠CHECK / fora do manifesto).
- **Mutation 13/13 MORDE** (pós-commit; inclui M13 = fechar a DT do invoicing com o hardcode vivo).
  Typecheck 0; suíte 153 GATE OK na mesma cadeia && do commit; git diff --check limpo; Δbank=0.
- `DT-INVOICING-HARDCODED-TAX-RATE` segue 🔴 OPEN (4c-3 NÃO corrigiu invoicing — frente própria);
  agora o guard a enxerga e amarra. 4d permanece TRANCADA (GO próprio D9.7).
- Com o selo Yala: FASE 4c COMPLETA (4c-1+4c-2+4c-3). Contagem de DTs inalterada.

### 2026-07-10 (10) — Fatia 4B: YALA LIMITADA = RESSALVA SANADA; stash dropado
- Reauditoria limitada confirmou a remediação `348204be7` (entrada 4B no cartório acima da 4c-2; selos
  fiscais 4c-1/4c-2 preservados; API catalogada na §5; commit docs-only; zero código/migration/manifesto/
  Bank/fiscal-runtime). Material 4B segue aprovado (`05649a35b`). Status: ressalva documental/processual SANADA.
- `stash@{0}` (protect-4B-cartorio) DROPADO com autorização da Yala (conteúdo recuperado no HEAD).
- Resíduo fiscal apontado pela Yala (fora da 4B): entradas 4c-1/4c-2 têm tail antigo "STATUS: AGUARDA YALA"
  no corpo apesar do cabeçalho selado → próxima microtarefa = higienização fiscal docs-only, ANTES do GO da 4c-3.
- STOPs mantidos: 4C-4F asset · frontend · Bank · fiscal 4c-3/4d — tudo só com GO.

### 2026-07-10 (9) — REMEDIAÇÃO DOCUMENTAL Fatia 4B asset service_use (pós-incidente de concorrência + ressalvas Yala)
- Yala da 4B: **SELO COM RESSALVA** (material `05649a35b` aprovado tecnicamente; ressalvas documentais).
- Corrigido: entrada REAL da 4B restaurada no topo do cartório (do stash `protect-4B-cartorio`, com status
  atualizado) — o commit `e1d26afae`, intitulado "cartorio 4B", capturara o selo fiscal 4c-2 (incidente de
  working tree compartilhada; sessão paralela foi PARADA). Selos fiscais 4c-1/4c-2 preservados intactos.
- Ressalva de contrato/API tratada docs-only: as 5 rotas `/asset-service-uses` catalogadas na §5 do
  `backend/docs/API_CONTRACT_GOVERNANCE.md` (autoridade owner explícito + canRepresentActor + operador
  derivado server-side; sem terceiro-operador na v1). Não existe OpenAPI por-rota no padrão vivo — nada inventado.
- Zero código/migration/manifesto/Bank tocados. 4B NÃO selada (aguarda reauditoria LIMITADA da Yala);
  4C-4F asset e 4c-3/4d fiscal seguem trancadas. Contagem de DTs inalterada.

### 2026-07-10 (8) — FASE 4c-2 SELADA PELA YALA (SELO COMPLETO + alerta de processo): vocabulário/types/repository/resolução do catálogo fiscal
- GO de Clayton: camada TS sobre as tabelas vazias da 4c-1, SEM calcular imposto. Material `b556bbd4c`
  (3 arquivos: tax-catalog.types.ts + tax-catalog.repository.ts + manifesto; zero migration, zero rota).
- `PLATFORM_REVENUE_STREAMS` (D9.5 ×6) materializado + registrado no manifesto governado (bate com o CHECK
  da 4c-1; guard morde divergência). `TaxRegime` REUSADO da 4b (não redeclara — D9.4).
- Repository: rito draft→activate (deprecia ativa anterior do mesmo escopo)→deprecate; imutabilidade
  respeitada (não edita active in-place, não deleta active/deprecated). Resolução LOCALIZA regra por
  filtros; ausência = fiscal_config_missing (D9.2). NÃO calcula, NÃO multiplica rate_bps, NÃO cria tax_reserve.
- Provas 21/21 em rollback residue-0; typecheck 0; suíte 151 GATE OK; guard de vocabulário GATE OK; Δbank=0.
- Contagem de DTs INALTERADA (DT-INVOICING-HARDCODED-TAX-RATE segue OPEN, não tocada).
- **✅ Veredito Yala (2026-07-10): SELO COMPLETO no material** (62 eixos + 10 mutações) **+ ALERTA DE PROCESSO
  ELEVADO.** Confirmado: commits isolados (material só 3 arquivos fiscais; docs só cartório/tracker); zero
  contaminação da 4B nos commits; PLATFORM_REVENUE_STREAMS governado e batendo com CHECK 4c-1; TaxRegime
  reusado; repository sem editar/deletar active (triggers 4c-1 vivos); resolução localiza + fiscal_config_missing
  honesto; zero cálculo/motor/Bank; Δbank=0.
- **⚠️ TRAVA OPERACIONAL:** frente asset service_use (Fatia 4B) tem trabalho NÃO-COMMITADO na MESMA working
  tree tocando arquivos compartilhados (manifesto/cartório/tracker/run-regression-guards/app.builder). Não
  contaminou a 4c-2, mas **antes de 4c-3 ou qualquer frente, isolar a 4B** (commit próprio + Yala própria OU
  worktree/branch). Regra: uma frente por working tree.
- Próximas: SANEAMENTO da Fatia 4B PRIMEIRO · depois 4c-3 (guards) só com GO · 4d TRANCADA (GO próprio D9.7).

### 2026-07-10 (7) — FASE 4c-1 SELADA PELA YALA: catálogo fiscal governado VAZIO (tax_types + tax_rules)
- GO de Clayton pós-GATE 4c: catálogo TENANT-SCOPED; achado R1 vira DT (não correção); invoicing intocado;
  SÓ 4c-1; 4d segue trancada (D9.7). Material `5a7f636ba` (migration `20260710140000`, zero código TS).
- `tax_types` (identidade do tributo; scope_level country/state/city = subconjunto fiscal do vocabulário
  territorial da 2a; SEM alíquota) + `tax_rules` (regra versionada: rate_bps INTEIRO como DADO — nunca
  literal em código; nível da regra = nível do tributo IMPOSTO por FK composta; território por FKs
  compostas Location Core; regime = MESMO vocabulário D9.5; taxpayer actor|platform + stream D9.5 ×6;
  concept_id opcional como SSOT semântico; source+vigência+version obrigatórios; imutável quando ativa,
  deprecated terminal, DELETE bloqueado; RLS ENABLE+FORCE nas duas). NASCE VAZIO (D9.6.18) — zero seed.
- Provas 26/26 em BEGIN..ROLLBACK resíduo 0 (destaques: city de outro estado e regra-country-para-tributo-
  municipal REJEITADAS pelo banco via FK composta; grafia curta SIMPLES rejeitada; catálogo 0 rows antes/depois).
  Typecheck 0; suíte 151 GATE OK na mesma cadeia && do commit; Δbank=0.
- **NOVA DT registrada (achado do GATE 4c): `DT-INVOICING-HARDCODED-TAX-RATE`** — invoice.service.ts:74
  calcula imposto com 5% HARDCODED ("exemplo") em módulo MONTADO; decisão de Clayton = frente própria
  (invoicing/fiscal-document), não consertar na 4c; guard 4c-3 deve enxergar o risco. Contagem de abertas +1.
- **✅ Veredito Yala (2026-07-10): SELO COMPLETO.** Escopo total da fatia = 1 migration SQL + 2 docs,
  ZERO TS tocado. Confirmado: tenant-scoped nas duas tabelas · rate_bps como dado (nunca hardcoded) ·
  TaxRegime D9.5 exato (grafias curtas rejeitadas) · FKs compostas Location Core (cidade de outro estado
  rejeitada) · taxpayer_kind actor/platform · concept_id→concepts (não category) · imutabilidade+deprecated
  terminal+DELETE bloqueado · RLS ENABLE+FORCE nas duas · catálogo vazio (zero seed real) · zero cálculo/
  tax_reserve/applies_to/economic_policy_lines/motor/policy ativa/admin/invoicing/Bank · Δbank=0 ·
  DT-INVOICING-HARDCODED-TAX-RATE permanece OPEN (não corrigida nesta fatia). Cartório `REMEDIATION_DT_LOG.md`
  tem o registro completo do selo.
- Próximas: 4c-2 (vocabulário PLATFORM_REVENUE_STREAMS + repository) só com GO · 4c-3 (guards) · 4d TRANCADA.

### 2026-07-10 (6) — FASES 4a+4b SELADAS: Lei do Contador + Casa Fiscal Canônica (DECISION-0166 D9)
- **Fase 4a — ADENDO D9 / Lei do Contador — SELADA (docs-only, `c3547f2fd`):** UnifiCard NÃO é
  autoridade fiscal nem substitui contador — fornece infraestrutura fiscal CONFIGURÁVEL, VERSIONADA e
  AUDITÁVEL; sem configuração → `fiscal_config_missing` + fail-closed em contexto obrigatório, nunca
  inventa; fiscalidade do actor ≠ fiscalidade da própria UnifiCard; vocabulários D9.5 ratificados
  (TaxRegime com SIMPLES_NACIONAL · applies_to futuro · tax_reserve · platform_revenue_streams ×6).
- **Fase 4b — Casa Fiscal Canônica / Opção B+ — SELADA PELA YALA E COMMITADA** (material `dc3c9de1d` ·
  cartório pré-selo `4fbb7eed8` · selo final `4522ad374`): casa ÚNICA `actor_fiscal_profiles` ancorada
  em `fiscal_identities` (FK), versionada, imutável-quando-ativa (trigger), deprecated terminal, RLS
  ENABLE+FORCE, TAX_REGIMES canônico no manifesto; 2 casas fantasmas APOSENTADAS como fonte fiscal
  (`company_profiles`/`tax_profiles` — writers 501, readers null/canônica); payment-execution parou de
  engolir o reader fantasma (ausência de perfil = `fiscal_config_missing` honesto, default preservado,
  regime nunca inventado). Yala: 28 eixos + 9 mutações, SELO COMPLETO SEM RESSALVA; guard
  `audit-fiscal-canonical-house` morde.
- **Escopo negativo cumprido (registrado):** Δbank=0 · NENHUM cálculo fiscal oficial criado · NENHUM
  `tax_type` · NENHUMA `tax_rule` · NENHUMA alíquota · NENHUM toque em
  Bank/ledger/split/orders/checkout/payment_intents.
- Contagem de DTs abertas INALTERADA (fechou achados de GATE da frente, não DTs A_DECISION nomeadas).
- **Próximas: 4c (tax_types/tax_rules vazios/versionados) SÓ com GO de Clayton · 4d (motor de
  cálculo/provisão) com GO PRÓPRIO OBRIGATÓRIO por D9.7 — não entra em GO de lote.**

### 2026-07-10 (5) — FASE 3 SELADA: eixo regional_level multi-nível (DECISION-0166 D2)
- **3a** `regional_level` em economic_policy_lines (mesmo enum do scope_level da 2a; obrigatório em
  regional_fund, PROIBIDO fora; UNIQUE parcial nível+basis). 9/9 rollback — multi-nível GRAVA.
- **3b** nível da LINHA até o resolver (literal 'city' morreu); snapshot truncado por nível; bairro
  HOLD duplo; origem cadastral exigida p/ todo nível (D0). Engine e2e 18/18 + fee-bps 14/14.
- **3c** guard estendido (CHECKs+anti-drop+propagação+HOLD). Mutation 7/7.
- **Regra dura D7 cumprida:** SÓ o eixo — motor segue no amount do caller; NENHUMA policy regional
  ativa antes da Fase 4 (fiscalidade: commission_gross → tax_reserve → commission_distributable).
- Honestidade: deslize na 3b (commit com suíte vermelha por `;` na cadeia) corrigido em fix imediato +
  regra nova (suíte no `&&`). Typecheck 0; suíte 151; Δbank=0. **Fase 4 aguarda GO.**

### 2026-07-10 (4) — FASE 2 SELADA: geografia por FK canônica + excisão do trilho paralelo (DECISION-0166 D3)
- **2a** `regional_fund_accounts` (FKs compostas hierárquicas — city de outro estado REJEITADA pelo banco;
  UNIQUE NULLS NOT DISTINCT por escopo; 1 conta = 1 escopo; RLS FORCE; ZERO coluna de saldo). 14/14 rollback.
- **2b** `ensureRegionalFundAccount` (FK=verdade; owner_id=rótulo por ID; neighborhood=501 HOLD D4;
  idempotente; ledger intocado). 9/9 zero-resíduo.
- **2c** cutover do caminho vivo: degradação FK→string REMOVIDA do pipeline; `jurisdiction_snapshot`
  LEGÍTIMO por linha ({basis, level, IDs canônicos}) — fecha o contrato da F1-c; guard F1-d invertido
  conscientemente (de "proíbe preencher" para "exige legítimo + proíbe fabricar"). Mutation 4/4.
- **2d** EXCISÃO (autorizada): DROP `regional_funds`+`regional_fund_allocations` (0 rows ×2; zero writer
  montado; leitor convertido a regional_fund_accounts); `ensureRegionalFundBankAccountForRegion` (sink
  string) REMOVIDO; tombstone 501 RETIRED; 2 scripts mortos deletados; braço Bank do incentivo regional
  RETIRED. Fecha o risco "geografia por texto + saldo fora do Bank".
- **2e** guard `audit-regional-fund-fk-canonical` (anti-recriação, anti-string-key, anti-saldo-em-coluna).
  Mutation 7/7. Suíte 151 GATE OK e typecheck 0 em TODAS as fatias; Δbank=0 na fase inteira.
- Próximo (GO próprio): **Fase 3 — regional_level multi-nível na policy** (planet/country/state/city;
  bairro HOLD). Lição de processo aplicada: mutation test só roda pós-commit (incidente 2c, refeito).

### 2026-07-10 (3) — Frente futura registrada: F-E2E-FIXTURE-UNIVERSE-REPAIR (não abrir sem GO)
- Escopo quando aberta: (a) fixtures de `services` nos e2e com `canonical_service_id` (NOT NULL novo);
  (b) reconstruir universo G2 do transversal pós-reset (buyers/services/saldo/contas); (c) tratar trigger
  `users_sync_id_user_id` (branch NULL+NULL quebrado: search_path hardened + `uuid_generate_v4()`
  não-qualificado) em frente própria; (d) revisar `regional-fund-pf-resolver` em banco dedicado (script
  se auto-aborta em unificard_dev por design). Decisão Clayton 2026-07-10: registrar e NÃO abrir agora
  (foco na Fase 2 da policy). Detalhes/causas exatas no cartório (entrada da microfatia e2e).

### 2026-07-10 (2) — Microfatia e2e: 7 validate-pipeline-* no rito draft→lines→activate (`4ae75c963`)
- Colisão da F1-b fechada SEM backdoor: seeds criam DRAFT→lines→activate; cleanup deprecia ativas (nunca
  deleta) + deleta só drafts; códigos únicos por run (UNIQUE vs deprecated acumuladas). T16/T17 do engine
  ficam DRAFT de propósito (CHECK 23514 precisa disparar antes do freeze). Provas: fee-bps 14/14 e engine
  18/18 em 2 RUNS consecutivas (re-runnabilidade); typecheck 0; suíte 151 GATE OK.
- 🟡 NOVA pendência revelada (parado/reportado): 4 e2e que movem dinheiro + regional-fund falham em
  FIXTURES pré-existentes (services sem canonical_service_id NOT NULL; universo G2 do transversal ausente;
  regional-fund se auto-aborta em unificard_dev por design; trigger users_sync com branch NULL+NULL
  quebrado por search_path hardened). Reparo = frente própria com GO. Contagem de DTs inalterada.

### 2026-07-10 — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION: DECISION-0166 promulgada + FASE 1 SELADA (imutabilidade + snapshot)
- **DECISION-0166** (docs-only, `73c0a63a3`): D0 origem regional padrão = jurisdição cadastral do COMPRADOR
  (PF residência/PJ fiscal; transaction_location opcional, não default) · D1 base=comissão · D2 multi-nível
  `regional_level` (planet/country/state/city/neighborhood, ortogonal ao basis) · D3 fundo por FK (nunca
  string) · D4 bairro HOLD sem catálogo governado · D5 imutabilidade+snapshot · D6 admin por último.
- **FASE 1 (F1-a..F1-d) COMPLETA** — fecha o gap "policy ativa reescritível por cima" (achado G4/G-A/G-B do
  GATE; era só convenção, virou trava de banco): trigger `economic_policies_immutability` (ativa congela
  campos materiais; só active→deprecated + effective_until; deprecated TERMINAL — fecha bypass de
  ressurreição; DELETE bloqueado em active/deprecated) + trigger `economic_policy_lines_freeze` (lines
  congeladas com pai active/deprecated; anti-repoint; fail-closed sob RLS) + `bank_splits.policy_version_id`
  (FK→economic_policies, preenchido pelo pipeline canônico desde a origem policyResult.policy.id) +
  `jurisdiction_snapshot` JSONB (CONTRATO nullable — preenchimento só nas Fases 2-3; guard anti-fabricação)
  + guard `audit-policy-immutability-and-split-snapshot.mjs` (stripComments TS+SQL, anti-drop, mutation 7/7).
- Provas: 14/14+9/9+5/5 negativas em rollback; typecheck 0 e suíte 151 GATE OK em TODAS as fatias;
  Δbank=0; sem backfill. Commits: `e6260802e`/`14f2b0a21`/`1fa2ce113`/`9ad6e2b5c` + cartórios.
- **Pendência com GO pendente:** 7 scripts e2e validate-pipeline-* precisam do padrão draft→lines→activate
  + cleanup sem DELETE de ativadas (colisão reportada, scripts NÃO tocados — regra "parar antes de expandir").
- Contagem de DTs abertas INALTERADA (~150–170): Fase 1 fechou achados de GATE (G-A/G-B/G-C/G-D), não DTs
  A_DECISION nomeadas. Próxima fase (GO próprio): Fase 2 `regional_fund_accounts` por FK canônica.

### 2026-07-09 — F-BANK-SPLIT-PIPELINE-CONSOLIDATION-VIRGIN-SYSTEM FECHADA (DECISION-0165)
- Consolidação do pipeline financeiro ANTES de PORTA-1 (sistema virgem → excisar caminhos de split
  paralelos/legados, não conter por flag). Fase 0 (DECISION-0165 docs) + 0.5 (reachability+cartório) +
  1A→1F. **Removidos/aposentados:** work-assignment split.service (1A/1A-R) · transferP2P+donation (1B,
  rotas desmontadas) · processServiceBookingPayment legado (1C) · 3 sinks event_ticket/consumption/
  ride_payment → `*_PAYMENT_RETIRED` (1D) · mortos: post-event-split.job/event-scheduler/core-economy-
  split.service/resolveBankAccountForServiceActor (1E-2). **Gated default-OFF:** treasury-split +
  treasury-distribution workers (1E-1/1b, bootavam ungated). **Mantidos:** pipeline canônico
  (service-payment-execution→economicPolicyEngine→createTransactionWithExplicitSplitLines), service_booking
  MVP, bankSplitEngineService (VIVO/HOLD p/ group_contribution — cutover da próxima frente),
  resolveEventOrganizerAccount (getter de saldo vivo — GATE pegou o falso-morto). **1F:** guard
  anti-revival `audit-bank-split-pipeline-consolidation.mjs` (stripComments, 6 grupos, testado por
  mutação) + reconciliação de 2 guards B1 (rides/checkout firewall) p/ aceitar estado RETIRED.
- **Provas finais:** typecheck 0 · `validate:regression-guards` = **151 GATE OK/RC=0** (via npm) · Δbank=0
  · working tree limpo. Commits materiais separados dos de cartório em CADA fatia (8+corr.).
- **Gap de processo assumido:** nas fatias 1D/1E provei com typecheck+negative-proof mas NÃO rodei a
  suíte completa — a suíte ficou vermelha desde a 1D (2 firewall-guards do B1) e só peguei na 1F.
  **Nova disciplina:** fatia que mexe em método vigiado por guard exige `validate:regression-guards`
  completo na prova, não só typecheck. (O "guard-financial-regression FAIL" no meio foi falso alarme —
  PATH sem node_modules/.bin ao rodar `node` direto; via `npm run` passa.)
- Contagem: estimativa de abertas INALTERADA (~150–170) — a frente retirou superfície de risco no
  bucket dinheiro, não fechou DTs A_DECISION. Cartório completo em `REMEDIATION_DT_LOG.md` (relatório
  consolidado + STOP). Próximo foco: `F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION` (split configurável).

### 2026-07-06 (6) — Auditoria dependency-aware (Fable 5) + PLANO_ZERAGEM_DT v2
- Verificação de 1ª mão contra fontes primárias (git+cartório), NÃO memória. Medido: 540 DTs
  distintas, 241 cross-links, typecheck 0/0 (resolve contradição com o PLANO v1 que dizia "não
  limpo" — era stale, Onda 5 `794d51dba` zerou). Commits das Ondas 4/5/L5/R2.2 confirmados no git.
- Achado de método: contagem exata de abertas NÃO é derivável por query (convenções de fechamento
  heterogêneas) — placar acima agora traz a nota de método. ~150–170 abertas; bucket executável VAZIO.
- **Entregue o que faltava nos dois docs: o GRAFO DE DEPENDÊNCIAS.** 3 dívidas-raiz eliminadoras
  identificadas (E1 sink-firewall / E2 typed-edge L2 / E3 catalog-root L3) + 3 eliminações cross-lote
  (L2→parte de L4 e L1; L3→cluster DT-SERVICE-*; E1→feixe de dinheiro). Ordem ratificada por
  dependência (não cheapness): L2→L3→L4→(L6 paralelo)→L1.
- `PLANO_ZERAGEM_DT.md` REESCRITO como **v2** (a v1 era coerente mas stale). Recomendações de decisão
  enterprise por lote adicionadas. Nada de código tocado nesta auditoria (só os 2 arquivos de plano).

### 2026-07-06 (22) — DECISION-0161 ratificada + backend EXECUTADO (plateia actor-adaptativa)
- Clayton: "ratificado 0161". Sequência §5 rodou: migration aditiva (audience_relationship_types +
  CHECK de subconjunto do typed-edge; visibility intocado) · contrato GET /events/audience-options
  (canRepresentActor; PF vê amigos/família, PAGE vê colaboradores/clientes/fornecedores/parceiros;
  compõe de RELATIONSHIP_LABELS governado) · writer PATCH /events/:id/audience organizer-only ·
  enforcement na LEITURA (canViewEvent: private+refinamento exige aresta ACEITA do tipo com o
  organizador). E2E 4/4 · suite 201 GATE OK (o guard event-lifecycle mordeu meu desvio de padrão nas
  chamadas — conformei o código ao guard) · tsc 0 · Δbank=0. RESTA fatia 3 (wizard consome) junto do
  F2 do composer (modal FB + chip de plateia = MESMO contrato). Selo Yala recomendado após fatia 3.

### 2026-07-06 (21) — Auditoria dupla Yala: 6/7 PASS/PASS + BLOCKER de RLS corrigido (e rendeu bônus)
- Yala auditou o dia (segurança+norma): bypass D1/spoof R2/2ª-SSOT = ZERO achados; 6 commits PASS/PASS.
  BLOCKER real: policy RLS de follows com GUC errado (app.tenant_id ≠ app.current_tenant) = quebra-
  fechada; E2E era cego (superuser + flags). FIX 20260706160000 corrigiu follows E DESCOBRIU 5 policies
  pré-existentes da MESMA classe quebradas desde abril (webauthn×2/audit_events/partner_employees/
  category_ai_logs) — todas consertadas; 0 GUC errado no dev. Classe travada (guard novo, suite 201
  GATE OK). E2E descegado: caso E2 exercita a policy sob role NOBYPASSRLS (6/6). Lição: prova como
  superuser não prova RLS.

### 2026-07-06 (20) — Auditoria L6 backfill: dívida FANTASMA (não há backfill)
- Os "4 actors sem global_user_id em breach de 0062 D8" são INSTITUCIONAIS (3 page + 1 group) — que
  por norma NÃO têm global_user_id (âncora de humano); todos têm responsible_actor_id (§4.8, 4/4).
  Estado CONFORME. A linha sai da fila L6; contagem crua sem semântica tinha gerado dívida fantasma
  (mesma classe do "arquivar core/intent" refutado). L6 real restante: tenant-inicial-vivo + F5 (adiada).

### 2026-07-06 (19) — A esteira de curadoria ganhou CABEÇA (item 2b): /admin/curadoria-servicos
- Página admin nova (padrão KybReviewBackoffice): fila pending_curation de serviços com Aprovar/
  Rejeitar (sem merge, D3). Frontend só projeta; autoridade no backend. tsc 0. AGUARDA VISUAL
  SIGN-OFF de Clayton. Ciclo da Opção C completo: sugerir → curar → catálogo cresce sem migration.

### 2026-07-06 (18) — Curadoria hardening pré-UI (item 2a da fila): D1+D2 fechados, D3 auditado
- Frente prescrita no cartório executada: D1 gate de plataforma no promoteToGlobal (env-strict
  fail-closed — tenant-admin não muda mais o catálogo global de todos), D2 reject de serviço (paridade
  com produto; compõe do vocabulário governado pending→retired + evento append-only, sem estender
  CHECK), D3 auditado (merge não re-aponta dependentes — CONFIRMADO; merge fora da 1ª UI), D4 já
  estava (RLS 20260702130000). E2E 4/4, suite 200 GATE OK. A esteira está dura pra receber a cabeça:
  próxima fatia = UI de sugestão+curadoria de serviço (sem merge).

### 2026-07-06 (17) — FOLLOW ativado (decisão soberana) + DECISION-0160 ratificada/inserida no cânone
- Clayton decidiu: "seguir existe" → F-FOLLOW-ACTIVATION-SLICE-A. GATE salvou 2× (typed-edge não cabe
  [par não-ordenado]; `follows` JÁ existia com writer identity-bound completo — zero substrato novo).
  Fatia = hardening (RLS+FORCE + not-self, migration 20260706150000) + frontend (stubs → chamadas
  reais; ActorPage já tinha o botão inteiro). E2E 5/5, suite 200 GATE OK. Fronteira: follow cross-tenant
  (vitrine) = camada de interação, pendente. TAMBÉM: Clayton ratificou DECISION-0160 ("Ratificado pode
  inserir") → vocabulário relationship_type inserido no cânone (07 §4.39.1 + SSOT §5.16) → RN1+RN2
  CLOSED → as 4 dívidas normativas de R2 TODAS fechadas. E decidiu: produto = ACTOR-FIRST (caso âncora
  bens usados PF, categoria da árvore governada). Nova lei de conduta gravada: não perguntar o que a
  norma já decidiu (memória permanente).

### 2026-07-06 (16) — Fila autônoma limpa: bug TENANT_ID_REQUIRED + 3 resíduos + pacotes L4/L6
- (1) `DT-SESSION-TENANT-ID-REQUIRED` CLOSED — causa-raiz diagnosticada: `atob()` sobre JWT base64url
  (quebra em 74-91% dos tokens); helper único base64url-safe, 10 call sites + webauthn convergidos, guard
  + negative-proof, suite 200 GATE OK. (2) 9 delegações revogadas investigadas = resíduo órfão (não
  multi-empresa real); revelou gap FK latente (DT baixa). (3) path MODULES_INVENTORY corrigido (nota
  autoritativa). (4) Pacotes L4 + L6 montados com read-first vivo: L4 tem 9/17 DTs já CLOSED (4 decisões
  de produto restantes); L6 VIRADA — tenancy já decidido (0115), falta implementação (GO tenant-inicial-vivo
  + backfill 4 atores). Fila autônoma esgotada — resto é decisão de Clayton.

### 2026-07-06 (15) — Pacote de decisão L3 montado (6 decisões, read-first vivo)
- `LOTE_L3_CATALOGO_MARKETPLACE.md` criado com read-first de HOJE (cartório+migrations+banco): vários
  itens tinham evoluído desde junho — BELEZA completa (tríade+aliases) + LIMPEZA slice A já seladas
  (método provado 2×), D4-RLS da curadoria já corrigido. 6 decisões pra Clayton: D1 método Opção C ·
  D2 verticais · D3 aliases atômicos · D4 curadoria hardening→UI · D5 W2 produto · D6 hybrid.
  + bug adjacente TENANT_ID_REQUIRED (diagnose-first). L3 é a raiz E3 (maior colapso de dívidas).

### 2026-07-06 (14) — Fork de MarketplaceDomain MORTO de ponta a ponta (contracts)
- Convergência frontend (opção 1): o vocabulário migrou pra casa canônica que JÁ EXISTIA —
  packages/contracts/src/vocabulary.ts ("Reference vocabulary" §5.16, padrão Gender/Currency).
  6 cópias (4 backend + 2 frontend) → 1 símbolo (MARKETPLACE_DOMAIN_VALUES); todos re-exportam.
  Backend core/marketplace-domain segue como home do MAPA D1-D6→N0. Manifesto anti-drift aponta pro
  novo home. tsc backend 0 + frontend 0, E2E 5/5, suite 199 GATE OK. Resta de L3 só o decision-gated
  (seed/tríade/sinônimos/W2/hybrid/allowed-domains por CONCEPT).

### 2026-07-06 (13) — L3 fatia 1: materializa DECISION-0106 (MarketplaceDomain→N0) + fecha fork backend
- GO "segue com o L3". Materializei o mapa PROMULGADO da 0106 (só vivia no doc): módulo governado
  marketplace-domain-n0-mapping (market→produtos-e-comercio, services→servicos, events→cultura-lazer;
  jobs/real_estate/vehicles→null por decisão). Seguiu a LEI NORMATIVA (GATE §2.3.2, zero taxonomia
  inventada, projeta sobre os N0 vivos). O guard de vocabulário PEGOU 4 cópias backend paralelas
  (marketplace-categories.types, marketplace-public.routes, companies.types, companies.routes) — o doc
  0106 só citava as 2 do frontend — TODAS convergidas pro source governado. E2E 5/5, suite 199 GATE OK.
  Prova viva de que a catraca funciona: o fork backend que a revisão no olho não pegaria morreu no CI.
  Resta L3 decision-gated (seed/tríade/sinônimos/W2) + convergência frontend.

### 2026-07-06 (12) — Guard de vocabulário governado (a lei normativa virou CATRACA de CI)
- Construído `audit-governed-vocabulary-manifest.mjs` + manifesto `governed-vocabularies.manifest.ts`
  (6 vocab SSOT centrais): anti-drift (manifesto não mente sobre a fonte viva → descobribilidade, raiz do
  RN1) + anti-paralelo (mesmos valores copiados noutro arquivo sem importar o símbolo governado = smell
  C1/R2). No 1º uso pegou um vocab paralelo que EU tinha introduzido (z.enum hardcoded no fix R2.2) →
  corrigido pra compor de DELEGATION_RELATIONSHIP_TYPES. 2 negative-proofs mordem. Suite 198 GATE OK.
  A conformidade de vocabulário agora é VERIFICADA no CI, não na revisão de Clayton. O manifesto é o
  índice de descoberta ("procure o vocabulário governado PRIMEIRO"). Executado sem depender de decisão.

### 2026-07-06 (11) — 4 dívidas normativas de R2 corrigidas (RN3+R2.2 código; RN1+RN2 draft)
- RN3 (FK de autoria granted_by/event.actor_id → actors, migration 20260706140000) e R2.2 (createMember
  aceita relationshipType EXPLÍCITO governado — os 7 valores alcançáveis, owner recebe vínculo; derivação
  do role vira fallback) FECHADAS por código. E2E 12/12 (vínculo explícito partner sobre role=staff +
  FK morde autoria fantasma). Guard estendido. Suite 197 GATE OK. RN1 (registrar vocab no cânone) + RN2
  (documentar ortogonalidade dos 2 eixos) DRAFTADAS em DECISION-0160 (docs/02_decisions) — fecham quando
  Clayton ratificar + inserir em 01_normative (IA não escreve lá). Segui a LEI NORMATIVA: GATE §2.3.2,
  zero vocab novo (usa o CHECK já governado), zero dinheiro.

### 2026-07-06 (10) — LEI NORMATIVA reforçada no topo do arquivo + memória (diretiva Clayton)
- Clayton: "reforçar a nomenclatura canônica, ontologia, SSOT, leis de coerência, N0/N1/N2 — não
  cometer os mesmos erros do passado; para isto foi criado o 00 agente protocolo." Adicionado bloco
  "🔴🔴 LEI NORMATIVA — LER ANTES DE ESCREVER QUALQUER LINHA" como PRIMEIRO bloco do arquivo (antes até
  do placar), ancorado no 00_AGENT_PROTOCOL §2.2/§2.3.2, com a tabela de camadas (CONCEPT/N0-N2/INTENT/
  AUTORIDADE/DINHEIRO/nomenclatura) e a prova de coerência obrigatória. Memória permanente atualizada
  ([[feedback_compor_do_ssot_governado_nao_enumerar]], agora a lei normativa completa). Toda sessão
  futura tropeça nisso primeiro.

### 2026-07-06 (9) — Auditoria NORMATIVA Yala (R2+C1 vs docs/01_normative): sem violação viva, 4 dívidas
- Clayton perguntou "como saber se foi feito certo?" — audits anteriores só viram SEGURANÇA, nunca
  conformidade normativa (o C1 provou o ponto cego). Yala rodou passada só-norma. Veredito: nenhuma
  fonte-de-verdade-paralela viva remanescente; C1 confirmado conforme (matou economicFlow+chaves
  inventadas). R2 CONFORME-COM-RESSALVAS — 4 dívidas normativas registradas no cartório: RN1
  (vocab relationship_type não registrada no cânone, exige RFC/ato Clayton), RN2 (tokens administrator/
  employee colidem com company_users.role admin/staff — eixos ortogonais, decisão Clayton), RN3
  (granted_by/event.actor_id sem FK a actors — MECÂNICO, autônomo), R2.2-derivação (relationship_type
  derivado 1:1 do role → redundante, 4/7 valores mortos, owner→null — decisão de produto/fatia própria).
  **Lição de processo:** conformidade normativa tem que virar passo de verificação padrão, não só guards
  de segurança + Clayton pegando no olho.

### 2026-07-06 (8) — Fatia C1 do Compositor executada (contrato server-driven)
- Novo módulo composer (read-only): GET /composer/contract enumera server-side os atos criáveis por
  [actor,modo], gêmeo write-side do actor-page. INTENT_REGISTRY com 9 intents + categoria econômica
  (entrada/saída/social do APRENDIZADO). Resolve a violação: intent-classifier.ts deixa de enumerar no
  client (vira hint de UX). Fronteiras: canRepresentActor fail-closed, read-only, zero dinheiro, vote
  gated (substrato contido L4). E2E 7/7, guard + 2 negative-proofs, suite 197 GATE OK, typecheck 0.
  A visão do APRENDIZADO e o sistema se ENCONTRARAM. Próximo: C2 (intents por departamento, lê
  relationship_type de R2).

### 2026-07-06 (7) — R2.3 (reconciliar leitura) executado: R2 completo
- actor-capabilities.resolveForUser projeta relationshipType (2 ramos). updateMember re-deriva a
  delegação ao mudar role (revoga antiga com evento + cria nova com vínculo novo) → fecha
  DT-R2-DELEGATION-UPDATE-MEMBER-STALE-RELATIONSHIP. Dependência tratada: PUT virou escritora de
  autoria → ganhou o gate Q3 (requireRepresentsActingActor), guard minCalls 2→3. E2E 10/10 (D0 spoof
  PUT bloqueado, D1 re-deriva administrator+[*], D2 antiga revogada com evento, D3 1 ativa só, P1
  projeção surfa relationshipType). Negative-proof morde (2<3). Suite 196 GATE OK, typecheck 0.
  R2 COMPLETO (só falta R2.4 risco, adiado). Substrato do Compositor por departamento PRONTO.

### 2026-07-06 (6) — RE-SELO Yala APROVADO: R2 CLOSED
- Re-selo sobre o fix `341aa961e`: veredito APROVADO, zero bloqueador. Q3 (autoria forjável)
  materialmente fechada — Yala remapeou os 3 writers e confirmou nenhum caminho vivo forjável;
  fluxo legítimo intacto; RLS/unique sem regressão; guard/negative-proof honestos. R2 (R2.1+R2.2+
  fix) = CLOSED (closeout F-R2-DELEGATION-GOVERNED-LINKS). 1 nota fora-de-escopo virou DT nova
  DT-R2-DELEGATION-UPDATE-MEMBER-STALE-RELATIONSHIP (LOW): PUT updateMember não re-deriva o vínculo
  da delegação ao mudar role — staleness de projeção, fecha em R2.3. R2.3 LIBERADO.

### 2026-07-06 (5) — Auditoria Yala de R2.2 + 3 ressalvas fechadas
- Yala: APROVADO-COM-RESSALVA. Refutou meu claim "granted_by não-spoofável" (Q3, ALTA): granted_by
  vinha de actionContext.actorId sem canRepresentActor → gestor podia forjar autoria na trilha §4.9.9.
  Fechado: canRepresentActor fail-closed nas 3 rotas de escrita de autoria (members POST+DELETE, bridge);
  prova HTTP app.inject 5/5 (Alice→granted_by=Bob → 403; Alice→granted_by=Alice → grava correto). +RLS
  ENABLE/FORCE nas 2 tabelas + unique parcial de par ativo (migration 20260706130000). Guard estendido
  (exige canRepresentActor invocado; negative-proof morde). Suite 196 GATE OK. AGUARDA RE-SELO Yala.

### 2026-07-06 (4) — R2.2 (writer governado de delegação) executado, aguarda selo Yala
- Repositório actor-delegation virou transação atômica: grant grava relationship_type+granted_by+
  previous_link_id E emite evento granted na MESMA TX; revoke/supersede emitem revoked. company-members
  passa autoria+vínculo (role→relationship_type). Gate de autoridade NÃO no repositório (persistência) —
  fica na porta selada Fatia 2. E2E 8/8 (atomicidade: relationship_type inválido → rollback total, zero
  órfão). Guard + 2 negative-proofs. Suite 196 GATE OK, typecheck 0. Closeout no cartório. **AGUARDA
  SELO YALA** antes de CLOSED. Próximo pós-selo: R2.3.

### 2026-07-06 (3) — L2 decidido + R2.1 (schema de delegação) executado
- Clayton decidiu D1-D5. R2.1 schema executado: migration `20260706120000` estende
  actor_delegations (relationship_type CHECK jurídico + granted_by + previous_link_id FK cadeia)
  + tabela actor_delegation_events append-only. Efêmera 11/11 PASS; unificard_dev vivo; 9 delegações
  legadas preservadas. Closeout `F-R2-DELEGATION-GOVERNED-LINKS-R2.1-SCHEMA` no cartório.
  Próximo: R2.2 (writer governado, ultracode + Yala).

### 2026-07-06 (2) — Pesquisa de implementação do Compositor
- APRENDIZADO.md ganhou seção "Pesquisa de implementação" (commit `edb2c9a8a`): o Compositor
  já existe em duas metades — `IntentComposer.tsx` (8 intents, classificação local) +
  `ActorPageContract` (padrão server-driven provado). Violação nomeada: `intent-classifier.ts`
  é 100% client-side (enumeração viola a lei; autoridade não). Sequência de implementação
  proposta: C1 (contrato do composer) → C2 (intents por papel, pós-L2) → C3 (cadeia do
  projeto, pós-L4) → C4 (dinheiro, flip PORTA-1). Visão e sistema a UMA fatia (C1) de se
  encontrarem.

### 2026-07-06 — Lote L5 executado + arquivo criado
- Criado este rastreador vivo, consolidando o estado pós-execução da semana.
- Contidas 501: venue (15 rotas, pública), work-instant (12), policy-engine (11),
  core/residence (3). Guard + E2E 44/44 + suite 195 GATE OK. Commit `c6f412b4c`.
- 3 itens do L5 confirmados já-resolvidos por outra frente (saúde/automation/organization).
- PORTA-1 passo 4 mecanismo provado em efêmera (9/9). Achado novo registrado: P2P
  actor-resolution (latente, contido em dobro). Commit `8fd1e63fa`.
- R2.0 (delegação) auditado em 1ª mão — `LOTE_L2_DELEGACAO_R2.md` criado, pronto pra decisão.
- Reconciliação APRENDIZADO↔sistema: 7 de 12 gaps do Compositor já tinham resposta viva.
- Onda 4 (12 carimbos) + Onda 5 (typecheck 48→0) + organizers fechado por verificação.
- **Saldo da semana: ~168 → ~156 abertas.**

---

*Atualizar este arquivo é obrigatório ao fim de cada sessão que toque dívida técnica —
protocolo §4.3, disciplina §6 acima.*

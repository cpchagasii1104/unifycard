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
| Suite `validate:regression-guards` | ✅ **151 GATE OK / RC=0** (medido 2026-07-09 via `npm run`) | 2026-07-09 |

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

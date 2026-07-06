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
| **Abertas (estimativa reconciliada)** | **~150–170** | 2026-07-06 |
| Contidas/mitigadas (latência viva) | ~50 | 2026-07-06 |
| Typecheck backend (build **e** dev config) | ✅ **0 / 0 erros** (medido hoje) | 2026-07-06 |
| Suite `validate:regression-guards` | ✅ 196 GATE OK / RC=0 | 2026-07-06 |

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
- [ ] **Passo 4 semear saldo REAL** — Clayton escolheu "só mecanismo" por ora; reabrir quando quiser
- [ ] Achado novo: `DT-P2P-TRANSFER-ACTOR-RESOLUTION-USERID-VS-ACTORID` (latente, liga ao L2)
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
- [ ] **R2.3 reconciliar leitura** (actor-capabilities projeta campos novos; canRepresentActor íntegro;
      + tratar nota do re-selo: `DT-R2-DELEGATION-UPDATE-MEMBER-STALE-RELATIONSHIP` LOW) ← PRÓXIMO, LIBERADO
- [ ] **R2.4 camada de risco** (D5 — sub-frente própria, depois)

### L3 — Catálogo/serviços/marketplace (~15 DTs) — não iniciado
- [ ] Seed de catálogo (hoje quase vazio, 1 serviço)
- [ ] Sinônimos profissão→serviço (só BELEZA tem ponte hoje)
- [ ] Curadoria headless (promote/reject/merge/RLS)
- [ ] W2 — produto vira actor-first ou segue taxonômico?
- [ ] Marketplace hybrid anti-pattern
- Pacote de decisão ainda não montado — próximo a preparar quando este lote entrar em pauta.

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
- [ ] Aspirational-vs-runtime — corrigir path do `MODULES_INVENTORY.md` movido
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

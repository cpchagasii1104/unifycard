# PLANO DE ZERAGEM DAS DÍVIDAS TÉCNICAS — v2 — ⚠️ HISTÓRICO, NÃO É O PAINEL VIVO

> ### 🔴 LEIA ISTO ANTES DE TRATAR QUALQUER COISA AQUI COMO ESTADO ATUAL (tarja de 2026-07-31)
> **Papel deste documento (tabela da instância DÍVIDAS TÉCNICAS, `docs/04_audit/PAINEL_DIVIDA_VIVA.md`): HISTÓRICO — evidência antiga, não é placar.**
> **Última atualização de conteúdo: 2026-07-06** — três semanas e meia antes desta tarja. Útil para "isto já foi corrigido/planejado antes?"; **não** para "o que está quebrado hoje?".
> **Para o estado de agora:** `docs/04_audit/PAINEL_DIVIDA_VIVA.md` (PLACAR). **Para a história/causa-raiz:** `REMEDIATION_DT_LOG.md` (CARTÓRIO, topo = recente).
> Sem esta tarja, este documento seria lido como fila corrente de zeragem — que é exatamente a segunda verdade que este projeto existe para não ter.

> **Esta é a v2.** A v1 (montada no HEAD `945cc466a`) era **coerente na estrutura mas ficou stale**:
> propôs Ondas 4/5 e o Lote L5, que **já foram executados** desde então (commits `a898d80c2`,
> `794d51dba`, `c6f412b4c`), e afirmava "typecheck NÃO limpo" — hoje é **0 erros** (medido nos dois
> configs). A v2 corrige isso e **adiciona o que faltava nos dois docs: o grafo de dependências e a
> análise de eliminação** (quais dívidas, quando corrigidas, colapsam outras).
>
> **HEAD:** `341aa961e` · branch `rescue-structural` · **Data:** 2026-07-06.
> **Método (para não repetir o erro de confiar na memória):** o árbitro é o `git log`/`git show` +
> `REMEDIATION_DT_LOG.md` (cartório append-only). Nada aqui foi rotulado por lembrança. Cada número
> foi medido; cada dependência foi extraída dos 241 cross-links `[[...]]` do cartório.
> **Relação com `dividatecnica.md`:** aquele é o rastreador VIVO do dia-a-dia (placar por sessão).
> Este é o PLANO ESTRATÉGICO (ordem + dependências + decisões). Os dois se apontam, não se duplicam.

---

## 1. ESTADO REAL — MEDIDO, COM TRANSPARÊNCIA DE MÉTODO

| Métrica | Valor | Como foi obtido |
|---|---|---|
| DTs distintas no cartório | **540** | `grep` de headers `## DT-/F-` únicos |
| Headers totais (append-only, re-stamps) | 601 | idem |
| Cross-links `[[...]]` (grafo de dependência) | 241 | `grep` |
| **Abertas (estimativa reconciliada)** | **~150–170** | ver nota de método abaixo |
| Contidas/mitigadas (latência viva, não zeram por execução) | ~50 | reconciliação manual |
| Typecheck backend (build config, strict off) | **0 erros** | `tsc -p tsconfig.build.json` medido hoje |
| Typecheck backend (dev config, strict on) | **0 erros** | `npx tsc --noEmit` medido hoje |
| Suíte `validate:regression-guards` | 196 GATE OK / RC=0 | dividatecnica (sessão 07-06) |

**🔴 NOTA DE MÉTODO — por que "~150–170" e não um inteiro exato:** o número exato NÃO é derivável por
query do cartório, e isso é em si uma dívida. O cartório fecha DTs de formas heterogêneas (✅ CLOSED,
CONTAINED, CONTIDO, FROZEN, 501, tombstone, "carimbo", fechamento no CORPO e não no header). Uma
varredura estrita de header dá 301 "sem fechamento no header"; a reconciliação manual dos dois docs dá
~156. A diferença (~145) são DTs fechadas-no-corpo ou com convenção antiga. **A disciplina "fechamento
só vale com re-carimbo no header" (dividatecnica §7) existe exatamente para matar essa ambiguidade
daqui pra frente.** Para efeito de planejamento, o inteiro exato é irrelevante — o que importa é a
estrutura abaixo, que é firme.

**A verdade estrutural (confirmada por git):** o bucket **executável-sem-decisão está VAZIO**. As Ondas
1–3 (C_CLEANUP + D_FIX, 53 itens) foram esgotadas em 07-05; Ondas 4 (higiene) e 5 (typecheck 48→0) e o
Lote L5 (contenção 501 de 4 módulos-fantasma) fecharam em 07-06. **Não há mais o que zerar sozinho.**
As ~150–170 abertas se dividem em: **decisão soberana de Clayton (~70)**, **dinheiro/PORTA-1 em HOLD
(~35)**, **bloqueadas por frente-mãe (~15)**, **latentes/doutrina "não construir agora" (~26)**, mais a
cauda contida (~50) que fecha quando cada frente-mãe abrir. **Zerar, daqui pra frente, = decidir em
lotes + drenar o que cada decisão destravar.**

---

## 2. O GRAFO DE DEPENDÊNCIAS — a parte que os docs anteriores não tinham

A Lei de Coerência dá a espinha causal: **IDENTIDADE → AUTORIDADE → TEMPO/ESTADO → FINANCEIRO**. Dívida
UPSTREAM elimina dívida DOWNSTREAM. Os lotes mapeiam nessa espinha:

```
  L6 IDENTIDADE ──► L2 AUTORIDADE ──► L3 PRODUTO ──► L4 SOCIAL ──► L1 DINHEIRO(PORTA-1)
  (upstream,          (RAIZ de           (cluster       (depende      (downstream,
   norm-blocked,       maior alavanca)    denso)         de L3)        soberano, ÚLTIMO)
   slow-track)
        L5 MÓDULOS-FANTASMA = ortogonal (sem dependentes; quase todo contido)
```

**As 3 dívidas-RAÍZ que ELIMINAM outras (medidas pelos cross-links do cartório):**

- **E1 — Firewall DENTRO do sink de dinheiro** (`executePayment`/`createTransactionWithSplit`/`transfer`).
  UMA mudança mata de uma vez: V3 (venue/subscriptions — já contido na borda), `POST /bank/p2p-transfer`
  (YALA #3), e **≥8 callers** de dinheiro. Maior multiplicador do sistema — mas pertence à PORTA-1
  (soberano, por último). Referência: `DT-RIDES-MONEY-NO-FIREWALL...` (4 refs) + o mapa do READINESS.

- **E2 — Typed-edge de relacionamento actor→actor** (`F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1`, **7 refs**;
  e `DT-OPERATOR-GRANT-OPEN-ORDER-UX`, **12 refs — o nó mais referenciado do cartório inteiro**). É o
  substrato do Lote L2. Ao materializar delegação/vínculo tipado, colapsa: autoridade PJ multi-pessoa,
  operator-grants de ordem aberta, os intents-por-papel do Compositor, E — achado desta auditoria —
  **parte do "follow mechanics" do L4** (seguir é uma aresta actor→actor; o typed-edge do L2 já a
  serve). **L2 é a raiz de autoridade de maior alavancagem cross-domínio.**

- **E3 — Raiz do catálogo** (`DT-SERVICE-CATALOG-SEED-SPARSE`, `DT-SERVICE-DISCOVERY-*`,
  `DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR` **6 refs**). O cluster `DT-SERVICE-*` é o mais denso
  e auto-referenciado do cartório (~15 DTs entrelaçadas). Semear o catálogo + reconciliar discovery +
  bind de companyId colapsa a maioria delas juntas. Produto-visível, money-free.

**Eliminações cross-lote concretas (fazer X fecha parte de Y):**
1. **L2 (typed-edge) → fecha parte de L4** (follow = aresta actor→actor) e **parte de L1** (quem aprova
   payout em nome da empresa = autoridade de delegação). Fazer L2 cedo tem retorno duplo.
2. **L3 (catalog-root) → fecha o cluster DT-SERVICE-\*** (discovery, booking-binding, sinônimos,
   bucket-duplicado) num só arco.
3. **E1 (sink-firewall) → fecha V3 + P2P + ≥8 callers** num só commit, dentro da PORTA-1.

---

## 3. A ORDEM CORRETA — por dependência, não por "o que é mais barato"

A v1 ordenou por custo (L5→L3→L4→L6→L2→L1). O `dividatecnica` corrigiu para L5→L2→L3→L4→L6→L1
("L2 destrava o Compositor"). **A análise de dependência CONFIRMA a correção e dá a prova:** L2 sobe
porque é a RAIZ de autoridade com maior alavancagem (E2), não por causa do Compositor só.

**Ordem ratificada (v2):**

| # | Lote | Por quê nesta posição | Estado |
|---|---|---|---|
| 0 | **Higiene cartorial + resíduo L5** | Sem dependentes; remove ruído; barato | Onda 4 feita; resíduo L5 = presence SSOT + arquivar `core/intent` |
| 1 | **L2 — Autoridade/Delegação** | RAIZ upstream (E2); retorno duplo (fecha parte de L4 e L1) | **EM CURSO** (R2.1/R2.2 executados; aguarda re-selo Yala → R2.3/R2.4) |
| 2 | **L3 — Catálogo/Serviços/Marketplace** | Cluster denso (E3); produto-visível; money-free | Não iniciado; pacote a montar |
| 3 | **L4 — Social/Feed/Votes** | Depende de L3 (discovery Fase 2); parte já morre com L2 | Não iniciado |
| ∥ | **L6 — Identidade/C1** | Upstream, MAS norm-blocked (0062 D9/D10) + exige DB vivo → **slow-track PARALELO**, não bloqueia | Não iniciado; roda em paralelo lento |
| 4 | **L1 — PORTA-1/Dinheiro** | Downstream; soberano; doutrina manda por ÚLTIMO, após as facas fechadas | Mecanismo pronto; semear = ato soberano |

**Racional enterprise da ordem:** prioriza-se por **(alavancagem de dependência × reversibilidade ×
baixo risco)**, não por contagem nem idade. L2 primeiro porque é a raiz reversível de maior alavanca;
L1 por último porque é irreversível e de maior risco (a doutrina "não abre dinheiro sem as facas
fechadas" é a regra de reversibilidade aplicada). L6 em paralelo porque é upstream mas gated por norma
externa — segurá-lo na fila serial pararia tudo à toa.

---

## 4. MÉTODO ENTERPRISE DE DECISÃO (como decidir os lotes sem paralisia)

1. **Decidir em LOTE, não item-a-item.** Cada lote = 1 documento de 1 página (contexto mínimo · 2–3
   opções por item · recomendação da executora · custo). Clayton bate o martelo do lote numa sentada.
   (Evita a fadiga de decisão que trava ~70 A_DECISION soltas.)
2. **CONTER-ENTÃO-DRENAR.** Nenhum furo fica descoberto enquanto se decide. Contém fail-closed agora
   (foi o que L5 e V3 fizeram); drena depois da decisão. Segurança nunca espera decisão de produto.
3. **Alavancagem antes de custo.** Ordena-se pelo que ELIMINA mais downstream (E2/E3/E1), não pelo mais
   barato de tocar.
4. **Irreversível atrás de GO explícito + prova fail-first.** Dinheiro/schema-sensível/identidade só com
   GO nominal + E2E que falha ANTES do fix + re-selo independente (Yala). É a regra que já pegou os
   bugs de segundo grau nas rodadas anteriores.
5. **A "corda única" da PORTA-1.** Todas as facas contidas-por-ledger-vazio (V3, P2P, settlement, split
   stub, Core-de-Aprovação) descongelam JUNTAS quando o saldo for semeado. Não corrigir picado: fechar
   todas na MESMA janela da PORTA-1 (E1 = o corte único que resolve o feixe).

---

## 5. DECISÕES PENDENTES — análise + recomendação por lote (método enterprise)

### L2 — Autoridade/Delegação · **quase fechado, decisão residual**
- **Já decidido/executado:** D1–D5 (Clayton), R2.1 (schema `20260706120000`), R2.2 (writer governado +
  3 ressalvas Yala fechadas). Falta o **re-selo Yala** do commit de fix antes do CLOSED formal.
- **Decisão pendente:** R2.4 (camada de risco — anti-laranja / credential-sharing) entra agora ou depois?
- **Recomendação:** **DEFERIR R2.4** para quando PJ multi-pessoa estiver vivo (conter-então-drenar — não
  há laranja sem operação PJ real). Fazer agora R2.3 (reconciliar leitura) e fechar o lote. **Ganho de
  alavanca:** com R2.3 pronto, o typed-edge fica disponível para servir "follow" no L4 (elimina parte
  de L4 antecipadamente).

### L3 — Catálogo/Serviços/Marketplace · **maior cluster, decisão de produto**
- **W2 (produto actor-first vs taxonômico):** recomendo **ACTOR-FIRST** — paridade com serviços, honra
  "actor é a unidade operacional soberana", e mata a bifurcação (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`).
- **Seed de catálogo:** semear a **tríade completa de BELEZA como template** (concept+canonical+alias+
  label+categoria — a única vertical hoje 100% completa) e replicar por vertical como DADO governado.
- **Sinônimos profissão→serviço:** DADO governado (aliases concept→canonical), nunca código. O gate de
  invariante de self-name já existe — estendê-lo cobre verticais novas desde o dia 1.
- **Hybrid anti-pattern:** **executar DECISION-0106** (ligar DomainSelector ao vocabulário canônico,
  remover o híbrido) — decisão já tomada, é só execução; honra "frontend nunca cria verdade".
- **Curadoria headless:** o caminho admin-gated já existe (`canonical-service` approve/merge atrás de
  `requireRole(['admin'])`) — só falta UI. Baixo risco.

### L4 — Social/Feed/Votes · **depende de L3, parte morre com L2**
- **`DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ`:** é **precondição da Fase 2 de descoberta** — fazer
  PRIMEIRO dentro do L4 (é um gap de autoridade de leitura, não produto).
- **Follow mechanics:** recomendo **reusar o typed-edge do L2** (seguir = aresta actor→actor) — não criar
  substrato novo. Isso é a eliminação cross-lote #1.
- **Votes eligibility / feed post-id drift / CTAs zumbi:** pacote de produto, decidir junto.

### L6 — Identidade/C1 · **slow-track paralelo, gated por norma**
- **Tríade CPF F4/F5 (0062):** **NORM-BLOCKED** pela própria 0062 (D9: sem audit+backfill provados, F4
  não inicia; D10: cada fase exige GO) + exige DB vivo. Recomendo manter como slow-track — não force na
  fila serial. É norma-mandatória (identidade única) mas sem urgência (a identidade atual funciona).
- **0115 tenant-por-signup:** decisão de MODELO DE TENANCY — conecta ao achado "tenants-silo impedem
  usuários de se acharem" da descoberta. É uma decisão de produto de fundo; recomendo tratá-la junto da
  frente de descoberta (define se a busca cross-tenant é a norma ou a exceção).

### L1 — PORTA-1/Dinheiro · **soberano, por último**
- **Sequência imutável (READINESS_PORTA1):** decidir modelo de aprovação → **E1: firewall no sink**
  (default-OFF, mata o feixe) → decidir split → semear saldo com E2E de dinheiro ephemeral → re-verificar
  resíduos 0113 sob Core ligado.
- **Recomendação:** manter em HOLD até L2/L3 estabilizarem; quando abrir, **E1 primeiro** (o corte de
  maior alavanca), semear por último. Nada executa sem GO nominal.

---

## 6. O QUE DÁ PARA COMEÇAR SEM DECISÃO NOVA (autônomo, hoje)

1. **Resíduo L5:** arquivar `core/intent` formalmente (tombstone+guard, único caso simples) + corrigir o
   path do `MODULES_INVENTORY.md` movido. Docs/contenção, risco zero.
2. **R2.3** (reconciliar leitura de delegação) — assim que o re-selo Yala de R2.2 sair. Fecha o L2.
3. **Executar DECISION-0106** (L3 hybrid — decisão já existe) e a higiene de nomenclatura financeira
   não-arriscada (não renomear `cachedBalanceCents` para `balanceCents` — isso cria armadilha de
   segunda-fonte; ver parecer anterior).

Com isso o número real de abertas cai mais um pouco SEM risco, e a máquina de decisão (L3 → L4) começa a
girar sobre o L2 já estabilizado.

---

## 7. DISCIPLINAS (herdadas, vinculantes — não renegociar sem motivo)

1. PJ, grupo, Bank e marketplace **nunca** na mesma execução.
2. Money/grupo/split/payout só com **três paralelas** + E2E fail-first.
3. SQL a `bank_*` só dentro de `backend/src/modules/bank/`.
4. Nada é "fechado" sem prova material (guard + negative-proof + E2E) + **re-carimbo no header** do cartório.
5. Reconfirmar HEAD/migrations no início de cada fatia.
6. Fim de cada sessão: atualizar o placar do `dividatecnica.md` + reportar contagem.
7. **Nunca rotular achado externo como "falso" sem `git log`/`git show`** — ausência no presente ≠ nunca
   existiu (a lição da rodada V1/V2, agora registrada no próprio cartório).
8. Verdade está sempre no backend — "frontend não chama mais" nunca é garantia de segurança.

---

*Plano v2 montado em 2026-07-06 sob verificação de 1ª mão (git + cartório + typecheck medido). A
sequência dos lotes é recomendação fundamentada em dependência; a mão que bate o martelo é de Clayton.*

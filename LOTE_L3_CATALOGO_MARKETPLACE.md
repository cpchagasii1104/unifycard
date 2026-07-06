# LOTE L3 — CATÁLOGO / SERVIÇOS / MARKETPLACE · Pacote de decisão

> **Data:** 2026-07-06 · branch `rescue-structural` · **Read-first feito HOJE** (cartório + migrations + banco vivo —
> vários itens evoluíram desde os registros de junho; este pacote reflete o estado REAL).
> **O que é:** as 6 decisões que destravam o resto do lote L3 — o lote de MAIOR COLAPSO de dívidas
> (o cluster DT-SERVICE-* inteiro pendura nele; raiz E3 do grafo de dependências do PLANO v2).
> **O que já foi executado de L3 (não precisa decidir):** mapa DECISION-0106 materializado + fork
> `MarketplaceDomain` morto de ponta a ponta (6 cópias → 1 símbolo em `@unificard/contracts`).
> **Como decidir:** cada item tem estado real, opções e recomendação. Custo: S=horas · M=dias · L=frente própria.

---

## Estado vivo do catálogo (medido hoje — mais avançado do que os registros de junho)

| Substrato | Vivo hoje | Nota |
|---|---|---|
| `concepts` | 169 | inclui 17+ `domain='servicos'` |
| `canonical_services` | 20 | BELEZA completa (tríade) + LIMPEZA slice A |
| `canonical_products` | 35 | |
| `service_search_aliases` | 91 | beleza-v1 (16 termos→58 pontes) + backfill self-name |
| `categories` | 168 | folhas N2 professional alinhadas por concept_id |

**O método já está PROVADO:** o "TRIO/tríade" (concept + canonical_service global/active + folha N2
professional, alinhados por `concept_id`) foi entregue e selado 2× (BELEZA `20260629120000`, LIMPEZA
`20260701130000`), com aliases governados (`service_search_aliases`, concept-bound, advisory) e busca
visível na tela com sign-off seu. **O que falta não é desenho — é sua ratificação do método como
padrão + escolha das próximas verticais.**

---

## D1 — Ratificar a Opção C (híbrida) como MÉTODO PERMANENTE de crescimento do catálogo?

**Estado:** o decision pack técnico recomendou **Opção C** (seed top-N curado por vertical + cauda longa
via sugestão/curadoria + sinônimo na borda) e a executou 2× como piloto. O carimbo soberano seu ainda
está formalmente pendente no cartório (`DT-SERVICE-CATALOG-SEED-SPARSE` = DECISION_REQUIRED).
- **(a) Ratificar Opção C** — o método das 2 verticais entregues vira o padrão permanente — **S** (só carimbo)
- **(b) Outra direção** (catálogo grande CNAE de cima / só curadoria orgânica / MVP mínimo) — **L**
- **Recomendação: (a).** O piloto provou o método com YALA PASS 2× e zero drift; anti-umbrella respeitado
  (grãos irmãos, sem "corte de cabelo" genérico).

## D2 — Quais as PRÓXIMAS VERTICAIS do seed (e em que ordem)?

**Estado:** BELEZA completa · LIMPEZA slice A. O readiness pack de verticais recomendava labor puro
primeiro. Candidatas naturais (concepts `domain='servicos'` já existentes, sem canonical): manutenção/
reparos, jardinagem, aulas particulares, construção-leve (sem ART).
- **(a) Autorizar lote de 2-3 verticais labor-puro** (ex.: manutenção + jardinagem + completar LIMPEZA),
  cada uma como tríade+aliases no padrão provado — **M** (1 migration governada por vertical)
- **(b) Uma por vez, com seu GO por vertical** — **S por rodada**, mais lento
- **(c) Aguardar demanda real (2º profissional de outra vertical aparecer)** — **S**, catálogo segue magro
- **Recomendação: (a)** — o método é replicativo e o custo marginal por vertical é baixo; catálogo magro
  é hoje o maior atrito de descoberta (busca resolve o termo mas não acha oferta).

## D3 — Sinônimos/aliases: ratificar como DADO GOVERNADO obrigatório de cada vertical?

**Estado:** `service_search_aliases` existe, é concept-bound (nunca texto-livre→concept), advisory,
read-only no runtime — e BELEZA provou o valor na tela (barbeiro→corte masculino). `DT-SERVICE-SEARCH-
NO-SYNONYM` segue PARTIAL porque as outras verticais não têm alias.
- **(a) Ratificar:** toda vertical nova SÓ entra com seu pacote de aliases junto (tríade+aliases =
  unidade atômica de seed) — **S** (vira regra do método D1)
- **(b) Aliases como fatia separada por demanda** — **S**, mas re-abre o gap a cada vertical
- **Recomendação: (a)** — o gap de sinônimo foi a causa nº1 de "busquei e não achei" no seu próprio teste.

## D4 — Curadoria: autorizar o HARDENING pré-UI (D1+D2+D3-audit) e depois a cabeça de produto?

**Estado real (melhor que o registro):** dos 4 defeitos nomeados, **D4-RLS JÁ FOI CORRIGIDO**
(migration `20260702130000_catalog_rls_scoped_isolation` + policy platform-admin). Restam: **D1**
tenant-admin consegue promover scoped→global (falta gate de plataforma) · **D2** rota reject de serviço
AUSENTE (produto tem) · **D3** merge não re-aponta dependentes (auditar antes de expor).
- **(a) Autorizar `F-SERVICE-CURATION-HARDENING-BEFORE-UI`** (fechar D1+D2, auditar D3) e, na sequência,
  a primeira UI de sugestão+curadoria de serviço (sem merge na v1) — **M**
- **(b) Só o hardening agora; UI depois** — **S+**
- **(c) Deixar headless** (catálogo cresce só por migration governada) — **S**, mas mata a cauda longa da Opção C
- **Recomendação: (a)** — sem a cabeça de curadoria, a Opção C fica meio-implementada (só o top-N por
  migration funciona; a cauda longa orgânica não existe).

## D5 — W2 — ✅ DECIDIDO POR CLAYTON (2026-07-06): produto é ACTOR-FIRST

> **Decisão soberana registrada:** "Eu não vejo problema em construir esta frente. porque as pessoas
> físicas vão poder querer vender coisas usadas dela mesmo no marketplace, um videogame usado, uma cama
> usada, um berço usado." Caso de uso âncora = **BENS USADOS de PF** (estilo Facebook Marketplace/OLX).
> **Restrição vinculante ditada por Clayton:** o caminho de PF TEM que respeitar SSOT/ontologia/N0-N1-N2 —
> a categoria ("videogame") vem da árvore GOVERNADA, nunca texto livre. PJ mantém a pegada estruturada
> (ramo/N0/KYB); PF ganha a porta leve de "anúncio de item" — **as duas portas convergem no MESMO
> catálogo canônico** (concepts `item-comercial` + canonical_products). Condição usado/novo = ATRIBUTO
> (LAYER 5), NUNCA árvore paralela de "usados". Próximo passo = design pack read-only (política antes de
> código, GATE 00_AGENT_PROTOCOL) — frente `F-PRODUCT-ACTOR-FIRST-USED-GOODS-DESIGN-PACK`.

## D5 (histórico da opção) — W2: produto é ACTOR-FIRST (paridade com serviço) ou segue ramo/categoria?

**Estado:** a auditoria de 3 lentes deu DECISION_REQUIRED — PF-produto é normativamente silente;
PJ-produto por ramo = DECISION-0108; produto/material diferido por DECISION-0143. W1 (companyId
server-side) já foi fechado. É a última bifurcação estrutural do marketplace.
- **(a) ACTOR-FIRST / paridade com serviço** — produto publica-se pelo actor (PF ou PJ) com elegibilidade
  análoga à de serviço (capability declarada→catálogo canônico); ramo vira atributo, não gate — **L** (frente própria)
- **(b) Ramo/categoria-basta** — produto segue PJ-por-ramo como hoje; PF-produto fica explicitamente fora
  do MVP — **S** (só carimbo normativo do status quo)
- **Recomendação: (a) como direção, (b) como MVP** — ratificar actor-first como norte (coerente com a tese
  actor-first do sistema inteiro e com o APRENDIZADO), MAS manter o gate por ramo no MVP e abrir a frente
  de paridade só depois do catálogo de produto ter o mesmo substrato de elegibilidade que serviço tem
  (DECISION-0144 análoga). Decidir o NORTE agora evita construir mais coisa sobre a bifurcação.

## D6 — Hybrid atômico: GO para a reconciliação (dois trilhos)?

**Estado:** `hybrid` segue VIVO como valor atômico decidindo superfícies (`mapCategoryToActorType('hybrid')
→'store'`), com lógica duplicada em 2 services. DECISION-0098 D7 já o marca DEPRECATED/TO-BE-REMOVED e
D8 proíbe lógica nova sobre ele; a resolução prevista (combinação explícita de trilhos produtos+serviços)
está desenhada; falta SÓ a sua palavra (o cartório diz "NÃO executar antes da palavra de Clayton").
- **(a) GO na reconciliação** — substituir `hybrid` por trilhos habilitados explícitos, consolidar a
  lógica duplicada, preservar superfícies vivas na transição — **M**
- **(b) Manter DEPRECATED sem remover** — **S**, a segunda-verdade semântica continua viva no marketplace
- **Recomendação: (a)** — é a última segunda-verdade estrutural do marketplace; a DECISION que a mata já
  existe (0097 D5/0098 D7), só falta o GO. Fecha junto o resíduo do fork (allowed-domains por CONCEPT,
  DECISION-0102 D5, que o mapa 0106 materializado hoje já suporta).

---

## Item ADJACENTE (não é decisão — é bug com prioridade)

**`DT-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH`** — TENANT_ID_REQUIRED bloqueia o publicar quando a sessão
perde o tenantId (localStorage/race de bootstrap). O cartório manda DIAGNOSE-FIRST (reproduzir antes de
consertar). Não precisa de decisão sua — precisa de uma sessão de diagnóstico. Fica registrado que é a
pendência que pode quebrar o fluxo viva de publicação independente de tudo acima.

---

## Tabela-resumo para decisão rápida

| # | Decisão | Recomendação | Custo |
|---|---|---|---|
| D1 | Método de crescimento do catálogo | Ratificar Opção C (já provada 2×) | S |
| D2 | Próximas verticais | Lote de 2-3 labor-puro (manutenção+jardinagem+LIMPEZA-resto) | M |
| D3 | Aliases | Tríade+aliases = unidade atômica de seed | S |
| D4 | Curadoria | Hardening D1+D2+audit-D3 → primeira UI (sem merge) | M |
| D5 | W2 produto | Actor-first como NORTE; ramo-basta como MVP | S (carimbo) + L (frente futura) |
| D6 | Hybrid atômico | GO na reconciliação (dois trilhos) | M |

**Sequência de execução se você ratificar tudo:** D1+D3 (carimbos) → D2 (seed das verticais, 1 migration
por vez) → D4 (hardening→UI) → D6 (hybrid) → D5-frente (paridade produto, por último, é a maior).
Tudo money-free; PORTA-1 segue HOLD; toda migration governada e idempotente como as 2 já seladas.

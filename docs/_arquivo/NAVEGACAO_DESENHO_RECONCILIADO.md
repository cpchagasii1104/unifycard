# NAVEGAÇÃO — DESENHO RECONCILIADO COM A NORMA CONGELADA

> **Natureza:** decisão de direção (executora) reconciliando o desenho de navegação/busca
> conversado nesta sessão contra os documentos normativos CONGELADOS que já existiam.
> **Não é** RFC, **não** altera estrutura congelada, **não** toca dinheiro, **não** muda código.
> Cinzela 4 decisões que estavam ambíguas — todas resolvíveis SEM RFC porque, em cada caso,
> a coisa **não é** o construto ontológico congelado que superficialmente parecia.
>
> **Base normativa lida e citada:** `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md` (CONGELADO),
> `20_N2_NAVIGATION_STRUCTURE_UNIFICARD.md` v4.0.4-FINAL (CONGELADO),
> `ARQUETIPOS_PAGINA_CANONICOS.md` (derivado, non-normative), `LEI_DE_COERENCIA_SISTEMICA`,
> `18_DOMAIN_ONTOLOGY` v1.0.6 (CONGELADO).
> **Base de código verificada:** `frontend/src/config/operatingMode.ts`,
> `useOperatingMode.ts`, `OperatingModeToggle.tsx`; migrations `0079_n2_navigation`–`0083`
> (`context_nodes`/`context_n2_mapping` vivos no banco).
>
> **Pendente de selo:** convergência de desenho ≠ promulgação. Este documento fica pronto
> para o selo institucional de Clayton se/quando virar norma. Data: 2026-07-03.

---

## A frase que governa tudo (já congelada, `20_N2` §2)

> **N2 organiza. CONTEXT ativa. CONCEPT define.**

E a segunda, do código (`operatingMode.ts:9`):

> **Modo operante prioriza, não esconde.**

As 4 decisões abaixo são consequências diretas dessas duas frases já existentes — não invento eixo novo.

---

## D1 — Consumir/Operar NÃO é um CONTEXT de navegação

**O que a norma reserva a CONTEXT (LAYER 3, `context_nodes`):** ativar um subconjunto da TREE —
*quais N2 aparecem* dentro de um N1. Os CONTEXT reais congelados são ambientes de navegação:
`supermercado`, `delivery`, `farmacia`, `salao`, `spa`, `mercado-financeiro`. CONTEXT tem tabela
própria governada e **nunca é inferido** — é escolhido explicitamente.

**O que Consumir/Operar é (verificado em código):** eixo de **projeção do actor** — "o que faço
agora" (`consumir`/`operar`), persistido como preferência por actor, com a âncora **"prioriza, não
esconde"**. Ele **reordena e reagrupa MÓDULOS** (a ênfase da grade), não ativa N2.

**Decisão:** modo operante **permanece como projeção de apresentação** (onde já está). É
**PROIBIDO** gravá-lo em `context_nodes` ou tratá-lo como CONTEXT de navegação — seria poluir uma
estrutura congelada com algo que não ativa a TREE. Os dois eixos são **ortogonais e coexistem**:
o modo escolhe a ênfase de módulos; o CONTEXT (dentro de um módulo de catálogo) escolhe os
departamentos. **Sem RFC.**

**Guard conceitual (invariante a proteger):** se algum dia o modo passar a *esconder* módulo ou
*ativar/desativar* N2, isso viola "prioriza, não esconde" **e** invade a fronteira de CONTEXT —
vira violação registrável, não evolução.

---

## D2 — Os módulos do menu (Locações, Serviços, Marketplace…) NÃO são N0

**A norma:** N0 é a lista fechada de 12 domínios ontológicos (`18_DOMAIN_ONTOLOGY`). Os N1/N2
congelados cobrem só 3 deles (`produtos-e-comercio`, `servicos`, `financas-e-economia`).

**O fato:** "Locações" não está na lista N0 — é uma **superfície de Camada 3** (composição), que
usa `servicos` + `rentable_resources` por baixo (já constatado no formulário `/locacoes`). O mesmo
vale para "Fazer compras", "Serviços" como itens de menu.

**Decisão:** a lista de módulos do menu **não é a TREE ontológica**. A TREE (N0→N1→N2→CONCEPT)
vive **dentro** da superfície de catálogo/descoberta de um módulo, não na lista de módulos. Logo,
o **escopo de busca "em Locações" é escopo de MÓDULO (superfície), não de N0** — o chip é um label
de módulo, não um breadcrumb ontológico. **Isto responde a pergunta de "grain size" que ficou
aberta:** o escopo trava no módulo inteiro; não desce a N1 dentro do chip. **Sem RFC.**

---

## D3 — Os 6 padrões de UX renderizam nos 7 arquétipos congelados (mapa fechado)

Os padrões que desenhamos (Feed · Achar · Escolher-onde→navegar · Informar · Explorar-com-filtros ·
Meu-painel) são **descrições de comportamento**, não páginas. Cada um **deve** materializar-se como
um dos 7 arquétipos canônicos (`ARQUETIPOS_PAGINA_CANONICOS`). Mapa:

| Padrão de UX (desenho da sessão) | Arquétipo canônico (congelado) |
|---|---|
| Feed | **1. Home / Discovery** ("pode atuar como Feed — Golden Path") |
| Achar (busca) | widget sobre **1. Home/Discovery**; resultado aterrissa em 3 ou 4 (ver D4) |
| Escolher-onde → navegar | **3. Entity Listing** (escolher a loja) → **2. Category/Collection** (navegar catálogo) |
| Informar (endereço, data) | **5. Action / Checkout** (input humano explícito para um fluxo) |
| Explorar com filtros | **3. Entity Listing** (comparação visual + navegação) |
| Meu painel | **7. Draft / Management** (status, histórico, decisões explícitas) |

**Nenhum dos 6 exige arquétipo novo.** O "7º padrão (Investir/Participar)" que cheguei a propor em
`segmentos.md` já foi retirado por mim na reconciliação ontológica — resolve-se por composição
(`produtos-e-comercio` + dimensão `impacto_social` + N0 `governanca-e-decisao`), não por página
nova. **Sem RFC.**

---

## D4 — Busca não é página; `/search` classifica como Entity Listing

**Ctrl-K / omnibox** = affordance de navegação transversal (widget/overlay), **não é página** →
não precisa de arquétipo próprio (a regra "página fora da lista é inválida" não se aplica a um
widget de navegação).

**Página `/search`** (resultados universais em faixas) = classifica-se como **3. Entity Listing
Page** (listagem de entidades encontradas, comparação/navegação, zero decisão). Já existe e é
legítima sob a norma. **Sem RFC.**

---

## O único item que NÃO é decisão de navegação — fica registrado como DT viva

Durante o desenho apareceu um achado que **não** é sobre navegação e **não** se fecha aqui: o campo
**"Nome do recurso"** em `/locacoes` (e equivalentes em Serviços/Produtos/Eventos) aceita **texto
livre** → "Furadeira Bosch"/"furadeira bosch"/"Furadeira da Bosch" viram identidades diferentes,
violando a Lei de Coerência (identidade não nasce de texto digitado).

**Modelo decidido em conversa (direção), a executar em frente própria:**
`CONCEPT (identidade, governado) → ATTRIBUTES (marca/tamanho/tecido/voltagem = facets filtráveis,
governados) → materialização canônica reutilizável (canonical_product já existe p/ produto;
falta equivalente p/ recurso) → oferta/instância do dono`. GTIN entra como identificador exato,
não faceta.

**Bloqueio honesto antes de executar isso:** LAYER 5 ATTRIBUTES é **normativo** (`20_N2` §2 cita
"facets") mas **não confirmei se tem schema vivo no banco** (diferente de CONCEPT/GRAPH, que têm
migrations reais). Primeira ação da frente = verificar schema de ATTRIBUTES; se não existir, a base
precede o catálogo. Decisão de reaproveitar `canonical_products` (novo `type`) vs criar
`canonical_resource_models` = soberana de Clayton. **Registrado como DT, não travando navegação.**

---

## Ordem de execução (o que fazer com estas decisões)

1. **Selo de Clayton** neste documento (convergência ≠ promulgação). Sem o selo, D1–D4 são
   direção de trabalho, não norma.
2. **Alinhar o protótipo à norma** (quando houver visual sign-off, já pendente): o chip de escopo
   = label de módulo (D2); modo = reordenação de apresentação, nunca esconder (D1); página
   `/search` = Entity Listing (D4). Nada disso é estrutura nova — é conformar o que já existe.
3. **Frente própria de catálogo/ATTRIBUTES** (D-DT acima) — só depois de verificar schema e de
   Clayton escolher a materialização. Não bloqueia navegação.

**O que este documento deliberadamente NÃO faz:** não altera N1/N2/CONTEXT congelados, não cria
`context_node` novo, não mexe em dinheiro, não abre RFC, não toca código. Cinzela 4 ambiguidades
cuja resposta correta era, em todos os casos, "isto pertence à camada de projeção/módulo/widget
que o frontend já governa — não à ontologia congelada".

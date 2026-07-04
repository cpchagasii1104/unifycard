# DESENHO CANÔNICO — PÁGINA DO ACTOR (perfil universal adaptativo)

> **Status:** ✅ SELADO na arquitetura (2026-07-04, Clayton escolheu caminho A) — modelo de blocos +
> relação tipada/assimétrica + CRM-substrato + colaborador/onboarding + chamado-por-fato + orquestração
> (horizonte) + norte RATIFICADOS. Conjunto inicial de tipos de relação APROVADO (§7). As 2 decisões
> da PÁGINA (barra de ações inicial; refino de blocos) são resolvidas NA fatia da página (fatia 3),
> não bloqueiam a fatia 1. **Fatia 1 (substrato de relação) especificada em
> `SPEC_FATIA1_RELACAO_TIPADA.md` — aguarda REVISÃO de Clayton antes do código.**
> Origem: wireframe de Clayton (2026-07-04) + conversa de estrutura de perfil.
>
> **Fundamento normativo (vinculante):**
> - LEI DE COERÊNCIA §2 ("o sistema é único; nenhuma camada cria realidade paralela"), §7 (ordem de
>   composição), §9 (mesmo pilar → mesmo resultado), §5 (não-duplicação).
> - `segmentos.md`: *"um substrato, N verticais, muda só o concept de entrada"* · *"segmento novo =
>   decisão de qual concept + qual padrão de UX, não decisão de arquitetura nova."*
> - Tese central: actor como unidade soberana · UI actor-first + context-first (Context Projection).
> - `frontend nunca cria verdade` (projeta verdade resolvida).

---

## 1. PRINCÍPIO

A página de um actor **NÃO é uma página por vertical**. É **UMA casca universal** que renderiza
**blocos componíveis**, e o que decide quais blocos acendem é **o que o actor publicou** (concept +
capability). Clínica e panificadora são a **mesma página** com blocos diferentes acesos. Adicionar
uma vertical = registrar um concept/bloco, **nunca** uma página nova. (Lei §2/§9; segmentos.md.)

---

## 2. ANATOMIA (do wireframe de Clayton)

```
┌───────────────────────────────────────────────┐
│  CAPA (imagem)                                  │
│      ⬤ avatar    Nome (PF/PJ/Grupo/Canal…)      │  [ Conectar ]
│                  Descrição (mensagem do actor)  │  [ Mensagem ]
│                  Horário / Programação*         │  [ Chamado** ]
│                  Localização                    │
├───────────────────────────────────────────────┤
│  Opção 1  Opção 2  …  Opção N   (abas = blocos) │
├───────────────────────────────────────────────┤
│  Conteúdo do bloco ativo (categorias por        │
│  actor + modo operante)                         │
└───────────────────────────────────────────────┘
```
`*` **Slot adaptativo:** empresa→horário de funcionamento (agenda); banda/artista→programação de
shows/eventos. Mesmo slot, projeção diferente pelo actor (Lei §9 — "muda só o concept de entrada").
`**` **Chamado é gated por CONEXÃO** (regra de Clayton): só abre chamado quem tem vínculo com o actor.

### 2.1 Casca UNIVERSAL (igual para todo actor)
capa · avatar · nome · tipo (PF/PJ/grupo/canal…) · descrição · **barra de ações** · barra de abas.

### 2.2 Blocos (acendem por capability/concept publicado)
`Sobre` · `Posts` (social) · `Produtos` (catálogo) · `Serviços` (services) · `Agenda/Horário`
(availability) · `Localização + aberto-agora` (Location Core + agenda) · `Programação` (eventos) · …

### 2.2b AS ABAS SÃO O NAVEGADOR DE BLOCOS ADAPTATIVO (Clayton 2026-07-04)
A barra de abas (no Facebook: Tudo · Sobre · Reels · Fotos · Amigos) é, aqui, o **navegador de
blocos** — e o CONJUNTO de abas NÃO é fixo: é **montado do que o actor publicou + modo operante**.
- **Tudo** (aba âncora, sempre existe — visão consolidada) · depois as abas dos blocos ACESOS.
- **PF:** Tudo · Sobre · Posts · Fotos · (Interesses).
- **PJ padaria:** Tudo · **Produtos** · Sobre · Localização · Posts.
- **PJ clínica:** Tudo · **Serviços** · **Agenda** · Sobre · Localização.
- **Banda:** Tudo · **Programação** · Posts · Fotos.
- **Modo Operando (o dono):** as mesmas abas viram gestão (Produtos→gerenciar catálogo, Agenda→abrir/
  fechar horários). Mesma barra, ação diferente.
A regra: **a aba existe se o bloco está aceso** (capability/concept publicado) — nunca aba hardcoded
por vertical. Adicionar vertical = registrar concept/bloco → a aba aparece sozinha.

### 2.3 A PÁGINA É A ESTRUTURA ÚNICA (Clayton 2026-07-04) — rede social + comércio + hub
- **NÃO há "página social" separada de "loja"/"catálogo"/"serviços".** A MESMA página que já é rede
  social (ver publicações) projeta produtos, serviços, loja — como BLOCOS da mesma casca. Uma
  estrutura, todos os contextos.
- **A página é o HUB / launchpad:** dela o usuário **navega para o destino** (clicar "Produtos" → ver
  a loja; "Serviços" → contratar; "Agenda" → agendar; um post → abrir; "Comprar" → checkout). Os
  blocos são conteúdo **E** porta de entrada pros fluxos vivos (que já existem).
- **CONVERGÊNCIA (anti-página-paralela, Lei §2):** as páginas de perfil que já existem —
  `SocialProfilePage` (/profile/:id, fina), `SocialCompanyPage` (/company/:id, fina) e
  `VitrineProfilePage` (/vitrine/:actorId, esta sessão) — **convergem numa casca única**. Nada de
  criar uma 4ª página; a casca ABSORVE o papel delas (local vs vitrine cross-tenant = a mesma casca
  com fonte de dados diferente). Reconciliação faz parte da Fatia 3.

---

## 2.4 CONTRATO ÚNICO WEB+APP — SERVER-DRIVEN (Clayton 2026-07-04: "modelo que encaixe fácil no app")

Para o app encaixar sem reescrever a lógica, a página é **descrita pelo backend, renderizada pelo
cliente** (server-driven UI). O backend expõe **UM contrato** que diz *quais blocos/abas existem,
em que ordem, com que dados e que ações* — e **web e app consomem o MESMO contrato**. Nenhum cliente
decide quais abas acendem (isso é verdade do servidor, capability-driven; frontend não cria verdade).

**Forma do contrato (conceitual — a materializar na Fatia 3, sem SSOT novo):**
```
GET /actor-page/:actorId?mode=consuming|operating  →
{
  header: { name, avatarUrl, coverUrl, type, headline, location, openNow? },
  actions: [ { key:'connect'|'message'|'schedule'|'ticket'|'buy'|'contract', enabled, gatedBy? } ],
  tabs:    [ { key:'all'|'about'|'products'|'services'|'agenda'|'posts'|…, label } ],
  blocks:  [ { type, tab, data, deeplink } ]   // cada bloco = projeção de um pilar vivo
}
```
- **Contrato estável, verdade no servidor** → app novo (ou aba nova) não exige mudar o cliente: some
  do contrato, some da tela. Web e mobile ficam "burros de propósito" (renderizadores).
- **Cada bloco carrega seu `deeplink`** (o HUB, §2.3): o cliente navega pro fluxo vivo (loja/agendar/
  checkout) por rota declarada, não hardcoded. Mesma navegação em web e app.
- **`enabled`/`gatedBy`** vêm resolvidos server-side (autoridade, PORTA-1, fato-de-negócio): o cliente
  só mostra habilitado/‘em breve’; nunca decide permissão (relação ≠ autoridade preservado).
- Alinha Lei §9 (mesmo pilar → mesmo resultado): web e app **não podem** divergir porque leem a
  mesma descrição.

## 2.4b REELS + FEED (Clayton 2026-07-04) — composição pura, sem canal de vídeo paralelo
**Reels NÃO é um sistema novo de vídeo** (Lei §5). O substrato já existe:
- **posts** já têm `post_type` (CHECK) + `media_ids UUID[]` (+ 'video' já referenciado). **Reel = um
  post de vídeo curto** — estender o vocabulário `post_type` (CHECK: `...,'reel'`) OU marcar mídia como
  vídeo curto; **acoplar ao substrato de mídia vivo**, nunca armazenamento paralelo.
- **Bloco/aba "Reels"** na página = projeta os posts-vídeo daquele actor (acende se ele publicou),
  igual aos outros blocos (§2.2b). Renderização "vertical/rápida" é só UX do cliente.
- **FEED já é vivo e contextual:** `GET /feed/contextual` — personalizado pelo estado inferido do
  actor (DECISION-0113 F6.5.4; autoridade: só lê o feed que o actor pode representar). O que aparece
  no feed = posts/reels dos actors, **filtrado por actor + modo operante** (Consumir vê descoberta/
  seguidos; Operar vê o que importa ao negócio). Ranking = pilar de descoberta (ranking pack; boost
  proibido no MVP). **Não construir feed novo — acoplar/estender o vivo.**

## 2.5 OS BLOCOS/CATEGORIAS ANCORAM NA ONTOLOGIA EXISTENTE — N0/N1/N2 (Clayton 2026-07-04)
**Nenhum bloco/aba/categoria inventa taxonomia.** Tudo ancora na ontologia CONGELADA do sistema
(`18_DOMAIN_ONTOLOGY`: 12 domínios N0 lista fechada + N1/N2) e no substrato semântico vivo
(`concepts`/`canonical_*`). Consequências (Lei §8, sem texto livre):
- **qual bloco/aba acende** = derivado dos concepts/capabilities que o actor publicou (N1/N2 do ramo);
- **produtos/serviços no carrossel/loja** = `canonical_products`/offerings, categorizados pelo N0/N1
  já semeado (ex.: padaria→`produtos-e-comercio`; clínica→saúde→N1 correspondente);
- **o "modo operante"** (Consumir/Operar) = LAYER 3 CONTEXT (`personal`/`professional`/`institutional`)
  já formalizado; **filtros** = LAYER 5 ATTRIBUTES; **produto+serviço juntos** = LAYER 6 GRAPH
  (`enables`/`requires`, sem colapsar em CONCEPT híbrido).
- **Regra:** vertical/categoria nova = ativar N1/N2 existente + concept, NUNCA aba/tabela hardcoded.
  A página é a projeção da ontologia por actor — não uma taxonomia própria.

## 3. MAPA BLOCO/AÇÃO → PILAR (nenhum SSOT novo; cada bloco PROJETA algo que já existe)

| Bloco / Ação | Projeta (pilar/módulo vivo) | Move dinheiro? |
|---|---|---|
| Sobre / Nome / Descrição | `actors` + cartão público | não |
| Posts | social (`follows`, posts) | não |
| Horário / Programação / Aberto-agora | `unified_availability` + eventos | não |
| Localização + mapa | Location Core (`addresses`/assignments) | não |
| Produtos (ver) | marketplace + catálogo (`concepts`/`canonical_*`) | não |
| Serviços (ver) | services + offerings | não |
| **Comprar** | marketplace + Bank | 🔴 **PORTA-1** |
| **Contratar** | services + Bank | 🔴 **PORTA-1** |
| **Agendar** | agenda (`unified_availability`) | não (o pagamento sim) |
| **Mensagem** | social / inbox | não |
| **Conectar** | substrato de relação (§5) | não |
| **Abrir chamado** | módulo de chamado (gated por conexão) | não |

Toda ação segue a ordem da Lei §7: **concept → identidade → autoridade → tempo → estado → dinheiro →
evento**. "Contratar na página da clínica" É o fluxo de contratar serviço que já existe — entrado
pela página, não por tela separada (Lei §9 — mesmo resultado).

---

## 4. ADAPTAÇÃO POR ACTOR + MODO OPERANTE (LAYER 3 CONTEXT)

A página muda em **dois eixos**:
- **Quem é o actor** (PF · PJ-por-ramo · grupo · canal · banda…): decide quais blocos existem.
- **Modo do observador** (Consumindo vs Operando): decide o que a barra de ações mostra.

| Actor | Blocos que acendem | Ações típicas (Consumindo) |
|---|---|---|
| PF (pessoa) | Sobre, Posts, Interesses | Conectar, Mensagem |
| PJ — clínica (saúde) | Sobre, Serviços, Agenda, Localização, Posts | Contratar, Agendar, Mensagem, Chamado |
| PJ — panificadora (alimentação) | Sobre, Produtos, Localização, Aberto-agora, Posts | Comprar, Mensagem |
| Banda/Artista | Sobre, Programação (shows), Posts | Seguir, Mensagem, (ingresso) |
| Grupo/Comunidade | Sobre, Posts, Membros | Participar, Mensagem |

**Operando** (o dono vendo a própria página): as mesmas superfícies viram **gestão** (editar
produtos, abrir/fechar agenda, responder chamados) — capability-additive, mesma casca.

---

## 5. RELAÇÃO ENTRE ACTORS — substrato ÚNICO (social + CRM + B2B) — ✅ RATIFICADO por Clayton 2026-07-04

Hoje só existe `follows` (seguir assimétrico). O wireframe pede **conexão + classificação** +
**chamado gated por conexão**. Decisões de Clayton (2026-07-04):

- **Uma relação = aresta entre 2 actors**, com **tipo governado** (Lei §8 — sem texto livre; "fornecedor
  é fornecedor", igual "terno é terno").
- **B2B confirmado** — empresa↔empresa é caso de primeira classe (o modelo actor↔actor já cobre;
  o Facebook, amizade PF-PF, não expressa negócio entre empresas).
- **ASSIMÉTRICA (confirmado):** cada lado classifica o outro pela SUA ótica, **no envio E no aceite**
  (A envia pedido classificando B como "fornecedor"; B aceita classificando A como "cliente"). Uma
  aresta, duas perspectivas — a força incopiável do actor.
- **SUBSTRATO ÚNICO = também é o CRM (Lei §5, não-duplicação):** a MESMA aresta serve social (conectar/
  plateias), **CRM** (meus clientes/fornecedores/colaboradores = a agenda de contatos da empresa) e
  B2B. Aceitar uma empresa como "fornecedor" já a coloca no CRM como fornecedor — **um dado, N usos**.
  **Aposenta o `contacts` fantasma** (não se cria tabela de CRM paralela). Alinha DECISION-0159
  ("ERP Social" = composição, não módulo novo).
- **🔴 RELAÇÃO ≠ AUTORIDADE (regra dura):** aceitar conexão **NUNCA** concede `canManageCompany`/operar.
  "Colaborador/funcionário" tem DOIS sentidos que a arquitetura separa:
  - *rótulo de relação* (CRM: "é meu funcionário") — contexto/plateia, **zero poder**;
  - *operar a empresa* (postar como page, estoque, dinheiro) — **sempre** `company_users` +
    `canManageCompany` (a catraca blindada contra IDOR).
  Um convite "funcionário" pode DISPARAR o fluxo de virar operador, mas o **grant é ato separado e
  explícito do dono** (fluxo real de membros), **nunca** implícito no aceite social. Isto protege
  os IDORs que fechamos (DT-AUTHORITY-*).
  - **✅ Clayton 2026-07-04 — "ao aceitar o colaborador, já poder colocar as permissões":** o aceite
    de uma conexão tipo *colaborador* **abre o painel de permissões** e o dono atribui ali mesmo (UX
    fluida, um passo). MAS as travas seguem invioláveis: **(a)** só quem tem `canManageCompany` sobre
    a empresa pode conceder (o aceite é o gatilho; o grant revalida a autoridade do dono server-side);
    **(b)** as permissões vêm do **mapa canônico** (`MAPA_CANONICO_PERMISSIONS_v1`, Lei §4.9.4) — sem
    chave inventada, sem texto livre; **(c)** escreve o substrato REAL (`company_users` + permissões
    canônicas), nunca um paralelo (Lei §5); **(d)** herda a contenção de escopo já blindada
    (canRepresentActor só por delegação FULL; permissões finas via `checkPermission`/`can_*`).
    Resultado: conveniência de UI (aceitar + permissionar num fluxo) **sem** que o aceite social, por
    si, conceda poder — o poder vem do ato explícito e autorizado do dono.
  - **✅ Clayton 2026-07-04 — fluxo bidirecional de onboarding de funcionário:** o pedido pode nascer
    de qualquer lado: (i) a empresa CONVIDA o funcionário, ou (ii) o patrão PEDE ao funcionário que
    ENVIE a solicitação, e o patrão aprova. Nos DOIS casos converge no mesmo ponto: **quem concede o
    acesso é o ato autorizado do patrão** (com `canManageCompany`), atribuindo **função → permissões**.
    O "conecta automaticamente ao sistema da empresa de acordo com as permissões/função" = a
    MATERIALIZAÇÃO do acesso **depois** do grant autorizado — a solicitação/aceite é só o gatilho, a
    autoridade vem da atribuição. **O funcionário enviar a solicitação NÃO concede nada a si mesmo**
    (fail-closed; senão seria auto-escalonamento). **Função** é papel GOVERNADO (`company_users.role`
    + fine-grants DECISION-0125), mapeando para um pacote de permissões do mapa canônico — nunca
    texto livre. A "conexão ao sistema" = as superfícies de OPERAR da empresa acesas conforme as
    permissões daquela função (modo Operando; §4).
- **Plateias** (privacidade por camada: público → conexões-de-tipo-X → só eu) leem essa relação.
  Precondição técnica: fechar `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ` (hoje a visibilidade
  é gravada mas ignorada na leitura).
- **🔴 Chamado gated por FATO DE NEGÓCIO (Clayton 2026-07-04, refinado):** só existe chamado se houver
  **negócio real entre as partes** (uma transação/pedido/serviço contratado no ledger/bookings) — não
  basta conexão. Sem fato de negócio, as ações disponíveis são **Mensagem** ou **Agendamento**. O
  chamado **referencia** o evento de negócio específico ("comprei X e deu problema"). Isto ancora o
  chamado na verdade causal (segmentos.md #5 "Confiança causal" — tudo ancora em evento REAL do
  ledger/booking) e é a *porta de entrada por FATO* da Escada de Reciprocidade. Gate server-side.

---

## 5B. EXPERIÊNCIA / AVALIAÇÃO ANCORADA EM FATO DE NEGÓCIO (Clayton 2026-07-04) — "confiança causal"

Quem **comprou ou contratou** pode acessar um espaço para **postar a experiência** (avaliação/review)
sobre aquele negócio. Regra igual à do chamado — **gated por FATO DE NEGÓCIO**, não por conexão:
- só posta experiência quem tem uma **transação/booking REAL** no ledger/bookings com aquele actor;
- a avaliação **referencia o evento de negócio específico** ("comprei X / contratei Y") → impossível
  falsificar (é a composição #5 "confiança causal" de `segmentos.md`: review solta é falsificável;
  ancorada na transação, não);
- aparece como um **bloco** na página do actor avaliado (aba "Avaliações"/dentro de "Tudo"), acende
  quando há avaliações reais — mesma mecânica de bloco adaptativo (§2.2b);
- é a *porta de entrada por FATO* da Escada de Reciprocidade (cliente = quem transacionou).
- **INCENTIVO (Clayton 2026-07-04):** como a avaliação é ancorada e incopiável, a única forma de
  manter reputação boa é **entregar bem de verdade** → alinha o interesse de todos com o comportamento
  certo. Reputação = mérito por participação real, nunca por boost pago (coerente com o ranking pack
  que PROÍBE boost no MVP). É um dos motores de qualidade do ecossistema.
- **ALIMENTA A PESQUISA (Clayton 2026-07-04):** a experiência ancorada serve de **pesquisa para quem
  vai contratar/comprar** — o comprador consulta a reputação REAL antes de decidir. Fecha o ciclo:
  fato de negócio → avaliação ancorada → descoberta/ranking → nova decisão de compra informada.
  Conecta com o marketplace ranking pack (reputação causal como sinal de relevância, não boost pago).

**🔴 GATED — substrato de reputação NÃO-VIVO:** `segmentos.md` #5 registra que o substrato de
reputação só existe em `migrations_archive` (não materializado). Portanto isto é **frente própria
futura** (nomeada, não construída agora): exige (a) o substrato de relação/booking maduro, (b)
materializar reputação como frente dedicada, (c) o guard de ancoragem (review sempre → evento real).
NÃO é fatia da página; é composição que a página PROJETA quando existir. Δbank=0 (avaliação não é
dinheiro), mas depende de bookings/ledger reais (logo, cruza com PORTA-1 no fluxo de compra/contrato).

## 5C. BLOCO DE CONTRIBUIÇÃO / TRANSPARÊNCIA REGIONAL (Clayton 2026-07-04) — "dinheiro voltando às regiões" visível

Um bloco na página pode **mostrar quanto aquele actor (empresa OU usuário) já contribuiu para o
Fundo Regional** — o "dinheiro voltando às regiões" ficando VISÍVEL e auditável. É **projeção** do
substrato JÁ VIVO (`regional_funds`, `regional_fund_allocations`, `regional_impact_snapshots`,
`governance_funding`) — **não modelo novo** (Lei §5). Read-model, Δbank direto=0 (só lê).

**O SPLIT (destino do dinheiro) — Clayton: divide para (1) código de indicação, (2) até 3 grupos de
que o actor faz parte, (3) Fundo Regional.** 🔴 Isto é **DINHEIRO = PORTA-1 (soberano)** e o motor de
split é STUB (bank_splits existe; treasury split não materializado — ver `READINESS_PORTA1.md`).
Notas de coerência para o decision pack de PORTA-1:
- destino "grupos" (até 3) é **novo recipient de split** — hoje o split não tem grupo como destino
  (a modelar em PORTA-1, sem SSOT paralelo; split canônico = `bank_splits`, append-only, guard ativo);
- destino "indicação" cruza com a dívida conhecida (referral hoje user-scoped, não actor — reconciliar);
- destino "fundo regional" tem substrato vivo (acoplar, não recriar);
- **regra de ouro:** o cálculo/movimento do split é 100% no Bank (Lei §4.6); a página só PROJETA o
  resultado. O bloco de contribuição pode existir cedo (read-only); o split real é PORTA-1.
- **OPT-IN (Clayton 2026-07-04):** mostrar a contribuição é ESCOLHA do actor — mais um campo
  mostrar/ocultar do **cartão público** (o mecanismo por-campo JÁ VIVO desta sessão: `metadata.card`
  + toggle Mostrar/Ocultar). Default sugerido: oculto (é dado sensível de contribuição). O actor
  liga se quiser exibir orgulho/transparência. Frontend não decide — projeta a escolha do backend.

## 5D. CONFIGURAÇÕES DA PÁGINA (modo OPERANDO) — Clayton 2026-07-04

As configurações NÃO são tela separada: são a **página no modo Operando** (o dono editando a própria
casca). Mesma casca, ação de gestão (§4). O que se configura:

- **Foto de perfil (avatar) + foto de capa:** editadas ali no cabeçalho da própria página (ícone de
  câmera no avatar/capa, como o wireframe já mostrava). Acoplar ao **substrato de mídia JÁ EXISTENTE**
  (verificar `media`/upload vivo antes de construir — NÃO criar armazenamento paralelo, Lei §5); a URL
  resultante alimenta `avatar_url`/`cover_url` da projeção (que a vitrine/cartão já leem).
- **Capa com BANNERS (capability de empresa — page-actor):** uma empresa pode trocar a capa estática
  por um **carrossel de banners**. Configurável pelo dono (modo Operando):
  - **quantos banners** (com um teto sensato, ex.: até 5 — evita abuso/peso);
  - **duração de cada** (segundos até passar ao próximo, ex.: 3–10s; com default);
  - ordem, link opcional de cada banner (deeplink pra bloco/produto/oferta — reusa o hub §2.3).
- **Onde vive a config:** estende o `metadata` do perfil (`metadata.cover = { mode:'image'|'carousel',
  banners:[{url, seconds, link?}], ... }`) — **mesmo mecanismo do cartão público** (`metadata.card`),
  sem tabela nova. O carrossel é **capability por actor_type** (PF: capa simples; PJ: carrossel
  liberado) — coerente com "a página se molda ao actor".
- **Server-driven (§2.4):** a config entra no contrato `header.cover` → web e app renderizam o
  carrossel igual, cliente só executa o timing declarado. Frontend não cria verdade (lê a config).
- **Fronteira:** banner é apresentação, NÃO anúncio pago (boost proibido no MVP — coerente com
  ranking pack). Sem dinheiro. Anti-PII (é imagem pública escolhida pelo dono).

### 5D.1 CARROSSEL DE PRODUTOS EM PROMOÇÃO (bloco — Clayton 2026-07-04)
O dono pode incluir na página um **carrossel de produtos em promoção** (uma vitrine de destaque).
- **É PROJEÇÃO, não dado novo (Lei §5):** lê o catálogo/ofertas JÁ VIVAS (`product_offers`/canonical)
  filtrando os que estão em promoção (preço promocional/flag). NÃO cria tabela de "promoção" paralela
  — se "promoção" ainda não é atributo canônico da oferta, é atributo da OFERTA (a modelar no domínio
  de catálogo/preço), nunca na página. O carrossel só SELECIONA/ORDENA o que projetar.
- **Config (modo Operando):** o dono escolhe quais ofertas destacar + ordem → vive em `metadata`
  (ex.: `metadata.blocks.promoCarousel = { offerIds:[...], seconds }`), mesmo mecanismo, sem SSOT novo.
- **Server-driven (§2.4):** entra no contrato como um `block { type:'promo_carousel', data:[offers],
  deeplink }`; clicar → vai pra oferta (hub). Comprar = PORTA-1 (o card renderiza, checkout gated).
- **Preço/dinheiro:** o preço exibido é leitura do catálogo; a TRANSAÇÃO é PORTA-1. A página projeta,
  o Bank move.

## 6. FRONTEIRAS (invioláveis)

- **Dinheiro:** blocos "Comprar/Contratar" **renderizam**, mas a transação fica **atrás da PORTA-1**
  (decisão soberana). Ver `READINESS_PORTA1.md`.
- **Anti-PII:** CPF/nascimento/documentos/agenda-privada NUNCA aparecem na página pública.
- **Frontend não cria verdade:** cada bloco projeta o backend; ações roteiam pros fluxos vivos.
- **Autoridade:** a página não concede nada; toda ação sensível revalida `canRepresentActor`.

---

## 7. DECISÕES

**✅ Ratificadas por Clayton (2026-07-04):**
- Relação **assimétrica** (cada lado classifica, no envio E no aceite).
- **B2B** primeira classe (empresa↔empresa).
- Substrato de relação = **também o CRM** (um dado, N usos; aposenta `contacts` fantasma).
- **Colaborador:** rótulo de relação; ao aceitar, o dono pode atribuir permissões ali mesmo — via o
  substrato REAL de autoridade (`company_users` + mapa canônico), nunca por aceite social implícito.

**✅ Modelo de blocos** (casca universal + blocos-projeção por capability) = arquitetura da página
(ratificado no caminho A).

**✅ Conjunto inicial de tipos de relação APROVADO** (ponto de partida governado, extensível por RFC):
- PF↔PF: {amigo, conhecido, familiar}
- PF↔PJ: {cliente, colaborador, fornecedor}
- PJ↔PJ: {fornecedor, cliente, parceiro}

**🟡 Resolvidas NA fatia da página (fatia 3), não bloqueiam a fatia 1:**
- Barra de ações inicial (recomendação: começar sem-dinheiro — Conectar, Mensagem, Agendar,
  ver Produtos/Serviços, Chamado; Comprar/Contratar renderizam mas gated na PORTA-1).

---

## 8B. HORIZONTE — ORQUESTRAÇÃO B2B (Clayton 2026-07-04, NOMEADO, NÃO construir agora)

A aresta actor↔actor entre empresas não é só rótulo de CRM — pode virar **canal operacional vivo**:
quando A é fornecedor de B, a relação carrega **orquestração** (config na aresta): estoque de B cai
do limiar → o sistema **abre solicitação de orçamento (RFQ)** para A, ou **faz a compra** → pedido →
envio → recebimento → baixa/entrada de estoque automática. É o **ERP/cadeia de suprimentos** da visão
("empresas fazendo negócio entre si dentro do UnifiCard"; cadeia multi-elo fábrica→CD→loja→cliente).

**É composição, não arquitetura nova** (Lei §5): usa `inventory_movements` (LIVE) + a aresta de
relação + pedidos + agenda + ledger. Alinha `segmentos.md` #1 (mercado de ociosidade) / #2 (intenção
composta) e DECISION-0159 ("ERP Social" = composição).

**DISCIPLINA (segmentos.md):** *"a grandeza da visão é razão para mais disciplina, não menos."* Isto
é o **horizonte**, não a próxima fatia. Gated por: (a) o substrato de relação existir; (b) inventário
ligado à aresta; (c) **PORTA-1** (a compra move dinheiro = decisão soberana). O desenho só exige que
a aresta seja **desenhada para SUPORTAR** config de orquestração no futuro — **não** que se construa
agora. Constrói-se muito depois, quando as fundações estiverem de pé + GO explícito.

**NORTE (Clayton):** tudo isso serve a uma coisa — **facilitar a vida das pessoas.** Um sistema só,
menos atrito; a máquina faz o repetitivo (recompra automática, RFQ, baixa de estoque) para a pessoa
cuidar do que importa. Perfil unificado + relação + orquestração = menos telas, menos apps, mais vida.

---

## 8. SEQUÊNCIA DE FATIAS (só APÓS o selo)

1. **Substrato de relação tipada** (aresta actor↔actor governada) — base de tudo (gate chamado + plateias).
2. **Convite → aceite classificado** (conectar + escolher o tipo).
3. **Casca universal + registro de blocos** (o esqueleto que projeta os blocos por capability).
4. **Blocos sem-dinheiro** (Sobre, Posts, Serviços/Produtos-ver, Agenda/Horário, Localização).
5. **Plateias na leitura** (fecha a DT de post-visibility) — privacidade por camada.
6. **Chamado** (gated por conexão).
7. Comprar/Contratar = PORTA-1 (dinheiro, soberano).

---

*Desenho montado sobre o wireframe de Clayton + Lei de Coerência. DRAFT — nada de código até o selo.
A ordem e o "se" são decisão de Clayton; este doc só organiza pra decidir com o tabuleiro à vista.*

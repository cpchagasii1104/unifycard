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

---

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

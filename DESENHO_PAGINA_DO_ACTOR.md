# DESENHO CANÔNICO — PÁGINA DO ACTOR (perfil universal adaptativo)

> **Status:** 🟡 DRAFT — aguarda SELO de Clayton + 3 decisões de relação (§7). **Read-only: zero código
> até selar.** Origem: wireframe de Clayton (2026-07-04) + conversa de estrutura de perfil.
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

## 5. RELAÇÃO ENTRE ACTORS (o substrato que falta — e que gate o chamado/plateias)

Hoje só existe `follows` (seguir assimétrico). O wireframe pede **conexão + aceite classificado** +
**chamado gated por conexão**. Proposta:
- Uma **relação = aresta entre 2 actors**, com **tipo governado** (Lei §8 — sem texto livre).
- **Assimétrica:** cada lado classifica o outro (você=fornecedor; eu=cliente) — o Facebook (amizade
  simétrica) não expressa isso; a força do actor está aqui.
- **Relação ≠ autoridade:** aceitar conexão **nunca** concede `canManageCompany`/operar. Autoridade
  segue em `company_users`/delegação (blindado). Conexão = contexto/plateia, não poder.
- **Plateias** (privacidade por camada: público → conexões-de-tipo-X → só eu) leem essa relação.
  Precondição técnica: fechar `DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ` (hoje a visibilidade
  é gravada mas ignorada na leitura).

---

## 6. FRONTEIRAS (invioláveis)

- **Dinheiro:** blocos "Comprar/Contratar" **renderizam**, mas a transação fica **atrás da PORTA-1**
  (decisão soberana). Ver `READINESS_PORTA1.md`.
- **Anti-PII:** CPF/nascimento/documentos/agenda-privada NUNCA aparecem na página pública.
- **Frontend não cria verdade:** cada bloco projeta o backend; ações roteiam pros fluxos vivos.
- **Autoridade:** a página não concede nada; toda ação sensível revalida `canRepresentActor`.

---

## 7. 🔴 DECISÕES PENDENTES (Clayton — o desenho só sela com elas)

1. **Confirma o modelo de blocos** (casca universal + blocos-projeção dirigidos por capability) como
   a arquitetura da página do actor?
2. **Relação simétrica ou assimétrica?** (recomendo assimétrica — cada lado classifica o outro).
3. **Conjunto canônico inicial de tipos de relação** por par de actor (proponho uma lista mínima
   pra você editar: PF↔PF {amigo, conhecido, familiar}; PF↔PJ {cliente, colaborador, fornecedor};
   PJ↔PJ {fornecedor, cliente, parceiro}).
4. **Primeira barra de ações:** começar pelas ações **sem dinheiro** (Conectar, Mensagem, Agendar,
   ver Produtos/Serviços, Chamado) e deixar Comprar/Contratar renderizando mas gated na PORTA-1?

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

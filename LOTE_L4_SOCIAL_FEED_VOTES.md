# LOTE L4 — SOCIAL / FEED / VOTES / FOLLOW · Pacote de decisão

> **Data:** 2026-07-06 · branch `rescue-structural` · **Read-first vivo feito HOJE** (cartório + banco + decisions).
> **Estado do lote:** muito mais fechado do que parecia — **9 de 17 DTs já CLOSED** (feed/visibility/votes-schema-drift
> selados em junho-julho). O que resta são **4 decisões de produto** + 1 módulo morto-contido (votes).
> **Dependência-chave RESOLVIDA:** a raiz E2 (typed-edge `actor_relationships`) está CLOSED (2026-07-04) —
> o "follow" pode REUSAR esse substrato, não precisa criar tabela nova.

---

## Substrato vivo (medido hoje)

| Peça | Estado | Nota |
|---|---|---|
| `posts` | ✅ viva, 2 linhas | schema actor-keyed + `visibility` CHECK + `media_ids UUID[]` |
| `actor_relationships` | ✅ viva, 0 linhas | typed-edge E2 (amigo/cliente/fornecedor/parceiro/…), pronto pra follow |
| `group_votes` | ✅ viva, 0 linhas | actor-keyed, 3 writers gated+contidos |
| `votes` / `vote_sessions` / `feed_items` | ❌ GHOST | nunca materializados; módulo votes contido em 501 |

**Feed + visibilidade = PRONTO e selado.** `posts.visibility` (public/connections/only_me) é enforçado na
leitura (feed + getActorPosts), `connections` lê `actor_relationships`. As DTs de schema-drift do feed/votes
estão todas CLOSED com YALA PASS. **Não há decisão pendente no núcleo do feed** — ele funciona.

---

## D1 — FOLLOW: o UnifiCard adota "seguir" declarativo? (a decisão arquitetural)

**Estado:** as funções de follow no frontend são stubs (`{success:true}` → hoje `throw NOT_IMPLEMENTED`).
A raiz E2 (typed-edge) está pronta: seguir = uma aresta `actor→actor` no `actor_relationships` já vivo.
- **(a) SIM, follow declarativo reusando o typed-edge** — "seguir" vira uma relação `follows` (ou reusa
  `conhecido`) no `actor_relationships`; assimétrico (eu sigo você sem reciprocidade); alimenta o feed — **M**
- **(b) NÃO adota follow** — o feed é por relação declarada (amigo/cliente/…) + descoberta, sem "seguir"
  estilo rede-de-atenção — coerente com a tese "rede social como autogestão, não atenção" (project_vision) — **S** (só carimbo + remover os stubs)
- **Recomendação: decisão sua de PRODUTO, não técnica.** Tecnicamente (a) é barato (substrato pronto). MAS
  a visão do projeto (`project_vision`: "rede social como autogestão, não atenção") sugere que "seguir"
  estilo Instagram pode ser exatamente o que o UnifiCard NÃO quer. Se for (b), a limpeza é trivial. **Você
  decide o norte; eu executo qualquer um.**

## D2 — VOTES: qual a política de elegibilidade (quem cria/publica/vota)?

**Estado:** módulo `votes` está MORTO-CONTIDO (schema ghost, `req.activeActor` nunca populado, 4 writes →
501 honesto). Religá-lo exige 3 coisas, e a 1ª é decisão sua: **quem pode criar/publicar/votar** (política
social/membership/quórum). As outras 2 (binding de autoria por DECISION-0113 + enforcement de anonimato)
são execução.
- **(a) Definir a política e religar votes** (política → migration do schema → wiring do active-actor →
  binding de autoria → anonimato) — **L** (frente própria; o módulo inteiro renasce)
- **(b) Manter votes contido (501) por ora** — grupos já têm `group_votes` vivo (actor-keyed, gated); o
  módulo `votes` separado fica morto até haver demanda real — **S** (status quo honesto)
- **Recomendação: (b) por ora.** Já existe `group_votes` VIVO e gated para votação em grupo. O módulo
  `votes` separado é um segundo trilho ghost — religá-lo é uma frente grande sem demanda comprovada. Recomendo
  manter contido e, quando a governança democrática (fundo regional / project_vision) entrar em pauta,
  religar com a política definida. **Decisão de PRIORIDADE, não urgência.**

## D3 — MÍDIA no feed: qual canal de hidratação?

**Estado:** `posts.media_ids UUID[]` é gravado, mas o frontend retorna `media:[]` (graceful-degrade —
opção (c) ativa hoje). Não quebra o feed; só não mostra imagem.
- **(a) Tabela canônica de mídia** (media assets governados, tenant-iso) — o mais correto, mais caro — **M/L**
- **(b) Endpoint separado de hidratação** (resolve media_ids sob demanda) — **M**
- **(c) Expor media_ids nus + resolver no cliente** — o mais barato, menos governado — **S**
- **Recomendação: (a) como direção, (c)/(b) fora do MVP.** Mídia governada (tenant-iso, blob-iso) já é
  padrão em outras partes do sistema; o feed deveria convergir pra lá quando mídia entrar. Enquanto isso o
  graceful-degrade é honesto. **Baixa urgência** (feed funciona sem imagem). Decidir só quando mídia for prioridade.

## D4 — VISIBILIDADE DE GRUPOS: materializar a coluna ou confirmar aspiracional?

**Estado:** `groups.visibility` NÃO é coluna materializada; o código aspira `g.visibility='public'`, com fix
provisório `g.status='active'`. Zero UX de marcar visibilidade. Não bloqueia nada hoje (0 grupos).
- **(a) Materializar `groups.visibility`** (CHECK governado igual a `posts.visibility`) + UX — **M**
- **(b) Confirmar que grupo é sempre público por ora** (remover a aspiração morta, deixar explícito) — **S**
- **Recomendação: (b) por ora.** Com 0 grupos vivos, materializar visibilidade é especulativo. Recomendo
  tornar explícito "grupo = público no MVP" (limpar o `g.visibility` fantasma) e materializar quando grupos
  privados forem demanda real — reusando o CHECK de `posts.visibility` (vocabulário já governado).

---

## Itens de higiene (não são decisão)

- `DT-SERVICE-SOCIAL-FEED-ROUTE-NAMING-COLLISION` — OPEN/DEFERRED (conflito de rota). Fatia técnica, sem decisão.
- `DT-VOTES-WRITE-AUTHORSHIP-BINDING-LATENT` / `DT-GROUPS-VOTES-ANONYMITY-NOT-ENFORCED` — latentes, só
  aplicáveis SE D2 religar votes. Ficam dormentes até lá.

---

## Tabela-resumo

| # | Decisão | Recomendação | Custo |
|---|---|---|---|
| D1 | Follow declarativo? | Decisão de produto (visão sugere NÃO-atenção; (b) trivial, (a) barato) | S–M |
| D2 | Política de votes + religar? | Manter contido; group_votes já cobre grupo; religar sob demanda | S (agora) / L (depois) |
| D3 | Hidratação de mídia | Tabela canônica como norte; graceful-degrade fora do MVP | S–L |
| D4 | Visibilidade de grupos | "Público no MVP" explícito; materializar sob demanda | S |

**Leitura honesta:** L4 tem POUCA dívida executável e MUITA coisa já fechada. As 4 decisões são de
NORTE/prioridade, não bloqueadores — o feed já funciona. A mais estratégica é D1 (follow), porque toca a
identidade do produto (autogestão vs. atenção). As outras 3 podem ficar no status-quo honesto sem custo.
Tudo money-free; PORTA-1 HOLD.

# DECISION-0161 — Plateia de evento adaptada ao actor (RFC para ratificação)

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton; NADA codado)
**Data:** 2026-07-06 · **Origem:** achado de Clayton no navegador (wizard só oferece Privado/Público;
sem plateia por actor: amigos/parentes/colaboradores/fornecedores/lista) + diretriz "planejar antes
de codar, respeitando SSOT/nomenclatura/Lei de Coerência/ontologia/N0-N2".
**Prova de rastreabilidade (00_AGENT_PROTOCOL §2.2.2):** domínio = eventos (visibilidade) × social
(relações) × contrato de superfície. Lidos/aplicados: `LEI_DE_COERENCIA` §5 (uma pergunta, uma
resposta), `SSOT_REGISTRY` §5.16, `07_NOMENCLATURA` (tipo=CHECK), 00_PROTOCOL 2.3.3 (sem SSOT
paralelo/tabela sem contrato), APRENDIZADO.md (plateias/departamentos). SSOTs: evento = motor
`core/events`; relação = `actor_relationships` (typed-edge); atenção = `follows`. N0/N1/N2 = navegação,
NÃO tocados (plateia não é taxonomia de domínio).

---

## 1. Princípio (a regra de ouro desta decisão)

**Plateia NÃO é vocabulário novo — é COMPOSIÇÃO de vocabulários já governados.** Nenhum enum de
plateia nasce em tela (lição C1/F1: o dropdown de tipos de evento inventado em TSX acabou de morrer).

## 2. As peças governadas que JÁ EXISTEM (verificadas no código/banco vivo)

| Peça | Onde vive | O que dá |
|---|---|---|
| `events.visibility` | CHECK governado (`public\|private\|unlisted\|group\|followers`, migration 20260525100000) | O MACRO da plateia |
| `actor_relationships.requester_label` | CHECK governado do typed-edge L2 (`amigo\|conhecido\|familiar\|cliente\|colaborador\|fornecedor\|parceiro`) | O REFINAMENTO fino ("parentes"=familiar, "colaboradores", "fornecedores") |
| `follows` | tabela + RLS (hardening 20260706150000/160000) | plateia "seguidores" (já lida por `event-visibility.service`) |
| Padrão de enforcement | `posts.visibility` Fatia 5 | plateia garante-se na LEITURA, no backend |
| Padrão de superfície | contrato C1 (`GET /composer/intents`) | server-driven, actor-adaptativo |

## 3. Decisão proposta (D1–D4)

**D1 — Modelo de plateia = macro + refinamento.** O evento continua com `events.visibility` (macro,
CHECK existente, INALTERADO). Ganha refinamento OPCIONAL `audience_relationship_types` (array de
valores DO CHECK do typed-edge — validado contra ele, nunca texto livre): `visibility='private'` +
`audience_relationship_types=['familiar','amigo']` = "só parentes e amigos". NULL = sem refinamento
(comportamento atual preservado; migração aditiva, zero breaking).

**D2 — Superfície é server-driven (padrão C1).** Novo contrato `GET /events/audience-options`
(gated por canRepresentActor): devolve as plateias POSSÍVEIS do actor ativo — PF: público / amigos /
família / seguidores / só-eu; empresa (page): público / colaboradores / clientes / fornecedores /
parceiros / grupo / seguidores. O wizard PROJETA o contrato (labels/ordem = UX; identidade = os
valores governados). Proibido hardcodar plateia em TSX.

**D3 — Enforcement na LEITURA (padrão Fatia 5).** `event-visibility.service` estende: além de
`followers` (via `follows`, já vivo), resolve refinamento via `actor_relationships` (viewer tem
aresta ACEITA do tipo exigido com o organizador → vê). Fail-closed: sem aresta, não vê. Nada de
filtro só no frontend.

**D4 — "Selecionar lista" (listas custom) = FORA desta decisão.** Lista = agrupamento nomeado de
arestas → exige RFC próprio (tabela nova sem contrato é proibida, 2.3.3). Registrado como evolução.

## 4. O que NÃO muda
`events.visibility` CHECK (intocado) · typed-edge (intocado — só LIDO) · N0/N1/N2 (não é navegação) ·
dinheiro/PORTA-1 (HOLD; plateia não toca ingresso/pagamento).

## 5. Sequência de execução (após sua ratificação)
1. Migration aditiva (`events.audience_relationship_types` + CHECK-de-subconjunto) — S
2. Contrato `GET /events/audience-options` + testes — M
3. Wizard consome (substitui o Privado/Público hardcoded) — M
4. Read-enforcement + E2E (incl. probe RLS sob role restrito, template E2) + selo Yala — M
**F2 do composer (consumir C1) usa o MESMO padrão — executar em sequência.**

## 6. Pergunta única para você
Ratifica D1–D4 (macro+refinamento composto do typed-edge; superfície server-driven; enforcement na
leitura; listas ficam pra RFC próprio)? Basta "ratificado 0161" — e a sequência §5 roda no trilho.

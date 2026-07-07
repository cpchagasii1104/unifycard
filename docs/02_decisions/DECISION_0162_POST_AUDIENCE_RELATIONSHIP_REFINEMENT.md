# DECISION-0162 — Plateia refinada em POSTS (espelho da 0161, ratificada para eventos)

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton; NADA codado)
**Data:** 2026-07-06 · **Origem:** F2 do composer — o passo 1 "Para quem é isso?" hoje projeta só
`posts.visibility` (public/connections/only_me); empresa (PJ) só vê "Público". Clayton exige plateias
finas também em posts (colaboradores/fornecedores/clientes/parceiros — e família/amigos distintos p/ PF).

## 1. Decisão proposta (o MESMO desenho já ratificado na 0161 — zero conceito novo)
- **D1:** `posts` ganha `audience_relationship_types TEXT[]` NULL + CHECK de SUBCONJUNTO do vocabulário
  GOVERNADO do typed-edge (amigo|conhecido|familiar|cliente|colaborador|fornecedor|parceiro).
  `posts.visibility` (CHECK existente) INTOCADO. `visibility='connections'` + refinamento = "só estes
  tipos de conexão"; NULL = comportamento atual (qualquer conexão aceita).
- **D2:** contrato server-driven de plateia de post (mesmo shape do `GET /events/audience-options`;
  candidato: rota irmã ou generalização `GET /audience-options?surface=post|event` — decidir na execução
  SEM duplicar lógica). PF: Público/Amigos/Família/Só-eu; PJ: Público/Colaboradores/Clientes/
  Fornecedores/Parceiros.
- **D3:** enforcement na LEITURA estende o predicado da Fatia 5 (feed/getActorPosts): `connections` com
  refinamento exige aresta ACEITA de um dos tipos (mesma query da 0161 fatia 4).
- **D4:** listas custom = FORA (mesmo RFC futuro da 0161 D4).

## 2. Conformidade
Compõe de vocabulários JÁ governados (posts.visibility CHECK + RELATIONSHIP_LABELS); zero enum em tela;
enforcement no backend (Lei §5); N0-N2/CONCEPT intocados; nomenclatura 07 (snake_case, CHECK, COMMENT).

## 3. Sequência de execução (após "ratificado 0162")
1. Migration aditiva (espelho da `20260706170000`) — S
2. Contrato de plateia de post (reusando o composição da 0161) — S/M
3. Composer passo 1 consome o contrato (substitui o mapa local PF; PJ ganha as finas) — S
4. Read-enforcement no feed + E2E (padrão familiar-vê/amigo-não) + selo Yala 0161+0162 juntas — M

## 4. Pergunta única
Ratifica D1–D4 (espelho fiel da 0161 aplicado a posts)? "ratificado 0162" → sequência §3 roda no trilho.

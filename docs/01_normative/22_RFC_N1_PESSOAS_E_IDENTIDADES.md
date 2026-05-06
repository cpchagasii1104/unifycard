# RFC — EXTENSAO N1 PARA `pessoas-e-identidades`

**Documento Normativo (Proposta RFC) — Versao 0.1.0**  
**Data:** 2026-03-26  
**Status:** RASCUNHO PARA APROVACAO FORMAL (RFC PENDENTE)  
**Base:** `18_DOMAIN_ONTOLOGY_UNIFICARD.md` + `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md`  

---

## 1. OBJETIVO DO N1 DE `pessoas-e-identidades`

Definir a camada de navegacao (LAYER 2) para o dominio N0 `pessoas-e-identidades`, sem alterar os papeis canonicos das demais camadas.

Regra central:

```text
N1 = navegacao de descoberta
N1 != semantica (CONCEPT/GRAPH)
N1 != read model de perfil (LAYER 3)
```

Esta extensao existe para fechar a lacuna entre:

- dominio N0 ja oficial em `domains.domain_key`;
- ausencia de N1 normatizado para identidade humana;
- necessidade de ponte governada com a arvore operacional de `categories`.

---

## 2. LISTA PROPOSTA DE SLUGS N1

Dominio alvo: `pessoas-e-identidades`

| # | slug N1 proposto | definicao de navegacao |
|---|-------------------|------------------------|
| 1 | `perfil` | descoberta de dados basicos e identificacao pessoal |
| 2 | `profissoes` | descoberta da dimensao de trabalho humano |
| 3 | `educacao` | descoberta de trilhas formativas e repertorio educacional |
| 4 | `interesses` | descoberta de gostos, afinidades e preferencias declarativas |
| 5 | `relacoes` | descoberta de vinculos humanos e circulos de conexao |

Observacao obrigatoria:

```text
Os slugs acima sao de navegacao.
Nao definem identidade semantica e nao substituem CONCEPT.
```

---

## 3. REGRA DE ORTOGONALIDADE ENTRE OS SLUGS

Os N1 de `pessoas-e-identidades` devem ser mutuamente exclusivos por finalidade de navegacao dentro do mesmo N0.

Matriz minima de fronteira:

| par | fronteira obrigatoria |
|-----|------------------------|
| `perfil` vs `interesses` | `perfil` cobre identificacao e base cadastral; `interesses` cobre afinidade declarativa |
| `profissoes` vs `educacao` | `profissoes` cobre papel de trabalho; `educacao` cobre historico/trilha de formacao |
| `profissoes` vs `relacoes` | `profissoes` organiza ocupacao; `relacoes` organiza vinculos entre pessoas |
| `educacao` vs `interesses` | `educacao` organiza formacao estruturada; `interesses` organiza preferencia livre |
| `relacoes` vs `perfil` | `relacoes` organiza conexoes; `perfil` organiza dados do individuo |

Regra de validacao:

```text
Nenhum slug N1 pode:
- representar outro N0;
- reclassificar semantica de CONCEPT;
- agir como substituto de CONTEXT/PROFILE.
```

Clausula anti-colisao com N0 `comunidades-e-grupos`:

```text
`relacoes` em pessoas-e-identidades cobre vinculo entre individuos.
Estruturas coletivas (grupo, comunidade, organizacao social) pertencem ao N0 proprio.
```

---

## 4. REGRA DE CONVIVENCIA COM `categories.scope='professional'`

Norma explicita de nao-duplicacao:

```text
Existe uma unica arvore profissional operacional:
categories (scope='professional')
```

Regras obrigatorias:

1. `n1_nodes` nao pode virar arvore profissional paralela.
2. `profissoes` (N1) e filtro de navegacao; nao e SSOT de profissao.
3. Semantica de profissao continua em `categories` + `concept_id`.
4. Quando necessario, a ponte oficial e:
   `category_n1_mapping -> categories.concept_id -> CONCEPT`.
5. E proibido mover identidade semantica para `n1_nodes.slug`.

Clausula de integridade:

```text
Qualquer evolucao de N1 em pessoas-e-identidades
deve preservar:
- uma unica arvore profissional em categories;
- concept_id obrigatorio nos fluxos que exigem derivacao semantica;
- separacao estrita entre navegacao, semantica e perfil.
```

---

## 5. CRITERIO DE INCLUSAO E EXCLUSAO (N1 IDENTIDADE)

Entra em N1 de `pessoas-e-identidades` somente o que cumpre simultaneamente:

1. dimensao humana estavel de descoberta;
2. utilidade de navegacao sem transferir semantica para N1;
3. fronteira clara sem sobreposicao com N0 adjacentes.

Nao entra:

- produto, servico ou item transacional;
- estrutura de monetizacao direta;
- modelagem de comunidade/grupo como se fosse vinculo individual.

Teste de admissao (obrigatorio):

```text
Se o candidato depende de transacao para existir, nao e N1 identidade.
Se o candidato cria duplicacao de CONCEPT, nao e N1 identidade.
Se o candidato cabe em N1 ja existente sem perda de clareza, nao criar novo N1.
```

---

## 6. REGRA DE EVOLUCAO (CONTROLE DE NOVO N1)

Novo slug N1 em `pessoas-e-identidades` so pode ser proposto quando:

1. nao se encaixa em nenhum slug vigente sem ambiguidade;
2. mantem ortogonalidade com todos os slugs do dominio;
3. nao cria SSOT paralelo nem duplica semantica de CONCEPT;
4. possui justificativa formal de navegacao (nao de feature local);
5. passa por RFC e governanca antes de seed/migracao.

Proibicao explicita:

```text
E proibido criar N1 por conveniencia de feature, UX temporaria ou atalhos de filtragem.
```

---

## 7. LIMITES DESTA RFC

Esta RFC nao:

- altera o catalogo N1 ja congelado em `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md`;
- cria migracao SQL automaticamente;
- redefine N0 ou regras de CONCEPT/GRAPH.

Esta RFC apenas formaliza a extensao proposta para analise e aprovacao governada.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- 19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->
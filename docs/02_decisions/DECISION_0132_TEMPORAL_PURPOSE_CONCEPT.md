# DECISION-0132 — Finalidade temporal da agenda pessoal como CONCEPT (coarse-grained, sem novo domínio N0)

**Status:** **PROMULGADA / NORMATIVA.** **DOCS-ONLY** — zero código, zero migration, zero seed, zero coluna,
zero runtime, zero frontend. Esta DECISION promulga a ONTOLOGIA e as REGRAS da finalidade temporal; a
materialização é frente própria (FATIA 2 / commit 2), gated por esta DECISION.

**Data:** 2026-06-16 · **Branch:** `rescue-structural` · **HEAD vivo:** `c2301b24` · **dev:** 387/387 (sem
migration nesta fatia) · **Tipo:** arquitetural / ontologia (CONCEPT) · **Frente:** F-TEMPORAL-PURPOSE-CONCEPT-DECISION
· **Responsável:** Clayton / IA Diretora (executor: Claude Opus 4.8) · **Validação prévia:** Clayton + auditoria
READ-ONLY (F-AGENDA-PERSONAL-TIME-PURPOSE-CANONICALIZATION) + ADENDO Clayton 2026-06-16.

**Deriva de / subordinada a:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md` (§3 critério N0, §4.1 dimensões
transversais, §7 lista fechada de 12, §8.2 precedente `causas-sociais`) · `SSOT_REGISTRY_UNIFICARD.md` (§SSOT TEMPORAL
= `unified_availability`) · DECISION-0072 (B1 materialização da agenda) · DECISION-0118 (availability owner = recurso) ·
DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED.

---

## §0 — Natureza

A 0132 promulga a **finalidade temporal** ("para que serve este tempo do actor") como camada semântica canônica da
agenda pessoal, persistida como **CONCEPT** referenciado por `availability.purpose_concept_id`. É **coarse-grained**
(4 finalidades amplas), distinta da categoria da oportunidade (camada de outra frente). Não implementa matching.

## §1 — Contexto

A agenda pessoal (DECISION-0072 B1 → SSOT temporal `unified_availability` / tabela `availability`) registra janelas
de tempo do actor, mas **sem significado**: o usuário marca horários sem dizer se aquele tempo é trabalho, estudo,
autocuidado ou lazer. A frente F-AGENDA-EDITING-UX-TRUTHFULNESS-V2 removeu o seletor cosmético e abriu
DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED, exigindo que a finalidade fosse persistida **via CONCEPT**
(nunca metadata/enum solto/estado visual). Esta DECISION fecha o modelo.

## §2 — Decisão

1. **Finalidade temporal é CONCEPT.** Persiste como `availability.purpose_concept_id` (UUID, FK → `concepts`).
   A verdade é o `concept_id`. NÃO é metadata, NÃO é enum solto, NÃO é estado visual, NÃO é só UI.
2. **Quatro finalidades canônicas (coarse-grained)** — slugs:
   `trabalho` · `estudo` · `cuidados-pessoais` · `lazer`.
3. **SEM novo domínio N0.** Os 4 concepts moram em domínios N0 **existentes** (ver §3). A coerência "finalidade
   temporal" é dada pela **coluna `purpose_concept_id` + allowlist canônica dos 4**, não por um domínio próprio.
4. **Allowlist canônica:** o conjunto de finalidades válidas = os 4 concepts identificados por seus pares
   canônicos `(domain, slug)` (§3), resolvidos server-side para `concept_id`. Slug vindo do frontend é apenas
   DECLARAÇÃO; o backend valida (existe + é um dos 4 do allowlist) e grava `purpose_concept_id`.

## §3 — Por que NÃO um domínio N0 `tempo-e-finalidade` (correção normativa ao desenho inicial)

O desenho inicial propunha um domínio N0 `tempo-e-finalidade`. O READ-FIRST de `18_DOMAIN_ONTOLOGY_UNIFICARD.md`
mostrou que isso **viola a norma soberana CONGELADA**:

- **§7:** N0 é "**lista fechada de 12 domínios**"; **§11:** "N0 core (1-12) — **ESTÁVEL**, alterações exigem **RFC
  excepcional**"; **§2.2:** expansão ocorre via **promoção de condicional** ou **N1-N3 em domínio existente**, não
  por novo core casual.
- **§3 (critério N0):** um domínio exige entidade irredutível (1) / invariante única (2) / ciclo próprio (3).
  Finalidade temporal é um **classificador** da janela (a entidade é a própria `availability`), não tem entidade,
  invariante nem ciclo próprios → **falha o critério 1** (o prioritário).
- **§8.2 (precedente direto):** `causas-sociais-e-impacto` foi **removido** do N0 por falhar os 3 critérios; a
  "classificação correta" registrada pela norma foi `organizacoes + contexto + ` **`finalidade: impacto-social`**
  `+ dimensão`. Ou seja: **finalidade transversal NÃO vira domínio N0** — resolve-se como atributo/dimensão.

**Resolução (ratificada por Clayton, ADENDO 2026-06-16):** os 4 concepts moram em domínios N0 **naturais** existentes;
o **domínio do concept NÃO é limite rígido de matching** (é apenas a casa ontológica). Mapeamento canônico:

| finalidade (slug) | domínio N0 (casa ontológica) | observação |
|---|---|---|
| `cuidados-pessoais` | `saude-e-bem-estar` | explícito no ADENDO |
| `lazer` | `cultura-lazer-e-eventos` | explícito no ADENDO |
| `estudo` | `educacao-e-conhecimento` | mesmo padrão natural (casa do estudo) |
| `trabalho` | `servicos` | mesmo padrão natural (tempo produtivo / disponibilidade profissional) |

A "camada finalidade temporal" é declarada aqui como **dimensão semântica transversal** (no sentido de §4.1 — coexiste
com qualquer domínio, não o define); a formalização de uma dimensão com infraestrutura própria fica como opção futura,
não requerida pelo MVP (a coluna + allowlist bastam).

## §4 — Regra de booking (inicial)

Bookability é **regra derivada da finalidade**, avaliada no **gate de criação de booking** (aditiva; a `availability`
permanece blindada — não decide booking):

- `trabalho` → **bookável** por padrão.
- `estudo` · `cuidados-pessoais` · `lazer` → **protegidos / NÃO bookáveis** por padrão.
- `purpose_concept_id = NULL` (legado) → **bookável** (compatibilidade com janelas pré-0132).

**NÃO existe coluna `is_bookable`** (evita dupla verdade — bookability é função da finalidade). Override por-janela
(abrir um tempo protegido pontualmente) = frente futura.

## §5 — Validação backend (vinculante)

Slug do frontend = **declaração**, não autoridade. O backend, ao receber finalidade por slot, deve:
(1) confirmar que o concept **existe**; (2) confirmar que pertence ao par canônico `(domain, slug)` do allowlist;
(3) confirmar que é **um dos quatro**; só então gravar `purpose_concept_id`. Slug inválido → **400**. Ausência → `NULL`.
Concept_ids do gate de booking resolvidos **server-side** por `(domain, slug)` — nunca comparar string crua da UI.

## §6 — Finalidade temporal ≠ categoria comercial (ADENDO Clayton 2026-06-16, vinculante)

- **Agenda = intenção AMPLA do tempo** (coarse-grained). **Oportunidade/oferta/post/empresa = categoria específica.**
- `availability.purpose_concept_id` representa a **finalidade daquele tempo do actor** — **NÃO** a categoria da
  oportunidade futura. A UI da agenda oferece **apenas** Trabalho/Estudo/Cuidados Pessoais/Lazer e **NÃO** pede
  academia/manicure/cabeleireiro/restaurante/bar/futebol/cinema/curso/evento/consulta/serviço/categoria comercial.
- **O domínio do CONCEPT não limita sozinho o matching futuro.** Exemplos (ilustrativos, não implementados):
  `cuidados-pessoais` (casa em `saude-e-bem-estar`) poderá futuramente combinar com beleza, estética, academia,
  cabeleireiro, manicure, spa, fisioterapia, autocuidado; `lazer` (casa em `cultura-lazer-e-eventos`) poderá combinar
  com gastronomia, restaurante, bar, futebol, cinema, teatro, passeio, experiências.
- **Matching futuro (frente posterior)** cruzará: **finalidade temporal do usuário + categoria/concept da oportunidade
  + janela temporal da oferta/post/promoção**. Esta frente **não** implementa matching, matriz de compatibilidade,
  categorias comerciais, nem transforma a agenda em formulário complexo.

## §7 — Escopo negativo (fora desta frente)

Matching social/empresarial · matriz de compatibilidade · promoções · ofertas · preço · desconto · estoque ·
serviços/categorias comerciais · Bank/ledger/payout/split/recovery · `schedules`/`schedule_slots` ·
`calendar_events` legado · RLS · `is_bookable` · alterar E1/E2/B1f. Nada disso entra na 0132 nem na materialização.

## §8 — Consequências esperadas

- **Curto prazo:** a agenda pessoal ganha finalidade por janela (CONCEPT), lida de volta por slot; estudo/cuidados/lazer
  protegidos no gate de booking; trabalho/NULL bookáveis. SSOT temporal segue `unified_availability`. Ontologia N0
  intacta (zero emenda a seção CONGELADA).
- **Médio prazo:** base semântica pronta para a frente de matching (tempo × finalidade × categoria/janela da
  oportunidade), sem que a agenda carregue taxonomia comercial.

## §9 — Relação com normas e DTs

- **DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED:** esta DECISION é a "decisão própria via CONCEPT" que a DT
  exigia. A DT passa a **materializada/CLOSED** SOMENTE após a FATIA 2 (commit 2) implementar.
- **DECISION-0072 (B1):** `unified_availability` segue o **único** SSOT temporal; finalidade é coluna nele, não tabela
  nova nem metadata.
- **CONCEPT (18_DOMAIN_ONTOLOGY §5):** CONCEPT é o **SSOT semântico**; governança de INSERT (§5.5 / trigger
  `enforce_concept_governance`) é obrigatória no seed dos 4.
- **Proibição explícita:** finalidade temporal **nunca** como metadata, enum solto ou estado visual como verdade.

## §10 — Ordem causal (vinculante)

- **COMMIT 1 (esta fatia):** DECISION docs-only. Zero migration/seed/coluna/runtime/frontend.
- **COMMIT 2 (FATIA 2, frente própria):** seed governado dos 4 concepts nos domínios naturais (ON CONFLICT DO NOTHING) ·
  `ALTER TABLE availability ADD COLUMN purpose_concept_id UUID NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT`
  + índice · contrato weekly-template por slot (slug→concept_id validado pelo allowlist) · gate de booking · frontend
  (4 opções; blocos protegidos não-bookáveis) · provas (e2e/guard/neg-proof/gates) · cartório.

## §11 — Estado

DECISION-0132 **PROMULGADA / NORMATIVA — HOLD PARA RESEAL.** Finalidade temporal = CONCEPT coarse-grained em
`availability.purpose_concept_id`; 4 concepts (`trabalho`/`estudo`/`cuidados-pessoais`/`lazer`) em domínios N0 naturais
(sem novo domínio N0, ontologia CONGELADA preservada); booking inicial (trabalho/NULL bookáveis; estudo/cuidados/lazer
protegidos); finalidade ≠ categoria comercial; matching deferido. **Sem código/migration/seed/runtime nesta DECISION.**

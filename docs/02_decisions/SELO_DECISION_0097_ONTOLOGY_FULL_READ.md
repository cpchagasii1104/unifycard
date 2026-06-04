# Selo da DECISION-0097 — leitura integral da Ontologia (prova normativa fechada)

**Status:** PROMULGADO / SELO DOCUMENTAL — fecha o gap procedural de prova normativa da DECISION-0097. **DOCS-ONLY / SEM CÓDIGO / SEM SCHEMA / SEM MIGRATION** (2026-06-04).
**Data:** 2026-06-04.
**Tipo:** selo documental / retificação de prova (§2.2.2).
**Sessão:** 2026-06-04 — frente `F-PJ-0097-NORMATIVE-PROOF-SEAL`. **Commit âncora:** `945b5dc6` (DECISION-0097 promulgada).
**Decisor/promulgação:** Clayton. **Executor:** Claude (`unificard`).
**Sela:** `DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION.md`.
**Subordinado a:** `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 7), `00_AGENT_PROTOCOL.md` (§2.2.2).

---

## 1. Contexto

A DECISION-0097 (modelo canônico de nascimento/ativação operacional da empresa PJ) foi promulgada em `945b5dc6`. A prova de rastreabilidade normativa daquela sessão (§2.2.2) declarou **honestamente** que o `18_DOMAIN_ONTOLOGY_UNIFICARD.md` foi lido **"parcial"** — na prática, ~120 das 949 linhas (princípios + critério N0 + camadas).

Uma auditoria **GUARDIÃO READ-ONLY** posterior (mesma data) leu o `18_DOMAIN_ONTOLOGY_UNIFICARD.md` **integralmente (949 linhas)** e verificou o estado vivo. Este selo registra esse fechamento de prova.

## 2. Escopo

- **Fecha** o gap **procedural** de prova normativa (doc obrigatório de ontologia lido parcialmente na sessão da 0097).
- **NÃO altera** as decisões D1–D10 da DECISION-0097 (nenhuma mudança substantiva).
- **NÃO autoriza** schema/código/migration/frontend/backend.
- É **pré-condição documental** para qualquer execução derivada da DECISION-0097 (ex.: Fase 3.3).

## 3. Achados confirmatórios do `18_DOMAIN_ONTOLOGY_UNIFICARD.md` (leitura integral)

A leitura completa **confirma e reforça** D5/D6 da DECISION-0097, sem contradição:

1. **CONCEPT é a identidade semântica (SSOT)** — LAYER 1; `canonical_id` imutável; criação só via pipeline de governança (§5, §5.5, §20). Reforça D6 ("CONCEPT é identidade").
2. **GRAPH (LAYER 6) modela relações entre CONCEPTs** — triple store com `relation_types` (`enables`/`requires`/`part_of`/`related_to`/`substitutes`) (§6, §10.3). Reforça D5 ("ambos" = dois trilhos relacionados por GRAPH, não nó híbrido).
3. **N0/N1/N2/`categories`/`n1_nodes` NÃO substituem CONCEPT** — são navegação/árvore/UX (§19, §20, §21, §23 anti-patterns). Reforça D5/D6.
4. **`produtos-e-comercio` (N0 #4)** e **`servicos` (N0 #5)** são domínios **distintos e irredutíveis** (§7, critérios 1+3). Reforça D5 (seleção de domínios N0; "ambos" = união de dois).
5. **`construcao-e-infraestrutura` (#13) é domínio condicional, elegível e NÃO ativado** (§8.1 — passa critérios 2/3, não o 1). Confirma a classificação do desenho (obra com ART = N0 condicional não ativado).
6. **`canonical_product` é materialização operacional, depende de CONCEPT** (§5.1.1, CONGELADO). Reforça o Trilho A (produto nasce de CONCEPT, não de nome).
7. **Anti-patterns explícitos** (§23): proibido inferir semântica por `slug`, conectar módulos por `category_id`/nome, criar SSOT semântico concorrente. Confirmam a separação usada na DECISION-0097.

Nenhum trecho do documento (incluindo o antes não-lido, §5–§23) **contradiz** D1–D10. O `18_DOMAIN_ONTOLOGY` está marcado **CONGELADO** (§14), o que reforça a estabilidade da base ontológica sobre a qual a 0097 se apoia.

## 4. Veredito

- **DECISION-0097 APROVADA sem rework substantivo.** A leitura integral da Ontologia **ratifica** D5/D6.
- O gap era **procedural** (prova de ontologia incompleta na sessão da 0097), **não substantivo** (nenhuma conclusão errada; a prova original disclosou "parcial" — não houve falsa alegação de completude).
- Execuções derivadas da DECISION-0097 **podem prosseguir** — em fatias próprias, sob a palavra de Clayton — **somente após este selo**.

## 5. Bloqueios mantidos (esta sessão NÃO autoriza)

- NÃO executar Fase 3.3 nesta sessão.
- NÃO tocar `company_status` (CHECK/normalização).
- NÃO dropar `is_verified`.
- NÃO alterar frontend/backend/schema/migrations.
- NÃO tocar Bank.
- NÃO implementar onboarding/vocabulário.

## 6. Próxima fila recomendada (sem execução — decisão de sequência de Clayton)

1. **`F-PJ-3.3-COMPANY-STATUS-SCHEMA-COMPAT`** — CHECK em `company_status` (gated em política de dados legados não-zero); destino de `is_verified` (drop só após migrar consumidores do payload/contrato). Second-truth já isolada (zero writer/reader vivo de VERIFIED — auditoria 2026-06-04).
2. **`F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION`** — reconciliar `businessType`×`businessCategory`×`hybrid`×par `(primary_company_type_id, primary_concept_id)`; o par é o SSOT, os outros são legado/UX/metadata. (`DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT`.)
3. **`F-PJ-ONBOARDING-DOMAIN-SELECTION-DESIGN`** — materializar "produtos/serviços/ambos" → N0 → par; `tenant_concept_offerings` sem writer no onboarding. (`DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING`.)

## 7. Superado por

(em aberto — selo vigente)

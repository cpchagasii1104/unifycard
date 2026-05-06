# C.25 — Especificação da «camada de inferência / sugestão» e do gate CI



**Tipo:** especificação operacional (definição de linguagem para CI e review)  

**Status:** `[✓]` **LISTA FECHADA** (2026-04-09) — aprovação de execução do plano mestre + log `docs/03_execution_log/2026-04-09_c25_spec_completed.md`  

**Não é:** norma em `docs/01_normative/`; não substitui `PRODUTO_PLANO_MESTRE_COMPLETO.md` (**C.1**–**C.34**).



## Precedência



1. `docs/01_normative/` (incl. `00_AGENT_PROTOCOL.md`, `AUTHORITY_LAW.md` **Art. 11–14**, Lei 5 / SSOT financeiro).  

2. `PRODUTO_PLANO_MESTRE_COMPLETO.md` — **C.1**, **C.10**, **C.19**, **C.22**, **C.25**, **EIXO 9** / **C.31–C.34**.  

3. **Este ficheiro** — vincula listas §1–3 para review humano e futura automação **opt-in** de inferência (regras §4 #1–3); o gate **#4** (C.22) permanece independente.



**Regra de ouro:** regex de CI sobre a palavra «infer» ou padrões vagos = **proibido** (falsos positivos) — ver §4 nota.



---



## 1. Onde **pode** existir inferência / sugestão (lista fechada)



*Caminhos relativos à raiz do repo. Efeito: apenas propostas, filas `pending`, ou texto de UI — **nunca** `concept_ref` final em trilhos proibidos na §2.*



| # | Módulo / pasta | Rotas ou pontos de entrada | Serviços / ficheiros | Notas |

|---|----------------|----------------------------|----------------------|-------|

| 1 | `backend/src/modules/marketplace/` | `store-onboarding.routes.ts` (onboarding assistido) | `store-onboarding.service.ts` (`createStoreOnboarding`, `listAvailableCatalogProducts`) | Selecção de recortes canónicos; sem substituir adapter em checkout. |

| 2 | `backend/src/modules/marketplace/` | Rotas de categorias / catálogo só-leitura para UI | `marketplace-categories.service.ts`, `product-catalog.service.ts` (listagens governadas) | Sugestão de categoria **pré-canonical**; sem escrita de `concept_ref` de execução. |

| 3 | `docs/02_decisions/` + scripts de backfill | RFC e scripts **offline** | `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`, `backend/src/scripts/*` | Classificação / normalização **fora** de request de checkout ou intent. |



---



## 2. Onde é **proibido** (lista fechada — negação explícita)



*O CI e o review tratam qualquer inferência/sugestão **decisória** nestes sítios como **violação** (salvo isenção escrita no PR + **C.24**).*



| # | Zona | Motivo (contrato) |

|---|------|-------------------|

| 1 | **Checkout / intent / offer** (determinação de `concept_ref` para execução) | **C.1**, **C.10**, **C.19** |

| 2 | **`concept-offer-refs.adapter.ts`** e qualquer duplicado de resolução de `concept_ref` | **C.10** |

| 3 | **Trilhos de ledger / liquidação / `bank_*` SSOT** | Lei 5, fronteira Bank |

| 4 | **Leitura directa de `concept_id` em `canonical_products` para substituir o adapter** em fluxo de compra | **C.19** |

| 5 | **Qualquer escrita** em `canonical_products` / resolução de conceito **motivada só por inferência** sem comando explícito de domínio | **C.1**, **C.10** |



---



## 3. **Como** inferir (padrões aceites e limites)



| Tópico | Decisão |

|--------|---------|

| Entradas permitidas ao motor de sugestão (sinais) | GTIN, fingerprint, metadados de produto **ainda não** ligados a intent; slugs de onboarding **proposta** apenas. |

| Saídas permitidas | `suggested_*`, filas `pending`, texto de UI; **nunca** `concept_ref` final em §2. |

| Limites (rate, blast radius, kill switch humano) | **AUTHORITY_LAW.md** Art. 11; revisão humana obrigatória antes de `confirmed`. |

| Persistência permitida vs só em memória | Propostas `pending` persistíveis; decisão `confirmed` só via trilho explícito (comando / humano). |



### Padrões **proibidos** (anti-padrão)



- `SELECT concept_id …` (ou campo equivalente) **directo** no checkout ou intent para montar execução, contornando `concept-offer-refs.adapter`.  

- Inferência de identidade semântica **fora** dos módulos da §1.  

- **Fallback semântico** (ex.: «parece» categoria Y quando falta `concept_ref`) em trilho de execução ou ledger.  



---



## 4. **Como** o CI valida (o que bloqueia exactamente)



*O gate **#4** (anti-regressão C.22, `gate-canonical-sql-patterns.mjs`) **corre** independentemente das listas §1–3.*



| # | Padrão ou condição | Acção CI (fail se…) | Regex / caminho / regra |

|---|-------------------|---------------------|-------------------------|

| 1 | Import ou chamada de módulo de inferência fora da **allowlist §1** | `exit 1` (quando job **C.25-inferência** estiver activado) | *Pendente implementação:* allowlist = globs §1 coluna «Módulo»; até lá só review. |

| 2 | Uso de `category_id` / categoria como **identidade** em trilho proibido **§2** | `exit 1` | Alinhar **C.22** + **C.31**; grep manual em PR. |

| 3 | `concept_id` lido de `canonical_products` em ficheiros sob `intent-execute` / `checkout` / `ledger` | `exit 1` (quando regra activada) | *Pendente:* lista de pastas = §2 linhas 1–3. |

| 4 | Anti-regressão **C.22** (join scoped-only legado) em `backend/src/**/*.ts` | `exit 1` se encontrado | `pnpm run check:canonical-gates` → `backend/scripts/gate-canonical-sql-patterns.mjs` |



---



## 5. Exemplos reais (bom vs proibido)



| Cenário | Classificação | Referência |

|---------|---------------|------------|

| Sugestão de slugs de onboarding gravada como **proposta** `pending` para humano | **Bom** | EIXO 9, RFC ponte |

| Regex de CI que falha qualquer ficheiro que contenha a palavra «infer» | **Proibido** | **C.25** RISCO histórico |

| Ler `concept_id` de `canonical_products` no checkout sem adapter | **Proibido** | **C.19** |

| `listAvailableCatalogProducts` com `DISTINCT ON (gtin)` scoped-first | **Bom** (listagem C.20) | `store-onboarding.service.ts` |



---



## Fecho deste spec



1. Registado: `docs/03_execution_log/2026-04-09_c25_spec_completed.md`.  

2. Estado → `[✓] LISTA FECHADA` (cabeçalho).  

3. `PRODUTO_PLANO_MESTRE_COMPLETO.md` **C.25** — alinhar checklist e RISCO (lista fechada).  

4. Automatização adicional dos itens §4 #1–3 = **opcional** (PR separado; não bloqueia gate C.22).



---



## Ligações



- `PRODUTO_PLANO_MESTRE_COMPLETO.md` — **C.25**, **C.31**, **EIXO 9**  

- `docs/02_decisions/SEMANTIC_CATALOG_GOVERNANCE.md` — monitor C.25  

- `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md` — ponte sinais → onboarding; § PROIBIDO; teste de desligamento; mapa de chamadas


# Execution Log — γ: Seed MVP da matriz CNAE→concept

**Data:** 2026-06-05
**Modo:** EXECUTOR CONTROLADO (esteira: Executora escreve, par verifica, Clayton serializa)
**Branch:** `rescue-structural`
**HEAD origem:** `a9d48572`
**Frente:** `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-SEED-MVP` (γ)
**Autorização:** Clayton (γ autorizado + tabela curada das 7 verticais)

---

## Objetivo
Seed MVP **seletivo** da matriz `cnae_concept_suggestions` (DECISION-0104), só as 7 verticais vivas. CNAE é sinal/sugestão, não autoridade. Code/seed-only; zero activation/publish/offering/Bank/Trilhos.

## Verificação pré-seed (antes de escrever — 2 catches)
1. **Schema vivo conferido** (`cnae_concept_suggestions`): colunas `cnae_code/suggested_concept_id/confidence/rationale/source/catalog_version/review_status/is_active`. **Sem** `company_type` (correto, 0104) nem `cnae_code_normalized`.
2. **CATCH 1 — `confidence` categórica, não numérica:** CHECK `confidence IN ('low','medium','high')`. Os 0.95/0.85 de Clayton **não passariam**. Mapeados preservando a intenção (primário>secundário): primário=`high`, salão estética `9602502`=`medium`.
3. **CATCH 2 — formato do CNAE:** a evidência (`fiscal_identity_economic_activities`) grava o CNAE **como o provider retorna** (`fiscal-identity-economic-activity.service:70`, só `trim()`). Escolhi `cnae_code`=**normalizado (dígitos)** na matriz (chave canônica robusta, formato fornecido por Clayton) e registrei a **costura** em `DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM`.
4. **Validação obrigatória:** os 7 concepts existem (7/7) e todos são allowed-pairs em `company_type_allowed_concepts`.

## Seed (migration `20260605120000_seed_cnae_concept_suggestions_mvp.sql`)
- 8 linhas: 7 primárias `high` + salão estética `9602502` `medium` (secondary-beauty-scope).
- `suggested_concept_id` resolvido **por slug** (JOIN concepts), **não** hardcode UUID.
- Guard allowed-pair (EXISTS em `company_type_allowed_concepts`).
- **Fail-closed:** `DO`/`RAISE EXCEPTION` se `COUNT <> 8` (slug não resolvido/não allowed → aborta, sem seed parcial).
- Idempotente: `ON CONFLICT (cnae_code, suggested_concept_id) DO NOTHING`.
- `review_status='approved'`, `source='clayton_curated_mvp_2026_06_05'`, `catalog_version='2026-06-05-mvp-7-verticals'`.

## Mapa semeado
| CNAE (norm.) | concept | confidence |
|---|---|---|
| 4711302 | varejo-alimentar-integrado | high |
| 4724500 | varejo-alimentar-especializado-hortifruti | high |
| 4722901 | varejo-alimentar-especializado-carnes | high |
| 4721102 | varejo-alimentar-especializado-padaria | high |
| 4771701 | saude-varejo-farmaceutico | high |
| 9602501 | servicos-pessoais-beleza | high |
| 9602502 | servicos-pessoais-beleza | medium |
| 5611201 | alimentacao-servico-preparado | high |

## Provas (10/10)
1. 7 verticais 1:1 com concepts ✓. 2. Cada CNAE→suggested_concept_id ✓ (8 linhas resolvidas). 3. Não escreve activation (`primary_*`) ✓. 4. Não publica ✓. 5. Não cria offering ✓. 6. Não toca Bank ✓ (grep: só comentários). 7. Idempotente (2ª aplicação=8) ✓. 8. Sem importar CNAE inteiro ✓ (8 curadas). 9. Sem `primary_*` no seed ✓. 10. 4 gates verdes (361 migrations, numeração única; arch critical_new=0).

## Aplicação
Aplicado em `unificard_dev` via psql (idempotente) para prova: 8 linhas; 2ª aplicação = 8. O runner canônico reconcilia (idempotente — INSERT no-op + gate passa).

## DTs
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → permanece **PARTIALLY MITIGATED** (seed feito; falta read endpoint).
- **Criada** `DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM` (OPEN).

## Não-toque
Zero activation/publish/offering/Bank/Trilhos A/B; sem tocar writer da evidência; 3 autorais intocados.

## Próximo (espera Clayton)
Read endpoint de sugestão CNAE→concept · display name de concept · ou profundidade Trilhos A/B (frente própria). Trilhos A/B bloqueados até desenho.

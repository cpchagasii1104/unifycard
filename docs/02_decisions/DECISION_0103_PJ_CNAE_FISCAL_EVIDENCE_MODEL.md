# DECISION-0103 — Modelo canônico de persistência de CNAE/atividade econômica como evidência fiscal PJ

**Data:** 2026-06-04
**Tipo:** Arquitetura / Identidade fiscal / Evidência cadastral PJ
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/writer)
**Frente:** `F-PJ-CNAE-EVIDENCE-PERSIST`
**HEAD de origem:** `e064c36f`

---

## 1. Título
CNAE/atividade econômica da Receita é **evidência fiscal auditável**, não identidade semântica. Mora na **casa
fiscal** (`fiscal_identities` + satélites), em modelo **1:N** (`fiscal_identity_economic_activities`), com
`source`/`fetched_at`, buscada **backend-side**, **fail-open** no nascimento, **sem QSA bruto** (LGPD). Decide onde
guardar a evidência — não grava a evidência ainda.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetura / Identidade fiscal / Evidência cadastral PJ. Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration, writer ou provider (ver §11/§D14).

## 5. Contexto
DECISION-0102 fixou que domínio de atuação deriva de CONCEPT + **evidência fiscal** (modelo de 6 camadas: fiscal →
identidade → elegível → solicitado → aprovado → em-revisão), e que CNAE/Receita/CNPJ são evidência, não SSOT. A
auditoria read-only `F-PJ-CNAE-EVIDENCE-PERSIST` mostrou que o backend **já busca** CNAE/natureza (ReceitaWS +
BrasilAPI), mas **descarta** tudo na persistência — não há onde guardar. Esta DECISION crava a casa e o que pode ser
persistido, **antes** de schema/código (norma antes de schema, padrão 0099/0100/0102).

## 6. Problema
A evidência fiscal mais forte de ramo real (CNAE/natureza) é coletada e jogada fora. Sem persistência governada, a
elegibilidade de domínios (DECISION-0102) não tem o degrau 1 (evidência fiscal). Além disso há um **ghost latente**:
o `companies.service` lê/escreve colunas de atividade que não existem em `companies` (42703 latente no update).

## 7. Evidência material (auditoria read-only F-PJ-CNAE-EVIDENCE-PERSIST)
1. `companiesService.fetchCNPJFromRevenue(cnpj)` busca **backend-side** (ReceitaWS `receitaws.com.br` → fallback
   `brasilapi.com.br`; não-bloqueante, null em falha).
2. Retorno inclui: CNAE principal (code+text), CNAEs secundários (code+text), `natureza_juridica`, `porte`,
   `capital_social`.
3. O frontend também recebe via `POST /companies/fetch-cnpj` (prefill) — mas frontend **não é fonte confiável** de evidência.
4. `createCompany` (linha ~335) já faz o fetch backend-side e **extrai** `activity` localmente (mainActivityCode/
   Description + secondaryActivities); `natureza_juridica`/`porte`/`capital` são ignorados.
5. O dado extraído **não é persistido**.
6. `companies` (14 colunas) **não tem** CNAE/atividade/natureza/revenue/metadata.
7. `fiscal_identities` (9 colunas: fiscal_identity_id, cnpj, kyb_status, created_by/reviewed_by_actor_id, reviewed_at,
   decision_reason, timestamps) **não tem** CNAE/atividade/natureza.
8. Não existe tabela viva de evidências econômicas fiscais (as `economic_*` são outro subsistema).
9. **Ghost latente:** os mappers leem `row.main_activity_code`/`main_activity_description`/`secondary_activities`
   (colunas inexistentes → undefined); `updateCompany` ESCREVE `UPDATE companies SET main_activity_code=…` → **42703**
   se o caminho `activity` for exercido. Vestígio de colunas arquivadas.
10. CNAE/natureza/porte são dados cadastrais públicos de PJ; o payload BRUTO da Receita pode conter **QSA/sócios
    (nome/CPF)** — dados pessoais.
11. Persistir payload bruto/QSA = risco LGPD desnecessário.
12. `companies` é projeção/entidade operacional → evidência fiscal deve morar na **casa fiscal**, não na projeção.

## 8. Decisão
A evidência CNAE/atividade econômica é ancorada na **casa fiscal** (`fiscal_identities` + tabela satélite 1:N
`fiscal_identity_economic_activities`), buscada e verificada **backend-side**, com `source`/`fetched_at`, **fail-open**
no nascimento da empresa, persistindo **apenas atividade econômica/natureza/porte** — **nunca QSA bruto** (LGPD).
CNAE é **evidência**, não SSOT: não mapeia automaticamente para concept e não decide identidade operacional; pode
apenas **sugerir** candidatos em frente futura. O ghost `companies.activity` deve ser **limpo** (não recriar colunas
em `companies`). **Sem código/schema/migration nesta DECISION.**

## 9. Decisões D1–D14

**D1 — CNAE é evidência fiscal, não identidade semântica.** CNAE/atividade econômica da Receita é evidência
cadastral/fiscal da PJ. Não substitui CONCEPT, não substitui `(primary_company_type_id, primary_concept_id)`, não
autoriza publicação nem domínio por si só.

**D2 — Evidência fiscal mora na casa fiscal.** CNAE/atividade/natureza/porte são ancorados na **identidade fiscal**
PJ (`fiscal_identities` e satélites fiscais), **não** em `companies` (projeção).

**D3 — CNAEs são 1:N.** CNAE principal + secundários exigem modelo 1:N. Proibido enfiar CNAE numa única coluna textual
de `companies`; proibido usar JSONB de metadata como verdade.

**D4 — Modelo-alvo mínimo (autorizado a DESENHAR em frente futura, não a implementar agora).** Tabela
`fiscal_identity_economic_activities` com, no mínimo: `id`, `fiscal_identity_id`, `cnae_code`, `cnae_description`,
`is_primary`, `source`, `fetched_at`, `created_at`, `updated_at`. Opcionalmente, colunas 1:1 em `fiscal_identities`:
`legal_nature`, `company_size` (e `capital_social` somente se não houver conflito normativo).

**D5 — Não persistir QSA bruto.** Proibido persistir o payload bruto completo da Receita; proibido persistir
QSA/sócios/CPF na tabela de evidência CNAE. Armazenar QSA, se algum dia necessário, exige decisão própria de LGPD/KYB.

**D6 — Backend é a fonte de coleta.** A evidência CNAE é buscada/verificada **backend-side**. O frontend pode exibir
prefill, mas o backend **não confia** no CNAE enviado pelo frontend como evidência.

**D7 — `source` e `fetched_at` obrigatórios.** Toda evidência fiscal persistida deve ter `source` (`receitaws`,
`brasilapi`, outro), `fetched_at`, e idealmente indicação de provider/fallback.

**D8 — Fail-open no nascimento da empresa.** Criação/nascimento fiscal **não falha** porque Receita/BrasilAPI está
indisponível. Sem evidência, a empresa nasce sem CNAE e pode ser enriquecida depois (re-fetch governado).

**D9 — Evidência declarada vs fetched.** Dado digitado pelo usuário ≠ dado de fonte fiscal. Não misturar. CNAE
persistido como evidência vem de provider fiscal ou processo governado, não do que o usuário digitou.

**D10 — CNAE pode SUGERIR, não decidir.** Frente futura pode criar matriz CNAE → suggested company_type/concept; ela
**sugere candidatos**, não decide identidade operacional automaticamente (`DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING`).

**D11 — Elegibilidade de domínio vem depois.** Persistir CNAE é pré-requisito da elegibilidade futura, mas esta
DECISION **não** cria matriz de domínios. Elegibilidade real vem de CONCEPT/company_type/GRAPH governado (DECISION-0102).

**D12 — Ghost `companies.activity` deve ser limpo.** As leituras/escritas runtime para `main_activity_code`,
`main_activity_description`, `secondary_activities` em `companies` são drift/ghost (colunas inexistentes; 42703 latente
no update). A frente futura deve **remover** essas referências de `companies.service` (ou redirecioná-las ao modelo
fiscal). **Não criar** essas colunas em `companies` (`DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST`).

**D13 — Não reviver colunas arquivadas.** Proibido recriar colunas/tabelas arquivadas de atividade em `companies`.
Archive não é SSOT vigente.

**D14 — Bloqueios.** Esta DECISION NÃO autoriza: código; migration; writer; alteração de provider; mapeamento
CNAE→concept; elegibilidade de domínios; persistência de QSA; JSONB bruto da Receita; colunas CNAE em `companies`;
frontend changes; marketplace changes; Bank; KYB writer.

## 10. O que esta DECISION ratifica
- **Executa o degrau 1 (evidência fiscal) de DECISION-0102** (modelo 6 camadas), fixando casa/shape/LGPD/governança.
- **Ratifica** `fiscal_identities` como casa fiscal PJ (DECISION-0085/0097 D3) e CONCEPT como SSOT semântico (Lei 7).
- **Ratifica** EMPRESA_NASCIMENTO §8 (empresa nasce inerte; evidência fail-open) e `archive não é SSOT vigente`.

## 11. O que NÃO está autorizado
Ver D14. Em particular: nenhuma migration/writer/coluna; nenhum mapeamento CNAE→concept; nenhuma persistência de QSA
ou JSONB bruto; nenhuma coluna CNAE em `companies`; nenhuma mudança de provider/frontend/marketplace/Bank/KYB.

## 12. Impacto em DTs
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → **GOVERNED / DECISIONED** (modelo definido; **não CLOSED** — falta schema + writer).
- **Criada** `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` (OPEN) — `companies.service` lê/escreve colunas inexistentes
  (`main_activity_code`/`main_activity_description`/`secondary_activities`); update pode gerar 42703; limpar/redirecionar.
- **Criada** `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` (OPEN) — não há matriz CNAE→suggested company_type/concept
  (frente posterior à persistência).
- **Não reabrir:** `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` · `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` ·
  `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` · `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (todas CLOSED).
- **Manter OPEN:** `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` · `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` ·
  `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING`.

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **`F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP`** (backend, baixo risco): remover os refs mortos de `main_activity_code`/
   `secondary_activities` em `companies.service` (read mappers + update), parando o 42703 latente. Pode vir antes do schema.
2. **`F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION`** (schema-only): criar `fiscal_identity_economic_activities` (D4),
   forward-only/idempotente, sem writer; testes de CHECK/FK/UNIQUE.
3. **`F-PJ-CNAE-EVIDENCE-WRITER`** (backend): persistir a evidência no nascimento fiscal a partir do `fetchCNPJFromRevenue`
   já existente (source/fetched_at; fail-open; sem QSA).
4. Depois: `F-PJ-CNAE-TO-CONCEPT-SUGGESTION` (matriz de sugestão) → derivação de elegibilidade (DECISION-0102).
Ordem recomendada: ghost-cleanup (1) → schema (2) → writer (3). Marketplace-vocabulary/hybrid ortogonais.

## 14. Referências normativas
Constituição (Art. III/IV/V) · LEIS (Lei 5/7) · SSOT_REGISTRY · LEI_DE_COERENCIA · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY
· REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO (§8) · SERVICE_CANONICO · DECISION-0085 (fiscal-first)
· DECISION-0097 (D3 KYB SSOT) · DECISION-0098/0099/0100/0101/0102 · `archive não é SSOT vigente`.

## 15. Referências de estado/commits
HEAD origem `e064c36f` ("fix(pj): neutralize free domain selector"). Evidência material:
`companies.service.fetchCNPJFromRevenue` (ReceitaWS+BrasilAPI), `createCompany` (extrai `activity`, não persiste),
`companies` (14 cols, sem activity/cnae), `fiscal_identities` (9 cols, sem cnae), mappers/updateCompany lendo/escrevendo
`main_activity_code`/`secondary_activities` (ghost), `migrations_archive` (colunas de atividade arquivadas). Auditoria
read-only `F-PJ-CNAE-EVIDENCE-PERSIST`.

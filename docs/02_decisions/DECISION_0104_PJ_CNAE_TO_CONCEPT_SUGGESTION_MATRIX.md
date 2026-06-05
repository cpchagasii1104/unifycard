# DECISION-0104 — Governança da matriz CNAE → suggested concept (sinal de sugestão, não autoridade)

**Data:** 2026-06-04
**Tipo:** Arquitetura / Semântica / Onboarding PJ
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/seed/endpoint/frontend)
**Frente:** `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-DECISION`
**HEAD de origem:** `6daecd05`

---

## 1. Título
A matriz CNAE → `suggested_concept_id` é um **sinal de sugestão governado**, não autoridade. CNAE/atividade
econômica (evidência fiscal já persistida em `fiscal_identity_economic_activities`) pode **sugerir** candidatos de
identidade semântica, mas **não escolhe o concept final**, **não ativa** a empresa, **não publica** e **não aprova
domínio**. CONCEPT permanece a identidade semântica soberana; o par `(primary_company_type_id, primary_concept_id)`
só muda por **ação explícita de ativação operacional**. Decide **como o CNAE pode sugerir** — não deixa o CNAE escolher.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetura / Semântica / Onboarding PJ. Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration, seed, endpoint, frontend, autoativação, importação do CNAE
oficial inteiro, mapeamento para `MarketplaceDomain`, elegibilidade de domínios, publicação, KYB, Bank,
marketplace/hybrid, nem criação de concepts/company_types (ver §11/D-bloqueios).

## 5. Contexto
DECISION-0102 fixou que domínio de atuação deriva de CONCEPT + evidência fiscal (modelo de 6 camadas: evidência
fiscal → identidade operacional → domínios elegíveis → solicitados → aprovados → em revisão), e que CNAE/Receita/CNPJ
são **evidência**, não SSOT. DECISION-0103 fixou a **casa** da evidência (`fiscal_identities` + satélite 1:N) e que
CNAE **sugere, não decide** (D10). `F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION` criou
`fiscal_identity_economic_activities`; `F-PJ-CNAE-EVIDENCE-WRITER` passou a persistir a evidência (principal +
secundários, idempotente, fail-open, sem QSA). A auditoria read-only `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX`
mapeou o substrato vivo e o precedente normativo de sinais semânticos. Esta DECISION crava a **governança da matriz
de sugestão antes** de qualquer schema/seed/endpoint (norma antes de schema, padrão 0099/0100/0102/0103).

## 6. Problema
A evidência CNAE agora persiste, mas **não existe matriz** que a traduza em sugestão de `concept`. Sem governança,
a tentação é mapear CNAE→concept como se fosse identidade (autoridade), importar a lista oficial inteira de CNAE
(milhares de códigos contra 137 concepts em verticais estreitas → mapeamentos mortos), ou apontar a sugestão para
`MarketplaceDomain` (fork de vocabulário não reconciliado). É preciso fixar: **alvo** (concept, não domínio/N0/type),
**escopo** (MVP seletivo), **forma** (multi-candidato, confidence, rationale, review), e **fronteira** (sugestão
`pending`, jamais autoativação).

## 7. Evidência material (auditoria read-only F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX; dev HEAD `6daecd05`)
1. `fiscal_identity_economic_activities` existe e persiste: `cnae_code`, `cnae_description`, `is_primary`, `source`,
   `fetched_at`, `fiscal_identity_id` (0 linhas vivas em dev — depende do fetch real no nascimento).
2. Writer CNAE (`fiscal-identity-economic-activity.service`) persiste principal/secundários, idempotente, **sem QSA**.
3. `company_types` vivos = **7** (vertical MVP): açougue, farmácia, hortifruti, padaria, restaurante, salão, supermercado.
4. `company_type_allowed_concepts` = **7 linhas** = hoje **1 concept por type** (1:1 type↔concept):
   açougue→`varejo-alimentar-especializado-carnes`; farmácia→`saude-varejo-farmaceutico`;
   hortifruti→`varejo-alimentar-especializado-hortifruti`; padaria→`varejo-alimentar-especializado-padaria`;
   restaurante→`alimentacao-servico-preparado`; salão→`servicos-pessoais-beleza`; supermercado→`varejo-alimentar-integrado`.
5. `concepts` = **137** em **13 domínios N0**; **sem display name** (só `concept_id`, `slug`, `domain`, `created_at`).
6. `concepts.domain` é FK → `domains.domain_key` (`concepts_n0_domain_fkey`); N0 catálogo = 21 domain_keys. Os 7 types
   cobrem só 2 N0 (`produtos-e-comercio`, `servicos`). N0 é **derivável** de `concepts.domain`.
7. **Não existe** lista oficial de CNAE no repo (nem JSON/CSV/seed).
8. **Não existe** tabela/seed CNAE oficial (`cnaes`/`economic_activity_codes`/etc.). Único "cnae" fora desta frente =
   campo TEXTO LIVRE em `invoice.types.ts fiscalMetadata.cnae` (não é catálogo).
9. **Não existe** matriz CNAE→concept.
10. Cobertura semântica atual é **estreita** (só as 7 verticais acima).
11. **Fora** dessas verticais (consultoria, imobiliária, veículos, indústria) **não há alvo semântico suficiente** hoje.
12. Importar o CNAE oficial inteiro agora = **risco alto** (milhares de códigos, poucos concepts úteis → mapeamentos mortos).
13. Padrão recomendado = matriz **seletiva/MVP**.
14. **Precedente normativo de sinais semânticos** já governa o padrão: `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE`
    (`docs/02_decisions/`, status RASCUNHO) + `SEMANTIC_CATALOG_GOVERNANCE` (`docs/02_decisions/`, complemento
    subordinado, não normativo): **sinal → sugestão `pending` → aplicação explícita ("Aplicar")**; inferência
    **antes** do fluxo transacional, nunca durante; "sugestão pode nascer sozinha; ação nunca"; **teste de
    desligamento** obrigatório. SEMANTIC_CATALOG_GOVERNANCE §1 nomeia CNAE **explicitamente** como "sinal".

> **Nota de localização/estatuto:** os artefatos `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md` e
> `SEMANTIC_CATALOG_GOVERNANCE.md` vivem em `docs/02_decisions/` (não em `docs/01_normative/`). O RFC está em
> **RASCUNHO** (não promulgado; sem assinatura no log) e o SEMANTIC_CATALOG_GOVERNANCE é **complemento subordinado
> não normativo**. Esta DECISION os trata como **precedente de produto/desenho a ratificar**, não como norma vigente
> superior — a precedência canônica permanece Constituição > Leis > SSOT Registry > Ontologia > DECISIONs.

## 8. Decisão
A matriz CNAE → concept é definida como **sinal de sugestão governado**, ancorado no precedente de sinais semânticos:
ela mapeia `cnae_code` → `suggested_concept_id` (CONCEPT é o alvo e o SSOT), permite **múltiplos candidatos** com
**confidence/rationale/source/version/review_status**, cobre no MVP **apenas** os CNAEs compatíveis com os 7
company_types/concepts vivos (sem importar o CNAE oficial inteiro), e entra no fluxo como **sugestão `pending`** —
**proibida a autoativação**. `company_type` é **derivado/validado** via `company_type_allowed_concepts`, não duplicado
como identidade na matriz. A matriz alimenta **apenas** a camada 1→2 (evidência fiscal → identidade operacional
sugerida) do modelo de 6 camadas; **não fecha** a elegibilidade de domínios (que ainda exige
`concept/company_type → allowed domains` + reconciliação do fork `MarketplaceDomain ↔ N0`). **Sem
código/schema/seed/endpoint/frontend nesta DECISION.**

## 9. Decisões D1–D16

**D1 — CNAE é sinal, não autoridade.** CNAE pode **sugerir** candidatos semânticos. CNAE **não** ativa empresa,
**não** escolhe o concept final, **não** publica e **não** aprova domínio.

**D2 — CONCEPT continua soberano.** A sugestão aponta para `concept_id`. O par soberano
`(primary_company_type_id, primary_concept_id)` só muda por **ação explícita de ativação operacional**
(POST `/operational-activation`, validado contra `company_type_allowed_concepts`).

**D3 — Matriz sugerida: CNAE → suggested_concept.** A matriz canônica futura mapeia `cnae_code` → `suggested_concept_id`.
**Não** mapear direto para `MarketplaceDomain`. **Não** usar N0 como alvo principal. **Não** usar `company_type` como
identidade principal da matriz.

**D4 — company_type é derivável.** Quando necessário, `company_type` é **derivado/validado** via
`company_type_allowed_concepts` (reverse lookup do concept sugerido). **Não** duplicar desnecessariamente a verdade
semântica na matriz (sobrevive a `type↔concept` virar N:N no futuro).

**D5 — Múltiplos candidatos são permitidos.** Um CNAE pode sugerir mais de um concept. A matriz deve permitir **N
candidatos por CNAE** (recomendado: unicidade por `(cnae_code, suggested_concept_id)`).

**D6 — Confidence obrigatório.** A matriz carrega **confiança/prioridade**. O CNAE **principal** (`is_primary=true`
na evidência) tem **peso maior** que o secundário; secundário **nunca** tem o mesmo peso automático do principal.

**D7 — Rationale/source/version obrigatórios.** Cada sugestão é **auditável**: por que este CNAE sugere este concept
(`rationale`), de onde veio o mapping (`source`), qual versão/revisão do catálogo (`version`).

**D8 — Review status.** A matriz suporta **curadoria/revisão humana** (`proposed` | `approved` | `retired/rejected`,
conforme o schema futuro). Mapping **não revisado** não deve virar sugestão forte (curadoria precede confiança alta).

**D9 — Escopo MVP seletivo.** **Não** importar o CNAE oficial inteiro agora. O MVP cobre **apenas** CNAEs compatíveis
com os 7 company_types/concepts existentes (açougue, farmácia, hortifruti, padaria, restaurante, salão, supermercado).
Cobertura ampla vem **depois** de ampliar concepts/company_types.

**D10 — Exact match primeiro.** O MVP prioriza `cnae_code` **exato**. Prefixos/classes CNAE podem ser **fallback
futuro**, não obrigatórios no MVP.

**D11 — Sugestão pending.** O resultado da matriz entra no fluxo como **sugestão `pending`**. Aplicar exige **ação
explícita** do usuário/operador no fluxo governado (precedente RFC: "sugestão prepara; sistema executa onboarding").

**D12 — Proibida autoativação.** A matriz **não** pode escrever `companies.primary_company_type_id`,
`companies.primary_concept_id`, `company_concept_publications`, `tenant_concept_offerings`, nem qualquer domínio
aprovado; **não** pode chamar a rota de ativação por conta própria.

**D13 — Consumo futuro pelo wizard.** Um read endpoint futuro pode sugerir concept para o wizard de ativação
operacional. O wizard pode **pré-selecionar com confirmação explícita**, mas **não aplicar silenciosamente**.

**D14 — Consultoria, imobiliária e veículos.** Enquanto não houver concepts/company_types adequados, CNAEs de
consultoria, imobiliária e veículos retornam **nenhuma sugestão** ou **revisão/manual** — **nunca** domínio livre.
**Não inventar** concept pelo CNAE. (Imóveis/Veículos são regulados — DECISION-0102 D13.)

**D15 — Empregos fora da matriz.** Empregos **não é** domínio de atuação da empresa; é **capability transversal** de
contratação/recrutamento (DECISION-0102 D12). A matriz **não** mapeia CNAE → `jobs`; Empregos exige frente própria.

**D16 — Relação com elegibilidade de domínios.** A matriz CNAE→concept alimenta **apenas** a camada
**evidência fiscal → identidade operacional sugerida** (1→2). **Não fecha** a elegibilidade de domínios. Depois ainda
serão necessárias a matriz/derivação `concept/company_type → allowed domains` e a reconciliação de `MarketplaceDomain`
com o N0 canônico (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`).

## 10. O que esta DECISION ratifica
- **Executa o degrau de sugestão (camada 1→2) de DECISION-0102** (modelo de 6 camadas) e o **D10 de DECISION-0103**
  (CNAE sugere candidatos, nunca decide).
- **Ratifica** CONCEPT como SSOT semântico (Lei 7), `project_frontend_nunca_cria_verdade` (frontend não cria
  taxonomia), a ativação soberana do par (DECISION-0097/0098) e a publicação só após KYB + ato soberano (0099/0100/0101).
- **Ratifica** o precedente de sinais semânticos (`RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE` /
  `SEMANTIC_CATALOG_GOVERNANCE`): sinal → sugestão `pending` → aplicação explícita; inferência antes do fluxo; teste
  de desligamento.

## 11. O que NÃO está autorizado
Código; migration; seed; endpoint; frontend; autoativação; importação do CNAE oficial inteiro; mapeamento para
`MarketplaceDomain`; elegibilidade de domínios; publicação; KYB; Bank; marketplace/hybrid; criação de
concepts/company_types novos. Em particular: nenhuma escrita em `primary_*`/`company_concept_publications`/
`tenant_concept_offerings`; nenhuma chamada à rota de ativação a partir da matriz.

## 12. Impacto em DTs
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → **GOVERNED / DECISIONED** (modelo definido; **não CLOSED** —
  falta schema + seed + read endpoint).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece **PARTIALLY MITIGATED / GOVERNED** (a matriz CNAE alimenta
  só a camada 1→2; **não fecha** a seleção/elegibilidade de domínios).
- `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → permanece **OPEN** (pré-requisito da camada `allowed domains`, mas
  **não bloqueia** a matriz CNAE→concept).
- **Criada** `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (OPEN) — concepts não têm display name/label canônico; o wizard pode
  ter que exibir slug/domain até haver display governado.
- **Não reabrir:** `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` (CLOSED) · `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` (CLOSED) ·
  `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` (CLOSED) · `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (CLOSED).

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SCHEMA-MIGRATION`** (schema-only): criar a tabela da matriz
   (`cnae_code` → `suggested_concept_id`, multi-candidato, confidence, rationale, source/version, review_status,
   global), forward-only/idempotente, sem seed/writer; testes de CHECK/FK/UNIQUE.
2. **`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SEED-MVP`**: seed **seletivo** dos CNAEs das 7 verticais (curado, revisável).
3. **`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT`**: endpoint read-only que sugere concept (proposta `pending`).
4. **`F-PJ-ONBOARDING-WIZARD-CNAE-SUGGESTION`** (frontend): pré-seleção com confirmação explícita (sem auto-apply).
5. Ortogonais/posteriores: `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-READONLY` (pré-requisito de `allowed domains`) e
   `F-PJ-DOMAIN-ELIGIBILITY-DERIVATION` (camada 3). `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (display governado).
Ordem recomendada: schema (1) → seed MVP (2) → read endpoint (3) → wizard (4). A matriz CNAE→concept independe do fork
(pode vir antes); a camada de domínios elegíveis depende do fork.

## 14. Referências normativas
Constituição (Art. III/IV/V) · LEIS (Lei 5/7) · SSOT_REGISTRY · LEI_DE_COERENCIA · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY
· REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO · SERVICE_CANONICO · `project_frontend_nunca_cria_verdade`
· DECISION-0097 (par soberano) · DECISION-0098 (vocabulário/eixos A/B) · DECISION-0102 (6 camadas; D4/D5/D12/D13/D14)
· DECISION-0103 (evidência fiscal; D10 sugere-não-decide) · `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE` (RASCUNHO,
`docs/02_decisions/`) · `SEMANTIC_CATALOG_GOVERNANCE` (complemento subordinado, `docs/02_decisions/`).

## 15. Referências de estado/commits
HEAD origem `6daecd05` ("feat(pj): persist CNAE fiscal evidence"). Substrato vivo (dev, 359 migrations):
`fiscal_identity_economic_activities` (writer landou; 0 linhas), `company_types` (7), `company_type_allowed_concepts`
(7 = 1:1), `concepts` (137, 13 N0, sem display name), `concepts.domain` FK → `domains.domain_key` (21 N0). Sem
catálogo/seed CNAE no repo. Auditoria read-only `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX`.

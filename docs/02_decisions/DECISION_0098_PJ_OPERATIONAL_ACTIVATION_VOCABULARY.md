# DECISION-0098 — Vocabulário de ativação operacional PJ (par primary_* como SSOT)

**Status:** PROMULGADA POR CLAYTON — DECISÃO ARQUITETURAL / INSTITUCIONAL (reconcilia o vocabulário de ativação operacional PJ: o par `(primary_company_type_id, primary_concept_id)` é a única verdade; `businessType`/`businessCategory`/`serviceCategories`/`hybrid`/metadata são entrada/legado, não SSOT). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND / SEM BACKEND-RUNTIME** (2026-06-04). Fixa o dicionário soberano e a ordem; **não** implementa.
**Data:** 2026-06-04.
**Tipo:** arquitetural / institucional.
**Sessão:** 2026-06-04 — frente `F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION` (pós auditoria read-only de blast radius). **Commit âncora:** `6d5dda34` (pós encerramento da frente company_status/is_verified — DT SECOND-TRUTH CLOSED).
**Decisor:** Clayton. **Validação prévia:** auditoria read-only `F-PJ-OPERATIONAL-ACTIVATION-VOCAB` (esta cadeia) + desenho autoral `CRIACAO_DE_EMPRESAS.md` (§9.1-2) + DECISION-0097 (D5/D6).
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0097` (D5/D6 — nascimento/ativação; "ambos" = dois trilhos via GRAPH), `SELO_DECISION_0097_ONTOLOGY_FULL_READ`, `CRIACAO_DE_EMPRESAS.md` (autoral), auditoria read-only de vocabulário.
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md` (Lei 5/Lei 7), `SSOT_REGISTRY_UNIFICARD.md`, `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `REGRA_CANONICA_CRIACAO_DE_CONTEXT.md`, `EMPRESA_NASCIMENTO_CANONICO.md`, `PROHIBITED_STRUCTURES.md`, `07_NOMENCLATURA_CANONICA.md`.
**Vinculada a:** `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` (atualizada — DECISIONED/governada), `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` (atualizada — governada), `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` (criada).

---

## 1. Contexto

A DECISION-0097 fixou que a empresa PJ nasce em dois momentos e que o Momento 2 (ativação operacional) é o par `(primary_company_type_id, primary_concept_id)`, com "ambos" = dois trilhos via GRAPH. Uma auditoria read-only posterior mapeou o blast radius do vocabulário e revelou um drift profundo: o par SSOT existe e é correto, mas **vive como ilha** — o onboarding vivo fala dialetos diferentes (`businessType`, `businessCategory`, `category`/`hybrid`) que morrem em metadata ou roteiam superfícies de marketplace, sem nunca projetar no par.

## 2. Problema

O mesmo objeto (o que a empresa É e opera) tem **4+ representações concorrentes**, conflando dois eixos distintos (domínio N0 grosso × vertical/segmento), com `hybrid` atômico vivo (anti-padrão D5) e o par SSOT desconectado de qualquer entrada viva. Sem um dicionário soberano declarado, qualquer código futuro de onboarding/marketplace cimenta mais drift.

## 3. Evidência material (auditoria read-only, HEAD `6d5dda34`)

1. **Frontend** `CompanyOnboardingWizard.tsx`: usuário escolhe `businessType` = `CompanyBusinessType` (bar/restaurant/nightclub/producer/venue/service_provider/retail/clinic/other — **verticais**); salva em `metadata.onboarding` via `updateCompany`; **não** envia concept/company_type/par.
2. **Backend** `createCompany` (`companies.routes.ts:51-52`) aceita `businessCategory` enum(`product|service|industry|hub|hybrid`) + `serviceCategories[]`; grava em `metadata.business_category`/`metadata.service_categories` (BLOB); **não** projeta no par.
3. **`activateCompanyOperationally`** (`companies.service.ts:706`, writer do par em `:848`, validado contra `company_type_allowed_concepts`, CHECK pareado `chk_companies_primary_classification_paired`) é o **único** writer real do par — **zero caller vivo** (só e2e `company-two-moments`); **não há rota HTTP de ativação**.
4. **`tenant_concept_offerings`**: zero writer no onboarding (tabela existe, vazia).
5. **Marketplace**: `hybrid` é valor vivo (`CompanyOnboarding.contract`, `company-application.service`, `marketplace-company.service`, `marketplace-orchestration.service`, `marketplace-categories.types`); decide superfícies; `mapCategoryToActorType('hybrid') → 'store'`; lógica duplicada em dois services.
6. **Banco** (`unificard_dev`): companies=0; `company_types`=7 **verticais** (restaurante/hortifruti/padaria/farmacia/supermercado/acougue/salao); `company_type_allowed_concepts`=7 (1 concept/type); `tenant_concept_offerings`=0; **`business_templates` não existe**.

## 4. Princípio normativo

Identidade semântica = **CONCEPT** (Lei 7); navegação = N0/N1/N2/categories (não identidade); ativação operacional PJ = o **par governado** validado por `company_type_allowed_concepts` (sem fallback — `REGRA_CANONICA_CRIACAO_DE_CONTEXT`). "Ambos" = dois trilhos relacionados por **GRAPH** (18 §6), nunca um nó atômico. Nenhuma camada cria realidade paralela: metadata/UX são projeção, não verdade.

## 5. Documentos lidos (prova §2.2.2)

Lidos em full nesta cadeia: `18_DOMAIN_ONTOLOGY` (949 linhas), `DECISION-0097`, `SELO_DECISION_0097`, `CONSTITUICAO`, `LEIS_OPERACIONAIS` (Lei 5/7), `EMPRESA_NASCIMENTO_CANONICO`, `REGRA_CANONICA_CRIACAO_DE_CONTEXT`, `PROHIBITED_STRUCTURES`, `CRIACAO_DE_EMPRESAS.md` (autoral). Auditoria read-only de vocabulário (material desta DECISION). Por referência (sem claim novo sobre internos): `SSOT_REGISTRY`, `07_NOMENCLATURA`, `19_N1`, `20_N2`, `SERVICE_CANONICO`, `DEFINICAO_DE_PRODUTO.MD` (existe; casing `.MD`). Domínios: semântica/CONCEPT, navegação N0/N1/N2, contexto, ativação operacional PJ, onboarding (projeção), marketplace/services (trilhos), financeiro (fronteira negativa).

## 6. SSOT aplicáveis / NÃO-SSOT

**SSOT:** semântica = CONCEPT; ativação operacional PJ = par `(primary_company_type_id, primary_concept_id)`; compat type/concept = `company_type_allowed_concepts`; oferta/descoberta futura = `tenant_concept_offerings`; operacional = `actors(id)`/page-actor; financeiro = `bank_ledger`/UnifyBank (fronteira negativa).
**NÃO-SSOT:** `businessType`, `businessCategory`, `serviceCategories`, `hybrid`, metadata, frontend, slug, `category` isolada, N0/N1/N2 isolados, marketplace orchestration.
Precedência: Constituição > Leis > SSOT Registry > Ontologia > DECISION-0097 > código/runtime.

## 7. Decisão

Promulga-se o **dicionário soberano da ativação operacional PJ**: o par `(primary_company_type_id, primary_concept_id)` é a **única verdade** do Momento 2; todos os vocabulários de entrada (`businessType`/`businessCategory`/`serviceCategories`/`hybrid`) são **legado/entrada/projeção** e devem convergir para o par ou ser aposentados; os dois eixos conflados (domínio N0 × vertical/segmento) são separados; "ambos" é dois trilhos via GRAPH. Decisões específicas em D1–D12 (§9). **Docs-only** — não autoriza execução (D12).

## 8. Decisão (precedência aplicada)

Norma vence código. O código vivo que fala dialeto antigo (metadata blobs, hybrid atômico, par ilhado) é **dívida governada** por esta DECISION, não fonte. Execuções posteriores convergem o runtime para o dicionário aqui fixado.

## 9. Decisões específicas (D1–D12)

### D1 — Par primary_* como SSOT da ativação operacional
O estado canônico do Momento 2 PJ é o par **`companies.primary_company_type_id` + `companies.primary_concept_id`**. Preenchido **somente por writer governado** (hoje `activateCompanyOperationally`). É a **única** base da ativação operacional primária. O CHECK pareado existente (`chk_companies_primary_classification_paired`: ambos NULL = jurídico inerte / ambos NOT NULL = operacional) é **preservado**.

### D2 — `company_type_allowed_concepts` como validação obrigatória
Toda gravação do par **deve** validar compatibilidade em `company_type_allowed_concepts`. **Proibido** fallback/default/inferência livre de concept (`REGRA_CANONICA_CRIACAO_DE_CONTEXT`). **Proibido** aceitar concept incompatível com o type por conveniência de UX.

### D3 — Separação dos dois eixos
Declarados formalmente **distintos** (não compartilham campo):
- **Eixo A — domínio operacional N0:** `produtos-e-comercio` / `servicos` (e "ambos" = dois trilhos).
- **Eixo B — vertical/segmento operacional:** restaurante/padaria/bar/clínica/salão etc., materializado por `company_types` + o CONCEPT compatível.
Conflar A e B num único campo (como hoje `businessCategory` faz) é drift vetado.

### D4 — `businessType`
O `businessType` do frontend é **vocabulário vertical/UX legado**. **Não** é SSOT, **não** é N0, **não** é CONCEPT, **não** autoriza ativação. Deve ser **reconciliado** para alimentar o par (mapear vertical → `company_type` + concept compatível) **ou** aposentado como metadata transitória.

### D5 — `businessCategory`
O `businessCategory` do `createCompany` é **vocabulário de domínio grosso/entrada legado**. **Não** é SSOT nem fonte de ativação. Persistir em `metadata.business_category` é **dívida transitória**. **Não pode** decidir superfície operacional sem projeção governada (no par/trilho).

### D6 — `serviceCategories`
`serviceCategories[]` em metadata **não** é semântica canônica, **não** substitui CONCEPT, **não** ativa serviço. Deve ser substituído por **declarações/offerings governadas** em trilho próprio (Eixo A — serviços). _(Nota: o `serviceCategories` do domínio de eventos/RFQ é outro uso, fora desta DECISION.)_

### D7 — `hybrid`
`hybrid` **atômico** é **anti-padrão** para o modelo canônico (D5 da DECISION-0097). "Ambos" = **dois trilhos operacionais** (`produtos-e-comercio` + `servicos`), com a relação entre trilhos/concepts representada por **GRAPH** quando necessário. `hybrid` pode sobreviver **temporariamente** como compat/entrada legada **até a frente de reconciliação marketplace**, mas fica marcado **DEPRECATED / TO BE REMOVED**. **Proibido** criar `hybrid` como CONCEPT, `company_type`, N0 ou SSOT.

### D8 — Marketplace orchestration
Marketplace orchestration **não** é SSOT semântico. A lógica atual que usa `hybrid` para decidir superfícies é **compat legada**. **Não remover sem frente própria** (há acoplamento real: `mapCategoryToActorType`, habilitação de superfícies, lógica duplicada). **Futuro:** substituir `hybrid` por **combinação explícita de trilhos habilitados**.

### D9 — `tenant_concept_offerings`
`tenant_concept_offerings` é o **candidato correto** para oferta/descoberta por concept, mas hoje **sem writer no onboarding**. Esta DECISION **não** implementa writer. O writer futuro deve derivar **do par e/ou de declarações explícitas de trilho**, nunca de metadata livre.

### D10 — Onboarding futuro
O onboarding deve coletar **explicitamente**: (1) domínio operacional (produtos / serviços / ambos — Eixo A); (2) vertical/segmento (Eixo B); (3) concept compatível (validado por `company_type_allowed_concepts`); (4) trilhos/offerings quando aplicável. Onboarding **não pode** salvar verdade operacional apenas em metadata.

### D11 — Compat transitória
`businessType`/`businessCategory`/`serviceCategories`/`hybrid` podem permanecer por **compat temporária**. **Toda leitura decisória nova** deve usar o **par** ou estrutura governada derivada. **Proibido** criar nova lógica decisória baseada nesses campos legados.

### D12 — Bloqueios (esta DECISION NÃO autoriza ainda)
código · migration · alteração de onboarding · remoção de `hybrid` · alteração de marketplace orchestration · criação de writer `tenant_concept_offerings` · criação de rota de ativação operacional · alteração em Bank · alteração em fiscal/KYB · alteração em `company_status`.

## 10. O que esta DECISION supera/ratifica

- **Ratifica e detalha** DECISION-0097 D5/D6 (par SSOT; "ambos" = dois trilhos via GRAPH; CONCEPT = identidade).
- **Consolida** o achado da auditoria de vocabulário em regra soberana.
- **Não supera** nenhuma DECISION vigente; compatível e subordinada a 0097.

## 11. O que NÃO está autorizado

Ver D12. Reforço: **zero** código/schema/migration/runtime/Bank/fiscal/frontend nesta frente. Nenhuma execução derivada começa antes da palavra explícita de Clayton.

## 12. Impacto em DTs

- **`DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT`** → **DECISIONED / GOVERNED** (governada por esta DECISION; permanece OPEN até a execução de reconciliação).
- **`DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING`** → permanece **OPEN**, agora **governada** (writer do par/offerings deriva de D9/D10).
- **`DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN`** → **criada (OPEN)** — marketplace usa `hybrid` atômico para decidir superfícies; reconciliação em frente própria (D7/D8).
- **`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`** → permanece **CLOSED** (não reaberta).

## 13. Próximas frentes autorizáveis (sem execução agora)

1. **Onboarding domain-selection** (read-only/desenho → execução): coletar produtos/serviços/ambos + vertical + concept → escrever o par (e tenant_concept_offerings) via writer governado; expor rota de ativação. (D9/D10/`DT-...DOMAIN-SELECTION-MISSING`.)
2. **Reconciliação marketplace `hybrid`** → combinação explícita de trilhos (D7/D8/`DT-...MARKETPLACE-HYBRID`).
3. **Simetria trilho de serviços** (wizard/onboarding de serviços, hoje assimétrico ao de produtos).
Ordem recomendada: `norma (esta) → onboarding domain-selection → marketplace`. Identidade antes de comércio.

## 14. Referências normativas

`CONSTITUICAO_UNIFICARD`; `LEIS_OPERACIONAIS` (Lei 5 Bank, Lei 7 CONCEPT); `18_DOMAIN_ONTOLOGY` (§3 N0, §6 GRAPH, §7 lista N0, §20-23 anti-patterns); `REGRA_CANONICA_CRIACAO_DE_CONTEXT` (sem fallback); `EMPRESA_NASCIMENTO_CANONICO`; `PROHIBITED_STRUCTURES`; `07_NOMENCLATURA_CANONICA`; `DECISION-0097` (D5/D6) + `SELO_DECISION_0097`.

## 15. Referências de estado / commits

HEAD âncora `6d5dda34`. Estado vivo (psql): companies=0; `company_types`=7 verticais; `company_type_allowed_concepts`=7; `tenant_concept_offerings`=0; `business_templates` ausente; par CHECK pareado presente. `activateCompanyOperationally` writer do par sem caller vivo. Cadeia recente: DECISION-0097/SELO; frente company_status/is_verified encerrada (3.3-A/B1/B2 + higiene; DT SECOND-TRUTH CLOSED).

## 16. Superada por

(em aberto — decisão vigente)

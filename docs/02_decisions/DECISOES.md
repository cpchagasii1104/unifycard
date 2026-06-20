# DECISÕES — Índice consolidado (declarado × verificado)

**Gerado:** 2026-06-06 · **Branch:** `rescue-structural` · **Probe DB:** `unificard_dev` (READ-ONLY, SELECT-only).

> ⚖️ **Natureza deste documento — leia primeiro.** Este arquivo é **índice / auditoria operacional** das
> decisões; **NÃO** é fonte normativa soberana. É mapa, não território. O território continua sendo a norma + o
> schema + o runtime.
>
> 1. É **índice/auditoria operacional**, não fonte normativa soberana.
> 2. A **fonte normativa** continua sendo: cada **DECISION original**; **`REMEDIATION_DECISIONS_LOG.md`**;
>    **`REMEDIATION_DT_LOG.md`**; **`STATUS_EXECUCAO_GLOBAL.md` / `opus.md`**; e o **runtime/schema vivo** quando a
>    pergunta for "isto está implementado?".
> 3. Alguns cabeçalhos **"DOCS-ONLY / não implementado"** descrevem a **sessão de promulgação**, não o **estado
>    atual consolidado** após fatias executoras.
> 4. As **13 divergências** identificadas (⚠️) são divergências de **cabeçalho/estado consolidado** — **não** são
>    autorização para reescrever as DECISIONs individuais agora.
> 5. Qualquer correção de DECISION antiga deve ser **frente documental própria**, se um dia for necessária.

Este documento consolida **todas** as decisões arquiteturais do UnifiCard num só lugar, com **duas colunas de status**:

- **Declarado** = o que o cabeçalho/corpo do próprio doc afirma (ex.: "DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO").
- **Verificado** = o que foi checado **contra código/schema vivos** (migrations, services, rotas, flags, probe ao banco).

> **O ponto central:** os docs de DECISION declaram um status que **frequentemente diverge da realidade**. O caso
> canônico é a **DECISION-0087** ("DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO") que está **inteiramente implementada**
> (tabela `fiscal_identity_documents`, service, gate documental, rotas, e2es). As divergências marcadas com ⚠️ são
> o resultado mais valioso deste índice.

**Padrão recorrente descoberto:** dezenas de DECISIONs do bloco PJ/KYB/PJ-onboarding/serviço declaram-se "DOCS-ONLY /
SEM CÓDIGO" porque a sessão que **promulgou a norma** não autorizou execução. Mas **fatias executoras posteriores**
(prompts próprios) implementaram o schema/código — sem reabrir o doc da decisão para atualizar o cabeçalho. O cabeçalho
"DOCS-ONLY" descreve a **sessão de promulgação**, não o estado atual do runtime. Por isso **declarado=DOCS-ONLY** convive
com **verificado=IMPLEMENTADO/PARCIAL** em todo o cluster PJ.

Legenda do verificado: `IMPLEMENTADO | PARCIAL | NÃO-IMPLEMENTADO | SUPERADA | NÃO-AUDITADO`.

- **Tier 1** = ~48 docs `DECISION_0064..0111` (verificação profunda contra disco).
- **Tier 2** = decisões `0001–0063` que só existem em `REMEDIATION_DECISIONS_LOG.md` (passada leve; verificado =
  `NÃO-AUDITADO`, salvo quando o LOG declara supersessão ou quando trivialmente checável).
- **Contratos** = 4 docs de governança de Core (não numerados na série 0064–0111).
- **Bloco 0112–0141** = 30 docs `DECISION_0112..0141` (reindex **A1**, 2026-06-20). DECLARADO = header do próprio `.md` (fonte soberana por linha); verificado = `NÃO-AUDITADO` (passada docs-only, sem re-checagem material).

---

## Tabela mestra — Tier 1 (0064–0111)

| Nº | Arquivo | Declarado | Verificado | 1-linha de evidência |
|----|---------|-----------|------------|----------------------|
| 0064 | DECISION_0064_LEARNING_INTEREST_SEMANTIC_GOVERNANCE | Governança/desenho, sem migration | IMPLEMENTADO (selada) | substrato Learning/Interest C1 vivo; selo `SELO_C1_LEARNING_INTEREST.md` |
| 0065 | DECISION_0065_LEARNING_CONCEPTS_MATERIAL_DIRECTIVES | Diretrizes, sem migration | IMPLEMENTADO | Migration A `20260601*` criou 36 concepts learning |
| 0066 | DECISION_0066_INTEREST_TREE_MATERIAL_DIRECTIVES | Diretrizes, sem migration | IMPLEMENTADO | Migration B criou árvore `scope='interest'` |
| 0067 | DECISION_0067_C1_LEARNING_INTEREST_ACTOR_FIRST | Arquitetura/desenho, sem código | IMPLEMENTADO | `actor_learning_concepts`+`actor_interest_concepts`+view existem (migration `20260601140000`) |
| 0068 | DECISION_0068_CONCEPTID_SURFACING_DECLARATIVE_CONTEXTS | EXECUTADA (código+provas) | IMPLEMENTADO | `canExposeCategoryConceptId` em `categories.service.ts` |
| 0069 | DECISION_0069_C1_READERS_USER_ACTOR_RESOLUTION | EXECUTADA (F1 helper) | IMPLEMENTADO | `profile-c1-declarations-read.service.ts`+`.repository.ts` |
| 0070 | DECISION_0070_AI_CATEGORY_EXPANSION_NOT_SEMANTIC_IDENTITY | DOCS-ONLY (split de DT) | IMPLEMENTADO (docs-only por natureza) | classificação de DT; nada a implementar |
| 0071 | DECISION_0071_SENSITIVE_LIFESTYLE_HEALTH_PROFILE_POLICY | DOCS-ONLY (política D1) | NÃO-IMPLEMENTADO (esperado) | política LGPD; implementação explicitamente pendente |
| 0072 | DECISION_0072_AGENDA_AVAILABILITY_B1_MATERIALIZATION | DOCS-ONLY (modelagem F0) | NÃO-AUDITADO | decisão de modelagem; F1+ materializador não auditado nesta passada |
| 0073 | DECISION_0073_EDUCATION_DECLARATION_NOT_VERIFIED_CREDENTIAL | DOCS-ONLY | NÃO-AUDITADO | semântica de produto; F1/F2 não auditados |
| 0074 | DECISION_0074_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE | DOCS-ONLY (modelagem D1) | ⚠️ PARCIAL | F1/F2 já executados (endereço PF → Location Core; blob deixou de receber escrita) |
| 0075 | DECISION_0075_COMPANY_BIRTH_PAGE_ACTOR_DRIFT | Diagnóstico/freeze → reconciliada (Opção B) | IMPLEMENTADO (decisão); birth atômico vivo | F-ATOMIC `withTransaction` em `createCompany` (ratificado por 0097 D2) |
| 0076 | DECISION_0076_PROFILE_ADDRESS_GEO_ENRICHMENT_POLICY | DOCS-ONLY (política D2) | PARCIAL | política; blob mantido como fallback transitório (por design) |
| 0077 | DECISION_0077_LOCATION_CORE_GEO_ENRICHMENT_POLICY | DOCS-ONLY (estratégia geo) | PARCIAL | F-GEO-1a infra (`cep-provider.ts`, `geo-enrichment.service.ts`) já existe |
| 0078 | DECISION_0078_GEO_CEP_CACHE_BACKFILL_POLICY | DOCS-ONLY (operacional) | ⚠️ IMPLEMENTADO | `cep_resolution_cache` (migration `20260601200000`) + `backfill-geo-enrichment.ts` existem |
| 0079 | DECISION_0079_LOCATION_CORE_NEIGHBORHOOD_POLICY | DOCS-ONLY (modelagem) | ⚠️ PARCIAL | coluna `addresses.neighborhood_display_text` **existe** (probe) — F-GEO-4a executado |
| 0080 | DECISION_0080_PROFILE_GENDER_IDENTITY_SSOT | DOCS-ONLY (modelagem D-GENDER) | ⚠️ IMPLEMENTADO | coluna `global_users.gender` **existe** (probe) — F1+ executado |
| 0081 | DECISION_0081_PJ_FISCAL_IDENTITY_AND_RESPONSIBILITY | DOCS-ONLY (M0 princípio) | IMPLEMENTADO (princípio promulgado) | decisão-mãe; derivadas implementadas em 0085+ |
| 0082 | DECISION_0082_PJ_CNPJ_CANONICAL_HOME | DOCS-ONLY (D1 precedência) | IMPLEMENTADO (princípio) | precedência materializada por `fiscal_identities` (0085) |
| 0083 | DECISION_0083_PJ_AUTHORIZED_LINKS_ENTERPRISE_RISK_PRINCIPLE | DOCS-ONLY (D3 princípio) | NÃO-IMPLEMENTADO (princípio; substrato risco ausente) | vínculos/risco enterprise = greenfield |
| 0084 | DECISION_0084_PJ_FISCAL_IDENTITY_CANONICAL_HOME | DOCS-ONLY (D2 princípio) | IMPLEMENTADO (via 0085) | princípio da casa fiscal; tabela criada em 0085 |
| 0085 | DECISION_0085_PJ_FISCAL_IDENTITY_TECHNICAL_DESIGN | ⚠️ DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO | ⚠️ IMPLEMENTADO | `fiscal_identities` + `companies.fiscal_identity_id` (migration `20260603120000`); 49 linhas vivas |
| 0086 | DECISION_0086_PJ_KYB_AUDITED_WRITER | ⚠️ DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO | ⚠️ IMPLEMENTADO | `fiscal_identity_kyb_requests` (`20260603130000`) + `fiscal-identity-kyb.service.ts` (submit/review) |
| 0087 | DECISION_0087_PJ_KYB_DOCUMENTS_SSOT | ⚠️ DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO | ⚠️ IMPLEMENTADO | `fiscal_identity_documents` (`20260603140000`) + `fiscal-identity-document.service.ts` + gate mínimo doc no review + rotas admin + e2es |
| 0088 | DECISION_0088_PJ_KYB_AUTHORITY_GATE | ⚠️ DOCS-ONLY / SEM CÓDIGO | ⚠️ IMPLEMENTADO | `evaluateKybLayer` em `authority-decision.service.ts` + e2e `validate-pipeline-e2e-pj-kyb-gate.ts` |
| 0089 | DECISION_0089_PJ_COMPANY_VERIFICATION_RECONCILIATION | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO (Fase 1 display) | payload expõe `kybStatus`/`isKybApproved`; gate F2-C lê `kyb_status` |
| 0090 | DECISION_0090_PJ_LEGACY_VERIFIED_WRITERS_RECONCILIATION | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO (writers neutralizados) | 5 writers VERIFIED neutralizados (Fases 2.1–2.5; DT MULTIPLE CLOSED por 0092) |
| 0091 | DECISION_0091_PJ_FASE12_QR_DESTINATION | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO | `validateInPerson` tombstonado (501 `PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`) |
| 0092 | DECISION_0092_PJ_LIFECYCLE_VERIFICATION_CLEANUP | ⚠️ DOCS-ONLY / SEM CÓDIGO / SEM SCHEMA | ⚠️ IMPLEMENTADO | reputation+CNPJ-lock derivam de `kyb_status`; CHECK `chk_companies_company_status_lifecycle` existe; `is_verified` dropado |
| 0093 | DECISION_0093_PJ_COMPANY_STATUS_IS_VERIFIED_COMPAT_CLEANUP | ⚠️ DOCS-ONLY / SEM MIGRATION | ⚠️ IMPLEMENTADO | `is_verified` **ABSENT** (probe; drop `20260604130000`); `company_status` ganhou CHECK lifecycle (`20260604120000`) |
| 0094 | DECISION_0094_PJ_SOCIAL_AUTHORITY_KYB_GATE | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO | gate KYB social em `social-2.0.service`/reputation (refs `kyb`/`evaluateKybLayer`) |
| 0095 | DECISION_0095_PJ_PROFILE_COMPLETENESS_CADASTRAL_NOT_FISCAL | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO | Profile Progress 1 executado (commit `0945b577`); peso presencial removido |
| 0096 | DECISION_0096_PJ_PRESENTIAL_VALIDATION_UX_RESERVED | ⚠️ DOCS-ONLY / SEM CÓDIGO | IMPLEMENTADO | UX 1A/1B/2 executadas (DT-PRESENTIAL-UX-ORPHANED CLOSED por 0097) |
| 0097 | DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION | DOCS-ONLY (institucional) | IMPLEMENTADO (modelo) | ratifica nascimento fiscal-first atômico vivo; §13 confirma migrations fiscais aplicadas |
| 0098 | DECISION_0098_PJ_OPERATIONAL_ACTIVATION_VOCABULARY | DOCS-ONLY | IMPLEMENTADO (par SSOT) | `activateCompanyOperationally` + par `primary_*` + CHECK pareado + rota ativação vivos |
| 0099 | DECISION_0099_PJ_PUBLICATION_OFFERING_GOVERNANCE | DOCS-ONLY | IMPLEMENTADO (norma; writer 0100) | publicação = ato soberano; runtime entregue em 0100 |
| 0100 | DECISION_0100_PJ_PUBLICATION_OFFERING_SCHEMA_MODEL | ⚠️ DOCS-ONLY (não autoriza migration) | ⚠️ IMPLEMENTADO | `company_concept_publications` (`20260604140000`) + `company-publications.service.ts` (publish/unpublish) |
| 0101 | DECISION_0101_PJ_KYB_REVOCATION_PUBLICATION_CASCADE | DOCS-ONLY | PARCIAL | cascata/projeção/rebuild vivos; writer `approved→rejected/suspended/closed` ainda ausente (DT OPEN) |
| 0102 | DECISION_0102_PJ_ONBOARDING_DOMAIN_ELIGIBILITY_GOVERNANCE | DOCS-ONLY | PARCIAL | DomainSelector neutralizado (`fix(pj): neutralize free domain selector`); elegibilidade derivada pendente |
| 0103 | DECISION_0103_PJ_CNAE_FISCAL_EVIDENCE_MODEL | ⚠️ DOCS-ONLY / SEM SCHEMA | ⚠️ IMPLEMENTADO | `fiscal_identity_economic_activities` (`20260604150000`) + `fiscal-identity-economic-activity.service.ts` (writer) |
| 0104 | DECISION_0104_PJ_CNAE_TO_CONCEPT_SUGGESTION_MATRIX | ⚠️ DOCS-ONLY / SEM SCHEMA / SEM SEED | ⚠️ IMPLEMENTADO | `cnae_concept_suggestions` (`20260604160000`) + seed MVP (`20260605120000`); 8 linhas vivas |
| 0105 | DECISION_0105_CONCEPTS_DOMAIN_SEMANTIC_LAYERS | DOCS-ONLY (semântica) | IMPLEMENTADO (docs-only por natureza) | promulgação semântica de `concepts.domain`; sem schema por design |
| 0106 | DECISION_0106_MARKETPLACE_DOMAIN_TO_N0_MAPPING | DOCS-ONLY (mapa) | NÃO-IMPLEMENTADO (esperado) | mapa promulgado; materialização em código = frente futura |
| 0107 | DECISION_0107_PJ_CONCEPT_DISPLAY_NAME_GOVERNED_LABELS | ⚠️ DOCS-ONLY / SEM SCHEMA / SEM SEED | ⚠️ IMPLEMENTADO | `concept_labels` **existe** (probe) com 7 labels MVP seedados |
| 0108 | DECISION_0108_PJ_PRODUCT_GOVERNANCE_BY_CATEGORY_BRANCH | DOCS-ONLY (norma) | PARCIAL | norma promulgada; guard-fix `F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX` é frente própria |
| 0109 | DECISION_0109_SERVICE_TRACK_B_TAXONOMY_BANKFREE_FOUNDATION | DOCS-ONLY (fundação) | PARCIAL | salão Bank-free selado (`SELO-SERVICE-SALON-BANK-FREE`); booking/payment bloqueados |
| 0110 | DECISION_0110_SERVICE_FINANCIAL_POLICY | DOCS-ONLY (política) | PARCIAL | `service-financial-firewall.ts` vivo (rotas financeiras fail-closed); runtime OFF |
| 0111 | DECISION_0111_SERVICE_RELEASE_CANCEL_DISPUTE_REFUND_POLICY | DOCS-ONLY (política) | NÃO-IMPLEMENTADO (esperado; flag OFF) | política fina; `SERVICE_FINANCIAL_RUNTIME_ENABLED` permanece OFF |

---

## Tabela mestra — Bloco 0112–0141 (pós-0111 · reindex A1 · 2026-06-20)

> **Natureza desta passada (A1, docs-only):** **DECLARADO** = status do header do próprio
> `DECISION_NNNN_*.md` (fonte soberana por linha; `REMEDIATION_DECISIONS_LOG.md` confirma
> existência/cauda até 0141). **Verificado = NÃO-AUDITADO** em TODAS — esta passada **não**
> re-checou runtime/schema; **não finge auditoria material**. Sem divergência header×LOG detectada.
> Sequência 0112→0141 completa (30 decisões, sem buraco, sem duplicata). Próximo nº livre: **0142**.

| Nº | Arquivo | Declarado (header do .md) | Verificado | 1-linha |
|----|---------|---------------------------|------------|---------|
| 0112 | DECISION_0112_PJ_DOCUMENT_STORAGE_PROVIDER | PROMULGADA (docs-only) | NÃO-AUDITADO | provider/porta canônica de documento PJ KYB |
| 0113 | DECISION_0113_ACTIONCONTEXT_ACTORID_OWNERSHIP_BINDING | PROMULGADA (docs-only) — emenda contratos | NÃO-AUDITADO | actorId declarado = hint; binding ao principal autenticado |
| 0114 | DECISION_0114_REGION_FUND_AND_AP_AR_INITIAL_AUTHORITY | PROMULGADA (docs-only) | NÃO-AUDITADO | autoridade inicial do fundo regional + AP/AR latente |
| 0115 | DECISION_0115_HUMAN_BIRTH_VERTICAL_ROOT_DECISIONS | PROMULGADA (docs-only) | NÃO-AUDITADO | decisões-raiz do nascimento humano vertical (G10) |
| 0116 | DECISION_0116_INTRA_TENANT_OWNERSHIP_VISIBILITY_POLICY | PROMULGADA (docs-only) | NÃO-AUDITADO | política canônica de ownership/visibilidade intra-tenant (8 classes) |
| 0117 | DECISION_0117_CANONICAL_CATALOG_OFFERING_MODEL | PROMULGADA (produto A–H) | NÃO-AUDITADO | modelo canônico de catálogo/oferta |
| 0118 | DECISION_0118_MEDIA_CONTEXTUAL_IDENTITY_AND_TEMPORAL_OWNER_AUTHORITY | PROMULGADA | NÃO-AUDITADO | identidade contextual de mídia + autoridade do owner temporal |
| 0119 | DECISION_0119_REFERRAL_LINK_PURE_VINCULO | PROMULGADA | NÃO-AUDITADO | referral link = vínculo puro A→B (sem escrita Bank) |
| 0120 | DECISION_0120_CIVIL_IDENTITY_CONFIRMATION_SSOT_SEPARATION | PROMULGADA | NÃO-AUDITADO | separação SSOT da confirmação de identidade civil |
| 0121 | DECISION_0121_BOOKING_ORDER_AUTHORITY_BINDING_CANONICAL | PROMULGADA (executada) | NÃO-AUDITADO | authority binding canônico booking→decision→service_order |
| 0122 | DECISION_0122_SERVICE_OFFERING_CANONICAL_BINDING | PROMULGADA (executada) | NÃO-AUDITADO | service_offering como recurso canônico de contratação |
| 0123 | DECISION_0123_DISPUTE_REVERSAL_AUTHORITY_BINDING_MODEL | **DECISION_REQUIRED / HOLD** | NÃO-AUDITADO | modelo autoridade dispute/reversal (rotas seguem 403) |
| 0124 | DECISION_0124_CLASSIC_CHANNEL_READERS_CLASSIFICATION | PROMULGADA (parcial) | NÃO-AUDITADO | classificação A–E dos classic-channel readers (params/query actorId) |
| 0125 | DECISION_0125_R2_COMPANY_USERS_FINE_GRANTS | PROMULGADA | NÃO-AUDITADO | grants finos R2 via company_users.can_* |
| 0126 | DECISION_0126_TENANT_LEVEL_OPERATOR_GRANTS | PROMULGADA | NÃO-AUDITADO | tenant-level operator grants (não company-scoped) |
| 0127 | DECISION_0127_TRUST_TENANT_GRANTS_R24_UNFREEZE | PROMULGADA | NÃO-AUDITADO | trust tenant-level grants; R2.4 unfreeze (cartório) |
| 0128 | DECISION_0128_CORE_FINANCIAL_APPROVAL_AUTHORITY | PROMULGADA/NORMATIVA — runtime NÃO implementado | NÃO-AUDITADO | core de aprovação financeira: grant não executa dinheiro |
| 0129 | DECISION_0129_PAYOUT_APPROVAL_AUTHORITY | PROMULGADA/NORMATIVA — approve endpoint NÃO implementado | NÃO-AUDITADO | autoridade de aprovação de payout (solicita/aprova/segregação) |
| 0130 | DECISION_0130_PAYOUT_APPROVAL_POLICY_MATERIALIZATION | PROMULGADA/NORMATIVA — runtime NÃO implementado | NÃO-AUDITADO | materialização da política de aprovação de payout |
| 0131 | DECISION_0131_AUTHORITY_GRAMMAR | PROMULGADA/NORMATIVA — DOCS-ONLY | NÃO-AUDITADO | gramática de autoridade (cita 0013→0130 + promulga 7 itens) |
| 0132 | DECISION_0132_TEMPORAL_PURPOSE_CONCEPT | PROMULGADA/NORMATIVA — DOCS-ONLY | NÃO-AUDITADO | finalidade temporal da agenda como CONCEPT |
| 0133 | DECISION_0133_SUPPLIERS_COMPANY_OWNED_OWNER_ACTOR_ID | PROMULGADA/NORMATIVA — DOCS-ONLY | NÃO-AUDITADO | suppliers company-owned via owner_actor_id (page-actor) |
| 0134 | DECISION_0134_ACTOR_REFERRAL_CAPABILITY_GRANTS_BASELINE | PROMULGADA/NORMATIVA (BASELINE) — DOCS-ONLY | NÃO-AUDITADO | baseline de capability grants do referral por actor |
| 0135 | DECISION_0135_PERMISSION_KEYS_NOMENCLATURE_RFC | PROMULGADA/NORMATIVA (RFC docs-only) | NÃO-AUDITADO | nomenclatura canônica de permission keys (domain:action) |
| 0136 | DECISION_0136_ACTOR_CAPABILITY_GRANTS_SUBSTRATE | PROMULGADA/NORMATIVA + MATERIALIZADA (Slice 1A) | NÃO-AUDITADO | substrato `actor_capability_grants` (cria tabela; grant ≠ representação) |
| 0137 | DECISION_0137_PERMISSION_TRI_REGISTRY_RFC | PROMULGADA/NORMATIVA (RFC docs-only) — IMPLEMENTED / HOLD YALA | NÃO-AUDITADO | tri-registry de permissões (papel canônico de cada vocabulário) |
| 0138 | DECISION_0138_CALENDAR_OPERATOR_GRANT_AUTHORITY_RFC | PROMULGADA/NORMATIVA (RFC docs-only) — CLOSED / YALA PASS | NÃO-AUDITADO | operador de agenda por grant explícito |
| 0139 | DECISION_0139_ACTOR_SCOPED_REFERRAL_CODE_AND_EARNINGS | PROMULGADA / DOCS-ONLY | NÃO-AUDITADO | referral code + earnings com ownership econômico por actor |
| 0140 | DECISION_0140_UNIFYCARD_FEE_BPS_RULING | DECIDED / DOCS-ONLY RULING / NOT MATERIAL | NÃO-AUDITADO | unidade canônica da taxa UnifyCard = fee em basis points (bps) |
| 0141 | DECISION_0141_UNIFYCARD_FEE_SCHEMA_OF_RECORD | PROMULGADA / DOCS-ONLY / SCHEMA-OF-RECORD / NOT MATERIAL | NÃO-AUDITADO | fee bps como schema-of-record no economic_policy_engine |

---

## Tabela mestra — Contratos de Core (não numerados)

| Doc | Declarado | Verificado | 1-linha |
|-----|-----------|------------|---------|
| DECISION_CORE_CONTRACT | CANONICAL/BINDING (Nível 1) | NÃO-AUDITADO | contrato do core de decisão/autorização ("se conflita → recusar") |
| DECISION_CORE_HARDENING_CONTRACT | CANONICAL/BINDING/CORE | NÃO-AUDITADO | hardening institucional do core de decisão |
| DECISION_SAFETY_AND_CONTAINMENT_CONTRACT | CANONICAL/BINDING/CORE | NÃO-AUDITADO | regras supremas de contenção decisória ("if it changes behavior, it is a decision") |
| DECISION_GATE_ZERO_B | Decisão de gate | NÃO-AUDITADO | substitui Gate Zero funcional (build global) por Gate Zero-B operacional |

---

## Seções por decisão (Tier 1)

### Cluster Learning / Interest (0064–0070) — CONCLUÍDO + SELADO

A frente Learning/Interest começou com persistência em blob `global_users.metadata` (abas "mortas") e convergiu para
substrato actor-first concept-anchored, espelhando o C1 profissional (DECISION-0063).

**0064 — Governança semântica (Opção C híbrida).** `categories` = navegação; `concepts` = identidade semântica (SSOT,
Lei 7); `source_category_id` = breadcrumb. Veta frontend criando taxonomia e blob como SSOT.
**Verificado: IMPLEMENTADO** — toda a cadeia 0065→0067 materializada e selada (`SELO_C1_LEARNING_INTEREST.md`).
DTs: `DT-LEARNING-INTEREST-BLOB-SSOT` (CLOSED), `DT-PROFILE-FRONTEND-DRIVES-TAXONOMY` (parcial → 0070).

**0065 / 0066 — Diretrizes materiais Learning / Interest.** Fixam slugs limpos de concept, domínio
`educacao-e-conhecimento` (learning) e `cultura-lazer-e-eventos` (interest novo), sufixo `-interesse` em categories
(ADENDO A, colisão de slug global). **Verificado: IMPLEMENTADO** — Migrations A/B aplicadas (36 + 11 concepts).

**0067 — C1 actor-first.** Duas tabelas (`actor_learning_concepts`, `actor_interest_concepts`) + view
`actor_concept_declarations_v`; ordem de 5 fatias. **Verificado: IMPLEMENTADO** — migration `20260601140000` cria as
tabelas+view; backfill `150000`; cleanup do blob `160000`. Build limpo (probe confirma tabelas+view presentes).

**0068 — Surfacing de conceptId em contextos declarativos.** Header já diz **EXECUTADA**. `conceptId` exposto só para
`professional`/`learning`/`interest`. **Verificado: IMPLEMENTADO** — `canExposeCategoryConceptId` em `categories.service.ts`.

**0069 — Readers user-scoped resolvem actor.** Header já diz **EXECUTADA (F1)**. **Verificado: IMPLEMENTADO** —
`profile-c1-declarations-read.service.ts` + `.repository.ts` presentes.

**0070 — Expansão IA de categories ≠ identidade semântica.** Split de DT (docs-only por natureza). Classifica o resíduo
Profissional/Educação/Empresas como expansão GOVERNADA de navegação. **Verificado: IMPLEMENTADO** (não há artefato a
construir; é decisão de classificação). DT nova `DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION` (DEFERRED).

### Cluster Dados sensíveis / Educação (0071, 0073)

**0071 — Política Lifestyle/Saúde (LGPD).** D1 promulgada: `sexualOrientation` fora do MVP; lifestyle privado+consent;
Saúde → 501; actor-first; `social-targeting` desacopla drinks/smokes. **Verificado: NÃO-IMPLEMENTADO (esperado)** — o
próprio doc declara implementação pendente; sequência F-SAUDE-501→...→F5 não auditada nesta passada.
DT: `DT-LIFESTYLE-SENSITIVE-IN-BLOB` (OPEN).

**0073 — Educação = declaração não-verificada.** Event-sourced (`event_log`), actor-first, append-only; veta apresentar
autoasserção como "validada institucionalmente". Implementação órfã `profile-education-companies.*` a quarentenar.
**Verificado: NÃO-AUDITADO** — F1/F2 (quarentena + rebaixamento de vocabulário) não auditados.

### Cluster Location Core / Geo / Gender (0072, 0074, 0076–0080)

Endereço civil PF saindo de blob para Location Core canônico (`addresses`+`address_assignments`), com estratégia de
enriquecimento geográfico compartilhável PF/PJ.

**0072 — Agenda/Availability B1.** Materializar grade semanal em janelas concretas em `unified_availability` (=tabela
`availability`); proíbe tabela temporal nova. **Verificado: NÃO-AUDITADO** — decisão de modelagem (F0); materializador
F1+ não auditado. DT: `DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT` (OPEN).

**0074 — Endereço PF → Location Core.** `owner_type='profile'`, `owner_id=actor_id`, `role='RESIDENCE'`.
**⚠️ Verificado: PARCIAL** — declarado DOCS-ONLY, mas a própria 0076 confirma **F1 (backend+backfill) e F2 (frontend)
já executados**; blob deixou de receber escrita. DT: `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN).

**0076 — Enriquecimento geográfico (D2).** Opção A: blob mantido como **fallback transitório de exibição** de
city/state/neighborhood. **Verificado: PARCIAL** (por design — o reader ainda lê o blob; cleanup bloqueado).

**0077 — Estratégia geo B+D+C.** state_id por UF + cidade IBGE sob demanda + lat/lng centroide coarse (LGPD).
**Verificado: PARCIAL** — F-GEO-1a infra existe.

**0078 — Cache/backfill CEP (D-GEO-1b).** Recomenda `cep_resolution_cache` + job idempotente.
**⚠️ Verificado: IMPLEMENTADO** — declarado DOCS-ONLY, mas `cep_resolution_cache` (migration `20260601200000`),
`cep-provider.ts`, `geo-enrichment.service.ts` e `backfill-geo-enrichment.ts` **existem**.

**0079 — Bairro = texto de exibição (não FK).** Destino: coluna textual controlada `addresses.neighborhood_display_text`.
**⚠️ Verificado: PARCIAL** — declarado DOCS-ONLY, mas a coluna `addresses.neighborhood_display_text` **existe** (probe);
F-GEO-4a (criar o campo) já foi executado. Cleanup do blob ainda bloqueado (DT OPEN).

**0080 — gender → Identity SSOT (`global_users.gender`).** D-GENDER: gender é atributo civil, fora do blob; enum
`male|female|other`; preserva lock/imutabilidade.
**⚠️ Verificado: IMPLEMENTADO** — declarado DOCS-ONLY, mas a coluna `global_users.gender` (text) **existe** (probe);
F1+ executado. DT: `DT-PERSONAL-GENDER-BLOB-TO-IDENTITY-SSOT`.

### Cluster PJ Identidade Fiscal / Princípios (0075, 0081–0084)

Cadeia de **princípio** (M0/D1/D2/D3) sobre a natureza da PJ. Estes são genuinamente docs-only de promulgação; o que foi
materializado foi a **D2 técnica (0085+)**.

**0075 — Drift no nascimento PJ → Opção B.** Freeze A/B reconciliado: **Opção B promulgada** (empresa nasce com
page-actor + identidade fiscal, mas pendente/não-operacional; atomicidade vira pré-requisito ATIVO).
**Verificado: IMPLEMENTADO (decisão)** — F-ATOMIC tornou `createCompany` transacional (`withTransaction`); 0097 D2
ratifica institucionalmente. DTs: `DT-COMPANY-BIRTH-PAGE-ACTOR-DRIFT` (PARTIALLY MITIGATED), `...NON-TRANSACTIONAL-CLEANUP`.

**0081 (M0) — PJ é identidade fiscal própria, não soberana.** Decisão-mãe + diretrizes antifraude verbalizadas (D1–D7).
**Verificado: IMPLEMENTADO (princípio)** — derivadas materializadas a partir de 0085. Substrato de risco enterprise
(grafo anti-laranja, risk_signals) permanece ausente (frente própria).

**0082 (D1) — Casa/precedência do CNPJ.** CNPJ mora em camada própria; `companies.cnpj` = projeção protegida; operação
por vínculo CPF (nunca login compartilhado). **Verificado: IMPLEMENTADO (princípio)** — materializado por
`fiscal_identities` (0085).

**0083 (D3-princípio) — Vínculo autorizado CPF→PJ + camada enterprise de risco.** Responder ≠ operar ≠ representar ≠
validar; senha compartilhada = anti-padrão. **Verificado: NÃO-IMPLEMENTADO** — substrato fino de vínculos/risco enterprise
não materializado (greenfield; `actor_relationships`/`risk_signals` ausentes).

**0084 (D2-princípio) — Casa fiscal própria, canônica e global.** D2.1–D2.8 (CNPJ único global; `companies.cnpj`
subordinado; KYC/docs/histórico na identidade fiscal; precedência fiscal PJ vence projeção).
**Verificado: IMPLEMENTADO (princípio)** — tabela materializada na 0085.

### Cluster PJ KYB Técnico (0085–0088) — ⚠️ GRANDE DIVERGÊNCIA (o ouro)

Os 4 docs declaram **"DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO / SEM SCHEMA"** mas o runtime KYB inteiro **está
implementado**. (0097 §13 e §D9.1 confirmam explicitamente, com `psql`, que as migrations fiscais estão aplicadas.)

**0085 (D2-técnica) — `fiscal_identities`.** Desenho técnico: nome, CNPJ `VARCHAR(14)` UNIQUE global, `kyb_status`,
FK `companies.fiscal_identity_id`, sequência fiscal-first no `withTransaction`.
**⚠️ Verificado: IMPLEMENTADO** — `fiscal_identities` + `companies.fiscal_identity_id` (migration `20260603120000`),
**49 linhas vivas** no dev; colunas batem com o desenho (`fiscal_identity_id, cnpj, kyb_status, created_by_actor_id,
reviewed_by_actor_id, reviewed_at, decision_reason, timestamps`); `uq_fiscal_identities_cnpj` + `chk_*_approved_audit`.

**0086 (F2-A) — Writer KYB auditado.** `fiscal_identity_kyb_requests`; submit/review atômico; `pending→approved|rejected`.
**⚠️ Verificado: IMPLEMENTADO** — migration `20260603130000` + `fiscal-identity-kyb.service.ts` (`submitFiscalKybRequest`/
`reviewFiscalKybRequest`) + e2e `validate-pipeline-e2e-pj-kyb-writer.ts`. DT: `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`.

**0087 (F2-B) — Documentos KYB SSOT.** `fiscal_identity_documents` append-only; `document_type` CHECK; mínimo documental
(`cnpj_registration`+`articles_of_association` aceitos) para aprovar KYB.
**⚠️ Verificado: IMPLEMENTADO** (caso canônico) — migration `20260603140000` + `fiscal-identity-document.service.ts`
(submit/list/review/supersede) + gate de mínimo no `reviewFiscalKybRequest` + rotas admin em `identity.routes.ts` +
e2e `validate-pipeline-e2e-pj-kyb-documents.ts`.

**0088 (F2-C) — Gate de autoridade financeira KYB.** `evaluateKybLayer` em `authority-decision.service`; só
`actor_type='page'`; bloqueia `financial_*` se `kyb_status != approved`; fail-closed; strict para dinheiro.
**⚠️ Verificado: IMPLEMENTADO** — `evaluateKybLayer`/`evaluatePageActorKybApproved` em `authority-decision.service.ts` +
e2e `validate-pipeline-e2e-pj-kyb-gate.ts`.

### Cluster PJ Reconciliação "empresa verificada" (0089–0096)

Eliminação da "segunda-verdade" (`company_status`/`is_verified`/`verifiedAt` × `kyb_status`). Docs declaram DOCS-ONLY,
mas as Fases 1→3 foram executadas em fatias próprias.

**0089 — `kyb_status` como fonte única (Fase 1 display).** **Verificado: IMPLEMENTADO** — payload expõe `kybStatus`/
`isKybApproved`; UI acende "verificada" só por `kyb_status='approved'`.

**0090 / 0091 — Neutralização dos 5 writers legados + destino da FASE 12.** `validateInPerson` é fóssil runtime-dead →
tombstone. **Verificado: IMPLEMENTADO** — `validateInPerson` retorna 501 (`PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`,
confirmado em `company-validation.service.ts` + e2e `validate-pipeline-e2e-pj-inperson-disabled.ts`); writers VERIFIED
removidos de `companies.service` (commit `d8d72666`).

**0092 — Fase 3: separar lifecycle × KYB × capability.** reputation/CNPJ-lock NÃO podem ler `company_status`.
**⚠️ Verificado: IMPLEMENTADO** — `reputation.service.ts` referencia `kyb_status`/`evaluateKybLayer`; CHECK
`chk_companies_company_status_lifecycle` existe; `is_verified` dropado. (Declarado "SEM SCHEMA" mas o schema mudou.)

**0093 — Fase 3.1: compat/deprecação de `company_status`/`is_verified` (declarado SEM MIGRATION).**
**⚠️ Verificado: IMPLEMENTADO** — probe: `companies.is_verified` **ABSENT** (drop `20260604130000`); `company_status`
ganhou CHECK lifecycle (`20260604120000`). A migration que o doc dizia adiar para "Fase 3.3" foi executada.

**0094 — Gate KYB na authority social (`publish_feed`/`cast_vote`).** **Verificado: IMPLEMENTADO** — `social-2.0.service`
e reputation referenciam o gate KYB; PJ pending bloqueada de broadcast.

**0095 — Completude cadastral ≠ verificação fiscal.** Remove peso presencial morto + teto de 80% do `profileProgress`.
**Verificado: IMPLEMENTADO** — Profile Progress 1 executado (commit `0945b577`).

**0096 — Validação presencial UX reservada/desabilitada.** **Verificado: IMPLEMENTADO** — UX 1A/1B/2 executadas;
`DT-PJ-PRESENTIAL-VALIDATION-UX-ORPHANED` CLOSED (confirmado por 0097 §6).

### Cluster PJ Nascimento/Ativação/Publicação/Onboarding (0097–0108)

**0097 — Nascimento + ativação operacional (modelo canônico).** Empresa nasce inerte (M1 fiscal-first transacional) e
só opera após ativação (M2 par `type+concept`); 4 eixos independentes; page-actor é o eixo operacional; descoberta por
CONCEPT. **Verificado: IMPLEMENTADO (modelo)** — ratifica estado vivo; §13 lista 355 migrations e confirma fiscal stack
aplicada. DTs: `...OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT`, `...ONBOARDING-DOMAIN-SELECTION-MISSING`.

**0098 — Vocabulário de ativação (par `primary_*` = SSOT).** `businessType`/`businessCategory`/`hybrid`/metadata =
legado/entrada. **Verificado: IMPLEMENTADO** — `activateCompanyOperationally` (writer do par) + CHECK pareado
`chk_companies_primary_classification_paired` + rota de ativação vivos. `hybrid` marcado DEPRECATED (DT OPEN).

**0099 — Publicação ≠ ativação (governança).** Publicação = ato soberano company/page-actor-level, KYB-gated, reversível,
auditável. **Verificado: IMPLEMENTADO (norma)** — schema/writer em 0100.

**0100 — Schema/writer de publicação (`company_concept_publications`).** Declarado "não autoriza migration".
**⚠️ Verificado: IMPLEMENTADO** — `company_concept_publications` (migration `20260604140000`) +
`company-publications.service.ts` (publish/unpublish + projeção); `tenant_concept_offerings` rebaixada a read-model.

**0101 — Revogação KYB → cascata sobre publicações.** KYB approved é gate contínuo; perda de approved retira publicações.
**Verificado: PARCIAL** — publish/unpublish + projeção + rebuild idempotente vivos, MAS o writer de **saída** de approved
(`approved→rejected/suspended/closed`) ainda **não existe** (DT `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` OPEN).
Logo a cascata não tem gatilho material ainda.

**0102 — Elegibilidade de domínios no onboarding.** Domínio de atuação derivado de CONCEPT, não livre-escolha de
frontend; modelo de 6 camadas. **Verificado: PARCIAL** — DomainSelector neutralizado (`fix(pj): neutralize free domain
selector`); ghost `company_domains` tratado; matriz de elegibilidade derivada ainda pendente. Nota-forward 0105 corrige
descrição ("13 N0"). DTs criadas: `...COMPANY-DOMAINS-GHOST-WRITER`, `...MARKETPLACE-DOMAIN-VOCABULARY-FORK`,
`...CNAE-EVIDENCE-NOT-PERSISTED`.

**0103 — CNAE como evidência fiscal (`fiscal_identity_economic_activities`).** Declarado "SEM SCHEMA".
**⚠️ Verificado: IMPLEMENTADO** — migration `20260604150000` + `fiscal-identity-economic-activity.service.ts` (writer
principal+secundários, idempotente, sem QSA). Ghost `companies.activity` previsto para cleanup.

**0104 — Matriz CNAE → suggested concept.** Declarado "SEM SCHEMA / SEM SEED". Sinal de sugestão, não autoridade.
**⚠️ Verificado: IMPLEMENTADO** — `cnae_concept_suggestions` (migration `20260604160000`) + seed MVP (`20260605120000`);
**8 linhas vivas**. Nota-forward 0105 corrige descrição de domínios.

**0105 — `concepts.domain` é dimensão multi-camada.** N0 de atuação + `financeiro-*` (RFC C2) + `item-comercial` (SKU).
`financeiro-*` é load-bearing do Bank (intocado). **Verificado: IMPLEMENTADO (docs-only por natureza)** — promulgação
semântica/documental; D8 explicitamente NÃO cria schema. DT `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` (PARTIALLY MITIGATED).

**0106 — Mapa `MarketplaceDomain → N0`.** market→produtos-e-comercio; services→servicos; events→cultura-lazer-e-eventos;
jobs→capability; real_estate/vehicles→regulados sem alvo. **Verificado: NÃO-IMPLEMENTADO (esperado)** — mapa promulgado;
materialização em código (derivar allowed domains) é frente futura.

**0107 — Display name em `concept_labels`.** Declarado "SEM SCHEMA / SEM SEED". `concepts` fica seco; label = apresentação.
**⚠️ Verificado: IMPLEMENTADO** — `concept_labels` **existe** (probe) com **7 labels MVP** seedados (Supermercado,
Hortifruti, Açougue, Padaria, Farmácia, Salão, Restaurante). Schema-migration + seed-MVP executados.

**0108 — Governança de produto por categoria/ramo.** `item-comercial` ≠ vendor; não comparar concepts por igualdade no
guard. **Verificado: PARCIAL** — norma promulgada; o guard-fix de código
(`F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX`) é frente própria não confirmada. DT `...PRODUCT-CONCEPT-GUARD-PRE-0105-LAYER-CONFLATION` (OPEN).

### Cluster Serviços / Trilho B (0109–0111)

**0109 — Fundação Trilho B Bank-free.** Serviço usa `domain='servicos'`; criação+agenda Bank-free; booking/payment
bloqueados; `availability` (core) é canônica; piloto = salão. **Verificado: PARCIAL** — salão Bank-free selado
(`SELO-SERVICE-SALON-BANK-FREE`); booking/order/payment permanecem bloqueados por design. 4 DTs abertas.

**0110 — Política financeira de serviços.** Pré-pago + escrow; pagamento direto proibido; KYB segura a saída; `bank_ledger`
SSOT. Rotas financeiras vivas declaradas FORA da política. **Verificado: PARCIAL** — `service-financial-firewall.ts` vivo
(fail-closed nas rotas financeiras); runtime financeiro **OFF**. 6 DTs de serviço abertas.

**0111 — Política fina (release/timeout/cancel/no-show/disputa/refund/split).** Release por confirmação OU timeout 7d;
KYB na saída fail-closed; split imutável pós-ledger. **Verificado: NÃO-IMPLEMENTADO (esperado)** — `SERVICE_FINANCIAL_
RUNTIME_ENABLED` permanece OFF; só política. Reabrir flag exige gate KYB no método + e2es fail-first.

---

## Tier 2 — Decisões 0001–0063 (só no `REMEDIATION_DECISIONS_LOG.md`)

> **Passada leve, honesta:** estas decisões vivem apenas no LOG append-only (`REMEDIATION_DECISIONS_LOG.md`). O
> **verificado = NÃO-AUDITADO** salvo onde o LOG declara supersessão ou o caso é trivialmente checável. **Numeração:** o
> LOG contém **duas séries paralelas históricas** — os números **0030/0031/0032/0033 aparecem DUAS VEZES** (uma série
> de gate/baseline, outra de features sociais). Estão desambiguados abaixo por linha do LOG + tema.
>
> **Atenção:** os números **0001–0013** NÃO têm cabeçalho `## DECISION-NNNN` no LOG (o LOG começa seus headers em
> DECISION-0014). Podem ter existido em versão anterior/outro artefato, ou nunca foram formalizados como header. Marcados
> como NÃO-LOCALIZADOS. Os números **0097–0111 também aparecem no LOG** como espelho dos .md de Tier 1 (não recontados aqui).

| Nº | Título curto (do LOG) | Declarado (LOG) | Verificado |
|----|----------------------|-----------------|------------|
| 0001–0013 | (sem header no LOG) | — | NÃO-LOCALIZADO |
| 0014 | Consolidação SSOT temporal (schedules → unified_availability) | arquitetural | NÃO-AUDITADO |
| 0015 | G2 Pipeline E2E transversal: fechamento PASS | gate | NÃO-AUDITADO |
| 0016 | Auditoria sistêmica repo↔DB validada (pós G2) | arquitetural | NÃO-AUDITADO |
| 0017 | Consolidação do gate de coerência repo↔schema | gate | NÃO-AUDITADO |
| 0018 | C66: resolução slug→UUID em concept_id (híbrido C+B) | arquitetural | NÃO-AUDITADO |
| 0019 | C66: realocação do helper concept-resolver core→modules | arquitetural | NÃO-AUDITADO |
| 0020 | Location Core: território como infraestrutura soberana | arquitetural | NÃO-AUDITADO (canônica; `addresses`/`address_assignments` vivos — base de 0074) |
| 0021 | Tenant-awareness em addresses (Opção A refinada) | arquitetural | NÃO-AUDITADO |
| 0022 | A4 group_invites — alias de compat sobre schema actor-based | arquitetural | NÃO-AUDITADO |
| 0023 | Materialização de schema (companies — colunas inexistentes) | arquitetural | NÃO-AUDITADO |
| 0024 | `bank_ledger` SSOT financeiro único; cache deprecado | arquitetural | NÃO-AUDITADO (princípio Bank vivo; reforçado por 0110/Lei 5) |
| 0025 | UnifyBank Genesis mono-currency (BRL) | arquitetural | NÃO-AUDITADO |
| 0026 | C22 reclassificada CRITICAL→DEBT (users.id + users.user_id) | desvio_baseline | NÃO-AUDITADO |
| 0027 | C29 reclassificada HIGH→DEBT (status UPPERCASE) | desvio_baseline | NÃO-AUDITADO |
| 0028 | CHECK UPPERCASE intencional (chat_reports/live_presence/event_reservations) | falso_positivo | NÃO-AUDITADO |
| 0029 | C19 — bank_transactions.reference_id UUID→TEXT (Opção A) | arquitetural | NÃO-AUDITADO |
| 0030-a | (L1725) C40 VIEW system_coverage NUMERIC→BIGINT | arquitetural | NÃO-AUDITADO |
| 0030-b | (L2953) Localização contextual de actor (entidade temporal-operacional) | arquitetural | NÃO-AUDITADO ⚠️ nº duplicado |
| 0031-a | (L1819) Coverage emerge de fluxo econômico, não de provisionamento | arquitetural | NÃO-AUDITADO |
| 0031-b | (L3053) Reactions como tabela polimórfica soberana | arquitetural | NÃO-AUDITADO ⚠️ nº duplicado |
| 0032-a | (L1904) Payment status canônico = lowercase; gateways convertem na borda | arquitetural | NÃO-AUDITADO (mesmo tema da DECISION-0032 referenciada na memória) |
| 0032-b | (L3135) post_cta como feature não-materializada (PREMATURO) | arquitetural | NÃO-AUDITADO ⚠️ nº duplicado |
| 0033-a | (L2097) `canonical_products.type` é discriminator ontológico | arquitetural | NÃO-AUDITADO |
| 0033-b | (L3186) post_media legacy substituído por posts.media_ids | arquitetural | NÃO-AUDITADO ⚠️ nº duplicado |
| 0034 | post_projects como feature não-materializada (PREMATURO) | arquitetural | NÃO-AUDITADO |
| 0035 | (sem header no LOG) | — | NÃO-LOCALIZADO |
| 0036 | `bank_splits` migra para target_account_id (account-centric) | arquitetural | NÃO-AUDITADO |
| 0037 | Ratificação `unified-availability` SSOT temporal + projeções | arquitetural | NÃO-AUDITADO |
| 0038 | "Código aspiracional ≠ capacidade": inventário antes de presumir feature | arquitetural | NÃO-AUDITADO |
| 0039 | Modo operante v1 = projeção UX hardcoded; v2 aguarda 3 frentes | arquitetural | NÃO-AUDITADO |
| 0040 | FANTASMAs com frontend caller — ratificação caso a caso | arquitetural | NÃO-AUDITADO |
| 0041 | policy-engine como módulo de risk-management isolado | arquitetural | NÃO-AUDITADO |
| 0042 | MEMBERSHIP SSOT: company_users expandido (Opção A) | arquitetural | NÃO-AUDITADO (`company_users` vivo) |
| 0043 | Convergência contextual progressiva (backend respeita actor) | arquitetural | NÃO-AUDITADO |
| 0044 | `critical_total` é resultado: classificação quádrupla boundary do bank | arquitetural | NÃO-AUDITADO |
| 0045 | Aplicação de 0044 a real-margin (nat.2) e rides (nat.4) | arquitetural | NÃO-AUDITADO |
| 0046 | `actor_wallet` como carteira canônica de qualquer actor econômico | arquitetural | NÃO-AUDITADO |
| 0047 | Economic Policy Engine como camada de DECISÃO de split | arquitetural | NÃO-AUDITADO |
| 0048 | Convergência policy engine: economic_policies resolve, UnifyBank materializa | arquitetural | NÃO-AUDITADO |
| 0049 | regional_origin_basis canônico (CNPJ identifica; actor opera) | arquitetural | NÃO-AUDITADO |
| 0050 | Cartório operacional de actor-unidade via service_provider | arquitetural | NÃO-AUDITADO |
| 0051 | Resolver dinâmico de regional_fund PJ-only (PE-5) | arquitetural | NÃO-AUDITADO |
| 0052 | F-REFUND-SPLIT-AWARE-HARDENING (taxonomia+autoria+linkage) | arquitetural | NÃO-AUDITADO (referenciada como base de refund por 0111) |
| 0053 | Actor Wallet Recovery Obligations | arquitetural | NÃO-AUDITADO (memória: IMPLEMENTADA C1–C7; base de recovery por 0111) |
| 0054 | Financial Approval Substrate | arquitetural | NÃO-AUDITADO |
| 0055 | Actor Wallet Debit for Recovery — semântica e autoridade | arquitetural | NÃO-AUDITADO |
| 0056 | Creditor Account for Actor Wallet Recovery | arquitetural | NÃO-AUDITADO |
| 0057 | User Wallet Owner Convention | arquitetural | NÃO-AUDITADO |
| 0058 | F-ACTOR-WALLET-PAYOUT-WIRING (saque voluntário) | arquitetural | NÃO-AUDITADO |
| 0059 | ACTOR_WALLET_PAYOUT_EXTERNAL_SETTLEMENT | arquitetural | NÃO-AUDITADO |
| 0060 | ACTOR_BANK_DESTINATIONS_GOVERNANCE | arquitetural | NÃO-AUDITADO |
| 0061 | ACTOR_PUBLIC_PROFILE_CANONICALITY | arquitetural | NÃO-AUDITADO |
| 0062 | CPF_CNPJ_SSOT_CANONICALITY_GLOBAL | arquitetural | NÃO-AUDITADO (memória: F0.1/F1/F2/F3/F3.1 v2 DONE; `global_users.cpf` UNIQUE global vivo) |
| 0063 | MVP_C1_PROFESSIONAL_DECLARATIVE_SUBSTRATE | arquitetural | NÃO-AUDITADO (`actor_professional_concepts` vivo — template citado por 0067) |

> **Nota:** as entradas 0064–0111 também existem no LOG (espelho dos .md). Foram auditadas na seção Tier 1 e não são
> recontadas aqui.

---

## Notas de método e honestidade

- **Probe ao banco** (`unificard_dev`, READ-ONLY): confirmou existência/ausência de tabelas, colunas, CHECK e contagens
  de linha. Script descartável criado e **apagado** ao fim; nenhum INSERT/UPDATE/DELETE foi executado.
- **"DOCS-ONLY" no cabeçalho ≠ "não implementado".** No fluxo do projeto, a DECISION promulga a norma numa sessão
  docs-only; a execução vem em **fatias executoras posteriores** que não reabrem o doc. Por isso o cabeçalho descreve a
  sessão de promulgação, não o runtime atual. As verificações ⚠️ medem essa defasagem.
- **NÃO-AUDITADO** foi usado onde não houve verificação material nesta passada (especialmente Tier 2 e algumas frentes de
  perfil — 0072/0073 — fora do foco PJ/KYB que motivou o índice). Não houve chute.
- **Onde declarado e verificado divergem** está marcado ⚠️ na tabela mestra e repetido no texto — são o resultado mais
  valioso (ver resumo abaixo).

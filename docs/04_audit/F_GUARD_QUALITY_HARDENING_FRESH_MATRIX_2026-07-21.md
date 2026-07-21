# F-GUARD-QUALITY-HARDENING

MATRIZ NOMINAL FRESCA DE QUALIDADE DOS 84
HEAD 467099be7dd6ae623f703f5f6b4b47304095977d
DATA 2026-07-21
STATUS: PERSISTIDA DOCS-ONLY · MATERIAL NÃO INICIADO

---

## 1. Natureza deste artefato

- **Não é** reconstrução do roster histórico dos 25 `ACTIVE_BUT_INCOMPLETE` do selo do AUDIT-002. Esse roster nominal **nunca foi persistido** — só as contagens agregadas (53/25/5/1) e a partição por lote (F-1=19/F-2=19/F-3=6/F-4=12/F-5=20/F-6=8) constam do cartório. Este documento **não fabrica** essa lista histórica.
- A comparação com "53/25/5/1" (AUDIT-002 selado) é **apenas agregada** — nenhuma linha aqui afirma "este arquivo era um dos 25 selados".
- Esta matriz foi **rederivada do zero** no HEAD atual, por leitura de código real + execução read-only de cada guard contínuo + falsificação de evasões concretas.
- **AUDIT-002 permanece válido e selado** (Veredito A, 84/84 auditados, encerramento administrativo 2026-07-21).
- **ROOT-003 permanece válido e selado** (F-RUNNER-COVERAGE-VISIBILITY-ANTI-DRIFT, Veredito A, selo completo 2026-07-21).
- Este artefato é um **documento de qualidade de guards**, não SSOT de produto, não concede GO de hardening, não altera enforcement, não é cartório (o cartório vigente continua sendo `REMEDIATION_DT_LOG.md`).

## 2. Bootstrap e rastreabilidade

- Domínio: documentação operacional de qualidade de guards.
- Pilar afetado: estado/auditoria operacional.
- Cartório vigente: `REMEDIATION_DT_LOG.md`.
- Guards são mecanismo de **enforcement**, não SSOT de produto; qualidade (o guard captura a evasão certa?) e enforcement (o guard roda em CI?) são **eixos independentes**.
- Lidos antes deste registro: `docs/01_normative/00_AGENT_PROTOCOL.md`; entradas vigentes de AUDIT-002/ROOT-003 em `REMEDIATION_DT_LOG.md` e `dividatecnica.md`; `RECOVERY_STATUS.md`; os 84 arquivos no disco; os 2 agregadores (`audit-legacy-service-availability-containment-suite.mjs`, `audit-authority-residual-hygiene-suite.mjs`); o comando próprio de `audit-actor-writer-boundaries.mjs` (`validate:actor-writer-boundaries`); as declarações `NOT_CI_REQUIRED` em `guard-coverage-declarations.json`.

## 3. Denominador (84 arquivos)

```
UNIVERSO: 84 arquivos sem entrada nominal direta no runner

ALCANCE
CI_AGGREGATED      : 77
CI_OTHER_COMMAND   : 1   (audit-actor-writer-boundaries.mjs, via npm run validate:actor-writer-boundaries)
NOT_CI_REQUIRED    : 6   (5 harnesses one-shot + audit-ownership-financial-phase1.ts)
ACTIVE_NOT_ENFORCED: 0

PAPEL
CONTINUOUS_GUARD : 78
ONE_SHOT_HARNESS : 5
NON_GUARD_TOOL   : 1

RUNNER (backend/scripts/run-regression-guards.mjs)
201 comandos totais
198 comandos audit-*
3 comandos não-audit
meta-guard audit-guard-coverage-manifest.mjs na última posição (comando #201)
drift: 0
```

## 4. Totais de qualidade (fecham em 84)

```
ACTIVE_VALID          = 47
ACTIVE_BUT_INCOMPLETE = 30
ONE_SHOT              = 5
STALE                 = 1
SUPERSEDED            = 1
TOTAL                 = 84
```

Famílias dos 30 `ACTIVE_BUT_INCOMPLETE` (fecham em 30):

```
A — SQL / DDL / GUC recognition               = 9
B — incomplete file discovery                 = 7
C — textual presence without structural proof = 11
D — fixed windows                             = 3
TOTAL ABI                                     = 30
```

## 5. Domínios frescos (classificação semântica desta rederivação, não os lotes históricos)

```
DOMAIN_BANK             = 14
DOMAIN_AUTHORITY        = 17
DOMAIN_RLS_TENANT       = 10
DOMAIN_SCHEMA           = 13
DOMAIN_RUNTIME_PRODUCT  = 23
DOMAIN_FRONTEND_SEAMS   = 7
TOTAL                   = 84
```

**Nota de proveniência (obrigatória):** esses 6 domínios são uma classificação semântica **fresca**, desta rederivação, e **não devem ser lidos como os lotes históricos** F-1/F-2/F-3/F-4/F-5/F-6 do AUDIT-002 selado. As contagens históricas seladas permanecem, separadamente, como registro do AUDIT-002:

```
F-1 (histórico, selado) = 19
F-2 (histórico, selado) = 19
F-3 (histórico, selado) = 6
F-4 (histórico, selado) = 12
F-5 (histórico, selado) = 20
F-6 (histórico, selado) = 8
F-7 (histórico, selado) = 0
TOTAL                   = 84
```

O mapa nominal per-arquivo desses lotes históricos **nunca foi persistido** no repositório (apenas contagens agregadas e algumas retificações pontuais constam do cartório) — por isso este documento **não atribui** nominalmente nenhum dos 84 arquivos aos lotes F-1..F-6 históricos. Fazê-lo exigiria fabricar uma atribuição inexistente.

## 6. Matriz nominal completa dos 84 arquivos

Prova de fechamento antes da tabela: **84 linhas · 84 paths únicos · 84 arquivos existentes no disco · 0 path ausente · 0 duplicata.**

| # | filename | path | enforcement | papel | domínio fresco | qualidade | família principal | evidência resumida |
|---|---|---|---|---|---|---|---|---|
| 1 | `audit-b-city-regional-treasury-grant-substrate-mutations.mjs` | `backend/scripts/audit-b-city-regional-treasury-grant-substrate-mutations.mjs` | NOT_CI_REQUIRED | ONE_SHOT_HARNESS | DOMAIN_BANK | ONE_SHOT | - | harness de mutacao do guard 187; autodeclarado fora do runner |
| 2 | `audit-b2b-payment-intent-antirevival-guard.mjs` | `backend/scripts/audit-b2b-payment-intent-antirevival-guard.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | token com word-boundary pega import/alias/chamada; re-export exige editar arquivo ja na allowlist |
| 3 | `audit-bank-transaction-sink-firewall.mjs` | `backend/scripts/audit-bank-transaction-sink-firewall.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de 4 metodos; um 5o INSERT INTO bank_transactions sem assert fica invisivel |
| 4 | `audit-fiscal-canonical-house.mjs` | `backend/scripts/audit-fiscal-canonical-house.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | CREATE TABLE public.company_profiles (schema-qualificado) e leitura via JOIN evadem o reconhecedor |
| 5 | `audit-fiscal-tax-reserve-bank-substrate-mutations.mjs` | `backend/scripts/audit-fiscal-tax-reserve-bank-substrate-mutations.mjs` | NOT_CI_REQUIRED | ONE_SHOT_HARNESS | DOMAIN_BANK | ONE_SHOT | - | harness de mutacao do guard fiscal-4E; autodeclarado fora do runner |
| 6 | `audit-ownership-financial-phase1.ts` | `backend/scripts/audit-ownership-financial-phase1.ts` | NOT_CI_REQUIRED | NON_GUARD_TOOL | DOMAIN_BANK | STALE | - | ferramenta FASE-1 one-time; tabelas-alvo accounts/group_balance nao existem mais |
| 7 | `audit-regional-fund-governance-schema-ghost-containment.mjs` | `backend/scripts/audit-regional-fund-governance-schema-ghost-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | varre todas as migrations; 7 endpoints 501 CONTAINED; zero caller de servico |
| 8 | `audit-regional-fund-legacy-credit-antirevival-guard.mjs` | `backend/scripts/audit-regional-fund-legacy-credit-antirevival-guard.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | SUPERSEDED | - | sink aposentado (retired 501) e tabelas regional_funds dropadas; contencao mais forte substitui |
| 9 | `audit-regional-fund-pf-resolver.mjs` | `backend/scripts/audit-regional-fund-pf-resolver.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | sentinela fail-closed POLICY_REGIONAL_ORIGIN_UNRESOLVABLE; janela cobre o branch inteiro |
| 10 | `audit-rides-financial-firewall.mjs` | `backend/scripts/audit-rides-financial-firewall.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | sink fisicamente RETIRED; caller mantem assert; flag estrita 403 |
| 11 | `audit-service-order-confirm-terms-financial-flag-failclosed.mjs` | `backend/scripts/audit-service-order-confirm-terms-financial-flag-failclosed.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | exige === true literal; variantes truthy falham o guard |
| 12 | `audit-subscriptions-run-due-http-containment.mjs` | `backend/scripts/audit-subscriptions-run-due-http-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | 403 com codigo de erro fixo; nenhuma chamada a runDueSubscriptions no escopo |
| 13 | `audit-treasury-split-superseded-antirevival-guard.mjs` | `backend/scripts/audit-treasury-split-superseded-antirevival-guard.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | busca por token cobre import direto e aliasado do executor congelado |
| 14 | `audit-venue-pay-money-hold-containment.mjs` | `backend/scripts/audit-venue-pay-money-hold-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_BANK | ACTIVE_VALID | - | sink de dinheiro fisicamente removido (forma A); assert nunca ausente sem falha |
| 15 | `audit-actor-available-group-coverage.mjs` | `backend/scripts/audit-actor-available-group-coverage.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | filtro de membership permanece na clausula WHERE; regressao real e detectada |
| 16 | `audit-actor-impersonation-writes.mjs` | `backend/scripts/audit-actor-impersonation-writes.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de 5 arquivos com contagem minima; novo handler sem gate no mesmo arquivo passa despercebido |
| 17 | `audit-actor-page-contract.mjs` | `backend/scripts/audit-actor-page-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | regex de escrita nao cobre SQL multi-linha idiomatico usado no repositorio |
| 18 | `audit-actor-relationship-boundary.mjs` | `backend/scripts/audit-actor-relationship-boundary.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | vocabulario de 7 rotulos travado em triplo; nenhuma dependencia de autoridade ou dinheiro |
| 19 | `audit-actor-type-vocabulary-freeze.mjs` | `backend/scripts/audit-actor-type-vocabulary-freeze.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | varredura real de tres arvores; tres padroes complementares; allowlist se autoaudita |
| 20 | `audit-actor-writer-boundaries.mjs` | `backend/scripts/audit-actor-writer-boundaries.mjs` | CI_OTHER_COMMAND | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | so reconhece a variavel local literal actorRepository; getActorRepository() encadeado e outros nomes evadem |
| 21 | `audit-company-activation-kyc-gate.mjs` | `backend/scripts/audit-company-activation-kyc-gate.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | prova apenas presenca textual, sem verificar se o caminho de negacao e alcancavel |
| 22 | `audit-cultural-checkin-target-actor-type-derived.mjs` | `backend/scripts/audit-cultural-checkin-target-actor-type-derived.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | bane uma unica forma de atribuicao; alias do corpo da requisicao evade |
| 23 | `audit-cultural-checkin-target-authority.mjs` | `backend/scripts/audit-cultural-checkin-target-authority.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | autoridade exigida antes do sink, no segmento correto da rota |
| 24 | `audit-delegation-scope-containment.mjs` | `backend/scripts/audit-delegation-scope-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | concessao condicionada ao escopo total; janela cobre a funcao inteira |
| 25 | `audit-event-lifecycle-authority.mjs` | `backend/scripts/audit-event-lifecycle-authority.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | presenca de token dentro de um segmento cujo limite vaza para o handler GET seguinte |
| 26 | `audit-group-actor-membership-foundation-mutations.mjs` | `backend/scripts/audit-group-actor-membership-foundation-mutations.mjs` | NOT_CI_REQUIRED | ONE_SHOT_HARNESS | DOMAIN_AUTHORITY | ONE_SHOT | - | harness de mutacao do guard 189; autodeclarado fora do runner |
| 27 | `audit-group-institutional-binding-mutations.mjs` | `backend/scripts/audit-group-institutional-binding-mutations.mjs` | NOT_CI_REQUIRED | ONE_SHOT_HARNESS | DOMAIN_AUTHORITY | ONE_SHOT | - | harness de mutacao do guard 188; autodeclarado fora do runner |
| 28 | `audit-public-profile-discovery-contract.mjs` | `backend/scripts/audit-public-profile-discovery-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | vinte e um subchecks; leitura publica sem PII; limite de linha nas consultas sensiveis |
| 29 | `audit-r2-delegation-writer-governed.mjs` | `backend/scripts/audit-r2-delegation-writer-governed.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | D-FIXED_WINDOW | piso de contagem igual ao atual; uma nova escrita sem o gate de autoria mantem a contagem |
| 30 | `audit-social-actors-available-self-anchored.mjs` | `backend/scripts/audit-social-actors-available-self-anchored.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_VALID | - | ancoragem em identidade constante do requisitante; mutacao da variavel e rejeitada |
| 31 | `audit-suppliers-identity-boundary.mjs` | `backend/scripts/audit-suppliers-identity-boundary.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_AUTHORITY | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de diretorios sensiveis omite modulos reais; alias de coluna evade o literal exigido |
| 32 | `audit-catalog-rls-scoped-isolation.mjs` | `backend/scripts/audit-catalog-rls-scoped-isolation.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | verificacao de acesso cru restrita a dois arquivos; a tabela e lida sem contexto em outros modulos |
| 33 | `audit-circuit-breaker-tenant-context-fix.mjs` | `backend/scripts/audit-circuit-breaker-tenant-context-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | D-FIXED_WINDOW | janela de texto fixa; uma leitura crua fora dessa janela nao e vista |
| 34 | `audit-group-a-financial-tables-rls.mjs` | `backend/scripts/audit-group-a-financial-tables-rls.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | le apenas uma migration entre centenas; desabilitacao ou nova tabela financeira posterior nao e vista |
| 35 | `audit-group-b-financial-workers-tenant-loop-rls.mjs` | `backend/scripts/audit-group-b-financial-workers-tenant-loop-rls.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de quatro workers; um worker adicional com o mesmo padrao de risco nao e coberto |
| 36 | `audit-guc-cross-context-reset-on-reuse.mjs` | `backend/scripts/audit-guc-cross-context-reset-on-reuse.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_VALID | - | verificacao dupla de reset centralizada no helper unico de conexao |
| 37 | `audit-guc-tenant-context-transaction-scope-fix.mjs` | `backend/scripts/audit-guc-tenant-context-transaction-scope-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_VALID | - | exige a forma correta de configuracao de sessao; forma incorreta e banida |
| 38 | `audit-helpers-dual-implementation-unified.mjs` | `backend/scripts/audit-helpers-dual-implementation-unified.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_VALID | - | delegacao simples para o helper central; duplicacao reintroduzida seria detectada |
| 39 | `audit-payment-intents-governance-funding-rls.mjs` | `backend/scripts/audit-payment-intents-governance-funding-rls.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | le apenas uma migration; remocao posterior de politica de isolamento nao e vista |
| 40 | `audit-raw-pool-rls-access-stale-guc-fix.mjs` | `backend/scripts/audit-raw-pool-rls-access-stale-guc-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | D-FIXED_WINDOW | janela de texto restrita a um metodo; refatoracao para outro metodo evade a checagem |
| 41 | `audit-rls-policy-guc-canonical.mjs` | `backend/scripts/audit-rls-policy-guc-canonical.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RLS_TENANT | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | lista negra de dois nomes de variavel de sessao; um terceiro nome nao canonico equivalente evade |
| 42 | `audit-availability-conflict-detection-materialized.mjs` | `backend/scripts/audit-availability-conflict-detection-materialized.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_VALID | - | verificacao sobre a migration corretiva ja aplicada; comentario falso no codigo vivo e banido |
| 43 | `audit-category-input-audit-schema-ghost-fix.mjs` | `backend/scripts/audit-category-input-audit-schema-ghost-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | le apenas a migration original; uma alteracao posterior que reintroduz a coluna fantasma nao e vista |
| 44 | `audit-checkout-event-ticket-legacy-schema-ghost-containment.mjs` | `backend/scripts/audit-checkout-event-ticket-legacy-schema-ghost-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de dois metodos; um metodo irmao adicional nao e coberto |
| 45 | `audit-company-metadata-ghost-cleanup.mjs` | `backend/scripts/audit-company-metadata-ghost-cleanup.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | ancorado ao nome do acumulador de campos; renomear a variavel evade a checagem |
| 46 | `audit-core-feed-batch-post-id-column-fix.mjs` | `backend/scripts/audit-core-feed-batch-post-id-column-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_VALID | - | ancoras positivas e negativas sobre a coluna correta da tabela de posts |
| 47 | `audit-event-reservations-mislabeled-fk-containment.mjs` | `backend/scripts/audit-event-reservations-mislabeled-fk-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | reconhece apenas uma forma de instrucao SQL; formas alternativas de recriar a referencia evadem |
| 48 | `audit-event-settlement-ghost-containment.mjs` | `backend/scripts/audit-event-settlement-ghost-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | nao reconhece formas alternativas de criacao de tabela alem da forma literal esperada |
| 49 | `audit-location-authority-classification.mjs` | `backend/scripts/audit-location-authority-classification.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | vocabulario de colunas territoriais incompleto; uma nova coluna paralela de bairro nao e coberta |
| 50 | `audit-rental-hardening-constraints.mjs` | `backend/scripts/audit-rental-hardening-constraints.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_VALID | - | verificacao semantica da restricao de exclusao; varredura completa contra remocao futura |
| 51 | `audit-schema-authority-classification.mjs` | `backend/scripts/audit-schema-authority-classification.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | lista de permissao por nome de arquivo; dois arquivos homonimos legitimos e ilegitimos coexistem |
| 52 | `audit-service-feed-getpost-column-fix.mjs` | `backend/scripts/audit-service-feed-getpost-column-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_VALID | - | metodo isolado corretamente; coluna correta exigida e coluna incorreta banida |
| 53 | `audit-unread-counts-feed-visibility-fix.mjs` | `backend/scripts/audit-unread-counts-feed-visibility-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | janela de texto ancorada em comentarios; presenca de predicado pode ser satisfeita dentro de um comentario |
| 54 | `audit-user-group-allocations-silent-call-fix.mjs` | `backend/scripts/audit-user-group-allocations-silent-call-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_SCHEMA | ACTIVE_VALID | - | sonda estrutural de existencia de tabela antes de decidir; captura silenciosa comum e detectada |
| 55 | `audit-cbo-matcher-dormant-landmine-removal.mjs` | `backend/scripts/audit-cbo-matcher-dormant-landmine-removal.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | ausencia do arquivo e o estado esperado de aprovacao; presenca reintroduz a falha |
| 56 | `audit-composer-contract.mjs` | `backend/scripts/audit-composer-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | delegacao obrigatoria ao servico central de intents; vocabulario paralelo e banido |
| 57 | `audit-crm-projection-suppliers-reconciliation.mjs` | `backend/scripts/audit-crm-projection-suppliers-reconciliation.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | checagens nao removem comentarios antes de buscar os tokens exigidos |
| 58 | `audit-demand-orchestration-boundary.mjs` | `backend/scripts/audit-demand-orchestration-boundary.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | contagem agregada de rotas e portoes; nao garante vinculo um-para-um por rota |
| 59 | `audit-discovery-has-availability-canonical-filter.mjs` | `backend/scripts/audit-discovery-has-availability-canonical-filter.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | predicado da fonte canonica exigido e predicado legado banido no mesmo trecho |
| 60 | `audit-erp-composed-view.mjs` | `backend/scripts/audit-erp-composed-view.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | janelas de texto falham de forma restritiva quando o bloco cresce; varredura de dinheiro cobre o modulo inteiro |
| 61 | `audit-event-rfq-legacy-availability-antirevival-guard.mjs` | `backend/scripts/audit-event-rfq-legacy-availability-antirevival-guard.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_BUT_INCOMPLETE | C-TEXTUAL_PRESENCE | busca apenas a forma de chamada direta; chamada desestruturada ou apelidada evade |
| 62 | `audit-governed-vocabulary-manifest-mutations.mjs` | `backend/scripts/audit-governed-vocabulary-manifest-mutations.mjs` | NOT_CI_REQUIRED | ONE_SHOT_HARNESS | DOMAIN_RUNTIME_PRODUCT | ONE_SHOT | - | harness de mutacao do guard de vocabulario governado; autodeclarado fora do runner |
| 63 | `audit-governed-vocabulary-manifest.mjs` | `backend/scripts/audit-governed-vocabulary-manifest.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | verificacao estrutural via analise de sintaxe da declaracao de origem de cada vocabulario |
| 64 | `audit-hobby-matcher-dirname-esm-fix.mjs` | `backend/scripts/audit-hobby-matcher-dirname-esm-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | proibicao de padrao incompativel com modulos ECMAScript; caminho correto exigido |
| 65 | `audit-l5-frozen-modules-ghost-containment.mjs` | `backend/scripts/audit-l5-frozen-modules-ghost-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | seis alvos de contencao; verificacao de acesso cru como reforco adicional |
| 66 | `audit-legacy-service-availability-endpoint-containment.mjs` | `backend/scripts/audit-legacy-service-availability-endpoint-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | ancoras de rota reais; sentinela de contencao exigida e sinal legado banido |
| 67 | `audit-legacy-service-availability-feed-badge-containment.mjs` | `backend/scripts/audit-legacy-service-availability-feed-badge-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | ordem estrutural exigida entre a checagem canonica e a legada |
| 68 | `audit-legacy-service-availability-reader-containment.mjs` | `backend/scripts/audit-legacy-service-availability-reader-containment.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | supressao do resumo legado exigida no metodo correto |
| 69 | `audit-marketplace-domain-n0-mapping.mjs` | `backend/scripts/audit-marketplace-domain-n0-mapping.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | valores literais do mapeamento comparados contra a decisao normativa de origem |
| 70 | `audit-provider-availability-readers-canonical.mjs` | `backend/scripts/audit-provider-availability-readers-canonical.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | predicado de posse canonica exigido; colunas mortas legadas banidas |
| 71 | `audit-rental-resource-surface-contract.mjs` | `backend/scripts/audit-rental-resource-surface-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | posse do recurso derivada do lado do servidor; ausencia de qualquer token de dinheiro |
| 72 | `audit-search-omni-federation-contract.mjs` | `backend/scripts/audit-search-omni-federation-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | projecao anti-identificacao pessoal na busca federada; nenhuma leitura paralela por entidade |
| 73 | `audit-service-booking-requested-effect-emission.mjs` | `backend/scripts/audit-service-booking-requested-effect-emission.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | forma exata de resolucao do dono da disponibilidade exigida |
| 74 | `audit-service-discovery-future-availability-slice-b.mjs` | `backend/scripts/audit-service-discovery-future-availability-slice-b.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | parametros posicionais na consulta; nomes de parametro corretos exigidos no cliente |
| 75 | `audit-social-post-visibility-read-enforcement.mjs` | `backend/scripts/audit-social-post-visibility-read-enforcement.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | predicado unico de audiencia reutilizado em multiplos pontos de leitura |
| 76 | `audit-support-ticket-business-fact-gate.mjs` | `backend/scripts/audit-support-ticket-business-fact-gate.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_VALID | - | comparacao causal exata entre partes declaradas e partes reais resolvidas |
| 77 | `audit-vehicle-fields-governed.mjs` | `backend/scripts/audit-vehicle-fields-governed.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_RUNTIME_PRODUCT | ACTIVE_BUT_INCOMPLETE | A-SQL_DDL_GUC | verificacao do tipo do preco apenas na migration de criacao; alteracao posterior de tipo nao e vista |
| 78 | `audit-actor-mode-surface-clarity-slice.mjs` | `backend/scripts/audit-actor-mode-surface-clarity-slice.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | ordem estrutural exigida entre os elementos visuais da faixa de identidade |
| 79 | `audit-audience-single-source.mjs` | `backend/scripts/audit-audience-single-source.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_BUT_INCOMPLETE | B-FILE_DISCOVERY | lista fixa de quatro consumidores; uma quinta tela com rotulos fixos nao e vista |
| 80 | `audit-available-actor-user-id-misuse.mjs` | `backend/scripts/audit-available-actor-user-id-misuse.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | varredura real de todo o frontend; acesso direto a propriedade incorreta e detectado |
| 81 | `audit-company-agenda-real-wiring.mjs` | `backend/scripts/audit-company-agenda-real-wiring.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | autoridade exigida antes da gravacao real na agenda temporal |
| 82 | `audit-crm-myorders-route-prefix-contract.mjs` | `backend/scripts/audit-crm-myorders-route-prefix-contract.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | ausencia confirmada do modulo legado; contrato de prefixo real ainda vivo e verificado |
| 83 | `audit-getcompany-response-unwrap-fix.mjs` | `backend/scripts/audit-getcompany-response-unwrap-fix.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | forma exata de desembrulho da resposta; refatoracao equivalente ainda assim falha o guard |
| 84 | `audit-jwt-payload-decode-frontend.mjs` | `backend/scripts/audit-jwt-payload-decode-frontend.mjs` | CI_AGGREGATED | CONTINUOUS_GUARD | DOMAIN_FRONTEND_SEAMS | ACTIVE_VALID | - | varredura real do frontend; uso fora do auxiliar unico e detectado |


## 7. Roster nominal completo dos 30 ACTIVE_BUT_INCOMPLETE

| # | filename | família | severidade | DB/E2E necessário | DECISION necessária | tranche candidata |
|---|---|---|---|---|---|---|
| 1 | `audit-event-reservations-mislabeled-fk-containment.mjs` | A-SQL_DDL_GUC | média | não | não | F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION |
| 2 | `audit-event-settlement-ghost-containment.mjs` | A-SQL_DDL_GUC | média | não | não | F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION |
| 3 | `audit-fiscal-canonical-house.mjs` | A-SQL_DDL_GUC | média | não | não | F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION |
| 4 | `audit-group-a-financial-tables-rls.mjs` | A-SQL_DDL_GUC | alta (RLS/Bank) | E2E-twin já existe | não | tranche futura RLS (não desenhada) |
| 5 | `audit-payment-intents-governance-funding-rls.mjs` | A-SQL_DDL_GUC | alta (RLS) | E2E-twin já existe | não | tranche futura RLS (não desenhada) |
| 6 | `audit-rls-policy-guc-canonical.mjs` | A-SQL_DDL_GUC | média (RLS) | não | não | tranche futura RLS (não desenhada) |
| 7 | `audit-category-input-audit-schema-ghost-fix.mjs` | A-SQL_DDL_GUC | baixa | não | não | tranche futura migração (não desenhada) |
| 8 | `audit-location-authority-classification.mjs` | A-SQL_DDL_GUC | baixa-média | não | não | tranche futura migração (não desenhada) |
| 9 | `audit-vehicle-fields-governed.mjs` | A-SQL_DDL_GUC | baixa-média (dinheiro) | não | não | tranche futura migração (não desenhada) |
| 10 | `audit-bank-transaction-sink-firewall.mjs` | B-FILE_DISCOVERY | crítica (Bank sink) | não | não | tranche futura descoberta-de-superfície (não desenhada) |
| 11 | `audit-group-b-financial-workers-tenant-loop-rls.mjs` | B-FILE_DISCOVERY | crítica (RLS/tenant) | não | sim (DECISION-0191 D2) | GATE dos demais workers globais (não este ato) |
| 12 | `audit-actor-impersonation-writes.mjs` | B-FILE_DISCOVERY | alta (autoridade) | E2E útil | não | tranche futura descoberta-de-superfície (não desenhada) |
| 13 | `audit-catalog-rls-scoped-isolation.mjs` | B-FILE_DISCOVERY | média-alta (RLS) | não | não | tranche futura descoberta-de-superfície (não desenhada) |
| 14 | `audit-suppliers-identity-boundary.mjs` | B-FILE_DISCOVERY | média | não | não | tranche futura descoberta-de-superfície (não desenhada) |
| 15 | `audit-audience-single-source.mjs` | B-FILE_DISCOVERY | baixa-média | não | não | tranche futura descoberta-de-superfície (não desenhada) |
| 16 | `audit-checkout-event-ticket-legacy-schema-ghost-containment.mjs` | B-FILE_DISCOVERY | baixa | não | não | tranche futura descoberta-de-superfície (não desenhada) |
| 17 | `audit-actor-writer-boundaries.mjs` | C-TEXTUAL_PRESENCE | média-alta (identidade) | não | não | tranche futura textual (não desenhada) |
| 18 | `audit-event-lifecycle-authority.mjs` | C-TEXTUAL_PRESENCE | alta (autoridade) | E2E útil | não | tranche futura textual (não desenhada) |
| 19 | `audit-actor-page-contract.mjs` | C-TEXTUAL_PRESENCE | média | não | não | tranche futura textual (não desenhada) |
| 20 | `audit-schema-authority-classification.mjs` | C-TEXTUAL_PRESENCE | média | não | não | tranche futura textual (não desenhada) |
| 21 | `audit-company-activation-kyc-gate.mjs` | C-TEXTUAL_PRESENCE | média | não | não | tranche futura textual (não desenhada) |
| 22 | `audit-demand-orchestration-boundary.mjs` | C-TEXTUAL_PRESENCE | média | não | não | tranche futura textual (não desenhada) |
| 23 | `audit-event-rfq-legacy-availability-antirevival-guard.mjs` | C-TEXTUAL_PRESENCE | média | não | não | tranche futura textual (não desenhada) |
| 24 | `audit-unread-counts-feed-visibility-fix.mjs` | C-TEXTUAL_PRESENCE | média | não | confirmar modelo atual de visibilidade (não é GO de produto) | tranche futura textual (não desenhada) |
| 25 | `audit-cultural-checkin-target-actor-type-derived.mjs` | C-TEXTUAL_PRESENCE | baixa-média | não | não | tranche futura textual (não desenhada) |
| 26 | `audit-company-metadata-ghost-cleanup.mjs` | C-TEXTUAL_PRESENCE | baixa | não | não | tranche futura textual (não desenhada) |
| 27 | `audit-crm-projection-suppliers-reconciliation.mjs` | C-TEXTUAL_PRESENCE | baixa | não | não | tranche futura textual (não desenhada) |
| 28 | `audit-raw-pool-rls-access-stale-guc-fix.mjs` | D-FIXED_WINDOW | média (RLS) | não | não | tranche futura janela-fixa (não desenhada) |
| 29 | `audit-r2-delegation-writer-governed.mjs` | D-FIXED_WINDOW | média (autoridade) | não | não | tranche futura janela-fixa (não desenhada) |
| 30 | `audit-circuit-breaker-tenant-context-fix.mjs` | D-FIXED_WINDOW | média (dinheiro+RLS) | não | não | tranche futura janela-fixa (não desenhada) |


## 8. Transições reais (candidata → final), exatamente duas

### 8.1 `audit-actor-writer-boundaries.mjs`

`ACTIVE_VALID → ACTIVE_BUT_INCOMPLETE`

**Motivo:** o padrão de detecção (`VIOLATION_PATTERN = /actorRepository\.(findOrCreateUserActor|findOrCreatePageActor)/`) só reconhece chamadas sobre a variável local literalmente nomeada `actorRepository`. Testado deterministicamente (regex real, em cópia temporária, sem alterar o working tree):

- `const actorRepository = reg.getActorRepository(); actorRepository.findOrCreateUserActor(x)` → **detectado**
- `const r = reg.getActorRepository(); r.findOrCreateUserActor(x)` (outro nome de variável) → **evade**
- `socialPortsRegistry.getActorRepository().findOrCreateUserActor(x)` (chamada encadeada) → **evade**
- `socialPortsRegistry.getActorRepository()['findOrCreateUserActor'](x)` (bracket-access) → **evade**

`getActorRepository()` é o acessor de injeção de dependência **dominante no código real** (`ports-registry.ts`, dezenas de call-sites) — a forma encadeada é o idioma mais comum, não um caso artificial.

Enforcement permanece: `CI_OTHER_COMMAND` (inalterado; roda via `npm run validate:actor-writer-boundaries`, fora do runner).

### 8.2 `audit-rls-policy-guc-canonical.mjs`

`ACTIVE_VALID → ACTIVE_BUT_INCOMPLETE`

**Motivo:** o guard varre **todas** as migrations (mecanismo forte) mas reconhece o vício por **lista negra de 2 nomes** não-canônicos conhecidos (`app.tenant_id`, `app.current_tenant_id`). Uma nova `CREATE POLICY` usando um **terceiro** GUC não-canônico semanticamente equivalente (ex.: `current_setting('app.tenant')`) — que o runtime também nunca seta — reproduz exatamente a classe do BLOCKER 2026-07-06 (RLS quebra-fechada silenciosa) sem ser detectada. O guard já **lista em comentário** o vocabulário canônico permitido (`app.current_tenant`/`app.is_platform_admin`/`app.concept_governance`) mas não o **aplica** como whitelist.

O hardening futuro deverá validar contra o **vocabulário permitido** (whitelist), não contra uma lista negra de nomes já conhecidos — **não realizado neste ato**.

**Não é registrada como transição:** `audit-group-a-financial-tables-rls.mjs` — já era `ACTIVE_BUT_INCOMPLETE` na matriz candidata; a Yala apenas **confirmou** a incompletude (1 migration de 533 lida; `DISABLE RLS`/`DROP POLICY` posterior e novas tabelas financeiras fora do roster fixo de 15 evadem). Não é demotion nova; não altera o agregado.

Aritmética (passo a passo, a partir da matriz candidata anterior):

```
candidata: 49 ACTIVE_VALID / 28 ACTIVE_BUT_INCOMPLETE / 5 ONE_SHOT / 1 STALE / 1 SUPERSEDED
  -1 AV +1 ABI : audit-actor-writer-boundaries.mjs   (evasão reproduzida, §8.1)
  -1 AV +1 ABI : audit-rls-policy-guc-canonical.mjs  (evasão estrutural, §8.2)
final:     47 ACTIVE_VALID / 30 ACTIVE_BUT_INCOMPLETE / 5 ONE_SHOT / 1 STALE / 1 SUPERSEDED = 84
```

## 9. Casos especiais

### 9.1 `audit-regional-fund-legacy-credit-antirevival-guard.mjs` — SUPERSEDED

O sink que o guard protegia (`recordRegionalFundCredit`) foi **aposentado na fonte** — o corpo da função é hoje `retired('recordRegionalFundCredit')`, retornando 501. As tabelas `regional_funds`/`regional_fund_allocations` foram **dropadas** (migration `20260710110000`). A contenção atual (retirada na fonte + drop de tabela) é **estruturalmente mais forte** que o que o guard antirevival provava — por isso `SUPERSEDED`, não `STALE` (o guard não mente sobre o modelo; só ficou redundante) nem `RETIRE_CANDIDATE` (que seria consequência administrativa, não classificação de qualidade). A permanência do guard no agregador é **higiene defensável**, não um erro. Não altera `ACTIVE_NOT_ENFORCED` (permanece 0).

### 9.2 `audit-ownership-financial-phase1.ts` — STALE · NON_GUARD_TOOL · NOT_CI_REQUIRED

Ferramenta one-time da FASE 1 (auditoria/preparação, não guard de regressão). Mira tabelas (`accounts`, `group_balance`) sem `CREATE` em nenhuma migration vigente — o substrato atual é `bank_accounts`/`bank_ledger`. Não wired ao runner nem a nenhum agregador. Classificação inalterada em relação ao cartório.

### 9.3 `audit-unread-counts-feed-visibility-fix.mjs` — ACTIVE_BUT_INCOMPLETE (família C)

O invariante do contador permanece **vivo**: o contador `feed` de `/feed` e `/social` deve usar o predicado vivo (`is_published` + não-deletado + `groupId IS NULL`), nunca member-scoped, preservando `countOrNull`. A premissa histórica do comentário do guard ("coluna que nunca existiu") está **stale** — `posts.visibility` foi materializado em `20260705120000_posts_visibility_governed.sql` (domínio `public|connections|only_me`) — mas isso não invalida a proteção viva (o valor banido `'PUBLIC'` maiúsculo nunca está no domínio real, então o ban continua inócuo). A incompletude real: a janela de extração **não remove comentários** antes de buscar os tokens do predicado — presença de predicado pode ser satisfeita **dentro de um comentário**, sem prova de que o SQL real ainda o contém. Nenhuma decisão de produto foi tomada neste ato.

### 9.4 `audit-crm-myorders-route-prefix-contract.mjs` — ACTIVE_VALID

O contrato `/api/my-orders` (via `apiFetchJson`) e o anti-revival do módulo `crm.*` (confirmado ausente no disco) continuam **vivos** hoje. Não é drift: a classificação `SUPERSEDED_EXPLICIT` do Passe-1 do AUDIT-002 foi uma sobre-classificação — o invariante sempre foi vivo; a matriz fresca é leitura mais precisa, não uma reclassificação retroativa do selo.

## 10. Achado residual read-only — `actor-wallet-payout-worker.ts`

```
backend/src/workers/actor-wallet-payout-worker.ts
DORMANT
CONTAINED
NOT STOP
```

Registro de precisão:

- `ENABLE_PAYOUT_WORKER` é **uma única flag** (fail-closed, exige a string exata `'true'`) checada em mais de um ponto (worker + comentário de defesa-em-profundidade no BOOT) — **não são duas barreiras independentes**, é uma flag verificada redundantemente.
- **Default-off estrito** — sem auto-enable por `NODE_ENV`.
- O claim (`claimApprovedActorWalletPayouts`) é **global** — `SELECT` sem filtro de tenant, via `pool.connect()` cru, com `FOR UPDATE OF awp SKIP LOCKED`.
- **Sem filtro de tenant no claim.**
- Os **efeitos são tenant-scoped por linha** — o `tenant_id` de cada linha capturada é passado ao executor selado (`executeActorWalletPayout(tenantId, id, performedByUserId)`).
- Usa o **executor selado** (F-PAYOUT-EXECUTION-SEAL); o worker **não toca `bank_*` diretamente**.
- O dinheiro segue atrás do firewall do Bank (`BANK_TRANSACTION_SINK_FIREWALL`, default-off) + PORTA-1 (fechada) — barreira **independente** da flag do worker.
- A alegação de que a RLS de `actor_wallet_payout_requests` retorna necessariamente zero linhas sem contexto de tenant ficou **NÃO CONFIRMADA** nesta passagem (não foi verificado se a tabela tem RLS+FORCE); isso não altera o veredito de contenção, que já se apoia no default-off duplo-checado + firewall do Bank + executor selado.
- Deve entrar **nominalmente** no futuro GATE dos demais workers globais da DECISION-0191 (categoria D2 — "demais workers com padrão global", hoje registrada sem nomear este worker).
- É **ponto cego real** do guard `audit-group-b-financial-workers-tenant-loop-rls.mjs` (roster fixo de 4 workers; este worker não consta).
- **Não autoriza qualquer correção de worker neste ato.** A DECISION-0191 não foi alterada.

## 11. Tranche candidata (não autorizada)

```
F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION
STATUS: TRANCHE_COHERENT
NOT AUTHORIZED
MATERIAL NOT STARTED
```

Guards:

1. `audit-event-reservations-mislabeled-fk-containment.mjs`
2. `audit-event-settlement-ghost-containment.mjs`
3. `audit-fiscal-canonical-house.mjs`

Os três compartilham a mesma deficiência de reconhecimento estrutural de forma de SQL/DDL (reconhecem uma única forma de instrução e evadem por `ADD CONSTRAINT` separado, `SELECT INTO`, `EXECUTE format`, qualificação de schema, ou leitura via `JOIN`). Os invariantes protegidos **permanecem separados** (FK mal-rotulada ≠ tabela fantasma de settlement ≠ leitura fantasma fiscal) — nenhum mega-guard é proposto. O desenho exato de um eventual helper/reconhecedor compartilhado ainda deve ser definido num **GATE material read-only próprio**; nenhum helper, parser ou mutation é criado neste ato; nem o runner nem os agregadores serão alterados por esta tranche quando (e se) autorizada; a futura execução material exigirá **Yala independente** antes do selo.

## 12. Backlog aberto (nenhum item com GO)

1. Primeira tranche DDL candidata (`F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION`) — sem GO.
2. `actor-wallet-payout-worker.ts` — a inventariar nominalmente no futuro GATE dos demais workers globais da DECISION-0191 (D2) — sem GO.
3. Os 30 `ACTIVE_BUT_INCOMPLETE` permanecem **abertos** — este ato não fecha nenhum deles.
4. Nenhum material foi iniciado.

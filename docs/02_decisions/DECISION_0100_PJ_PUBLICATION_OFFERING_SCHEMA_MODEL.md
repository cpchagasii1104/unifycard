# DECISION-0100 — Modelo de schema/writer de publicação/oferta PJ (company_concept_publications)

**Data:** 2026-06-04
**Tipo:** Arquitetural / Técnica / Schema governance
**Status:** PROMULGADA (docs-only — não autoriza migration/código/writer)
**Frente:** `F-PJ-PUBLICATION-OFFERING-SCHEMA-DECISION`
**HEAD de origem:** `e5163e60`

---

## 1. Título
Ratifica o modelo técnico de publicação/oferta PJ: tabela soberana `company_concept_publications`
(company/page-actor×concept) como SSOT de publicação; `tenant_concept_offerings` rebaixada a
read-model/projeção derivada; MVP publica somente `primary_concept_id`; KYB approved + autoridade
contextual + page-actor obrigatórios; lifecycle `active|retired`; audit inline. Não instala a placa —
escolhe o molde.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetural / Técnica / Schema governance. Docs-only.

## 4. Status
PROMULGADA. Não autoriza migration, código, writer ou rota (ver §11/§D12).

## 5. Contexto
DECISION-0099 fixou a **norma** de publicação/oferta PJ (publicar ≠ ativar; company/page-actor-level;
KYB approved; reversível; auditável; `tenant_concept_offerings` insuficiente; writer automático
proibido) e autorizou **desenhar** o schema-alvo (D11) sem implementar. A frente read-only
`F-PJ-PUBLICATION-OFFERING-SCHEMA-WRITER-DESIGN` produziu o desenho e surfou sub-decisões técnicas
que a migration cristalizaria no escuro (evoluir tco vs nova tabela; escopo do concept; audit inline
vs eventos; tratamento das linhas legadas; status enum). Esta DECISION ratifica essas escolhas, na
disciplina "norma antes de schema".

## 6. Problema
Sem ratificar o modelo, a migration de publicação teria de decidir sozinha granularidade, nome,
escopo do concept, lifecycle, anti-duplicidade, audit e o destino do read-model atual — decisões
arquiteturais, não detalhes de tabela (anti-padrão enforcement/schema-cristaliza-decisão).

## 7. Evidência material (auditoria read-only)
1. `tenant_concept_offerings(id, tenant_id, concept_id, is_active, created_at, updated_at)` ·
   UNIQUE `(tenant_id, concept_id)` · FK tenants/concepts · 0 linhas em dev. **tenant×concept.**
   Lacunas: sem company_id/page_actor_id/created_by/retired_by/published_at/retired_at/status/audit.
2. Reader vivo: `listTenantsOfferingConcept` → `marketplace-contextual` → `GET /marketplace/contextual`
   (descoberta cross-tenant, **sem gate KYB**). Uma linha ativa torna o tenant descobrível por concept/GRAPH.
3. `actors` PK = `id` (e `id===actor_id` sempre) → `page_actor_id` deve FK→`actors(id)`.
4. **Gate KYB de page-actor já existe e é reutilizável:** `authority-decision.service.evaluateKybLayer`
   (DECISION-0088/0094) — cadeia `actors → companies.fiscal_identity_id → fiscal_identities.kyb_status
   ='approved'`, fail-closed em cada elo. `kyb_status` CHECK ∈ {pending,approved,rejected,suspended,closed}.
5. Autoridade contextual já existe: `companiesService.canManageCompany(tenantId, companyId, globalUserId)`.
6. Ativação grava `companies.primary_company_type_id`/`primary_concept_id`; page-actor garantido pós-ativação.
7. Opção 2 (evoluir tco) rejeitada (UNIQUE tenant×concept impede company-level; nome ficaria errado;
   ALTER quebraria discovery). Opção 3 (tabela soberana + projeção) recomendada (não quebra discovery;
   migration aditiva mínima).

## 8. Decisão
Adotar **Opção 3**: criar a tabela soberana `company_concept_publications` (granularidade
company/page-actor×concept) como SSOT de publicação, mantendo `tenant_concept_offerings` como
read-model/projeção derivada temporária (reader marketplace/contextual intocado). MVP publica
exclusivamente o `primary_concept_id`, gateado por KYB approved + autoridade contextual + page-actor,
com lifecycle `active|retired`, anti-duplicidade por UNIQUE parcial e audit inline. Sem migration,
código, writer, backfill ou auto-publicação nesta DECISION.

## 9. Decisões D1–D12

**D1 — Opção 3 ratificada.** Criar tabela soberana company/page-actor×concept; manter
`tenant_concept_offerings` como read-model/projeção derivada temporária; **não** evoluir
`tenant_concept_offerings` para SSOT.

**D2 — Nome canônico:** `company_concept_publications`. Deixa explícito sujeito (company), objeto
(concept) e ato (publication); não confunde com tenant-level offering.

**D3 — Granularidade obrigatória.** A publicação soberana é (`tenant_id`, `company_id`,
`page_actor_id`, `concept_id`). NÃO é tenant_id+concept_id, businessType, businessCategory, hybrid
ou metadata.

**D4 — Escopo MVP do concept publicável.** Só é publicável `companies.primary_concept_id`. Proibido
no MVP: publicar concepts arbitrários, concepts de metadata, hybrid, ou concepts adicionais de
"ambos" (frente própria futura). Se `concept_id != companies.primary_concept_id`, o writer futuro
falha → erro `CONCEPT_NOT_ACTIVATED`.

**D5 — KYB obrigatório.** Writer futuro exige `fiscal_identities.kyb_status='approved'` (via a cadeia
page-actor→company→fiscal_identities já viva). pending/rejected/suspended/closed → fail-closed,
erro `KYB_NOT_APPROVED`. Sandbox com KYB pending exigirá decisão própria e fica FORA.

**D6 — Autoridade contextual obrigatória.** Writer futuro exige `company_users` com
`can_manage_company=true` OU `role='owner'`, vínculo/usuário ativos (`is_active`, `member_status=
'active'`), e page-actor existente/validado. Falta → erro `PUBLICATION_FORBIDDEN`. Produto/frontend
não cria autoridade.

**D7 — Lifecycle simples.** `status ∈ {active, retired}`. Regras: `active` ⇒ `retired_at IS NULL`;
`retired` ⇒ `retired_at IS NOT NULL`; `published_at` obrigatório em linhas active e retired;
`retired_by_actor_id` só em retired.

**D8 — Anti-duplicidade ativa.** A migration futura prevê **UNIQUE parcial em `(company_id,
concept_id) WHERE status='active'`** — impede duas publicações ativas da mesma empresa para o mesmo
concept; permite histórico de aposentadas.

**D9 — Audit inline no MVP.** Usar audit na própria tabela: `published_at`, `retired_at`,
`created_by_actor_id`, `retired_by_actor_id`, `source`, `intent`, `created_at`, `updated_at`. Tabela
de eventos separada fica para frente futura se necessário.

**D10 — `tenant_concept_offerings` como projeção/read-model.** Não é SSOT de publicação; pode
permanecer como compat/read-model derivado. Regra futura de derivação: um tenant oferece o concept
SSE existe ≥1 publicação `active` em `company_concept_publications` para aquele tenant+concept. O
reader marketplace/contextual **não** é alterado nesta DECISION.

**D11 — Linhas legadas em `tenant_concept_offerings`.** A migration futura NÃO deve: apagar linhas
legadas automaticamente; falhar se houver linhas legadas; backfillar publicações a partir delas;
auto-publicar empresas existentes. Linhas legadas são compat/read-model temporário; reconciliação/
rebuild de projeção é frente própria (ou parte explícita do writer). Dev = 0 linhas; prod/staging
podem não estar vazios — desenho aditivo e independente garante segurança.

**D12 — Bloqueios.** Esta DECISION NÃO autoriza ainda: migration; código; writer; rota publish/
unpublish; alteração em `tenant_concept_offerings`; rebuild da projeção; alteração em marketplace
contextual; alteração em hybrid; alteração em onboarding; alteração em Bank; alteração em KYB writer.

## 10. O que esta DECISION ratifica
- **Executa o desenho autorizado por DECISION-0099 D11** (schema-alvo), fixando nome, granularidade,
  escopo, lifecycle, anti-duplicidade, audit e o destino do read-model.
- **Ratifica** o reuso do gate KYB existente (DECISION-0088/0094) e da autoridade contextual
  (`canManageCompany`) para o writer futuro.
- **Mantém** DECISION-0099 D2 (writer automático na ativação proibido) e D10 (não resolve hybrid).

## 11. O que NÃO está autorizado
Ver D12. Em particular: nenhuma migration, nenhum código/writer/rota, nenhuma alteração de
`tenant_concept_offerings`/marketplace contextual/hybrid/onboarding/Bank/KYB writer, nenhum backfill
ou auto-publicação.

## 12. Impacto em DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **GOVERNED / DECISIONED** (sai de OPEN; schema
  alvo decidido + migration futura autorizável; **não CLOSED** — falta executar schema/writer).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → permanece PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → permanece OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED (não reaberta).

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **`F-PJ-PUBLICATION-OFFERING-SCHEMA-MIGRATION`** — schema-only: criar `company_concept_publications`
   (D2/D3/D7/D8/D9), forward-only/idempotente, sem writer; testes de schema (CHECK/UNIQUE/FK).
2. **`F-PJ-PUBLICATION-OFFERING-WRITER`** — writer publish/unpublish com KYB gate (D5), `company_users`
   guard (D6), page-actor, idempotência, lifecycle (D7), audit (D9).
3. **`F-PJ-PUBLICATION-OFFERING-PROJECTION`** — reconciliação de `tenant_concept_offerings` como
   read-model derivado (D10) e/ou migração do reader.
4. **`F-PJ-MARKETPLACE-HYBRID-READONLY`** — ortogonal; pode correr em paralelo.
Ordem recomendada: schema-migration → writer → projection; hybrid read-only independente.

## 14. Referências normativas
Constituição (Art. I/III/IV/V/VII) · LEIS (Lei 5/7) · SSOT_REGISTRY (actors/key actor_id; bank) ·
LEI_DE_COERENCIA (§4.8 page-actor, §4.9 autoridade) · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY
(CONCEPT/GRAPH) · REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO (§8) ·
SERVICE_CANONICO · DECISION-0097 · DECISION-0098 · DECISION-0099 · DECISION-0088/0094 (gate KYB vivo).

## 15. Referências de estado/commits
HEAD origem `e5163e60` ("decisions: define PJ publication offering governance"). Base: relatório
read-only `F-PJ-PUBLICATION-OFFERING-SCHEMA-WRITER-DESIGN` (esta sessão). Cadeia: DECISION-0099
(`e5163e60`) · DECISION-0098 (`6d5dda34`) · DECISION-0097 (`945b5dc6`). Gate KYB vivo:
`backend/src/core/compliance/authority-decision.service.ts` (evaluateKybLayer). Autoridade contextual:
`backend/src/core/companies/companies.service.ts` (canManageCompany).

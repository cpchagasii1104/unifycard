# Desenho Fase 3B — Nascimento de Empresa em Dois Momentos

**Status:** desenho fechado (ratificado Clayton + Opus + ChatGPT, 2026-05-29).
**Natureza:** decisão de produto + arquitetura para a fatia 3B. Documenta para a 3B.3
implementar a partir de concreto, não de memória de chat.
**Escopo desta fatia (3B.2):** SÓ este documento. Zero código/migration/schema.

> Diagnóstico que fundamenta este desenho: ver Passo 0 (FASE 3A) e 3B.1 — evidências em
> `REMEDIATION_DT_LOG.md` e nos arquivos citados abaixo (caminho+linha reais).

---

## 1. DECISÕES DE PRODUTO (ratificadas — não redecidir)

- **A4 — dois momentos.** Empresa nasce em duas etapas: registro jurídico inerte → ativação
  operacional classificada.
- **A3 — composição, não escolha binária.** A base do fluxo é `companies.service`
  (`backend/src/core/companies/companies.service.ts:253`), coerente com o schema vivo.
  `company-canonical.service` (`backend/src/core/companies/company-canonical.service.ts:66`)
  **NÃO** é base: insere em colunas fantasma (`state`/`legal_name`/`document_*`) que não
  existem no `companies` reconstruído (`backend/migrations/0065_create_companies_minimal.sql:14-27`).
- **Classificação POR-EMPRESA, não por-tenant.** Hoje o tipo vive em `tenants.company_type_id`
  (`backend/migrations/0115_add_company_type_to_tenants.sql:3-6`). Isso passa a ser
  **default/template** do tenant; a verdade de tipo/CONCEPT da empresa fica na própria empresa.
  Justificativa: o tenant é um ecossistema e pode hospedar empresas de tipos diferentes.
- **Um `company_type` + `CONCEPT` primário obrigatório para operar.** Multi-concept por empresa
  é evolução futura governada — **não** é requisito da 3B.

---

## 2. MOMENTO 1 — registro jurídico/documental (inerte)

- Cria linha em `companies` (`company_name`, `cnpj`, `status`), **sem page-actor operacional**.
- `primary_company_type_id` e `primary_concept_id` = **NULL**.
- Empresa **INVISÍVEL** ao resolver de contexto (não é operável).
- Nada de capability, nada de classificação. Registro institucional inerte.

---

## 3. MOMENTO 2 — ativação operacional (single writer `activateCompanyOperationally()`)

Writer único, transacional. Ordem espelha a cadeia causal **SEMÂNTICA → IDENTIDADE → AUTORIDADE**:

- **(a) Semântica:** validar `primary_company_type_id` + `primary_concept_id` e que o **PAR**
  é permitido em `company_type_allowed_concepts`
  (`backend/migrations/0114_company_type_allowed_concepts.sql:3-14`).
- **(b) Identidade/Autoridade:** garantir page-actor (`actor_type='page'`) +
  `responsible_actor_id` (actor humano) — reusar `ensurePageActor`
  (`backend/src/core/companies/companies.service.ts:654`; writer em
  `backend/src/modules/social/actor.repository.ts:303-316`).
- **(c) Estado:** gravar `primary_company_type_id` + `primary_concept_id` em `companies`.
- **(d) Capability:** derivar/gravar capabilities mínimas.
- **(e) Commit.** Falha em qualquer ponto → **rollback total** (nunca empresa meio-operacional).

---

## 4. SCHEMA PLANEJADO (implementar na 3B.3 — NÃO agora)

- `companies.primary_company_type_id UUID` FK → `company_types(id)` (nullable).
- `companies.primary_concept_id UUID` FK → `concepts(concept_id)` (nullable).
- **CHECK pareado:** `(ambos NULL) OR (ambos NOT NULL)`.
- Nomes explícitos com prefixo `primary_` (deixa espaço para multi-concept futuro governado).

---

## 5. VALIDAÇÃO DO PAR (anti-"resolver horóscopo")

- `primary_concept_id` deve ser **permitido** para `primary_company_type_id` via
  `company_type_allowed_concepts`.
- Validação no **serviço** (3B.3, passo 3a). Defesa no **banco** (trigger/constraint governada)
  = evolução futura, não requisito da 3B.

---

## 6. ESTADO IMPLÍCITO (sem coluna `companies.state` nova)

- **Empresa operacional ≝ page-actor presente + `primary_*` preenchidos (e validados).**
- O resolver só enxerga a empresa que satisfaz esse predicado.
- Alinha com a decisão já existente no código: "estado de onboarding vive no Actor, NÃO em
  `companies`" (`backend/src/core/companies/companies.service.ts:656-657`,
  DT-ONBOARDING-METADATA-STORAGE-DECISION Opção 4). **Não** se cria `companies.state`.

---

## 7. RESPONSABILIDADE CIVIL

- `responsible_actor_id` na page-actor + `company_users(role)` + `companies.global_user_id`.
- `companies.service` **já ancora** essa cadeia hoje (`company_users` em `:596`,
  `ensureUserActor`/`ensurePageActor` em `:653-654`). O Momento 2 reusa esse substrato.

---

## 8. DÍVIDAS REGISTRADAS (referência, fora do escopo de execução desta fatia)

- **company-canonical.service quebrado** (colunas fantasma vs schema vivo) → corrigir-ou-aposentar
  (decisão na 3B.3 / fatia própria).
- **DT-COMPANY-MARKETPLACE-ACTIVATION-FLAGS-PARALLEL-CAPABILITY** — flags
  (`catalog_ready`/`services_ready`/…) em `Map` de memória volátil
  (`backend/src/modules/marketplace/domain/company/marketplace-company.service.ts:17`),
  fora do SSOT. Não usar como fonte soberana; resolução por D-CONCEPT/D-CONTEXT-RESOLVER.

---

## 9. ESCOPO DA 3B.3 (implementação — fatia separada)

1. Migration: 2 colunas (`primary_company_type_id`, `primary_concept_id`) + CHECK pareado + FKs.
2. `activateCompanyOperationally()` — single writer transacional (passos 3a–3e).
3. Filtro do resolver: só enxerga empresa operacional (predicado da seção 6).

**Fora de 3B:** banda = **3C** (desenho novo próprio). PJ multi-concept = evolução futura.

# MINHA MEMORIA — Empresa/PJ

> RAIO X READ-FIRST do eixo Empresa/PJ. Auditoria read-only; nenhum código/runtime/migration/commit tocado.

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d` — `docs(orchestration): add systemic x-ray consolidation`
* **Branch:** `rescue-structural`
* **Data/hora:** 2026-06-21
* **Git status:** árvore com modificações pendentes em `docs/memorias/*` e artefatos não rastreados (`*.png`, `*_output.txt`, planos `.md`). Nenhuma mudança de código backend/frontend feita nesta auditoria.
* **READ-ONLY confirmado:** SIM. Só leitura de arquivos + `SELECT`/`information_schema` no banco. Nenhum INSERT/UPDATE/DELETE/migration.
* **Arquivo criado/atualizado:** `docs/memorias/MINHA_MEMORIA_EMPRESA_PJ.md`
* **Banco/schema consultado:** `unificard_dev` via `psql 17` (DATABASE_URL de `backend/.env`).
* **Comandos/probes usados:**
  * `git rev-parse HEAD`, `git status --short`
  * `psql` read-only: listagem de tabelas (`pg_tables`), colunas (`information_schema.columns`), `count(*)`, distribuição de `company_status`/`kyb_status`.
  * Leitura integral/parcial de: `companies.service.ts`, `companies.routes.ts`, `company-publications.service.ts`, `company-members.service.ts`, `company-members.routes.ts`, `company-members.repository.ts`, `fiscal-identity-kyb.service.ts`, `identity.routes.ts` (bloco PJ/KYB), `services.service.ts` (createService), `service-offering.service.ts`.
  * `grep` por: `kyb_status`, `canManageCompany`, `provider_actor_id`, `company_id`, `requireRole`, `reviewFiscalKybRequest`, surfaces de frontend (`createCompany`/`kyb`/`publications`).

---

## 2. Escopo

**Auditado (eixo Empresa/PJ):** criação de empresa (rota+service+DTO+CNPJ), tabela `companies`, page-actor institucional, derivação do responsável/owner, membros/roles (`company_users` + adapter `company_members`), autoridade institucional (`canManageCompany`/`canRepresentActor`/R2 fine-grants), KYB/trust (writer `fiscal_identities.kyb_status` + workflow `fiscal_identity_kyb_requests`), publicação semântica (`company_concept_publications`), ponte empresa→service e empresa→service_offering, e ponte para frontend/marketplace.

**Fora (registrado como handoff):** oferta completa / Caminho A; marketplace inteiro; actor model global; autoridade global; semântica global; dinheiro/ledger/split/payout/Bank; booking/conflito; logística.

**Pergunta central:** uma empresa/PJ nasce materialmente correta — com actor institucional, responsável, autoridade, membros e estado/KYB suficientes para operar sem body spoof, sem reparo acidental e sem aprovação fantasma?

**Resposta curta:** SIM no núcleo (nascimento atômico + autoridade server-side + KYB com writer vivo). Os riscos residuais são de **higiene de UX (placebos)** e **dual workflow de validação**, não de spoof ou de aprovação fantasma.

### Respostas às 12 perguntas obrigatórias

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Criação de empresa/PJ fecha hoje? | **FECHA** |
| 2 | Empresa nasce com company actor material confiável? | **SIM** |
| 3 | Responsável/fundador derivado server-side? | **SIM** |
| 4 | canManageCompany cobre os writers institucionais? | **PARCIAL** (cobre membros/ativação/publicação; `PUT /companies/:id` e Frente-B `submit-validation` usam gates mais fracos) |
| 5 | Existe body spoof de company_id/company_actor_id/provider_actor_id? | **NÃO** (tudo derivado server-side; risco residual baixo) |
| 6 | Existe workflow backend KYB pending→approved? | **SIM** (refuta a pista do raio-X anterior) |
| 7 | Empresa autoativa/publica sem KYB/trust? | **NÃO** (publish e discovery são KYB-gated) |
| 8 | Empresa publica capacidade por concept_id? | **SIM** |
| 9 | Empresa cria service/offering respeitando autoridade? | **SIM** |
| 10 | Bloqueia MTP? | **NÃO_BLOQUEIA** |
| 11 | Bloqueia abertura pública? | **BLOQUEIA_PARCIAL** (placebos UX + dual validation a limpar) |
| 12 | Bloqueia dinheiro? | **HOLD_FINANCEIRO** (fora do escopo; KYB approved é a pré-condição) |

---

## 3. Mapa macro do fluxo

```
usuário autenticado            FECHA   (req.user.globalUserId + userId)
   → actor humano (C1)         FECHA   (findByUserId; nunca cria/cura aqui)
   → criar empresa             FECHA   (POST /companies; CNPJ check-digit na borda)
   → company (DRAFT)           FECHA   (companies; nasce DRAFT, fiscal-first)
   → company actor (page)      FECHA   (page-actor obrigatório, MESMA transação)
   → membros/roles             FECHA   (company_users SSOT; adapter company_members)
   → KYB/status                FECHA   (fiscal_identities.kyb_status; writer vivo)
   → publicação (concept)      FECHA   (company_concept_publications; KYB-gated)
   → service/offering          FECHA_COM_RISCO (gate ok; profundidade → IA-OFERTA)
   → marketplace               FECHA_COM_RISCO (projeção KYB-gated; placebos UX)
```

Todos os elos do núcleo **FECHAM**. Os dois últimos ficam **FECHA_COM_RISCO** por profundidade fora de escopo e por placebos de frontend.

---

## 4. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|------|-----------------|----------------|---------|-------|----------------|------|
| tela de criação de empresa | FECHA_COM_RISCO | `frontend/.../CompanyOnboardingWizard.tsx`, `api/companies.ts` | não | DomainSelector/ActivitiesTab podem ser placebo | IA-FRONTEND | MODO C |
| payload frontend | FECHA | `companies.routes.ts:14` `createCompanySchema` (zod) | não | `activity` aceito no schema mas não persistido (ghost cleanup 0103) | IA-FRONTEND | MODO C |
| createCompany backend | FECHA | `companies.service.ts:301` (fiscal-first + tx atômica) | não | baixo | — | — |
| tabela companies | FECHA | DB: 14 colunas; `company_status` TEXT; `fiscal_identity_id` FK; 2 rows DRAFT | não | `status` vs `company_status` (dois eixos) | — | — |
| company actor (page) | FECHA | `companies.service.ts:633` `ensurePageActorTx`; DB `page_actors=2` | não | nenhum | — | — |
| responsible_actor_id | FECHA | page-actor `responsible_actor_id` = actor humano do criador (`:633`) | não | nenhum | — | — |
| company_members | FECHA | adapter thin sobre `company_users` (DECISION-0042); sem tabela física | não | dois nomes p/ um SSOT | — | — |
| roles | FECHA | vocab `owner/admin/staff/contractor/member`; autoridade nos flags `can_*` | não | rótulo≠poder (mitigado por flag) | — | — |
| canManageCompany | FECHA | `companies.service.ts:982` `(can_manage_company OR role='owner') AND active` | não | baixo | — | — |
| canRepresentActor (company actor) | FECHA | `services.service.ts:110` no createService | não | baixo | IA-AUTORIDADE | — |
| body company_id | FECHA | `:companyId` da URL re-gateado por canManageCompany; nunca do body autoritativo | não | baixo | — | — |
| body provider_actor_id | FECHA | `service-offering.service.ts:130` "body NUNCA define company/owner" (derivado) | não | nenhum | — | — |
| KYB status | FECHA | `fiscal_identities.kyb_status`; fonte única (`companies.types.ts:9`) | não | DB: 2 fiscal pending | — | — |
| KYB pending→approved writer | FECHA | `fiscal-identity-kyb.service.ts:108` `reviewFiscalKybRequest` (atômico+docs) | não | review = `requireRole(['admin'])` genérico | IA-DECISOES-DT | DECISION |
| company_concept_publications | FECHA | `company-publications.service.ts:149`; DB: 0 rows (nunca exercido) | não | baixo | — | — |
| empresa → service | FECHA | `services.service.ts:40` `assertDeclarationEligibility` exige publicação active | não | profundidade | IA-OFERTA | — |
| empresa → offering | FECHA | `service-offering.service.ts:130-148` company derivado, status draft | não | profundidade | IA-OFERTA | — |
| draft→active por empresa | FECHA_COM_RISCO | offering nasce draft; ativação pública via publicação KYB-gated | não | fluxo draft→active de offering fora do eixo | IA-OFERTA | — |
| empresa no marketplace | FECHA_COM_RISCO | `tenant_concept_offerings` projeção; `tenant-concept-offerings.repository.ts:34` KYB-gate | não | placebos `CompanyValidationBackoffice` (501) | IA-MARKETPLACE | MODO C |
| testes existentes | FECHA | e2e: `pj-kyb-writer`, `pj-kyb-documents-admin-review`, `atomic-company-birth`, `company-users-fine-grants`, `pj-kyb-revocation-cascade` | não | — | — | — |

---

## 5. Achados críticos

### COMPANY-01 — Nascimento atômico da empresa (fiscal-first, zero órfão) — POSITIVO
* **Descrição:** `createCompany` cria, numa **única transação** (`withTransaction`), `fiscal_identities` (kyb_status=`pending`) → `companies` (company_status=`DRAFT`) → `company_users` (criador) → page-actor. Qualquer falha = ROLLBACK total.
* **Evidência:** `backend/src/core/companies/companies.service.ts:557-651` (F-ATOMIC-COMPANY-BIRTH / DECISION-0075 §9.2).
* **Impacto:** elimina empresa órfã (sem actor, sem fiscal). CNPJ é único global pela fonte fiscal (`uq_fiscal_identities_cnpj`).
* **Bloqueia MTP/público/dinheiro:** não. **DECISION/YALA:** não. **Modo:** —.

### COMPANY-ACTOR-01 — Page-actor institucional obrigatório, nascido na criação — POSITIVO
* **Descrição:** page-actor da empresa nasce **dentro** da transação via writer soberano `ensurePageActorTx`, `actor_type='page'`, `company_id` setado, `responsible_actor_id` = actor humano do criador. Ativação/publicação **resolvem por leitura** (`findByCompanyId`) e **nunca criam/curam** actor (PJ-B3).
* **Evidência:** `companies.service.ts:630-644`; `activateCompanyOperationally` (`:794`) e publish (`company-publications.service.ts:184`) só leem. DB: `page_actors=2` para `companies=2`.
* **Impacto:** empresa que age tem actor institucional confiável; ausência de actor é erro estrutural honesto, não reparo silencioso.

### PJ-01 — Responsável derivado server-side; sem body spoof — POSITIVO
* **Descrição:** owner vem de `req.user.globalUserId` → `resolveUserIdFromGlobalUserId` → `findByUserId` (creatorActor). O DTO `createCompanySchema` **não tem** `actorId`/`ownerId`/`companyActorId` — não há vetor de spoof de dono. `can_manage_company=true` é **imposto server-side** ao criador (F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED), independente do `role` do formulário e sem confiar em `input.permissions`.
* **Evidência:** `companies.service.ts:301-343, 500-529`; `companies.routes.ts:14-54` (schema sem campo de actor).
* **Impacto:** zero "criar empresa em nome de outro"; zero criador órfão de governança.

### AUTH-PJ-01 — canManageCompany canônico e fail-closed cobre os writers institucionais — POSITIVO
* **Descrição:** `canManageCompany = (can_manage_company OR role='owner') AND is_active AND member_status='active'`, fail-closed. Usado em: ativação operacional (`companies.routes.ts:1124`), publish/retire (`company-publications.service.ts:41`), gestão de membros (`company-members.routes.ts:22-48` `requireCompanyManage`, sobre `req.user`, **não** `actionContext.actorId`), e set de permissão de consolidado.
* **Evidência:** `companies.service.ts:982-993`; `company-members.routes.ts:22-48`.
* **Impacto:** autoridade contextual sobre a empresa real, server-side. Anti-IDOR no GET membro (gateia sobre a empresa REAL do membro, 403 não-leak — `company-members.routes.ts:204-208`).

### MEMBER-01 — `company_users` é SSOT; `company_members` é adapter thin (não há tabela fantasma) — ESCLARECIMENTO
* **Descrição:** o serviço/rotas `company-members` operam via `company-members.repository.ts`, que é um **adapter thin sobre `company_users`** (DECISION-0042): `member_id ↔ company_users.id`, `role/status ↔ company_users.role/member_status`. **Não existe** tabela `company_members` (confirmado: `information_schema` retornou 0).
* **Evidência:** `company-members.repository.ts:2-14, 51, 125, 259, 282`; DB `count(table_name='company_members')=0`.
* **Impacto:** a aparente "dualidade de modelo de membros" é convergência consciente, não drift. Risco residual: `createMember` (service) não seta flags `can_*` (membro nasce sem poder de gestão — correto) e **não re-checa autoridade no service** (a **rota** o faz via `requireCompanyManage`); chamadas diretas ao service confiam no caller.

### KYB-01 — Writer de KYB pending→approved EXISTE e está cabeado (refuta a pista anterior) — ACHADO-CHAVE
* **Descrição:** a pista do raio-X anterior ("pending→approved não tem writer no backend") está **REFUTADA no HEAD vivo**. Existe `fiscalIdentityKybService.reviewFiscalKybRequest` (`pending → approved|rejected`), **atômico** (UPDATE request + UPDATE `fiscal_identities.kyb_status` na mesma tx), com auditoria `reviewed_by_actor_id`/`reviewed_at`/`decision_reason` e **pré-condição documental** (exige `cnpj_registration` + `articles_of_association` com `document_status='accepted'` para aprovar). Há também `submitFiscalKybRequest`, `getFiscalKybQueue` e `revokeFiscalKybApproval` (approved→suspended|closed com cascata atômica de retração de publicações).
* **Evidência:** `backend/src/core/identity/fiscal-identity-kyb.service.ts:108-246` (review), `:258-351` (revoke). Rota: `PATCH /identity/pj/kyb/admin/requests/:requestId/review` (`identity.routes.ts:1296-1335`, `requireRole(['admin'])` + `actionContext.actorId`). Submit user-facing: `POST /companies/:companyId/kyb/requests` (`companies.routes.ts:557`, autoria AUTH-DERIVED + canManageCompany). e2e: `validate-pipeline-e2e-pj-kyb-writer.ts`, `...-pj-kyb-documents-admin-review.ts`.
* **Classificação KYB:** **KYB_WORKFLOW_VIVO.**
* **Impacto:** "empresa verificada" tem fonte única (`fiscal_identities.kyb_status='approved'`) e writer auditado. Empresa **não se autoaprova** (review é admin).
* **Risco:** a review é `requireRole(['admin'])` (admin **sistêmico** do tenant), não um papel dedicado de reviewer KYB; DB tem `kyb_requests=0` e `fiscal pending=2` → o fluxo existe mas **nunca foi exercido neste dev DB**.

### KYB-02 — Publicação e descoberta são KYB-gated; ativação operacional ≠ publicação — POSITIVO
* **Descrição:** publicar exige `evaluatePageActorKybApproved` + empresa operacional (`primary_*` not null) + `concept === primary_concept_id` + canManageCompany. A **ativação operacional** (gravar o par `primary_company_type_id/primary_concept_id`, DRAFT→PROVISIONAL) **não** exige KYB — e está correto: ativar grava o que a empresa É; publicar acende a oferta. Criar service descobrível exige publicação active (logo, KYB). O reader de discovery reforça `fi.kyb_status='approved'` como cinto-e-suspensório.
* **Evidência:** `company-publications.service.ts:183-188`; `companies.service.ts:794-973` (ativação sem KYB); `services.service.ts:40-83`; `tenant-concept-offerings.repository.ts:34`.
* **Impacto:** não há autoativação pública sem KYB. Draft/não-publicado não aparece.

### OFFER-PJ-01 — service/offering derivam provider/company server-side — POSITIVO (handoff p/ profundidade)
* **Descrição:** `createService` exige `canRepresentActor` + `canonicalServiceId` obrigatório + elegibilidade (publicação PJ / declaração PF) do **mesmo** concept; nasce `draft`. Offering deriva `company_id` do **actor provider** (server-side), nasce `draft`, e `professional_actor_id` do body **não** é carimbado (→ null).
* **Evidência:** `services.service.ts:90-167`; `service-offering.service.ts:130-148`.
* **Impacto:** sem bypass por user-actor; sem company/owner vindo do body. Profundidade de Caminho A/draft→active → IA-OFERTA.

### PUB-01 — `company_concept_publications` é SSOT de oferta; projeção derivada — POSITIVO
* **Descrição:** writer soberano, idempotente, reversível (retire), auditável; projeta `tenant_concept_offerings` (read-model de discovery) **na mesma transação**. DB: 0 publicações (nunca exercido).
* **Evidência:** `company-publications.service.ts:144-316`; DB schema `company_concept_publications` (14 colunas, `page_actor_id`, `created_by_actor_id`, `retired_by_actor_id`).

### COMPANY-02 — Dual workflow de validação (Frente B vs fiscal KYB) — RISCO/DÍVIDA
* **Descrição:** coexistem duas trilhas de "validação/aprovação" de empresa: (a) **fiscal KYB** canônica sobre `fiscal_identities.kyb_status` (fonte única de "verificada"); (b) **Frente B** estruturada sobre `company_validation_requests` (`submit-validation`/`reviewCompanyValidation`, `companies.routes.ts:884-985`, `requireRole(['admin'])`) que escreve `companies` + `actors.metadata.validation`. A trilha presencial antiga (`company_validations`, `request-validation`, `validate/in-person`) está **tombstoned 501** (DECISION-0096) e `company_validations` tem 0 rows / a rota de histórico foi removida.
* **Evidência:** `companies.routes.ts:752-825` (501 presencial), `:867-985` (Frente B), `companies.types.ts:9` (fonte única = KYB); DB tabelas `company_validations`, `company_validation_requests`.
* **Impacto:** risco de confusão semântica "o que valida a empresa?". A norma já decidiu (KYB é fonte única); Frente B parece resíduo paralelo. **Não bloqueia** o spine, mas pede reconciliação. **Exige DECISION** (lifecycle/validação) — IA-DECISOES-DT.

### FRONT-PJ-01 — Placebos de UX sobre backend neutralizado — RISCO
* **Descrição:** o frontend tem telas cujo backend foi neutralizado/tombstoned: `DomainSelector.tsx` (company_domains GHOST removido — DECISION-0102 D9/D10), `CompanyValidationBackoffice.tsx` (validação presencial → 501), `CompanyActivitiesTab.tsx` (colunas de atividade removidas de `companies` — DECISION-0103 D12), e o schema `createCompany` ainda aceita `activity` (não persistido). KYB admin tem UX real (`admin/KybReviewBackoffice.tsx` + `api/kyb-admin.ts`).
* **Evidência:** `grep` frontend (36 arquivos); `companies.routes.ts:476-749` (tombstones 501); `companies.service.ts:716-719` (domain ghost removido).
* **Impacto:** botões/telas que não persistem nada (placebo) — violam "frontend nunca cria verdade / nada de workaround quando falta backend". Higiene antes de abrir ao público. → IA-FRONTEND-UX-CONTRATOS.

### AUTH-PJ-02 — `PUT /companies/:companyId` e Frente-B com gate mais fraco que canManageCompany — RISCO MENOR
* **Descrição:** `PUT /companies/:companyId` (update, inclui `status: active|inactive|suspended|closed`) e `DELETE` não chamam `canManageCompany` explicitamente — confiam no escopo por `global_user_id` dentro do service. `submit-validation`/`validation-queue`/`review` (Frente B) usam `requireRole(['admin'])` sistêmico, não autoridade contextual. Os comentários no próprio código reconhecem a evolução prevista (`companies.routes.ts:878-883`).
* **Evidência:** `companies.routes.ts:265-291, 297-332, 884-889`.
* **Impacto:** baixo (escopo por global_user_id ainda exige vínculo), mas inconsistente com o padrão canManageCompany do resto do eixo. Verificar `updateCompany`/`deleteCompany` internamente (não lidos por completo) → marcado como item de revisão, não blocker.

---

## 6. Gaps de conexão

* **Frontend ↔ backend (DTO):** `createCompanySchema` aceita `activity` que o backend deliberadamente **não persiste** (CNAE virou evidência fiscal). Frontend pode estar coletando dado morto. (FRONT-PJ-01)
* **Frontend ↔ backend (placebo):** `DomainSelector`, `CompanyValidationBackoffice`, `CompanyActivitiesTab` apontam para backend 501/ghost. (FRONT-PJ-01)
* **Validação ↔ KYB:** duas trilhas (`company_validation_requests` Frente B vs `fiscal_identity_kyb_requests` canônico). Falta um veredito único de qual é a lifecycle oficial. (COMPANY-02)
* **Autoridade ↔ update:** `PUT/DELETE /companies/:id` não usam canManageCompany; resto do eixo usa. (AUTH-PJ-02)
* **Schema ↔ runtime:** `companies.status` (active/suspended) e `companies.company_status` (DRAFT/PROVISIONAL) são eixos distintos do `kyb_status` — três estados convivem; documentado, mas pede mapa claro para a UX.

---

## 7. Handoffs para outras IAs

* **IA-AUTORIDADE:** validar profundidade de `canRepresentActor` para page-actor (representação de company actor) e o gate fraco de `PUT/DELETE /companies/:id` (AUTH-PJ-02).
* **IA-OFERTA:** Caminho A completo, draft→active de `service_offerings`, relação publicação↔offering↔canonical (OFFER-PJ-01).
* **IA-MARKETPLACE-JORNADA:** card/perfil público de empresa, como `tenant_concept_offerings` vira listagem, e remoção dos placebos de descoberta.
* **IA-FRONTEND-UX-CONTRATOS:** neutralizar/remover placebos (DomainSelector, CompanyValidationBackoffice, CompanyActivitiesTab), alinhar DTO `createCompany` (campo `activity`), conectar UX de KYB user-facing (`/companies/:id/kyb/requests` + `/kyb/status`). (FRONT-PJ-01)
* **IA-DECISOES-DT:** reconciliar dual validation (Frente B `company_validation_requests` vs fiscal KYB) — qual é a lifecycle oficial; e formalizar o papel "reviewer KYB" vs `requireRole(['admin'])` genérico. (COMPANY-02, KYB-01)
* **IA-ACTOR:** confirmar invariantes de page-actor/`responsible_actor_id` no actor model global (apenas leitura cruzada).
* **IA-SEMANTICA:** `company_type_allowed_concepts` / CNAE→concept (matriz curada) — pertence à semântica.
* **IA-BANCO:** schema de `companies`/`fiscal_identities`/`company_concept_publications` (já mapeado aqui) — sem ação.
* **IA-DINHEIRO:** KYB approved é pré-condição de Bank/payout; eixo financeiro permanece HOLD (ver §9).

---

## 8. Riscos para MTP

* **Bloqueia MTP:** nada. O spine criação→company→actor→membros→autoridade→KYB→publicação→service fecha materialmente, com writer de KYB vivo.
* **Não bloqueia mas deve ser corrigido:** placebos de frontend (FRONT-PJ-01) — confundem o usuário e violam "frontend não cria verdade".
* **Cleanup:** schema `companies.status` legado vs `company_status` vs `kyb_status`; campo `activity` morto no DTO; `company_validations` (0 rows, presencial tombstoned).
* **Exige decisão de produto/arquitetura:** dual workflow de validação (Frente B vs KYB) e papel dedicado de reviewer KYB.

---

## 9. Riscos para público e dinheiro

* **Blockers antes de público (MODO C / higiene):** remover placebos (DomainSelector, CompanyValidationBackoffice, ActivitiesTab); conectar UX KYB user-facing. Não há blocker de autoridade.
* **Blockers antes de dinheiro:** KYB approved é a porta — e o gate existe. O eixo dinheiro (Bank/split/payout/escrow) está **fora deste escopo** e permanece **HOLD_FINANCEIRO**.
* **Blockers que exigem DECISION:** reconciliação dual-validation (COMPANY-02); formalização do reviewer KYB (KYB-01).
* **Blockers que exigem MODO B:** nenhum identificado no núcleo (o núcleo já está fechado por fatias 0075/0086/0098/0099/0100/0101/0113/0144).
* **Permanece HOLD:** integração financeira; auditoria de evidência presencial (DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING).

---

## 10. Veredito final

### **FECHA_COM_RISCO**

O nascimento de empresa/PJ é **materialmente correto**: transação atômica fiscal-first (zero órfão), page-actor institucional obrigatório, responsável derivado server-side (sem vetor de spoof), autoridade contextual `canManageCompany` fail-closed nos writers, e — o ponto que o raio-X anterior dera como ausente — **um writer de KYB pending→approved vivo, atômico, auditado e com gate documental**, mais revogação com cascata. Não há autoaprovação nem aprovação fantasma; publicação e descoberta são KYB-gated.

Os **riscos** que impedem um "FECHA" limpo são de **higiene e governança**, não de causalidade: placebos de UX sobre backend neutralizado, dual workflow de validação (Frente B vs fiscal KYB), e dois writers de empresa (`PUT/DELETE /companies/:id`) com gate mais fraco que o padrão `canManageCompany`. Nenhum bloqueia MTP.

---

## 11. Próxima frente recomendada

### **HANDOFF_FRONTEND** (MODO C) — com **DECISION_COMPANY_LIFECYCLE** em paralelo

**Justificativa:** o backend do eixo PJ está fechado por fatias normadas; o que falta para abrir ao público é **limpar a casca de UX** (remover/neutralizar DomainSelector, CompanyValidationBackoffice, ActivitiesTab; alinhar DTO; conectar a UX de KYB user-facing já suportada pelo backend) — trabalho de frontend/contratos, não de causalidade. Em paralelo (não bloqueante), uma **DECISION** deve reconciliar a dual-validation (Frente B vs fiscal KYB) e formalizar o papel de reviewer KYB, fechando COMPANY-02/KYB-01. Não recomendo MODO B no núcleo — ele já está selado.

---

## 12. Resumo executivo

* **Nascimento atômico:** `fiscal_identity(pending)` + `companies(DRAFT)` + `company_users(criador, can_manage_company=true server-side)` + page-actor, tudo em uma transação. Zero órfão. (`companies.service.ts:557`)
* **Company actor confiável:** page-actor obrigatório, `responsible_actor_id` = humano do criador; ativação/publicação só leem, nunca curam (PJ-B3). DB: 2 page-actors / 2 companies.
* **Responsável server-side:** owner vem de `req.user`; DTO sem `actorId`/`ownerId` → **sem body spoof** de dono.
* **Autoridade:** `canManageCompany` fail-closed canônico cobre membros, ativação e publicação; subject sempre server-side (`req.user`), nunca `actionContext.actorId`/client.
* **Membros:** `company_users` é SSOT; `company_members` é adapter thin (DECISION-0042) — não há tabela fantasma.
* **KYB tem writer vivo:** `reviewFiscalKybRequest` (pending→approved|rejected, atômico, gate documental) + revoke com cascata. **Refuta** a pista "sem writer". Classificação: **KYB_WORKFLOW_VIVO**.
* **Sem autoativação pública:** publish e discovery são KYB-gated; ativação operacional (par canônico) ≠ publicação.
* **service/offering:** company/provider derivados server-side, `canonicalServiceId` obrigatório, elegibilidade por publicação/declaração active; nascem draft.
* **Riscos residuais (não-blocker):** placebos de frontend; dual validation (Frente B vs KYB); `PUT/DELETE /companies/:id` com gate mais fraco.
* **Veredito:** **FECHA_COM_RISCO** · **MTP:** não bloqueia · **público:** bloqueia parcial (higiene UX) · **dinheiro:** HOLD_FINANCEIRO. Próxima frente: **HANDOFF_FRONTEND** + **DECISION_COMPANY_LIFECYCLE**.

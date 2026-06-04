# DECISION-0096 — Validação presencial PJ reservada e UX desabilitada

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (define o destino imediato da UX órfã da validação presencial PJ — `requestValidation`/QR/`CompanyValidationModal`/botão "Validar presencialmente" — após o tombstone de `validateInPerson` e a remoção do score). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND / SEM BACKEND** (2026-06-04). Fixa a regra e a ordem; **não** implementa — executor posterior será pequeno e controlado.
**Sessão:** 2026-06-04 — frente `F-PJ-PRESENTIAL-VALIDATION-UX-RESERVED` (pós auditoria read-only Fase 3.2 do QR/UX órfã).
**Decisor:** Clayton. **Commit âncora:** `0945b577` (pós Profile Progress 1 — `calculateProfileProgress` deixou de premiar validação presencial morta).
**Natureza:** continuação da Fase 3 (vestígios — família 3.2). O score (lado cadastral) já foi corrigido (DECISION-0095/Profile Progress 1), mas a auditoria read-only confirmou que a **UX permanece acionável** e o **backend ainda gera QR órfão**: o botão "Validar presencialmente" aparece para toda empresa `PROVISIONAL`, abre o `CompanyValidationModal` que chama `requestValidation` (gera JWT/QR real) e **promete que a empresa terá status `VERIFIED`** — outcome impossível, pois a conclusão (`validateInPerson`) está tombstonada. É **CTA órfã + mentira institucional**. Esta DECISION fixa que a validação presencial FASE 12 está **reservada/desabilitada** (não é caminho vivo de verificação) e ordena a correção (executor pequeno, sem schema), mantendo a evidência presencial como **greenfield futuro**.
**Documento canônico:** este arquivo.
**Deriva de:** auditoria read-only Fase 3.2; `DECISION-0091` (FASE 12 fóssil/tombstone — destino do writer), `DECISION-0095` (completude cadastral ≠ verificação fiscal — §4.6/§6 marcaram o QR como adjacente/greenfield), `DECISION-0092` (Fase 3 estratégia), `DECISION-0089` (fonte única).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-PRESENTIAL-VALIDATION-UX-ORPHANED` (criada — UX órfã + QR órfão a desabilitar), `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING` (atualizada — greenfield de evidência presencial segue OPEN).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra-mãe** (validação presencial FASE 12 reservada/desabilitada, não promete `VERIFIED`), os **fatos materiais** da UX/QR órfã, o **destino** (frontend para de prometer/abrir o fluxo; backend para de gerar QR órfão; tombstone honesto) e a **ordem** (executor pequeno → higiene → greenfield). Não altera schema/frontend/backend/código; implementação é fatia executora própria, coordenada com Codex na superfície visual.

## 2. Fatos materiais a registrar (auditoria read-only Fase 3.2, HEAD `0945b577`)

1. `POST /companies/:id/request-validation` (`companies.routes.ts:668-692`) ainda chama `requestValidation` e **gera JWT/QR real** (15min) para empresa `PROVISIONAL`. Auth-only (sem `requireRole`).
2. `requestValidation` (`company-validation.service.ts:60`) **não escreve banco** (só assina token), mas **cria superfície acionável** (QR consumível em tese).
3. `POST /companies/validate/in-person` (`companies.routes.ts:699-747`) chama `validateInPerson`.
4. `validateInPerson` (`company-validation.service.ts:127`) está **tombstonado** (DECISION-0091/Fase 2.5).
5. O tombstone lança `HttpError` 501 code **`PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`** antes de qualquer leitura/escrita.
6. A rota **mascara** o 501 como **HTTP 400** (catch genérico `:741-745` reembrulha qualquer erro com `error.message` em status 400) — não expõe o tombstone de forma honesta.
7. `GET /companies/:id/validation-history` (`companies.routes.ts:754-778`) lê `company_validations` — **vazia (0 rows) e sem writer vivo** → sempre `{validations: []}`. O export frontend `getCompanyValidationHistory` (`api/companies.ts:364`) **não tem caller** (morto).
8. `CompanyValidationModal` (`frontend/src/components/CompanyValidationModal.tsx:75-79`) **promete**: "Apresente o QR... em uma loja parceira / o funcionário confirmará / **Após a validação, sua empresa terá status `VERIFIED`**".
9. `CompaniesManagerForm` (`frontend/src/components/CompaniesManagerForm.tsx:774-783`) mostra o botão **"📱 Validar presencialmente"** quando `companyStatus === 'PROVISIONAL'`; e o texto (`:733-738`) "⚠️ Empresa em validação / Complete a validação presencial para habilitar todas as funcionalidades."
10. Toda empresa nasce `PROVISIONAL` (`createCompany`) → o botão é **estruturalmente visível** em ambiente não-zero (em `unificard_dev` há 0 empresas hoje, então a superfície não aparece em dev — risco estrutural, não dependente de dados).
11. O QR **não tem caminho de conclusão viável** (o consumo `validate/in-person` está morto).
12. `company_validations` (5 colunas: `validation_id, company_id, validation_method, status, created_at`) e `partner_employees` (4 colunas: `id, tenant_id, partner_id, created_at`, sem `name`/`active`) são **vestígios mínimos com 0 rows**.
13. O **schema rico** da FASE 12 (geo/device/employee/before-after) existe **apenas em `migrations_archive/0047`** (não aplicado).
14. `company_validation_requests` (migration `20260530552000`) é um fluxo **vivo e separado** (submissão documental + revisão admin) — **não** é alimentado pelo QR; são dois trilhos distintos.
15. A UX atual é **CTA órfã + promessa institucional falsa** (o modal afirma um `VERIFIED` impossível).

> **Nota de path (TRAVA 1):** paths reais confirmados — `frontend/src/components/CompanyValidationModal.tsx` e `frontend/src/components/CompaniesManagerForm.tsx` (sem subdir `companies/`). Registrado, não inventado.

## 3. Princípio normativo

O sistema não pode exibir uma porta que não abre. Uma CTA acionável que gera QR e promete `VERIFIED` enquanto o consumo está morto é uma **afirmação institucional falsa** — viola a coerência sistêmica do mesmo modo que o score preso em 80% violava (DECISION-0095). Apagar a placa (UX) e trancar a porta (QR backend) é honestidade, não perda: a presença física pode ter valor **futuro** como evidência, mas só sob desenho próprio. Reservar ≠ aposentar: o fluxo fica **desabilitado e honesto** até existir greenfield aprovado, sem nunca reabrir a 2ª-verdade que a cadeia 0089→0091 eliminou.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
A **validação presencial PJ FASE 12** está **reservada/desabilitada**. Ela **não pode** ser apresentada como caminho vivo de verificação, desbloqueio ou `VERIFIED`.

### 4.2 UX
A UX de validação presencial deve **parar de prometer**: status `VERIFIED`; habilitação de "todas as funcionalidades"; conclusão em loja parceira; fluxo presencial operacional.

### 4.3 QR
O sistema **não deve gerar QR órfão** para um fluxo sem consumidor vivo.

### 4.4 Backend
- `requestValidation` deve ser **desabilitado** ou retornar **resposta honesta** (501/410) enquanto não houver greenfield aprovado — não gerar QR órfão.
- `validate/in-person` deve **preservar o tombstone de modo honesto** (não mascarar o 501 como 400/fluxo comum).
- `validation-history` **pode permanecer leitura inerte** por ora, mas **não** deve ser usada para prometer validação.

### 4.5 Frontend
O botão "Validar presencialmente" e o `CompanyValidationModal` (e o texto PROVISIONAL "complete a validação presencial...") devem ser **ocultados/desabilitados** ou substituídos por **mensagem honesta de recurso reservado**.

### 4.6 Fonte de verificação PJ (proibição)
**Nada** neste fluxo pode voltar a escrever: `company_status='VERIFIED'`; `is_verified=true`; `verifiedAt`; `kyb_status`. KYB aprovado continua sendo **fonte fiscal única** em `fiscal_identities.kyb_status`.

### 4.7 Evidência presencial futura
Presença física como **evidência KYB** é **greenfield futuro**. Exige **nova decisão**, storage/evidência/LGPD, `document_type`/trilho humano-parceiro próprio — **não** pode ser improvisada nesta limpeza (ver `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING`).

### 4.8 Alçada
Frontend/UX deve ser **coordenado com Codex** quando tocar superfície visual (memória de coordenação Claude/Codex). Backend tombstone/rota é **alçada Claude**. **Não reviver a FASE 12.**

## 5. Ordem de implementação futura (vinculante na sequência)

```text
Fase Presential UX 1 — executor pequeno (SEM schema/migration/Bank/KYB-writer):
  - frontend (Codex): esconder/desabilitar o botão "Validar presencialmente";
  - frontend (Codex): impedir promessa de VERIFIED (texto do modal / PROVISIONAL);
  - frontend (Codex): não abrir o QR como caminho vivo;
  - backend (Claude): requestValidation retorna 501/410 honesto OU bloqueia geração de QR órfão;
  - backend (Claude): validate/in-person preserva/corrige o tombstone honesto (sem mascarar 501→400).
Fase Presential UX 2 — higiene:
  - avaliar validation-history (manter inerte vs remover);
  - remover exports mortos se seguro (getCompanyValidationHistory);
  - limpar textos residuais.
Greenfield futuro (NÃO nesta frente):
  - evidência presencial KYB; storage; LGPD; document_type/evidência;
  - trilho humano/parceiro — sob nova decisão.
```

A **Fase Presential UX 1 é prioritária** — apaga a placa (frontend) e tranca a porta (backend) com blast radius pequeno. A higiene (UX 2) e o greenfield são posteriores.

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · DML · reviver `validateInPerson`/FASE 12 · escrever `company_status`/`is_verified`/`verifiedAt`/`kyb_status` por este fluxo · evidência presencial KYB (greenfield) · Bank/ledger/split · KYB writer · gate F2-C · gate social (DECISION-0094) · profile progress (DECISION-0095, já fechado) · `company_validation_requests`/fluxo documental vivo.

## 7. Superada por

(em aberto — decisão vigente)

# DECISION-0095 — Completude cadastral não é verificação fiscal

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (o cálculo de completude de perfil — `core.service.calculateProfileProgress` — mede **preenchimento cadastral/declarativo**, NÃO verificação institucional; remove a dependência da validação presencial FASE 12 morta). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND** (2026-06-04). Fixa a semântica e a ordem; **não** implementa — executor posterior será pequeno (sem schema).
**Sessão:** 2026-06-04 — frente `F-PJ-PROFILE-COMPLETENESS-CADASTRAL` (pós auditoria read-only Fase 3.2).
**Decisor:** Clayton. **Commit âncora:** `db00546d` (pós `chore(pj): depreca status legados de verificacao` — todos os writers de VERIFIED neutralizados; compat textual aplicada).
**Natureza:** continuação da Fase 3 (vestígios — família 3.2). Após os writers (Fase 2), o display (Fase 1), o gate financeiro (F2-C), a capability social (Gate 1/3.0) e o CNPJ-lock (3.0) já estarem ancorados em `kyb_status`, o read-only Fase 3.2 confirmou um **resíduo funcional** já flagado em 3.1-A: `core.service.calculateProfileProgress` ainda **premia 20% por validação presencial** (`company_validations.in_person/approved`) e **limita o score a 80%** sem ela. Como a FASE 12 (`validateInPerson`) foi tombstonada (501) e já era runtime-dead, e `company_validations` não tem writer vivo, o perfil fica **preso em ≤80%** e o frontend **instrui uma ação morta** ("valide presencialmente em uma loja parceira"). Esta DECISION fixa que **completude cadastral ≠ verificação fiscal** e ordena a correção (executor pequeno, sem schema).
**Documento canônico:** este arquivo.
**Deriva de:** auditoria read-only Fase 3.2; `DECISION-0093` (Fase 3.1 compat — §5 sequência 3.2 vestígios), `DECISION-0092` (Fase 3 estratégia), `DECISION-0091` (FASE 12 fóssil/tombstone), `DECISION-0089` (fonte única), `DECISION-0094` (gate KYB social — paralelo).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-PROFILE-COMPLETENESS-USES-DEAD-IN_PERSON_VALIDATION` (criada), `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING` (atualizada — QR/requestValidation é adjacente, não o score).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra-mãe** (completude cadastral mede preenchimento, não verificação), os **fatos materiais** do score morto, o **destino** (remover o eixo presencial + o teto de 80%, recalibrar para 100% com eixos vivos) e a **ordem** (executor pequeno sem schema → eventual eixo de verificação separado → QR/UX greenfield). Não altera schema/frontend/código; implementação é fatia executora própria.

## 2. Fatos materiais a registrar (auditoria read-only Fase 3.2, HEAD `db00546d`)

1. `core.service.calculateProfileProgress(tenantId, userId)` (`core/core.service.ts:789-938`) é cálculo de **completude de perfil PF/pessoa**. Consumido por **um único** caminho backend: `GET /profile/progress` (`core/profile/profile.routes.ts:361-396`) — **só display**, nenhum gate material o consome.
2. O score tem **peso de 20%** para validação presencial (`presentialMax = 20`, `:870-900`).
3. Esse peso depende de uma query a `company_validations` (`:880-890`):
   - `company_validations.validation_method = 'in_person'`
   - `company_validations.status = 'approved'`
   - join `companies ON c.company_id`, filtrado por `c.global_user_id`.
4. Sem essa validação, o score é limitado por **`maxProgressWithoutValidation = 80`** (`:909-910`): `progress = hasPresentialValidation ? totalScore : Math.min(totalScore, 80)`.
5. `company_validations` **existe** no schema vivo (de `0066`), mas: tem **0 linhas** em `unificard_dev`; tem **schema mínimo de 5 colunas** (`validation_id, company_id, validation_method, status, created_at`); **não tem writer vivo** capaz de popular `in_person/approved`. As colunas `validation_method`/`status` existem, então a query **roda sem erro e retorna 0** (não cai no catch — simplesmente conta zero).
6. `validateInPerson` (`core/companies/company-validation.service.ts`) foi **tombstonado** (Fase 2.5, DECISION-0091) e retorna **HTTP 501** (`PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`).
7. Antes do tombstone, `validateInPerson` **já era runtime-dead** por divergência de schema (escrevia contra `migrations_archive/0047` não aplicado). **Conclusão: a tabela nunca poderá ser populada por caminho vivo** → `presentialValidation` é permanentemente 0.
8. O score **não lê**: `kyb_status`, `company_status`, `is_verified`, `verifiedAt`. Lê apenas `company_validations` (morta).
9. O frontend `ProfileProgressBar` (`frontend/src/components/ProfileProgressBar.tsx`) ainda exibe — via warning **hardcoded** (`:117-121`) e via mensagem do backend (`core.service:919`) — a instrução "⚠️ Para chegar a 100%, valide presencialmente em uma loja parceira".
10. Resultado material: (a) perfil pode ficar **preso em ≤80%** (permanente, por design morto); (b) usuário pode **perseguir uma ação morta**; (c) o sistema **afirma um caminho institucional inexistente** (mentira institucional — viola coerência).
11. Existe fluxo PJ **separado** de QR/`requestValidation` ainda visível na UI (botão "📱 Validar presencialmente" em `CompaniesManagerForm` → `CompanyValidationModal` → `POST /companies/:id/request-validation`, rota intacta que gera QR), mas a **conclusão** (`validateInPerson`) retorna 501. É problema **adjacente** ao score, não o score.
12. O problema central é **semântico**: completude **cadastral** (dados preenchidos) foi misturada com **verificação fiscal/presencial** (validação institucional) — o mesmo conflato de eixos que a Fase 3 (DECISION-0092) mandou separar.

> **Nota de path (TRAVA 1):** o envelope apontou `frontend/src/components/profile/ProfileProgressBar.tsx` e `.../companies/CompanyValidationModal.tsx`; os paths **reais** são `frontend/src/components/ProfileProgressBar.tsx` e `frontend/src/components/CompanyValidationModal.tsx` (sem subdir `profile/`/`companies/`). Registrado, não inventado.

## 3. Princípio normativo

Completude de perfil e verificação institucional são **eixos distintos**. Medir "quão preenchido está o cadastro" é uma coisa; atestar "esta entidade foi verificada" é outra. Acoplar os dois — e ainda ancorar o acoplamento num trilho **morto** — produz um teto inalcançável e uma instrução falsa: o sistema afirma sobre si um caminho que não existe. A coerência sistêmica exige que o percentual cadastral seja **honesto** (atingível com os eixos vivos de preenchimento) e que a verificação, se exibida, apareça como **eixo próprio** ancorado em `fiscal_identities.kyb_status` — nunca somada ao percentual cadastral, nunca dependente da FASE 12 fóssil.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
**Completude cadastral não é verificação fiscal.** `profileProgress` mede **preenchimento cadastral/declarativo** do perfil, **não** validação institucional. O percentual cadastral deve ser **atingível (100%)** com os eixos vivos de preenchimento.

### 4.2 Validação presencial
A validação presencial **FASE 12 está morta/tombstonada** (501, runtime-dead). Ela **não pode ser requisito** para 100% de completude. O peso de 20% e o teto de 80% ancorados em `company_validations.in_person/approved` devem ser **removidos** (executor posterior).

### 4.3 KYB (eixo separado)
A verificação fiscal **KYB** continua sendo **eixo separado**:
- fonte única: **`fiscal_identities.kyb_status`**;
- **não** deve ser somado ao score de completude cadastral nesta fase;
- se exibido no perfil, aparece como **status/selo separado**, nunca como percentual cadastral.

### 4.4 Score (destino da correção)
A correção futura deve:
- **remover** o peso morto de validação presencial (20%);
- **remover** o teto artificial `maxProgressWithoutValidation = 80`;
- **recalibrar** os eixos cadastrais vivos para somar 100% (pessoal/profissional/físico/empresas — educacional e aprendizado seguem 0 por blindagem canônica já existente);
- **remover** a mensagem backend "valide presencialmente" (`core.service:919`) e o warning hardcoded no `ProfileProgressBar` (`:117-121`);
- manter o **shape do payload** compatível com `ProfileProgressBar` se possível (campos `progress`/`breakdown`/`messages`), retirando apenas a semântica morta.

### 4.5 Não acoplar PF a PJ
**Não exigir** empresa/KYB para que o perfil **PF** chegue a 100% cadastral. PJ/KYB pode ser exibido como **eixo adicional** se existir, mas **não bloqueia** a completude cadastral de PF. (O peso "empresas" de 10% mede *existência* de empresa vinculada como dado cadastral — não verificação; permanece como eixo cadastral, não como gate.)

### 4.6 QR/requestValidation (adjacente — fora desta decisão)
O QR/`requestValidation` PJ (botão "Validar presencialmente" + `CompanyValidationModal` + rota `/companies/:id/request-validation` intacta) é problema **adjacente de UX/greenfield**, **não** o score. **Não resolver** nesta decisão. Fica vinculado à **`DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING`** (FASE 12 / evidência presencial / greenfield).

### 4.7 Fonte proibida
O score cadastral **não pode** inferir verificação por: `company_validations`, `validation_method='in_person'`, `company_status='VERIFIED'/'APPROVED'`, `is_verified`, `verifiedAt`, metadata, frontend. A verificação, **quando e se exibida**, deriva **só** de `fiscal_identities.kyb_status` e vive em **eixo separado** (§4.3).

## 5. Ordem de implementação futura (vinculante na sequência)

```text
Fase Profile Progress 1 — executor pequeno (SEM schema/migration):
  - remover o eixo presencial morto do cálculo (company_validations in_person/approved);
  - remover maxProgressWithoutValidation = 80;
  - recalibrar os pesos cadastrais vivos para somar 100%;
  - remover a mensagem backend "valide presencialmente" (core.service);
  - remover o warning hardcoded no ProfileProgressBar (frontend);
  - manter payload compatível se possível;
  - teste: score atinge 100% sem validação presencial;
  - teste: PF não depende de PJ/KYB para 100% cadastral;
  - zero Bank / zero schema / zero migration / zero DML.
Fase Profile Progress 2 — eixo de verificação separado (OPCIONAL, se Clayton quiser):
  - criar futuro verificationStatus separado (selo/status, não percentual);
  - fonte = fiscal_identities.kyb_status (PJ);
  - NÃO misturar com profileProgress.
Fase QR/UX (adjacente — DT FASE 12):
  - decidir destino do botão "Validar presencialmente" e do CompanyValidationModal;
  - NÃO misturar com o score PF.
```

A **Fase Profile Progress 1 é prioritária** — destrava o teto e mata a mentira institucional com baixo blast radius (display-only, nenhum gate consome). O eixo de verificação separado (Fase 2) e o QR/UX são posteriores e opcionais.

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · alteração de frontend · DML · alteração de PF/KYC/`identities` · Bank/ledger/split · QR/`requestValidation`/`CompanyValidationModal` (adjacente, DT FASE 12) · gate financeiro F2-C · gate social (DECISION-0094) · `company_status`/`is_verified` schema (Fase 3.3) · criação de `verificationStatus` (Fase 2 opcional, não nesta decisão).

## 7. Superada por

(em aberto — decisão vigente)

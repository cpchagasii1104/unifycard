# DECISION-0089 — Reconciliação da verificação PJ: kyb_status como fonte

**Status:** PROMULGADA POR CLAYTON — DECISÃO TÉCNICA (reconciliação da segunda-verdade `company_status × kyb_status`). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA** (2026-06-03). Fixa a regra e a sequência; **não** implementa, **não** altera schema/frontend.
**Sessão:** 2026-06-03 — frente `F-PJ-COMPANY-VERIFICATION-RECONCILIATION` (pós read-only).
**Decisor:** Clayton. **Commit âncora:** `e4907b00` (pós F2-C gate vivo).
**Natureza:** elimina a segunda-verdade de "empresa verificada" promulgando `fiscal_identities.kyb_status` como **fonte única**, e definindo a estratégia (Opção D primeiro: display/read-model derivado de kyb_status, limpeza de escritores legados em fatias posteriores).
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0085` (D2-técnica), `DECISION-0086` (F2-A KYB writer), `DECISION-0087` (F2-B documentos), `DECISION-0088` (F2-C gate).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada), `DT-PJ-COMPANY-VERIFICATION-DISPLAY-USES-LEGACY` (criada), `DT-PJ-LEGACY-VERIFIED-WRITERS-MULTIPLE` (criada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra** (fonte única = `kyb_status`) e a **sequência** (Fase 1 display → Fase 2 writers → Fase 3 schema/lifecycle). Implementação é fase seguinte (executor por fatias).

## 2. Fatos a registrar (read-only, HEAD `e4907b00`)

1. O **gate financeiro F2-C já usa `fiscal_identities.kyb_status`** (enforcement correto).
2. **NÃO há segunda-verdade em permissão financeira** — nenhum fluxo comercial/financeiro backend libera por `company_status`/`is_verified` (o gate é KYB).
3. A segunda-verdade está no **display/API/UI**.
4. **Frontend recebe `companyStatus` e `isVerified`, mas NÃO recebe `kyb_status`** (grep `kyb_status`/`kybStatus`/`fiscal_identity` em `frontend/src` = vazio).
5. A UI pode mostrar "empresa verificada" por `companyStatus`/`isVerified` **mesmo se `kyb_status != approved`** (badge mentindo; e KYB approved não acende a UI).
6. Existem **5 caminhos legados** que escrevem `company_status='VERIFIED'`/`is_verified=true` **sem tocar `kyb_status`**:
   - `companies.service.updateDocumentStatus` (:2148);
   - `companies.service.adminOverrideToVerified` (:2201/:2232);
   - `companies.service.reviewCompanyValidation` (:2364/:2434);
   - `company-validation.service` (:270, **FASE 12 — validação presencial QR + funcionário auditável**);
   - `companies.service.updateCompany` (:1469, aceita `company_status` de input arbitrário).
7. `companies.status` e `companies.company_status` são **eixos diferentes**:
   - `status` = lifecycle operacional lowercase, **CHECK** active/inactive/suspended/closed;
   - `company_status` = **mistura** lifecycle/onboarding (DRAFT/PROVISIONAL/SUSPENDED) **e** verificação (VERIFIED/APPROVED), **sem CHECK**;
   - `is_verified` = flag **redundante/legada** (espelha company_status='VERIFIED').

## 3. Decisões promulgadas

### 3.1 Fonte única de verificação PJ
A fonte de "empresa verificada" é **`fiscal_identities.kyb_status = 'approved'`**. **NÃO** são fonte: `companies.company_status`, `companies.is_verified`, `companies.status`, `company_validation_requests`, metadata, frontend local state.

### 3.2 Display/API
A API e a UI devem exibir verificação PJ a partir de **leitura derivada de `kyb_status`**. Campo externo candidato (nome final = executor; camelCase externo / snake_case interno): `kybStatus` / `fiscalVerificationStatus` / `isKybApproved`.

### 3.3 Estratégia escolhida — **Opção D primeiro**
Primeira implementação: **criar/expor read-model derivado de `fiscal_identities.kyb_status`**; reapontar API/UI para usar esse dado como fonte de "verificada"; **parar de usar `companyStatus`/`isVerified` como fonte visual de verificação**. Depois: limpar `company_status`; neutralizar/redirecionar escritores legados; separar lifecycle de verificação.

### 3.4 `company_status`
**NÃO deve significar "KYB aprovado".** Enquanto existir, é tratado como **lifecycle/onboarding legado / compatibilidade**, campo a ser purificado/aposentado em fatias futuras. **Proibido** usar para: badge "verificada"; liberação financeira; comprovação KYB.

### 3.5 `is_verified`
Legado/redundante. Direção: **não usar como fonte**; futura projeção/compatibilidade ou aposentadoria.

### 3.6 Escritores legados
Os **5 escritores legados** de `VERIFIED` (§2.6) **NÃO** serão corrigidos nesta DECISION — ficam como **resíduos explícitos** (ver `DT-PJ-LEGACY-VERIFIED-WRITERS-MULTIPLE`). Direção futura: redirecionar para KYB quando fizer sentido, ou aposentar, ou limitar a lifecycle/onboarding — **nunca** verificação fiscal.

### 3.7 FASE 12 presencial QR
A validação presencial QR **não é descartada** aqui. Direção: deve virar **caminho de evidência/fluxo para KYB** (ex.: alimentar documentos/aprovação KYB), **ou** ser aposentada em decisão futura. **Não pode** continuar marcando empresa como verificada por fora de `kyb_status`.

### 3.8 Gate financeiro
**F2-C permanece a fonte de enforcement financeiro.** Esta DECISION **não** altera o gate — apenas alinha display/API para **não mentir** sobre o estado KYB.

## 4. Ordem de implementação futura

```text
Fase 1 — display/read-model:
  - backend expõe verificação derivada de fiscal_identities.kyb_status;
  - frontend usa esse campo para badges/textos "verificada";
  - companyStatus/isVerified deixam de alimentar a UI de verificação.
Fase 2 — writer cleanup:
  - neutralizar/redirecionar os 5 escritores legados de VERIFIED;
  - impedir updateCompany de aceitar company_status arbitrário como verificação;
  - decidir destino da FASE 12 presencial QR.
Fase 3 — schema/lifecycle cleanup:
  - separar definitivamente lifecycle de verificação;
  - decidir se company_status fica lifecycle puro, vira projeção, ou é aposentado;
  - decidir destino de is_verified.
```

## 5. O que fica fora (vinculante)

implementação/código · migration/schema · alteração de frontend · alteração do gate F2-C · correção dos 5 escritores legados (Fase 2) · destino da FASE 12 (decisão futura) · Bank · KYC PF/`identities`.

## 6. Superada por

(em aberto — decisão vigente)

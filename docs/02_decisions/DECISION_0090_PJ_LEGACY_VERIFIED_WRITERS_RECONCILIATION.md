# DECISION-0090 — Reconciliação dos writers legados de VERIFIED

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (neutralização dos escritores legados de "empresa verificada"). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM REMOÇÃO DE ROTA** (2026-06-04). Fixa a regra-mãe, o destino de cada writer e a ordem de corte; **não** implementa, **não** altera código/schema/rotas, **não** mexe em dados.
**Sessão:** 2026-06-04 — frente `F-PJ-LEGACY-VERIFIED-WRITERS-RECONCILIATION` (pós read-only Fase 2).
**Decisor:** Clayton. **Commit âncora:** `9eb56c30` (pós Fase 1 — display/read-model kyb_status vivo).
**Natureza:** elimina, por estratégia promulgada, a possibilidade de qualquer writer fora do **writer KYB auditado** criar "empresa verificada"; classifica os 5 escritores legados (+ `verifiedAt` como 3º fantasma) e fixa a sequência de neutralização. Continuação direta da Fase 1 (`DECISION-0089`): trocada a placa da vitrine, agora se desliga a oficina paralela.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0089` (reconciliação fonte única), `DECISION-0088` (gate KYB), `DECISION-0086` (writer KYB auditado), `DECISION-0087` (documentos KYB SSOT).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-LEGACY-VERIFIED-WRITERS-MULTIPLE` (atualizada), `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada), `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING` (criada), `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (criada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **regra-mãe** (só o writer KYB auditado verifica), o **destino de cada writer** (4.2–4.9) e a **ordem de corte** (§5). Implementação é por fatias posteriores (executor), cada uma com seus testes. **Não** remove rotas, **não** toca código, **não** migra dados nesta DECISION.

## 2. Fatos a registrar (read-only Fase 2, HEAD `9eb56c30`)

1. **`fiscal_identities.kyb_status` é a fonte canônica** da verificação PJ (`DECISION-0086`/`0088`/`0089`).
2. O **gate financeiro F2-C já lê `kyb_status`** (`evaluateKybLayer`), nunca `company_status`/`is_verified`.
3. O **display/API já foram mitigados na Fase 1** (`DECISION-0089`): payload expõe `kybStatus`/`isKybApproved`; UI acende "verificada" só por `kyb_status='approved'`. **Frontend pós-Fase 1 está limpo** de verificação visual por `companyStatus`/`isVerified`.
4. **Restam escritores legados** gravando estado de verificação paralelo em `companies`, **fora** de `kyb_status`.
5. **Cinco escritores identificados** (universo completo — grep confirmou: sem 6º no domínio companies):
   - `companies.service.updateDocumentStatus` (`:2104`, escreve `:2166`);
   - `companies.service.adminOverrideToVerified` (`:2219`, escreve `:2250`);
   - `companies.service.reviewCompanyValidation` (`:2382`, escreve `:2452`);
   - `company-validation.service.validateInPerson` — **FASE 12 QR presencial** (`:119`, escreve `:270`);
   - `companies.service.updateCompany` — **branch latente** para `input.companyStatus` (`:1390`, escreve `:1487`).
6. **`verifiedAt` é um terceiro fantasma**: a FASE 12 escreve `companies.verifiedAt` (`:271`), não `is_verified`. Existem, portanto, **três** colunas de verificação legada: `company_status`, `is_verified`, `verifiedAt`. Entra no escopo de limpeza.
7. **`company_documents` é substrato documental paralelo** ao `fiscal_identity_documents` (F2-B). `updateDocumentStatus` opera sobre o legado.
8. **`updateCompany` NÃO é explorável via rota hoje**: o `updateCompanySchema` (zod, `companies.routes.ts:55`) **stripa** `companyStatus`/`is_verified` (não estão na whitelist). O branch no service (`:1486`) é **risco latente** (capacidade só alcançável por caller interno), não hole HTTP vivo.
9. **FASE 12 QR é fluxo sofisticado e vivo**: JWT 15min (`requestValidation`), funcionário parceiro ativo (`partner_employees`), anti-fraude (não-revalidação + limite diário 20), audit com geo/`device_fingerprint`/employee em `company_validations`, FASE 13 abuse patterns, transacional. Coleta **presença física**. **Não cortar no escuro.**
10. **`validate-pipeline-e2e-company.ts` depende** de `reviewCompanyValidation` marcar `VERIFIED` (assert A4b: `companies VERIFIED + is_verified=true`, `:367–376`). Implementação futura que redirecionar/neutralizar `reviewCompanyValidation` **deve ajustar esse E2E na mesma fatia**.
11. **Roles:** `updateDocumentStatus` e `adminOverrideToVerified` exigem `requireRole(['admin','owner'])` (autoridade SISTÊMICA do tenant); `reviewCompanyValidation`/submit exigem `requireRole(['admin'])`; FASE 12 e `updateCompany` são auth-only (FASE 12 protegida por JWT+employee; `updateCompany` owner-scoped + zod). O próprio código alerta que autoridade contextual por empresa vive em `company_users`, não em `roles.name`.

## 3. Princípio normativo

A verificação fiscal de uma PJ é **resultado de processo auditado** (KYB), não efeito colateral de aprovação de documento, override manual, validação presencial ou edição de cadastro. Documento e presença física são **evidência** (insumo); `kyb_status='approved'` é **resultado** (fonte). Misturar evidência com resultado é a raiz da segunda-verdade.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
**Nenhum writer fora do writer KYB auditado pode criar "empresa verificada".** Fonte única: **`fiscal_identities.kyb_status='approved'`**. **Proibidos como fonte de verificação:** `companies.company_status='VERIFIED'`, `companies.is_verified=true`, `companies.verifiedAt`, `company_documents`, `company_validation_requests`, metadata de actor/company, frontend state. Esses substratos podem existir como **lifecycle/onboarding/evidência/auditoria**, **nunca** como verificação fiscal.

### 4.2 `updateCompany` — corte defensivo de baixo risco
- Remover, em implementação futura, o **branch latente** que aceita `input.companyStatus` (`:1486`).
- Manter a edição comum de empresa (nome, endereço, contato, atividade, status operacional, metadata).
- `updateCompany` **não pode** setar verificação fiscal; `companyStatus`/`isVerified` **não** são input legítimo de edição pública.
- **Classificação:** primeiro corte (Fase 2.1) — risco ~zero (hole HTTP já fechado pelo zod; resíduo é fechar a porta interna).

### 4.3 `adminOverrideToVerified` — neutralizar cedo
- **Aposentar como mecanismo de verificação direta.**
- **Não pode mais** escrever `company_status='VERIFIED'` nem `is_verified=true`.
- Se houver override fiscal no futuro, deve passar pelo **writer KYB auditado** (`reviewFiscalKybRequest`), com `reason`, actor responsável e trilha de auditoria.
- **Classificação:** exceção institucional já declarada ("apenas testes internos") — neutralizar cedo (Fase 2.2).

### 4.4 `updateDocumentStatus` — documento é evidência, não resultado
- Aprovação de documento legado **não verifica empresa**.
- `updateDocumentStatus` deve **parar de escrever** `company_status='VERIFIED'` e `is_verified=true`.
- Destino futuro: **convergir/rebaixar** `company_documents` em relação a `fiscal_identity_documents` (F2-B) — documento alimenta evidência KYB ou vira "doc aceito" sem tocar verificação.
- **Classificação:** cuidado — toca admin UI (frontend chama `/companies/admin/documents/:id/status`) e o substrato documental legado (Fase 2.3).

### 4.5 `reviewCompanyValidation` — redirecionar para KYB
- Review estruturado **não pode mais** marcar `VERIFIED` por fora.
- Deve ser **redirecionado para o writer KYB auditado** (F2-A) **ou aposentado** em favor do fluxo KYB.
- Implementação futura **deve ajustar `validate-pipeline-e2e-company.ts`** (assert A4b) na mesma fatia.
- **Classificação:** candidato natural a redirecionamento, com impacto em teste/fluxo (Fase 2.4).

### 4.6 FASE 12 QR presencial — não cortar por reflexo
- **Não será cortada nesta decisão.**
- **Não pode continuar** marcando empresa como verificada diretamente (`company_status='VERIFIED'`/`verifiedAt`).
- Deve virar **evidência KYB / prova presencial auditável**, ou ser redesenhada em **trilho próprio** (humano/LGPD).
- **Exige READ-ONLY/DESIGN próprio** antes de qualquer corte (ver `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING`).
- **Classificação:** fluxo vivo e sensível (Fase 2.5) — desenho antes de bisturi.

### 4.7 `verifiedAt` — terceiro fantasma
- `verifiedAt` entra no escopo como **terceiro campo legado** de verificação.
- **Não é** fonte canônica.
- Futura limpeza (Fase 3) decide se vira **projeção derivada de `kyb_status`**, **campo de compatibilidade**, ou é **aposentado** (ver `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST`).

### 4.8 Role `owner` — autoridade sistêmica não verifica fiscalmente
- A role sistêmica `owner` **não** deve equivaler a autoridade para verificar fiscalmente uma PJ.
- Aprovação fiscal exige **autoridade KYB/operator**, writer auditado e trilha.
- O uso de `requireRole(['admin','owner'])` nos fluxos de verificação legada (`updateDocumentStatus`, `adminOverrideToVerified`) deve ser **revisto** em implementação futura (migrar para autoridade contextual via `company_users` quando aplicável).

### 4.9 Dados legados — `kyb_status` vence
- Em qualquer conflito, **`kyb_status` vence**.
- `company_status='VERIFIED'` (ou `is_verified=true`/`verifiedAt` preenchido) **sem** `kyb_status='approved'` **não significa** empresa verificada.
- Migração/rebaixamento de dados legados em ambiente não-zero será **decisão própria** (Fase 3), com seu próprio desenho.

## 5. Ordem de implementação futura (vinculante quanto à sequência)

```text
Fase 2.1 — corte defensivo (PRIMEIRO, menor risco):
  - remover branch latente de updateCompany (input.companyStatus);
  - garantir que edição comum não aceita verificação fiscal.
Fase 2.2 — neutralizar override:
  - aposentar ou redirecionar adminOverrideToVerified;
  - se redirecionar, via writer KYB auditado (reason + actor + trilha).
Fase 2.3 — documentos legados:
  - impedir updateDocumentStatus de verificar empresa;
  - decidir convergência company_documents → fiscal_identity_documents ou rebaixamento.
Fase 2.4 — review estruturado:
  - redirecionar reviewCompanyValidation para KYB ou aposentar;
  - ajustar validate-pipeline-e2e-company.ts junto.
Fase 2.5 — FASE 12 QR:
  - READ-ONLY/DESIGN próprio (evidência KYB vs trilho humano/LGPD vs aposentar);
  - só depois mexer no código.
Fase 3 (posterior) — schema/lifecycle:
  - separar lifecycle de verificação;
  - decidir destino de company_status / is_verified / verifiedAt;
  - decidir migração de dados legados (ambiente não-zero).
```

A sequência é **vinculante na ordem** (defensivo barato primeiro; FASE 12 por último e com desenho). Cada fase é fatia própria de executor, com testes; nenhuma depende desta DECISION para além da estratégia aqui fixada.

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · remoção de rotas · DML/migração de dados legados · corte da FASE 12 (exige desenho próprio) · alteração do gate F2-C · Bank/ledger/split · KYC PF/`identities` · frontend.

## 7. Superada por

(em aberto — decisão vigente)

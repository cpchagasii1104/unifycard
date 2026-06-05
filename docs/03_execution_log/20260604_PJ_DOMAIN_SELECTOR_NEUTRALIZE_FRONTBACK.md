# Execução — F-PJ-DOMAIN-SELECTOR-NEUTRALIZE-FRONTBACK

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `93321e84` · **Governança:** `DECISION-0102` (D1/D9/D10)

## Objetivo
Neutralizar o `DomainSelector` livre no fluxo de criação de empresa e remover o writer fantasma de `company_domains`. **Para a mentira; não cria a verdade nova ainda.** Sem schema/migration; sem tocar publication/marketplace/hybrid/KYB/Bank/company_status.

## SSOT / NÃO-SSOT
SSOT: semântica = CONCEPT; ativação = `(primary_company_type_id, primary_concept_id)`; verificação fiscal = `fiscal_identities.kyb_status`; publicação = `company_concept_publications`; `bank_ledger` (fronteira negativa). NÃO-SSOT: `DomainSelector`/`MarketplaceDomain`/`company_domains`/businessType/businessCategory/hybrid/metadata/frontend. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > 0101 > 0102 > código. Esta fatia neutraliza drift + ghost; não cria domínio aprovado.

## Diagnóstico material (read-only)
A seleção de 6 checkboxes era **quádruplo-morta**: (1) dropada no `createCompanySchema` (zod sem campo `domains`) → (2) `createCompany` defaultava `['market']` → (3) tentava `INSERT INTO company_domains` (tabela só em `migrations_archive/0404`, ausente em dev) → (4) 42P01 **engolido** pós-commit. Campo obrigatório (`*`) com zero efeito. As rotas `/domains` usam stubs (`getCompanyDomains`→[], `updateCompanyDomains`→echo).

## Implementação (arquivos)
**Frontend:**
- `CompaniesManagerForm.tsx` — removido o `<DomainSelector>` do create + o import; bloco substituído por **nota informativa honesta** ("Os domínios de atuação serão sugeridos após a análise do ramo e da identidade operacional da empresa.").
- `CompaniesManager.tsx` — removida a validação obrigatória de `formData.domains` (o create não trava mais por "área de atuação").
- `useCompaniesState.ts` — removido `domains: ['market']` do estado inicial de `CreateCompanyInput`.
- `api/companies.ts` — removido `domains?: MarketplaceDomain[]` de `CreateCompanyInput` (payload não envia mais `domains`). `MarketplaceDomain` mantido (usado por `CompanyDomain`/stubs).

**Backend:**
- `companies.service.ts` — removido o bloco GHOST pós-commit `INSERT INTO company_domains` + o default `['market']` (`createCompany`). `input.domains` deixou de ter leitor.
- `companies.types.ts` — removido `domains?: MarketplaceDomain[]` de `CreateCompanyInput`.

**Não tocado:** `company_domains` NÃO criada; rotas-stub `/domains` deixadas inertes; `DomainSelector.tsx` (componente) deixado órfão (sem importadores) — remoção do arquivo é cleanup opcional de frente própria.

## Prova
- **Grep:** `INSERT INTO company_domains` em backend/src = **0** (ghost removido); `DomainSelector` não renderizado no create; nenhum uso vivo de `domains` no fluxo de create.
- **Frontend typecheck:** limpo (pegou e corrigi o `domains` init em `useCompaniesState`).
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts`.
- **e2e `F-ATOMIC-COMPANY-BIRTH` 18/18** (efêmero): `createCompany` (nascimento fiscal-first + page-actor) funciona **sem domains**, sem o warning engolido; rollbacks/CNPJ-DV/zero-bank intactos.
- **4 gates OK** (actor-writer/bank-ledger/regression; arch warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` → **CLOSED** (drift neutralizado front+back; create funciona sem domains).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → permanece PARTIALLY MITIGATED / GOVERNED (mentira removida; **elegibilidade real ainda não existe**).
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → OPEN.
- `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → OPEN.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.

## Não-toque confirmado
schema/migrations · publication · marketplace/contextual · hybrid · KYB · Bank · onboarding do par (`CompanyOnboardingWizard`) · `CompanyCreationPage` · `createCompany` fiscal (núcleo) · CNAE · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CNAE-EVIDENCE-PERSIST-READONLY` (desenho: persistir CNAE/atividade da Receita como evidência auditável que sugere company_type/concept) — pré-requisito da derivação de elegibilidade real. OU `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-READONLY` (reconciliar `MarketplaceDomain ↔ concepts.domain`, ortogonal, antes de religar marketplace). Esta fatia parou a mentira; não criou a verdade nova ainda.

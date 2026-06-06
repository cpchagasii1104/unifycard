# Execução — F-PJ-CNPJ-ON-ENTRY — frontend-only

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `f6a5714c` · **Decisão:** Clayton — impedir avanço no cadastro PJ com CNPJ inválido/duplicado, com erro limpo no início do fluxo · **Esteira:** eu (escritora); a outra instância verifica READ-ONLY.

## Objetivo
Fechar a reclamação: *"se o CNPJ já for cadastrado quero que ao informar o CNPJ o sistema já verifique e informe no mesmo momento"*. Hoje o usuário descobria CNPJ inválido/duplicado só no fim do fluxo.

## READ-FIRST (confirmado contra código vivo)
1. Campo CNPJ: `CompaniesManagerForm.tsx` (apresentacional) → lógica no container `CompaniesManager.tsx` (`handleCNPJChange`, `handleSubmit`, `formErrors.cnpj`).
2. Submit chama `createCompany` (`api/companies.ts`) em `handleSubmit` (l.~324).
3. Validação atual: `utils/cnpj.ts` tem `validateCNPJ` (14 díg + all-same + **2 dígitos verificadores**), `maskCNPJ`, `cleanCNPJ`. **Mas `handleCNPJChange` só checava comprimento 14** (não chamava `validateCNPJ`); submit idem.
4. Duplicidade hoje: **backend fail-closed contra a fonte fiscal canônica** — `createCompany` checa `companies` (projeção, **same-user**: `'Empresa com este CNPJ já está cadastrada'`) e o INSERT em `fiscal_identities` é protegido pela **UNIQUE `uq_fiscal_identities_cnpj`** (global; `23505` → `'CNPJ já cadastrado no sistema...'`, sem vazar a outra empresa). O frontend exibia o erro só no **banner genérico** do submit.
5. Endpoint de lookup/check de CNPJ no nosso DB: **não existe** (`/companies/fetch-cnpj` é Receita, não duplicidade).
6. Submit pode capturar o erro do backend e exibir limpo no campo — **sim** (sem rota nova).
7. Rota nova **não foi necessária** → STOP não disparado.

## Implementação (frontend-only — `CompaniesManager.tsx`)
- **Import:** `validateCNPJ` de `../utils/cnpj`.
- **`handleCNPJChange` (entrada):** com 14 dígitos, roda `validateCNPJ`; inválido → erro limpo no campo e **não** consulta a Receita (busca seria inútil); válido → fluxo de prefill da Receita intacto.
- **`handleSubmit` (pré-validação):** valida dígito verificador (não só comprimento) antes do backend.
- **`handleSubmit` (catch):** mapeia o veredito do backend para `formErrors.cnpj` — duplicidade (`/já (está )?cadastrad/i`) → **"Este CNPJ já está cadastrado."** (mensagem única, sem vazar fiscal/tenant); dígito inválido → mensagem no campo; demais erros → banner genérico.
- **Projeção, não verdade** (`frontend_nunca_cria_verdade`): a duplicidade continua resolvida no backend contra a fonte fiscal soberana; o frontend só projeta o veredito. NÃO toquei schema/regra de CNPJ/`fiscal_identities`/Bank/migration.

## Prova
- **e2e** `validate-pipeline-e2e-pj-cnpj-on-entry-failclosed` (efêmero, DEV intacto): **6/6** — E1 inválido rejeitado/nada criado · E2 CPF (11 díg.) não aceito/nada criado · E3 válido cria 1 company + 1 fiscal_identity · E4 duplicado msg limpa sem duplicar · E5 UNIQUE `uq_fiscal_identities_cnpj` existe · cleanup DEV intacto.
- **tsc:** frontend **0**; backend (escopo) 0 (2 `geo-enrichment` baseline pré-existentes).
- **4 gates:** actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit 0 (`critical_new=0`; `warning_new=1`=c3). **dev 365 (zero migration).**

## Não-toque confirmado
Bank/`bank_*` · migration/schema (365) · `fiscal_identities`/`kyb_status`/regra canônica de CNPJ · rota nova (não criada; sem necessidade) · lifecycle/documentos KYB/cargo-roles/delete-guard (frentes próprias) · `fetchCNPJFromRevenue` não desviado para duplicidade.

## DT
- `DT-PJ-CNPJ-DUPLICATE-ON-ENTRY-MISSING` → **CLOSED**. Residual benigno: feedback de duplicidade no submit (não a cada tecla) — antecipar exigiria rota de check segura (cleanup futuro opcional).

## Próximo passo (ordem Clayton)
3. Cargo/roles dedup · 4. KYB documents SSOT writer/read-only ou design (peça material do onboarding PJ — não deixar para muito tarde) · 5. Delete guard via Bank port · 6. KYB release gate financeiro.

# Execução — F-COMPANY-MEMBERS-READ-AUTHORITY-GATE-F6_5_5 (DECISION-0113 fatia 6.5.5) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA · **Branch:** `rescue-structural` · **HEAD origem:** `c199b96b`
**Decisor:** Clayton (GO F6.5.5; espelhar a fatia 2) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Impedir que um caller leia membros/cargos/estrutura interna de uma empresa que ele não gerencia. A fatia 2 protegeu os writes; os reads ficaram nus.

## READ-FIRST (company-members.routes.ts inteiro)
- `requireCompanyManage(req, reply, companyId)` (helper da fatia 2): `req.user.id`→`resolveGlobalUserId`→`companiesService.canManageCompany(tenant, companyId, globalUserId)`; 401 sem `req.user`; 403 sem autoridade.
- **Writes (gated fatia 2):** POST → `requireCompanyManage(req.params.companyId)`; PUT/DELETE → `target = getMember(memberId)` → `requireCompanyManage(target.companyId)` (**anti-IDOR**: empresa REAL do membro).
- **Reads (nus, escopo F6.5.5):** `GET /:companyId/members` → `listMembers(tenant, {companyId: URL})`; `GET /:companyId/members/:memberId` → `getMember(tenant, req.params.memberId)` (IDOR por memberId).
- Sem caso público legítimo de lista de membros → tratado como privado.

## Implementação (backend; 1 arquivo; sem R2/delegação/Bank/migration/frontend)
- **`GET /:companyId/members`** → `requireCompanyManage(req, reply, req.params.companyId)` antes de `listMembers` (espelha POST).
- **`GET /:companyId/members/:memberId`** (anti-IDOR) → `getMember(req.params.memberId)` → `requireCompanyManage(req, reply, member.companyId)` (empresa REAL do membro, não a URL); membro inexistente (404) → **403 não-leak** (uniforme com "sem autoridade").
- **Writes intocados.**

## Padrão de gate (classificação F6.5.0)
- company-members reads = **canManageCompany** (mesma autoridade dos writes; anti-IDOR via empresa real do membro).

## Prova
- **e2e novo** `validate-pipeline-e2e-company-members-read-authority-f6-5-5` **7/7**: **A** behavioral `canManageCompany(empresa aleatória, devGlobalUserId)=false` (fail-closed deny path — real); **B** estrutural gate-antes-da-leitura nos 2 GETs + anti-IDOR (`requireCompanyManage(member.companyId)`, não a URL) + não-leak 404→403 + writes intocados + gate canônico = o mesmo dos writes.
- **Cobertura behavioral do allow-path:** dono=true/estranho=false em empresa REAL é coberto pela regressão **`authority-escalation-gate` (fatia 2, ephemeral, 16/16)** — **DEV tem 0 companies/company_users** (substrato genuinamente ausente, como ledger/thread; ≠ feed que tinha substrato presente). Reportado, não fake-green.
- **Backend tsc** fora de geo = **0**. **4 gates OK** (dev **365**).
- **Núcleo 0113 + F6.5.1–4 intactos:** rbac 13/13 · escalation 16/16 · money-live 12/12 · plan-identity 9/9 · profile-c1 16/16 · lifestyle 10/10 · money-read-f6-1 8/8 · reads-f6-2-3 8/8 · groups-f6-4 10/10 · inbox-commitments-f6-5-1 8/8 · ledger-f6-5-2 7/7 · contextual-thread-f6-5-3 8/8 · feed-f6-5-4 8/8.

## O que NÃO foi tocado
Writes de company-members · R2/delegação · `actor_delegations` · Bank · migration · frontend · feed · ledger · inbox · contextual-thread · service-order · events.

## DTs
- `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED` OPEN (F6.5.5 fechada; restam 6.5.6–6.5.9). DT-mãe OPEN.

## Próximo passo (espera go)
**F6.5.6 — service-order reads + eventos private/unlisted.**
